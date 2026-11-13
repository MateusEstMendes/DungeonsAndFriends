import { and, asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { MasterEditSchema, MasterMoveSchema, RotateObjectSchema, EntityHiddenSchema, DeleteEntitySchema, ExplorationModeSchema, HEX_DIRECTIONS, getHexKey, getHexEdgeKey, type RoomState } from "@df/shared";
import { characters, editorHistory, rooms } from "../../db/schema.js";
import { readBoard, loadBoard, writeBoard, type BoardSnapshot, type Database } from "../../services/boardRepository.js";
import type { MovementHandler } from "./movement.js";
// Existing stacks can be reduced or moved apart without deleting saved objects.
// No command, including Undo/Redo, may grow a duplicate stack.
function assertObjectStacks(before: BoardSnapshot, after: BoardSnapshot) {
  const counts = (board: BoardSnapshot) => {
    const result = new Map<string, number>();
    for (const object of board.objects) if (object.kind !== "MONSTER") {
      const key = JSON.stringify([object.chamberId, object.q, object.r, object.kind]);
      result.set(key, (result.get(key) ?? 0) + 1);
    }
    return result;
  };
  const previous = counts(before);
  for (const [key, count] of counts(after)) if (count > 1 && count > (previous.get(key) ?? 0)) {
    throw new Error("Já existe um objeto desse tipo neste hexágono.");
  }
}
export class MasterHandler {
  constructor(private readonly state: RoomState, private readonly database: Database, private readonly roomId: string,
    private readonly movement: MovementHandler, private readonly refresh: () => void) {}
  private change(mutate: (data: BoardSnapshot) => void) {
    const before = readBoard(this.database), after = structuredClone(before);
    mutate(after);
    assertObjectStacks(before, after);
    // Undoing terrain/spawn edits must never entomb a character that moved since the edit.
    for (const p of this.state.players.values()) if (p.status === "READY") {
      const cell = after.cells.find(c => c.chamberId === p.currentChamberId && c.q === p.q && c.r === p.r);
      if (!cell || cell.terrain === "OBSTACLE" || cell.terrain === "DEEP_WATER") throw new Error("Há um personagem nessa célula.");
    }
    this.database.db.transaction(() => {
      writeBoard(this.database, after);
      this.database.db.delete(editorHistory).where(and(eq(editorHistory.roomId, this.roomId), eq(editorHistory.undone, true))).run();
      this.database.db.insert(editorHistory).values({ roomId: this.roomId, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) }).run();
    });
    loadBoard(this.state, after); this.refresh();
  }
  edit(input: unknown) {
    const data = MasterEditSchema.parse(input);
    this.change(board => {
      const chamber = board.chambers.find(c => c.id === data.chamberId);
      if (!chamber) throw new Error("Câmara inválida.");
      const key = getHexKey(data.q, data.r);
      if (data.layer === "TERRAIN") {
        const cell = board.cells.find(c => c.chamberId === chamber.id && c.q === data.q && c.r === data.r);
        if (["OBSTACLE", "DEEP_WATER"].includes(data.terrain) && (this.movement.occupied(chamber.id, data) || this.state.chambers.get(chamber.id)?.portals.some(p => p.fromQ === data.q && p.fromR === data.r))) throw new Error("A célula está ocupada ou contém um portal.");
        if (cell) cell.terrain = data.terrain;
        else board.cells.push({ id: `${chamber.id}:${key}`, chamberId: chamber.id, q: data.q, r: data.r, terrain: data.terrain });
        chamber.minQ = Math.min(chamber.minQ, data.q); chamber.maxQ = Math.max(chamber.maxQ, data.q);
        chamber.minR = Math.min(chamber.minR, data.r); chamber.maxR = Math.max(chamber.maxR, data.r);
      } else if (data.layer === "WALL") {
        const direction = HEX_DIRECTIONS[data.direction];
        const edgeKey = getHexEdgeKey(data, { q: data.q + direction.q, r: data.r + direction.r });
        board.walls = board.walls.filter(w => !(w.chamberId === chamber.id && w.edgeKey === edgeKey));
        if (!data.erase) board.walls.push({ id: `${chamber.id}:${edgeKey}`, chamberId: chamber.id, edgeKey });
      } else {
        if (!this.movement.isWalkable(chamber.id, data)) throw new Error("Pinte o chão antes de colocar objetos ou entidades.");
        if (data.layer === "ENTITY" && this.movement.occupied(chamber.id, data)) throw new Error("Destino ocupado.");
        board.objects.push({ id: randomUUID(), chamberId: chamber.id, kind: data.layer === "ENTITY" ? "MONSTER" : data.kind,
          name: data.layer === "ENTITY" ? data.name : ({ CHEST: "Baú", TABLE: "Mesa", CHAIR: "Cadeira", DOOR: "Porta", TORCH: "Tocha" }[data.kind]),
          q: data.q, r: data.r, rotation: data.layer === "OBJECT" ? data.rotation : 0, hidden: data.hidden });
      }
    });
  }
  hidden(input: unknown) {
    const data = EntityHiddenSchema.parse(input);
    this.change(board => {
      const entity = board.objects.find(e => e.id === data.entityId);
      if (!entity) throw new Error("Selecione um objeto ou monstro.");
      entity.hidden = data.hidden;
    });
  }
  move(input: unknown) {
    const data = MasterMoveSchema.parse(input);
    if (this.state.players.has(data.entityId)) { this.movement.masterMove(data); return; }
    this.change(board => {
      const entity = board.objects.find(e => e.id === data.entityId);
      if (!entity || !this.movement.isWalkable(data.chamberId, data)) throw new Error("Entidade ou destino inválido.");
      if (entity.kind === "MONSTER" && this.movement.occupied(data.chamberId, data, entity.id)) throw new Error("Destino ocupado.");
      Object.assign(entity, { chamberId: data.chamberId, q: data.q, r: data.r });
    });
  }
  rotate(input: unknown) {
    const data = RotateObjectSchema.parse(input);
    this.change(board => {
      const entity = board.objects.find(e => e.id === data.entityId && e.kind !== "MONSTER");
      if (!entity) throw new Error("Selecione um objeto.");
      entity.rotation = data.rotation;
    });
  }
  remove(input: unknown) {
    const data = DeleteEntitySchema.parse(input);
    this.change(board => {
      if (!board.objects.some(e => e.id === data.entityId)) throw new Error("Entidade inválida.");
      board.objects = board.objects.filter(e => e.id !== data.entityId);
    });
  }
  history(redo: boolean) {
    const { db } = this.database;
    const entry = db.select().from(editorHistory).where(and(eq(editorHistory.roomId, this.roomId), eq(editorHistory.undone, redo)))
      .orderBy(redo ? asc(editorHistory.id) : desc(editorHistory.id)).get();
    if (!entry) throw new Error(redo ? "Nada para refazer." : "Nada para desfazer.");
    const data: BoardSnapshot = JSON.parse(redo ? entry.afterJson : entry.beforeJson);
    assertObjectStacks(readBoard(this.database), data);
    for (const p of this.state.players.values()) if (p.status === "READY") {
      const cell = data.cells.find(c => c.chamberId === p.currentChamberId && c.q === p.q && c.r === p.r);
      const monster = data.objects.some(e => e.kind === "MONSTER" && e.chamberId === p.currentChamberId && e.q === p.q && e.r === p.r);
      if (!cell || ["OBSTACLE", "DEEP_WATER"].includes(cell.terrain) || monster) throw new Error("Mova o personagem antes de restaurar essa edição.");
    }
    db.transaction(() => { writeBoard(this.database, data); db.update(editorHistory).set({ undone: !redo }).where(eq(editorHistory.id, entry.id)).run(); });
    loadBoard(this.state, data); this.refresh();
  }
  mode(input: unknown) {
    const mode = ExplorationModeSchema.parse(input);
    if (mode === this.state.explorationMode) return;
    this.database.db.transaction(() => {
      this.database.db.update(rooms).set({ explorationMode: mode }).where(eq(rooms.id, this.roomId)).run();
      for (const p of this.state.players.values()) if (p.status === "READY") this.database.db.update(characters)
        .set({ remainingSteps: p.speed, moveCooldownEndsAt: 0 }).where(eq(characters.id, p.characterId)).run();
    });
    for (const p of this.state.players.values()) if (p.status === "READY") { p.remainingSteps = p.speed; p.moveCooldownEndsAt = 0; }
    this.state.explorationMode = mode;
  }
  stage(input: unknown) {
    if (typeof input !== "string" || ![...this.state.chambers.values()].some(c => c.mapId === input)) throw new Error("Fase inválida.");
    this.database.db.update(rooms).set({ activeStageId: input }).where(eq(rooms.id, this.roomId)).run();
    this.state.activeStageId = input;
  }
}
