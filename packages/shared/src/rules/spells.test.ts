import { expect, it } from 'vitest';
import { EMPTY_EQUIPMENT, ITEM_CATALOG as I } from './items.js';
import { SPELL_CATALOG, SPELL_IDS, canCastSpell } from './spells.js';
import { rollDamageDice } from '../combat/dice.js';
it.each(SPELL_IDS)('requires a focus and exact MP budget for %s', id => {
  const spell = SPELL_CATALOG[id];
  expect(canCastSpell(EMPTY_EQUIPMENT, 100, spell)).toBe(false);
  expect(canCastSpell({ ...EMPTY_EQUIPMENT, mainHand: I.MACE, offHand: I.STEEL_SHIELD }, 100, spell)).toBe(false);
  for (const equipment of [{ ...EMPTY_EQUIPMENT, mainHand: I.ARCANE_STAFF }, { ...EMPTY_EQUIPMENT, mainHand: I.WAND }, { ...EMPTY_EQUIPMENT, offHand: I.DIVINE_FOCUS }]) {
    expect(canCastSpell(equipment, spell.mpCost - 1, spell)).toBe(false);
    expect(canCastSpell(equipment, spell.mpCost, spell)).toBe(true);
    for (const invalid of [-1, NaN, Infinity, 100.5]) expect(canCastSpell(equipment, invalid, spell)).toBe(false);
  }
  expect(spell).not.toHaveProperty('rangeHex'); expect(rollDamageDice(spell.damageDice, () => 1)).toBeGreaterThan(0);
});
it('defines JRPG area, ally healing and the slow duration without hex targeting', () => {
  expect(Object.values(SPELL_CATALOG).map(s => s.mpCost)).toEqual([4, 10, 6, 8]);
  expect(SPELL_CATALOG.IGNEOUS_BLAST).toMatchObject({ targetMode: 'ALL_ENEMIES', damageDice: '2d6', attribute: 'INT' });
  expect(SPELL_CATALOG.HEALING_LIGHT).toMatchObject({ targetMode: 'SINGLE_ALLY', damageDice: '2d6', attribute: 'WIS' });
  expect(SPELL_CATALOG.FREEZING_RAY.effect).toEqual({ type: 'SLOW', speedPenalty: 1, rounds: 1 });
});
