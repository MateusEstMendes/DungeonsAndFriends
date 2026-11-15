import { create } from 'zustand';
import type { CombatParticipant, CombatEvent } from '@df/shared';
export type { CombatParticipant } from '@df/shared';
export type { CombatEvent } from '@df/shared';
export interface CombatSnapshot {
  active: boolean; encounterId: string; chamberId: string; biome: string; round: number; turnOrder: string[];
  activeParticipantId: string; remainingActions: number; actionIndex: number; turnToken: string;
  fleeMode: 'NORMAL' | 'BLOCKED' | 'GUARANTEED_100'; isPaused: boolean; globalAiEnabled: boolean;
}
export const emptyCombat: CombatSnapshot = { active: false, encounterId: '', chamberId: '', biome: 'DUNGEON', round: 0,
  turnOrder: [], activeParticipantId: '', remainingActions: 0, actionIndex: 0, turnToken: '', fleeMode: 'NORMAL', globalAiEnabled: false, isPaused: false };
interface CombatStore {
  combat: CombatSnapshot; participants: CombatParticipant[]; targetId: string; selectedMonsterId: string;
  events: CombatEvent[]; busyUntil: number; pending: boolean;
  serverClockOffset: number;
  proximity: { chamberId: string; message: string } | null;
  cutoffs: { criticalFailure: number; success: number; criticalSuccess: number };
}
export const initialCombatState: CombatStore = { combat: emptyCombat, participants: [], targetId: '', selectedMonsterId: '', events: [], busyUntil: 0, pending: false, proximity: null, serverClockOffset: 0,
  cutoffs: { criticalFailure: 1, success: 10, criticalSuccess: 20 } };
export const useCombatStore = create<CombatStore>(() => ({ ...initialCombatState }));

/** Inspection never assigns a combat target or grants an action. */
export function selectMonster(id: string) {
  useCombatStore.setState({ selectedMonsterId: id, targetId: '' });
}
