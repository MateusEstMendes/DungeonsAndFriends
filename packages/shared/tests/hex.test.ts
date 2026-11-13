import { describe, expect, it } from "vitest";
import { axialToCube, cubeToAxial, hexToPixel, pixelToHex, getHexEdgeKey } from "../src/hex/coordinates.js";
import { getHexDisk, getHexNeighbors, getHexRing, hexDistance } from "../src/hex/distance.js";
import { findHexPath } from "../src/hex/pathfinding.js";
import { computeHexFOV, hexLinedraw } from "../src/hex/fov.js";
const origin = { q: 0, r: 0 };
describe("núcleo hexagonal pointy-topped", () => {
  it("converte centros e cliques internos sem erro em coordenadas negativas e diferentes escalas", () => {
    for (const size of [10, 40, 100]) for (const h of getHexDisk(origin, 20)) {
      const c = axialToCube(h.q, h.r), p = hexToPixel(h.q, h.r, size);
      expect(c.x + c.y + c.z).toBe(0);
      expect(cubeToAxial(c.x, c.y, c.z)).toEqual(h);
      expect(pixelToHex(p.x, p.y, size)).toEqual(h);
      expect(pixelToHex(p.x + size / 4, p.y - size / 4, size)).toEqual(h);
    }
  });
  it("retorna seis vizinhos e anéis sem repetições", () => {
    expect(getHexNeighbors(0, 0)).toHaveLength(6);
    for (let r = 1; r <= 8; r++) {
      const ring = getHexRing(origin, r);
      expect(ring).toHaveLength(r * 6);
      expect(new Set(ring.map(h => `${h.q},${h.r}`)).size).toBe(ring.length);
      expect(ring.every(h => hexDistance(origin, h) === r)).toBe(true);
    }
  });
  it("A* contorna aresta em ambos os sentidos, terrenos caros e destino ocupado", () => {
    const goal = { q: 2, r: 0 }, edge = getHexEdgeKey(origin, { q: 1, r: 0 });
    const options = { canCross: (a: typeof origin, b: typeof origin) => getHexEdgeKey(a, b) !== edge };
    const walkable = (h: typeof origin) => hexDistance(origin, h) <= 4;
    const path = findHexPath(origin, goal, walkable, () => 1, options)!;
    expect(path).toHaveLength(4);
    expect(findHexPath(goal, origin, walkable, () => 1, options)).toHaveLength(4);
    expect(findHexPath(origin, goal, h => walkable(h) && h.q !== 2)).toBeNull();
    const cheap = findHexPath(origin, goal, walkable, h => h.q === 1 && h.r === 0 ? 5 : 1)!;
    expect(cheap).not.toContainEqual({ q: 1, r: 0 });
    expect(findHexPath(origin, goal, walkable, () => 1, { maxCost: 1 })).toBeNull();
  });
  it("limita visão a 4, bloqueia paredes e células opacas", () => {
    const fov = computeHexFOV(origin);
    expect(fov.size).toBe(61);
    expect(fov.has("4,0")).toBe(true); expect(fov.has("5,0")).toBe(false);
    const opaque = computeHexFOV(origin, 4, h => h.q === 1 && h.r === 0);
    expect(opaque.has("1,0")).toBe(true); expect(opaque.has("2,0")).toBe(false);
    const wall = getHexEdgeKey(origin, { q: 1, r: 0 });
    const closed = computeHexFOV(origin, 4, () => false, (a, b) => getHexEdgeKey(a, b) === wall);
    expect(closed.has("1,0")).toBe(false); expect(closed.has("2,0")).toBe(false);
    expect(hexLinedraw(origin, { q: 4, r: -2 })).toHaveLength(5);
  });
});
