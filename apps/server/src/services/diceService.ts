import { randomInt } from 'node:crypto';

export const DICE_FACES = [4, 6, 8, 10, 12, 20, 100] as const;
export type DieFaces = typeof DICE_FACES[number];
export type D20Outcome = 'CRITICAL_FAILURE' | 'FAILURE' | 'SUCCESS' | 'CRITICAL_SUCCESS';
export interface D20Cutoffs { criticalFailure: number; success: number; criticalSuccess: number }
export const DEFAULT_CUTOFFS: D20Cutoffs = { criticalFailure: 1, success: 10, criticalSuccess: 20 };
export function validateCutoffs(c: D20Cutoffs): void {
  if (![c.criticalFailure, c.success, c.criticalSuccess].every(Number.isInteger)
    || c.criticalFailure < 1 || c.criticalFailure >= c.success || c.success >= c.criticalSuccess || c.criticalSuccess > 20) {
    throw new Error('Faixas de d20 inválidas.');
  }
}
export function evaluateD20(value: number, cutoffs: D20Cutoffs = DEFAULT_CUTOFFS): D20Outcome {
  validateCutoffs(cutoffs);
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error('Resultado de d20 inválido.');
  return value <= cutoffs.criticalFailure ? 'CRITICAL_FAILURE' : value >= cutoffs.criticalSuccess ? 'CRITICAL_SUCCESS' : value >= cutoffs.success ? 'SUCCESS' : 'FAILURE';
}
export function roll(faces: number): number {
  if (!(DICE_FACES as readonly number[]).includes(faces)) throw new Error('Dado não suportado.');
  return randomInt(1, faces + 1);
}
export const diceService = { roll, evaluateD20 };
