import { Container, Graphics, RenderTexture, Sprite, type Renderer } from "pixi.js";
import { getHexNeighbors, getHexKey, hexToPixel } from "@df/shared";
import type { BoardChamber } from "../../store/useBoardStore";
import { drawHex, parseHex } from "./hexGraphics";
import { FogMemory } from "./FogMemory";
export class FogOfWarLayer extends Container {
  private memory = new FogMemory();
  private texture?: RenderTexture;
  private fog = new Sprite();
  constructor() { super(); this.addChild(this.fog); }
  update(renderer: Renderer, chamber: BoardChamber, active: Set<string>, master: boolean) {
    this.visible = !master;
    if (master) return;
    this.memory.visit(chamber.id, active);
    const points = Object.keys(chamber.cells).map(key => { const h = parseHex(key); return hexToPixel(h.q, h.r); });
    if (!points.length) return;
    const left = Math.min(...points.map(p => p.x)) - 44, top = Math.min(...points.map(p => p.y)) - 44;
    const width = Math.ceil(Math.max(...points.map(p => p.x)) + 44 - left), height = Math.ceil(Math.max(...points.map(p => p.y)) + 44 - top);
    // Limit render texture resolution for very large edited chambers.
    const resolution = Math.min(1, 2048 / Math.max(width, height));
    if (!this.texture || this.texture.width !== width || this.texture.height !== height) {
      this.texture?.destroy(true); this.texture = RenderTexture.create({ width, height, resolution }); this.fog.texture = this.texture;
    }
    const graphics = new Graphics(); graphics.position.set(-left, -top);
    for (const key of Object.keys(chamber.cells)) {
      const h = parseHex(key);
      if (!active.has(key)) drawHex(graphics, h.q, h.r, 0x09090b, this.memory.has(key) ? 0.5 : 1, 40.5);
      else if (getHexNeighbors(h.q, h.r).some(n => !active.has(getHexKey(n.q, n.r)))) {
        // Several translucent strokes feather the edge inside the visible tile.
        for (let i = 0; i < 4; i++) drawHex(graphics, h.q, h.r, 0x09090b, 0, 39 - i * 1.5).stroke({ color: 0x09090b, alpha: (4 - i) * 0.025, width: 3 });
      }
    }
    renderer.render({ container: graphics, target: this.texture, clear: true }); graphics.destroy();
    this.fog.position.set(left, top);
  }
  dispose() { this.texture?.destroy(true); this.memory.clear(); }
}
