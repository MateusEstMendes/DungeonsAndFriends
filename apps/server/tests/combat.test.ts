import { afterEach, expect, it, vi } from 'vitest';
import { PlayerSchema, RoomState } from '@df/shared';
import { characterPayload } from '../../../packages/shared/tests/characterFixture.js';
import { openDatabase } from '../src/db/index.js';
import { characters, players } from '../src/db/schema.js';
import { prepareHost } from '../src/host.js';
import { prepareCharacter } from '../src/rooms/handlers/auth.js';
import { CombatHandler } from '../src/rooms/handlers/combat.js';
import { loadBoard, readBoard } from '../src/services/boardRepository.js';
import { eq } from 'drizzle-orm';
const databases: ReturnType<typeof openDatabase>[] = [];
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.restoreAllMocks(); });
function setup() {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  const database = openDatabase(':memory:'); databases.push(database);
  const { room } = prepareHost(database, 'test-password');
  const state = new RoomState(); loadBoard(state, readBoard(database));
  const saved = database.db.insert(players).values({ name: 'Hero', roomId: room.id, sessionToken: 'hero' }).returning().get();
  const character = database.db.insert(characters).values({ ...prepareCharacter(characterPayload()), playerId: saved.id, roomId: room.id,
    finalStr: 20, finalDex: 20, finalInt: 10, speed: 10, hp: 100, maxHp: 100 }).returning().get();
  const hero = Object.assign(new PlayerSchema(), { id: saved.id, characterId: character.id, hp: 100, maxHp: 100, status: 'READY', currentChamberId: 'training-1', q: 3, r: -1 });
  state.players.set(hero.id, hero);
  const master = Object.assign(new PlayerSchema(), { id: room.id, role: 'MASTER' });
  let now = 1000;
  const send = vi.fn();
  const combat = new CombatHandler(state, database, room.id, send, () => {}, faces => faces === 100 ? 100 : 10, () => now);
  return { database, room, state, hero, master, combat, send, wait: () => { now += 1300; } };
}
it('alerts the master only, orders initiative, rejects duplicates and forbids extra fleeing', () => {
  const { combat, state, hero, send, wait } = setup();
  combat.proximity(hero);
  expect(send).toHaveBeenCalledWith('PROXIMITY_ALERT', expect.objectContaining({ chamberId: 'training-1' }), 'MASTER');
  combat.start({ chamberId: 'training-1' });
  expect(state.sessionStatus).toBe('IN_COMBAT'); expect(state.combatState.activeParticipantId).toBe(hero.id);
  const action = { type: 'ATTACK', subType: 'SLASHING', targetId: 'training-1:monster', turnToken: state.combatState.turnToken };
  combat.action(hero, action);
  expect(state.combatState.remainingActions).toBe(1);
  for (let i = 0; i < 15; i++) expect(() => combat.action(hero, action)).toThrow();
  wait(); expect(() => combat.action(hero, action)).toThrow('expirado');
  expect(() => combat.action(hero, { type: 'FLEE', turnToken: state.combatState.turnToken })).toThrow('extra');
});
it('persists exact actions, HP, token, pause and initiative for restoration', () => {
  const { combat, database, room, hero, state } = setup();
  combat.start({ chamberId: 'training-1' });
  combat.action(hero, { type: 'ATTACK', subType: 'SLASHING', targetId: 'training-1:monster', turnToken: state.combatState.turnToken });
  combat.pause({ paused: true }); combat.fleeMode({ mode: 'BLOCKED' });
  const restored = new RoomState(); loadBoard(restored, readBoard(database)); restored.players.set(hero.id, hero);
  const handler = new CombatHandler(restored, database, room.id, () => {}, () => {}); handler.restore();
  expect(restored.combatState.toJSON()).toEqual(state.combatState.toJSON());
  expect(handler.snapshot()).toEqual(combat.snapshot());
});
it('honors pause, blocked and guaranteed flee, and validates initiative permutations', () => {
  const { combat, hero, state } = setup(); combat.start({ chamberId: 'training-1' });
  combat.pause({ paused: true });
  expect(() => combat.action(hero, { type: 'FLEE', turnToken: state.combatState.turnToken })).toThrow('Aguarde');
  combat.pause({ paused: false }); combat.fleeMode({ mode: 'BLOCKED' });
  expect(() => combat.action(hero, { type: 'FLEE', turnToken: state.combatState.turnToken })).toThrow('bloqueada');
  expect(() => combat.reorder({ turnOrder: [hero.id, hero.id] })).toThrow('Fila');
  combat.fleeMode({ mode: 'GUARANTEED_100' });
  combat.action(hero, { type: 'FLEE', turnToken: state.combatState.turnToken });
  expect(state.combatState.active).toBe(false);
});
it('allows the referee to skip to a monster and perform its action', () => {
  const { combat, hero, master, state, wait } = setup(); combat.start({ chamberId: 'training-1' });
  combat.skip(); wait();
  expect(state.combatState.activeParticipantId).toBe('training-1:monster');
  combat.action(master, { type: 'ATTACK', subType: 'SLASHING', targetId: hero.id, turnToken: state.combatState.turnToken }, true);
  expect(hero.hp).toBeLessThan(100);
});
it('uses phase 2 persisted attributes and phase 3 biome to resolve minimum damage', () => {
  const { combat, hero, state, database, send } = setup();
  database.db.update(characters).set({ finalStr: 6, raceId: 'HUMAN' }).where(eq(characters.id, hero.characterId)).run();
  state.chambers.get('training-1')!.biome = 'FOREST';
  combat.start({ chamberId: 'training-1' });
  expect(state.combatState.biome).toBe('FOREST');
  combat.action(hero, { type: 'ATTACK', subType: 'SLASHING', targetId: 'training-1:monster', turnToken: state.combatState.turnToken });
  expect(send).toHaveBeenCalledWith('COMBAT_EVENT', expect.objectContaining({ rawDamage: 4, damage: 1, drAbsorbed: 3 }), 'training-1');
});
it('consumes active dodge on the next incoming attack with zero damage on a winning counter-check', () => {
  const { combat, hero, master, state, wait, send } = setup(); combat.start({ chamberId: 'training-1' });
  combat.action(hero, { type: 'DEFEND', subType: 'ACTIVE_DODGE', turnToken: state.combatState.turnToken });
  wait(); combat.skip(); wait();
  combat.action(master, { type: 'ATTACK', subType: 'SLASHING', targetId: hero.id, turnToken: state.combatState.turnToken }, true);
  expect(hero.hp).toBe(100);
  expect(send).toHaveBeenCalledWith('COMBAT_EVENT', expect.objectContaining({ outcome: 'DODGED_ACTIVE', damage: 0, dodgeRoll: 15 }), 'training-1');
  expect(combat.snapshot().participants.find(p => p.id === hero.id)?.stance).toBe('');
});
it('applies warrior cooldowns and rejects abilities belonging to another archetype', () => {
  const { combat, hero, database, state, wait } = setup();
  database.db.update(characters).set({ archetypeId: 'WARRIOR' }).where(eq(characters.id, hero.characterId)).run();
  combat.start({ chamberId: 'training-1' });
  expect(() => combat.action(hero, { type: 'ATTACK', subType: 'ROGUE', targetId: 'training-1:monster', turnToken: state.combatState.turnToken })).toThrow('arquétipo');
  combat.action(hero, { type: 'ATTACK', subType: 'WARRIOR', targetId: 'training-1:monster', turnToken: state.combatState.turnToken });
  wait(); expect(() => combat.action(hero, { type: 'ATTACK', subType: 'WARRIOR', targetId: 'training-1:monster', turnToken: state.combatState.turnToken })).toThrow('recarga');
});
