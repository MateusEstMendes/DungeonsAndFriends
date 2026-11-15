import type { AttackType } from './actions.js';

export type ParticipantKind = 'PLAYER' | 'MONSTER';
export interface CombatTargetResult {
  targetId: string; targetName: string; targetKind: ParticipantKind;
  rawDamage?: number; attackRoll?: number; outcome?: string; damage: number; drAbsorbed: number; healAmount: number;
}
/** Authoritative presentation data; names stay valid after a participant leaves. */
export interface CombatEvent {
  id: string; encounterId: string; actorId: string; actorName: string; actorKind: ParticipantKind;
  targetId: string; targetName: string; targetKind: ParticipantKind;
  targets: CombatTargetResult[]; spellId?: string; itemId?: string; reason?: string;
  turnToken?: string; type: string; round: number; startedAt: number; duration: number;
  rolls: { faces: number; value: number }[];
  outcome?: string; damage?: number; drAbsorbed?: number; healAmount?: number; vfxType?: AttackType; roll?: number;
}
