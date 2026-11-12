import { MapSchema, Schema, type } from "@colyseus/schema";
import type { SessionStatus } from "../constants.js";
import { PlayerSchema } from "./PlayerSchema.js";

export class RoomState extends Schema {
  @type("string") roomCode = "";
  @type("string") sessionStatus: SessionStatus = "LOBBY";
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
}
