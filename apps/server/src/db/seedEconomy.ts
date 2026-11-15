import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { ATTRIBUTE_IDS, EMPTY_EQUIPMENT, ITEM_CATALOG, SPELL_CATALOG, getStarterKit, recalculateEquipmentStats,
  type Item, type Equipment, type Spell } from '@df/shared';
import * as schema from './schema.js';

type Db = BetterSQLite3Database<typeof schema>;
type Executor = Pick<Db, 'select' | 'insert' | 'update'>;
export function itemCatalogRow(item: Item): typeof schema.itemsCatalog.$inferInsert {
  return { id: item.id as keyof typeof ITEM_CATALOG, name: item.name, category: item.category, slot: item.slot, basePriceGold: item.basePriceGold,
    handedness: 'handedness' in item ? item.handedness : null, damageDice: 'damageDice' in item ? item.damageDice : null,
    damageType: 'damageType' in item ? item.damageType : null, armorType: item.category === 'ARMOR' ? item.armorType : null,
    defenseBonus: 'defenseBonus' in item ? item.defenseBonus : 0, drBonus: 'drBonus' in item ? item.drBonus : 0,
    dexPenalty: item.category === 'ARMOR' ? item.dexPenalty : 0, dodgeMod: item.category === 'ARMOR' ? item.dodgeMod : 0,
    maxDexBonus: item.category === 'ARMOR' ? item.maxDexBonus ?? null : null, effectJson: 'effect' in item ? JSON.stringify(item.effect) : null };
}
export function spellCatalogRow(spell: Spell): typeof schema.spellsCatalog.$inferInsert {
  const { effect, ...data } = spell;
  return { ...data, effectJson: effect ? JSON.stringify(effect) : null };
}
/** Preserve canonical entries already tuned by the Master, restoring missing IDs only. */
export function seedEconomyCatalogs(db: Executor) {
  for (const item of Object.values(ITEM_CATALOG)) db.insert(schema.itemsCatalog).values(itemCatalogRow(item)).onConflictDoNothing().run();
  for (const spell of Object.values(SPELL_CATALOG)) db.insert(schema.spellsCatalog).values(spellCatalogRow(spell)).onConflictDoNothing().run();
}
function recoverHumanBonus(row: typeof schema.characters.$inferSelect) {
  if (row.raceId !== 'HUMAN' || row.humanBonusAttribute) return row.humanBonusAttribute;
  const deltas = { str: row.finalStr - row.baseStr - 1, dex: row.finalDex - row.baseDex - 1,
    con: row.finalCon - row.baseCon - 1, int: row.finalInt - row.baseInt - 1,
    wis: row.finalWis - row.baseWis - 1, cha: row.finalCha - row.baseCha - 1 };
  // Tuned legacy attributes may be ambiguous; immutable baseFinalDex still preserves them.
  const selected = ATTRIBUTE_IDS.filter(attr => deltas[attr] === 1);
  return selected.length === 1 && ATTRIBUTE_IDS.every(attr => deltas[attr] === 0 || deltas[attr] === 1) ? selected[0] : null;
}
/** Nested savepoints are safe inside character creation and startup's transaction. */
export function grantStarterKit(db: Db, characterId: string) {
  return db.transaction(tx => {
    const row = tx.select().from(schema.characters).where(eq(schema.characters.id, characterId)).get();
    if (!row) throw new Error('Ficha indisponível para kit inicial.');
    if (row.starterKitGranted) return row;
    const baseFinalDex = row.baseFinalDex ?? row.finalDex;
    const existing = tx.select().from(schema.inventories).where(eq(schema.inventories.characterId, row.id)).get();
    const stats: Partial<typeof schema.characters.$inferInsert> = {};
    if (!existing) {
      const kit = getStarterKit(row.archetypeId), equipment: Equipment = { ...EMPTY_EQUIPMENT };
      const keys = { MAIN_HAND: 'mainHand', OFF_HAND: 'offHand', ARMOR: 'armor' } as const;
      for (const entry of kit.items) {
        tx.insert(schema.inventories).values({ ...entry, characterId: row.id }).run();
        if (entry.slot !== 'BAG') equipment[keys[entry.slot]] = ITEM_CATALOG[entry.itemId];
      }
      for (const spellId of kit.spells) tx.insert(schema.characterGrimoire).values({ characterId: row.id, spellId }).onConflictDoNothing().run();
      // Weapons/foci have no derived-stat modifiers; preserve tuned legacy values.
      if (equipment.armor || equipment.offHand?.category === 'SHIELD') {
        const { dexMod: _dexMod, ...derived } = recalculateEquipmentStats(baseFinalDex, row.raceId, equipment);
        Object.assign(stats, derived);
      }
    }
    // Gold's column default provides the initial 50G; never overwrite earned/spent money.
    return tx.update(schema.characters).set({ ...stats, baseFinalDex, humanBonusAttribute: recoverHumanBonus(row), starterKitGranted: true })
      .where(eq(schema.characters.id, row.id)).returning().get()!;
  });
}
export function seedObjectEconomy(db: Executor) {
  for (const object of db.select().from(schema.placedObjects).where(eq(schema.placedObjects.isArchived, false)).all()) {
    if (object.kind === 'CHEST') db.insert(schema.chests).values({ objectId: object.id, gold: 10, itemsJson: JSON.stringify([{ itemId: 'HEALTH_POTION', quantity: 1 }]) }).onConflictDoNothing().run();
    if (object.kind === 'NPC_MERCHANT') db.insert(schema.npcShops).values({ objectId: object.id, npcName: object.name, dialogue: 'Bem-vindo! Veja minhas mercadorias.',
      inventoryJson: JSON.stringify([{ itemId: 'DAGGER', stock: 5 }, { itemId: 'HEALTH_POTION', stock: 10 }, { itemId: 'MANA_POTION', stock: 5 }, { itemId: 'WOODEN_SHIELD', stock: 3 }]) }).onConflictDoNothing().run();
  }
}
export function seedEconomy(db: Db) {
  db.transaction(tx => {
    seedEconomyCatalogs(tx);
    for (const row of tx.select({ id: schema.characters.id }).from(schema.characters).where(eq(schema.characters.starterKitGranted, false)).all()) grantStarterKit(db, row.id);
    seedObjectEconomy(tx);
  });
}
