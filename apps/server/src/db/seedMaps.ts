import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { getHexDisk, getHexEdgeKey, getHexKey } from "@df/shared";
import * as schema from "./schema.js";
/** A failed seed never leaves a partial dungeon. */
export function seedMaps(db: BetterSQLite3Database<typeof schema>) {
  if (db.select().from(schema.maps).get()) return;
  db.transaction(tx => {
    tx.insert(schema.maps).values({ id: "training", name: "Masmorra de Treinamento" }).run();
    for (let i = 1; i <= 3; i++) {
      const id = `training-${i}`;
      const portals = [];
      if (i < 3) portals.push({ fromQ: 5, fromR: 0, targetChamberId: `training-${i + 1}`, toQ: -4, toR: 0 });
      if (i > 1) portals.push({ fromQ: -5, fromR: 0, targetChamberId: `training-${i - 1}`, toQ: 4, toR: 0 });
      tx.insert(schema.chambers).values({ id, mapId: "training", name: ["Átrio das Tochas", "Galeria Submersa", "Santuário Esquecido"][i - 1], minQ: -5, maxQ: 5, minR: -5, maxR: 5, offsetX: (i - 1) * 830, portalsJson: JSON.stringify(portals) }).run();
      for (const h of getHexDisk({ q: 0, r: 0 }, 5)) {
        tx.insert(schema.terrainCells).values({ id: `${id}:${getHexKey(h.q, h.r)}`, chamberId: id, ...h, terrain: i === 2 && h.r === 2 ? "DEEP_WATER" : "STONE" }).run();
      }
      const edgeKey = getHexEdgeKey({ q: 1, r: -1 }, { q: 2, r: -1 });
      tx.insert(schema.walls).values({ id: `${id}:${edgeKey}`, chamberId: id, edgeKey }).run();
      tx.insert(schema.placedObjects).values({ id: `${id}:chest`, chamberId: id, kind: "CHEST", name: "Baú antigo", q: 3, r: -2 }).run();
      tx.insert(schema.placedObjects).values({ id: `${id}:monster`, chamberId: id, kind: "MONSTER", name: "Sentinela", q: 5, r: -1 }).run();
    }
  });
}
