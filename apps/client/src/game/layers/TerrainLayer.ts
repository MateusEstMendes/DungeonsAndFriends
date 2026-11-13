import { Container, Graphics, Text } from "pixi.js";
import { hexToPixel, type Hex } from "@df/shared";
import type { BoardChamber } from "../../store/useBoardStore";
import { drawHex, parseHex } from "./hexGraphics";
const colors = { STONE: 0x373946, GRASS: 0x36594b, DIRT: 0x685043, SAND: 0x9a8359, WATER: 0x295e7a, DEEP_WATER: 0x132e49, OBSTACLE: 0x191922 };
export class TerrainLayer extends Container {
  readonly path = new Graphics();
  private floor = new Graphics();
  private labels = new Container();
  constructor() { super(); this.addChild(this.floor, this.path, this.labels); }
  renderChamber(chamber: BoardChamber, debug: boolean) {
    this.floor.clear(); this.labels.removeChildren().forEach(c => c.destroy());
    for (const [key, terrain] of Object.entries(chamber.cells)) {
      const h = parseHex(key), p = hexToPixel(h.q, h.r);
      drawHex(this.floor, h.q, h.r, colors[terrain]).stroke({ color: 0x69707e, width: 1, alpha: 0.18 });
      // Small deterministic chips keep repeated tiles readable without textures.
      if (terrain === "STONE" && (h.q * 7 + h.r * 3) % 4 === 0) this.floor.moveTo(p.x - 14, p.y + 7).lineTo(p.x - 4, p.y + 9).stroke({ color: 0x9ba2b5, width: 1, alpha: 0.13 });
      if (debug) {
        const text = new Text({ text: key, style: { fontSize: 11, fill: 0xb4b6c9 } }); text.anchor.set(0.5); text.position.set(p.x, p.y + 18); this.labels.addChild(text);
      }
    }
    for (const portal of chamber.portals) {
      const p = hexToPixel(portal.fromQ, portal.fromR);
      this.floor.circle(p.x, p.y, 20).fill({ color: 0x94a7f0, alpha: 0.2 }).stroke({ color: 0xaebdff, width: 2 });
      this.floor.circle(p.x, p.y, 12).stroke({ color: 0xc2ceff, width: 1 });
    }
  }
  highlight(path: Hex[]) { this.path.clear(); for (const h of path) drawHex(this.path, h.q, h.r, 0xd9b66b, 0.28, 35); }
}
