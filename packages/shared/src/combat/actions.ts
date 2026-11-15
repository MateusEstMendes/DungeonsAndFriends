import type { SpellId } from '../rules/spells.js';

export const ACTION_TYPES = ['ATTACK', 'SPELL', 'DEFEND', 'ITEM', 'FLEE'] as const;
export const PHYSICAL_ATTACKS = ['SLASHING', 'BLUNT', 'THRUST', 'UNARMED', 'WARRIOR', 'BARBARIAN', 'ROGUE'] as const;
export const MAGICAL_ATTACKS = ['FIRE', 'ICE', 'LIGHT', 'DARKNESS', 'ARCANE'] as const;
export type AttackType = typeof PHYSICAL_ATTACKS[number] | typeof MAGICAL_ATTACKS[number];
export type CombatAction =
  | { type: 'ATTACK'; subType: AttackType; targetId: string; hand?: 'MAIN' | 'OFF' }
  | { type: 'SPELL'; spellId: SpellId; targetId: string }
  | { type: 'DEFEND'; subType: 'ACTIVE_DODGE' | 'SHIELD_BLOCK' | 'HEAL' | 'PROTECT'; targetId?: string }
  | { type: 'ITEM'; itemId: string; targetId: string }
  | { type: 'FLEE' };
export type ExtraActionType = 'PHYSICAL_ONLY' | 'MAGICAL_ONLY';
export function calculateTotalActions(str: number, int: number): { count: number; extraType: ExtraActionType } {
  return { count: 1 + Math.floor(Math.max(str, int) / 20), extraType: str >= int ? 'PHYSICAL_ONLY' : 'MAGICAL_ONLY' };
}
export const isMagicAttack = (subType: AttackType) => (MAGICAL_ATTACKS as readonly string[]).includes(subType);
/** actionIndex is zero-based; only the first action is unrestricted. */
export function validateAction(action: CombatAction, actionIndex: number, str: number, int: number): boolean {
  const budget = calculateTotalActions(str, int);
  if (!Number.isInteger(actionIndex) || actionIndex < 0 || actionIndex >= budget.count) return false;
  if (actionIndex === 0) return true;
  if (action.type === 'FLEE' || action.type === 'ITEM') return false;
  const magical = action.type === 'SPELL' || (action.type === 'ATTACK' ? isMagicAttack(action.subType) : action.subType === 'HEAL' || action.subType === 'PROTECT');
  return magical === (budget.extraType === 'MAGICAL_ONLY');
}
export function resolveFlee(speed: number, enemySpeeds: readonly number[], roll: number, flags: { fleeBlocked: boolean; guaranteedFlee: boolean }): boolean {
  if (flags.fleeBlocked) return false;
  if (flags.guaranteedFlee || enemySpeeds.length === 0) return true;
  const average = enemySpeeds.reduce((sum, value) => sum + value, 0) / enemySpeeds.length;
  return roll <= Math.max(5, Math.min(95, 50 + (speed - average) * 10));
}
