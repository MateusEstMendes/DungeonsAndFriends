import { Schema, type } from "@colyseus/schema";
import type { ApprovalStatus, PlayerRole } from "../constants.js";

// Somente estado público: senhas e tokens nunca entram no estado sincronizado.
export class PlayerSchema extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") role: PlayerRole = "PLAYER";
  @type("string") status: ApprovalStatus = "PENDING_APPROVAL";
  @type("boolean") connected = false;
}
