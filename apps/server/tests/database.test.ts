import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { characterPayload } from "../../../packages/shared/tests/characterFixture.js";
import { prepareCharacter } from "../src/rooms/handlers/auth.js";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/db/index.js";
import { characters, dungeonsMigrations, players, rooms, sessions } from "../src/db/schema.js";

const connections: ReturnType<typeof openDatabase>[] = [];
const folders: string[] = [];
function open(filename = ":memory:") {
  const connection = openDatabase(filename);
  connections.push(connection);
  return connection;
}
afterEach(() => {
  for (const connection of connections.splice(0)) if (connection.sqlite.open) connection.close();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
const room = { id: "room-1", code: "AB2CD", masterPasswordHash: "test-hash" };

describe("persistência SQLite", () => {
  it("aplica migração em memória e habilita foreign keys e busy timeout", () => {
    const { db, sqlite } = open();
    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(sqlite.pragma("busy_timeout", { simple: true })).toBe(5000);
    expect(db.select().from(dungeonsMigrations).all()).toEqual([
      expect.objectContaining({ version: "0.1.0", checksum: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    ]);
    db.insert(rooms).values(room).run();
    db.insert(players).values({ roomId: room.id, name: "Ana", sessionToken: "token-1" }).run();
    db.insert(sessions).values({ id: "session-1", roomId: room.id }).run();
    expect(db.select().from(players).get()?.approvalStatus).toBe("PENDING_APPROVAL");
    expect(db.select().from(sessions).get()?.status).toBe("ACTIVE");
  });
  it("impede duplicatas, referências inválidas e valores fora dos contratos", () => {
    const { db, sqlite } = open();
    db.insert(rooms).values(room).run();
    expect(() => db.insert(rooms).values({ ...room, id: "room-2" }).run()).toThrow();
    expect(() => db.insert(rooms).values({ ...room, id: "bad", code: "AB0CD" }).run()).toThrow();
    expect(() => db.insert(players).values({ roomId: "missing", name: "Ana", sessionToken: "token" }).run()).toThrow();
    db.insert(players).values({ roomId: room.id, name: "Ana", sessionToken: "token" }).run();
    expect(() => db.insert(players).values({ roomId: room.id, name: "Bia", sessionToken: "token" }).run()).toThrow();
    expect(() => sqlite.prepare("UPDATE players SET approval_status = 'INVALID'").run()).toThrow();
    expect(() => sqlite.prepare("UPDATE rooms SET status = 'INVALID'").run()).toThrow();
    expect(() => db.delete(rooms).run()).toThrow();
  });
  it("persiste dados em disco com WAL e reaplica o runner sem duplicar migrações", () => {
    const folder = mkdtempSync(join(tmpdir(), "df-db-"));
    folders.push(folder);
    const path = join(folder, "dungeons.db");
    const first = open(path);
    expect(first.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    first.db.insert(rooms).values(room).run();
    const initialLedger = first.db.select().from(dungeonsMigrations).all();
    first.close();
    const second = open(path);
    expect(second.db.select().from(rooms).get()?.code).toBe("AB2CD");
    expect(second.db.select().from(dungeonsMigrations).all()).toEqual(initialLedger);
    expect(second.sqlite.prepare("SELECT count(*) AS count FROM __drizzle_migrations").get()).toEqual({ count: 5 });
    second.sqlite.prepare("UPDATE _dungeons_migrations SET checksum = 'altered'").run();
    second.close();
    expect(() => openDatabase(path)).toThrow("alterada após aplicação");
  });
  it("migra banco da fase 1 preservando sala, jogador, tokens e autorização", () => {
    const folder = mkdtempSync(join(tmpdir(), "df-upgrade-"));
    folders.push(folder);
    const path = join(folder, "dungeons.db");
    const legacy = new Database(path);
    const foundation = readFileSync(new URL("../src/db/migrations/0000_init_foundation.sql", import.meta.url), "utf8");
    const checksum = createHash("sha256").update(foundation).digest("hex");
    legacy.exec(foundation);
    legacy.exec("CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)");
    legacy.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(checksum, 1794497610423);
    legacy.prepare("INSERT INTO _dungeons_migrations VALUES (?, ?, ?)").run("0.1.0", 1, checksum);
    legacy.prepare("INSERT INTO rooms (id, code, master_password_hash, created_at) VALUES (?, ?, ?, ?)").run(room.id, room.code, room.masterPasswordHash, 1);
    legacy.prepare("INSERT INTO players (id, room_id, name, session_token, reconnection_token, approval_status, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("legacy-player", room.id, "Ana", "legacy-token", "legacy-reconnect", "APPROVED", 1);
    legacy.close();
    const migrated = open(path);
    expect(migrated.db.select().from(players).get()).toMatchObject({ id: "legacy-player", sessionToken: "legacy-token", reconnectionToken: "legacy-reconnect", approvalStatus: "APPROVED", characterId: null });
    expect(migrated.db.select().from(rooms).get()?.code).toBe(room.code);
    expect(migrated.db.select().from(characters).all()).toEqual([]);
    expect(migrated.sqlite.pragma("foreign_key_check")).toEqual([]);
  });
  it("impõe uma ficha por jogador e as referências de ficha, jogador e sala", () => {
    const { db, sqlite } = open();
    db.insert(rooms).values(room).run();
    const player = db.insert(players).values({ roomId: room.id, name: "Ana", sessionToken: "token" }).returning().get();
    const values = { ...prepareCharacter(characterPayload()), playerId: player.id, roomId: room.id };
    expect(() => db.insert(characters).values({ ...values, playerId: "missing" }).run()).toThrow();
    expect(() => db.insert(characters).values({ ...values, roomId: "missing" }).run()).toThrow();
    const character = db.insert(characters).values(values).returning().get();
    expect(() => db.insert(characters).values(values).run()).toThrow();
    expect(() => sqlite.prepare("UPDATE players SET character_id = 'missing'").run()).toThrow();
    sqlite.prepare("UPDATE players SET character_id = ?").run(character.id);
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });

});
