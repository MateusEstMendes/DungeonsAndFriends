import { Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import type { AttackType } from '@df/shared';
import type { BoardMotion } from '../motion';

export function combatEffects(parent: Container, type: AttackType, x: number, y: number, motion: BoardMotion) {
  const effect = new Container(); effect.position.set(x, y); parent.addChild(effect);
  const color = { FIRE: 0xff793c, ICE: 0x9eeaff, LIGHT: 0xffe3a1, DARKNESS: 0x9354d6, ARCANE: 0xb7a1ff,
    SLASHING: 0xffefcc, BLUNT: 0xd8b78a, THRUST: 0xffe6b9, UNARMED: 0xd8b78a, WARRIOR: 0xffefcc, BARBARIAN: 0xe95b45, ROGUE: 0xc5b2e8 }[type];
  for (let i = 0; i < 15; i++) {
    const g = new Graphics(); effect.addChild(g);
    const angle = i * 2.39996, radius = 20 + i * 4;
    if (type === 'SLASHING' || type === 'WARRIOR' || type === 'ROGUE') g.arc(0, 0, radius, -1.4, .3).stroke({ color, width: 2 + i % 3 });
    else if (type === 'THRUST' || type === 'LIGHT') g.moveTo(-140, 60).lineTo(35, -45).stroke({ color, width: i === 0 ? 8 : 1, alpha: 1 - i / 18 });
    else if (type === 'ICE') g.poly([0,-18, 6,0, 0,18, -6,0]).fill({ color, alpha: .85 });
    else if (type === 'DARKNESS') g.circle(0, 0, 15 + i % 4 * 5).fill({ color, alpha: .20 });
    else g.circle(0, 0, type === 'FIRE' ? 5 + i % 4 : 2 + i % 3).fill(color);
    const spiral = type === 'FIRE' || type === 'ARCANE';
    g.position.set(Math.cos(angle) * (spiral ? radius : 5), Math.sin(angle) * (spiral ? radius : 5));
    motion.run(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, onComplete: () => { if (!g.destroyed) g.destroy(); } });
      if (!motion.reduced) tl.from(g.scale, { x: .1, y: .1, duration: .15 }, 0)
        .to(g, { x: Math.cos(angle) * (radius + 45), y: Math.sin(angle) * (radius + 45) - (type === 'FIRE' ? 55 : 0), rotation: spiral ? 2 : .4, duration: .6 }, 0);
      tl.to(g, { alpha: 0, duration: .4 }, .2);
    });
  }
  motion.run(() => gsap.delayedCall(.7, () => { if (!effect.destroyed) effect.destroy({ children: true }); }));
}
