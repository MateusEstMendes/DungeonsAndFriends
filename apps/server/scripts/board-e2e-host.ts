import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../src/db/index.js";
import { prepareHost } from "../src/host.js";
import { characters, placedObjects, players, chests } from "../src/db/schema.js";
import { prepareCharacter, signSessionToken } from "../src/rooms/handlers/auth.js";
import { characterPayload } from "../../../packages/shared/tests/characterFixture.js";
// Dedicated disposable database; never touches apps/server/dungeons.db.
mkdirSync(".local", { recursive: true });
process.env.DATABASE_PATH = resolve(`.local/e2e-board-${Date.now()}.db`);
process.env.PORT = "4179";
process.env.MASTER_PASSWORD = "board-e2e-password";
process.env.SESSION_SECRET = "board-e2e-session-secret";
const database = openDatabase();
const { room } = prepareHost(database);
const playerId = randomUUID(), name = "Teste tabuleiro";
const token = signSessionToken({ playerId, roomId: room.id, role: "PLAYER" }, process.env.SESSION_SECRET);
database.db.insert(players).values({ id: playerId, roomId: room.id, name, sessionToken: token, approvalStatus: "APPROVED" }).run();
const character = database.db.insert(characters).values({ ...prepareCharacter(characterPayload()), name: "Ael de Teste", finalStr: 20, speed: 10, playerId, roomId: room.id }).returning().get();
database.db.insert(placedObjects).values({ id: 'combat-goblin', chamberId: 'training-1', kind: 'MONSTER', name: 'Goblin', q: 3, r: -2 }).run();
database.sqlite.prepare("UPDATE players SET character_id = ? WHERE id = ?").run(character.id, playerId);
writeFileSync(".local/e2e-player.json", JSON.stringify({ roomCode: room.code, name, token, databasePath: process.env.DATABASE_PATH, characterId: character.id }));
database.db.insert(placedObjects).values([
  { id: 'economy-chest', chamberId: 'training-1', kind: 'CHEST', name: 'Baú de teste', q: 0, r: 1 },
  { id: 'economy-shop', chamberId: 'training-1', kind: 'NPC_MERCHANT', name: 'Mercador de teste', q: 0, r: 1 },
]).run();
database.db.insert(chests).values({ objectId: 'economy-chest', gold: 200, itemsJson: JSON.stringify([
  { itemId: 'GREAT_SWORD', quantity: 1 }, { itemId: 'WOODEN_SHIELD', quantity: 1 }, { itemId: 'SPELL_SCROLL_IGNEOUS_BLAST', quantity: 1 },
]) }).run();
database.close();
await import("../src/index.js");
