export const TOTAL_POINTS = 27;
export const MIN_ATTR = 8;
export const MAX_ATTR = 15;
export const ATTRIBUTE_IDS = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type AttributeId = (typeof ATTRIBUTE_IDS)[number];
export type Attributes = Record<AttributeId, number>;
export const POINT_BUY_COSTS: Readonly<Record<number, number>> = Object.freeze({
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
});

export function calculatePointBuyCost(attributes: Attributes): number {
  return ATTRIBUTE_IDS.reduce((total, key) => {
    const value = attributes?.[key];
    return total + (Number.isInteger(value) && value >= MIN_ATTR && value <= MAX_ATTR ? POINT_BUY_COSTS[value] : Infinity);
  }, 0);
}
export function canIncrementAttribute(currentValue: number, remainingPoints: number): boolean {
  return Number.isInteger(currentValue) && currentValue >= MIN_ATTR && currentValue < MAX_ATTR
    && Number.isInteger(remainingPoints) && remainingPoints >= POINT_BUY_COSTS[currentValue + 1] - POINT_BUY_COSTS[currentValue];
}
export function validatePointBuy(attributes: Attributes): { valid: boolean; remaining: number; error?: string } {
  const cost = calculatePointBuyCost(attributes);
  if (!Number.isFinite(cost)) return { valid: false, remaining: TOTAL_POINTS - cost, error: "Os seis atributos devem ser inteiros entre 8 e 15." };
  const remaining = TOTAL_POINTS - cost;
  return remaining < 0
    ? { valid: false, remaining, error: "O custo dos atributos excede os 27 pontos disponíveis." }
    : { valid: true, remaining };
}
