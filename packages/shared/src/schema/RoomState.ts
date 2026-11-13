import { MapSchema, Schema, type, view } from "@colyseus/schema";
import type { SessionStatus } from "../constants.js";
import { PlayerSchema } from "./PlayerSchema.js";
import { ChamberSchema } from "./ChamberSchema.js";
import { MonsterSchema } from "./MonsterSchema.js";
import { PlacedObjectSchema } from "./PlacedObjectSchema.js";

export class RoomState extends Schema {
  @type("string") roomCode = "";
  @type("string") sessionStatus: SessionStatus = "LOBBY";
  @view() @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type("string") activeStageId = "";
  @type("string") explorationMode: "DUNGEON_TENSE_30S" | "FREE_EXPLORATION" = "DUNGEON_TENSE_30S";
  @type({ map: ChamberSchema }) chambers = new MapSchema<ChamberSchema>();
  @view() @type({ map: MonsterSchema }) monsters = new MapSchema<MonsterSchema>();
  @view() @type({ map: PlacedObjectSchema }) objects = new MapSchema<PlacedObjectSchema>();
}
