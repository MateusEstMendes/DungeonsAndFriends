import { afterEach, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { PlayerSchema, RoomState, getHexEdgeKey, type ArchetypeId, type ItemId } from '@df/shared';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/db/index.js';
import { grantStarterKit, seedObjectEconomy } from '../src/db/seedEconomy.js';
import * as s from '../src/db/schema.js';
import { prepareCharacter } from '../src/rooms/handlers/auth.js';
import { characterPayload } from '../../../packages/shared/tests/characterFixture.js';
import { loadBoard, readBoard } from '../src/services/boardRepository.js';
import { ShopHandler } from '../src/rooms/handlers/shop.js';
const databases: ReturnType<typeof openDatabase>[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
function setup() {
  const database = openDatabase(':memory:'); databases.push(database); const db = database.db;
  const room = db.insert(s.rooms).values({ id: randomUUID(), code: 'AB2CD', masterPasswordHash: 'hash' }).returning().get();
  const state = new RoomState(); state.activeStageId = 'training';
  const master = Object.assign(new PlayerSchema(), { id: room.id, name: 'Mestre', role: 'MASTER', connected: true, status: 'APPROVED' }); state.players.set(master.id, master);
  function player(name: string, archetypeId: ArchetypeId = 'WARRIOR') {
    const owner = db.insert(s.players).values({ roomId: room.id, name, sessionToken: randomUUID(), approvalStatus: 'APPROVED' }).returning().get();
    const row = db.insert(s.characters).values({ ...prepareCharacter({ ...characterPayload(), archetypeId }), playerId: owner.id, roomId: room.id, remainingSteps: 1 }).returning().get();
    db.update(s.players).set({ characterId: row.id }).where(eq(s.players.id, owner.id)).run();
    const character = grantStarterKit(db, row.id);
    const p = Object.assign(new PlayerSchema(), { id: owner.id, characterId: character.id, name, characterName: name, status: 'READY', connected: true, currentChamberId: 'training-1',
      q: 0, r: 0, hp: character.hp, mp: character.mp, speed: character.speed, remainingSteps: 1, defense: character.defense });
    state.players.set(p.id, p); return p;
  }
  db.insert(s.placedObjects).values([{ id: 'shop', chamberId: 'training-1', kind: 'NPC_MERCHANT', name: 'Mercador', q: 1, r: 0 },
    { id: 'chest', chamberId: 'training-1', kind: 'CHEST', name: 'Baú', q: 0, r: 1 }]).run();
  seedObjectEconomy(db); loadBoard(state, readBoard(database));
  const hero = player('Ael'), send = vi.fn(), refresh = vi.fn(), shop = new ShopHandler(state, database, room.id, send, refresh);
  function row(p = hero) { return db.select().from(s.characters).where(eq(s.characters.id, p.characterId)).get()!; }
  function item(itemId: ItemId, slot = 'BAG', p = hero) { return db.select().from(s.inventories).where(and(eq(s.inventories.characterId, p.characterId), eq(s.inventories.itemId, itemId))).all().find(i => i.slot === slot)!; }
  function give(itemId: ItemId, quantity = 1, p = hero) { shop.grantItem(master, { targetPlayerId: p.id, kind: 'ITEM', itemId, quantity }); send.mockClear(); }
  return { database, db, state, room, master, hero, player, shop, send, refresh, row, item, give };
}
it('buys at server price, blocks equipped sales and credits exactly 50 percent after unequipping', () => {
  const { shop, hero, row, item, send } = setup();
  shop.buyItem(hero, { shopId: 'shop', itemId: 'DAGGER', quantity: 1 }); expect(row().gold).toBe(10);
  shop.equipItem(hero, { inventoryId: item('DAGGER').id, slot: 'MAIN_HAND' });
  expect(() => shop.sellItem(hero, { shopId: 'shop', inventoryId: item('DAGGER', 'MAIN_HAND').id, quantity: 1 })).toThrow('Desequipe'); expect(row().gold).toBe(10);
  shop.unequipItem(hero, { slot: 'MAIN_HAND' }); shop.sellItem(hero, { shopId: 'shop', inventoryId: item('DAGGER').id, quantity: 1 });
  expect(row().gold).toBe(30); expect(item('DAGGER')).toBeUndefined();
  expect(send).toHaveBeenCalledWith(hero.id, 'INVENTORY_SYNC', expect.objectContaining({ gold: 30 }), true);
});
it('swaps both hands atomically for 2H equipment and recalculates armor without refilling movement', () => {
  const { shop, hero, give, item, row } = setup();
  give('BATTLE_AXE'); shop.equipItem(hero, { inventoryId: item('BATTLE_AXE').id, slot: 'MAIN_HAND' });
  expect(item('WOODEN_SHIELD', 'OFF_HAND')).toBeUndefined(); expect(item('WOODEN_SHIELD').quantity).toBe(1); expect(item('SHORT_SWORD').quantity).toBe(1);
  expect(row().defense).toBe(15);
  shop.equipItem(hero, { inventoryId: item('WOODEN_SHIELD').id, slot: 'OFF_HAND' }); expect(item('BATTLE_AXE', 'MAIN_HAND')).toBeUndefined();
  give('PLATE_ARMOR'); shop.equipItem(hero, { inventoryId: item('PLATE_ARMOR').id, slot: 'ARMOR' });
  expect(row()).toMatchObject({ finalDex: 15, defense: 21, dodgeChance: 4, flatDr: 2, speed: 3 });
  expect(hero).toMatchObject({ finalDex: 15, defense: 21, dodgeChance: 4, flatDr: 2, remainingSteps: 1 });
  shop.unequipItem(hero, { slot: 'ARMOR' }); shop.equipItem(hero, { inventoryId: item('PLATE_ARMOR').id, slot: 'ARMOR' });
  expect(row().finalDex).toBe(15); expect(item('STUDDED_LEATHER').quantity).toBe(1);
});
it('preserves identical offhand copies and learns scrolls once, rejecting ordinary items', () => {
  const { shop, hero, give, item, db } = setup(); give('DAGGER', 2);
  shop.equipItem(hero, { inventoryId: item('DAGGER').id, slot: 'MAIN_HAND' }); shop.equipItem(hero, { inventoryId: item('DAGGER').id, slot: 'OFF_HAND' });
  expect(item('DAGGER')).toBeUndefined(); expect(item('DAGGER', 'MAIN_HAND').quantity).toBe(1); expect(item('DAGGER', 'OFF_HAND').quantity).toBe(1);
  give('SPELL_SCROLL_IGNEOUS_BLAST', 2); const scrollId = item('SPELL_SCROLL_IGNEOUS_BLAST').id;
  shop.useScroll(hero, { inventoryId: scrollId }); expect(item('SPELL_SCROLL_IGNEOUS_BLAST').quantity).toBe(1);
  expect(db.select().from(s.characterGrimoire).all()).toHaveLength(1);
  expect(() => shop.useScroll(hero, { inventoryId: scrollId })).toThrow('já aprendido');
  expect(item('SPELL_SCROLL_IGNEOUS_BLAST').quantity).toBe(1);
  expect(() => shop.useScroll(hero, { inventoryId: item('HEALTH_POTION').id })).toThrow('pergaminho');
});
it('validates funds, stock, catalog price, ownership and strict payloads on every request', () => {
  const { shop, hero, player, give, item, row, db } = setup(), other = player('Other');
  expect(() => shop.buyItem(hero, { shopId: 'shop', itemId: 'DAGGER', quantity: 2 })).toThrow('Ouro');
  expect(() => shop.buyItem(hero, { shopId: 'shop', itemId: 'DAGGER', quantity: 1, price: 0 })).toThrow();
  give('DAGGER'); expect(() => shop.equipItem(other, { inventoryId: item('DAGGER').id, slot: 'MAIN_HAND' })).toThrow('pertence');
  expect(() => shop.sellItem(other, { shopId: 'shop', inventoryId: item('DAGGER').id, quantity: 1 })).toThrow('pertence');
  db.update(s.itemsCatalog).set({ basePriceGold: 41 }).where(eq(s.itemsCatalog.id, 'DAGGER')).run();
  shop.buyItem(hero, { shopId: 'shop', itemId: 'DAGGER', quantity: 1 }); expect(row().gold).toBe(9);
  shop.sellItem(hero, { shopId: 'shop', inventoryId: item('DAGGER').id, quantity: 2 }); expect(row().gold).toBe(49);
  expect(() => shop.sellItem(hero, { shopId: 'shop', inventoryId: 'missing', quantity: -1 })).toThrow();
});
it('rechecks adjacency, walls, visibility, chamber, archival, readiness and combat on interaction', () => {
  const { shop, hero, state, db } = setup();
  const open = () => shop.openChest(hero, { chestId: 'chest' }); open();
  hero.q = 4; expect(open).toThrow('Aproxime'); hero.q = 0;
  hero.currentChamberId = 'training-2'; expect(open).toThrow('Aproxime'); hero.currentChamberId = 'training-1';
  const chamber = state.chambers.get('training-1')!, edge = getHexEdgeKey(hero, { q: 0, r: 1 });
  chamber.walls.set(edge, true); expect(open).toThrow('Aproxime'); chamber.walls.delete(edge);
  db.update(s.placedObjects).set({ hidden: true }).where(eq(s.placedObjects.id, 'chest')).run(); expect(open).toThrow('Aproxime');
  db.update(s.placedObjects).set({ hidden: false, isArchived: true }).where(eq(s.placedObjects.id, 'chest')).run(); expect(open).toThrow('indisponível');
  db.update(s.placedObjects).set({ isArchived: false }).where(eq(s.placedObjects.id, 'chest')).run();
  hero.awaitingPosition = true; expect(open).toThrow('indisponível'); hero.awaitingPosition = false;
  hero.status = 'PENDING_APPROVAL'; expect(open).toThrow(); hero.status = 'READY';
  state.combatState.active = true; expect(open).toThrow('combate'); expect(() => shop.unequipItem(hero, { slot: 'ARMOR' })).toThrow('combate');
});
it('rolls back stock, money and inventory on a failed purchase, and rejects overflow', () => {
  const { shop, hero, row, db, database, send } = setup(); const before = db.select().from(s.npcShops).get();
  database.sqlite.exec("CREATE TRIGGER reject_bag BEFORE INSERT ON inventories WHEN NEW.item_id = 'DAGGER' BEGIN SELECT RAISE(ABORT,'purchase failure'); END");
  expect(() => shop.buyItem(hero, { shopId: 'shop', itemId: 'DAGGER', quantity: 1 })).toThrow('purchase failure');
  expect(row().gold).toBe(50); expect(db.select().from(s.npcShops).get()).toEqual(before); expect(send).not.toHaveBeenCalled();
  database.sqlite.exec('DROP TRIGGER reject_bag');
  db.update(s.characters).set({ gold: Number.MAX_SAFE_INTEGER }).where(eq(s.characters.id, hero.characterId)).run();
  expect(() => shop.lootChestItem(hero, { chestId: 'chest', kind: 'GOLD' })).toThrow('Saldo');
  expect(db.select().from(s.chests).where(eq(s.chests.objectId, 'chest')).get()?.gold).toBe(10);
});
it('moves chest loot and gold exactly once, updating only still-adjacent observers', async () => {
  const { shop, hero, player, db, item, row, send } = setup(), other = player('Other'); other.q = 1; other.r = 1;
  shop.openChest(hero, { chestId: 'chest' }); shop.openChest(other, { chestId: 'chest' }); send.mockClear();
  const results = await Promise.allSettled([hero, other].map(p => Promise.resolve().then(() => shop.lootChestItem(p, { chestId: 'chest', kind: 'ITEM', itemId: 'HEALTH_POTION', quantity: 1 }))));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(item('HEALTH_POTION').quantity + item('HEALTH_POTION', 'BAG', other).quantity).toBe(5);
  expect(db.select().from(s.chests).where(eq(s.chests.objectId, 'chest')).get()?.itemsJson).toBe('[]');
  expect(send).toHaveBeenCalledWith(other.id, 'CHEST_SYNC', expect.objectContaining({ items: [] }));
  other.q = 5; send.mockClear(); shop.lootChestItem(hero, { chestId: 'chest', kind: 'GOLD' }); expect(row().gold).toBe(60);
  expect(send.mock.calls.filter(c => c[0] === other.id && c[1] === 'CHEST_SYNC')).toEqual([]);
  expect(() => shop.lootChestItem(hero, { chestId: 'chest', kind: 'GOLD' })).toThrow('sem ouro');
});
it('restricts master tools, supports infinite stock and grants to offline approved characters', () => {
  const { shop, hero, master, db, row, item, send } = setup();
  expect(() => shop.editShop(hero, { shopId: 'shop', npcName: 'Free', dialogue: '', inventory: [] })).toThrow('Mestre');
  shop.editShop(master, { shopId: 'shop', npcName: 'Novo', dialogue: 'Boas compras', inventory: [{ itemId: 'DAGGER', stock: null }] });
  shop.buyItem(hero, { shopId: 'shop', itemId: 'DAGGER', quantity: 1 });
  expect(JSON.parse(db.select().from(s.npcShops).get()!.inventoryJson)).toEqual([{ itemId: 'DAGGER', stock: null }]);
  shop.editChest(master, { chestId: 'chest', gold: 5, items: [{ itemId: 'BATTLE_AXE', quantity: 1 }] });
  hero.connected = false; shop.grantItem(master, { targetPlayerId: hero.id, kind: 'GOLD', gold: 10 });
  shop.grantItem(master, { targetPlayerId: hero.id, kind: 'ITEM', itemId: 'MANA_POTION', quantity: 2 });
  expect(row().gold).toBe(20); expect(item('MANA_POTION').quantity).toBe(2);
  expect(send).toHaveBeenCalledWith(hero.id, 'INVENTORY_SYNC', expect.objectContaining({ gold: 20 }), true);
});
it('rolls back an equipment swap or scroll on persistence failure, leaving live stats untouched', () => {
  const { shop, hero, give, item, row, database, db, send } = setup(); give('BATTLE_AXE');
  const inventory = db.select().from(s.inventories).all(), before = row(), live = hero.toJSON();
  database.sqlite.exec("CREATE TRIGGER reject_stats BEFORE UPDATE ON characters BEGIN SELECT RAISE(ABORT,'stats failure'); END");
  expect(() => shop.equipItem(hero, { inventoryId: item('BATTLE_AXE').id, slot: 'MAIN_HAND' })).toThrow('stats failure');
  expect(db.select().from(s.inventories).all()).toEqual(inventory); expect(row()).toEqual(before); expect(hero.toJSON()).toEqual(live); expect(send).not.toHaveBeenCalled();
  database.sqlite.exec('DROP TRIGGER reject_stats'); give('SPELL_SCROLL_IGNEOUS_BLAST');
  database.sqlite.exec("CREATE TRIGGER reject_spell BEFORE INSERT ON character_grimoire BEGIN SELECT RAISE(ABORT,'spell failure'); END");
  expect(() => shop.useScroll(hero, { inventoryId: item('SPELL_SCROLL_IGNEOUS_BLAST').id })).toThrow('spell failure');
  expect(item('SPELL_SCROLL_IGNEOUS_BLAST').quantity).toBe(1);
});
