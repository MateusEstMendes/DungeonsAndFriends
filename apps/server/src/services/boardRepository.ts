import { ChamberSchema, MonsterSchema, PlacedObjectSchema, PortalSchema, getHexKey, type RoomState, type Terrain } from "@df/shared";
import type { openDatabase } from "../db/index.js";
import { chambers, placedObjects, terrainCells, walls } from "../db/schema.js";
export type Database = ReturnType<typeof openDatabase>;
export function readBoard(database: Database) {
  const { db } = database;
  return { chambers: db.select().from(chambers).all(), cells: db.select().from(terrainCells).all(), walls: db.select().from(walls).all(), objects: db.select().from(placedObjects).all() };
}
export type BoardSnapshot = ReturnType<typeof readBoard>;
export function loadBoard(state: RoomState, data: BoardSnapshot) {
  state.chambers.clear(); state.monsters.clear(); state.objects.clear();
  for (const row of data.chambers) {
    const chamber = new ChamberSchema();
    Object.assign(chamber, { id: row.id, mapId: row.mapId, name: row.name, biome: row.biome, spawnQ: row.spawnQ, spawnR: row.spawnR, offsetX: row.offsetX, offsetY: row.offsetY });
    Object.assign(chamber.bounds, { minQ: row.minQ, maxQ: row.maxQ, minR: row.minR, maxR: row.maxR });
    for (const portal of JSON.parse(row.portalsJson)) chamber.portals.push(Object.assign(new PortalSchema(), portal));
    state.chambers.set(chamber.id, chamber);
  }
  for (const row of data.cells) state.chambers.get(row.chamberId)?.cells.set(getHexKey(row.q, row.r), row.terrain as Terrain);
  for (const row of data.walls) state.chambers.get(row.chamberId)?.walls.set(row.edgeKey, true);
  for (const row of data.objects) {
    const entity = row.kind === "MONSTER" ? new MonsterSchema() : new PlacedObjectSchema();
    Object.assign(entity, { id: row.id, currentChamberId: row.chamberId, name: row.name, q: row.q, r: row.r, rotation: row.rotation, kind: row.kind, isHiddenByMaster: row.hidden });
    if (entity instanceof MonsterSchema) state.monsters.set(entity.id, entity);
    else state.objects.set(entity.id, entity);
  }
}
/** Runs inside the caller's transaction together with its history record. */
export function writeBoard(database: Database, data: BoardSnapshot) {
  const { db } = database;
  db.delete(placedObjects).run(); db.delete(walls).run(); db.delete(terrainCells).run(); db.delete(chambers).run();
  for (const row of data.chambers) db.insert(chambers).values(row).run();
  for (const row of data.cells) db.insert(terrainCells).values(row).run();
  for (const row of data.walls) db.insert(walls).values(row).run();
  for (const row of data.objects) db.insert(placedObjects).values(row).run();
}
