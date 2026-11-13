import { Schema, type } from "@colyseus/schema";
import type { ApprovalStatus, PlayerRole } from "../constants.js";

// Somente estado público: senhas e tokens nunca entram no estado sincronizado.
export class PlayerSchema extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") role: PlayerRole = "PLAYER";
  @type("string") status: ApprovalStatus = "PENDING_APPROVAL";
  @type("string") characterId = "";
  @type("string") characterName = "";
  @type("string") raceId = "";
  @type("string") archetypeId = "";
  @type("string") tokenUrl = "";
  @type("string") portraitUrl = "";
  @type("number") hp = 0;
  @type("number") maxHp = 0;
  @type("number") mp = 0;
  @type("number") maxMp = 0;
  @type("number") defense = 0;
  @type("number") speed = 0;
  @type("boolean") connected = false;
}
