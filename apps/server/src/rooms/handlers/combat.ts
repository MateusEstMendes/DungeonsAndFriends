import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { calculateTotalActions, getModifier, hexDistance, isCharacterPresent, isMagicAttack, resolveAttack, resolveFlee, validateAction,
  PHYSICAL_ATTACKS, MAGICAL_ATTACKS, type AttackType, type CombatAction, type CombatantStats, type PlayerSchema, type RoomState } from '@df/shared';
import { activeBuffs, characters, combatEncounters, combatParticipants, monstersCatalog } from '../../db/schema.js';
import type { Database } from '../../services/boardRepository.js';
import { DEFAULT_CUTOFFS, evaluateD20, roll, validateCutoffs, type D20Cutoffs } from '../../services/diceService.js';

interface Participant extends CombatantStats {
  id: string; kind: 'PLAYER' | 'MONSTER'; name: string; str: number; int: number; dex: number;
  speed: number; mp: number; maxMp: number; archetypeId: string; attackType: AttackType; baseDamage: number;
  cooldowns: Record<string, number>; potions: number;
  berserkUntilRound?: number;
  absent?: boolean;
}
type Send = (name: string, data: unknown, audience: 'MASTER' | string) => void;

export class CombatHandler {
  private participants = new Map<string, Participant>();
  private cutoffs: D20Cutoffs = { ...DEFAULT_CUTOFFS };
  private unlockAt = 0;
  private encounterStatus: 'ACTIVE' | 'ENDED' | 'FLED' = 'ACTIVE';
  private alerts = new Map<string, string>();
  constructor(private state: RoomState, private database: Database, private roomId: string,
    private send: Send, private refresh: () => void, private dice = roll, private now = Date.now) {}

  proximity(player: PlayerSchema) {
    if (this.state.combatState.active || !isCharacterPresent(player)) return;
    const nearby = [...this.state.monsters.values()].filter(m => !m.isHiddenByMaster && m.currentChamberId === player.currentChamberId && hexDistance(player, m) <= 2);
    const signature = nearby.map(m => m.id).sort().join(',');
    if (signature && this.alerts.get(player.id) !== signature) this.send('PROXIMITY_ALERT', {
      playerId: player.id, chamberId: player.currentChamberId, monsterIds: nearby.map(m => m.id), message: '[Inimigo próximo! Iniciar Combate]',
    }, 'MASTER');
    this.alerts.set(player.id, signature);
  }

  start(input: unknown) {
    const chamberId = this.object(input).chamberId;
    if (typeof chamberId !== 'string' || !this.state.chambers.has(chamberId) || this.state.combatState.active) throw new Error('Encontro indisponível.');
    const roster = new Map<string, Participant>();
    for (const player of this.state.players.values()) {
      if (!isCharacterPresent(player) || player.currentChamberId !== chamberId || player.hp <= 0) continue;
      const row = this.database.db.select().from(characters).where(eq(characters.id, player.characterId)).get();
      if (!row) continue;
      roster.set(player.id, { id: player.id, kind: 'PLAYER', name: player.characterName, hp: row.hp, maxHp: row.maxHp, mp: row.mp, maxMp: row.maxMp,
        str: row.finalStr, dex: row.finalDex, int: row.finalInt, dexMod: getModifier(row.finalDex), speed: row.speed,
        raceId: row.raceId, archetypeId: row.archetypeId, passiveDodge: row.dodgeChance, flatDR: row.flatDr,
        baseDamage: 6, attackType: 'SLASHING', cooldowns: {}, potions: 2 });
    }
    const catalog = this.database.db.select().from(monstersCatalog).all();
    for (const monster of this.state.monsters.values()) {
      if (monster.currentChamberId !== chamberId || monster.isHiddenByMaster) continue;
      const row = catalog.find(c => c.name === monster.name || c.id === monster.name || (monster.name === 'Sentinela' && c.id === 'SKELETON_WARRIOR') || (monster.name === 'Monstro' && c.id === 'GOBLIN'));
      if (!row) throw new Error(`Monstro sem ficha no catálogo: ${monster.name}`);
      roster.set(monster.id, { id: monster.id, name: row.name, kind: 'MONSTER', hp: row.hp, maxHp: row.hp, mp: row.mp, maxMp: row.mp,
        str: row.str, int: row.int, dex: row.dex, dexMod: getModifier(row.dex), speed: row.speed, flatDR: row.flatDr,
        passiveDodge: row.passiveDodge, archetypeId: '', baseDamage: row.baseDamage, attackType: row.attackType as AttackType, cooldowns: {}, potions: 0 });
    }
    if (![...roster.values()].some(p => p.kind === 'PLAYER') || ![...roster.values()].some(p => p.kind === 'MONSTER')) throw new Error('São necessários heróis e monstros vivos na câmara.');
    const before = this.checkpoint();
    try {
      this.participants = roster; this.encounterStatus = 'ACTIVE'; this.unlockAt = 0;
      const c = this.state.combatState;
      c.encounterId = randomUUID(); c.chamberId = chamberId; c.active = true; c.round = 1; c.isPaused = false; c.fleeMode = 'NORMAL';
      const biome = this.state.chambers.get(chamberId)!.biome;
      c.biome = ['CAVE','FOREST','TAVERN','DUNGEON'].includes(biome) ? biome as typeof c.biome : 'DUNGEON';
      c.turnOrder.splice(0, c.turnOrder.length, ...[...roster.values()].sort((a,b) => b.speed - a.speed || b.dex - a.dex || a.id.localeCompare(b.id)).map(p => p.id));
      c.activeParticipantId = c.turnOrder[0]; this.beginTurn(); this.state.sessionStatus = 'IN_COMBAT';
      this.persist(true);
    } catch (error) { this.rollback(before); throw error; }
    this.publish();
  }

  action(player: PlayerSchema, input: unknown, manual = false) {
    const data = this.object(input), c = this.state.combatState;
    if (!c.active || c.isPaused || c.isProcessingAction || this.now() < this.unlockAt) throw new Error('Aguarde a resolução do turno.');
    if (data.turnToken !== c.turnToken) throw new Error('Turno expirado.');
    const actor = this.participants.get(c.activeParticipantId)!;
    if (manual ? player.role !== 'MASTER' || actor.kind !== 'MONSTER' : actor.id !== player.id || actor.kind !== 'PLAYER') throw new Error('Não é seu turno.');
    const action = this.parseAction(data);
    if (!validateAction(action, c.actionIndex, actor.str, actor.int)) throw new Error('Ação extra incompatível com FOR/INT.');
    const target = 'targetId' in action && action.targetId ? this.participants.get(action.targetId) : actor;
    if (!target || target.absent || target.hp <= 0) throw new Error('Alvo inválido.');
    if (action.type === 'ATTACK' && target.kind === actor.kind) throw new Error('Selecione um inimigo.');
    if ((action.type === 'ITEM' || action.type === 'DEFEND') && target.kind !== actor.kind) throw new Error('Selecione um aliado.');
    if (action.type === 'FLEE' && c.fleeMode === 'BLOCKED') throw new Error('A fuga está bloqueada pelo Mestre.');
    const before = this.checkpoint();
    const event: Record<string, unknown> = { id: randomUUID(), encounterId: c.encounterId, actorId: actor.id, targetId: target.id,
      type: action.type, round: c.round, turnToken: c.turnToken, startedAt: this.now(), duration: 1200, rolls: [] };
    c.isProcessingAction = true;
    try {
      const rolls = event.rolls as { faces: number; value: number }[];
      const dice = (faces: number) => { const value = this.dice(faces); rolls.push({ faces, value }); return value; };
      if (action.type === 'ATTACK') {
        const magic = isMagicAttack(action.subType);
        const signature = ['WARRIOR','BARBARIAN','ROGUE'].includes(action.subType);
        if (signature && actor.archetypeId !== action.subType) throw new Error('Habilidade de outro arquétipo.');
        if (signature && (actor.cooldowns[action.subType] ?? 0) > c.round) throw new Error('Habilidade em recarga.');
        const cost = magic ? 10 : 0;
        if (actor.mp < cost) throw new Error('MP insuficiente.');
        const naturalRoll = dice(20);
        const attackMod = getModifier(magic ? actor.int : action.subType === 'ROGUE' ? actor.dex : actor.str);
        const attackRoll = naturalRoll + attackMod + (action.subType === 'ROGUE' ? 3 : 0);
        if (action.subType === 'BARBARIAN') actor.berserkUntilRound = c.round + 2;
        const raging = (actor.berserkUntilRound ?? 0) > c.round;
        const incomingRage = (target.berserkUntilRound ?? 0) > c.round;
        const result = resolveAttack({ attacker: actor, defender: target, attackRoll, naturalRoll,
          baseDamage: actor.baseDamage + attackMod + (signature && action.subType !== 'BARBARIAN' ? 4 : 0)
            + (raging && !magic ? 4 : 0) + (incomingRage ? 2 : 0) + (magic && actor.archetypeId === 'MAGE' && action.subType === 'ARCANE' ? 4 : 0),
          isMagic: magic, isMelee: !magic, criticalFrom: this.cutoffs.criticalSuccess }, dice);
        actor.mp -= cost;
        if (signature) actor.cooldowns[action.subType] = c.round + (action.subType === 'ROGUE' ? 2 : 3);
        target.hp = Math.max(0, target.hp - result.finalDamage);
        actor.hp = Math.min(actor.maxHp, actor.hp + result.healAmount);
        if (target.stance === 'ACTIVE_DODGE') target.stance = '';
        Object.assign(event, result, { damage: result.finalDamage, attackRoll, roll: naturalRoll, rollOutcome: evaluateD20(naturalRoll, this.cutoffs), vfxType: action.subType });
      } else if (action.type === 'DEFEND') {
        if (action.subType === 'HEAL' || action.subType === 'PROTECT') {
          if (actor.mp < 10) throw new Error('MP insuficiente.');
          actor.mp -= 10;
          if (action.subType === 'HEAL') { const heal = Math.min(target.maxHp - target.hp, 12 + Math.max(0, getModifier(actor.int))); target.hp += heal; Object.assign(event, { healAmount: heal, outcome: 'HEALED' }); }
          else { target.stance = 'SHIELD_BLOCK'; target.shieldDR = 5; Object.assign(event, { outcome: 'PROTECTED' }); }
        } else { actor.stance = action.subType; actor.shieldDR = 2; Object.assign(event, { outcome: action.subType }); }
      } else if (action.type === 'ITEM') {
        if (action.itemId !== 'HEALTH_POTION' || actor.potions <= 0) throw new Error('Consumível indisponível.');
        const heal = Math.min(25, target.maxHp - target.hp); actor.potions--; target.hp += heal; Object.assign(event, { healAmount: heal, outcome: 'HEALED' });
      } else {
        const value = dice(100);
        const fled = resolveFlee(actor.speed, [...this.participants.values()].filter(p => !p.absent && p.kind !== actor.kind && p.hp > 0).map(p => p.speed), value,
          { fleeBlocked: c.fleeMode === 'BLOCKED', guaranteedFlee: c.fleeMode === 'GUARANTEED_100' });
        Object.assign(event, { outcome: fled ? 'FLED' : 'FLEE_FAILED', roll: value });
        if (fled) this.finish('FLED');
      }
      if (c.active) {
        c.remainingActions--; c.actionIndex++;
        if (!this.alive('PLAYER').length || !this.alive('MONSTER').length) this.finish('ENDED');
        else if (c.remainingActions === 0 || actor.hp === 0) this.advance();
        else c.turnToken = randomUUID();
      }
      this.unlockAt = this.now() + 1200;
      this.persist();
    } catch (error) { this.rollback(before); throw error; }
    finally { c.isProcessingAction = false; }
    this.syncVitals(); this.publish();
    this.send('COMBAT_EVENT', event, c.chamberId);
    console.info(JSON.stringify({ audit: 'combat', ...event }));
  }

  pause(input: unknown) { const value = this.object(input).paused; if (typeof value !== 'boolean') throw new Error('Pausa inválida.'); this.requireActive(); this.change(() => { this.state.combatState.isPaused = value; }); }
  fleeMode(input: unknown) { const value = this.object(input).mode; if (!['NORMAL','BLOCKED','GUARANTEED_100'].includes(value as string)) throw new Error('Modo inválido.'); this.requireActive(); this.change(() => { this.state.combatState.fleeMode = value as 'NORMAL' | 'BLOCKED' | 'GUARANTEED_100'; }); }
  reorder(input: unknown) {
    this.requireActive(); const order = this.object(input).turnOrder, c = this.state.combatState;
    if (!Array.isArray(order) || order.length !== c.turnOrder.length || new Set(order).size !== order.length || !order.every(id => typeof id === 'string' && c.turnOrder.includes(id))) throw new Error('Fila inválida.');
    this.change(() => { c.turnOrder.splice(0, c.turnOrder.length, ...order); });
  }
  skip() { this.requireActive(); this.change(() => { this.advance(); this.unlockAt = this.now() + 1200; }); }
  end() { this.requireActive(); this.change(() => this.finish('ENDED')); }
  setCutoffs(input: unknown) { this.requireActive(); const data = this.object(input); const cutoffs = { criticalFailure: data.criticalFailure as number, success: data.success as number, criticalSuccess: data.criticalSuccess as number }; validateCutoffs(cutoffs); this.change(() => { this.cutoffs = cutoffs; }); }
  tick() {
    const c = this.state.combatState;
    if (c.isProcessingAction && this.now() >= this.unlockAt) c.isProcessingAction = false;
    // Monsters are controlled manually by the referee, preserving the current turn until ordered.
  }
  removePlayer(id: string) {
    const c = this.state.combatState, participant = this.participants.get(id);
    if (!c.active || !participant || participant.absent || participant.kind !== 'PLAYER') return;
    this.change(() => {
      participant.absent = true;
      if (!this.alive('PLAYER').length) this.finish('ENDED');
      else if (c.activeParticipantId === id) this.advance();
      const index = c.turnOrder.indexOf(id);
      if (index >= 0) c.turnOrder.splice(index, 1);
    });
  }
  addPlayer(input: unknown) {
    this.requireActive();
    const id = this.object(input).targetPlayerId;
    const player = typeof id === 'string' ? this.state.players.get(id) : undefined;
    const c = this.state.combatState;
    if (!player || !player.connected || !isCharacterPresent(player) || player.currentChamberId !== c.chamberId || player.hp <= 0 || c.turnOrder.includes(player.id)) throw new Error('Personagem indisponível para este combate.');
    const row = this.database.db.select().from(characters).where(eq(characters.id, player.characterId)).get();
    if (!row) throw new Error('Ficha indisponível.');
    this.change(() => {
      const previous = this.participants.get(player.id);
      this.participants.set(player.id, previous ? { ...previous, absent: false, hp: row.hp, mp: row.mp } : {
        id: player.id, kind: 'PLAYER', name: player.characterName, hp: row.hp, maxHp: row.maxHp, mp: row.mp, maxMp: row.maxMp,
        str: row.finalStr, dex: row.finalDex, int: row.finalInt, dexMod: getModifier(row.finalDex), speed: row.speed,
        raceId: row.raceId, archetypeId: row.archetypeId, passiveDodge: row.dodgeChance, flatDR: row.flatDr,
        baseDamage: 6, attackType: 'SLASHING', cooldowns: {}, potions: 2,
      });
      c.turnOrder.push(player.id);
    });
  }
  private alive(kind: Participant['kind']) { return [...this.participants.values()].filter(p => !p.absent && p.kind === kind && p.hp > 0); }
  private requireActive() { if (!this.state.combatState.active) throw new Error('Não há combate ativo.'); }
  private beginTurn() {
    const c = this.state.combatState, actor = this.participants.get(c.activeParticipantId)!;
    if (actor.stance === 'SHIELD_BLOCK') { actor.stance = ''; actor.shieldDR = 0; }
    c.actionIndex = 0; c.remainingActions = calculateTotalActions(actor.str, actor.int).count; c.turnToken = randomUUID();
  }
  private advance() {
    const c = this.state.combatState; let index = c.turnOrder.indexOf(c.activeParticipantId);
    for (let i = 0; i < c.turnOrder.length; i++) {
      index = (index + 1) % c.turnOrder.length; if (index === 0) c.round++;
      const participant = this.participants.get(c.turnOrder[index])!;
      if (!participant.absent && participant.hp > 0) { c.activeParticipantId = c.turnOrder[index]; this.beginTurn(); return; }
    }
  }
  private finish(status: 'ENDED' | 'FLED') {
    const c = this.state.combatState; c.active = false; c.remainingActions = 0; this.state.sessionStatus = 'ACTIVE';
    this.encounterStatus = status;
  }
  private checkpoint() {
    return { combat: this.state.combatState.toJSON(), participants: structuredClone([...this.participants.entries()]),
      status: this.encounterStatus, sessionStatus: this.state.sessionStatus, cutoffs: { ...this.cutoffs }, unlockAt: this.unlockAt };
  }
  private rollback(before: ReturnType<CombatHandler['checkpoint']>) {
    const { turnOrder, ...fields } = before.combat;
    Object.assign(this.state.combatState, fields);
    this.state.combatState.turnOrder.splice(0, this.state.combatState.turnOrder.length, ...turnOrder);
    this.participants = new Map(before.participants); this.encounterStatus = before.status;
    this.state.sessionStatus = before.sessionStatus; this.cutoffs = before.cutoffs; this.unlockAt = before.unlockAt;
  }
  private change(work: () => void) {
    const before = this.checkpoint();
    try { work(); this.persist(); } catch (error) { this.rollback(before); throw error; }
    this.syncVitals(); this.publish();
  }
  private syncVitals() { for (const p of this.participants.values()) { const entity = this.state.players.get(p.id); if (entity) { entity.hp = p.hp; entity.mp = p.mp; } } }
  private publish() {
    this.send('COMBAT_ROSTER', this.snapshot(), this.state.combatState.chamberId);
    this.refresh();
  }
  snapshot() { return { encounterId: this.state.combatState.encounterId, participants: [...this.participants.values()].filter(p => !p.absent), cutoffs: this.cutoffs }; }
  private persist(create = false) {
    const c = this.state.combatState;
    const values = { status: this.encounterStatus, roomId: this.roomId, chamberId: c.chamberId, biome: c.biome, round: c.round, turnOrderJson: JSON.stringify([...c.turnOrder]), activeParticipantId: c.activeParticipantId,
      remainingActions: c.remainingActions, actionIndex: c.actionIndex, fleeMode: c.fleeMode, isPaused: c.isPaused, turnToken: c.turnToken, cutoffsJson: JSON.stringify(this.cutoffs), updatedAt: this.now() };
    this.database.db.transaction(db => {
      if (create) db.insert(combatEncounters).values({ id: c.encounterId, ...values }).run();
      else db.update(combatEncounters).set(values).where(eq(combatEncounters.id, c.encounterId)).run();
      db.delete(combatParticipants).where(eq(combatParticipants.encounterId, c.encounterId)).run();
      db.delete(activeBuffs).where(eq(activeBuffs.encounterId, c.encounterId)).run();
      for (const p of this.participants.values()) {
        db.insert(combatParticipants).values({ id: p.id, encounterId: c.encounterId, kind: p.kind, statsJson: JSON.stringify(p), hp: p.hp, mp: p.mp }).run();
        if (p.kind === 'PLAYER') { const player = this.state.players.get(p.id); if (player) db.update(characters).set({ hp: p.hp, mp: p.mp }).where(eq(characters.id, player.characterId)).run(); }
        if (p.stance) db.insert(activeBuffs).values({ id: randomUUID(), encounterId: c.encounterId, participantId: p.id, kind: p.stance, amount: p.shieldDR ?? 0, expiresRound: c.round + 1 }).run();
        if ((p.berserkUntilRound ?? 0) > c.round) db.insert(activeBuffs).values({ id: randomUUID(), encounterId: c.encounterId, participantId: p.id, kind: 'BERSERK', amount: 4, expiresRound: p.berserkUntilRound! }).run();
      }
    });
  }
  restore() {
    const row = this.database.db.select().from(combatEncounters).where(and(eq(combatEncounters.roomId, this.roomId), eq(combatEncounters.status, 'ACTIVE'))).get();
    if (!row) return;
    this.participants.clear();
    for (const p of this.database.db.select().from(combatParticipants).where(eq(combatParticipants.encounterId, row.id)).all()) this.participants.set(p.id, { ...JSON.parse(p.statsJson), hp: p.hp, mp: p.mp });
    const order: string[] = JSON.parse(row.turnOrderJson), cutoffs: D20Cutoffs = JSON.parse(row.cutoffsJson);
    validateCutoffs(cutoffs);
    const actor = this.participants.get(row.activeParticipantId);
    if (!Array.isArray(order) || !order.length || new Set(order).size !== order.length || !order.every(id => this.participants.has(id))
      || !actor || actor.hp <= 0 || !order.includes(actor.id) || row.round < 1 || row.remainingActions < 1 || row.actionIndex < 0
      || row.remainingActions + row.actionIndex !== calculateTotalActions(actor.str, actor.int).count) throw new Error('Encontro persistido inconsistente.');
    const c = this.state.combatState;
    Object.assign(c, { active: true, encounterId: row.id, chamberId: row.chamberId, biome: row.biome, round: row.round, activeParticipantId: row.activeParticipantId,
      remainingActions: row.remainingActions, actionIndex: row.actionIndex, fleeMode: row.fleeMode, isPaused: row.isPaused, turnToken: row.turnToken });
    c.turnOrder.splice(0, c.turnOrder.length, ...order); this.cutoffs = cutoffs;
    this.encounterStatus = 'ACTIVE'; this.unlockAt = 0; c.isProcessingAction = false;
    this.state.sessionStatus = 'IN_COMBAT'; this.syncVitals();
  }
  private object(input: unknown): Record<string, unknown> { if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Comando inválido.'); return input as Record<string, unknown>; }
  private parseAction(data: Record<string, unknown>): CombatAction {
    if (data.type === 'FLEE') return { type: 'FLEE' };
    if (data.type === 'ATTACK' && typeof data.targetId === 'string' && [...PHYSICAL_ATTACKS, ...MAGICAL_ATTACKS].includes(data.subType as AttackType)) return { type: 'ATTACK', subType: data.subType as AttackType, targetId: data.targetId };
    if (data.type === 'DEFEND' && ['ACTIVE_DODGE','SHIELD_BLOCK','HEAL','PROTECT'].includes(data.subType as string) && (data.targetId === undefined || typeof data.targetId === 'string')) return { type: 'DEFEND', subType: data.subType as 'ACTIVE_DODGE', targetId: data.targetId as string | undefined };
    if (data.type === 'ITEM' && typeof data.targetId === 'string' && typeof data.itemId === 'string') return { type: 'ITEM', itemId: data.itemId, targetId: data.targetId };
    throw new Error('Ação de combate inválida.');
  }
}
