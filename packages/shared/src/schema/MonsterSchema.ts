import { Schema, type, view } from "@colyseus/schema";
export class MonsterSchema extends Schema {
  @type("string") id = "";
  @view() @type("string") name = "Monstro";
  @view() @type("string") currentChamberId = "";
  @view() @type("number") q = 0;
  @view() @type("number") r = 0;
  @view() @type("string") tokenUrl = "";
  @view() @type("boolean") isHiddenByMaster = false;
  @view() @type("boolean") isAutoMode = false;
  @view() @type("boolean") allowAutoFlee = false;
}
