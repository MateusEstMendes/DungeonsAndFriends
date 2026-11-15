import { afterEach, expect, it } from 'vitest';
import SQLite from 'better-sqlite3';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eq } from 'drizzle-orm';
import { ATTRIBUTE_IDS, ARCHETYPE_IDS, ITEM_CATALOG, SPELL_CATALOG, getStarterKit, RoomState, recalculateEquipmentStats, EMPTY_EQUIPMENT } from '@df/shared';
import { openDatabase } from '../src/db/index.js';
import * as s from '../src/db/schema.js';
import { grantStarterKit, seedEconomy, seedEconomyCatalogs } from '../src/db/seedEconomy.js';
import { prepareCharacter } from '../src/rooms/handlers/auth.js';
import { characterPayload } from '../../../packages/shared/tests/characterFixture.js';
import { loadBoard, readBoard } from '../src/services/boardRepository.js';
import { MasterHandler } from '../src/rooms/handlers/master.js';
import { MovementHandler } from '../src/rooms/handlers/movement.js';
import { insertLegacyRow, seedLegacyBoard } from './legacyFixture.js';
const databases: ReturnType<typeof openDatabase>[] = [], folders: string[] = [];
afterEach(() => { for (const db of databases.splice(0)) if (db.sqlite.open) db.close(); for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });
function open(filename = ':memory:') { const db = openDatabase(filename); databases.push(db); return db; }
function room(db: ReturnType<typeof openDatabase>) {
  return db.db.insert(s.rooms).values({ id: randomUUID(), code: 'AB2CD', masterPasswordHash: 'keep-hash' }).returning().get();
}
function addCharacter(db: ReturnType<typeof openDatabase>, roomId: string, archetypeId = characterPayload().archetypeId) {
  const player = db.db.insert(s.players).values({ roomId, name: 'Hero', sessionToken: randomUUID() }).returning().get();
  return db.db.insert(s.characters).values({ ...prepareCharacter({ ...characterPayload(), archetypeId }), playerId: player.id, roomId }).returning().get();
}
it('seeds the full SQL catalogs and repairs missing entries while preserving tuned prices', () => {
  const db = open();
  expect(db.db.select().from(s.itemsCatalog).all()).toHaveLength(Object.keys(ITEM_CATALOG).length);
  expect(db.db.select().from(s.spellsCatalog).all()).toHaveLength(Object.keys(SPELL_CATALOG).length);
  expect(db.db.select().from(s.itemsCatalog).where(eq(s.itemsCatalog.id, 'PLATE_ARMOR')).get()).toMatchObject({ dexPenalty: 2, drBonus: 2, armorType: 'HEAVY' });
  expect(JSON.parse(db.db.select().from(s.itemsCatalog).where(eq(s.itemsCatalog.id, 'THE_JUICE')).get()!.effectJson!)).toEqual({ type: 'PHYSICAL_DAMAGE', multiplier: 1.2, rounds: 2 });
  db.db.update(s.itemsCatalog).set({ basePriceGold: 99 }).where(eq(s.itemsCatalog.id, 'DAGGER')).run();
  db.db.delete(s.spellsCatalog).where(eq(s.spellsCatalog.id, 'IGNEOUS_BLAST')).run();
  seedEconomy(db.db); seedEconomy(db.db);
  expect(db.db.select().from(s.itemsCatalog).where(eq(s.itemsCatalog.id, 'DAGGER')).get()?.basePriceGold).toBe(99);
  expect(db.db.select().from(s.spellsCatalog).all()).toHaveLength(4);
});
it.each(ARCHETYPE_IDS)('grants %s kit exactly once, including distinct offhand copies and spells', archetype => {
  const db = open(), r = room(db), original = addCharacter(db, r.id, archetype);
  const row = grantStarterKit(db.db, original.id), kit = getStarterKit(archetype);
  expect(row).toMatchObject({ gold: 50, starterKitGranted: true, hp: original.hp, mp: original.mp, baseFinalDex: original.finalDex });
  const before = db.db.select().from(s.inventories).all();
  expect(before.map(({ itemId, slot, quantity }) => ({ itemId, slot, quantity }))).toEqual(kit.items);
  expect(db.db.select().from(s.characterGrimoire).all().map(r => r.spellId)).toEqual(kit.spells);
  expect(grantStarterKit(db.db, row.id)).toEqual(row); seedEconomy(db.db);
  expect(db.db.select().from(s.inventories).all()).toEqual(before);
  // Selling/using every item never reissues a kit, nor resets earned gold.
  db.db.delete(s.inventories).run(); db.db.update(s.characters).set({ gold: 7 }).where(eq(s.characters.id, row.id)).run();
  seedEconomy(db.db); expect(db.db.select().from(s.inventories).all()).toEqual([]);
  expect(db.db.select().from(s.characters).get()?.gold).toBe(7);
});
it('rolls back items, grimoire and marker together when a kit fails', () => {
  const db = open(), r = room(db), character = addCharacter(db, r.id);
  db.sqlite.exec("CREATE TRIGGER reject_spell BEFORE INSERT ON character_grimoire BEGIN SELECT RAISE(ABORT, 'kit failure'); END");
  expect(() => grantStarterKit(db.db, character.id)).toThrow('kit failure');
  expect(db.db.select().from(s.inventories).all()).toEqual([]);
  expect(db.db.select().from(s.characters).get()).toEqual(character);
  db.sqlite.exec('DROP TRIGGER reject_spell');
  expect(grantStarterKit(db.db, character.id).starterKitGranted).toBe(true);
});
it('enforces ownership references, integer quantities/gold and one item per equipped slot', () => {
  const db = open(), r = room(db), character = addCharacter(db, r.id);
  const row = { characterId: character.id, itemId: 'DAGGER' as const, slot: 'MAIN_HAND' as const, quantity: 1 };
  db.db.insert(s.inventories).values(row).run();
  expect(() => db.db.insert(s.inventories).values(row).run()).toThrow();
  expect(() => db.db.insert(s.inventories).values({ ...row, characterId: 'missing' }).run()).toThrow();
  for (const quantity of [0, -1, 1.5, 2]) expect(() => db.db.insert(s.inventories).values({ ...row, slot: 'OFF_HAND', quantity }).run()).toThrow();
  db.db.insert(s.inventories).values({ ...row, slot: 'OFF_HAND' }).run();
  db.db.insert(s.inventories).values({ ...row, slot: 'BAG', quantity: 2 }).run();
  expect(() => db.db.insert(s.inventories).values({ ...row, slot: 'BAG' }).run()).toThrow();
  for (const gold of [-1, .5]) expect(() => db.db.update(s.characters).set({ gold }).run()).toThrow();
  db.db.insert(s.characterGrimoire).values({ characterId: character.id, spellId: 'ARCANE_DART' }).run();
  expect(() => db.db.insert(s.characterGrimoire).values({ characterId: character.id, spellId: 'ARCANE_DART' }).run()).toThrow();
  expect(db.sqlite.pragma('foreign_key_check')).toEqual([]);
});
it('keeps depleted loot and edited shops through board edits, removal, Undo/Redo and restart', () => {
  const folder = mkdtempSync(join(tmpdir(), 'df-economy-board-')); folders.push(folder);
  const path = join(folder, 'test.db'), db = open(path), r = room(db), state = new RoomState(); loadBoard(state, readBoard(db));
  const master = new MasterHandler(state, db, r.id, new MovementHandler(state, db, () => {}), () => {});
  master.edit({ layer: 'OBJECT', chamberId: 'training-1', q: 0, r: 0, kind: 'NPC_MERCHANT', rotation: 0, hidden: false });
  const shopId = [...state.objects.values()].find(o => o.kind === 'NPC_MERCHANT')!.id;
  expect(db.db.select().from(s.npcShops).get()?.objectId).toBe(shopId);
  db.db.update(s.npcShops).set({ dialogue: 'Custom', inventoryJson: '[]' }).where(eq(s.npcShops.objectId, shopId)).run();
  db.db.update(s.chests).set({ gold: 0, itemsJson: '[]' }).where(eq(s.chests.objectId, 'training-1:chest')).run();
  master.edit({ layer: 'TERRAIN', chamberId: 'training-1', q: 1, r: 0, terrain: 'GRASS' });
  master.history(false); master.history(true);
  master.remove({ entityId: 'training-1:chest' }); expect(state.objects.has('training-1:chest')).toBe(false);
  master.history(false); expect(state.objects.has('training-1:chest')).toBe(true);
  expect(db.db.select().from(s.chests).where(eq(s.chests.objectId, 'training-1:chest')).get()).toMatchObject({ gold: 0, itemsJson: '[]' });
  master.remove({ entityId: shopId }); master.history(false); master.history(true);
  expect(state.objects.has(shopId)).toBe(false); db.close();
  const reopened = open(path); const restored = new RoomState(); loadBoard(restored, readBoard(reopened));
  expect(restored.objects.has(shopId)).toBe(false);
  expect(reopened.db.select().from(s.npcShops).get()).toMatchObject({ objectId: shopId, dialogue: 'Custom', inventoryJson: '[]' });
  const handler = new MasterHandler(restored, reopened, r.id, new MovementHandler(restored, reopened, () => {}), () => {});
  handler.history(false); expect(restored.objects.has(shopId)).toBe(true);
  expect(reopened.db.select().from(s.npcShops).get()?.inventoryJson).toBe('[]');
  expect(reopened.sqlite.pragma('foreign_key_check')).toEqual([]);
});
it('migrates a populated v0.4 WAL database preserving identity, vitals, human bonuses and combat resources', () => {
  const folder = mkdtempSync(join(tmpdir(), 'df-economy-legacy-')); folders.push(folder);
  const path = join(folder, 'test.db'), legacy = new SQLite(path); legacy.pragma('journal_mode = WAL'); legacy.pragma('foreign_keys = ON');
  const journal = JSON.parse(readFileSync(new URL('../src/db/migrations/meta/_journal.json', import.meta.url), 'utf8'));
  legacy.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)');
  for (const migration of journal.entries.slice(0, 4)) {
    const sql = readFileSync(new URL(`../src/db/migrations/${migration.tag}.sql`, import.meta.url), 'utf8'); legacy.exec(sql);
    legacy.prepare('INSERT INTO __drizzle_migrations(hash,created_at) VALUES (?,?)').run(createHash('sha256').update(sql).digest('hex'), migration.when);
  }
  seedLegacyBoard(legacy);
  insertLegacyRow(legacy, s.rooms, { id: 'room', code: 'AB2CD', masterPasswordHash: 'keep-hash', createdAt: 1 });
  const ids: string[] = [];
  for (const humanBonusAttribute of ATTRIBUTE_IDS) {
    const id = `char-${humanBonusAttribute}`; ids.push(id);
    insertLegacyRow(legacy, s.players, { id: `player-${id}`, roomId: 'room', name: id, sessionToken: `token-${id}`, reconnectionToken: `reconnect-${id}`, approvalStatus: 'APPROVED', lastSeenAt: 42 });
    const payload = { ...characterPayload(), raceId: 'HUMAN' as const, archetypeId: 'ROGUE' as const, humanBonusAttribute };
    insertLegacyRow(legacy, s.characters, { ...prepareCharacter(payload), id, playerId: `player-${id}`, roomId: 'room', hp: 73, mp: 17, posQ: 3, posR: -1, createdAt: 1 });
    legacy.prepare('UPDATE players SET character_id = ? WHERE id = ?').run(id, `player-${id}`);
  }
  legacy.prepare("INSERT INTO combat_encounters VALUES ('encounter','room','training-1','ACTIVE','CAVE',2,'[\"monster\"]','monster',1,0,'BLOCKED',1,'keep-turn','{}',42)").run();
  legacy.prepare('INSERT INTO combat_participants VALUES (?,?,?,?,?,?)').run('monster','encounter','MONSTER',JSON.stringify({ name: 'Goblin', cooldowns: { test: 5 } }),12,3);
  const boardBefore = legacy.prepare('SELECT * FROM placed_objects ORDER BY id').all(); legacy.close();
  const db = open(path);
  for (const attr of ATTRIBUTE_IDS) {
    const id = `char-${attr}`, row = db.db.select().from(s.characters).where(eq(s.characters.id, id)).get()!;
    expect(row).toMatchObject({ gold: 50, hp: 73, mp: 17, posQ: 3, posR: -1, humanBonusAttribute: attr, starterKitGranted: true });
    const unarmored = prepareCharacter({ ...characterPayload(), raceId: 'HUMAN', humanBonusAttribute: attr });
    expect(row.baseFinalDex).toBe(unarmored.finalDex);
    expect(row.defense).toBe(recalculateEquipmentStats(unarmored.finalDex, 'HUMAN', { ...EMPTY_EQUIPMENT, mainHand: ITEM_CATALOG.DAGGER, offHand: ITEM_CATALOG.DAGGER, armor: ITEM_CATALOG.STUDDED_LEATHER }).defense);
    expect(db.db.select().from(s.inventories).where(eq(s.inventories.characterId, id)).all()).toHaveLength(4);
  }
  expect(db.db.select().from(s.players).get()).toMatchObject({ sessionToken: 'token-char-str', reconnectionToken: 'reconnect-char-str', lastSeenAt: 42 });
  expect(db.sqlite.prepare('SELECT id,chamber_id,kind,name,q,r,rotation,hidden FROM placed_objects ORDER BY id').all()).toEqual(boardBefore);
  expect(db.db.select().from(s.combatEncounters).get()).toMatchObject({ round: 2, remainingActions: 1, turnToken: 'keep-turn', isPaused: true, globalAiEnabled: false });
  const participant = db.db.select().from(s.combatParticipants).get()!;
  expect(participant).toMatchObject({ hp: 12, mp: 3 });
  expect(JSON.parse(participant.statsJson)).toEqual({ name: 'Goblin', cooldowns: { test: 5 }, isAutoMode: false, allowAutoFlee: false });
  const inventory = db.db.select().from(s.inventories).all(); db.close();
  const again = open(path); expect(again.db.select().from(s.inventories).all()).toEqual(inventory);
  expect(again.sqlite.prepare('SELECT count(*) count FROM __drizzle_migrations').get()).toEqual({ count: 5 });
  expect(again.sqlite.pragma('foreign_key_check')).toEqual([]);
});
it('keeps tuned stats when the starter equipment has no armor/shield modifiers', () => {
  const db = open(), r = room(db), original = addCharacter(db, r.id, 'MAGE');
  db.db.update(s.characters).set({ finalDex: 20, speed: 10, defense: 99 }).where(eq(s.characters.id, original.id)).run();
  expect(grantStarterKit(db.db, original.id)).toMatchObject({ finalDex: 20, speed: 10, defense: 99, starterKitGranted: true });
});
it('populates both catalogs from the SQL migration even without the runtime seed', () => {
  const sqlite = new SQLite(':memory:'); sqlite.pragma('foreign_keys = ON');
  try {
    const journal = JSON.parse(readFileSync(new URL('../src/db/migrations/meta/_journal.json', import.meta.url), 'utf8'));
    for (const entry of journal.entries) sqlite.exec(readFileSync(new URL(`../src/db/migrations/${entry.tag}.sql`, import.meta.url), 'utf8'));
    expect(sqlite.prepare('SELECT count(*) count FROM items_catalog').get()).toEqual({ count: 28 });
    expect(sqlite.prepare('SELECT count(*) count FROM spells_catalog').get()).toEqual({ count: 4 });
    expect(sqlite.prepare("SELECT damage_dice,base_price_gold FROM items_catalog WHERE id='DAGGER'").get()).toEqual({ damage_dice: '1d4', base_price_gold: 40 });
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  } finally { sqlite.close(); }
});
