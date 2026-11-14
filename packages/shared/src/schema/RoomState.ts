import { ArraySchema, MapSchema, Schema, type, view } from "@colyseus/schema";
import type { SessionStatus } from "../constants.js";
import { PlayerSchema } from "./PlayerSchema.js";
import { ChamberSchema } from "./ChamberSchema.js";
import { MonsterSchema } from "./MonsterSchema.js";
import { PlacedObjectSchema } from "./PlacedObjectSchema.js";

export class CombatStateSchema extends Schema {
  @type('string') encounterId = '';
  @type('string') chamberId = '';
  @type('string') turnToken = '';
  @type('number') actionIndex = 0;
  @type('boolean') isProcessingAction = false;
  @type('boolean') active = false;
  @type('string') biome: 'CAVE' | 'FOREST' | 'TAVERN' | 'DUNGEON' = 'DUNGEON';
  @type('number') round = 0;
  @type(['string']) turnOrder = new ArraySchema<string>();
  @type('string') activeParticipantId = '';
  @type('number') remainingActions = 0;
  @type('string') fleeMode: 'NORMAL' | 'BLOCKED' | 'GUARANTEED_100' = 'NORMAL';
  @type('boolean') isPaused = false;
}

export class RoomState extends Schema {
  @view() @type(CombatStateSchema) combatState = new CombatStateSchema();
  @type("string") roomCode = "";
  @type("string") sessionStatus: SessionStatus = "LOBBY";
  @view() @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type("string") activeStageId = "";
  @type("string") explorationMode: "DUNGEON_TENSE_30S" | "FREE_EXPLORATION" = "DUNGEON_TENSE_30S";
  @type({ map: ChamberSchema }) chambers = new MapSchema<ChamberSchema>();
  @view() @type({ map: MonsterSchema }) monsters = new MapSchema<MonsterSchema>();
  @view() @type({ map: PlacedObjectSchema }) objects = new MapSchema<PlacedObjectSchema>();
}
