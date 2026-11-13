import { Schema, type, view } from "@colyseus/schema";
export class PlacedObjectSchema extends Schema {
  @type("string") id = "";
  @view() @type("string") name = "Objeto";
  @view() @type("string") kind = "CHEST";
  @view() @type("string") currentChamberId = "";
  @view() @type("number") q = 0;
  @view() @type("number") r = 0;
  @view() @type("number") rotation = 0;
  @view() @type("boolean") isHiddenByMaster = false;
}
