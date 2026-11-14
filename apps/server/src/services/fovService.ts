import { StateView, type Schema } from "@colyseus/schema";
import type { Client } from "@colyseus/core";
import { computeHexFOV, getHexEdgeKey, getHexKey, type RoomState } from "@df/shared";
/** Reconciles membership before every patch; hidden entities never enter a player view. */
export class FovService {
  private membership = new WeakMap<Client, Set<Schema>>();
  constructor(private readonly state: RoomState) {}
  refresh(clients: readonly Client[], playerId: (client: Client) => string | undefined) {
    const vision = new Map<string, Set<string>>();
    for (const p of this.state.players.values()) {
      if (p.role !== "PLAYER" || p.status !== "READY" || !p.connected) continue;
      const chamber = this.state.chambers.get(p.currentChamberId);
      if (!chamber) continue;
      const shared = vision.get(chamber.id) ?? new Set<string>();
      const visible = computeHexFOV(p, 4, h => !chamber.cells.has(getHexKey(h.q, h.r)) || chamber.cells.get(getHexKey(h.q, h.r)) === "OBSTACLE",
        (a, b) => chamber.walls.has(getHexEdgeKey(a, b)));
      for (const cell of visible) if (chamber.cells.has(cell)) shared.add(cell);
      vision.set(chamber.id, shared);
    }
    for (const client of clients) {
      const own = this.state.players.get(playerId(client) ?? "");
      if (!client.view) client.view = new StateView();
      const next = new Set<Schema>();
      const combat = this.state.combatState;
      if (own?.role === 'MASTER' || (own?.status === 'READY' && own.currentChamberId === combat.chamberId)) next.add(combat);
      const visible = (entity: { id: string; currentChamberId: string; q: number; r: number; isHiddenByMaster: boolean }) =>
        own?.role === "MASTER" || (own?.status === "READY" && entity.currentChamberId === own.currentChamberId && !entity.isHiddenByMaster
          && ((combat.active && combat.chamberId === own.currentChamberId && combat.turnOrder.includes(entity.id)) || vision.get(own.currentChamberId)?.has(getHexKey(entity.q, entity.r))));
      for (const p of this.state.players.values()) {
        // Lobby identities are available while assembling the party; READY tokens are culled.
        if (p === own || own?.role === "MASTER" || (p.status !== "READY" && own?.status !== "READY") || (p.status === "READY" && visible(p))) next.add(p);
      }
      for (const entity of [...this.state.monsters.values(), ...this.state.objects.values()]) if (visible(entity)) next.add(entity);
      const previous = this.membership.get(client) ?? new Set<Schema>();
      for (const entity of previous) if (!next.has(entity)) client.view.remove(entity);
      for (const entity of next) if (!previous.has(entity)) client.view.add(entity);
      this.membership.set(client, next);
      // Vision contains floor coordinates only, never hidden object identifiers.
      const cells = own?.role === "MASTER" ? [] : [...(vision.get(own?.currentChamberId ?? "") ?? [])].sort();
      const payload = { chamberId: own?.currentChamberId ?? "", cells };
      const signature = JSON.stringify(payload);
      if (this.lastVision.get(client) !== signature) { client.send("ACTIVE_VISION", payload); this.lastVision.set(client, signature); }
    }
  }
  private lastVision = new WeakMap<Client, string>();
}
