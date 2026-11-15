import type { DamageDice } from '../rules/items.js';

/** Bounded dice notation and injected randomness keep the rule deterministic. */
export function rollDamageDice(expression: DamageDice, roll: (faces: number) => number): number {
  const match = /^([1-9]\d?)d(4|6|8|10|12|20|100)$/.exec(expression);
  if (!match || match[0] !== expression || Number(match[1]) > 20) throw new Error('Dados de dano inválidos.');
  const count = Number(match[1]), faces = Number(match[2]);
  let total = 0;
  for (let i = 0; i < count; i++) {
    const value = roll(faces);
    if (!Number.isInteger(value) || value < 1 || value > faces) throw new Error('Rolagem fora dos limites do dado.');
    total += value;
  }
  return total;
}
