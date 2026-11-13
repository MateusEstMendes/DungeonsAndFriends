import express from "express";
import { openDatabase } from "./db/index.js";
import { databasePath } from "./db/paths.js";
import { Server, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { MAX_CHARACTER_MESSAGE_BYTES, PROTOCOL_VERSION } from "@df/shared";
import { DEFAULT_MASTER_PASSWORD, prepareHost } from "./host.js";
import { gameRoomClass } from "./rooms/GameRoom.js";
import { loadTokenSecret } from "./rooms/handlers/auth.js";

const database = openDatabase();
const { room } = prepareHost(database);
const bootstrapKey = randomBytes(32).toString("hex");
const app = express();
let ready = false;
app.get("/health", (_req, res) => res.status(ready ? 200 : 503).json({ status: ready ? "ok" : "starting", protocolVersion: PROTOCOL_VERSION }));
app.get("/api/host-info", (_req, res) => res.status(ready ? 200 : 503).json({ roomCode: room.code, protocolVersion: PROTOCOL_VERSION }));
app.use(express.static(fileURLToPath(new URL("../../client/dist", import.meta.url))));
const server = new Server({ transport: new WebSocketTransport({ maxPayload: MAX_CHARACTER_MESSAGE_BYTES, server: createServer(app) }) });
server.define("game", gameRoomClass({ database, bootstrapKey, tokenSecret: process.env.SESSION_SECRET ?? loadTokenSecret(`${databasePath()}.secret`) }));
server.onShutdown(() => database.close());
const port = Number(process.env.PORT ?? 2567);
await server.listen(port, "0.0.0.0");
await matchMaker.createRoom("game", { bootstrapKey, roomCode: room.code });
ready = true;
console.log(`Dungeons & Friends: http://localhost:${port} | Sala: ${room.code}`);
console.log(process.env.MASTER_PASSWORD !== undefined
  ? "Senha do Mestre definida por MASTER_PASSWORD."
  : `Senha padrão do Mestre: ${DEFAULT_MASTER_PASSWORD}`);
