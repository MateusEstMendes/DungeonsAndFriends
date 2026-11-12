import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { openDatabase } from "./index.js";
import { sessions } from "./schema.js";

export function ensureActiveSession(database: ReturnType<typeof openDatabase>, roomId: string) {
  return database.db.transaction(db => {
    const active = db.select().from(sessions).where(and(eq(sessions.roomId, roomId), eq(sessions.status, "ACTIVE"))).get();
    if (active) {
      db.update(sessions).set({ updatedAt: Date.now() }).where(eq(sessions.id, active.id)).run();
      return active.id;
    }
    const id = randomUUID();
    db.insert(sessions).values({ id, roomId, status: "ACTIVE" }).run();
    return id;
  });
}
