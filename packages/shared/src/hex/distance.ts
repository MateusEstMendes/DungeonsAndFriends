import type { Hex } from "./coordinates.js";
export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];
export function hexDistance(a: Hex, b: Hex): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}
export const getHexNeighbors = (q: number, r: number): Hex[] => HEX_DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }));
/** Exactly the perimeter; radius zero contains the center. */
export function getHexRing(center: Hex, radius: number): Hex[] {
  if (!Number.isInteger(radius) || radius < 0) throw new RangeError("Raio inválido.");
  if (!radius) return [{ ...center }];
  const ring: Hex[] = [];
  let q = center.q - radius, r = center.r + radius;
  for (const d of HEX_DIRECTIONS) for (let step = 0; step < radius; step++) {
    ring.push({ q, r }); q += d.q; r += d.r;
  }
  return ring;
}
export function getHexDisk(center: Hex, radius: number): Hex[] {
  return Array.from({ length: radius + 1 }, (_, i) => getHexRing(center, i)).flat();
}
