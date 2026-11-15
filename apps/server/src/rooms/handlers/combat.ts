import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { calculateTotalActions, getModifier, getMonsterDefinition, hexDistance, isCharacterPresent, isMagicAttack, resolveAttack, resolveFlee, validateAction,
  CombatActionSchema, MasterSetMonsterAiSchema, MasterSetGlobalAiSchema, EMPTY_EQUIPMENT, canCastSpell, rollDamageDice,
  type CombatParticipant as Participant, type CombatAction, type CombatActionOption, type CombatEvent, type CombatTargetResult, type CombatBuffKind, type PlayerSchema, type RoomState } from '@df/shared';
import { activeBuffs, characters, combatEncounters, combatParticipants, monstersCatalog } from '../../db/schema.js';
import type { Database } from '../../services/boardRepository.js';
import { InventoryRepository } from '../../services/inventoryRepository.js';
import { DEFAULT_CUTOFFS, evaluateD20, roll, validateCutoffs, type D20Cutoffs } from '../../services/diceService.js';
import { decideMonsterAction } from '../ai/tacticalAi.js';
type Send = (name: string, data: unknown, audience: string) => void;
const signatures: Record<string, string> = { WARRIOR: 'Golpe Avassalador', BARBARIAN: 'Fúria Berserk', ROGUE: 'Ataque Furtivo' };
export class CombatHandler {
  private participants = new Map<string, Participant>();
  private cutoffs: D20Cutoffs = { ...DEFAULT_CUTOFFS };
  private unlockAt = 0;
  private encounterStatus: 'ACTIVE' | 'ENDED' | 'FLED' = 'ACTIVE';
  private alerts = new Map<string, string>();
  private controls = new Map<string, { isAutoMode: boolean; allowAutoFlee: boolean }>();
  private statusEvents: CombatEvent[] = [];
  private repository: InventoryRepository;
  constructor(private state: RoomState, private database: Database, private roomId: string,
    private send: Send, private refresh: () => void, private dice = roll, private now = Date.now,
    private inventorySync?: (player: PlayerSchema) => void) { this.repository = new InventoryRepository(database); }
  proximity(player: PlayerSchema) {
    if (this.state.combatState.active || !isCharacterPresent(player)) return;
    const nearby = [...this.state.monsters.values()].filter(m => !m.isHiddenByMaster && m.currentChamberId === player.currentChamberId && hexDistance(player, m) <= 2);
    const signature = nearby.map(m => m.id).sort().join(',');
    if (signature && this.alerts.get(player.id) !== signature) this.send('PROXIMITY_ALERT', { playerId: player.id, chamberId: player.currentChamberId, monsterIds: nearby.map(m => m.id), message: '[Inimigo próximo! Iniciar Combate]' }, 'MASTER');
    this.alerts.set(player.id, signature);
  }
  private playerParticipant(player: PlayerSchema): Participant {
    const row = this.database.db.select().from(characters).where(and(eq(characters.id, player.characterId), eq(characters.playerId, player.id), eq(characters.roomId, this.roomId))).get();
    if (!row) throw new Error('Ficha indisponível.');
    const participant: Participant = { id: player.id, characterId: row.id, kind: 'PLAYER', name: player.characterName || row.name,
      hp: row.hp, maxHp: row.maxHp, mp: row.mp, maxMp: row.maxMp, str: row.finalStr, dex: row.finalDex, int: row.finalInt, wis: row.finalWis,
      dexMod: getModifier(row.finalDex), speed: row.speed, baseSpeed: row.speed, raceId: row.raceId, archetypeId: row.archetypeId,
      defense: row.defense, passiveDodge: row.dodgeChance, flatDR: row.flatDr, baseDamage: 0, attackType: 'UNARMED',
      equipment: { ...EMPTY_EQUIPMENT }, spells: [], consumables: [], cooldowns: {}, buffs: [], actions: [], isAutoMode: false, allowAutoFlee: false };
    this.loadResources(participant); return participant;
  }
  private loadResources(p: Participant) {
    if (p.kind !== 'PLAYER' || !p.characterId) return;
    const row = this.database.db.select().from(characters).where(eq(characters.id, p.characterId)).get();
    if (!row) throw new Error('Ficha indisponível.');
    const snapshot = this.repository.snapshot(row);
    p.equipment = this.repository.equipment(row.id); p.spells = snapshot.spells;
    p.consumables = snapshot.items.filter(e => e.slot === 'BAG' && e.item.category === 'CONSUMABLE' && e.item.effect.type !== 'LEARN_SPELL')
      .map(e => ({ itemId: e.itemId, name: e.item.name, quantity: e.quantity }));
  }
  private options(p: Participant): CombatActionOption[] {
    const actions: CombatActionOption[] = [];
    const attack = (subType: Extract<CombatAction, {type:'ATTACK'}>['subType'], label: string, hand?: 'MAIN' | 'OFF', mpCost = 0) => actions.push({ label, action: { type: 'ATTACK', subType, hand, targetId: '' }, mpCost });
    if (p.kind === 'MONSTER') {
      const magic = isMagicAttack(p.attackType);
      attack(p.attackType, ({ SLASHING: 'Corte', BLUNT: 'Impacto', THRUST: 'Perfuração', UNARMED: 'Desarmado', FIRE: 'Fogo', ICE: 'Gelo', LIGHT: 'Luz', DARKNESS: 'Trevas', ARCANE: 'Arcano' } as Record<string,string>)[p.attackType] ?? 'Ataque', undefined, magic ? 10 : 0);
      if (magic) attack('UNARMED', 'Ataque básico');
    } else {
      const main = p.equipment.mainHand;
      attack(main && 'damageType' in main ? main.damageType : 'UNARMED', main && 'damageDice' in main ? main.name : 'Desarmado', 'MAIN');
      const off = p.equipment.offHand;
      if (off && 'damageType' in off) attack(off.damageType, `${off.name} · secundária`, 'OFF');
      if (signatures[p.archetypeId] && (p.cooldowns[p.archetypeId] ?? 0) <= this.state.combatState.round) attack(p.archetypeId as 'WARRIOR', signatures[p.archetypeId], 'MAIN');
      for (const spell of p.spells) actions.push({ label: spell.name, action: { type: 'SPELL', spellId: spell.id, targetId: '' }, mpCost: spell.mpCost });
      for (const item of p.consumables) actions.push({ label: item.name, action: { type: 'ITEM', itemId: item.itemId, targetId: '' }, quantity: item.quantity });
    }
    actions.push({ label: 'Esquiva Ativa', action: { type: 'DEFEND', subType: 'ACTIVE_DODGE' } });
    if (p.kind === 'MONSTER' || p.equipment.offHand?.category === 'SHIELD') actions.push({ label: 'Bloqueio de Escudo', action: { type: 'DEFEND', subType: 'SHIELD_BLOCK' } });
    if (p.kind === 'MONSTER' && isMagicAttack(p.attackType)) {
      actions.push({ label: 'Cura', action: { type: 'DEFEND', subType: 'HEAL', targetId: '' }, mpCost: 10 }, { label: 'Proteção', action: { type: 'DEFEND', subType: 'PROTECT', targetId: '' }, mpCost: 10 });
    }
    actions.push({ label: 'Fugir', action: { type: 'FLEE' } });
    return actions;
  }
  start(input: unknown) {
    const chamberId = this.object(input).chamberId;
    if (typeof chamberId !== 'string' || !this.state.chambers.has(chamberId) || this.state.combatState.active) throw new Error('Encontro indisponível.');
    const roster = new Map<string, Participant>();
    for (const player of this.state.players.values()) if (player.role === 'PLAYER' && isCharacterPresent(player) && player.currentChamberId === chamberId && player.hp > 0) roster.set(player.id, this.playerParticipant(player));
    const catalog = this.database.db.select().from(monstersCatalog).all();
    for (const monster of this.state.monsters.values()) {
      if (monster.currentChamberId !== chamberId || monster.isHiddenByMaster) continue;
      const definition = getMonsterDefinition(monster.name), row = catalog.find(c => c.name === monster.name || c.id === monster.name || c.id === definition?.id);
      if (!row) throw new Error(`Monstro sem ficha no catálogo: ${monster.name}`);
      const mode = this.controls.get(monster.id) ?? { isAutoMode: monster.isAutoMode || this.state.combatState.globalAiEnabled, allowAutoFlee: monster.allowAutoFlee };
      roster.set(monster.id, { id: monster.id, name: row.name, catalogName: row.name, kind: 'MONSTER', hp: row.hp, maxHp: row.hp, mp: row.mp, maxMp: row.mp,
        str: row.str, int: row.int, wis: row.int, dex: row.dex, dexMod: getModifier(row.dex), speed: row.speed, baseSpeed: row.speed, flatDR: row.flatDr,
        defense: 10 + getModifier(row.dex), passiveDodge: row.passiveDodge, archetypeId: '', baseDamage: row.baseDamage, attackType: row.attackType as Participant['attackType'],
        equipment: { ...EMPTY_EQUIPMENT }, spells: [], consumables: [], cooldowns: {}, buffs: [], actions: [], ...mode });
    }
    const monsters = [...roster.values()].filter(p => p.kind === 'MONSTER'), counts = new Map<string, number>();
    for (const monster of monsters) if (monsters.filter(p => p.catalogName === monster.catalogName).length > 1) {
      const index = (counts.get(monster.catalogName!) ?? 0) + 1; counts.set(monster.catalogName!, index); monster.name = `${monster.catalogName} ${index}`;
    }
    if (![...roster.values()].some(p => p.kind === 'PLAYER') || !monsters.length) throw new Error('São necessários heróis e monstros vivos na câmara.');
    const before = this.checkpoint();
    try {
      this.database.sqlite.transaction(() => {
        this.participants = roster; this.encounterStatus = 'ACTIVE'; this.unlockAt = this.now() + 1200;
        const c = this.state.combatState; c.encounterId = randomUUID(); c.chamberId = chamberId; c.active = true; c.round = 1; c.isPaused = false; c.fleeMode = 'NORMAL';
        const biome = this.state.chambers.get(chamberId)!.biome;
        c.biome = ['CAVE','FOREST','TAVERN','DUNGEON'].includes(biome) ? biome as typeof c.biome : 'DUNGEON';
        this.sortOrder([...roster.keys()]); c.activeParticipantId = c.turnOrder[0]; this.beginTurn(); this.state.sessionStatus = 'IN_COMBAT'; this.persist(true);
      }).immediate();
    } catch (error) { this.rollback(before); throw error; }
    // Humans may act immediately; automated monsters still wait for the intro window.
    if (this.participants.get(this.state.combatState.activeParticipantId)?.kind === 'PLAYER') this.unlockAt = 0;
    this.afterCommit();
  }
  action(player: PlayerSchema, input: unknown, manual = false, automatic = false) {
    const data = this.object(input), c = this.state.combatState;
    if (!c.active || c.isPaused || c.isProcessingAction || this.now() < this.unlockAt) throw new Error('Aguarde a resolução do turno.');
    if (data.turnToken !== c.turnToken) throw new Error('Turno expirado.');
    const actor = this.participants.get(c.activeParticipantId)!;
    if (manual ? player.role !== 'MASTER' || !player.connected || actor.kind !== 'MONSTER' : actor.id !== player.id || actor.kind !== 'PLAYER' || !player.connected) throw new Error('Não é seu turno.');
    if (manual && (automatic ? !actor.isAutoMode : actor.isAutoMode)) throw new Error('Retome o controle manual da criatura.');
    const { turnToken: _token, ...payload } = data, action = CombatActionSchema.parse(payload);
    if (automatic && action.type === 'FLEE' && !actor.allowAutoFlee) throw new Error('Fuga automática não autorizada.');
    const before = this.checkpoint();
    let event: CombatEvent;
    try {
      this.database.sqlite.transaction(() => {
        this.loadResources(actor);
        if (!validateAction(action, c.actionIndex, actor.str, actor.int)) throw new Error('Ação extra incompatível com FOR/INT.');
        if (action.type === 'ATTACK' && signatures[action.subType] && actor.archetypeId === action.subType && (actor.cooldowns[action.subType] ?? 0) > c.round) throw new Error('Habilidade em recarga.');
        const option = this.options(actor).find(o => this.sameAction(o.action, action));
        if (!option) throw new Error('Ação indisponível para esta criatura ou equipamento/arquétipo.');
        const selfDefense = action.type === 'DEFEND' && ['ACTIVE_DODGE','SHIELD_BLOCK'].includes(action.subType);
        const target = !selfDefense && 'targetId' in action && action.targetId ? this.participants.get(action.targetId) : actor;
        if (!target || target.absent || target.hp <= 0) throw new Error('Alvo inválido.');
        const spell = action.type === 'SPELL' ? actor.spells.find(s => s.id === action.spellId) : undefined;
        if (action.type === 'SPELL' && (!spell || !canCastSpell(actor.equipment, actor.mp, spell))) throw new Error('Feitiço requer foco mágico e MP suficiente.');
        const hostile = action.type === 'ATTACK' || (spell && spell.targetMode !== 'SINGLE_ALLY');
        if (hostile && target.kind === actor.kind) throw new Error('Selecione um inimigo.');
        if (!hostile && action.type !== 'FLEE' && target.kind !== actor.kind) throw new Error('Selecione um aliado.');
        if (action.type === 'FLEE' && c.fleeMode === 'BLOCKED') throw new Error('A fuga está bloqueada pelo Mestre.');
        c.isProcessingAction = true;
        event = this.event(actor, target, action.type);
        const dice = (faces: number) => { const value = this.dice(faces); event.rolls.push({ faces, value }); return value; };
        if (action.type === 'ATTACK') {
          const magic = isMagicAttack(action.subType), signature = !!signatures[action.subType];
          if (signature && (actor.cooldowns[action.subType] ?? 0) > c.round) throw new Error('Habilidade em recarga.');
          if (magic && actor.mp < 10) throw new Error('MP insuficiente.');
          if (action.subType === 'BARBARIAN') actor.berserkUntilRound = c.round + 2;
          const weapon = action.hand === 'OFF' ? actor.equipment.offHand : actor.equipment.mainHand;
          const natural = dice(20), mod = getModifier(magic ? actor.int : action.subType === 'ROGUE' ? actor.dex : actor.str);
          const base = actor.kind === 'PLAYER' ? rollDamageDice(weapon && 'damageDice' in weapon ? weapon.damageDice : '1d4', dice) : (action.subType === 'UNARMED' && magic === false && isMagicAttack(actor.attackType) ? 4 : actor.baseDamage);
          const result = this.hit(actor, target, base + mod + (signature && action.subType !== 'BARBARIAN' ? 4 : 0), natural, mod + (action.subType === 'ROGUE' ? 3 : 0), magic,
            !magic && !(weapon?.category === 'RANGED'), dice);
          actor.mp -= magic ? 10 : 0;
          if (signature) actor.cooldowns[action.subType] = c.round + (action.subType === 'ROGUE' ? 2 : 3);
          Object.assign(event, result, { roll: natural, rollOutcome: evaluateD20(natural, this.cutoffs), vfxType: action.subType }); event.targets.push(result);
          if ((actor.catalogName === 'Aranha Gigante' || getMonsterDefinition(actor.catalogName ?? actor.name)?.id === 'GIANT_SPIDER') && result.damage > 0) this.buff(target, 'POISON', 3, 2);
        } else if (action.type === 'SPELL' && spell) {
          actor.mp -= spell.mpCost; event.spellId = spell.id; event.vfxType = spell.element;
          const amount = rollDamageDice(spell.damageDice, dice) + (spell.attribute === 'WIS' ? Math.max(0, getModifier(actor.wis)) : getModifier(actor.int));
          if (spell.targetMode === 'SINGLE_ALLY') {
            const heal = Math.min(target.maxHp - target.hp, Math.max(0, amount)); target.hp += heal;
            const result = this.targetResult(target, 'HEALED', 0, heal); event.targets.push(result); Object.assign(event, result);
          } else {
            const targets = spell.targetMode === 'ALL_ENEMIES' ? this.alive(target.kind) : [target];
            for (const victim of targets) {
              const natural = dice(20), result = this.hit(actor, victim, amount, natural, getModifier(actor.int), true, false, dice);
              event.targets.push(result); if (victim.id === target.id) Object.assign(event, result, { roll: natural, rollOutcome: evaluateD20(natural, this.cutoffs) });
              if (spell.effect?.type === 'SLOW' && result.damage > 0) this.buff(victim, 'SLOW', spell.effect.speedPenalty, spell.effect.rounds);
            }
          }
        } else if (action.type === 'ITEM') {
          if (!actor.characterId) throw new Error('Consumível indisponível.');
          const entry = this.repository.bag(actor.characterId, action.itemId as import('@df/shared').ItemId), item = entry && this.repository.item(entry.itemId);
          if (!entry || item?.category !== 'CONSUMABLE' || item.effect.type === 'LEARN_SPELL') throw new Error('Consumível indisponível.');
          const effect = item.effect; this.repository.remove(entry, 1); event.itemId = item.id;
          let heal = 0, outcome = 'BUFFED';
          if (effect.type === 'RESTORE_HP') { heal = Math.min(effect.amount, target.maxHp - target.hp); target.hp += heal; outcome = 'HEALED'; }
          if (effect.type === 'RESTORE_MP') { heal = Math.min(effect.amount, target.maxMp - target.mp); target.mp += heal; outcome = 'MANA_RESTORED'; }
          if (effect.type === 'CURE_STATUS') { target.buffs = target.buffs.filter(b => b.kind !== effect.status); outcome = 'CURED'; }
          if (effect.type === 'MAGIC_DAMAGE') this.buff(target, 'MAGIC_BOOK', effect.amount, effect.rounds);
          if (effect.type === 'PHYSICAL_DAMAGE') this.buff(target, 'THE_JUICE', effect.multiplier, effect.rounds);
          const result = this.targetResult(target, outcome, 0, heal); event.targets.push(result); Object.assign(event, result); this.loadResources(actor);
        } else if (action.type === 'DEFEND') {
          let heal = 0, outcome: string = action.subType;
          if (action.subType === 'HEAL' || action.subType === 'PROTECT') {
            if (actor.mp < 10) throw new Error('MP insuficiente.'); actor.mp -= 10;
            if (action.subType === 'HEAL') { heal = Math.min(target.maxHp - target.hp, 12 + Math.max(0, getModifier(actor.int))); target.hp += heal; outcome = 'HEALED'; }
            else { target.stance = 'SHIELD_BLOCK'; target.shieldDR = 5; outcome = 'PROTECTED'; }
          } else { actor.stance = action.subType; actor.shieldDR = 2; }
          const result = this.targetResult(target, outcome, 0, heal); event.targets.push(result); Object.assign(event, result);
        } else if (action.type === 'FLEE') {
          const value = dice(100), fled = resolveFlee(actor.speed, this.alive(actor.kind === 'PLAYER' ? 'MONSTER' : 'PLAYER').map(p => p.speed), value,
            { fleeBlocked: c.fleeMode === 'BLOCKED', guaranteedFlee: c.fleeMode === 'GUARANTEED_100' });
          Object.assign(event, { outcome: fled ? 'FLED' : 'FLEE_FAILED', roll: value }); if (fled) this.finish('FLED');
        }
        if (c.active) {
          c.remainingActions--; c.actionIndex++;
          if (!this.alive('PLAYER').length || !this.alive('MONSTER').length) this.finish('ENDED');
          else if (c.remainingActions === 0 || actor.hp === 0) this.advance(); else c.turnToken = randomUUID();
        }
        c.isProcessingAction = false; this.unlockAt = this.now() + 1200; this.persist();
      }).immediate();
    } catch (error) { this.rollback(before); throw error; }
    this.afterCommit(event!);
  }
  private sameAction(a: CombatAction, b: CombatAction) {
    if (a.type !== b.type) return false;
    if (a.type === 'ATTACK' && b.type === 'ATTACK') return a.subType === b.subType && (a.hand ?? 'MAIN') === (b.hand ?? 'MAIN');
    if (a.type === 'SPELL' && b.type === 'SPELL') return a.spellId === b.spellId;
    if (a.type === 'ITEM' && b.type === 'ITEM') return a.itemId === b.itemId;
    if (a.type === 'DEFEND' && b.type === 'DEFEND') return a.subType === b.subType;
    return a.type === 'FLEE';
  }
  private event(actor: Participant, target: Participant, type: string): CombatEvent {
    return { id: randomUUID(), encounterId: this.state.combatState.encounterId, actorId: actor.id, actorName: actor.name, actorKind: actor.kind,
      targetId: target.id, targetName: target.name, targetKind: target.kind, targets: [], type, round: this.state.combatState.round,
      turnToken: this.state.combatState.turnToken, startedAt: this.now(), duration: 1200, rolls: [] };
  }
  private targetResult(target: Participant, outcome: string, damage = 0, healAmount = 0): CombatTargetResult {
    return { targetId: target.id, targetName: target.name, targetKind: target.kind, outcome, damage, drAbsorbed: 0, healAmount };
  }
  private hit(actor: Participant, target: Participant, base: number, natural: number, attackMod: number, magic: boolean, melee: boolean, dice: (faces: number) => number): CombatTargetResult {
    const round = this.state.combatState.round;
    const result = resolveAttack({ attacker: actor, defender: target, attackRoll: natural + attackMod, naturalRoll: natural,
      baseDamage: base + (!magic && (actor.berserkUntilRound ?? 0) > round ? 4 : 0) + ((target.berserkUntilRound ?? 0) > round ? 2 : 0),
      isMagic: magic, isMelee: melee, criticalFrom: this.cutoffs.criticalSuccess,
      physicalDamageMultiplier: actor.buffs.find(b => b.kind === 'THE_JUICE')?.amount,
      magicalDamageBonus: actor.buffs.find(b => b.kind === 'MAGIC_BOOK')?.amount }, dice);
    target.hp = Math.max(0, target.hp - result.finalDamage); actor.hp = Math.min(actor.maxHp, actor.hp + result.healAmount);
    if (target.stance === 'ACTIVE_DODGE') target.stance = '';
    return { ...this.targetResult(target, result.outcome, result.finalDamage, result.healAmount), ...result, attackRoll: natural + attackMod };
  }
  private buff(target: Participant, kind: CombatBuffKind, amount: number, remainingTurns: number) {
    target.buffs = target.buffs.filter(b => b.kind !== kind);
    target.buffs.push({ kind, amount, remainingTurns, appliedRound: this.state.combatState.round, skipFirstEnd: target.id === this.state.combatState.activeParticipantId });
    this.updateSpeed(target);
  }
  private updateSpeed(p: Participant) { p.speed = Math.max(1, p.baseSpeed - (p.buffs.find(b => b.kind === 'SLOW')?.amount ?? 0)); }
  private endTurn(actor: Participant) {
    for (const buff of actor.buffs) { if (buff.kind === 'SLOW' && buff.appliedRound === this.state.combatState.round) continue; if (buff.skipFirstEnd) buff.skipFirstEnd = false; else buff.remainingTurns--; }
    actor.buffs = actor.buffs.filter(b => b.remainingTurns > 0); this.updateSpeed(actor);
  }
  private beginTurn() {
    const c = this.state.combatState, actor = this.participants.get(c.activeParticipantId)!;
    if (actor.stance === 'SHIELD_BLOCK') { actor.stance = ''; actor.shieldDR = 0; }
    c.actionIndex = 0; c.remainingActions = calculateTotalActions(actor.str, actor.int).count; c.turnToken = randomUUID();
    const poison = actor.buffs.find(b => b.kind === 'POISON');
    if (poison) {
      const damage = Math.min(actor.hp, poison.amount); actor.hp -= damage;
      const event = this.event(actor, actor, 'STATUS'), result = this.targetResult(actor, 'POISONED', damage);
      event.targets = [result]; Object.assign(event, result); this.statusEvents.push(event);
    }
  }
  private sortOrder(ids: string[]) {
    const order = ids.sort((a, b) => { const aa = this.participants.get(a)!, bb = this.participants.get(b)!; return bb.speed - aa.speed || bb.dex - aa.dex || a.localeCompare(b); });
    for (const id of ids) { const p = this.participants.get(id)!; p.initiativeSpeed = p.speed; }
    this.state.combatState.turnOrder.splice(0, this.state.combatState.turnOrder.length, ...order);
  }
  private advance() {
    const c = this.state.combatState; this.endTurn(this.participants.get(c.activeParticipantId)!);
    for (let i = 0; i <= c.turnOrder.length; i++) {
      const index = c.turnOrder.indexOf(c.activeParticipantId), next = (index + 1) % c.turnOrder.length;
      if (next === 0) { c.round++; if ([...this.participants.values()].some(p => p.speed !== (p.initiativeSpeed ?? p.baseSpeed))) this.sortOrder([...c.turnOrder]); c.activeParticipantId = c.turnOrder[0]; }
      else c.activeParticipantId = c.turnOrder[next];
      const p = this.participants.get(c.activeParticipantId)!;
      if (p.absent || p.hp <= 0) continue;
      this.beginTurn();
      if (!this.alive('PLAYER').length || !this.alive('MONSTER').length) { this.finish('ENDED'); return; }
      if (p.hp > 0) return;
      this.endTurn(p);
    }
    this.finish('ENDED');
  }
  private alive(kind: Participant['kind']) { return [...this.participants.values()].filter(p => !p.absent && p.kind === kind && p.hp > 0); }
  private finish(status: 'ENDED' | 'FLED') {
    this.state.combatState.active = false; this.state.combatState.remainingActions = 0;
    this.state.sessionStatus = 'ACTIVE'; this.encounterStatus = status;
  }
  private requireActive() { if (!this.state.combatState.active) throw new Error('Não há combate ativo.'); }
  pause(input: unknown) { const value = this.object(input).paused; if (typeof value !== 'boolean') throw new Error('Pausa inválida.'); this.requireActive(); this.change(() => { this.state.combatState.isPaused = value; }); }
  fleeMode(input: unknown) { const value = this.object(input).mode; if (!['NORMAL','BLOCKED','GUARANTEED_100'].includes(value as string)) throw new Error('Modo inválido.'); this.requireActive(); this.change(() => { this.state.combatState.fleeMode = value as 'NORMAL' | 'BLOCKED' | 'GUARANTEED_100'; }); }
  reorder(input: unknown) {
    this.requireActive(); const order = this.object(input).turnOrder, c = this.state.combatState;
    if (!Array.isArray(order) || order.length !== c.turnOrder.length || new Set(order).size !== order.length || !order.every(id => typeof id === 'string' && c.turnOrder.includes(id))) throw new Error('Fila inválida.');
    this.change(() => { c.turnOrder.splice(0, c.turnOrder.length, ...order); for (const p of this.participants.values()) p.initiativeSpeed = p.speed; });
  }
  skip() { this.requireActive(); this.change(() => { this.advance(); this.unlockAt = this.now() + 1200; }); }
  end() { this.requireActive(); this.change(() => this.finish('ENDED')); }
  setCutoffs(input: unknown) { this.requireActive(); const data = this.object(input), cutoffs = { criticalFailure: data.criticalFailure as number, success: data.success as number, criticalSuccess: data.criticalSuccess as number }; validateCutoffs(cutoffs); this.change(() => { this.cutoffs = cutoffs; }); }
  setMonsterAi(input: unknown) {
    this.requireActive(); const { monsterId, ...mode } = MasterSetMonsterAiSchema.parse(input), p = this.participants.get(monsterId);
    if (!p || p.kind !== 'MONSTER') throw new Error('Criatura indisponível.');
    this.change(() => { Object.assign(p, mode); this.controls.set(p.id, mode); });
  }
  setGlobalAi(input: unknown) {
    this.requireActive(); const { enabled } = MasterSetGlobalAiSchema.parse(input);
    this.change(() => {
      this.state.combatState.globalAiEnabled = enabled;
      for (const m of this.state.monsters.values()) this.controls.set(m.id, { isAutoMode: enabled, allowAutoFlee: this.controls.get(m.id)?.allowAutoFlee ?? m.allowAutoFlee });
      for (const p of this.participants.values()) if (p.kind === 'MONSTER') { p.isAutoMode = enabled; this.controls.set(p.id, { isAutoMode: enabled, allowAutoFlee: p.allowAutoFlee }); }
    });
  }
  syncMonsterModes() {
    for (const m of this.state.monsters.values()) {
      const mode = this.controls.get(m.id) ?? { isAutoMode: this.state.combatState.globalAiEnabled, allowAutoFlee: false };
      Object.assign(m, mode);
    }
  }
  tick() {
    const c = this.state.combatState, actor = this.participants.get(c.activeParticipantId);
    const master = [...this.state.players.values()].find(p => p.role === 'MASTER' && p.connected);
    if (!c.active || c.isPaused || c.isProcessingAction || this.now() < this.unlockAt || !master || actor?.kind !== 'MONSTER' || !actor.isAutoMode) return;
    actor.actions = this.options(actor);
    const action = decideMonsterAction({ monster: actor, participants: [...this.participants.values()], actionIndex: c.actionIndex, fleeBlocked: c.fleeMode === 'BLOCKED' });
    try {
      if (action) this.action(master, { ...action, turnToken: c.turnToken }, true, true);
      else this.change(() => {
        const event = this.event(actor, actor, 'PASS'); event.outcome = 'PASSED'; event.reason = 'Sem ação válida para o orçamento restante.';
        this.statusEvents.push(event); this.advance(); this.unlockAt = this.now() + 1200;
      });
    } catch { this.unlockAt = this.now() + 1200; this.send('ACTION_ERROR', 'A IA não conseguiu confirmar a ação; estado preservado para nova tentativa.', 'MASTER'); }
  }
  removePlayer(id: string) {
    const c = this.state.combatState, participant = this.participants.get(id);
    if (!c.active || !participant || participant.absent || participant.kind !== 'PLAYER') return;
    this.change(() => {
      participant.absent = true;
      if (!this.alive('PLAYER').length) this.finish('ENDED'); else if (c.activeParticipantId === id) this.advance();
      const index = c.turnOrder.indexOf(id); if (index >= 0) c.turnOrder.splice(index, 1);
    });
  }
  addPlayer(input: unknown) {
    this.requireActive(); const id = this.object(input).targetPlayerId, player = typeof id === 'string' ? this.state.players.get(id) : undefined, c = this.state.combatState;
    if (!player || player.role !== 'PLAYER' || !player.connected || !isCharacterPresent(player) || player.currentChamberId !== c.chamberId || player.hp <= 0 || c.turnOrder.includes(player.id)) throw new Error('Personagem indisponível para este combate.');
    this.change(() => {
      const previous = this.participants.get(player.id), fresh = this.playerParticipant(player);
      this.participants.set(player.id, previous ? { ...previous, absent: false, hp: fresh.hp, mp: fresh.mp, equipment: fresh.equipment, spells: fresh.spells, consumables: fresh.consumables } : fresh);
      c.turnOrder.push(player.id);
    });
  }
  private checkpoint() {
    return { combat: this.state.combatState.toJSON(), participants: structuredClone([...this.participants.entries()]), controls: structuredClone([...this.controls.entries()]),
      status: this.encounterStatus, sessionStatus: this.state.sessionStatus, cutoffs: { ...this.cutoffs }, unlockAt: this.unlockAt, statusEvents: [...this.statusEvents] };
  }
  private rollback(before: ReturnType<CombatHandler['checkpoint']>) {
    const { turnOrder, ...fields } = before.combat; Object.assign(this.state.combatState, fields);
    this.state.combatState.turnOrder.splice(0, this.state.combatState.turnOrder.length, ...turnOrder);
    this.participants = new Map(before.participants); this.controls = new Map(before.controls); this.encounterStatus = before.status;
    this.state.sessionStatus = before.sessionStatus; this.cutoffs = before.cutoffs; this.unlockAt = before.unlockAt; this.statusEvents = before.statusEvents;
  }
  private change(work: () => void) {
    const before = this.checkpoint();
    try { this.database.sqlite.transaction(() => { work(); this.persist(); }).immediate(); } catch (error) { this.rollback(before); throw error; }
    this.afterCommit();
  }
  private afterCommit(event?: CombatEvent) {
    for (const p of this.participants.values()) {
      const entity = this.state.players.get(p.id);
      if (entity) { entity.hp = p.hp; entity.mp = p.mp; this.inventorySync?.(entity); }
      if (p.kind === 'MONSTER') this.controls.set(p.id, { isAutoMode: p.isAutoMode, allowAutoFlee: p.allowAutoFlee });
    }
    this.syncMonsterModes(); this.publish();
    for (const entry of [...(event ? [event] : []), ...this.statusEvents]) {
      this.send('COMBAT_EVENT', entry, this.state.combatState.chamberId); console.info(JSON.stringify({ audit: 'combat', ...entry }));
    }
    this.statusEvents = [];
  }
  private publish() { this.send('COMBAT_ROSTER', this.snapshot(), this.state.combatState.chamberId); this.refresh(); }
  snapshot() {
    for (const p of this.participants.values()) p.actions = this.options(p);
    return { encounterId: this.state.combatState.encounterId, participants: [...this.participants.values()].filter(p => !p.absent), cutoffs: this.cutoffs };
  }
  private persist(create = false) {
    const c = this.state.combatState;
    const values = { status: this.encounterStatus, roomId: this.roomId, chamberId: c.chamberId, biome: c.biome, round: c.round, turnOrderJson: JSON.stringify([...c.turnOrder]), activeParticipantId: c.activeParticipantId,
      remainingActions: c.remainingActions, actionIndex: c.actionIndex, fleeMode: c.fleeMode, isPaused: c.isPaused, globalAiEnabled: c.globalAiEnabled, turnToken: c.turnToken, cutoffsJson: JSON.stringify(this.cutoffs), updatedAt: this.now() };
    this.database.db.transaction(db => {
      if (create) db.insert(combatEncounters).values({ id: c.encounterId, ...values }).run(); else db.update(combatEncounters).set(values).where(eq(combatEncounters.id, c.encounterId)).run();
      db.delete(combatParticipants).where(eq(combatParticipants.encounterId, c.encounterId)).run(); db.delete(activeBuffs).where(eq(activeBuffs.encounterId, c.encounterId)).run();
      for (const p of this.participants.values()) {
        p.actions = this.options(p);
        db.insert(combatParticipants).values({ id: p.id, encounterId: c.encounterId, kind: p.kind, statsJson: JSON.stringify(p), hp: p.hp, mp: p.mp }).run();
        if (p.kind === 'PLAYER' && p.characterId) db.update(characters).set({ hp: p.hp, mp: p.mp }).where(eq(characters.id, p.characterId)).run();
        for (const buff of p.buffs) db.insert(activeBuffs).values({ id: randomUUID(), encounterId: c.encounterId, participantId: p.id, kind: buff.kind, amount: buff.kind === 'THE_JUICE' ? Math.round(buff.amount * 100) : buff.amount, expiresRound: c.round + buff.remainingTurns }).run();
        if (p.stance) db.insert(activeBuffs).values({ id: randomUUID(), encounterId: c.encounterId, participantId: p.id, kind: p.stance, amount: p.shieldDR ?? 0, expiresRound: c.round + 1 }).run();
        if ((p.berserkUntilRound ?? 0) > c.round) db.insert(activeBuffs).values({ id: randomUUID(), encounterId: c.encounterId, participantId: p.id, kind: 'BERSERK', amount: 4, expiresRound: p.berserkUntilRound! }).run();
      }
    });
  }
  restore() {
    const row = this.database.db.select().from(combatEncounters).where(and(eq(combatEncounters.roomId, this.roomId), eq(combatEncounters.status, 'ACTIVE'))).get()
      ?? this.database.db.select().from(combatEncounters).where(eq(combatEncounters.roomId, this.roomId)).orderBy(desc(combatEncounters.updatedAt)).get();
    if (!row) return;
    this.state.combatState.globalAiEnabled = row.globalAiEnabled;
    const saved = this.database.db.select().from(combatParticipants).where(eq(combatParticipants.encounterId, row.id)).all();
    for (const entry of saved) if (entry.kind === 'MONSTER') {
      const data = JSON.parse(entry.statsJson); this.controls.set(entry.id, { isAutoMode: data.isAutoMode ?? false, allowAutoFlee: data.allowAutoFlee ?? false });
    }
    this.syncMonsterModes(); if (row.status !== 'ACTIVE') return;
    this.participants.clear();
    for (const entry of saved) {
      const data = JSON.parse(entry.statsJson), player = this.state.players.get(entry.id);
      const characterId = data.characterId ?? player?.characterId;
      const character = entry.kind === 'PLAYER' && characterId ? this.database.db.select().from(characters).where(eq(characters.id, characterId)).get() : undefined;
      const p: Participant = { ...data, hp: entry.hp, mp: entry.mp, wis: data.wis ?? character?.finalWis ?? data.int, baseSpeed: data.baseSpeed ?? data.speed,
        equipment: data.equipment ?? { ...EMPTY_EQUIPMENT }, spells: data.spells ?? [], consumables: data.consumables ?? [], buffs: data.buffs ?? [], actions: [],
        isAutoMode: data.isAutoMode ?? false, allowAutoFlee: data.allowAutoFlee ?? false, characterId };
      if (p.defense === undefined) p.defense = character?.defense ?? 10 + p.dexMod;
      this.loadResources(p); delete (p as unknown as Record<string, unknown>).potions; this.participants.set(p.id, p);
    }
    const order: string[] = JSON.parse(row.turnOrderJson), cutoffs: D20Cutoffs = JSON.parse(row.cutoffsJson); validateCutoffs(cutoffs);
    const actor = this.participants.get(row.activeParticipantId);
    if (!Array.isArray(order) || !order.length || new Set(order).size !== order.length || !order.every(id => this.participants.has(id)) || !actor || actor.hp <= 0 || !order.includes(actor.id)
      || row.round < 1 || row.remainingActions < 1 || row.actionIndex < 0 || row.remainingActions + row.actionIndex !== calculateTotalActions(actor.str, actor.int).count) throw new Error('Encontro persistido inconsistente.');
    const c = this.state.combatState;
    Object.assign(c, { active: true, encounterId: row.id, chamberId: row.chamberId, biome: row.biome, round: row.round, activeParticipantId: row.activeParticipantId,
      remainingActions: row.remainingActions, actionIndex: row.actionIndex, fleeMode: row.fleeMode, isPaused: row.isPaused, turnToken: row.turnToken });
    c.turnOrder.splice(0, c.turnOrder.length, ...order); this.cutoffs = cutoffs;
    this.encounterStatus = 'ACTIVE'; this.unlockAt = actor.kind === 'MONSTER' ? this.now() + 1200 : 0; c.isProcessingAction = false; this.state.sessionStatus = 'IN_COMBAT';
  }
  private object(input: unknown): Record<string, unknown> { if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Comando inválido.'); return input as Record<string, unknown>; }
}
