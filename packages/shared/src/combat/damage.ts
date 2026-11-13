import type { RaceId } from '../rules/races.js';

export interface CombatantStats {
  hp: number; maxHp: number; raceId?: RaceId;
  dexMod: number; passiveDodge: number; flatDR: number;
  stance?: 'ACTIVE_DODGE' | 'SHIELD_BLOCK' | ''; shieldDR?: number;
}
export interface AttackInput {
  attacker: CombatantStats; defender: CombatantStats;
  attackRoll: number; naturalRoll: number; baseDamage: number;
  isMagic: boolean; isMelee: boolean; criticalFrom?: number;
}
export interface DamageResult {
  outcome: 'DODGED_ACTIVE' | 'DODGED_PASSIVE' | 'HIT' | 'CRITICAL';
  finalDamage: number; rawDamage: number; drAbsorbed: number; healAmount: number;
  dodgeRoll?: number;
}
/** All randomness is injected; identical inputs and rolls produce identical output. */
export function resolveAttack(input: AttackInput, roll: (faces: number) => number): DamageResult {
  const { attacker, defender, attackRoll, naturalRoll, baseDamage, isMagic, isMelee } = input;
  let dodgeRoll: number | undefined;
  const miss = (outcome: 'DODGED_ACTIVE' | 'DODGED_PASSIVE'): DamageResult => ({ outcome, finalDamage: 0, rawDamage: 0, drAbsorbed: 0, healAmount: 0, dodgeRoll });
  if (defender.stance === 'ACTIVE_DODGE') {
    dodgeRoll = roll(20) + defender.dexMod;
    if (dodgeRoll >= attackRoll) return miss('DODGED_ACTIVE');
  }
  if (roll(100) <= Math.max(0, Math.min(20, defender.passiveDodge))) return miss('DODGED_PASSIVE');
  const critical = naturalRoll >= (input.criticalFrom ?? 20);
  let bonus = 0;
  if (!isMagic && attacker.raceId === 'ORC' && attacker.hp < attacker.maxHp * 0.30) bonus += 2;
  if (isMelee && attacker.raceId === 'HALF_SHARK' && defender.hp < defender.maxHp * 0.50) bonus += 2;
  const rawDamage = Math.max(0, baseDamage + bonus) * (critical ? 2 : 1);
  const shield = !isMagic && defender.stance === 'SHIELD_BLOCK' ? Math.max(0, defender.shieldDR ?? 2) : 0;
  const effectiveDR = Math.max(0, defender.flatDR + shield - (isMagic && attacker.raceId === 'DEMON' ? 2 : 0));
  const finalDamage = Math.max(1, rawDamage - effectiveDR);
  return { outcome: critical ? 'CRITICAL' : 'HIT', rawDamage, finalDamage,
    drAbsorbed: Math.max(0, rawDamage - finalDamage),
    healAmount: attacker.raceId === 'VAMPIRE' && isMelee ? Math.floor(finalDamage * 0.20) : 0, dodgeRoll };
}
