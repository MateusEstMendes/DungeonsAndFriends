import { grantStarterKit } from '../../src/db/seedEconomy.js';
import { openDatabase } from '../../src/db/index.js';
import { prepareHost } from '../../src/host.js';
import { characters, players } from '../../src/db/schema.js';
import { prepareCharacter } from '../../src/rooms/handlers/auth.js';
import { characterPayload } from '../../../../packages/shared/tests/characterFixture.js';
import { RoomState, PlayerSchema } from '@df/shared';
import { CombatHandler } from '../../src/rooms/handlers/combat.js';
import { loadBoard, readBoard } from '../../src/services/boardRepository.js';
import { saveCheckpoint } from '../../src/services/crashRecoveryService.js';
const db = openDatabase(process.argv[2]); const { room } = prepareHost(db, 'crash-test-password');
const state = new RoomState(); loadBoard(state, readBoard(db));
for (const name of ['Crash Ana', 'Crash Bia']) {
  const p = db.db.insert(players).values({ roomId: room.id, name, sessionToken: name }).returning().get();
  const c = db.db.insert(characters).values({ ...prepareCharacter(characterPayload()), playerId:p.id, roomId:room.id, finalStr:20, finalDex:20, speed:10, gold:123, posQ:3, posR:-1, currentChamberId:'training-1' }).returning().get();
  grantStarterKit(db.db,c.id);
  state.players.set(p.id, Object.assign(new PlayerSchema(), { id:p.id, name, characterId:c.id, status:'READY', connected:true, hp:c.hp, mp:c.mp, currentChamberId:c.currentChamberId, q:3, r:-1 }));
}
const combat = new CombatHandler(state, db, room.id, () => {}, () => {}, faces => faces === 20 ? 15 : faces === 100 ? 100 : 2);
combat.start({ chamberId:'training-1' });
const actor = state.players.get(state.combatState.activeParticipantId)!;
db.sqlite.transaction(() => {
  combat.action(actor, { type:'SPELL', spellId:'ARCANE_DART', targetId:combat.snapshot().participants.find(p=>p.kind==='MONSTER')!.id, turnToken:state.combatState.turnToken });
  saveCheckpoint(db,room.id,state,'COMBAT_ACTION');
})();
process.send?.({ roomId:room.id, combat:state.combatState.toJSON(), participants:combat.snapshot().participants, characters:db.db.select().from(characters).all() });
setInterval(() => {}, 1000);
