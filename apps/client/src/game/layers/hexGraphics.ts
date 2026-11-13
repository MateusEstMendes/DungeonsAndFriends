import { Graphics } from "pixi.js";
import { HEX_SIZE, hexToPixel } from "@df/shared";
export function hexPolygon(q: number, r: number, radius = HEX_SIZE - 1): number[] {
  const p = hexToPixel(q, r);
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (60 * i - 30) * Math.PI / 180;
    return [p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius];
  }).flat();
}
export function drawHex(g: Graphics, q: number, r: number, color: number, alpha = 1, radius = HEX_SIZE - 1) {
  return g.poly(hexPolygon(q, r, radius)).fill({ color, alpha });
}
export const parseHex = (key: string) => { const [q, r] = key.split(",").map(Number); return { q, r }; };
