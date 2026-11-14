import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { gsap } from 'gsap';
import type { BoardMotion } from '../motion';
import type { CombatEvent } from '../../store/useCombatStore';

export function floatingText(parent: Container, camera: Container, event: CombatEvent, x: number, y: number, motion: BoardMotion, defender?: Sprite) {
  const dodged = event.outcome?.startsWith('DODGED'), critical = event.outcome === 'CRITICAL';
  const healing = !event.damage && !!event.healAmount;
  const message = dodged ? 'Esquivou!' : event.damage ? `−${event.damage}` : healing ? `+${event.healAmount}` : event.outcome === 'FLED' ? 'Fuga bem-sucedida!' : event.outcome === 'FLEE_FAILED' ? 'Fuga falhou' : 'Defesa preparada';
  const text = new Text({ text: message, style: { fontFamily: 'Georgia', fontSize: critical ? 44 : 30,
    fontWeight: 'bold', fill: dodged ? 0x80caff : critical ? 0xffdc77 : healing ? 0x9ae6bc : 0xff776e,
    stroke: { color: 0x17101e, width: 4 } } });
  text.anchor.set(.5); text.position.set(x, y); parent.addChild(text);
  motion.run(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, onComplete: () => { if (!text.destroyed) text.destroy(); } });
    if (!motion.reduced) { tl.from(text.scale, { x: .4, y: .4, duration: .2 }, 0); tl.to(text, { y: y - 65, x: x + 14, duration: 1.2 }, 0); }
    tl.to(text, { alpha: 0, duration: .35 }, .85);
    if (critical && !motion.reduced) gsap.fromTo(camera, { x: -8 }, { x: 8, duration: .045, repeat: 5, yoyo: true, onComplete: () => { camera.x = 0; } });
  });
  if (dodged && defender?.parent) {
    const ghost = new Sprite(defender.texture); ghost.anchor.copyFrom(defender.anchor);
    ghost.position.copyFrom(parent.toLocal(defender.getGlobalPosition()));
    ghost.scale.set(defender.scale.x * defender.parent.scale.x, defender.scale.y * defender.parent.scale.y); ghost.tint = 0x80caff; ghost.alpha = .45;
    parent.addChild(ghost);
    motion.run(() => gsap.to(ghost, { x: ghost.x + (motion.reduced ? 0 : 60), alpha: 0, duration: .6, onComplete: () => { if (!ghost.destroyed) ghost.destroy(); } }));
  } else if (dodged) {
    const silhouette = new Graphics().circle(0,-35,15).fill({ color: 0x80caff, alpha: .45 })
      .poly([-15,-18,15,-18,27,35,-27,35]).fill({ color: 0x80caff, alpha: .35 });
    silhouette.position.set(x,y + 35); parent.addChild(silhouette);
    motion.run(() => gsap.to(silhouette, { x: x + (motion.reduced ? 0 : 60), alpha: 0, duration: .6, onComplete: () => { if (!silhouette.destroyed) silhouette.destroy(); } }));
  }
  if (event.drAbsorbed) {
    const shield = new Text({ text: `⛨ DR ${event.drAbsorbed}`, style: { fontFamily: 'sans-serif', fontSize: 16, fill: 0xcbd7ec, stroke: { color: 0x17101e, width: 3 } } });
    shield.anchor.set(.5); shield.position.set(x, y + 30); parent.addChild(shield);
    motion.run(() => gsap.to(shield, { alpha: 0, y: y + (motion.reduced ? 30 : 5), duration: 1.3, onComplete: () => { if (!shield.destroyed) shield.destroy(); } }));
  }
}
