import SQLite from 'better-sqlite3';
import { afterEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { openDatabase } from '../src/db/index.js';
import { sanitizeDatabase } from '../src/db/sanitize.js';
import { prepareCharacter } from '../src/rooms/handlers/auth.js';
import { characterPayload } from '../../../packages/shared/tests/characterFixture.js';
import { insertLegacyRow } from './legacyFixture.js';
import * as s from '../src/db/schema.js';
const connections: ReturnType<typeof openDatabase>[] = [], folders: string[] = [];
const folder = () => { const path = mkdtempSync(join(tmpdir(), 'df-finalize-')); folders.push(path); return path; };
function open(filename = ':memory:', options: Parameters<typeof openDatabase>[1] = {}) { const db = openDatabase(filename, options); connections.push(db); return db; }
afterEach(() => { for (const db of connections.splice(0)) if (db.sqlite.open) db.close(); for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true }); vi.unstubAllEnvs(); });
function room(db: ReturnType<typeof openDatabase>, id = 'r') { db.db.insert(s.rooms).values({ id, code: id === 'r' ? 'AB2CD' : 'BC3DE', masterPasswordHash: 'hash' }).run(); }
function session(db: ReturnType<typeof openDatabase>, id: string, status: 'ACTIVE' | 'CLOSED', updatedAt: number) { db.db.insert(s.sessions).values({ id, roomId: 'r', status, updatedAt }).run(); }
function checkpoint(db: ReturnType<typeof openDatabase>, sessionId: string, updatedAt: number) { db.db.insert(s.crashRecoveryCheckpoints).values({ id: sessionId, roomId: 'r', sessionId, updatedAt, lastEventType: 'COMBAT_ACTION', serializedRoomState: '{"gold":137}', combatSnapshotJson: '{"turnToken":"consumed","globalAiEnabled":true}' }).run(); }
it('upgrades 0000 -> 0005 with data from every phase and keeps economy, history and encounter tokens', () => {
  const path = join(folder(), 'upgrade.db'), legacy = new SQLite(path);
  legacy.pragma('foreign_keys = ON'); legacy.pragma('journal_mode = WAL');
  legacy.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)');
  const journal = JSON.parse(readFileSync(new URL('../src/db/migrations/meta/_journal.json', import.meta.url), 'utf8'));
  try {
    for (const entry of journal.entries) {
      const sql = readFileSync(new URL(`../src/db/migrations/${entry.tag}.sql`, import.meta.url), 'utf8');
      legacy.transaction(() => {
        legacy.exec(sql);
        legacy.prepare('INSERT INTO __drizzle_migrations(hash,created_at) VALUES (?,?)').run(createHash('sha256').update(sql).digest('hex'), entry.when);
      })();
      if (entry.idx === 0) {
        insertLegacyRow(legacy, s.rooms, { id: 'r', code: 'AB2CD', masterPasswordHash: 'hash', status: 'ACTIVE', createdAt: 1 });
        insertLegacyRow(legacy, s.players, { id: 'p', roomId: 'r', name: 'Hero', sessionToken: 'jwt', approvalStatus: 'APPROVED', lastSeenAt: 1 });
        insertLegacyRow(legacy, s.sessions, { id: 'session', roomId: 'r', status: 'ACTIVE', updatedAt: 1 });
      }
      if (entry.idx === 1) {
        insertLegacyRow(legacy, s.characters, { ...prepareCharacter(characterPayload()), id: 'hero', roomId: 'r', playerId: 'p', createdAt: 1 });
        legacy.exec("UPDATE players SET character_id='hero'");
      }
      if (entry.idx === 2) {
        insertLegacyRow(legacy, s.maps, { id: 'map', name: 'Map' });
        insertLegacyRow(legacy, s.chambers, { id: 'c', mapId: 'map', name: 'C', biome: 'FOREST', minQ: 0, maxQ: 0, minR: 0, maxR: 0 });
        insertLegacyRow(legacy, s.terrainCells, { id: 'cell', chamberId: 'c', q: 0, r: 0, terrain: 'STONE' });
        insertLegacyRow(legacy, s.editorHistory, { roomId: 'r', beforeJson: '{}', afterJson: '{}', undone: true });
      }
      if (entry.idx === 3) insertLegacyRow(legacy, s.combatEncounters, { id: 'fight', roomId: 'r', chamberId: 'c', status: 'ACTIVE', biome: 'FOREST', round: 2, turnOrderJson: '["p"]', activeParticipantId: 'p', remainingActions: 1, actionIndex: 1, fleeMode: 'NORMAL', isPaused: false, turnToken: 'used-token', cutoffsJson: '{}', updatedAt: 1 });
      if (entry.idx === 4) {
        legacy.exec("UPDATE characters SET gold=137, starter_kit_granted=1; UPDATE combat_encounters SET global_ai_enabled=1");
        insertLegacyRow(legacy, s.inventories, { id: 'bag', characterId: 'hero', itemId: 'HEALTH_POTION', slot: 'BAG', quantity: 3 });
      }
      if (entry.idx === 5) legacy.exec("INSERT INTO crash_recovery_checkpoints VALUES ('cp','r','session','{\"positions\":[]}','{\"turnToken\":\"used-token\"}','COMBAT_ACTION',1)");
      expect(legacy.pragma('foreign_key_check')).toEqual([]);
    }
  } finally { legacy.close(); }
  const db = open(path, { seed: false });
  expect(db.db.select().from(s.characters).get()).toMatchObject({ gold: 137, playerId: 'p' });
  expect(db.db.select().from(s.inventories).get()).toMatchObject({ quantity: 3 });
  expect(db.db.select().from(s.editorHistory).get()).toMatchObject({ undone: true, discarded: false });
  expect(db.db.select().from(s.combatEncounters).get()).toMatchObject({ turnToken: 'used-token', remainingActions: 1, globalAiEnabled: true });
  expect(db.db.select().from(s.crashRecoveryCheckpoints).get()?.sessionId).toBe('session');
  for (const [name, columns] of [['idx_players_room_token', ['room_id', 'session_token']], ['idx_cells_chamber_qr', ['chamber_id', 'q', 'r']], ['idx_inventories_char_slot', ['character_id', 'slot']]] as const) {
    expect((db.sqlite.pragma(`index_info(${name})`) as { name: string }[]).map(c => c.name)).toEqual(columns);
  }
  expect(sanitizeDatabase(db, { now: 10_000_000 }).integrity).toBe('ok');
  expect(db.db.select().from(s.editorHistory).all()).toHaveLength(1);
  expect(db.db.select().from(s.crashRecoveryCheckpoints).all()).toHaveLength(1);
});
it('uses NORMAL by default, supports FULL and exposes checked WAL checkpoints', () => {
  vi.stubEnv('DB_SYNCHRONOUS', 'NORMAL');
  const db = open(join(folder(), 'wal.db'));
  expect(db.sqlite.pragma('synchronous', { simple: true })).toBe(1);
  expect(db.checkpointWal('TRUNCATE').busy).toBe(0);
  expect(() => db.sqlite.transaction(() => db.checkpointWal())()).toThrow('transação finalizada');
  vi.stubEnv('DB_SYNCHRONOUS', 'FULL');
  expect(open().sqlite.pragma('synchronous', { simple: true })).toBe(2);
  vi.stubEnv('DB_SYNCHRONOUS', 'OFF'); expect(() => openDatabase(':memory:')).toThrow('NORMAL ou FULL');
});
it('enforces checkpoint room/session identity, unique room and JSON object constraints', () => {
  const db = open(); room(db); room(db, 'other'); session(db, 'session', 'ACTIVE', 1);
  checkpoint(db, 'session', 1);
  expect(() => checkpoint(db, 'session', 2)).toThrow();
  expect(() => db.sqlite.exec("UPDATE crash_recovery_checkpoints SET room_id='other'")).toThrow();
  for (const json of ['broken', '[]']) expect(() => db.sqlite.prepare('UPDATE crash_recovery_checkpoints SET serialized_room_state=?').run(json)).toThrow();
});
it('prunes only expired CLOSED recovery data, explicitly discarded history and stale reconnect tokens', () => {
  const db = open(), now = 40 * 86_400_000; room(db);
  session(db, 'old', 'CLOSED', 1); session(db, 'recent', 'CLOSED', now); session(db, 'active', 'ACTIVE', 1); checkpoint(db, 'old', 1);
  for (const [name, lastSeenAt] of [['old', 1], ['recent', now]] as const) db.db.insert(s.players).values({ roomId: 'r', name, sessionToken: name, reconnectionToken: name, lastSeenAt }).run();
  for (const [undone, discarded] of [[false, false], [true, false], [true, true]]) db.db.insert(s.editorHistory).values({ roomId: 'r', beforeJson: '{}', afterJson: '{}', undone, discarded }).run();
  expect(sanitizeDatabase(db, { now }).removed).toEqual({ checkpoints: 1, sessions: 1, history: 1, reconnectionTokens: 1 });
  expect(db.db.select().from(s.sessions).all().map(s => s.id).sort()).toEqual(['active', 'recent']);
  expect(db.db.select().from(s.editorHistory).all().map(h => h.undone)).toEqual([false, true]);
  expect(db.db.select().from(s.players).all()).toEqual(expect.arrayContaining([expect.objectContaining({ sessionToken: 'old', reconnectionToken: null }), expect.objectContaining({ sessionToken: 'recent', reconnectionToken: 'recent' })]));
  expect(sanitizeDatabase(db, { now }).removed).toEqual({ checkpoints: 0, sessions: 0, history: 0, reconnectionTokens: 0 });
});
it('rolls back cleanup on failure and refuses FK corruption before deleting records', () => {
  const db = open(); room(db); session(db, 'old', 'CLOSED', 1); checkpoint(db, 'old', 1);
  db.db.insert(s.editorHistory).values({ roomId: 'r', beforeJson: '{}', afterJson: '{}', discarded: true }).run();
  db.sqlite.exec("CREATE TRIGGER reject_cleanup BEFORE DELETE ON editor_history BEGIN SELECT RAISE(ABORT, 'cleanup failure'); END");
  expect(() => sanitizeDatabase(db, { now: 40 * 86_400_000 })).toThrow('cleanup failure');
  expect(db.db.select().from(s.crashRecoveryCheckpoints).all()).toHaveLength(1);
  db.sqlite.exec("DROP TRIGGER reject_cleanup; PRAGMA foreign_keys=OFF; UPDATE sessions SET room_id='missing'; PRAGMA foreign_keys=ON");
  expect(() => sanitizeDatabase(db)).toThrow('referências inválidas');
  expect(db.db.select().from(s.editorHistory).all()).toHaveLength(1);
});
it('runs pnpm db:sanitize against a temporary database and returns failure for an invalid file', () => {
  const filename = join(folder(), 'cli.db');
  const db = open(filename); room(db); db.close();
  const result = spawnSync('pnpm', ['db:sanitize'], { cwd: resolve('.'), env: { ...process.env, DATABASE_PATH: filename }, encoding: 'utf8', timeout: 20000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0); expect(result.stdout + result.stderr).toContain('"integrity": "ok"');
  const broken = join(folder(), 'broken.db'); writeFileSync(broken, 'not sqlite');
  const failed = spawnSync('pnpm', ['db:sanitize'], { cwd: resolve('.'), env: { ...process.env, DATABASE_PATH: broken }, encoding: 'utf8', timeout: 20000 });
  expect(failed.error).toBeUndefined();
  expect(failed.status).toBe(1);
}, 30000);
