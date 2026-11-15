import type { ArchetypeId } from './classes.js';
import type { AttributeId, Attributes } from './pointBuy.js';
import { applyRacialModifiers, type RaceId } from './races.js';
import { calculateBaseDefense, calculateFlatDR, calculatePassiveDodge, calculateSpeed, getModifier } from './stats.js';
import type { SpellId } from './spells.js';

export type Handedness = 'ONE_HANDED' | 'TWO_HANDED';
export type EquipmentSlot = 'MAIN_HAND' | 'OFF_HAND' | 'ARMOR';
export type InventorySlot = EquipmentSlot | 'BAG';
export type DamageDice = `${number}d${number}`;
export type ItemEffect =
  | { type: 'RESTORE_HP' | 'RESTORE_MP'; amount: number }
  | { type: 'CURE_STATUS'; status: 'POISON' }
  | { type: 'MAGIC_DAMAGE'; amount: number; rounds: number }
  | { type: 'PHYSICAL_DAMAGE'; multiplier: number; rounds: number }
  | { type: 'LEARN_SPELL'; spellId: SpellId };
interface ItemBase { id: string; name: string; basePriceGold: number }
export type Item = ItemBase & (
  | { category: 'WEAPON' | 'RANGED'; handedness: Handedness; slot: 'MAIN_HAND'; damageDice: DamageDice; damageType: 'SLASHING' | 'THRUST' | 'BLUNT' }
  | { category: 'MAGIC_FOCUS'; handedness: Handedness; slot: 'MAIN_HAND' }
  | { category: 'SHIELD'; slot: 'OFF_HAND'; defenseBonus: number; drBonus: number }
  | { category: 'ARMOR'; slot: 'ARMOR'; armorType: 'LIGHT' | 'MEDIUM' | 'HEAVY'; defenseBonus: number; drBonus: number; dexPenalty: number; dodgeMod: number; maxDexBonus?: number }
  | { category: 'CONSUMABLE'; slot: 'BAG'; effect: ItemEffect }
  | { category: 'NARRATIVE'; slot: 'BAG' }
);

export const ITEM_CATALOG = {
  GREAT_SWORD: { id: 'GREAT_SWORD', name: 'Espada Grande', category: 'WEAPON', handedness: 'TWO_HANDED', slot: 'MAIN_HAND', basePriceGold: 100, damageDice: '2d6', damageType: 'SLASHING' },
  BATTLE_AXE: { id: 'BATTLE_AXE', name: 'Machado de Batalha', category: 'WEAPON', handedness: 'TWO_HANDED', slot: 'MAIN_HAND', basePriceGold: 90, damageDice: '1d12', damageType: 'SLASHING' },
  LONG_SPEAR: { id: 'LONG_SPEAR', name: 'Lança Longa', category: 'WEAPON', handedness: 'TWO_HANDED', slot: 'MAIN_HAND', basePriceGold: 75, damageDice: '1d10', damageType: 'THRUST' },
  SHORT_SWORD: { id: 'SHORT_SWORD', name: 'Espada Curta', category: 'WEAPON', handedness: 'ONE_HANDED', slot: 'MAIN_HAND', basePriceGold: 60, damageDice: '1d6', damageType: 'SLASHING' },
  DAGGER: { id: 'DAGGER', name: 'Adaga', category: 'WEAPON', handedness: 'ONE_HANDED', slot: 'MAIN_HAND', basePriceGold: 40, damageDice: '1d4', damageType: 'THRUST' },
  MACE: { id: 'MACE', name: 'Maça', category: 'WEAPON', handedness: 'ONE_HANDED', slot: 'MAIN_HAND', basePriceGold: 50, damageDice: '1d6', damageType: 'BLUNT' },
  SHORT_BOW: { id: 'SHORT_BOW', name: 'Arco Curto', category: 'RANGED', handedness: 'TWO_HANDED', slot: 'MAIN_HAND', basePriceGold: 70, damageDice: '1d6', damageType: 'THRUST' },
  CROSSBOW: { id: 'CROSSBOW', name: 'Besta', category: 'RANGED', handedness: 'TWO_HANDED', slot: 'MAIN_HAND', basePriceGold: 85, damageDice: '1d8', damageType: 'THRUST' },
  WOODEN_SHIELD: { id: 'WOODEN_SHIELD', name: 'Escudo de Madeira', category: 'SHIELD', slot: 'OFF_HAND', basePriceGold: 30, defenseBonus: 2, drBonus: 0 },
  STEEL_SHIELD: { id: 'STEEL_SHIELD', name: 'Escudo de Aço', category: 'SHIELD', slot: 'OFF_HAND', basePriceGold: 80, defenseBonus: 3, drBonus: 1 },
  ARCANE_STAFF: { id: 'ARCANE_STAFF', name: 'Cajado Arcano', category: 'MAGIC_FOCUS', handedness: 'TWO_HANDED', slot: 'MAIN_HAND', basePriceGold: 70 },
  WAND: { id: 'WAND', name: 'Varinha', category: 'MAGIC_FOCUS', handedness: 'ONE_HANDED', slot: 'MAIN_HAND', basePriceGold: 50 },
  DIVINE_FOCUS: { id: 'DIVINE_FOCUS', name: 'Foco Divino', category: 'MAGIC_FOCUS', handedness: 'ONE_HANDED', slot: 'MAIN_HAND', basePriceGold: 50 },
  STUDDED_LEATHER: { id: 'STUDDED_LEATHER', name: 'Couro Batido', category: 'ARMOR', slot: 'ARMOR', armorType: 'LIGHT', basePriceGold: 60, defenseBonus: 2, drBonus: 0, dexPenalty: 0, dodgeMod: 5 },
  CHAIN_MAIL: { id: 'CHAIN_MAIL', name: 'Cota de Malha', category: 'ARMOR', slot: 'ARMOR', armorType: 'MEDIUM', basePriceGold: 120, defenseBonus: 4, drBonus: 0, dexPenalty: 0, dodgeMod: 0, maxDexBonus: 2 },
  PLATE_ARMOR: { id: 'PLATE_ARMOR', name: 'Armadura de Placas', category: 'ARMOR', slot: 'ARMOR', armorType: 'HEAVY', basePriceGold: 200, defenseBonus: 7, drBonus: 2, dexPenalty: 2, dodgeMod: -10 },
  HEALTH_POTION: { id: 'HEALTH_POTION', name: 'Poção de Vida', category: 'CONSUMABLE', slot: 'BAG', basePriceGold: 20, effect: { type: 'RESTORE_HP', amount: 25 } },
  MANA_POTION: { id: 'MANA_POTION', name: 'Poção de Mana', category: 'CONSUMABLE', slot: 'BAG', basePriceGold: 25, effect: { type: 'RESTORE_MP', amount: 20 } },
  ANTIDOTE: { id: 'ANTIDOTE', name: 'Antídoto', category: 'CONSUMABLE', slot: 'BAG', basePriceGold: 15, effect: { type: 'CURE_STATUS', status: 'POISON' } },
  MAGIC_BOOK: { id: 'MAGIC_BOOK', name: 'Livro Mágico', category: 'CONSUMABLE', slot: 'BAG', basePriceGold: 40, effect: { type: 'MAGIC_DAMAGE', amount: 4, rounds: 2 } },
  THE_JUICE: { id: 'THE_JUICE', name: 'O Suco', category: 'CONSUMABLE', slot: 'BAG', basePriceGold: 40, effect: { type: 'PHYSICAL_DAMAGE', multiplier: 1.20, rounds: 2 } },
  SPELL_SCROLL_ARCANE_DART: { id: 'SPELL_SCROLL_ARCANE_DART', name: 'Pergaminho de Dardo Arcano', category: 'CONSUMABLE', slot: 'BAG', basePriceGold: 40, effect: { type: 'LEARN_SPELL', spellId: 'ARCANE_DART' } },
  SPELL_SCROLL_IGNEOUS_BLAST: { id: 'SPELL_SCROLL_IGNEOUS_BLAST', name: 'Pergaminho de Explosão Ígnea', category: 'CONSUMABLE', slot: 'BAG', basePriceGold: 100, effect: { type: 'LEARN_SPELL', spellId: 'IGNEOUS_BLAST' } },
  SPELL_SCROLL_HEALING_LIGHT: { id: 'SPELL_SCROLL_HEALING_LIGHT', name: 'Pergaminho de Luz Curativa', category: 'CONSUMABLE', slot: 'BAG', basePriceGold: 60, effect: { type: 'LEARN_SPELL', spellId: 'HEALING_LIGHT' } },
  SPELL_SCROLL_FREEZING_RAY: { id: 'SPELL_SCROLL_FREEZING_RAY', name: 'Pergaminho de Raio Congelante', category: 'CONSUMABLE', slot: 'BAG', basePriceGold: 80, effect: { type: 'LEARN_SPELL', spellId: 'FREEZING_RAY' } },
  KEY: { id: 'KEY', name: 'Chave', category: 'NARRATIVE', slot: 'BAG', basePriceGold: 5 },
  ROPE: { id: 'ROPE', name: 'Corda', category: 'NARRATIVE', slot: 'BAG', basePriceGold: 10 },
  TORCH: { id: 'TORCH', name: 'Tocha', category: 'NARRATIVE', slot: 'BAG', basePriceGold: 5 },
} as const satisfies Record<string, Item>;
export type ItemId = keyof typeof ITEM_CATALOG;
export const ITEM_IDS = Object.keys(ITEM_CATALOG) as ItemId[];
export interface Equipment { mainHand: Item | null; offHand: Item | null; armor: Item | null }
export const EMPTY_EQUIPMENT: Readonly<Equipment> = Object.freeze({ mainHand: null, offHand: null, armor: null });
const equipmentKeys = { MAIN_HAND: 'mainHand', OFF_HAND: 'offHand', ARMOR: 'armor' } as const;
export const isTwoHanded = (item: Item | null) => !!item && 'handedness' in item && item.handedness === 'TWO_HANDED';
function fitsSlot(item: Item, slot: EquipmentSlot): boolean {
  if (slot === 'ARMOR') return item.category === 'ARMOR';
  if (slot === 'MAIN_HAND') return 'handedness' in item;
  return item.category === 'SHIELD' || ('handedness' in item && item.handedness === 'ONE_HANDED');
}
/** Moves displaced copies to the bag; ownership/quantity is validated by the repository. */
export function equipItemValidator(currentEquipment: Readonly<Equipment>, newItem: Item, slot?: EquipmentSlot): { updatedEquipment: Equipment; unequippedToBag: Item[] } {
  const target = slot ?? newItem.slot;
  if (target === 'BAG' || !fitsSlot(newItem, target)) throw new Error('Item incompatível com o slot de equipamento.');
  const updatedEquipment = { ...currentEquipment }, unequippedToBag: Item[] = [];
  const remove = (key: keyof Equipment) => { const old = updatedEquipment[key]; if (old) unequippedToBag.push(old); updatedEquipment[key] = null; };
  if (target === 'MAIN_HAND' && isTwoHanded(newItem)) remove('offHand');
  if (target === 'OFF_HAND' && isTwoHanded(updatedEquipment.mainHand)) remove('mainHand');
  const key = equipmentKeys[target]; remove(key); updatedEquipment[key] = newItem;
  return { updatedEquipment, unequippedToBag };
}
export function calculateSellPrice(basePriceGold: number): number {
  if (!Number.isSafeInteger(basePriceGold) || basePriceGold < 0) throw new Error('Preço deve ser um inteiro não negativo.');
  return Math.floor(basePriceGold * 0.50);
}
/** Always pass the original point-buy attributes, never currently equipped finalDex. */
export function recalculateCharacterStats(baseCharacter: { baseAttributes: Attributes; raceId: RaceId; humanBonusAttribute?: AttributeId }, equippedItems: Readonly<Equipment>) {
  const final = applyRacialModifiers(baseCharacter.baseAttributes, baseCharacter.raceId, baseCharacter.humanBonusAttribute);
  return recalculateEquipmentStats(final.dex, baseCharacter.raceId, equippedItems);
}
/** baseFinalDex is the immutable racial Dexterity saved before any equipment modifiers. */
export function recalculateEquipmentStats(baseFinalDex: number, raceId: RaceId, equippedItems: Readonly<Equipment>) {
  for (const slot of ['MAIN_HAND', 'OFF_HAND', 'ARMOR'] as const) {
    const item = equippedItems[equipmentKeys[slot]];
    if (item && !fitsSlot(item, slot)) throw new Error('Equipamento em slot incompatível.');
  }
  if (isTwoHanded(equippedItems.mainHand) && equippedItems.offHand) throw new Error('Arma de duas mãos bloqueia a mão secundária.');
  const armor = equippedItems.armor?.category === 'ARMOR' ? equippedItems.armor : null;
  const shield = equippedItems.offHand?.category === 'SHIELD' ? equippedItems.offHand : null;
  const finalDex = baseFinalDex - (armor?.dexPenalty ?? 0), dexMod = getModifier(finalDex);
  const defenseDex = Math.min(dexMod, armor?.maxDexBonus ?? Infinity);
  // Apply armor to the phase-2 dodge value, then enforce the global cap.
  const dodgeChance = Math.max(0, Math.min(20, calculatePassiveDodge(dexMod, raceId) + (armor?.dodgeMod ?? 0)));
  return { finalDex, dexMod, defense: calculateBaseDefense(defenseDex, raceId) + (armor?.defenseBonus ?? 0) + (shield?.defenseBonus ?? 0),
    dodgeChance, speed: calculateSpeed(dexMod), flatDr: calculateFlatDR(raceId) + (armor?.drBonus ?? 0) + (shield?.drBonus ?? 0) };
}
export interface StarterKit { gold: number; items: { itemId: ItemId; slot: InventorySlot; quantity: number }[]; spells: SpellId[] }
export function getStarterKit(archetypeId: ArchetypeId): StarterKit {
  const kits: Record<ArchetypeId, { equipment: Partial<Record<EquipmentSlot, ItemId>>; spells: SpellId[] }> = {
    WARRIOR: { equipment: { MAIN_HAND: 'SHORT_SWORD', OFF_HAND: 'WOODEN_SHIELD', ARMOR: 'STUDDED_LEATHER' }, spells: [] },
    BARBARIAN: { equipment: { MAIN_HAND: 'BATTLE_AXE' }, spells: [] },
    ROGUE: { equipment: { MAIN_HAND: 'DAGGER', OFF_HAND: 'DAGGER', ARMOR: 'STUDDED_LEATHER' }, spells: [] },
    MAGE: { equipment: { MAIN_HAND: 'ARCANE_STAFF' }, spells: ['ARCANE_DART', 'FREEZING_RAY'] },
    CLERIC: { equipment: { MAIN_HAND: 'MACE', OFF_HAND: 'DIVINE_FOCUS' }, spells: ['HEALING_LIGHT', 'ARCANE_DART'] },
  };
  const kit = kits[archetypeId];
  return { gold: 50, items: [...Object.entries(kit.equipment).map(([slot, itemId]) => ({ itemId, slot: slot as EquipmentSlot, quantity: 1 })),
    { itemId: 'HEALTH_POTION', slot: 'BAG', quantity: 2 }], spells: [...kit.spells] };
}
