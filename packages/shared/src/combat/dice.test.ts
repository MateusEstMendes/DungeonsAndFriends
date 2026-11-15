import { expect, it } from 'vitest';
import { rollDamageDice } from './dice.js';
import type { DamageDice } from '../rules/items.js';
it('rolls each weapon die independently using injected randomness', () => {
  const faces: number[] = [], values = [2, 6];
  expect(rollDamageDice('2d6', f => { faces.push(f); return values.shift()!; })).toBe(8);
  expect(faces).toEqual([6, 6]); expect(values).toEqual([]);
});
it('rejects malformed or unbounded notation before rolling', () => {
  for (const value of ['0d6', '-1d6', '1d7', '21d6', '9999d6', '1d6+3', '1d6;DROP TABLE', '1d6\n']) {
    let called = false;
    expect(() => rollDamageDice(value as DamageDice, () => { called = true; return 1; })).toThrow();
    expect(called).toBe(false);
  }
});
it('rejects impossible roll results', () => {
  for (const value of [0, 7, 2.5, NaN]) expect(() => rollDamageDice('1d6', () => value)).toThrow('limites');
});
