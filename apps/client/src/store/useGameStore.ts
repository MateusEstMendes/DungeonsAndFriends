import { create } from "zustand";
import type { ApprovalStatus, PlayerRole, SessionStatus } from "@df/shared";
export interface Player { id: string; name: string; role: PlayerRole; status: ApprovalStatus; connected: boolean }
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
