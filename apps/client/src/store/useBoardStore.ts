import { create } from "zustand";
import type { Terrain } from "@df/shared";
export interface BoardChamber {
  id: string; mapId: string; name: string; biome: string; spawnQ: number; spawnR: number; offsetX: number; offsetY: number;
  bounds: { minQ: number; maxQ: number; minR: number; maxR: number };
  cells: Record<string, Terrain>; walls: Record<string, boolean>;
  portals: { fromQ: number; fromR: number; targetChamberId: string; toQ: number; toR: number }[];
}
export interface BoardEntity { id: string; name: string; currentChamberId: string; q: number; r: number; isHiddenByMaster: boolean; tokenUrl?: string; kind?: string; rotation?: number; moveRevision?: number }
interface BoardState {
  chambers: BoardChamber[]; monsters: BoardEntity[]; objects: BoardEntity[];
  activeStageId: string; explorationMode: "DUNGEON_TENSE_30S" | "FREE_EXPLORATION";
  visionChamberId: string; activeVision: string[];
  focusChamberId: string; macro: boolean; debug: boolean;
  tool: "SELECT" | "TERRAIN" | "WALL" | "OBJECT" | "ENTITY";
  terrain: Terrain; wallDirection: number; eraseWall: boolean; objectKind: string; rotation: number; hidden: boolean;
  selectedEntityId: string; focusRevision: number; monsterName: string;
}
export const initialBoardState: BoardState = {
  chambers: [], monsters: [], objects: [], activeStageId: "", explorationMode: "DUNGEON_TENSE_30S",
  visionChamberId: "", activeVision: [], focusChamberId: "", macro: false, debug: false,
  tool: "SELECT", terrain: "STONE", wallDirection: 0, eraseWall: false, objectKind: "CHEST", rotation: 0, hidden: false,
  selectedEntityId: "", focusRevision: 0, monsterName: 'Goblin',
};
export const useBoardStore = create<BoardState>(() => ({ ...initialBoardState }));
