import { defineConfig } from "drizzle-kit";
import { databasePath } from "./src/db/paths.js";
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: databasePath() },
});
