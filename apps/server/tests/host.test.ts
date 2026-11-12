import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { openDatabase } from "../src/db/index.js";
import { DEFAULT_MASTER_PASSWORD, prepareHost } from "../src/host.js";
import { verifyPassword } from "../src/rooms/handlers/auth.js";
import { rooms, sessions } from "../src/db/schema.js";

const database = openDatabase(":memory:");
afterAll(() => database.close());
afterEach(() => { database.db.delete(sessions).run(); database.db.delete(rooms).run(); vi.unstubAllEnvs(); });
describe("senha do host", () => {
  it("usa a senha predefinida em salas novas e existentes sem trocar a sala", () => {
    vi.stubEnv("MASTER_PASSWORD", undefined);
    const initial = prepareHost(database, "senha-antiga");
    const restored = prepareHost(database);
    expect(restored.room.id).toBe(initial.room.id);
    expect(restored.room.code).toBe(initial.room.code);
    expect(verifyPassword(DEFAULT_MASTER_PASSWORD, restored.room.masterPasswordHash)).toBe(true);
    expect(verifyPassword("senha-antiga", restored.room.masterPasswordHash)).toBe(false);
    expect(prepareHost(database).room.masterPasswordHash).toBe(restored.room.masterPasswordHash);
  });
  it("prioriza MASTER_PASSWORD e restaura o padrão quando a variável é removida", () => {
    vi.stubEnv("MASTER_PASSWORD", "senha-local");
    expect(verifyPassword("senha-local", prepareHost(database).room.masterPasswordHash)).toBe(true);
    vi.stubEnv("MASTER_PASSWORD", undefined);
    expect(verifyPassword(DEFAULT_MASTER_PASSWORD, prepareHost(database).room.masterPasswordHash)).toBe(true);
  });
});
