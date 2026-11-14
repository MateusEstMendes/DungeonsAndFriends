import { expect, it } from 'vitest';
import { getMonsterDefinition, MONSTER_CATALOG, RoomState } from '@df/shared';
import { eq } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import { openDatabase } from '../src/db/index.js';
import { monstersCatalog } from '../src/db/schema.js';
import { seedMonsters } from '../src/db/seedMonsters.js';
import { loadBoard, readBoard } from '../src/services/boardRepository.js';

it('adds missing enemies to an existing dungeon without overwriting tuned stats or duplicating rows', () => {
  const database = openDatabase(':memory:');
  try {
    const before = readBoard(database);
    database.db.delete(monstersCatalog).where(eq(monstersCatalog.id, 'YOUNG_DRAGON')).run();
    database.db.update(monstersCatalog).set({ hp: 99 }).where(eq(monstersCatalog.id, 'GOBLIN')).run();
    seedMonsters(database.db); seedMonsters(database.db);
    expect(database.db.select().from(monstersCatalog).all()).toHaveLength(10);
    expect(database.db.select().from(monstersCatalog).where(eq(monstersCatalog.id, 'GOBLIN')).get()?.hp).toBe(99);
    expect(database.db.select().from(monstersCatalog).where(eq(monstersCatalog.id, 'YOUNG_DRAGON')).get()?.hp).toBe(220);
    expect(readBoard(database)).toEqual(before);
  } finally { database.close(); }
});

it('resolves legacy enemies to the same art used by the arena and exposes tokens on loaded maps', () => {
  expect(getMonsterDefinition('Sentinela')?.id).toBe('SKELETON_WARRIOR');
  expect(getMonsterDefinition('Monstro')?.id).toBe('GOBLIN');
  const database = openDatabase(':memory:');
  try {
    const state = new RoomState(); loadBoard(state, readBoard(database));
    expect(state.monsters.get('training-1:monster')?.tokenUrl).toBe('/enemies/skeleton-warrior.png');
  } finally { database.close(); }
});

it('ships a real PNG asset for every catalog enemy', () => {
  for (const monster of MONSTER_CATALOG) {
    const file = new URL(`../../client/public${monster.imageUrl}`, import.meta.url);
    expect(existsSync(file), monster.name).toBe(true);
    expect(readFileSync(file).subarray(0, 8).toString('hex'), monster.name).toBe('89504e470d0a1a0a');
  }
});
