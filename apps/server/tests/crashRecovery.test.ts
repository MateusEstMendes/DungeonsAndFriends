import { afterEach, expect, it, vi } from 'vitest';
import { RoomState, PlayerSchema } from '@df/shared';
import { openDatabase } from '../src/db/index.js';
import { prepareHost } from '../src/host.js';
import { characters, players, crashRecoveryCheckpoints } from '../src/db/schema.js';
import { prepareCharacter } from '../src/rooms/handlers/auth.js';
import { characterPayload } from '../../../packages/shared/tests/characterFixture.js';
import { CombatHandler } from '../src/rooms/handlers/combat.js';
import { loadBoard, readBoard } from '../src/services/boardRepository.js';
import { saveCheckpoint, detectInterruptedSession, closeSession } from '../src/services/crashRecoveryService.js';
const connections: ReturnType<typeof openDatabase>[] = [];
afterEach(() => { connections.forEach(d => d.close()); connections.length = 0; vi.restoreAllMocks(); });
function setup() {
  const db = openDatabase(':memory:'); connections.push(db);
  const { room } = prepareHost(db, 'recovery-password');
  const state = new RoomState(); loadBoard(state, readBoard(db));
  for (const name of ['Ana', 'Bia']) {
    const player = db.db.insert(players).values({ name, roomId: room.id, sessionToken: name }).returning().get();
    const character = db.db.insert(characters).values({ ...prepareCharacter(characterPayload()), playerId: player.id, roomId: room.id, finalStr: 20, finalDex: 20, speed: 10 }).returning().get();
    state.players.set(player.id, Object.assign(new PlayerSchema(), { id: player.id, name, characterId: character.id, characterName: name, connected: true, status: 'READY', hp: character.hp, currentChamberId: 'training-1', q: 3, r: -1 }));
  }
  const combat = new CombatHandler(state, db, room.id, () => {}, () => {}, () => 10);
  return { db, room, state, combat };
}
it('restores initiative, consumed action budget, token, AI and absence without executing AI on boot', () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  const { db, room, state, combat } = setup();
  const [ana, bia] = [...state.players.values()];
  combat.start({ chamberId: 'training-1' }); combat.removePlayer(bia.id);
  combat.setGlobalAi({ enabled: true });
  combat.action(ana, { type: 'DEFEND', subType: 'ACTIVE_DODGE', turnToken: state.combatState.turnToken });
  db.sqlite.transaction(() => saveCheckpoint(db, room.id, state, 'COMBAT_ACTION'))();
  const before = state.combatState.toJSON();
  expect(detectInterruptedSession(db, room.id)).toMatchObject({ inCombat: true, round: before.round, heroes: ['Ana', 'Bia'] });
  for (const player of state.players.values()) player.connected = false;
  const restored = new CombatHandler(state, db, room.id, () => {}, () => {}); restored.restore();
  expect(state.combatState.toJSON()).toMatchObject({ turnToken: before.turnToken, remainingActions: before.remainingActions, actionIndex: before.actionIndex, globalAiEnabled: true });
  expect(restored.snapshot().participants.map(p => p.id)).toContain(ana.id);
  expect(restored.snapshot().participants.map(p => p.id)).not.toContain(bia.id);
  state.combatState.isPaused = true; restored.tick();
  expect(state.combatState.turnToken).toBe(before.turnToken);
  expect(() => restored.action(ana, { type: 'DEFEND', subType: 'ACTIVE_DODGE', turnToken: before.turnToken })).toThrow();
});
it('commits data and checkpoint together, rolls back both, and closes without a recovery prompt', () => {
  const { db, room, state } = setup();
  saveCheckpoint(db, room.id, state, 'SESSION_INITIALIZED');
  expect(detectInterruptedSession(db, room.id)).toBeUndefined();
  expect(() => db.sqlite.transaction(() => {
    db.sqlite.prepare('UPDATE characters SET gold=123').run();
    saveCheckpoint(db, room.id, state, 'BUY_ITEM'); throw new Error('disk error');
  })()).toThrow('disk error');
  expect(db.db.select().from(crashRecoveryCheckpoints).get()!.lastEventType).toBe('SESSION_INITIALIZED');
  expect(db.db.select().from(characters).all().every(c => c.gold !== 123)).toBe(true);
  saveCheckpoint(db, room.id, state, 'REQUEST_MOVE'); expect(detectInterruptedSession(db, room.id)).toBeDefined();
  db.sqlite.transaction(() => closeSession(db, room.id))();
  expect(detectInterruptedSession(db, room.id)).toBeUndefined();
  expect(db.sqlite.prepare("SELECT status FROM sessions").get()).toEqual({ status: 'CLOSED' });
});
