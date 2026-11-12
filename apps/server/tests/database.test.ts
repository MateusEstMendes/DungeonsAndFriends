import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/db/index.js";
import { dungeonsMigrations, players, rooms, sessions } from "../src/db/schema.js";

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
    expect(second.sqlite.prepare("SELECT count(*) AS count FROM __drizzle_migrations").get()).toEqual({ count: 1 });
    second.sqlite.prepare("UPDATE _dungeons_migrations SET checksum = 'altered'").run();
    second.close();
    expect(() => openDatabase(path)).toThrow("alterada após aplicação");
  });
});
