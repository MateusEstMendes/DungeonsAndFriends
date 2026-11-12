import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "node:http";
import { PROTOCOL_VERSION, SessionCredentialsPayloadSchema } from "@df/shared";
import { openDatabase } from "../src/db/index.js";
import { gameRoomClass, type GameRoom } from "../src/rooms/GameRoom.js";
import { prepareHost } from "../src/host.js";
import { players, sessions } from "../src/db/schema.js";

const version = { clientVersion: PROTOCOL_VERSION };
let testServer: ColyseusTestServer;
let database: ReturnType<typeof openDatabase>;
let room: GameRoom;
async function until(check: () => boolean) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 4000) throw new Error("Estado esperado não recebido");
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

beforeAll(async () => {
  database = openDatabase(":memory:");
  const host = prepareHost(database, "master-test-password");
  const server = new Server({ transport: new WebSocketTransport({ server: createServer() }), greet: false, gracefullyShutdown: false });
  server.define("game", gameRoomClass({ database, tokenSecret: "integration-secret", bootstrapKey: "local-key" }));
  testServer = await boot(server);
  room = await testServer.createRoom<GameRoom>("game", { bootstrapKey: "local-key", roomCode: host.room.code });
});
afterAll(async () => { await testServer?.shutdown(); database?.close(); });

describe.sequential("sala autoritativa", () => {
  it("recusa versão errada, senha inválida e criação de sala pelo cliente", async () => {
    await expect(testServer.connectTo(room, { name: "Old", clientVersion: "0.0.1" })).rejects.toThrow();
    await expect(testServer.connectTo(room, { password: "wrong", ...version })).rejects.toThrow();
    await expect(testServer.sdk.joinOrCreate("game", { password: "wrong", ...version })).rejects.toThrow();
  });
  it("aprova e recusa jogadores, protege comandos e restaura identidade via token", async () => {
    const master = await testServer.connectTo(room, { password: "master-test-password", ...version });
    const player = await testServer.connectTo(room, { name: "Ana", ...version });
    const other = await testServer.connectTo(room, { name: "Bia", ...version });
    const ana = Array.from(room.state.players.values()).find(p => p.name === "Ana")!;
    const bia = Array.from(room.state.players.values()).find(p => p.name === "Bia")!;
    expect(ana.status).toBe("PENDING_APPROVAL");
    await expect(testServer.connectTo(room, { name: "ana", ...version })).rejects.toThrow();
    const denied = player.waitForMessage("ACTION_ERROR");
    player.send("APPROVE_PLAYER", { targetPlayerId: ana.id });
    await denied;
    expect(ana.status).toBe("PENDING_APPROVAL");
    const pendingToken = database.db.select().from(players).all().find(p => p.id === ana.id)!.sessionToken;
    const credentialsMessage = player.waitForMessage("SESSION_CREDENTIALS");
    master.send("APPROVE_PLAYER", { targetPlayerId: ana.id });
    master.send("REJECT_PLAYER", { targetPlayerId: bia.id });
    await until(() => ana.status === "NEEDS_CHARACTER_CREATION" && bia.status === "REJECTED");
    const saved = database.db.select().from(players).all().find(p => p.id === ana.id)!;
    const credentials = SessionCredentialsPayloadSchema.parse(await credentialsMessage);
    expect(saved.approvalStatus).toBe("APPROVED");
    expect(saved.sessionToken).not.toBe(pendingToken);
    expect(credentials.sessionToken).toBe(saved.sessionToken);
    expect(credentials.reconnectionToken).toBe(player.reconnectionToken);
    expect(credentials.playerId).toBe(ana.id);
    expect(saved.reconnectionToken).toBe(player.reconnectionToken);
    await until(() => player.state.players.get(ana.id)?.status === "NEEDS_CHARACTER_CREATION" && master.state.players.get(ana.id)?.status === "NEEDS_CHARACTER_CREATION");
    await expect(testServer.connectTo(room, { name: "Ana", sessionToken: saved.sessionToken, ...version })).rejects.toThrow();
    const pong = player.waitForMessage("PONG");
    player.send("PING", 123);
    expect(await pong).toBe(123);
    await player.leave();
    await until(() => !ana.connected);
    await expect(testServer.connectTo(room, { name: "Ana", sessionToken: pendingToken, ...version })).rejects.toThrow();
    database.sqlite.prepare("UPDATE players SET last_seen_at = 0 WHERE id = ?").run(ana.id);
    const rejoined = await testServer.connectTo(room, { name: "Changed", sessionToken: saved.sessionToken, ...version });
    expect(database.db.select().from(players).all().find(p => p.id === ana.id)!.lastSeenAt).toBeGreaterThan(0);
    expect(room.state.players.get(ana.id)?.name).toBe("Ana");
    expect(room.state.players.get(ana.id)?.status).toBe("NEEDS_CHARACTER_CREATION");
    expect(Array.from(room.state.players.values()).filter(p => p.name === "Ana")).toHaveLength(1);
    await rejoined.leave(); await other.leave(); await master.leave();
  });
  it("reconecta queda abrupta usando token nativo sem duplicar jogador", async () => {
    const client = await testServer.connectTo(room, { name: "Carlos", ...version });
    const player = Array.from(room.state.players.values()).find(p => p.name === "Carlos")!;
    client.reconnection.enabled = false;
    const token = client.reconnectionToken;
    client.connection.close();
    await until(() => !player.connected);
    const restored = await testServer.sdk.reconnect(token);
    await until(() => player.connected);
    expect(Array.from(room.state.players.values()).filter(p => p.id === player.id)).toHaveLength(1);
    await restored.leave();
  });
  it("cancela pedido pendente e libera o nome", async () => {
    const pending = await testServer.connectTo(room, { name: "Dora", ...version });
    await pending.leave();
    await until(() => !Array.from(room.state.players.values()).some(p => p.name === "Dora"));
    const retry = await testServer.connectTo(room, { name: "Dora", ...version });
    await retry.leave();
  });
  it("restaura sala e aprovação após recriar a sala autoritativa", async () => {
    const saved = database.db.select().from(players).all().find(p => p.name === "Ana")!;
    const code = room.roomId;
    await testServer.cleanup();
    room = await testServer.createRoom<GameRoom>("game", { bootstrapKey: "local-key", roomCode: code });
    expect(database.db.select().from(sessions).all().filter(s => s.status === "ACTIVE")).toHaveLength(1);
    const restored = await testServer.connectTo(room, { name: "Ignored", sessionToken: saved.sessionToken, ...version });
    expect(room.state.players.get(saved.id)?.status).toBe("NEEDS_CHARACTER_CREATION");
    expect(room.state.players.get(saved.id)?.connected).toBe(true);
    const rejected = database.db.select().from(players).all().find(p => p.name === "Bia")!;
    await expect(testServer.connectTo(room, { name: "Bia", sessionToken: rejected.sessionToken, ...version })).rejects.toThrow();
    await restored.leave();
  });

});
