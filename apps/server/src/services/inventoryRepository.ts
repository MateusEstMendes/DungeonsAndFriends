import { and, eq } from 'drizzle-orm';
import { EMPTY_EQUIPMENT, ITEM_CATALOG, SPELL_CATALOG, recalculateEquipmentStats, type Equipment, type InventorySnapshot, type ItemId, type Item, type Spell, type SpellId } from '@df/shared';
import type { Database } from './boardRepository.js';
import { characters, inventories, itemsCatalog, characterGrimoire, spellsCatalog } from '../db/schema.js';

/** All writes are synchronous and run on the handler's current SQLite transaction. */
export class InventoryRepository {
  constructor(private database: Database) {}
  private get db() { return this.database.db; }
  item(id: ItemId): Item {
    const row = this.db.select().from(itemsCatalog).where(eq(itemsCatalog.id, id)).get();
    if (!row || !ITEM_CATALOG[id]) throw new Error('Item indisponível no catálogo.');
    const definition: Item = ITEM_CATALOG[id];
    // Metadata comes from the server catalog; clients never supply stats or prices.
    const data = { ...definition, name: row.name, basePriceGold: row.basePriceGold };
    if ('handedness' in data) data.handedness = row.handedness as typeof data.handedness;
    if ('damageDice' in data) { data.damageDice = row.damageDice as typeof data.damageDice; data.damageType = row.damageType as typeof data.damageType; }
    if ('defenseBonus' in data) { data.defenseBonus = row.defenseBonus; data.drBonus = row.drBonus; }
    if (data.category === 'ARMOR') { data.dexPenalty = row.dexPenalty; data.dodgeMod = row.dodgeMod; data.maxDexBonus = row.maxDexBonus ?? undefined; }
    if (data.category === 'CONSUMABLE') data.effect = JSON.parse(row.effectJson!);
    return data;
  }
  spell(id: SpellId): Spell {
    const row = this.db.select().from(spellsCatalog).where(eq(spellsCatalog.id, id)).get();
    if (!row) throw new Error('Feitiço indisponível no catálogo.');
    return { ...SPELL_CATALOG[id], name: row.name, description: row.description, mpCost: row.mpCost };
  }
  entries(characterId: string) { return this.db.select().from(inventories).where(eq(inventories.characterId, characterId)).all(); }
  bag(characterId: string, itemId: ItemId) { return this.db.select().from(inventories).where(and(eq(inventories.characterId, characterId), eq(inventories.itemId, itemId), eq(inventories.slot, 'BAG'))).get(); }
  addBag(characterId: string, itemId: ItemId, quantity: number) {
    this.item(itemId);
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Quantidade inválida.');
    const existing = this.bag(characterId, itemId), total = quantity + (existing?.quantity ?? 0);
    if (total > 1_000_000) throw new Error('Limite de itens na mochila.');
    if (existing) this.db.update(inventories).set({ quantity: total }).where(eq(inventories.id, existing.id)).run();
    else this.db.insert(inventories).values({ characterId, itemId, slot: 'BAG', quantity }).run();
  }
  remove(entry: typeof inventories.$inferSelect, quantity: number) {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || entry.quantity < quantity) throw new Error('Quantidade indisponível.');
    if (entry.quantity === quantity) this.db.delete(inventories).where(eq(inventories.id, entry.id)).run();
    else this.db.update(inventories).set({ quantity: entry.quantity - quantity }).where(eq(inventories.id, entry.id)).run();
  }
  equipment(characterId: string): Equipment {
    const equipment: Equipment = { ...EMPTY_EQUIPMENT };
    for (const row of this.entries(characterId)) {
      if (row.slot === 'MAIN_HAND') equipment.mainHand = this.item(row.itemId);
      if (row.slot === 'OFF_HAND') equipment.offHand = this.item(row.itemId);
      if (row.slot === 'ARMOR') equipment.armor = this.item(row.itemId);
    }
    return equipment;
  }
  recalculate(row: typeof characters.$inferSelect) {
    if (row.baseFinalDex === null) throw new Error('Ficha sem atributos base de equipamento.');
    const { dexMod: _dexMod, ...stats } = recalculateEquipmentStats(row.baseFinalDex, row.raceId, this.equipment(row.id));
    // Changing speed cannot refill an already spent movement allowance.
    return this.db.update(characters).set({ ...stats, remainingSteps: row.remainingSteps < 0 ? row.remainingSteps : Math.min(row.remainingSteps, stats.speed) })
      .where(eq(characters.id, row.id)).returning().get()!;
  }
  setGold(row: typeof characters.$inferSelect, value: number) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Saldo de ouro inválido.');
    this.db.update(characters).set({ gold: value }).where(eq(characters.id, row.id)).run();
  }
  snapshot(row: typeof characters.$inferSelect): InventorySnapshot {
    const items = this.entries(row.id).map(entry => ({ inventoryId: entry.id, itemId: entry.itemId, slot: entry.slot, quantity: entry.quantity, item: this.item(entry.itemId) }));
    const { finalStr, finalDex, finalCon, finalInt, finalWis, finalCha, hp, maxHp, mp, maxMp, defense, dodgeChance, speed, flatDr } = row;
    return { playerId: row.playerId, characterId: row.id, name: row.name, raceId: row.raceId, archetypeId: row.archetypeId, gold: row.gold,
      stats: { finalStr, finalDex, finalCon, finalInt, finalWis, finalCha, hp, maxHp, mp, maxMp, defense, dodgeChance, speed, flatDr }, items,
      equipment: { mainHand: items.find(e => e.slot === 'MAIN_HAND') ?? null, offHand: items.find(e => e.slot === 'OFF_HAND') ?? null, armor: items.find(e => e.slot === 'ARMOR') ?? null },
      spells: this.db.select().from(characterGrimoire).where(eq(characterGrimoire.characterId, row.id)).all().map(e => this.spell(e.spellId)) };
  }
}
