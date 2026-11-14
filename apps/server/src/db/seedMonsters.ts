import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { MONSTER_CATALOG } from '@df/shared';
import * as schema from './schema.js';

/** Run on every startup, including databases whose maps were already seeded. */
export function seedMonsters(db: BetterSQLite3Database<typeof schema>) {
  db.transaction(tx => {
    for (const { imageUrl: _imageUrl, ...monster } of MONSTER_CATALOG) {
      tx.insert(schema.monstersCatalog).values(monster).onConflictDoNothing().run();
    }
  });
}
