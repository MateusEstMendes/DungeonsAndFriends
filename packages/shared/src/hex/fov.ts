import { axialToCube, cubeRound, cubeToAxial, getHexKey, type Hex } from "./coordinates.js";
import { getHexDisk, hexDistance } from "./distance.js";
export function hexLinedraw(from: Hex, to: Hex): Hex[] {
  const a = axialToCube(from.q, from.r), b = axialToCube(to.q, to.r), n = hexDistance(from, to);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = n ? i / n : 0;
    // A fixed nudge resolves lines running exactly along an edge consistently.
    const c = cubeRound(a.x + (b.x - a.x) * t + 1e-6, a.y + (b.y - a.y) * t + 1e-6, a.z + (b.z - a.z) * t - 2e-6);
    return cubeToAxial(c.x, c.y, c.z);
  });
}
export function computeHexFOV(origin: Hex, maxRadius = 4, blocksSight: (hex: Hex) => boolean = () => false,
  blocksEdge: (from: Hex, to: Hex) => boolean = () => false): Set<string> {
  const visible = new Set([getHexKey(origin.q, origin.r)]);
  for (const target of getHexDisk(origin, maxRadius)) {
    const line = hexLinedraw(origin, target);
    let clear = true;
    for (let i = 1; i < line.length; i++) {
      if (blocksEdge(line[i - 1], line[i]) || (i < line.length - 1 && blocksSight(line[i]))) { clear = false; break; }
    }
    if (clear) visible.add(getHexKey(target.q, target.r));
  }
  return visible;
}
