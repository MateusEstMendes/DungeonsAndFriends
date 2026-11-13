import { Container, Graphics, type Application } from "pixi.js";
import { gsap } from "gsap";
import { findHexPath, getHexEdgeKey, getHexKey, hexToPixel, pixelToHex, type Hex } from "@df/shared";
import { useGameStore } from "../../store/useGameStore";
import { useBoardStore, type BoardChamber, type BoardEntity } from "../../store/useBoardStore";
import { boardCommand } from "../../network/colyseusClient";
import { BoardMotion } from "../motion";
import { TerrainLayer } from "../layers/TerrainLayer";
import { WallLayer } from "../layers/WallLayer";
import { ObjectLayer } from "../layers/ObjectLayer";
import { EntityLayer } from "../layers/EntityLayer";
import { FogOfWarLayer } from "../layers/FogOfWarLayer";
interface ChamberLayers { root: Container; terrain: TerrainLayer; walls: WallLayer; objects: ObjectLayer; entities: EntityLayer; fog: FogOfWarLayer; debug: Graphics; signature: string; objectsSignature: string; entitiesSignature: string; fogSignature: string }
export class BoardScene {
  readonly viewport = new Container();
  private motion = new BoardMotion();
  private layers = new Map<string, ChamberLayers>();
  private events = new AbortController();
  private unsubscribers: (() => void)[] = [];
  private cameraKey = "";
  private pointers = new Map<number, { x: number; y: number }>();
  private press?: { x: number; y: number; moved: boolean; entity?: BoardEntity; chamberId: string };
  private velocity = { x: 0, y: 0 };
  private pinchDistance = 0;
  private cameraTween?: gsap.core.Tween;
  private pulse?: gsap.core.Tween;
  private resize: ResizeObserver;
  constructor(private readonly app: Application, private readonly host: HTMLElement) {
    app.stage.addChild(this.viewport);
    this.viewport.position.set(app.screen.width / 2, app.screen.height / 2);
    this.unsubscribers = [useBoardStore.subscribe(() => this.render()), useGameStore.subscribe(() => this.render())];
    this.resize = new ResizeObserver(() => { this.app.resize(); this.cameraKey = ""; this.render(); }); this.resize.observe(host);
    const canvas = app.canvas, options = { signal: this.events.signal };
    canvas.addEventListener("pointerdown", this.pointerDown, options);
    canvas.addEventListener("pointermove", this.pointerMove, options);
    canvas.addEventListener("pointerup", this.pointerUp, options);
    canvas.addEventListener("pointercancel", this.pointerCancel, options);
    canvas.addEventListener("wheel", this.wheel, { ...options, passive: false });
    window.addEventListener("keydown", this.keyDown, options);
    this.render();
  }
  private get currentChamberId() {
    const game = useGameStore.getState(), board = useBoardStore.getState();
    return game.role === "MASTER" ? board.focusChamberId || board.chambers.find(c => c.mapId === board.activeStageId)?.id || "" : game.players.find(p => p.id === game.playerId)?.currentChamberId ?? "";
  }
  private render() {
    const board = useBoardStore.getState(), game = useGameStore.getState(), master = game.role === "MASTER";
    const displayed = board.chambers.filter(c => master && board.macro ? c.mapId === board.activeStageId : c.id === this.currentChamberId);
    for (const [id, layer] of this.layers) if (!displayed.some(c => c.id === id)) {
      this.pulse?.kill(); this.pulse = undefined;
      layer.entities.dispose(); layer.fog.dispose(); layer.root.destroy({ children: true }); this.layers.delete(id);
    }
    for (const chamber of displayed) {
      let layer = this.layers.get(chamber.id);
      if (!layer) {
        const root = new Container(), terrain = new TerrainLayer(), walls = new WallLayer(), objects = new ObjectLayer(), entities = new EntityLayer(this.motion), fog = new FogOfWarLayer(), debug = new Graphics();
        root.addChild(terrain, walls, objects, entities, fog, debug); this.viewport.addChild(root);
        layer = { root, terrain, walls, objects, entities, fog, debug, signature: "", objectsSignature: "", entitiesSignature: "", fogSignature: "" }; this.layers.set(chamber.id, layer);
      }
      layer.root.position.set(chamber.offsetX, chamber.offsetY);
      const signature = JSON.stringify([chamber, board.debug]);
      if (signature !== layer.signature) { layer.terrain.renderChamber(chamber, board.debug); layer.walls.renderChamber(chamber); layer.signature = signature; }
      const objects = board.objects.filter(o => o.currentChamberId === chamber.id), objectsSignature = JSON.stringify(objects);
      if (objectsSignature !== layer.objectsSignature) { layer.objects.update(objects); layer.objectsSignature = objectsSignature; }
      const players = game.players.filter(p => p.status === "READY").map(p => ({ ...p, name: p.characterName || p.name }));
      const entities = [...players, ...board.monsters].filter(e => e.currentChamberId === chamber.id), entitiesSignature = JSON.stringify([entities, board.selectedEntityId]);
      if (entitiesSignature !== layer.entitiesSignature) { layer.entities.update(entities, chamber, game.playerId, board.selectedEntityId); layer.entitiesSignature = entitiesSignature; }
      const active = new Set(board.visionChamberId === chamber.id ? board.activeVision : []);
      const fogSignature = JSON.stringify([Object.keys(chamber.cells), [...active], master]);
      if (fogSignature !== layer.fogSignature) { layer.fog.update(this.app.renderer, chamber, active, master); layer.fogSignature = fogSignature; }
      layer.debug.clear();
      if (board.debug) for (const p of players.filter(p => p.currentChamberId === chamber.id)) {
        const point = hexToPixel(p.q, p.r); layer.debug.circle(point.x, point.y, 4 * 40 * Math.sqrt(3)).stroke({ color: 0xd9b66b, alpha: 0.35, width: 2 });
      }
    }
    const cameraKey = `${this.currentChamberId}:${board.macro}:${board.focusRevision}`;
    if (displayed.length && cameraKey !== this.cameraKey) {
      this.cameraKey = cameraKey;
      const c = displayed.find(c => c.id === this.currentChamberId) ?? displayed[0];
      const centerX = board.macro ? displayed.reduce((sum, item) => sum + item.offsetX, 0) / displayed.length : c.offsetX;
      const centerY = board.macro ? displayed.reduce((sum, item) => sum + item.offsetY, 0) / displayed.length : c.offsetY;
      const scale = board.macro ? Math.min(0.65, this.app.screen.width / (displayed.length * 850)) : Math.min(1, this.app.screen.width / 850, this.app.screen.height / 730);
      this.cameraTween?.kill();
      this.motion.run(() => {
        const duration = this.motion.reduced ? 0 : 0.6;
        gsap.to(this.viewport.scale, { x: scale, y: scale, duration, ease: "power2.inOut", overwrite: true });
        this.cameraTween = gsap.to(this.viewport, { x: this.app.screen.width / 2 - centerX * scale, y: this.app.screen.height / 2 - centerY * scale, duration, ease: "power2.inOut", overwrite: true });
      });
    }
  }
  private point(event: PointerEvent | WheelEvent) {
    const rect = this.app.canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  private pick(point: { x: number; y: number }): { chamber: BoardChamber; hex: Hex } | undefined {
    const local = this.viewport.toLocal(point), board = useBoardStore.getState();
    const candidates = board.chambers.filter(c => this.layers.has(c.id));
    for (const chamber of candidates) {
      const hex = pixelToHex(local.x - chamber.offsetX, local.y - chamber.offsetY);
      if (chamber.cells[getHexKey(hex.q, hex.r)]) return { chamber, hex };
    }
    const chamber = candidates.find(c => c.id === this.currentChamberId);
    return chamber ? { chamber, hex: pixelToHex(local.x - chamber.offsetX, local.y - chamber.offsetY) } : undefined;
  }
  private entitiesAt(chamberId: string, hex: Hex) {
    const board = useBoardStore.getState(), game = useGameStore.getState();
    return [...game.players.filter(p => p.status === "READY"), ...board.monsters, ...board.objects].filter(e => e.currentChamberId === chamberId && e.q === hex.q && e.r === hex.r);
  }
  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const p = this.point(event); this.pointers.set(event.pointerId, p); this.app.canvas.setPointerCapture(event.pointerId);
    this.cameraTween?.kill(); gsap.killTweensOf(this.viewport); gsap.killTweensOf(this.viewport.scale);
    const picked = this.pick(p), board = useBoardStore.getState();
    this.press = { ...p, moved: false, chamberId: picked?.chamber.id ?? "", entity: useGameStore.getState().role === "MASTER" && board.tool === "SELECT" && picked ? this.entitiesAt(picked.chamber.id, picked.hex)[0] : undefined };
    this.velocity = { x: 0, y: 0 };
    if (this.pointers.size > 1) { this.press.moved = true; this.press.entity = undefined; this.pinchDistance = this.fingerDistance(); }
  };
  private fingerDistance() { const [a, b] = [...this.pointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }
  private pointerMove = (event: PointerEvent) => {
    const p = this.point(event), previous = this.pointers.get(event.pointerId);
    if (!previous) { this.hover(p); return; }
    this.pointers.set(event.pointerId, p);
    if (this.pointers.size > 1) {
      const distance = this.fingerDistance(), [a, b] = [...this.pointers.values()];
      if (this.pinchDistance > 0) this.zoom(distance / this.pinchDistance, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      this.pinchDistance = distance; return;
    }
    if (this.press && Math.hypot(p.x - this.press.x, p.y - this.press.y) > 6) this.press.moved = true;
    if (this.press?.moved && !this.press.entity) {
      this.velocity = { x: p.x - previous.x, y: p.y - previous.y };
      this.viewport.x += this.velocity.x; this.viewport.y += this.velocity.y;
    }
  };
  private pointerUp = (event: PointerEvent) => {
    const p = this.point(event), press = this.press, wasPinching = this.pointers.size > 1;
    this.pointers.delete(event.pointerId);
    if (this.app.canvas.hasPointerCapture(event.pointerId)) this.app.canvas.releasePointerCapture(event.pointerId);
    if (wasPinching) { this.press = undefined; return; }
    this.press = undefined;
    if (!press) return;
    const picked = this.pick(p);
    if (press.entity && press.moved && picked) boardCommand("MASTER_MOVE_ENTITY", { entityId: press.entity.id, chamberId: picked.chamber.id, ...picked.hex });
    else if (!press.moved && picked) this.click(picked.chamber, picked.hex);
    else if (!this.motion.reduced) this.motion.run(() => { this.cameraTween = gsap.to(this.viewport, { x: this.viewport.x + this.velocity.x * 8, y: this.viewport.y + this.velocity.y * 8, duration: 0.45, ease: "power2.out", overwrite: true }); });
  };
  private pointerCancel = (event: PointerEvent) => { this.pointers.delete(event.pointerId); this.press = undefined; };
  private zoom(factor: number, anchor: { x: number; y: number }) {
    const local = this.viewport.toLocal(anchor), scale = Math.max(0.15, Math.min(2.8, this.viewport.scale.x * factor));
    this.viewport.scale.set(scale); this.viewport.position.set(anchor.x - local.x * scale, anchor.y - local.y * scale);
  }
  private wheel = (event: WheelEvent) => { event.preventDefault(); this.cameraTween?.kill(); gsap.killTweensOf(this.viewport.scale); this.zoom(Math.exp(-event.deltaY * 0.0015), this.point(event)); };
  private hover(point: { x: number; y: number }) {
    const game = useGameStore.getState(), picked = this.pick(point), own = game.players.find(p => p.id === game.playerId);
    if (!picked || game.role !== "PLAYER" || !own || own.currentChamberId !== picked.chamber.id) return;
    const chamber = picked.chamber, occupied = (h: Hex) => this.entitiesAt(chamber.id, h).some(e => e.id !== own.id && !("kind" in e));
    const board = useBoardStore.getState(), budget = own.remainingSteps > 0 ? own.remainingSteps : own.speed;
    const path = own.moveCooldownEndsAt > Date.now() ? null : findHexPath(own, picked.hex,
      h => !!chamber.cells[getHexKey(h.q, h.r)] && !["DEEP_WATER", "OBSTACLE"].includes(chamber.cells[getHexKey(h.q, h.r)]) && !occupied(h),
      h => chamber.cells[getHexKey(h.q, h.r)] === "WATER" ? 2 : 1,
      { canCross: (a, b) => !chamber.walls[getHexEdgeKey(a, b)], maxCost: board.explorationMode === "DUNGEON_TENSE_30S" ? budget : Infinity });
    const layer = this.layers.get(chamber.id)!; layer.terrain.highlight(path?.slice(1) ?? []);
    if (this.pulse) this.pulse.paused(!path?.length);
    if (path?.length && !this.pulse && !this.motion.reduced) this.motion.run(() => { this.pulse = gsap.to(layer.terrain.path, { alpha: 0.45, duration: 0.7, repeat: -1, yoyo: true, ease: "sine.inOut" }); });
  }
  private click(chamber: BoardChamber, hex: Hex) {
    const game = useGameStore.getState(), board = useBoardStore.getState();
    if (game.role === "PLAYER") {
      const own = game.players.find(p => p.id === game.playerId);
      if (own) boardCommand("REQUEST_MOVE", { targetQ: hex.q, targetR: hex.r, revision: own.moveRevision });
      this.layers.get(chamber.id)?.terrain.highlight([]); return;
    }
    const base = { chamberId: chamber.id, ...hex };
    if (board.tool === "SELECT") {
      const candidates = this.entitiesAt(chamber.id, hex);
      // Cycling is useful on touch; the HUD also exposes all overlapping objects.
      const index = candidates.findIndex(e => e.id === board.selectedEntityId);
      useBoardStore.setState({ selectedEntityId: candidates[(index + 1) % candidates.length]?.id ?? "" });
    } else if (board.tool === "TERRAIN") boardCommand("MASTER_EDIT", { ...base, layer: "TERRAIN", terrain: board.terrain });
    else if (board.tool === "WALL") boardCommand("MASTER_EDIT", { ...base, layer: "WALL", direction: board.wallDirection, erase: board.eraseWall });
    else if (board.tool === "OBJECT") boardCommand("MASTER_EDIT", { ...base, layer: "OBJECT", kind: board.objectKind, rotation: board.rotation, hidden: board.hidden });
    else boardCommand("MASTER_EDIT", { ...base, layer: "ENTITY", name: "Monstro", hidden: board.hidden });
  }
  private keyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const ctrl = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
    if (ctrl && event.shiftKey && key === "d") { event.preventDefault(); useBoardStore.setState(s => ({ debug: !s.debug })); }
    else if (ctrl && useGameStore.getState().role === "MASTER" && (key === "z" || key === "y")) { event.preventDefault(); boardCommand(key === "y" || event.shiftKey ? "MASTER_REDO" : "MASTER_UNDO"); }
  };
  destroy() {
    this.events.abort(); this.resize.disconnect(); this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.motion.destroy();
    for (const layer of this.layers.values()) { layer.entities.dispose(); layer.fog.dispose(); }
    this.viewport.destroy({ children: true });
  }
}
