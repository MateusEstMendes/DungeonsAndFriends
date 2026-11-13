import { Graphics } from "pixi.js";
import { HEX_SIZE, hexToPixel } from "@df/shared";
import type { BoardChamber } from "../../store/useBoardStore";
import { parseHex } from "./hexGraphics";
export class WallLayer extends Graphics {
  renderChamber(chamber: BoardChamber) {
    this.clear();
    for (const key of Object.keys(chamber.walls)) {
      const [a, b] = key.split("|").map(parseHex), pa = hexToPixel(a.q, a.r), pb = hexToPixel(b.q, b.r);
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
      const angle = Math.atan2(pb.y - pa.y, pb.x - pa.x) + Math.PI / 2;
      const dx = Math.cos(angle) * HEX_SIZE / 2, dy = Math.sin(angle) * HEX_SIZE / 2;
      this.moveTo(mx - dx, my - dy).lineTo(mx + dx, my + dy).stroke({ color: 0x121218, width: 10, cap: "round" });
      this.moveTo(mx - dx, my - dy).lineTo(mx + dx, my + dy).stroke({ color: 0xa8a1a0, width: 5, cap: "round" });
    }
  }
}
