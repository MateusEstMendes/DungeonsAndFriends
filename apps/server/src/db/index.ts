import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { databasePath, migrationsFolder } from "./paths.js";
import * as schema from "./schema.js";

const foundationVersion = "0.1.0";

export function openDatabase(filename = databasePath()) {
  const sqlite = new Database(filename);
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("foreign_keys = ON");
    const db = drizzle(sqlite, { schema });
    const checksum = createHash("sha256")
      .update(readFileSync(join(migrationsFolder, "0000_init_foundation.sql")))
      .digest("hex");
    const hasLedger = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_dungeons_migrations'").get();
    if (hasLedger) {
      const applied = db.select().from(schema.dungeonsMigrations).all()
        .find(entry => entry.version === foundationVersion);
      if (applied && applied.checksum !== checksum) {
        throw new Error("A migração 0.1.0 foi alterada após aplicação. Restaure o arquivo original e gere uma nova migração.");
      }
    }
    // Drizzle mantém __drizzle_migrations; o ledger do jogo registra a versão da fundação.
    migrate(db, { migrationsFolder });
    db.insert(schema.dungeonsMigrations).values({
      version: foundationVersion, appliedAt: Date.now(), checksum,
    }).onConflictDoNothing().run();
    return { db, sqlite, close: () => { sqlite.close(); } };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}
