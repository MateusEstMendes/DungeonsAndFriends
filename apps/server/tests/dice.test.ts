import { expect, it } from 'vitest';
import { DICE_FACES, evaluateD20, roll } from '../src/services/diceService.js';
import { openDatabase } from '../src/db/index.js';

it('uses inclusive cryptographic dice bounds and rejects unsupported faces', () => {
  for (const faces of DICE_FACES) for (let i = 0; i < 100; i++) {
    const value = roll(faces);
    expect(value).toBeGreaterThanOrEqual(1); expect(value).toBeLessThanOrEqual(faces);
  }
  expect(() => roll(3)).toThrow();
});
it('classifies configurable d20 boundaries', () => {
  const cuts = { criticalFailure: 2, success: 12, criticalSuccess: 19 };
  expect([2, 3, 11, 12, 18, 19, 20].map(v => evaluateD20(v, cuts)))
    .toEqual(['CRITICAL_FAILURE', 'FAILURE', 'FAILURE', 'SUCCESS', 'SUCCESS', 'CRITICAL_SUCCESS', 'CRITICAL_SUCCESS']);
  expect(() => evaluateD20(10, { ...cuts, success: 20 })).toThrow();
});
it('migrates and seeds combat tables on a fresh database', () => {
  const database = openDatabase(':memory:');
  try {
    const rows = database.sqlite.prepare('SELECT name, flat_dr FROM monsters_catalog ORDER BY id').all();
    expect(rows).toHaveLength(10);
    expect(rows).toContainEqual({ name: 'Esqueleto Guerreiro', flat_dr: 5 });
    for (const table of ['combat_encounters', 'combat_participants', 'active_buffs'])
      expect(database.sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
  } finally { database.close(); }
});
