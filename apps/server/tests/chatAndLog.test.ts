import { expect, it, vi } from 'vitest';
import { CHAT_TTL_MS, PlayerSchema, RoomState, SESSION_LOG_LIMIT, type CombatEvent } from '@df/shared';
import { openDatabase } from '../src/db/index.js';
import { loadBoard, readBoard } from '../src/services/boardRepository.js';
import { ChatAndLogHandler } from '../src/rooms/handlers/chatAndLog.js';
function setup() {
  const database = openDatabase(':memory:'), state = new RoomState(); loadBoard(state, readBoard(database)); state.activeStageId = 'training';
  const actor = Object.assign(new PlayerSchema(), { id: 'hero', characterId: 'character', characterName: 'Ael', name: 'Ana', status: 'READY', connected: true, currentChamberId: 'training-1' });
  const master = Object.assign(new PlayerSchema(), { id: 'master', name: 'Mestre', role: 'MASTER', connected: true }); state.players.set(actor.id, actor); state.players.set(master.id, master);
  const send = vi.fn(), dice = vi.fn((faces: number) => faces), chat = new ChatAndLogHandler(state, send, dice, () => 1000);
  return { database, state, actor, master, send, dice, chat };
}
it('broadcasts trimmed ephemeral chat with a 7s TTL without writing SQLite or retaining history', () => {
  const { database, actor, send, chat } = setup();
  try {
    const before = database.sqlite.prepare('SELECT total_changes() changes').get();
    chat.chat(actor, { text: '  Olá mesa!  ' });
    expect(send).toHaveBeenCalledWith('CHAT_MESSAGE', expect.objectContaining({ actorId: actor.id, actorName: 'Ael', actorKind: 'PLAYER', text: 'Olá mesa!', createdAt: 1000, expiresAt: 1000 + CHAT_TTL_MS }), 'training-1');
    expect(chat.history(actor)).toEqual([]); expect(database.sqlite.prepare('SELECT total_changes() changes').get()).toEqual(before);
  } finally { database.close(); }
});
it('validates dice and routes players to their chamber while allowing an explicit master chamber', () => {
  const { database, state, actor, master, send, dice, chat } = setup();
  try {
    expect(() => chat.rollDice(actor, { faces: 7 })).toThrow(); expect(dice).not.toHaveBeenCalled();
    expect(() => chat.chat(actor, { text: 'Hi', chamberId: 'training-2' })).toThrow('atual');
    actor.status = 'PENDING_APPROVAL'; expect(() => chat.chat(actor, { text: 'Hi' })).toThrow('autorizada'); actor.status = 'READY';
    actor.awaitingPosition = true; expect(() => chat.rollDice(actor, { faces: 20 })).toThrow(); actor.awaitingPosition = false;
    chat.rollDice(actor, { faces: 100 }); expect(dice).toHaveBeenCalledWith(100);
    expect(send).toHaveBeenCalledWith('DICE_RESULT', expect.objectContaining({ value: 100, faces: 100, actorName: 'Ael' }), 'training-1');
    expect(send).toHaveBeenCalledWith('LOG_ENTRY', expect.objectContaining({ type: 'DICE' }), 'training-1');
    state.combatState.active = true; state.combatState.chamberId = 'training-2';
    chat.chat(master, { text: 'Arbitragem' }); expect(send).toHaveBeenLastCalledWith('CHAT_MESSAGE', expect.objectContaining({ actorKind: 'MASTER' }), 'training-2');
    chat.rollDice(master, { faces: 4, chamberId: 'training-3' }); expect(send).toHaveBeenLastCalledWith('LOG_ENTRY', expect.objectContaining({ chamberId: 'training-3' }), 'training-3');
    expect(chat.history(actor)).toHaveLength(1); expect(chat.history(master)).toHaveLength(2);
  } finally { database.close(); }
});
it('keeps bounded deduplicated combat/dice history and forgets it on a new session handler', () => {
  const { database, state, actor, master, send, chat } = setup();
  try {
    const event: CombatEvent = { id: 'event', encounterId: 'encounter', actorId: 'goblin', actorName: 'Goblin', actorKind: 'MONSTER', targetId: actor.id, targetName: 'Ael', targetKind: 'PLAYER', targets: [], type: 'ATTACK', round: 1, startedAt: 1000, duration: 1200, rolls: [], outcome: 'HIT', damage: 5 };
    chat.recordCombat(event, 'training-1'); chat.recordCombat(event, 'training-1'); expect(chat.history(actor)).toHaveLength(1);
    for (let i = 0; i < SESSION_LOG_LIMIT + 5; i++) chat.rollDice(master, { faces: 6, chamberId: 'training-2' });
    expect(chat.history(master)).toHaveLength(SESSION_LOG_LIMIT); expect(chat.history(actor)).toEqual([]);
    expect(new ChatAndLogHandler(state, send).history(master)).toEqual([]);
  } finally { database.close(); }
});
