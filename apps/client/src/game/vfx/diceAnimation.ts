import { Container, Graphics, Text } from 'pixi.js';
import { gsap } from 'gsap';
import type { BoardMotion } from '../motion';
/** Geometry and final value come from the authoritative roll, never client RNG. */
export function diceAnimation(parent: Container, rolls: { faces: number; value: number }[], motion: BoardMotion, elapsed = 0) {
  const tray = new Container(); parent.addChild(tray);
  rolls.slice(0, 4).forEach(({ faces, value }, index) => {
    const die = new Container(); die.x = (index - (Math.min(rolls.length, 4) - 1) / 2) * 74; tray.addChild(die);
    const shape = new Graphics();
    const sides = faces === 4 ? 3 : faces === 6 ? 4 : faces === 8 ? 4 : 6;
    const points = Array.from({ length: sides }, (_, i) => { const a = i * Math.PI * 2 / sides - Math.PI / 2; return [Math.cos(a) * 29, Math.sin(a) * 29]; }).flat();
    shape.poly(points).fill(0x201c30).stroke({ color: 0xdcbf7c, width: 2 }); die.addChild(shape);
    const result = new Text({ text: String(value), style: { fontFamily: 'Georgia', fontSize: 23, fill: 0xffe6ab, fontWeight: 'bold' } }); result.anchor.set(.5); die.addChild(result);
    const label = new Text({ text: `d${faces}`, style: { fontFamily: 'sans-serif', fontSize: 11, fill: 0xb5a8c7 } }); label.anchor.set(.5); label.y = 38; die.addChild(label);
    motion.run(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      if (!motion.reduced) {
        tl.from(die, { y: -34, rotation: -Math.PI * 2, alpha: 0, duration: .55 }, 0);
        tl.from(result, { alpha: 0, duration: .12 }, .4);
      }
      tl.to(die, { alpha: 0, duration: .2 }, .9);
      tl.call(() => { if (!die.destroyed) die.destroy({ children: true }); });
      if (elapsed > 0) tl.seek(elapsed);
    });
  });
  motion.run(() => gsap.delayedCall(1.2, () => { if (!tray.destroyed) tray.destroy({ children: true }); }));
  return tray;
}
