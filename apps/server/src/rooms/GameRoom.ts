import { Room, ServerError, type AuthContext, type Client } from "@colyseus/core";
import { ApprovalDecisionPayloadSchema, JoinRequestPayloadSchema, MasterAuthPayloadSchema, PlayerSchema, RoomState, type PlayerRole, type SessionCredentialsPayload } from "@df/shared";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { openDatabase } from "../db/index.js";
import { ensureActiveSession } from "../db/session.js";
import { players, rooms } from "../db/schema.js";
import { maskIp, signSessionToken, validateSessionToken, verifyPassword } from "./handlers/auth.js";

type Database = ReturnType<typeof openDatabase>;
export interface RoomServices { database: Database; tokenSecret: string; bootstrapKey: string }
interface Identity { playerId: string; name: string; role: PlayerRole; sessionToken: string }

export class GameRoom extends Room<{ state: RoomState }> {
  private roomRecord!: typeof rooms.$inferSelect;
  private bindings = new Map<string, string>();
  private ips = new Map<string, string>();
  private heartbeats = new Map<string, number>();
  private authAttempts = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly services: RoomServices) { super(); }

  onCreate(options: { bootstrapKey?: string; roomCode?: string }) {
    if (options.bootstrapKey !== this.services.bootstrapKey) throw new ServerError(403, "Apenas o host pode criar salas.");
    const record = this.services.database.db.select().from(rooms).where(eq(rooms.code, options.roomCode ?? "")).get();
    if (!record) throw new ServerError(404, "Sala não encontrada.");
    this.roomRecord = record;
    ensureActiveSession(this.services.database, record.id);
    this.roomId = record.code;
    this.autoDispose = false;
    this.maxClients = 32;
    this.setState(new RoomState());
    this.state.roomCode = record.code;
    this.state.sessionStatus = record.status;
    for (const saved of this.services.database.db.select().from(players).where(eq(players.roomId, record.id)).all()) {
      const player = new PlayerSchema();
      Object.assign(player, { id: saved.id, name: saved.name, role: saved.id === record.id ? "MASTER" : "PLAYER", status: saved.approvalStatus === "APPROVED" && saved.id !== record.id ? "NEEDS_CHARACTER_CREATION" : saved.approvalStatus, connected: false });
      this.state.players.set(player.id, player);
    }
    this.onMessage("APPROVE_PLAYER", (client, input) => this.decide(client, input, true));
    this.onMessage("REJECT_PLAYER", (client, input) => this.decide(client, input, false));
    this.onMessage("PING", (client, timestamp) => {
      if (typeof timestamp === "number" && Number.isFinite(timestamp)) client.send("PONG", timestamp);
    });
    this.onMessage("PONG", (client, timestamp) => {
      const sent = this.heartbeats.get(client.sessionId);
      if (sent === undefined || sent !== timestamp) return;
      this.heartbeats.delete(client.sessionId);
      const rtt = Date.now() - sent;
      this.log("heartbeat", client, rtt);
      this.services.database.db.update(players).set({ lastSeenAt: Date.now() }).where(eq(players.id, this.bindings.get(client.sessionId)!)).run();
    });
    this.setSimulationInterval(() => {
      for (const client of this.clients) {
        const timestamp = Date.now();
        this.heartbeats.set(client.sessionId, timestamp);
        client.send("PING", timestamp);
      }
    }, 20_000);
  }

  onAuth(client: Client, input: unknown, context: AuthContext): Identity {
    const address = context.ip ?? "unknown";
    const now = Date.now();
    for (const [ip, window] of this.authAttempts) if (window.resetAt <= now) this.authAttempts.delete(ip);
    const window = this.authAttempts.get(address) ?? { count: 0, resetAt: now + 60_000 };
    if (++window.count > 30) throw new ServerError(429, "Muitas tentativas. Aguarde um minuto.");
    this.authAttempts.set(address, window);
    const identity = this.authenticate(input);
    this.ips.set(client.sessionId, maskIp(address));
    return identity;
  }

  private authenticate(input: unknown): Identity {
    const { db } = this.services.database;
    if (typeof input === "object" && input !== null && "password" in input) {
      const parsed = MasterAuthPayloadSchema.safeParse(input);
      if (!parsed.success || !verifyPassword(parsed.data.password, this.roomRecord.masterPasswordHash)) throw new ServerError(403, "Senha do Mestre ou versão inválida.");
      return this.identity(this.roomRecord.id, "Mestre", "MASTER");
    }
    const parsed = JoinRequestPayloadSchema.safeParse(input);
    if (!parsed.success) throw new ServerError(400, "Nome ou versão inválida. Atualize a página e tente novamente.");
    if (parsed.data.sessionToken) {
      const token = validateSessionToken(parsed.data.sessionToken, this.services.tokenSecret);
      const saved = token && token.roomId === this.roomRecord.id ? db.select().from(players).where(and(eq(players.id, token.playerId), eq(players.sessionToken, parsed.data.sessionToken), eq(players.roomId, this.roomRecord.id))).get() : undefined;
      if (!saved || saved.approvalStatus === "REJECTED") throw new ServerError(403, "Sessão inválida ou recusada.");
      return { playerId: saved.id, name: saved.name, role: token!.role, sessionToken: saved.sessionToken };
    }
    if (parsed.data.name.toLocaleLowerCase("pt-BR") === "mestre") throw new ServerError(409, "Esse nome é reservado ao Mestre.");
    if (Array.from(this.state.players.values()).some(player => player.name.toLocaleLowerCase("pt-BR") === parsed.data.name.toLocaleLowerCase("pt-BR"))) throw new ServerError(409, "Esse nome já está em uso nesta sala. Use a reconexão ou escolha outro nome.");
    return this.identity(randomUUID(), parsed.data.name, "PLAYER");
  }

  private identity(playerId: string, name: string, role: PlayerRole): Identity {
    return { playerId, name, role, sessionToken: signSessionToken({ playerId, roomId: this.roomRecord.id, role }, this.services.tokenSecret) };
  }

  onJoin(client: Client, _options: unknown, auth: Identity) {
    // Um único socket por identidade, inclusive durante a janela de reconexão.
    if (Array.from(this.bindings.values()).includes(auth.playerId)) throw new ServerError(409, "Este jogador já está conectado. Aguarde a reconexão.");
    const { db } = this.services.database;
    let player = this.state.players.get(auth.playerId);
    if (!player) {
      if (Array.from(this.state.players.values()).some(p => p.name.toLocaleLowerCase("pt-BR") === auth.name.toLocaleLowerCase("pt-BR"))) throw new ServerError(409, "Nome já está em uso.");
      player = new PlayerSchema();
      Object.assign(player, { id: auth.playerId, name: auth.name, role: auth.role, status: auth.role === "MASTER" ? "APPROVED" : "PENDING_APPROVAL" });
      db.insert(players).values({ id: player.id, roomId: this.roomRecord.id, name: player.name, sessionToken: auth.sessionToken, approvalStatus: player.status }).run();
      this.state.players.set(player.id, player);
    }
    this.bindings.set(client.sessionId, player.id);
    player.connected = true;
    db.update(players).set({ sessionToken: auth.sessionToken, reconnectionToken: `${this.roomId}:${client.reconnectionToken}`, lastSeenAt: Date.now() }).where(eq(players.id, player.id)).run();
    this.credentials(client, auth.sessionToken, player);
    this.log("join", client);
  }

  private credentials(client: Client, sessionToken?: string, player = this.state.players.get(this.bindings.get(client.sessionId)!)) {
    if (!player) return;
    const saved = this.services.database.db.select().from(players).where(eq(players.id, player.id)).get()!;
    const credentials: SessionCredentialsPayload = { playerId: player.id, playerName: player.name, role: player.role, sessionToken: sessionToken ?? saved.sessionToken, reconnectionToken: `${this.roomId}:${client.reconnectionToken}`, roomCode: this.roomId };
    client.send("SESSION_CREDENTIALS", credentials);
  }

  private decide(client: Client, input: unknown, approve: boolean) {
    const master = this.state.players.get(this.bindings.get(client.sessionId)!);
    const parsed = ApprovalDecisionPayloadSchema.safeParse(input);
    if (master?.role !== "MASTER" || !parsed.success) { client.send("ACTION_ERROR", "Ação não autorizada ou inválida."); return; }
    const player = this.state.players.get(parsed.data.targetPlayerId);
    if (!player || player.role !== "PLAYER" || player.status !== "PENDING_APPROVAL") { client.send("ACTION_ERROR", "O pedido não está mais pendente."); return; }
    const status = approve ? "NEEDS_CHARACTER_CREATION" : "REJECTED";
    // A autorização persistida é distinta da etapa de criação de ficha no estado de rede.
    const sessionToken = approve ? signSessionToken({ playerId: player.id, roomId: this.roomRecord.id, role: "PLAYER" }, this.services.tokenSecret) : undefined;
    this.services.database.db.transaction(db => {
      db.update(players).set({ approvalStatus: approve ? "APPROVED" : "REJECTED", ...(sessionToken ? { sessionToken } : {}), lastSeenAt: Date.now() }).where(eq(players.id, player.id)).run();
    });
    player.status = status;
    for (const target of this.clients) if (this.bindings.get(target.sessionId) === player.id) {
      target.send("APPROVAL_RESULT", status);
      if (approve) this.credentials(target);
    }
    this.log(approve ? "approve" : "reject", client);
  }

  async onDrop(client: Client) {
    const player = this.state.players.get(this.bindings.get(client.sessionId)!);
    if (player) player.connected = false;
    this.log("drop", client);
    try { await this.allowReconnection(client, 60); } catch { /* onLeave faz a limpeza definitiva */ }
  }
  onReconnect(client: Client) {
    const player = this.state.players.get(this.bindings.get(client.sessionId)!);
    if (!player) return;
    player.connected = true;
    this.services.database.db.update(players).set({ reconnectionToken: `${this.roomId}:${client.reconnectionToken}`, lastSeenAt: Date.now() }).where(eq(players.id, player.id)).run();
    this.credentials(client);
    this.log("reconnect", client);
  }
  onLeave(client: Client) {
    const id = this.bindings.get(client.sessionId);
    const player = id && this.state.players.get(id);
    if (player) {
      player.connected = false;
      this.services.database.db.update(players).set({ reconnectionToken: null, lastSeenAt: Date.now() }).where(eq(players.id, player.id)).run();
      // Cancelar a espera libera o nome para uma nova tentativa.
      if (player.status === "PENDING_APPROVAL") {
        this.services.database.db.delete(players).where(eq(players.id, player.id)).run();
        this.state.players.delete(player.id);
      }
    }
    this.log("leave", client);
    this.bindings.delete(client.sessionId);
    this.ips.delete(client.sessionId);
    this.heartbeats.delete(client.sessionId);
  }
  private log(event: string, client: Client, rttMs?: number) {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, roomCode: this.roomId, ip: this.ips.get(client.sessionId) ?? "unknown", rttMs: rttMs ?? null }));
  }
}

export function gameRoomClass(services: RoomServices) {
  return class HostedGameRoom extends GameRoom { constructor() { super(services); } };
}
