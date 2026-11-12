import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { openDatabase } from "./db/index.js";
import { rooms } from "./db/schema.js";
import { generateRoomCode, hashPassword, verifyPassword } from "./rooms/handlers/auth.js";

import { ensureActiveSession } from "./db/session.js";

export const DEFAULT_MASTER_PASSWORD = "Mateus2312@";

export function prepareHost(database: ReturnType<typeof openDatabase>, password = process.env.MASTER_PASSWORD ?? DEFAULT_MASTER_PASSWORD) {
  if (password.length === 0 || password.length > 256) throw new Error("MASTER_PASSWORD deve ter de 1 a 256 caracteres.");
  const { db } = database;
  let room = db.select().from(rooms).orderBy(desc(rooms.createdAt)).get();
  if (!room) {
    let code = generateRoomCode();
    while (db.select().from(rooms).where(eq(rooms.code, code)).get()) code = generateRoomCode();
    room = { id: randomUUID(), code, masterPasswordHash: hashPassword(password), status: "LOBBY", createdAt: Date.now() };
    db.insert(rooms).values(room).run();
  } else if (!verifyPassword(password, room.masterPasswordHash)) {
    room.masterPasswordHash = hashPassword(password);
    db.update(rooms).set({ masterPasswordHash: room.masterPasswordHash }).where(eq(rooms.id, room.id)).run();
  }
  ensureActiveSession(database, room.id);
  return { room };
}
