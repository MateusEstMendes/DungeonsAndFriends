import { Container, Graphics, Text } from "pixi.js";
import { hexToPixel } from "@df/shared";
import type { BoardEntity } from "../../store/useBoardStore";
const names: Record<string, string> = { CHEST: "BAÚ", TABLE: "MESA", CHAIR: "CADEIRA", DOOR: "PORTA", TORCH: "TOCHA" };
export class ObjectLayer extends Container {
  update(objects: BoardEntity[]) {
    this.removeChildren().forEach(c => c.destroy({ children: true }));
    const stack = new Map<string, number>();
    for (const object of objects) {
      const key = `${object.q},${object.r}`, index = stack.get(key) ?? 0; stack.set(key, index + 1);
      const group = new Container(), p = hexToPixel(object.q, object.r);
      group.position.set(p.x + index * 7, p.y + index * 5); group.alpha = object.isHiddenByMaster ? 0.4 : 1;
      const shape = new Graphics();
      if (object.kind === "TORCH") shape.circle(0, 0, 9).fill(0xffb866).circle(0, 0, 18).fill({ color: 0xffb866, alpha: 0.16 });
      else shape.roundRect(-18, -12, 36, 24, 4).fill(object.kind === "CHEST" ? 0x9b7443 : 0x655767).stroke({ color: 0xd8ba83, width: 2 });
      shape.rotation = (object.rotation ?? 0) * Math.PI / 180;
      const label = new Text({ text: names[object.kind ?? ""] ?? "OBJETO", style: { fontSize: 9, fontWeight: "bold", fill: 0xffedd0 } }); label.anchor.set(0.5); label.y = 22;
      group.addChild(shape, label); this.addChild(group);
    }
  }
}
