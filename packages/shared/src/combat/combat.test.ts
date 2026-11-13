import { describe, expect, it } from 'vitest';
import { calculateTotalActions, resolveFlee, validateAction } from './actions.js';
import { resolveAttack, type AttackInput, type CombatantStats } from './damage.js';

const stats: CombatantStats = { hp: 100, maxHp: 100, dexMod: 3, passiveDodge: 0, flatDR: 0 };
const attack: AttackInput = { attacker: stats, defender: stats, attackRoll: 15, naturalRoll: 12, baseDamage: 4, isMagic: false, isMelee: true };
describe('combat formulas', () => {
  it('keeps damage at one after flat mitigation', () => {
    expect(resolveAttack({ ...attack, defender: { ...stats, flatDR: 5 } }, () => 100)).toMatchObject({ finalDamage: 1, drAbsorbed: 3 });
  });
  it('caps passive dodge at 20 percent and includes the boundary', () => {
    const input = { ...attack, defender: { ...stats, passiveDodge: 99 } };
    expect(resolveAttack(input, () => 20).outcome).toBe('DODGED_PASSIVE');
    expect(resolveAttack(input, () => 21).outcome).toBe('HIT');
  });
  it('compares active dodge plus dexterity, including ties, before passive dodge', () => {
    const faces: number[] = [];
    expect(resolveAttack({ ...attack, defender: { ...stats, stance: 'ACTIVE_DODGE' } }, f => { faces.push(f); return 12; })).toMatchObject({ outcome: 'DODGED_ACTIVE', finalDamage: 0, dodgeRoll: 15 });
    expect(faces).toEqual([20]);
  });
  it('continues to passive dodge when the active check fails', () => {
    expect(resolveAttack({ ...attack, defender: { ...stats, stance: 'ACTIVE_DODGE', passiveDodge: 20 } }, () => 1).outcome).toBe('DODGED_PASSIVE');
  });
  it('applies criticals, racial thresholds, penetration and lifesteal', () => {
    expect(resolveAttack({ ...attack, naturalRoll: 19, criticalFrom: 19, attacker: { ...stats, raceId: 'ORC', hp: 29 } }, () => 100).finalDamage).toBe(12);
    expect(resolveAttack({ ...attack, attacker: { ...stats, raceId: 'ORC', hp: 30 } }, () => 100).finalDamage).toBe(4);
    expect(resolveAttack({ ...attack, attacker: { ...stats, raceId: 'HALF_SHARK' }, defender: { ...stats, hp: 49 } }, () => 100).finalDamage).toBe(6);
    expect(resolveAttack({ ...attack, isMagic: true, attacker: { ...stats, raceId: 'DEMON' }, defender: { ...stats, flatDR: 3 } }, () => 100).finalDamage).toBe(3);
    expect(resolveAttack({ ...attack, baseDamage: 19, attacker: { ...stats, raceId: 'VAMPIRE' } }, () => 100).healAmount).toBe(3);
  });
  it('restricts extra actions to their attribute family and forbids extra fleeing', () => {
    expect(calculateTotalActions(20, 10)).toEqual({ count: 2, extraType: 'PHYSICAL_ONLY' });
    expect(calculateTotalActions(10, 40)).toEqual({ count: 3, extraType: 'MAGICAL_ONLY' });
    expect(validateAction({ type: 'FLEE' }, 1, 20, 10)).toBe(false);
    expect(validateAction({ type: 'ATTACK', subType: 'FIRE', targetId: 'x' }, 1, 20, 10)).toBe(false);
    expect(validateAction({ type: 'ATTACK', subType: 'SLASHING', targetId: 'x' }, 1, 20, 10)).toBe(true);
    expect(validateAction({ type: 'FLEE' }, 2, 20, 10)).toBe(false);
  });
  it('honors flee sovereignty and relative speed', () => {
    expect(resolveFlee(10, [1], 1, { fleeBlocked: true, guaranteedFlee: true })).toBe(false);
    expect(resolveFlee(1, [10], 100, { fleeBlocked: false, guaranteedFlee: true })).toBe(true);
    expect(resolveFlee(3, [3, 3], 50, { fleeBlocked: false, guaranteedFlee: false })).toBe(true);
  });
});
