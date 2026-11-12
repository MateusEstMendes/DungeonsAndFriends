import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Mesmos caminhos executando src/db ou dist/db e independentemente do cwd.
export const defaultDatabasePath = fileURLToPath(new URL("../../dungeons.db", import.meta.url));
export const migrationsFolder = fileURLToPath(new URL("../../src/db/migrations", import.meta.url));
export function databasePath() {
  return process.env.DATABASE_PATH ? resolve(process.env.DATABASE_PATH) : defaultDatabasePath;
}
