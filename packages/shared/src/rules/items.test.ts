import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS } from './classes.js';
import { applyRacialModifiers } from './races.js';
import { calculatePassiveDodge, getModifier } from './stats.js';
import { EMPTY_EQUIPMENT, ITEM_CATALOG as I, ITEM_IDS, calculateSellPrice, equipItemValidator, getStarterKit, recalculateCharacterStats, type Equipment, type EquipmentSlot } from './items.js';
import { SPELL_CATALOG } from './spells.js';
import { rollDamageDice } from '../combat/dice.js';
const base = { baseAttributes: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 }, raceId: 'HUMAN' as const, humanBonusAttribute: 'str' as const };

describe('equipment slots and copies', () => {
  it('replaces both hands with a 2H weapon without mutating the previous loadout', () => {
    const previous: Equipment = { mainHand: I.SHORT_SWORD, offHand: I.WOODEN_SHIELD, armor: I.STUDDED_LEATHER };
    const result = equipItemValidator(previous, I.BATTLE_AXE);
    expect(result.updatedEquipment).toEqual({ mainHand: I.BATTLE_AXE, offHand: null, armor: I.STUDDED_LEATHER });
    expect(result.unequippedToBag).toEqual([I.WOODEN_SHIELD, I.SHORT_SWORD]);
    expect(previous.offHand).toBe(I.WOODEN_SHIELD);
  });
  it('moves a two-handed weapon or focus to the bag when equipping the other hand', () => {
    for (const twoHanded of [I.GREAT_SWORD, I.ARCANE_STAFF, I.SHORT_BOW, I.CROSSBOW]) {
      const current = equipItemValidator(EMPTY_EQUIPMENT, twoHanded).updatedEquipment;
      const result = equipItemValidator(current, I.WOODEN_SHIELD);
      expect(result.updatedEquipment).toEqual({ mainHand: null, offHand: I.WOODEN_SHIELD, armor: null });
      expect(result.unequippedToBag).toEqual([twoHanded]);
    }
  });
  it('allows identical daggers in separate slots and a divine focus beside a mace', () => {
    const main = equipItemValidator(EMPTY_EQUIPMENT, I.DAGGER).updatedEquipment;
    const dual = equipItemValidator(main, I.DAGGER, 'OFF_HAND');
    expect(dual.updatedEquipment.mainHand).toBe(I.DAGGER); expect(dual.updatedEquipment.offHand).toBe(I.DAGGER);
    expect(dual.unequippedToBag).toEqual([]);
    expect(equipItemValidator(dual.updatedEquipment, I.WOODEN_SHIELD).unequippedToBag).toEqual([I.DAGGER]);
    const cleric = equipItemValidator({ ...EMPTY_EQUIPMENT, mainHand: I.MACE }, I.DIVINE_FOCUS, 'OFF_HAND');
    expect(cleric.updatedEquipment.mainHand).toBe(I.MACE);
  });
  it('rejects bags, incompatible slots and two-handed items in the secondary hand', () => {
    for (const [item, slot] of [[I.HEALTH_POTION, undefined], [I.KEY, undefined], [I.ARCANE_STAFF, 'OFF_HAND'], [I.STUDDED_LEATHER, 'MAIN_HAND'], [I.STEEL_SHIELD, 'ARMOR']] as const)
      expect(() => equipItemValidator(EMPTY_EQUIPMENT, item, slot)).toThrow('slot');
  });
});
describe('stats recalculated from phase-2 base attributes', () => {
  it('reapplies racial dexterity, then heavy armor penalty to defense, dodge and speed', () => {
    const character = { ...base, raceId: 'ELF' as const, humanBonusAttribute: undefined };
    const stats = recalculateCharacterStats(character, { ...EMPTY_EQUIPMENT, armor: I.PLATE_ARMOR });
    expect(stats).toEqual({ finalDex: 16, dexMod: 3, defense: 20, dodgeChance: 6, speed: 3, flatDr: 2 });
    expect(recalculateCharacterStats(character, { ...EMPTY_EQUIPMENT, armor: I.PLATE_ARMOR })).toEqual(stats);
    expect(recalculateCharacterStats(character, EMPTY_EQUIPMENT)).toEqual({ finalDex: 18, dexMod: 4, defense: 14, dodgeChance: 18, speed: 4, flatDr: 0 });
  });
  it('caps medium armor positive dexterity contribution without erasing negative modifiers', () => {
    expect(recalculateCharacterStats(base, { ...EMPTY_EQUIPMENT, armor: I.CHAIN_MAIL }).defense).toBe(16);
    expect(recalculateCharacterStats({ ...base, baseAttributes: { ...base.baseAttributes, dex: 5 } }, { ...EMPTY_EQUIPMENT, armor: I.CHAIN_MAIL }).defense).toBe(12);
  });
  it('preserves racial defense and DR, stacks shields, clamps dodge to 0..20', () => {
    expect(recalculateCharacterStats({ ...base, raceId: 'HALF_DRAGON', humanBonusAttribute: undefined }, { ...EMPTY_EQUIPMENT, armor: I.STUDDED_LEATHER, offHand: I.WOODEN_SHIELD }).defense).toBe(19);
    expect(recalculateCharacterStats({ ...base, raceId: 'DWARF', humanBonusAttribute: undefined }, { ...EMPTY_EQUIPMENT, armor: I.PLATE_ARMOR, offHand: I.STEEL_SHIELD }).flatDr).toBe(4);
    const highDex = { ...base, raceId: 'ELF' as const, humanBonusAttribute: undefined, baseAttributes: { ...base.baseAttributes, dex: 30 } };
    expect(recalculateCharacterStats(highDex, { ...EMPTY_EQUIPMENT, armor: I.STUDDED_LEATHER }).dodgeChance).toBe(20);
    expect(recalculateCharacterStats(highDex, { ...EMPTY_EQUIPMENT, armor: I.PLATE_ARMOR }).dodgeChance).toBe(10);
    expect(recalculateCharacterStats({ ...base, baseAttributes: { ...base.baseAttributes, dex: 1 } }, { ...EMPTY_EQUIPMENT, armor: I.PLATE_ARMOR }).dodgeChance).toBe(0);
    const humanDex = { ...base, humanBonusAttribute: 'dex' as const };
    expect(recalculateCharacterStats(humanDex, EMPTY_EQUIPMENT).finalDex).toBe(applyRacialModifiers(humanDex.baseAttributes, 'HUMAN', 'dex').dex);
    expect(recalculateCharacterStats(humanDex, EMPTY_EQUIPMENT).dodgeChance).toBe(calculatePassiveDodge(getModifier(18), 'HUMAN'));
  });
  it('rejects an invalid two-handed loadout instead of counting a phantom shield bonus', () => {
    expect(() => recalculateCharacterStats(base, { ...EMPTY_EQUIPMENT, mainHand: I.BATTLE_AXE, offHand: I.STEEL_SHIELD })).toThrow('duas mãos');
  });
});
describe('economy, catalog and starter kits', () => {
  it('sells for half the integer price, rounds down and rejects invalid gold', () => {
    expect(calculateSellPrice(I.DAGGER.basePriceGold)).toBe(20); expect(calculateSellPrice(41)).toBe(20); expect(calculateSellPrice(0)).toBe(0);
    for (const invalid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => calculateSellPrice(invalid)).toThrow();
  });
  it.each(ARCHETYPE_IDS)('provides an independent valid kit for %s, two potions and 50G', archetype => {
    const kit = getStarterKit(archetype); expect(kit.gold).toBe(50);
    expect(kit.items.find(i => i.itemId === 'HEALTH_POTION')).toEqual({ itemId: 'HEALTH_POTION', slot: 'BAG', quantity: 2 });
    let equipped: Equipment = { ...EMPTY_EQUIPMENT };
    for (const entry of kit.items) {
      expect(ITEM_IDS).toContain(entry.itemId);
      if (entry.slot !== 'BAG') {
        const result = equipItemValidator(equipped, I[entry.itemId], entry.slot as EquipmentSlot);
        expect(result.unequippedToBag).toEqual([]); equipped = result.updatedEquipment;
      }
    }
    expect(kit.spells.length).toBe(['MAGE', 'CLERIC'].includes(archetype) ? 2 : 0);
    for (const id of kit.spells) expect(SPELL_CATALOG[id]).toBeDefined();
    kit.items.pop(); kit.spells.pop(); expect(getStarterKit(archetype)).not.toEqual(kit);
  });
  it('keeps all item identities/prices consistent and damage notation rollable', () => {
    for (const [id, item] of Object.entries(I)) {
      expect(item.id).toBe(id); expect(calculateSellPrice(item.basePriceGold)).toBeGreaterThanOrEqual(0);
      expect(item).not.toHaveProperty('rangeHex');
      if ('damageDice' in item) expect(rollDamageDice(item.damageDice, () => 1)).toBeGreaterThan(0);
      if ('effect' in item && item.effect.type === 'LEARN_SPELL') expect(SPELL_CATALOG[item.effect.spellId]).toBeDefined();
    }
  });
});
