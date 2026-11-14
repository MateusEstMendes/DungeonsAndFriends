import { create } from "zustand";
import type { ApprovalStatus, PlayerRole, SessionStatus } from "@df/shared";
export interface Player { id: string; name: string; role: PlayerRole; status: ApprovalStatus; connected: boolean; reconnecting: boolean; awaitingPosition: boolean; characterId:string; characterName:string; raceId:string; archetypeId:string; hp:number; maxHp:number; mp:number; maxMp:number; defense:number; speed:number; tokenUrl:string; portraitUrl:string; currentChamberId: string; q: number; r: number; moveCooldownEndsAt: number; remainingSteps: number; moveRevision: number; isHiddenByMaster: boolean }
export type ConnectionState = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING";
interface GameState {
  roomCode: string; playerId: string; playerName: string;
  role: PlayerRole; approvalStatus: ApprovalStatus;
  connectionState: ConnectionState; latencyMs: number | null;
  sessionStatus: SessionStatus; players: Player[];
}
export const initialGameState: GameState = {
  roomCode: "", playerId: "", playerName: "", role: "PLAYER", approvalStatus: "PENDING_APPROVAL",
  connectionState: "DISCONNECTED", latencyMs: null, sessionStatus: "LOBBY", players: [],
};
export const useGameStore = create<GameState>(() => ({ ...initialGameState }));
