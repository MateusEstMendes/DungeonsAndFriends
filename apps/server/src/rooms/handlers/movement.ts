import { eq } from "drizzle-orm";
import { RequestMoveSchema, MasterMoveSchema, findHexPath, getHexKey, getHexEdgeKey, hexDistance, isCharacterPresent, type Hex, type PlayerSchema, type RoomState } from "@df/shared";
import type { Database } from "../../services/boardRepository.js";
import { characters, placedObjects } from "../../db/schema.js";
export class MovementHandler {
  constructor(private readonly state: RoomState, private readonly database: Database, private readonly refresh: () => void) {}
  isWalkable(chamberId: string, hex: Hex) {
    const cell = this.state.chambers.get(chamberId)?.cells.get(getHexKey(hex.q, hex.r));
    return !!cell && cell !== "DEEP_WATER" && cell !== "OBSTACLE";
  }
  occupied(chamberId: string, hex: Hex, exceptId = "") {
    return [...this.state.players.values(), ...this.state.monsters.values()].some(p => p.id !== exceptId && p.currentChamberId === chamberId && p.q === hex.q && p.r === hex.r && (!("status" in p) || isCharacterPresent(p)));
  }
  persist(player: PlayerSchema) {
    this.database.db.update(characters).set({ currentChamberId: player.currentChamberId, posQ: player.q, posR: player.r, moveCooldownEndsAt: player.moveCooldownEndsAt, remainingSteps: player.remainingSteps }).where(eq(characters.id, player.characterId)).run();
  }
  spawn(player: PlayerSchema) {
    const chamber = this.state.chambers.get(player.currentChamberId) ?? [...this.state.chambers.values()].find(c => c.mapId === this.state.activeStageId);
    player.awaitingPosition = true;
    if (!chamber) return false;
    const center = player.currentChamberId === chamber.id ? { q: player.q, r: player.r } : { q: chamber.spawnQ, r: chamber.spawnR };
    const cells = [...chamber.cells.keys()].map(key => { const [q, r] = key.split(',').map(Number); return { q, r }; })
      .sort((a, b) => hexDistance(center, a) - hexDistance(center, b) || a.q - b.q || a.r - b.r);
    for (const h of cells) {
      if (!this.isWalkable(chamber.id, h) || this.occupied(chamber.id, h, player.id)) continue;
      player.currentChamberId = chamber.id; player.q = h.q; player.r = h.r;
      if (player.remainingSteps < 0) player.remainingSteps = player.speed;
      this.persist(player); player.awaitingPosition = false; return true;
    }
    return false;
  }
  request(player: PlayerSchema, input: unknown, now = Date.now()) {
    const data = RequestMoveSchema.parse(input);
    if (player.role !== "PLAYER" || !isCharacterPresent(player)) throw new Error("O personagem precisa estar presente no tabuleiro para mover.");
    if (data.revision !== player.moveRevision) throw new Error("A posição foi alterada pelo Mestre. Escolha o destino novamente.");
    if (player.moveCooldownEndsAt > now) throw new Error("Aguarde o intervalo de movimento.");
    const chamber = this.state.chambers.get(player.currentChamberId)!;
    const goal = { q: data.targetQ, r: data.targetR };
    if (goal.q === player.q && goal.r === player.r) return;
    const budget = player.remainingSteps > 0 ? player.remainingSteps : player.speed;
    const path = findHexPath(player, goal, h => this.isWalkable(chamber.id, h) && !this.occupied(chamber.id, h, player.id),
      h => chamber.cells.get(getHexKey(h.q, h.r)) === "WATER" ? 2 : 1,
      { canCross: (a, b) => !chamber.walls.has(getHexEdgeKey(a, b)), maxCost: this.state.explorationMode === "DUNGEON_TENSE_30S" ? budget : Infinity });
    if (!path) throw new Error("Destino ocupado, bloqueado ou fora do alcance.");
    // Resolve the first portal crossed, never jump over an intermediate portal.
    let chamberId = chamber.id, destination = goal, cost = 0;
    for (const h of path.slice(1)) {
      cost += chamber.cells.get(getHexKey(h.q, h.r)) === "WATER" ? 2 : 1;
      const portal = chamber.portals.find(p => p.fromQ === h.q && p.fromR === h.r);
      if (portal) {
        chamberId = portal.targetChamberId; destination = { q: portal.toQ, r: portal.toR };
        if (!this.isWalkable(chamberId, destination) || this.occupied(chamberId, destination, player.id)) throw new Error("A saída do portal está ocupada ou bloqueada.");
        break;
      }
    }
    const remainingSteps = this.state.explorationMode === "DUNGEON_TENSE_30S" ? budget - cost : player.speed;
    const cooldown = this.state.explorationMode === "FREE_EXPLORATION" ? now + 1000 : remainingSteps === 0 ? now + 30_000 : 0;
    // Synchronous SQLite + state mutation reserve the destination in arrival order (FCFS).
    this.database.db.update(characters).set({ currentChamberId: chamberId, posQ: destination.q, posR: destination.r, remainingSteps, moveCooldownEndsAt: cooldown }).where(eq(characters.id, player.characterId)).run();
    Object.assign(player, { currentChamberId: chamberId, ...destination, remainingSteps, moveCooldownEndsAt: cooldown });
    this.refresh();
  }
  endTurn(player: PlayerSchema, now = Date.now()) {
    if (player.role !== "PLAYER" || !isCharacterPresent(player)) throw new Error("Ação indisponível.");
    if (player.moveCooldownEndsAt > now) return;
    const cooldown = now + (this.state.explorationMode === "DUNGEON_TENSE_30S" ? 30_000 : 1000);
    this.database.db.update(characters).set({ remainingSteps: 0, moveCooldownEndsAt: cooldown }).where(eq(characters.id, player.characterId)).run();
    player.remainingSteps = 0; player.moveCooldownEndsAt = cooldown;
  }
  masterMove(input: unknown) {
    const data = MasterMoveSchema.parse(input);
    const entity = this.state.players.get(data.entityId) ?? this.state.monsters.get(data.entityId) ?? this.state.objects.get(data.entityId);
    if (!entity || !this.isWalkable(data.chamberId, data)) throw new Error("Entidade ou destino inválido.");
    if (!this.state.objects.has(entity.id) && this.occupied(data.chamberId, data, entity.id)) throw new Error("Destino ocupado.");
    if ("status" in entity) {
      if (entity.status !== "READY" || !entity.connected) throw new Error("O jogador precisa estar conectado e aprovado.");
      this.database.db.update(characters).set({ currentChamberId: data.chamberId, posQ: data.q, posR: data.r }).where(eq(characters.id, entity.characterId)).run();
      entity.moveRevision++;
      entity.awaitingPosition = false;
    } else this.database.db.update(placedObjects).set({ chamberId: data.chamberId, q: data.q, r: data.r }).where(eq(placedObjects.id, entity.id)).run();
    Object.assign(entity, { currentChamberId: data.chamberId, q: data.q, r: data.r });
    this.refresh();
  }
}
