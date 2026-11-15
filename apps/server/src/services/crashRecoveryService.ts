import { and, eq } from 'drizzle-orm';
import type { RoomState } from '@df/shared';
import type { Database } from './boardRepository.js';
import { crashRecoveryCheckpoints, sessions } from '../db/schema.js';
import { ensureActiveSession } from '../db/session.js';

/** Relational game data and this marker are committed in the same SQLite transaction. */
export function saveCheckpoint(database: Database, roomId: string, state: RoomState, eventType: string) {
  const sessionId = ensureActiveSession(database, roomId);
  const serializedRoomState = JSON.stringify({ version: 1, activeStageId: state.activeStageId,
    explorationMode: state.explorationMode, sessionStatus: state.sessionStatus,
    players: [...state.players.values()].map(p => ({ id: p.id, name: p.characterName || p.name,
      present: p.connected || p.reconnecting, chamberId: p.currentChamberId, q: p.q, r: p.r })) });
  const values = { sessionId, serializedRoomState, combatSnapshotJson: state.combatState.active ? JSON.stringify(state.combatState.toJSON()) : null,
    lastEventType: eventType, updatedAt: Date.now() };
  database.db.insert(crashRecoveryCheckpoints).values({ roomId, ...values })
    .onConflictDoUpdate({ target: crashRecoveryCheckpoints.roomId, set: values }).run();
}
export function detectInterruptedSession(database: Database, roomId: string) {
  const checkpoint = database.db.select().from(crashRecoveryCheckpoints).where(eq(crashRecoveryCheckpoints.roomId, roomId)).get();
  if (!checkpoint || checkpoint.lastEventType === 'SESSION_INITIALIZED') return undefined;
  const active = database.db.select().from(sessions).where(and(eq(sessions.id, checkpoint.sessionId), eq(sessions.status, 'ACTIVE'))).get();
  if (!active) return undefined;
  const room = JSON.parse(checkpoint.serializedRoomState);
  const combat = checkpoint.combatSnapshotJson ? JSON.parse(checkpoint.combatSnapshotJson) : null;
  return { updatedAt: checkpoint.updatedAt, chamberId: combat?.chamberId || room.players?.find((p: {present: boolean}) => p.present)?.chamberId || '',
    inCombat: Boolean(combat?.active), round: combat?.round ?? 0, heroes: room.players?.filter((p: {id: string}) => p.id !== roomId).map((p: {name: string}) => p.name) ?? [] };
}
export function closeSession(database: Database, roomId: string) {
  database.db.update(sessions).set({ status: 'CLOSED', updatedAt: Date.now() }).where(and(eq(sessions.roomId, roomId), eq(sessions.status, 'ACTIVE'))).run();
  database.db.delete(crashRecoveryCheckpoints).where(eq(crashRecoveryCheckpoints.roomId, roomId)).run();
}
