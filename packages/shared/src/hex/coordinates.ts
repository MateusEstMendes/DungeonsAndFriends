export interface Hex { q: number; r: number }
export interface Cube { x: number; y: number; z: number }
export const HEX_SIZE = 40;
export const getHexKey = (q: number, r: number): string => `${q},${r}`;
export const axialToCube = (q: number, r: number): Cube => ({ x: q, y: -q - r, z: r });
export const cubeToAxial = (x: number, _y: number, z: number): Hex => ({ q: x || 0, r: z || 0 });
export function cubeRound(x: number, y: number, z: number): Cube {
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx || 0, y: ry || 0, z: rz || 0 };
}
export function hexToPixel(q: number, r: number, size = HEX_SIZE) {
  return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
}
export function pixelToHex(px: number, py: number, size = HEX_SIZE): Hex {
  const q = (Math.sqrt(3) / 3 * px - py / 3) / size, r = py * 2 / 3 / size;
  const cube = cubeRound(q, -q - r, r);
  return cubeToAxial(cube.x, cube.y, cube.z);
}
/** An undirected edge has the same key from either side. */
export function getHexEdgeKey(a: Hex, b: Hex): string {
  return [getHexKey(a.q, a.r), getHexKey(b.q, b.r)].sort().join("|");
}
