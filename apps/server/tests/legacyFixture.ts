import { getTableColumns, getTableName, type Table } from 'drizzle-orm';
import type SQLite from 'better-sqlite3';
import { openDatabase } from '../src/db/index.js';
import { chambers, maps, placedObjects, terrainCells, walls } from '../src/db/schema.js';

/** Fixtures must use the actual legacy columns, not the latest Drizzle INSERT/RETURNING. */
export function insertLegacyRow(sqlite: SQLite.Database, table: Table, values: Record<string, unknown>) {
  const columns = getTableColumns(table), name = getTableName(table);
  const available = new Set((sqlite.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[]).map(c => c.name));
  const entries = Object.entries(values).filter(([key, value]) => value !== undefined && columns[key] && available.has(columns[key].name));
  sqlite.prepare(`INSERT INTO "${name}" (${entries.map(([key]) => `"${columns[key].name}"`).join(',')}) VALUES (${entries.map(() => '?').join(',')})`)
    .run(...entries.map(([,value]) => typeof value === 'boolean' ? Number(value) : value));
}
export function seedLegacyBoard(sqlite: SQLite.Database) {
  const fixture = openDatabase(':memory:');
  try {
    for (const table of [maps, chambers, terrainCells, walls, placedObjects]) {
      for (const row of fixture.db.select().from(table).all()) insertLegacyRow(sqlite, table, row);
    }
  } finally { fixture.close(); }
}
