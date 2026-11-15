import { randomUUID } from 'node:crypto';
import { CHAT_TTL_MS, SESSION_LOG_LIMIT, ChatMessageSchema, RollDiceSchema, isCharacterPresent, type CombatEvent, type DiceResult,
  type EphemeralChatMessage, type PlayerSchema, type RoomState, type SessionLogEntry } from '@df/shared';
import { diceService } from '../../services/diceService.js';

export type ChamberSend = (name: string, payload: unknown, chamberId: string) => void;
/** Session history stays in memory; chat is broadcast once and never retained here. */
export class ChatAndLogHandler {
  private entries: SessionLogEntry[] = [];
  constructor(private state: RoomState, private send: ChamberSend, private roll = diceService.roll, private now = Date.now) {}
  private chamber(actor: PlayerSchema, requested?: string) {
    if (this.state.players.get(actor.id) !== actor || !actor.connected
      || (actor.role !== 'MASTER' && (!isCharacterPresent(actor) || !actor.characterId))) throw new Error('Ação não autorizada.');
    if (actor.role === 'PLAYER' && requested && requested !== actor.currentChamberId) throw new Error('Selecione sua câmara atual.');
    const id = actor.role === 'PLAYER' ? actor.currentChamberId : requested ?? (this.state.combatState.active ? this.state.combatState.chamberId
      : [...this.state.chambers.values()].find(c => c.mapId === this.state.activeStageId)?.id);
    if (!id || !this.state.chambers.has(id)) throw new Error('Câmara indisponível.');
    return id;
  }
  chat(actor: PlayerSchema, input: unknown) {
    const data = ChatMessageSchema.parse(input), chamberId = this.chamber(actor, data.chamberId), createdAt = this.now();
    const message: EphemeralChatMessage = { id: randomUUID(), actorId: actor.id, actorName: actor.characterName || actor.name, actorKind: actor.role,
      chamberId, text: data.text, createdAt, expiresAt: createdAt + CHAT_TTL_MS };
    this.send('CHAT_MESSAGE', message, chamberId);
  }
  rollDice(actor: PlayerSchema, input: unknown) {
    const data = RollDiceSchema.parse(input), chamberId = this.chamber(actor, data.chamberId);
    const value = this.roll(data.faces);
    if (!Number.isInteger(value) || value < 1 || value > data.faces) throw new Error('Rolagem inválida.');
    const result: DiceResult = { id: randomUUID(), actorId: actor.id, actorName: actor.characterName || actor.name, chamberId, faces: data.faces, value, createdAt: this.now() };
    this.send('DICE_RESULT', result, chamberId);
    this.record({ id: result.id, chamberId, createdAt: result.createdAt, type: 'DICE', result });
  }
  recordCombat(event: CombatEvent, chamberId: string) {
    this.record({ id: event.id, chamberId, createdAt: event.startedAt, type: 'COMBAT', event });
  }
  private record(entry: SessionLogEntry) {
    if (this.entries.some(e => e.id === entry.id)) return;
    this.entries.push(entry); this.entries = this.entries.slice(-SESSION_LOG_LIMIT);
    this.send('LOG_ENTRY', entry, entry.chamberId);
  }
  history(actor: PlayerSchema): SessionLogEntry[] {
    if (actor.role === 'MASTER' && actor.connected && this.state.players.get(actor.id) === actor) return [...this.entries];
    if (!isCharacterPresent(actor) || !actor.connected || this.state.players.get(actor.id) !== actor) return [];
    return this.entries.filter(e => e.chamberId === actor.currentChamberId);
  }
}
