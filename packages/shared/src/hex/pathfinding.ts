import { getHexKey, type Hex } from "./coordinates.js";
import { getHexNeighbors, hexDistance } from "./distance.js";
export interface PathOptions {
  canCross?: (from: Hex, to: Hex) => boolean;
  maxVisited?: number;
  maxCost?: number;
}
/** Costs must be >= 1, so hex distance is an admissible heuristic. Includes start. */
export function findHexPath(start: Hex, goal: Hex, isWalkable: (hex: Hex) => boolean,
  getTerrainCost: (hex: Hex) => number = () => 1, options: PathOptions = {}): Hex[] | null {
  if (!isWalkable(goal)) return null;
  const key = (h: Hex) => getHexKey(h.q, h.r);
  const open = new Map<string, Hex>([[key(start), start]]);
  const costs = new Map([[key(start), 0]]), previous = new Map<string, Hex>();
  let visited = 0;
  while (open.size && visited++ < (options.maxVisited ?? 10_000)) {
    let current = open.values().next().value!;
    for (const h of open.values()) if (costs.get(key(h))! + hexDistance(h, goal) < costs.get(key(current))! + hexDistance(current, goal)) current = h;
    open.delete(key(current));
    if (key(current) === key(goal)) {
      const path = [current];
      while (previous.has(key(path[0]))) path.unshift(previous.get(key(path[0]))!);
      return path;
    }
    for (const next of getHexNeighbors(current.q, current.r)) {
      if (!isWalkable(next) || options.canCross?.(current, next) === false) continue;
      const terrain = getTerrainCost(next);
      if (!Number.isFinite(terrain) || terrain < 1) continue;
      const cost = costs.get(key(current))! + terrain;
      if (cost > (options.maxCost ?? Infinity) || cost >= (costs.get(key(next)) ?? Infinity)) continue;
      costs.set(key(next), cost); previous.set(key(next), current); open.set(key(next), next);
    }
  }
  return null;
}
