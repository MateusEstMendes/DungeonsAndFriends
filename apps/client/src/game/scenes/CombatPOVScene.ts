import { Assets, Container, Graphics, Sprite, Text, type Application, type Texture } from 'pixi.js';
import { getMonsterDefinition } from '@df/shared';
import { gsap } from 'gsap';
import { useCombatStore } from '../../store/useCombatStore';
import { useGameStore } from '../../store/useGameStore';
import { BoardMotion } from '../motion';
import { drawBiome, monsterArt } from './combatArt';
import { combatEffects } from '../vfx/combatEffects';
import { floatingText } from '../vfx/floatingText';
import { diceAnimation } from '../vfx/diceAnimation';

interface MonsterPlate { root: Container; sprite: Sprite; label: Text; hp: Graphics; reticle: Graphics; texture: Texture; ownsTexture: boolean }
export class CombatPOVScene {
  readonly root = new Container();
  private background = new Graphics();
  private actors = new Container();
  private effects = new Container();
  private dice = new Container();
  private motion = new BoardMotion();
  private effectsMotion = new BoardMotion();
  private lifecycle = new AbortController();
  private plates = new Map<string, MonsterPlate>();
  private seen = new Set<string>();
  private unsubscribe: () => void;
  private resize: ResizeObserver;
  private biomeKey = '';
  private disposed = false;
  constructor(private app: Application, host: HTMLElement) {
    app.stage.addChild(this.root); this.root.addChild(this.background, this.actors, this.effects, this.dice);
    app.canvas.setAttribute('aria-label', 'Arena de combate em perspectiva frontal. Use os controles de batalha para escolher sua ação e alvo.');
    this.unsubscribe = useCombatStore.subscribe(() => this.render());
    document.addEventListener('visibilitychange', () => {
      this.effectsMotion.destroy(); this.effectsMotion = new BoardMotion();
      for (const container of [this.effects, this.dice]) for (const child of container.removeChildren()) child.destroy({ children: true });
      this.root.x = 0;
    }, { signal: this.lifecycle.signal });
    this.resize = new ResizeObserver(() => { app.resize(); this.render(); }); this.resize.observe(host);
    this.render();
    this.motion.run(() => gsap.from(this.root, { alpha: 0, duration: this.motion.reduced ? 0 : .65 }));
  }
  private render() {
    const { combat, participants, targetId, events } = useCombatStore.getState();
    const w = this.app.screen.width, h = this.app.screen.height;
    const key = `${combat.biome}:${w}:${h}`;
    if (key !== this.biomeKey) { drawBiome(this.background, combat.biome, w, h); this.biomeKey = key; }
    const monsters = participants.filter(p => p.kind === 'MONSTER');
    for (const [id, plate] of this.plates) if (!monsters.some(p => p.id === id)) {
      plate.root.destroy({ children: true }); if (plate.ownsTexture) plate.texture.destroy(true); this.plates.delete(id);
    }
    monsters.forEach((monster, index) => {
      let plate = this.plates.get(monster.id);
      if (!plate) {
        const root = new Container(), art = monsterArt(monster.name), texture = this.app.renderer.generateTexture(art); art.destroy();
        const sprite = new Sprite(texture); sprite.anchor.set(.5, 1);
        const hp = new Graphics(), reticle = new Graphics();
        const label = new Text({ text: '', style: { fontFamily: 'Georgia', fontSize: 14, fill: 0xf4e3bf, align: 'center', stroke: { color: 0x100c18, width: 3 } } }); label.anchor.set(.5);
        root.addChild(sprite, reticle, hp, label); this.actors.addChild(root);
        root.eventMode = 'static'; root.cursor = 'pointer'; root.on('pointertap', () => {
          useCombatStore.setState({ targetId: monster.id, ...(useGameStore.getState().role === 'MASTER' ? { manualMonsterId: monster.id } : {}) });
        });
        plate = { root, sprite, hp, reticle, label, texture, ownsTexture: true }; this.plates.set(monster.id, plate);
        const definition = getMonsterDefinition(monster.name);
        if (definition) void this.loadMonsterImage(monster.id, plate, definition.imageUrl);
      }
      const maxScale = Math.min(w < 700 ? 1.2 : 1.5, h / 470);
      const slotWidth = Math.min(280 * maxScale, w * .86 / Math.max(1, monsters.length));
      plate.root.position.set(w / 2 + (index - (monsters.length - 1) / 2) * slotWidth, h * (w < 700 ? .68 : .64));
      plate.root.scale.set(Math.min(maxScale, slotWidth / 250));
      plate.root.alpha = monster.hp > 0 ? 1 : .25;
      plate.label.text = `${monster.name}\n${monster.hp}/${monster.maxHp} HP${monster.stance ? '\n' + (monster.stance === 'ACTIVE_DODGE' ? 'Esquiva preparada' : 'Bloqueio') : ''}`;
      plate.label.position.set(0, -255);
      plate.hp.clear().roundRect(-48,-229,96,6,3).fill(0x24202d).roundRect(-48,-229,96 * Math.max(0, monster.hp / monster.maxHp),6,3).fill(monster.hp / monster.maxHp < .3 ? 0xd66b52 : 0x83ac80);
      plate.reticle.clear();
      if (targetId === monster.id || useCombatStore.getState().manualMonsterId === monster.id) {
        plate.reticle.circle(0,-115,65).stroke({ color: 0xe8c477, width: 2, alpha: .8 });
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; plate.reticle.moveTo(Math.cos(a) * 55, -115 + Math.sin(a) * 55).lineTo(Math.cos(a) * 78, -115 + Math.sin(a) * 78).stroke({ color: 0xffe3a1, width: 3 }); }
      }
    });
    this.dice.position.set(w * (w < 700 ? .5 : .70), Math.max(120, h * .18));
    for (const event of events) {
      if (this.seen.has(event.id) || event.encounterId !== combat.encounterId) continue;
      this.seen.add(event.id);
      if (document.hidden) continue;
      const elapsed = Math.max(0, (Date.now() + useCombatStore.getState().serverClockOffset - event.startedAt) / 1000);
      if (elapsed > 3) continue;
      const plate = this.plates.get(event.targetId), point = plate ? { x: plate.root.x, y: plate.root.y - 100 * plate.root.scale.y } : { x: w / 2, y: h * .73 };
      diceAnimation(this.dice, event.rolls, this.effectsMotion, elapsed);
      this.effectsMotion.run(() => {
        gsap.delayedCall(this.effectsMotion.reduced ? 0 : Math.max(0, .55 - elapsed), () => {
          if (event.vfxType && !event.outcome?.startsWith('DODGED')) combatEffects(this.effects, event.vfxType, point.x, point.y, this.effectsMotion);
          floatingText(this.effects, this.root, event, point.x, point.y - 30, this.effectsMotion, plate?.sprite);
        });
      });
    }
  }
  private async loadMonsterImage(id: string, plate: MonsterPlate, url: string) {
    try {
      const texture = await Assets.load<Texture>(url);
      if (this.disposed || this.plates.get(id) !== plate) return;
      const fallback = plate.texture;
      plate.sprite.texture = texture;
      // Preserve the complete silhouette and aspect ratio, including wings and weapons.
      plate.sprite.scale.set(Math.min(220 / texture.width, 220 / texture.height));
      plate.texture = texture; plate.ownsTexture = false;
      fallback.destroy(true);
    } catch { /* The procedural plate remains usable if the image is unavailable. */ }
  }
  destroy() {
    this.disposed = true;
    this.unsubscribe(); this.resize.disconnect(); this.lifecycle.abort(); this.effectsMotion.destroy(); this.motion.destroy();
    this.root.destroy({ children: true }); for (const p of this.plates.values()) if (p.ownsTexture) p.texture.destroy(true); this.plates.clear();
  }
}
