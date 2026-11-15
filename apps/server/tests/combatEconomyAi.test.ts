import { afterEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { MonsterSchema, PlayerSchema, RoomState, type CombatAction, type CombatEvent } from '@df/shared';
import { openDatabase } from '../src/db/index.js';
import { prepareHost } from '../src/host.js';
import { prepareCharacter } from '../src/rooms/handlers/auth.js';
import { grantStarterKit } from '../src/db/seedEconomy.js';
import { CombatHandler } from '../src/rooms/handlers/combat.js';
import { InventoryRepository } from '../src/services/inventoryRepository.js';
import { loadBoard, readBoard } from '../src/services/boardRepository.js';
import { characterPayload } from '../../../packages/shared/tests/characterFixture.js';
import * as s from '../src/db/schema.js';
const databases: ReturnType<typeof openDatabase>[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); vi.restoreAllMocks(); });
function setup(monsters = ['Goblin', 'Goblin'], archetype: 'MAGE' | 'WARRIOR' = 'MAGE') {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  const database = openDatabase(':memory:'); databases.push(database); const { db } = database, { room } = prepareHost(database, 'password');
  const saved = db.insert(s.players).values({ roomId: room.id, name: 'Ael', sessionToken: 'hero', approvalStatus: 'APPROVED' }).returning().get();
  const created = db.insert(s.characters).values({ ...prepareCharacter({ ...characterPayload(), archetypeId: archetype }), playerId: saved.id, roomId: room.id }).returning().get();
  grantStarterKit(db, created.id); db.update(s.players).set({ characterId: created.id }).where(eq(s.players.id, saved.id)).run();
  db.update(s.characters).set({ hp: 100, maxHp: 100, mp: 100, maxMp: 100, finalStr: archetype === 'MAGE' ? 10 : 20, finalInt: archetype === 'MAGE' ? 20 : 10, finalWis: 16,
    defense: 5, dodgeChance: 0, speed: 20, flatDr: 0 }).where(eq(s.characters.id, created.id)).run();
  db.update(s.monstersCatalog).set({ hp: 200, passiveDodge: 0 }).run();
  const state = new RoomState(); loadBoard(state, readBoard(database)); state.monsters.clear();
  monsters.forEach((name,i) => { db.insert(s.placedObjects).values({ id: `monster-${i}`, name, kind: 'MONSTER', chamberId: 'training-1', q: i, r: 1 }).run(); state.monsters.set(`monster-${i}`, Object.assign(new MonsterSchema(), { id: `monster-${i}`, name, currentChamberId: 'training-1', q: i, r: 1 })); });
  const hero = Object.assign(new PlayerSchema(), { id: saved.id, characterId: created.id, characterName: 'Ael', hp: 100, status: 'READY', connected: true, currentChamberId: 'training-1', q: 0, r: 0 });
  const master = Object.assign(new PlayerSchema(), { id: room.id, name: 'Mestre', role: 'MASTER', connected: true });
  state.players.set(hero.id, hero); state.players.set(master.id, master);
  let now = 1000; const send = vi.fn(), repository = new InventoryRepository(database);
  const combat = new CombatHandler(state, database, room.id, send, () => {}, f => f === 100 ? 100 : f === 20 ? 15 : 2, () => now);
  const wait = () => { now += 1300; }, actor = (id = hero.id) => combat.snapshot().participants.find(p => p.id === id)!;
  const act = (action: CombatAction) => { combat.action(hero, { ...action, turnToken: state.combatState.turnToken }); wait(); };
  const nextHero = () => { for (let i = 0; state.combatState.active && state.combatState.activeParticipantId !== hero.id && i < 10; i++) { combat.skip(); wait(); } };
  const events = () => send.mock.calls.filter(c => c[0] === 'COMBAT_EVENT').map(c => c[1] as CombatEvent);
  return { database, db, room, state, hero, master, created, combat, repository, send, wait, actor, act, nextHero, events };
}
it('loads actual equipment/grimoire, rejects invented attacks, and charges AoE MP once for all living opponents', () => {
  const t = setup(); t.db.insert(s.characterGrimoire).values({ characterId: t.created.id, spellId: 'IGNEOUS_BLAST' }).run(); t.combat.start({ chamberId: 'training-1' });
  expect(t.actor().actions.map(a => a.label)).toEqual(expect.arrayContaining(['Desarmado', 'Dardo Arcano', 'Explosão Ígnea', 'Poção de Vida']));
  expect(() => t.act({ type: 'ATTACK', subType: 'FIRE', targetId: 'monster-0' })).toThrow('indisponível');
  t.act({ type: 'SPELL', spellId: 'IGNEOUS_BLAST', targetId: 'monster-0' });
  expect(t.actor().mp).toBe(90); expect(t.actor('monster-0').hp).toBe(191); expect(t.actor('monster-1').hp).toBe(191);
  expect(t.events().at(-1)).toMatchObject({ spellId: 'IGNEOUS_BLAST', targets: [{ targetId: 'monster-0', damage: 9 }, { targetId: 'monster-1', damage: 9 }] });
  expect(t.db.select().from(s.characters).get()?.mp).toBe(90);
});
it('requires learned magic, a real focus, MP and valid allies/enemies without spending on rejection', () => {
  const t = setup(); t.db.update(s.inventories).set({ slot: 'BAG' }).where(eq(s.inventories.itemId, 'ARCANE_STAFF')).run(); t.combat.start({ chamberId: 'training-1' });
  const before = structuredClone(t.combat.snapshot()), token = t.state.combatState.turnToken;
  expect(() => t.act({ type: 'SPELL', spellId: 'ARCANE_DART', targetId: 'monster-0' })).toThrow('foco');
  expect(t.combat.snapshot()).toEqual(before); expect(t.state.combatState.turnToken).toBe(token);
  t.db.update(s.inventories).set({ slot: 'MAIN_HAND' }).where(eq(s.inventories.itemId, 'ARCANE_STAFF')).run();
  expect(() => t.act({ type: 'SPELL', spellId: 'ARCANE_DART', targetId: t.hero.id })).toThrow('inimigo');
  expect(() => t.act({ type: 'SPELL', spellId: 'HEALING_LIGHT', targetId: t.hero.id })).toThrow('indisponível');
});
it('heals with Wisdom, restores mana from a real bag, and does not invent potions when the bag is empty', () => {
  const t = setup(); t.db.update(s.characters).set({ hp: 50, mp: 10 }).where(eq(s.characters.id, t.created.id)).run();
  t.db.insert(s.characterGrimoire).values({ characterId: t.created.id, spellId: 'HEALING_LIGHT' }).run(); t.repository.addBag(t.created.id, 'MANA_POTION', 1);
  t.combat.start({ chamberId: 'training-1' }); t.act({ type: 'SPELL', spellId: 'HEALING_LIGHT', targetId: t.hero.id }); expect(t.actor()).toMatchObject({ hp: 57, mp: 4 });
  expect(() => t.act({ type: 'SPELL', spellId: 'HEALING_LIGHT', targetId: t.hero.id })).toThrow('MP');
  t.combat.skip(); t.wait(); t.nextHero(); t.act({ type: 'ITEM', itemId: 'MANA_POTION', targetId: t.hero.id }); expect(t.actor().mp).toBe(24);
  expect(t.repository.bag(t.created.id, 'MANA_POTION')).toBeUndefined();
  t.combat.skip(); t.wait(); t.nextHero(); expect(() => t.act({ type: 'ITEM', itemId: 'MANA_POTION', targetId: t.hero.id })).toThrow('indisponível');
});
it('uses selected hand dice and real temporary book/juice bonuses without stacking', () => {
  const t = setup(['Goblin'], 'WARRIOR'); t.repository.addBag(t.created.id, 'THE_JUICE', 1); t.combat.start({ chamberId: 'training-1' });
  t.act({ type: 'ITEM', itemId: 'THE_JUICE', targetId: t.hero.id }); t.act({ type: 'ATTACK', subType: 'SLASHING', hand: 'MAIN', targetId: 'monster-0' });
  expect(t.events().at(-1)).toMatchObject({ rawDamage: 8, damage: 8 }); expect(t.events().at(-1)!.rolls).toContainEqual({ faces: 6, value: 2 });
  const mage = setup(['Goblin']); mage.repository.addBag(mage.created.id, 'MAGIC_BOOK', 1); mage.combat.start({ chamberId: 'training-1' });
  mage.act({ type: 'ITEM', itemId: 'MAGIC_BOOK', targetId: mage.hero.id }); mage.act({ type: 'SPELL', spellId: 'ARCANE_DART', targetId: 'monster-0' });
  expect(mage.events().at(-1)).toMatchObject({ rawDamage: 11 });
  for (let i = 0; i < 2; i++) { mage.nextHero(); mage.combat.skip(); mage.wait(); }
  mage.nextHero(); expect(mage.actor().buffs.find(b => b.kind === 'MAGIC_BOOK')).toBeUndefined();
});
it('applies Slow through the next round and recovers base speed without altering exploration speed', () => {
  const t = setup(); t.combat.start({ chamberId: 'training-1' }); t.act({ type: 'SPELL', spellId: 'FREEZING_RAY', targetId: 'monster-0' });
  expect(t.actor('monster-0').speed).toBe(3); t.combat.skip(); t.wait(); t.nextHero();
  expect([...t.state.combatState.turnOrder].slice(1)).toEqual(['monster-1', 'monster-0']);
  t.combat.skip(); t.wait(); t.nextHero(); expect(t.actor('monster-0').speed).toBe(4);
  expect(t.db.select().from(s.characters).get()?.speed).toBe(20);
});
it('ticks Poison once per poisoned turn, supports antidote and rolls back inventory and the full turn together', () => {
  const t = setup(['Aranha Gigante']); t.repository.addBag(t.created.id, 'ANTIDOTE', 1); t.combat.start({ chamberId: 'training-1' }); t.combat.skip(); t.wait();
  t.combat.action(t.master, { type: 'ATTACK', subType: 'THRUST', targetId: t.hero.id, turnToken: t.state.combatState.turnToken }, true); t.wait();
  expect(t.events().at(-1)).toMatchObject({ type: 'STATUS', outcome: 'POISONED', damage: 3 });
  const hp = t.actor().hp, before = structuredClone(t.combat.snapshot()), token = t.state.combatState.turnToken;
  t.database.sqlite.exec("CREATE TRIGGER reject_turn BEFORE INSERT ON combat_participants BEGIN SELECT RAISE(ABORT, 'turn failure'); END");
  expect(() => t.act({ type: 'ITEM', itemId: 'ANTIDOTE', targetId: t.hero.id })).toThrow('turn failure');
  expect(t.combat.snapshot()).toEqual(before); expect(t.state.combatState.turnToken).toBe(token); expect(t.repository.bag(t.created.id, 'ANTIDOTE')?.quantity).toBe(1);
  t.database.sqlite.exec('DROP TRIGGER reject_turn'); t.act({ type: 'ITEM', itemId: 'ANTIDOTE', targetId: t.hero.id });
  expect(t.actor().hp).toBe(hp); expect(t.actor().buffs).toEqual([]);
  t.combat.skip(); t.wait(); t.combat.skip(); t.wait(); expect(t.actor().hp).toBe(hp);
});
it('pauses mixed AI on disconnect/pause, cancels it on manual takeover and waits 1.2 seconds between actions', () => {
  const t = setup(['Goblin', 'Cultista Arcano']); t.combat.start({ chamberId: 'training-1' });
  t.combat.setGlobalAi({ enabled: true }); t.combat.setMonsterAi({ monsterId: 'monster-1', isAutoMode: false, allowAutoFlee: false });
  t.combat.skip(); // Goblin after hero? Cultist has speed3 versus Goblin4.
  const token = t.state.combatState.turnToken; t.combat.tick(); expect(t.state.combatState.turnToken).toBe(token);
  t.wait(); t.master.connected = false; t.combat.tick(); expect(t.state.combatState.turnToken).toBe(token);
  t.master.connected = true; t.combat.pause({ paused: true }); t.combat.tick(); expect(t.state.combatState.turnToken).toBe(token);
  t.combat.pause({ paused: false }); t.combat.setMonsterAi({ monsterId: 'monster-0', isAutoMode: false, allowAutoFlee: false }); t.combat.tick(); expect(t.state.combatState.turnToken).toBe(token);
  t.combat.setMonsterAi({ monsterId: 'monster-0', isAutoMode: true, allowAutoFlee: false });
  expect(() => t.combat.action(t.master, { type: 'FLEE', turnToken: token }, true)).toThrow('manual');
  t.combat.tick(); expect(t.events().at(-1)).toMatchObject({ actorId: 'monster-0', type: 'ATTACK' });
  expect(t.state.combatState.activeParticipantId).toBe('monster-1'); const after = t.events().length;
  t.wait(); t.combat.tick(); expect(t.events()).toHaveLength(after); // Manual cultist stays in control.
});
it('uses magical attacks while MP lasts, falls back safely for magical extras and persists mixed modes and buffs', () => {
  const t = setup(['Cultista Arcano']); t.db.update(s.monstersCatalog).set({ mp: 10, int: 40 }).where(eq(s.monstersCatalog.id, 'ARCANE_CULTIST')).run();
  t.combat.start({ chamberId: 'training-1' }); t.combat.setMonsterAi({ monsterId: 'monster-0', isAutoMode: true, allowAutoFlee: false }); t.combat.skip(); t.wait();
  t.combat.tick(); expect(t.events().at(-1)).toMatchObject({ type: 'ATTACK', vfxType: 'ARCANE' }); expect(t.actor('monster-0').mp).toBe(0);
  t.wait(); t.combat.tick(); expect(t.events().at(-1)).toMatchObject({ type: 'PASS', outcome: 'PASSED' }); expect(t.state.combatState.activeParticipantId).toBe(t.hero.id);
  const restored = new RoomState(); loadBoard(restored, readBoard(t.database)); restored.players.set(t.hero.id, t.hero); restored.players.set(t.master.id, t.master);
  const handler = new CombatHandler(restored, t.database, t.room.id, () => {}, () => {}); handler.restore();
  expect(handler.snapshot()).toEqual(t.combat.snapshot()); expect(restored.monsters.get('monster-0')?.isAutoMode).toBe(true);
  expect(handler.snapshot().participants.find(p => p.id === 'monster-0')).toMatchObject({ isAutoMode: true, allowAutoFlee: false });
});

it('rolls back all AoE victims and MP if the encounter cannot commit, then restores poison without replaying a tick', () => {
  const t = setup(['Aranha Gigante', 'Goblin']); t.db.insert(s.characterGrimoire).values({ characterId: t.created.id, spellId: 'IGNEOUS_BLAST' }).run(); t.combat.start({ chamberId: 'training-1' });
  const before = structuredClone(t.combat.snapshot()); t.send.mockClear();
  t.database.sqlite.exec("CREATE TRIGGER reject_area BEFORE INSERT ON combat_participants BEGIN SELECT RAISE(ABORT,'area failure'); END");
  expect(() => t.act({ type: 'SPELL', spellId: 'IGNEOUS_BLAST', targetId: 'monster-0' })).toThrow('area failure');
  expect(t.combat.snapshot()).toEqual(before); expect(t.db.select().from(s.characters).get()?.mp).toBe(100); expect(t.events()).toEqual([]);
  t.database.sqlite.exec('DROP TRIGGER reject_area'); t.combat.skip(); t.wait();
  t.combat.action(t.master, { type: 'ATTACK', subType: 'THRUST', targetId: t.hero.id, turnToken: t.state.combatState.turnToken }, true); t.wait();
  t.nextHero(); const hp = t.hero.hp;
  expect(t.actor().buffs.find(b => b.kind === 'POISON')?.remainingTurns).toBe(2);
  const restored = new RoomState(); loadBoard(restored, readBoard(t.database)); restored.players.set(t.hero.id, t.hero);
  const handler = new CombatHandler(restored, t.database, t.room.id, () => {}, () => {}); handler.restore();
  expect(handler.snapshot().participants.find(p => p.id === t.hero.id)).toMatchObject({ hp, buffs: [expect.objectContaining({ kind: 'POISON', remainingTurns: 2 })] });
});
it('applies global defaults to new creatures and persists a manual override without spending resources', () => {
  const t = setup(); t.combat.start({ chamberId: 'training-1' }); const token = t.state.combatState.turnToken, budget = t.state.combatState.remainingActions;
  t.combat.setGlobalAi({ enabled: true }); t.combat.setMonsterAi({ monsterId: 'monster-0', isAutoMode: false, allowAutoFlee: true });
  t.state.monsters.set('new', Object.assign(new MonsterSchema(), { id: 'new', name: 'Goblin' })); t.combat.syncMonsterModes();
  expect(t.state.monsters.get('new')).toMatchObject({ isAutoMode: true, allowAutoFlee: false });
  expect(t.state.monsters.get('monster-0')).toMatchObject({ isAutoMode: false, allowAutoFlee: true });
  expect(t.state.combatState.turnToken).toBe(token); expect(t.state.combatState.remainingActions).toBe(budget); expect(t.actor().mp).toBe(100);
  const restored = new RoomState(); loadBoard(restored, readBoard(t.database)); restored.players.set(t.hero.id, t.hero);
  const handler = new CombatHandler(restored, t.database, t.room.id, () => {}, () => {}); handler.restore();
  expect(restored.combatState.globalAiEnabled).toBe(true); expect(restored.monsters.get('monster-0')).toMatchObject({ isAutoMode: false, allowAutoFlee: true });
});
