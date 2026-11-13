import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
export const TERRAIN_TYPES = ["STONE", "GRASS", "DIRT", "SAND", "WATER", "DEEP_WATER", "OBSTACLE"] as const;
export type Terrain = typeof TERRAIN_TYPES[number];
export class BoundsSchema extends Schema {
  @type("number") minQ = -5;
  @type("number") maxQ = 5;
  @type("number") minR = -5;
  @type("number") maxR = 5;
}
export class PortalSchema extends Schema {
  @type("number") fromQ = 0;
  @type("number") fromR = 0;
  @type("string") targetChamberId = "";
  @type("number") toQ = 0;
  @type("number") toR = 0;
}
export class ChamberSchema extends Schema {
  @type("string") id = "";
  @type("string") mapId = "";
  @type("string") name = "";
  @type("string") biome = "DUNGEON";
  @type(BoundsSchema) bounds = new BoundsSchema();
  @type({ map: "string" }) cells = new MapSchema<Terrain>();
  @type({ map: "boolean" }) walls = new MapSchema<boolean>();
  @type([PortalSchema]) portals = new ArraySchema<PortalSchema>();
  @type("number") spawnQ = 0;
  @type("number") spawnR = 0;
  @type("number") offsetX = 0;
  @type("number") offsetY = 0;
}
