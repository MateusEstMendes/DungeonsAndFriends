import { Room, ServerError, type AuthContext, type Client } from "@colyseus/core";
import { ApprovalDecisionPayloadSchema, JoinRequestPayloadSchema, MasterAuthPayloadSchema, MasterMoveSchema, isCharacterPresent, PlayerSchema, RoomState, type PlayerRole, type SessionCredentialsPayload } from "@df/shared";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { openDatabase } from "../db/index.js";
import { ensureActiveSession } from "../db/session.js";
import { characters, players, rooms } from "../db/schema.js";
import { prepareCharacter, maskIp, signSessionToken, validateSessionToken, verifyPassword } from "./handlers/auth.js";
import { StateView } from "@colyseus/schema";
import { FovService } from "../services/fovService.js";
import { loadBoard, readBoard } from "../services/boardRepository.js";
import { MovementHandler } from "./handlers/movement.js";
import { MasterHandler } from "./handlers/master.js";
import { ShopHandler } from './handlers/shop.js';
import { ChatAndLogHandler } from './handlers/chatAndLog.js';
import { CombatHandler } from './handlers/combat.js';

import { saveCheckpoint, detectInterruptedSession, closeSession } from "../services/crashRecoveryService.js";
import { grantStarterKit } from "../db/seedEconomy.js";

type Database = ReturnType<typeof openDatabase>;
export interface RoomServices { database: Database; tokenSecret: string; bootstrapKey: string }
interface Identity { playerId: string; name: string; role: PlayerRole; sessionToken: string }

export class GameRoom extends Room<{ state: RoomState }> {
  private recoveryPending = false;
  private sessionClosed = false;
  private pendingDeliveries: (() => void)[] | undefined;
  private roomRecord!: typeof rooms.$inferSelect;
  private bindings = new Map<string, string>();
  private ips = new Map<string, string>();
  private heartbeats = new Map<string, number>();
  private reconnectCancellations = new Map<string, () => void>();
  private authAttempts = new Map<string, { count: number; resetAt: number }>();
  private fov!: FovService;
  private movement!: MovementHandler;
  private combat!: CombatHandler;
  private shop!: ShopHandler;
  private chatAndLog!: ChatAndLogHandler;
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
    this.state.activeStageId = record.activeStageId;
    this.state.explorationMode = record.explorationMode;
    loadBoard(this.state, readBoard(this.services.database));
    this.fov = new FovService(this.state);
    this.movement = new MovementHandler(this.state, this.services.database, () => this.refreshViews());
    for (const saved of this.services.database.db.select().from(players).where(eq(players.roomId, record.id)).all()) {
      const player = new PlayerSchema();
      Object.assign(player, { id: saved.id, name: saved.name, role: saved.id === record.id ? "MASTER" : "PLAYER", status: saved.approvalStatus === "APPROVED" && saved.id !== record.id ? "NEEDS_CHARACTER_CREATION" : saved.approvalStatus, connected: false });
      this.restoreCharacter(player, saved.characterId);
      this.state.players.set(player.id, player);
    }
    const chamberSend = (name: string, data: unknown, audience: string) => {
      for (const client of this.clients) {
        const p = this.state.players.get(this.bindings.get(client.sessionId) ?? '');
        if (p?.connected && (p.role === 'MASTER' || (audience !== 'MASTER' && isCharacterPresent(p) && p.currentChamberId === audience))) this.deliver(() => client.send(name, data));
      }
    };
    this.chatAndLog = new ChatAndLogHandler(this.state, chamberSend);
    this.shop = new ShopHandler(this.state, this.services.database, record.id, (playerId, name, data, includeMaster) => {
      for (const client of this.clients) {
        const p = this.state.players.get(this.bindings.get(client.sessionId) ?? '');
        if (p?.connected && (p.id === playerId || (includeMaster && p.role === 'MASTER'))) this.deliver(() => client.send(name, data));
      }
    }, () => this.refreshViews());
    this.combat = new CombatHandler(this.state, this.services.database, record.id, (name, data, audience) => {
      chamberSend(name, data, audience);
      if (name === 'COMBAT_EVENT') this.chatAndLog.recordCombat(data as import('@df/shared').CombatEvent, audience);
    }, () => this.refreshViews(), undefined, undefined, p => { if (p.status === 'READY') this.shop.syncInventory(p); });
    this.combat.restore();
    this.recoveryPending = Boolean(detectInterruptedSession(this.services.database, record.id));
    if (this.state.combatState.active) this.state.combatState.isPaused = true;
    const master = new MasterHandler(this.state, this.services.database, record.id, this.movement, () => this.refreshViews());
    const command = (name: string, masterOnly: boolean, action: (player: PlayerSchema, input: unknown) => void) => {
      this.onMessage(name, (client, input) => {
        const player = this.state.players.get(this.bindings.get(client.sessionId) ?? "");
        if (!player || (masterOnly && player.role !== "MASTER")) { client.send("ACTION_ERROR", "Ação não autorizada."); return; }
        if (this.recoveryPending && !['MASTER_RESTORE_SESSION', 'MASTER_DISCARD_SESSION', 'REQUEST_INVENTORY', 'REQUEST_LOG'].includes(name)) {
          client.send('ACTION_ERROR', 'Aguardando decisão de recuperação do Mestre.'); return;
        }
        if (this.state.combatState.active && ['REQUEST_MOVE','END_MOVEMENT','MASTER_MOVE_ENTITY','MASTER_EDIT','MASTER_DELETE_ENTITY','MASTER_UNDO','MASTER_REDO','MASTER_SET_STAGE','MASTER_SET_HIDDEN','MASTER_SET_CHAMBER_BIOME'].includes(name)) {
          client.send('ACTION_ERROR', 'Encerre o combate antes de alterar o tabuleiro.'); return;
        }
        try {
          if (['MASTER_RESTORE_SESSION', 'MASTER_DISCARD_SESSION', 'MASTER_CLOSE_SESSION', 'REQUEST_INVENTORY', 'REQUEST_LOG', 'CHAT_MESSAGE', 'ROLL_DICE', 'OPEN_SHOP', 'OPEN_CHEST'].includes(name)) action(player, input);
          else this.durable(name, () => action(player, input));
        }
        catch (error) { client.send("ACTION_ERROR", error instanceof Error && error.name !== "ZodError" ? error.message : "Comando inválido."); }
      });
    };
    command('MASTER_RESTORE_SESSION' , true, () => {
      if (!this.recoveryPending) throw new Error('Não há recuperação pendente.');
      this.durable('SESSION_RESTORED', () => {
        this.recoveryPending = false;
        if (this.state.combatState.active) this.combat.pause({ paused: true });
      });
      this.broadcast('RECOVERY_RESOLVED');
      this.refreshViews();
    });
    command('MASTER_DISCARD_SESSION', true, () => this.finishSession(true));
    command('MASTER_CLOSE_SESSION', true, () => this.finishSession(false));
    command('REQUEST_INVENTORY' , false, (p, input) => this.shop.requestInventory(p, input ?? {}));
    command('EQUIP_ITEM', false, (p, input) => this.shop.equipItem(p, input));
    command('UNEQUIP_ITEM', false, (p, input) => this.shop.unequipItem(p, input));
    command('USE_SCROLL', false, (p, input) => this.shop.useScroll(p, input));
    command('OPEN_CHEST', false, (p, input) => this.shop.openChest(p, input));
    command('LOOT_CHEST_ITEM', false, (p, input) => this.shop.lootChestItem(p, input));
    command('OPEN_SHOP', false, (p, input) => this.shop.openShop(p, input));
    command('BUY_ITEM', false, (p, input) => this.shop.buyItem(p, input));
    command('SELL_ITEM', false, (p, input) => this.shop.sellItem(p, input));
    command('MASTER_EDIT_SHOP', true, (p, input) => this.shop.editShop(p, input));
    command('MASTER_EDIT_CHEST', true, (p, input) => this.shop.editChest(p, input));
    command('MASTER_GRANT_ITEM', true, (p, input) => this.shop.grantItem(p, input));
    command('CHAT_MESSAGE', false, (p, input) => this.chatAndLog.chat(p, input));
    command('ROLL_DICE', false, (p, input) => this.chatAndLog.rollDice(p, input));
    command('REQUEST_LOG', false, p => this.sendLog(p));
    command("REQUEST_MOVE", false, (p, input) => { this.movement.request(p, input); this.combat.proximity(p); });
    command('START_COMBAT', true, (_p, input) => this.combat.start(input));
    command('MASTER_SET_CHAMBER_BIOME', true, (_p, input) => master.biome(input));
    command('COMBAT_ACTION', false, (p, input) => this.combat.action(p, input));
    command('MASTER_SET_MONSTER_AI', true, (_p, input) => this.combat.setMonsterAi(input));
    command('MASTER_SET_GLOBAL_AI', true, (_p, input) => this.combat.setGlobalAi(input));
    command('MASTER_PAUSE_COMBAT', true, (_p, input) => this.combat.pause(input));
    command('MASTER_SET_FLEE_MODE', true, (_p, input) => this.combat.fleeMode(input));
    command('MASTER_REORDER_INITIATIVE', true, (_p, input) => this.combat.reorder(input));
    command('MASTER_FORCE_TURN_SKIP', true, () => this.combat.skip());
    command('MASTER_ADD_COMBAT_PLAYER', true, (_p, input) => this.combat.addPlayer(input));
    command('MASTER_KICK_PLAYER', true, (_p, input) => this.kick(input));
    command('MASTER_POSITION_PLAYER', true, (_p, input) => {
      const data = MasterMoveSchema.parse(input);
      const player = this.state.players.get(data.entityId);
      if (!player?.awaitingPosition) throw new Error('Este personagem não aguarda posicionamento.');
      this.movement.masterMove(data);
      this.notifyCombat(player);
    });
    command('MASTER_MANUAL_MONSTER_ACTION', true, (p, input) => this.combat.action(p, input, true));
    command('MASTER_END_COMBAT', true, () => this.combat.end());
    command('MASTER_SET_D20_CUTOFFS', true, (_p, input) => this.combat.setCutoffs(input));
    command("END_MOVEMENT", false, p => this.movement.endTurn(p));
    command("MASTER_MOVE_ENTITY", true, (_p, input) => master.move(input));
    command("MASTER_ROTATE_OBJECT", true, (_p, input) => master.rotate(input));
    command("MASTER_EDIT", true, (_p, input) => master.edit(input));
    command("MASTER_SET_HIDDEN", true, (_p, input) => master.hidden(input));
    command("MASTER_DELETE_ENTITY", true, (_p, input) => master.remove(input));
    command("MASTER_UNDO", true, () => master.history(false));
    command("MASTER_REDO", true, () => master.history(true));
    command("SET_EXPLORATION_MODE", true, (_p, input) => master.mode(input));
    command("MASTER_SET_STAGE", true, (_p, input) => master.stage(input));
    this.onMessage("SUBMIT_CHARACTER", (client, input) => this.submitCharacter(client, input));
    this.onMessage("APPROVE_PLAYER", (client, input) => this.decide(client, input, true));
    this.onMessage("REJECT_PLAYER", (client, input) => this.decide(client, input, false));
    this.onMessage("PING", (client, timestamp) => {
      if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
        client.send("PONG", timestamp); client.send('CLOCK_SYNC', { clientSentAt: timestamp, serverNow: Date.now() });
      }
    });
    this.onMessage("PONG", (client, timestamp) => {
      const sent = this.heartbeats.get(client.sessionId);
      if (sent === undefined || sent !== timestamp) return;
      this.heartbeats.delete(client.sessionId);
      const rtt = Date.now() - sent;
      this.log("heartbeat", client, rtt);
      this.services.database.db.update(players).set({ lastSeenAt: Date.now() }).where(eq(players.id, this.bindings.get(client.sessionId)!)).run();
    });
    let nextHeartbeatAt = Date.now() + 20_000;
    this.setSimulationInterval(() => {
      if (!this.recoveryPending && this.state.combatState.active && !this.state.combatState.isPaused) {
        try { this.durable('COMBAT_TICK', () => this.combat.tick()); }
        catch (error) { this.state.combatState.isPaused = true; console.error('Falha ao persistir combate', error); }
      }
      if (Date.now() < nextHeartbeatAt) return;
      nextHeartbeatAt = Date.now() + 20_000;
      for (const client of this.clients) {
        const timestamp = Date.now();
        this.heartbeats.set(client.sessionId, timestamp);
        client.send("PING", timestamp);
      }
    }, 100);
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
    client.view = new StateView();
    // Um único socket por identidade, inclusive durante a janela de reconexão.
    if (Array.from(this.bindings.values()).includes(auth.playerId)) throw new ServerError(409, "Este jogador já está conectado. Aguarde a reconexão.");
    const { db } = this.services.database;
    let player = this.state.players.get(auth.playerId);
    if (!player) {
      if (Array.from(this.state.players.values()).some(p => p.name.toLocaleLowerCase("pt-BR") === auth.name.toLocaleLowerCase("pt-BR"))) throw new ServerError(409, "Nome já está em uso.");
      player = new PlayerSchema();
      Object.assign(player, { id: auth.playerId, name: auth.name, role: auth.role, status: auth.role === "MASTER" ? "APPROVED" : "PENDING_APPROVAL" });
      db.insert(players).values({ id: player.id, roomId: this.roomRecord.id, name: player.name, sessionToken: auth.sessionToken, approvalStatus: auth.role === "MASTER" ? "APPROVED" : "PENDING_APPROVAL" }).run();
      this.state.players.set(player.id, player);
    }
    this.bindings.set(client.sessionId, player.id);
    player.connected = true;
    player.reconnecting = false;
    if (player.status === 'READY' && !this.recoveryPending) this.movement.spawn(player);
    db.update(players).set({ sessionToken: auth.sessionToken, reconnectionToken: `${this.roomId}:${client.reconnectionToken}`, lastSeenAt: Date.now() }).where(eq(players.id, player.id)).run();
    this.credentials(client, auth.sessionToken, player);
    if (player.status === "READY") this.shop.syncInventory(player);
    this.sendLog(player);
    this.refreshViews();
    if (this.state.combatState.active && (player.role === 'MASTER' || (isCharacterPresent(player) && player.currentChamberId === this.state.combatState.chamberId))) client.send('COMBAT_ROSTER', this.combat.snapshot());
    if (player.role === 'MASTER' && this.recoveryPending) client.send('HAS_INTERRUPTED_SESSION', detectInterruptedSession(this.services.database, this.roomRecord.id));
    this.log("join", client);
  }

  private credentials(client: Client, sessionToken?: string, player = this.state.players.get(this.bindings.get(client.sessionId)!)) {
    if (!player) return;
    const saved = this.services.database.db.select().from(players).where(eq(players.id, player.id)).get()!;
    const credentials: SessionCredentialsPayload = { playerId: player.id, playerName: player.name, role: player.role, sessionToken: sessionToken ?? saved.sessionToken, reconnectionToken: `${this.roomId}:${client.reconnectionToken}`, roomCode: this.roomId };
    client.send("SESSION_CREDENTIALS", credentials);
  }

  private syncCharacter(player: PlayerSchema, character: typeof characters.$inferSelect) {
    Object.assign(player, {
      characterId: character.id, characterName: character.name, raceId: character.raceId,
      archetypeId: character.archetypeId, hp: character.hp, maxHp: character.maxHp,
      mp: character.mp, maxMp: character.maxMp, defense: character.defense, speed: character.speed,
      finalDex: character.finalDex, dodgeChance: character.dodgeChance, flatDr: character.flatDr,
      portraitUrl: `data:image/webp;base64,${character.portraitWebp}`,
      tokenUrl: `data:image/webp;base64,${character.tokenWebp}`, status: "READY",
      currentChamberId: character.currentChamberId, q: character.posQ, r: character.posR,
      moveCooldownEndsAt: character.moveCooldownEndsAt, remainingSteps: character.remainingSteps,
    });
  }

  private restoreCharacter(player: PlayerSchema, characterId: string | null) {
    if (player.role !== "PLAYER") return;
    const approval = player.status;
    const character = characterId ? this.services.database.db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.playerId, player.id), eq(characters.roomId, this.roomRecord.id))).get() : undefined;
    if (character) this.syncCharacter(player, character);
    else player.status = "NEEDS_CHARACTER_CREATION";
    if (approval === 'PENDING_APPROVAL' || approval === 'REJECTED') player.status = approval;
  }

  private submitCharacter(client: Client, input: unknown) {
    const player = this.state.players.get(this.bindings.get(client.sessionId)!);
    if (player?.role !== "PLAYER" || player.status !== "NEEDS_CHARACTER_CREATION") {
      client.send("ACTION_ERROR", "A criação de ficha não está disponível para este jogador.");
      return;
    }
    if (this.recoveryPending) { client.send('ACTION_ERROR', 'Aguardando recuperação da sessão.'); return; }
    let values: ReturnType<typeof prepareCharacter>;
    try { values = prepareCharacter(input); }
    catch { client.send("ACTION_ERROR", "Ficha inválida: confira atributos, limite de 27 pontos, bônus humano e imagens WebP."); return; }
    try {
      this.durable('CHARACTER_CREATED', () => {
      const character = this.services.database.db.transaction(db => {
        const saved = db.select().from(players).where(and(eq(players.id, player.id), eq(players.roomId, this.roomRecord.id))).get();
        if (!saved || !["APPROVED", "NEEDS_CHARACTER_CREATION"].includes(saved.approvalStatus) || saved.characterId) {
          throw new Error("Jogador sem autorização ou já possui ficha.");
        }
        const created = db.insert(characters).values({ ...values, playerId: player.id, roomId: this.roomRecord.id }).returning().get();
        db.update(players).set({ characterId: created.id, lastSeenAt: Date.now() }).where(eq(players.id, player.id)).run();
        return grantStarterKit(this.services.database.db, created.id);
      });
      this.syncCharacter(player, character);
      this.movement.spawn(player);
      this.shop.syncInventory(player);
      });
      this.refreshViews();
    } catch {
      client.send("ACTION_ERROR", "Não foi possível salvar a ficha. Tente novamente.");
    }
  }

  private decide(client: Client, input: unknown, approve: boolean) {
    const master = this.state.players.get(this.bindings.get(client.sessionId)!);
    const parsed = ApprovalDecisionPayloadSchema.safeParse(input);
    if (master?.role !== "MASTER" || !parsed.success) { client.send("ACTION_ERROR", "Ação não autorizada ou inválida."); return; }
    const player = this.state.players.get(parsed.data.targetPlayerId);
    if (!player || player.role !== "PLAYER" || player.status !== "PENDING_APPROVAL" || (!player.connected && !player.reconnecting)) { client.send("ACTION_ERROR", "O pedido não está mais pendente."); return; }
    const status = approve ? "NEEDS_CHARACTER_CREATION" : "REJECTED";
    // A autorização persistida é distinta da etapa de criação de ficha no estado de rede.
    const sessionToken = approve ? signSessionToken({ playerId: player.id, roomId: this.roomRecord.id, role: "PLAYER" }, this.services.tokenSecret) : undefined;
    this.services.database.db.transaction(db => {
      db.update(players).set({ approvalStatus: approve ? "APPROVED" : "REJECTED", ...(sessionToken ? { sessionToken } : {}), lastSeenAt: Date.now() }).where(eq(players.id, player.id)).run();
    });
    player.status = status;
    if (approve) {
      const saved = this.services.database.db.select().from(players).where(eq(players.id, player.id)).get()!;
      this.restoreCharacter(player, saved.characterId);
      if (player.characterId) this.movement.spawn(player);
    }
    this.refreshViews();
    for (const target of this.clients) if (this.bindings.get(target.sessionId) === player.id) {
      target.send("APPROVAL_RESULT", player.status);
      if (approve) this.credentials(target);
    }
    if (approve) {
      if (player.characterId) this.shop.syncInventory(player);
      this.sendLog(player); this.notifyCombat(player);
    }
    this.log(approve ? "approve" : "reject", client);
  }

  private notifyCombat(player: PlayerSchema) {
    if (!this.state.combatState.active || !isCharacterPresent(player) || player.currentChamberId !== this.state.combatState.chamberId) return;
    for (const client of this.clients) if (this.bindings.get(client.sessionId) === player.id) client.send('COMBAT_ROSTER', this.combat.snapshot());
  }

  private kick(input: unknown) {
    const { targetPlayerId } = ApprovalDecisionPayloadSchema.parse(input);
    const player = this.state.players.get(targetPlayerId);
    if (!player || player.role !== 'PLAYER' || !player.characterId) throw new Error('Selecione um personagem.');
    this.combat.removePlayer(player.id);
    this.shop.disconnect(player.id);
    this.services.database.db.update(players).set({ approvalStatus: 'PENDING_APPROVAL', reconnectionToken: null, lastSeenAt: Date.now() }).where(eq(players.id, player.id)).run();
    player.connected = false; player.reconnecting = false; player.status = 'PENDING_APPROVAL';
    for (const [sessionId, id] of this.bindings) if (id === player.id) {
      this.bindings.delete(sessionId);
      this.reconnectCancellations.get(sessionId)?.();
      this.reconnectCancellations.delete(sessionId);
      const target = this.clients.find(client => client.sessionId === sessionId);
      target?.send('PLAYER_KICKED', 'O Mestre removeu você da sala. Sua ficha foi preservada. Solicite entrada novamente para voltar.');
      target?.leave(4000);
    }
    this.refreshViews();
  }

  async onDrop(client: Client) {
    const player = this.state.players.get(this.bindings.get(client.sessionId)!);
    if (!player) return;
    player.connected = false;
    player.reconnecting = true;
    this.refreshViews();
    this.log("drop", client);
    const reconnection = this.allowReconnection(client, 60);
    this.reconnectCancellations.set(client.sessionId, () => reconnection.reject());
    try { await reconnection; } catch { /* onLeave faz a limpeza definitiva */ }
    finally { this.reconnectCancellations.delete(client.sessionId); }
  }
  onReconnect(client: Client) {
    const player = this.state.players.get(this.bindings.get(client.sessionId)!);
    if (!player) return;
    player.connected = true;
    player.reconnecting = false;
    this.refreshViews();
    this.services.database.db.update(players).set({ reconnectionToken: `${this.roomId}:${client.reconnectionToken}`, lastSeenAt: Date.now() }).where(eq(players.id, player.id)).run();
    this.credentials(client);
    if (player.status === "READY") this.shop.syncInventory(player);
    this.sendLog(player);
    if (this.state.combatState.active && (player.role === 'MASTER' || (isCharacterPresent(player) && player.currentChamberId === this.state.combatState.chamberId))) client.send('COMBAT_ROSTER', this.combat.snapshot());
    this.log("reconnect", client);
  }
  onLeave(client: Client) {
    const id = this.bindings.get(client.sessionId);
    const player = id && this.state.players.get(id);
    if (player) {
      player.connected = false;
      player.reconnecting = false;
      this.shop.disconnect(player.id);
      if (!this.recoveryPending && !this.sessionClosed) this.durable('PLAYER_LEFT', () => this.combat.removePlayer(player.id));
      this.services.database.db.update(players).set({ reconnectionToken: null, lastSeenAt: Date.now() }).where(eq(players.id, player.id)).run();
      // Cancelar a espera libera o nome para uma nova tentativa.
      if (player.status === "PENDING_APPROVAL" && !player.characterId) {
        this.services.database.db.delete(players).where(eq(players.id, player.id)).run();
        this.state.players.delete(player.id);
      }
    }
    this.log("leave", client);
    this.bindings.delete(client.sessionId);
    this.ips.delete(client.sessionId);
    this.heartbeats.delete(client.sessionId);
    this.refreshViews();
    client.view?.dispose();
  }
  private durable(event: string, work: () => void) {
    const before = this.combat.captureRecovery();
    const playersBefore = [...this.state.players.values()].map(p => [p, p.toJSON()] as const);
    const fields = { activeStageId: this.state.activeStageId, explorationMode: this.state.explorationMode, sessionStatus: this.state.sessionStatus };
    const pending = this.recoveryPending, closed = this.sessionClosed;
    let completed = false;
    this.pendingDeliveries = [];
    try {
      this.services.database.sqlite.transaction(() => {
        work(); completed = true;
        this.sessionClosed = false;
        if (event !== 'COMBAT_TICK' || JSON.stringify(before.combat) !== JSON.stringify(this.state.combatState.toJSON()))
          saveCheckpoint(this.services.database, this.roomRecord.id, this.state, event);
      }).immediate();
      const deliveries = this.pendingDeliveries; this.pendingDeliveries = undefined;
      for (const send of deliveries) send();
    } catch (error) {
      this.pendingDeliveries = undefined;
      this.combat.restoreRecovery(before);
      for (const [player, data] of playersBefore) Object.assign(player, data);
      Object.assign(this.state, fields); this.recoveryPending = pending; this.sessionClosed = closed;
      if (completed) loadBoard(this.state, readBoard(this.services.database));
      this.refreshViews();
      throw error;
    }
  }
  private finishSession(discard: boolean) {
    const before = this.combat.captureRecovery();
    try {
      this.services.database.sqlite.transaction(() => {
        if (this.state.combatState.active) this.combat.end();
        closeSession(this.services.database, this.roomRecord.id);
        this.state.sessionStatus = 'LOBBY';
        this.services.database.db.update(rooms).set({ status: 'LOBBY' }).where(eq(rooms.id, this.roomRecord.id)).run();
        if (discard) ensureActiveSession(this.services.database, this.roomRecord.id);
      }).immediate();
    } catch (error) { this.combat.restoreRecovery(before); throw error; }
    this.recoveryPending = false;
    this.sessionClosed = !discard;
    this.services.database.checkpointWal('TRUNCATE');
    this.broadcast('RECOVERY_RESOLVED'); this.refreshViews();
  }
  private sendLog(player: PlayerSchema) {
    for (const client of this.clients) if (this.bindings.get(client.sessionId) === player.id) client.send('LOG_SYNC', { entries: this.chatAndLog.history(player) });
  }
  private deliver(send: () => void) { if (this.pendingDeliveries) this.pendingDeliveries.push(send); else send(); }
  private refreshViews() { this.combat?.syncMonsterModes(); this.deliver(() => this.fov.refresh(this.clients, client => this.bindings.get(client.sessionId))); }
  private log(event: string, client: Client, rttMs?: number) {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, roomCode: this.roomId, ip: this.ips.get(client.sessionId) ?? "unknown", rttMs: rttMs ?? null }));
  }
}

export function gameRoomClass(services: RoomServices) {
  return class HostedGameRoom extends GameRoom { constructor() { super(services); } };
}
