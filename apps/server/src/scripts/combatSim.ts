import { resolveAttack, calculateTotalActions, validateAction, type CombatantStats } from '@df/shared';
import { roll } from '../services/diceService.js';

const attacker: CombatantStats = { hp: 100, maxHp: 100, defense: 13, dexMod: 3, flatDR: 0, passiveDodge: 0, raceId: 'VAMPIRE' };
const defender: CombatantStats = { hp: 100, maxHp: 100, defense: 12, dexMod: 2, flatDR: 5, passiveDodge: 80 };
const totals = { turns: 10000, hits: 0, activeDodges: 0, passiveDodges: 0, defenseMisses: 0, damage: 0, healing: 0 };
for (let turn = 0; turn < totals.turns; turn++) {
  const naturalRoll = roll(20);
  const result = resolveAttack({ attacker, defender: { ...defender, stance: turn % 2 ? 'ACTIVE_DODGE' : '' },
    naturalRoll, attackRoll: naturalRoll + 3, baseDamage: 4 + roll(6), isMagic: false, isMelee: true }, roll);
  if (result.outcome === 'MISSED_DEFENSE') totals.defenseMisses++;
  else if (result.outcome === 'DODGED_ACTIVE') totals.activeDodges++;
  else if (result.outcome === 'DODGED_PASSIVE') totals.passiveDodges++;
  else { totals.hits++; if (result.finalDamage < 1) throw new Error('Dano mínimo violado'); }
  totals.damage += result.finalDamage; totals.healing += result.healAmount;
}
if (calculateTotalActions(20, 10).count !== 2 || validateAction({ type: 'FLEE' }, 1, 20, 10)) throw new Error('Ações adicionais inválidas');
console.log(JSON.stringify({ ...totals, averageDamage: totals.damage / totals.turns }, null, 2));
