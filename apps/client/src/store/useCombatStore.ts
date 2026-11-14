import { create } from 'zustand';
import type { AttackType, CombatantStats } from '@df/shared';
export interface CombatParticipant extends CombatantStats {
  id: string; name: string; kind: 'PLAYER' | 'MONSTER'; str: number; int: number; dex: number;
  speed: number; mp: number; maxMp: number; archetypeId: string; attackType: AttackType; baseDamage: number;
  cooldowns: Record<string, number>; potions: number;
}
export interface CombatEvent {
  id: string; encounterId: string; actorId: string; targetId: string; type: string; round: number;
  startedAt: number; duration: number; rolls: { faces: number; value: number }[];
  outcome?: string; damage?: number; drAbsorbed?: number; healAmount?: number; vfxType?: AttackType; roll?: number;
}
export interface CombatSnapshot {
  active: boolean; encounterId: string; chamberId: string; biome: string; round: number; turnOrder: string[];
  activeParticipantId: string; remainingActions: number; actionIndex: number; turnToken: string;
  fleeMode: 'NORMAL' | 'BLOCKED' | 'GUARANTEED_100'; isPaused: boolean;
}
export const emptyCombat: CombatSnapshot = { active: false, encounterId: '', chamberId: '', biome: 'DUNGEON', round: 0,
  turnOrder: [], activeParticipantId: '', remainingActions: 0, actionIndex: 0, turnToken: '', fleeMode: 'NORMAL', isPaused: false };
interface CombatStore {
  combat: CombatSnapshot; participants: CombatParticipant[]; targetId: string; manualMonsterId: string;
  events: CombatEvent[]; busyUntil: number; pending: boolean;
  proximity: { chamberId: string; message: string } | null;
  cutoffs: { criticalFailure: number; success: number; criticalSuccess: number };
}
export const initialCombatState: CombatStore = { combat: emptyCombat, participants: [], targetId: '', manualMonsterId: '', events: [], busyUntil: 0, pending: false, proximity: null,
  cutoffs: { criticalFailure: 1, success: 10, criticalSuccess: 20 } };
export const useCombatStore = create<CombatStore>(() => ({ ...initialCombatState }));
