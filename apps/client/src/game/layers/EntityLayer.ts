import { Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { gsap } from "gsap";
import { findHexPath, getHexEdgeKey, getHexKey, hexToPixel } from "@df/shared";
import type { BoardChamber, BoardEntity } from "../../store/useBoardStore";
import type { BoardMotion } from "../motion";
interface Token { group: Container; data: BoardEntity; texture?: Texture; animation?: gsap.core.Timeline; url: string }
export class EntityLayer extends Container {
  private tokens = new Map<string, Token>();
  private disposed = false;
  constructor(private readonly motion: BoardMotion) { super(); }
  update(entities: BoardEntity[], chamber: BoardChamber, ownId: string, selectedId: string) {
    const ids = new Set(entities.map(e => e.id));
    for (const [id, token] of this.tokens) if (!ids.has(id)) { token.animation?.kill(); token.group.destroy({ children: true }); token.texture?.destroy(true); this.tokens.delete(id); }
    for (const entity of entities) {
      const p = hexToPixel(entity.q, entity.r);
      let token = this.tokens.get(entity.id);
      if (!token) {
        const group = new Container(); group.position.set(p.x, p.y);
        const border = new Graphics().circle(0, 0, 28).fill(entity.tokenUrl ? 0x24252e : 0x7e444f).stroke({ color: entity.id === ownId ? 0xd9b66b : 0xb7b9cb, width: 3 });
        const label = new Text({ text: entity.name, style: { fontSize: 11, fill: 0xf8e9cd, stroke: { color: 0x121218, width: 3 } } }); label.anchor.set(0.5); label.y = 39;
        group.addChild(border, label); this.addChild(group);
        token = { group, data: entity, url: "" }; this.tokens.set(entity.id, token);
      }
      token.group.alpha = entity.isHiddenByMaster ? 0.4 : 1;
      token.group.tint = entity.id === selectedId ? 0xffd98e : 0xffffff;
      if (entity.tokenUrl && token.url !== entity.tokenUrl) { token.url = entity.tokenUrl; void this.loadToken(token, entity.tokenUrl); }
      const old = token.data;
      if (old.q !== entity.q || old.r !== entity.r || old.moveRevision !== entity.moveRevision) {
        token.animation?.kill(); gsap.killTweensOf(token.group);
        const path = old.currentChamberId === entity.currentChamberId && old.moveRevision === entity.moveRevision
          ? findHexPath(old, entity, h => !!chamber.cells[getHexKey(h.q, h.r)] && !["DEEP_WATER", "OBSTACLE"].includes(chamber.cells[getHexKey(h.q, h.r)]), () => 1,
            { canCross: (a, b) => !chamber.walls[getHexEdgeKey(a, b)] }) : null;
        const target = token;
        this.motion.run(() => {
          if (!path || this.motion.reduced) gsap.set(target.group, p);
          else {
            target.animation = gsap.timeline({ defaults: { duration: Math.min(0.16, 0.8 / path.length), ease: "none" } });
            for (const h of path.slice(1)) target.animation.to(target.group, hexToPixel(h.q, h.r));
          }
        });
      }
      token.data = { ...entity };
    }
  }
  private async loadToken(token: Token, url: string) {
    try {
      const shared = url.startsWith('/enemies/');
      let texture: Texture;
      if (shared) texture = await Assets.load<Texture>(url);
      else {
        const image = new Image(); image.src = url; await image.decode();
        if (this.disposed || token.group.destroyed || token.url !== url) return;
        texture = Texture.from(image);
      }
      if (this.disposed || token.group.destroyed || token.url !== url) return;
      const sprite = new Sprite(texture); sprite.anchor.set(0.5); sprite.width = sprite.height = 52;
      const mask = new Graphics().circle(0, 0, 26).fill(0xffffff); sprite.mask = mask;
      token.group.addChild(sprite, mask); if (!shared) token.texture = texture;
    } catch { /* A readable fallback token remains when an image cannot load. */ }
  }
  dispose() {
    this.disposed = true;
    for (const token of this.tokens.values()) { token.animation?.kill(); token.texture?.destroy(true); }
    this.tokens.clear();
  }
}
