import { afterEach, expect, it, vi } from 'vitest';
import { MONSTER_CATALOG, MonsterSchema, PlayerSchema, RoomState } from '@df/shared';
import { characterPayload } from '../../../packages/shared/tests/characterFixture.js';
import { openDatabase } from '../src/db/index.js';
import { characters, players } from '../src/db/schema.js';
import { prepareHost } from '../src/host.js';
import { grantStarterKit } from '../src/db/seedEconomy.js';
import { prepareCharacter } from '../src/rooms/handlers/auth.js';
import { CombatHandler } from '../src/rooms/handlers/combat.js';
import { loadBoard, readBoard } from '../src/services/boardRepository.js';
import { eq } from 'drizzle-orm';
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import SQLite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/db/schema.js';
import { insertLegacyRow, seedLegacyBoard } from './legacyFixture.js';
const databases: ReturnType<typeof openDatabase>[] = [];
const files: string[] = [];
afterEach(() => {
  databases.splice(0).forEach(db => { if (db.sqlite.open) db.close(); }); vi.restoreAllMocks();
  for (const path of files.splice(0)) for (const suffix of ['', '-wal', '-shm']) if (existsSync(path + suffix)) unlinkSync(path + suffix);
});
function setup(filename = ':memory:') {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  const database = openDatabase(filename); databases.push(database);
  const { room } = prepareHost(database, 'test-password');
  const state = new RoomState(); loadBoard(state, readBoard(database));
  const saved = database.db.insert(players).values({ name: 'Hero', roomId: room.id, sessionToken: 'hero' }).returning().get();
  const character = database.db.insert(characters).values({ ...prepareCharacter({ ...characterPayload(), archetypeId: 'WARRIOR' }), playerId: saved.id, roomId: room.id,
    finalStr: 20, finalDex: 20, finalInt: 10, speed: 10, hp: 100, maxHp: 100 }).returning().get();
  grantStarterKit(database.db, character.id);
  database.db.update(characters).set({ finalDex: 20, speed: 10, defense: 13 }).where(eq(characters.id, character.id)).run();
  const hero = Object.assign(new PlayerSchema(), { id: saved.id, characterId: character.id, hp: 100, maxHp: 100, status: 'READY', connected: true, currentChamberId: 'training-1', q: 3, r: -1 });
  state.players.set(hero.id, hero);
  const master = Object.assign(new PlayerSchema(), { id: room.id, role: 'MASTER', connected: true }); state.players.set(master.id, master);
  let now = 1000;
  const send = vi.fn();
  const combat = new CombatHandler(state, database, room.id, send, () => {}, faces => faces === 100 ? 100 : faces === 20 ? 15 : Math.min(4, faces), () => now);
  return { database, room, state, hero, master, combat, send, wait: () => { now += 1300; } };
}
it.each(MONSTER_CATALOG)('starts an encounter with $name and resolves its catalog attack', definition => {
  const { combat, state, hero, master, wait } = setup();
  state.monsters.clear();
  const monster = Object.assign(new MonsterSchema(), { id: 'catalog-monster', name: definition.name, currentChamberId: 'training-1', q: 3, r: 0 });
  state.monsters.set(monster.id, monster);
  combat.start({ chamberId: 'training-1' });
  expect(combat.snapshot().participants.find(p => p.id === monster.id)).toMatchObject({ hp: definition.hp, mp: definition.mp, attackType: definition.attackType, baseDamage: definition.baseDamage });
  combat.skip(); wait();
  expect(state.combatState.activeParticipantId).toBe(monster.id);
  combat.action(master, { type: 'ATTACK', subType: definition.attackType, targetId: hero.id, turnToken: state.combatState.turnToken }, true);
  expect(hero.hp).toBeLessThan(100);
});
it('alerts the master only, orders initiative, rejects duplicates and forbids extra fleeing', () => {
  const { combat, state, hero, send, wait } = setup();
  combat.proximity(hero);
  expect(send).toHaveBeenCalledWith('PROXIMITY_ALERT', expect.objectContaining({ chamberId: 'training-1' }), 'MASTER');
  combat.start({ chamberId: 'training-1' });
  expect(state.sessionStatus).toBe('IN_COMBAT'); expect(state.combatState.activeParticipantId).toBe(hero.id);
  const action = { type: 'ATTACK', subType: 'SLASHING', targetId: 'training-1:monster', turnToken: state.combatState.turnToken };
  combat.action(hero, action);
  expect(state.combatState.remainingActions).toBe(1);
  for (let i = 0; i < 15; i++) expect(() => combat.action(hero, action)).toThrow();
  wait(); expect(() => combat.action(hero, action)).toThrow('expirado');
  expect(() => combat.action(hero, { type: 'FLEE', turnToken: state.combatState.turnToken })).toThrow('extra');
});
it('excludes absent and unplaced characters when starting an encounter', () => {
  const { combat, hero } = setup();
  hero.connected = false;
  expect(() => combat.start({ chamberId: 'training-1' })).toThrow();
  hero.reconnecting = true; hero.awaitingPosition = true;
  expect(() => combat.start({ chamberId: 'training-1' })).toThrow();
  hero.awaitingPosition = false;
  expect(() => combat.start({ chamberId: 'training-1' })).not.toThrow();
});
it('keeps consumables on departure, hides absent targets and reinserts without replacing the current turn', () => {
  const { combat, database, state, room, hero } = setup();
  const saved = database.db.insert(players).values({ name: 'Ally', roomId: room.id, sessionToken: 'ally' }).returning().get();
  const character = database.db.insert(characters).values({ ...prepareCharacter(characterPayload()), playerId: saved.id, roomId: room.id }).returning().get();
  const ally = Object.assign(new PlayerSchema(), { id: saved.id, characterId: character.id, characterName: 'Ally', hp: character.hp, maxHp: character.maxHp,
    status: 'READY', connected: true, currentChamberId: 'training-1', q: 1, r: 0 });
  state.players.set(ally.id, ally);
  combat.start({ chamberId: 'training-1' });
  combat.action(hero, { type: 'ITEM', itemId: 'HEALTH_POTION', targetId: hero.id, turnToken: state.combatState.turnToken });
  expect(combat.snapshot().participants.find(p => p.id === hero.id)?.consumables.find(i => i.itemId === 'HEALTH_POTION')?.quantity).toBe(1);
  combat.removePlayer(hero.id);
  expect(combat.snapshot().participants.some(p => p.id === hero.id)).toBe(false);
  const token = state.combatState.turnToken, actor = state.combatState.activeParticipantId;
  hero.connected = false;
  expect(() => combat.addPlayer({ targetPlayerId: hero.id })).toThrow();
  hero.connected = true;
  combat.addPlayer({ targetPlayerId: hero.id });
  expect(state.combatState.turnToken).toBe(token); expect(state.combatState.activeParticipantId).toBe(actor);
  expect(combat.snapshot().participants.find(p => p.id === hero.id)?.consumables.find(i => i.itemId === 'HEALTH_POTION')?.quantity).toBe(1);
  expect(state.combatState.turnOrder.at(-1)).toBe(hero.id);
  expect(() => combat.addPlayer({ targetPlayerId: hero.id })).toThrow();
});
it('persists exact actions, HP, token, pause and initiative for restoration', () => {
  const { combat, database, room, hero, state } = setup();
  state.monsters.get('training-1:monster')!.isAutoMode = true;
  state.monsters.get('training-1:monster')!.allowAutoFlee = true;
  combat.start({ chamberId: 'training-1' });
  state.combatState.globalAiEnabled = true;
  combat.action(hero, { type: 'ATTACK', subType: 'SLASHING', targetId: 'training-1:monster', turnToken: state.combatState.turnToken });
  combat.pause({ paused: true }); combat.fleeMode({ mode: 'BLOCKED' });
  const restored = new RoomState(); loadBoard(restored, readBoard(database)); restored.players.set(hero.id, hero);
  const handler = new CombatHandler(restored, database, room.id, () => {}, () => {}); handler.restore();
  expect(restored.combatState.toJSON()).toEqual(state.combatState.toJSON());
  expect(handler.snapshot()).toEqual(combat.snapshot());
});
it('honors pause, blocked and guaranteed flee, and validates initiative permutations', () => {
  const { combat, hero, state } = setup(); combat.start({ chamberId: 'training-1' });
  combat.pause({ paused: true });
  expect(() => combat.action(hero, { type: 'FLEE', turnToken: state.combatState.turnToken })).toThrow('Aguarde');
  combat.pause({ paused: false }); combat.fleeMode({ mode: 'BLOCKED' });
  expect(() => combat.action(hero, { type: 'FLEE', turnToken: state.combatState.turnToken })).toThrow('bloqueada');
  expect(() => combat.reorder({ turnOrder: [hero.id, hero.id] })).toThrow('Fila');
  combat.fleeMode({ mode: 'GUARANTEED_100' });
  combat.action(hero, { type: 'FLEE', turnToken: state.combatState.turnToken });
  expect(state.combatState.active).toBe(false);
});
it('allows the referee to skip to a monster and perform its action', () => {
  const { combat, hero, master, state, wait } = setup(); combat.start({ chamberId: 'training-1' });
  combat.skip(); wait();
  expect(state.combatState.activeParticipantId).toBe('training-1:monster');
  combat.action(master, { type: 'ATTACK', subType: 'SLASHING', targetId: hero.id, turnToken: state.combatState.turnToken }, true);
  expect(hero.hp).toBeLessThan(100);
});
it('uses phase 2 persisted attributes and phase 3 biome to resolve minimum damage', () => {
  const { combat, hero, state, database, send } = setup();
  database.db.update(characters).set({ finalStr: 6, raceId: 'HUMAN' }).where(eq(characters.id, hero.characterId)).run();
  state.chambers.get('training-1')!.biome = 'FOREST';
  combat.start({ chamberId: 'training-1' });
  expect(state.combatState.biome).toBe('FOREST');
  combat.action(hero, { type: 'ATTACK', subType: 'SLASHING', targetId: 'training-1:monster', turnToken: state.combatState.turnToken });
  expect(send).toHaveBeenCalledWith('COMBAT_EVENT', expect.objectContaining({ rawDamage: 2, damage: 1, drAbsorbed: 1 }), 'training-1');
});
it('consumes active dodge on the next incoming attack with zero damage on a winning counter-check', () => {
  const { combat, hero, master, state, wait, send } = setup(); combat.start({ chamberId: 'training-1' });
  combat.action(hero, { type: 'DEFEND', subType: 'ACTIVE_DODGE', turnToken: state.combatState.turnToken });
  wait(); combat.skip(); wait();
  combat.action(master, { type: 'ATTACK', subType: 'SLASHING', targetId: hero.id, turnToken: state.combatState.turnToken }, true);
  expect(hero.hp).toBe(100);
  expect(send).toHaveBeenCalledWith('COMBAT_EVENT', expect.objectContaining({ outcome: 'DODGED_ACTIVE', damage: 0, dodgeRoll: 20 }), 'training-1');
  expect(combat.snapshot().participants.find(p => p.id === hero.id)?.stance).toBe('');
});
it('applies warrior cooldowns and rejects abilities belonging to another archetype', () => {
  const { combat, hero, database, state, wait } = setup();
  database.db.update(characters).set({ archetypeId: 'WARRIOR' }).where(eq(characters.id, hero.characterId)).run();
  combat.start({ chamberId: 'training-1' });
  expect(() => combat.action(hero, { type: 'ATTACK', subType: 'ROGUE', targetId: 'training-1:monster', turnToken: state.combatState.turnToken })).toThrow('arquétipo');
  combat.action(hero, { type: 'ATTACK', subType: 'WARRIOR', targetId: 'training-1:monster', turnToken: state.combatState.turnToken });
  wait(); expect(() => combat.action(hero, { type: 'ATTACK', subType: 'WARRIOR', targetId: 'training-1:monster', turnToken: state.combatState.turnToken })).toThrow('recarga');
});
it('rolls back both SQLite and live state if an action or encounter ending fails to persist', () => {
  const { combat, hero, database, state, send } = setup(); combat.start({ chamberId: 'training-1' });
  const before = structuredClone(combat.snapshot()), beforeState = state.combatState.toJSON(); send.mockClear();
  database.sqlite.exec("CREATE TRIGGER reject_combat_update BEFORE INSERT ON combat_participants BEGIN SELECT RAISE(ABORT, 'injected combat failure'); END");
  const action = { type: 'ITEM', itemId: 'HEALTH_POTION', targetId: hero.id, turnToken: state.combatState.turnToken };
  expect(() => combat.action(hero, action)).toThrow('injected combat failure');
  expect(state.combatState.toJSON()).toEqual(beforeState); expect(combat.snapshot()).toEqual(before);
  expect(database.sqlite.prepare('SELECT remaining_actions, status FROM combat_encounters').get()).toEqual({ remaining_actions: 2, status: 'ACTIVE' });
  expect(() => combat.end()).toThrow('injected combat failure'); expect(state.combatState.active).toBe(true);
  expect(database.sqlite.prepare('SELECT status FROM combat_encounters').get()).toEqual({ status: 'ACTIVE' });
  expect(send).not.toHaveBeenCalled();
  database.sqlite.exec('DROP TRIGGER reject_combat_update');
  combat.action(hero, action); expect(state.combatState.remainingActions).toBe(1);
  const stored = database.db.select().from(characters).where(eq(characters.id, hero.characterId)).get()!;
  expect(stored.mp).toBe(before.participants.find(p => p.id === hero.id)!.mp);
  expect(database.sqlite.prepare("SELECT quantity FROM inventories WHERE character_id = ? AND item_id = 'HEALTH_POTION'").get(hero.characterId)).toEqual({ quantity: 1 });
});
it('reopens a WAL database at the exact paused turn, preserving buffs, queue, actions and old-packet protection', () => {
  mkdirSync('.local', { recursive: true }); const filename = resolve('.local', `fase4-restart-${randomUUID()}.db`); files.push(filename);
  const { combat, hero, database, state, room } = setup(filename); combat.start({ chamberId: 'training-1' });
  const consumedToken = state.combatState.turnToken;
  combat.action(hero, { type: 'DEFEND', subType: 'ACTIVE_DODGE', turnToken: consumedToken });
  combat.fleeMode({ mode: 'BLOCKED' }); combat.pause({ paused: true });
  combat.reorder({ turnOrder: [...state.combatState.turnOrder].reverse() });
  combat.setCutoffs({ criticalFailure: 2, success: 12, criticalSuccess: 19 });
  const expected = state.combatState.toJSON(), roster = structuredClone(combat.snapshot());
  database.close();
  const reopened = openDatabase(filename); databases.push(reopened);
  expect(reopened.sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
  const restored = new RoomState(); loadBoard(restored, readBoard(reopened));
  const restoredHero = Object.assign(new PlayerSchema(), hero.toJSON()); restored.players.set(hero.id, restoredHero);
  const handler = new CombatHandler(restored, reopened, room.id, () => {}, () => {}, () => 100);
  handler.restore();
  expect(restored.combatState.toJSON()).toEqual(expected); expect(handler.snapshot()).toEqual(roster);
  expect(reopened.sqlite.prepare('SELECT kind FROM active_buffs').get()).toEqual({ kind: 'ACTIVE_DODGE' });
  handler.pause({ paused: false });
  expect(() => handler.action(restoredHero, { type: 'DEFEND', subType: 'ACTIVE_DODGE', turnToken: consumedToken })).toThrow('expirado');
  handler.action(restoredHero, { type: 'DEFEND', subType: 'SHIELD_BLOCK', turnToken: restored.combatState.turnToken });
  expect(restored.combatState.activeParticipantId).toBe('training-1:monster');
  handler.end();
  const empty = new RoomState(); new CombatHandler(empty, reopened, room.id, () => {}, () => {}).restore();
  expect(empty.combatState.active).toBe(false);
});
it('upgrades a real v0.3 database without changing characters, maps or credentials and reapplies idempotently', () => {
  mkdirSync('.local', { recursive: true }); const filename = resolve('.local', `fase4-upgrade-${randomUUID()}.db`); files.push(filename);
  const sqlite = new SQLite(filename); sqlite.pragma('journal_mode = WAL'); sqlite.pragma('foreign_keys = ON');
  const journal = JSON.parse(readFileSync(new URL('../src/db/migrations/meta/_journal.json', import.meta.url), 'utf8'));
  sqlite.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)');
  let foundationHash = '';
  for (const migration of journal.entries.slice(0, 3)) {
    const sql = readFileSync(new URL(`../src/db/migrations/${migration.tag}.sql`, import.meta.url), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex'); if (migration.idx === 0) foundationHash = hash;
    sqlite.exec(sql); sqlite.prepare('INSERT INTO __drizzle_migrations(hash,created_at) VALUES (?,?)').run(hash, migration.when);
  }
  const db = drizzle(sqlite, { schema }), legacy = { sqlite, db, close: () => sqlite.close() };
  seedLegacyBoard(sqlite); const { room } = prepareHost(legacy, 'legacy-password');
  db.insert(schema.dungeonsMigrations).values({ version: '0.1.0', appliedAt: 1, checksum: foundationHash }).run();
  const player = db.insert(players).values({ name: 'Legacy', roomId: room.id, sessionToken: 'preserve-this-token', approvalStatus: 'APPROVED' }).returning().get();
  const character = { ...prepareCharacter(characterPayload()), id: randomUUID(), playerId: player.id, roomId: room.id, hp: 73, mp: 17, posQ: 3, posR: -1, createdAt: Date.now() };
  insertLegacyRow(sqlite, characters, character);
  db.update(players).set({ characterId: character.id }).where(eq(players.id, player.id)).run(); sqlite.close();
  const upgraded = openDatabase(filename); databases.push(upgraded);
  expect(upgraded.db.select().from(characters).where(eq(characters.id, character.id)).get()).toMatchObject({ ...character, gold: 50, starterKitGranted: true });
  expect(upgraded.db.select().from(players).where(eq(players.id, player.id)).get()).toMatchObject({ sessionToken: 'preserve-this-token', characterId: character.id });
  expect(upgraded.db.select().from(schema.rooms).get()?.code).toBe(room.code);
  expect(upgraded.db.select().from(schema.chambers).all()).toHaveLength(3);
  expect(upgraded.db.select().from(schema.monstersCatalog).all()).toHaveLength(10);
  upgraded.close(); const second = openDatabase(filename); databases.push(second);
  expect(second.sqlite.prepare('SELECT count(*) AS count FROM __drizzle_migrations').get()).toEqual({ count: 6 });
  expect(second.db.select().from(schema.monstersCatalog).all()).toHaveLength(10);
});

it('numbers identical monsters without losing their catalog identity and never admits the master', () => {
  const { combat, state, hero, master, wait, send } = setup();
  Object.assign(master, { characterId: hero.characterId, status: 'READY', hp: 100, currentChamberId: 'training-1' });
  state.monsters.clear();
  for (const id of ['goblin-a', 'goblin-b']) state.monsters.set(id, Object.assign(new MonsterSchema(), { id, name: 'Goblin', currentChamberId: 'training-1' }));
  hero.characterName = 'Ael'; combat.start({ chamberId: 'training-1' });
  const roster = combat.snapshot().participants;
  expect(roster.map(p => p.name)).toEqual(['Ael', 'Goblin 1', 'Goblin 2']);
  expect(roster.filter(p => p.kind === 'MONSTER').map(p => p.catalogName)).toEqual(['Goblin', 'Goblin']);
  expect(() => combat.action(master, { type: 'ATTACK', subType: 'THRUST', targetId: 'goblin-a', turnToken: state.combatState.turnToken }, true)).toThrow('turno');
  combat.skip(); wait();
  const actorId = state.combatState.activeParticipantId;
  expect(() => combat.action(hero, { type: 'ATTACK', subType: 'THRUST', targetId: hero.id, turnToken: state.combatState.turnToken })).toThrow('turno');
  expect(() => combat.action(master, { type: 'ATTACK', subType: 'FIRE', targetId: hero.id, turnToken: state.combatState.turnToken }, true)).toThrow('criatura');
  combat.action(master, { type: 'ATTACK', subType: 'THRUST', targetId: hero.id, turnToken: state.combatState.turnToken }, true);
  expect(send).toHaveBeenCalledWith('COMBAT_EVENT', expect.objectContaining({ actorId, actorKind: 'MONSTER', actorName: roster.find(p => p.id === actorId)!.name,
    targetName: 'Ael', targetKind: 'PLAYER', targets: [expect.objectContaining({ targetId: hero.id, targetName: 'Ael', damage: expect.any(Number) })] }), 'training-1');
});
it('attributes self defense to the actor even if a different ally was supplied', () => {
  const { combat, hero, state, send } = setup(); combat.start({ chamberId: 'training-1' });
  combat.action(hero, { type: 'DEFEND', subType: 'ACTIVE_DODGE', targetId: 'training-1:monster', turnToken: state.combatState.turnToken });
  expect(send).toHaveBeenCalledWith('COMBAT_EVENT', expect.objectContaining({ targetId: hero.id, targetKind: 'PLAYER', outcome: 'ACTIVE_DODGE' }), 'training-1');
});
it('uses persisted Defense to miss authoritatively, consumes the action and records zero damage', () => {
  const { combat, hero, master, state, database, send, wait } = setup();
  database.db.update(characters).set({ defense: 100 }).where(eq(characters.id, hero.characterId)).run();
  combat.start({ chamberId: 'training-1' }); combat.skip(); wait();
  expect(combat.snapshot().participants.find(p => p.id === hero.id)?.defense).toBe(100);
  combat.action(master, { type: 'ATTACK', subType: 'SLASHING', targetId: hero.id, turnToken: state.combatState.turnToken }, true);
  expect(hero.hp).toBe(100);
  expect(state.combatState.activeParticipantId).toBe(hero.id);
  expect(send).toHaveBeenCalledWith('COMBAT_EVENT', expect.objectContaining({ outcome: 'MISSED_DEFENSE', damage: 0, targets: [expect.objectContaining({ damage: 0 })] }), 'training-1');
});
it('restores old phase-4 participant JSON with Defense and manual defaults', () => {
  const { combat, hero, state, database, room } = setup(); combat.start({ chamberId: 'training-1' });
  database.sqlite.exec("UPDATE combat_participants SET stats_json = json_remove(stats_json, '$.defense', '$.isAutoMode', '$.allowAutoFlee', '$.wis')");
  const restored = new RoomState(); loadBoard(restored, readBoard(database)); restored.players.set(hero.id, hero);
  const handler = new CombatHandler(restored, database, room.id, () => {}, () => {}); handler.restore();
  expect(handler.snapshot().participants).toEqual(combat.snapshot().participants);
  expect(restored.combatState.turnToken).toBe(state.combatState.turnToken);
});
