import { expect, it } from 'vitest';
import type { CombatParticipant } from '@df/shared';
import { decideMonsterAction } from '../src/rooms/ai/tacticalAi.js';
const monster: CombatParticipant = { id: 'monster', name: 'Goblin', kind: 'MONSTER', hp: 5, maxHp: 100, mp: 20, maxMp: 20, str: 10, int: 20, dex: 10, wis: 10,
  defense: 10, dexMod: 0, passiveDodge: 0, flatDR: 0, speed: 3, baseSpeed: 3, archetypeId: '', attackType: 'ARCANE', baseDamage: 6,
  equipment: { mainHand: null, offHand: null, armor: null }, consumables: [], spells: [], buffs: [], cooldowns: {}, isAutoMode: true, allowAutoFlee: false,
  actions: [{ label: 'Attack', action: { type: 'ATTACK', subType: 'ARCANE', targetId: '' }, mpCost: 10 }, { label: 'Heal', action: { type: 'DEFEND', subType: 'HEAL', targetId: '' }, mpCost: 10 }, { label: 'Dodge', action: { type: 'DEFEND', subType: 'ACTIVE_DODGE' } }, { label: 'Flee', action: { type: 'FLEE' } }] };
const hero: CombatParticipant = { ...monster, kind: 'PLAYER', id: 'hero', hp: 50 };
it('never flees without explicit permission, respects flee blocking and heals wounded allies', () => {
  const decide = (m = monster, fleeBlocked = false) => decideMonsterAction({ monster: m, participants: [m, hero], actionIndex: 0, fleeBlocked });
  expect(decide()).toEqual({ type: 'DEFEND', subType: 'HEAL', targetId: monster.id });
  expect(decide({ ...monster, allowAutoFlee: true })).toEqual({ type: 'FLEE' });
  expect(decide({ ...monster, allowAutoFlee: true }, true)?.type).not.toBe('FLEE');
});
it('targets living present enemies deterministically and defends/passes when no action fits', () => {
  const healthy = { ...monster, hp: 100 };
  expect(decideMonsterAction({ monster: healthy, participants: [healthy, hero, { ...hero, id: 'absent', absent: true, hp: 1 }, { ...hero, id: 'dead', hp: 0 }], actionIndex: 0, fleeBlocked: false })).toEqual({ type: 'ATTACK', subType: 'ARCANE', targetId: 'hero' });
  expect(decideMonsterAction({ monster: { ...healthy, mp: 0 }, participants: [healthy, hero], actionIndex: 0, fleeBlocked: false })).toEqual({ type: 'DEFEND', subType: 'ACTIVE_DODGE' });
  expect(decideMonsterAction({ monster: { ...healthy, mp: 0 }, participants: [healthy, hero], actionIndex: 1, fleeBlocked: false })).toBeNull();
});
