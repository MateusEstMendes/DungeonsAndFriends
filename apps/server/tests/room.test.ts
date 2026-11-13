import { characterPayload, webp } from "../../../packages/shared/tests/characterFixture.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "node:http";
import { MAX_CHARACTER_MESSAGE_BYTES, PROTOCOL_VERSION, SessionCredentialsPayloadSchema } from "@df/shared";
import { openDatabase } from "../src/db/index.js";
import { gameRoomClass, type GameRoom } from "../src/rooms/GameRoom.js";
import { prepareHost } from "../src/host.js";
import { characters, players, sessions } from "../src/db/schema.js";

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
  const server = new Server({ transport: new WebSocketTransport({ maxPayload: MAX_CHARACTER_MESSAGE_BYTES, server: createServer() }), greet: false, gracefullyShutdown: false });
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
  it("valida, salva e sincroniza a ficha; impede adulteração, duplicação e criação sem aprovação", async () => {
    const pending = await testServer.connectTo(room, { name: "Eva", ...version });
    let error = pending.waitForMessage("ACTION_ERROR");
    pending.send("SUBMIT_CHARACTER", characterPayload());
    await error;
    expect(database.db.select().from(characters).all()).toHaveLength(0);
    await pending.leave();
    const master = await testServer.connectTo(room, { password: "master-test-password", ...version });
    error = master.waitForMessage("ACTION_ERROR");
    master.send("SUBMIT_CHARACTER", characterPayload());
    await error;
    const saved = database.db.select().from(players).all().find(p => p.name === "Ana")!;
    const client = await testServer.connectTo(room, { name: "Ana", sessionToken: saved.sessionToken, ...version });
    const player = room.state.players.get(saved.id)!;
    for (const payload of [
      { ...characterPayload(), hp: 9999 },
      { ...characterPayload(), baseAttributes: { ...characterPayload().baseAttributes, str: 7 } },
      { ...characterPayload(), baseAttributes: { ...characterPayload().baseAttributes, cha: 9 } },
      { ...characterPayload(), raceId: "HUMAN" },
      { ...characterPayload(), humanBonusAttribute: "str" },
      { ...characterPayload(), portraitBase64: "invalid" },
    ]) {
      error = client.waitForMessage("ACTION_ERROR");
      client.send("SUBMIT_CHARACTER", payload);
      await error;
      expect(player.status).toBe("NEEDS_CHARACTER_CREATION");
      expect(database.db.select().from(characters).all()).toHaveLength(0);
    }
    // Simula falha entre o INSERT e o vínculo ao jogador: ambos devem reverter.
    database.sqlite.exec("CREATE TRIGGER fail_character_link BEFORE UPDATE OF character_id ON players BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    error = client.waitForMessage("ACTION_ERROR");
    client.send("SUBMIT_CHARACTER", characterPayload());
    await error;
    expect(database.db.select().from(characters).all()).toHaveLength(0);
    expect(player.characterId).toBe("");
    database.sqlite.exec("DROP TRIGGER fail_character_link");
    // Um WebP com chunk desconhecido ignorável, maior que o antigo limite de 4 KiB.
    const image = Buffer.from(webp, "base64");
    const paddingChunk = Buffer.alloc(8 + 4096);
    paddingChunk.write("JUNK", 0); paddingChunk.writeUInt32LE(4096, 4);
    const largeImage = Buffer.concat([image, paddingChunk]);
    largeImage.writeUInt32LE(largeImage.length - 8, 4);
    client.send("SUBMIT_CHARACTER", { ...characterPayload(), portraitBase64: largeImage.toString("base64") });
    await until(() => player.status === "READY" && client.state.players.get(saved.id)?.status === "READY" && master.state.players.get(saved.id)?.status === "READY");
    const character = database.db.select().from(characters).get()!;
    expect(character).toMatchObject({ playerId: saved.id, name: "Ael", raceId: "ELF", archetypeId: "MAGE", baseDex: 15, finalDex: 17, finalCon: 13, finalInt: 16, hp: 110, maxHp: 110, mp: 32, maxMp: 32, defense: 13, dodgeChance: 16, speed: 3, flatDr: 0 });
    expect(player.characterId).toBe(character.id);
    expect(player.tokenUrl).toBe(`data:image/webp;base64,${character.tokenWebp}`);
    expect(client.state.players.get(saved.id)?.characterName).toBe("Ael");
    expect(master.state.players.get(saved.id)?.maxHp).toBe(110);
    expect(database.db.select().from(players).all().find(p => p.id === saved.id)?.characterId).toBe(character.id);
    error = client.waitForMessage("ACTION_ERROR");
    client.send("SUBMIT_CHARACTER", characterPayload());
    await error;
    expect(database.db.select().from(characters).all()).toHaveLength(1);
    await client.leave();
    await until(() => !player.connected);
    const rejoined = await testServer.connectTo(room, { name: "Ana", sessionToken: saved.sessionToken, ...version });
    expect(room.state.players.get(saved.id)?.status).toBe("READY");
    await rejoined.leave(); await master.leave();
  });
  it("sincroniza movimento FCFS e culling entre dois jogadores e o Mestre", async () => {
    const master = await testServer.connectTo(room, { password: "master-test-password", ...version });
    const saved = database.db.select().from(players).all().find(p => p.name === "Ana")!;
    const ana = await testServer.connectTo(room, { name: "Ana", sessionToken: saved.sessionToken, ...version });
    const nilo = await testServer.connectTo(room, { name: "Nilo", ...version });
    const a = room.state.players.get(saved.id)!;
    const b = [...room.state.players.values()].find(p => p.name === "Nilo")!;
    master.send("APPROVE_PLAYER", { targetPlayerId: b.id });
    await until(() => b.status === "NEEDS_CHARACTER_CREATION");
    nilo.send("SUBMIT_CHARACTER", characterPayload()); await until(() => b.status === "READY");
    expect([a.q, a.r]).not.toEqual([b.q, b.r]);
    await until(() => ana.state.players.get(a.id)?.currentChamberId === "training-1");
    expect(ana.state.monsters.has("training-1:monster")).toBe(false);
    expect(ana.state.monsters.has("training-2:monster")).toBe(false);
    await until(() => master.state.monsters.has("training-2:monster"));
    master.send("SET_EXPLORATION_MODE", "FREE_EXPLORATION");
    master.send("MASTER_MOVE_ENTITY", { entityId: a.id, chamberId: "training-1", q: 0, r: 0 });
    master.send("MASTER_MOVE_ENTITY", { entityId: b.id, chamberId: "training-1", q: 2, r: 0 });
    await until(() => a.moveRevision === 1 && b.moveRevision === 1);
    const errors: string[] = [];
    ana.onMessage("ACTION_ERROR", (message: string) => errors.push(message));
    nilo.onMessage("ACTION_ERROR", (message: string) => errors.push(message));
    ana.send("REQUEST_MOVE", { targetQ: 1, targetR: 0, revision: a.moveRevision });
    nilo.send("REQUEST_MOVE", { targetQ: 1, targetR: 0, revision: b.moveRevision });
    await until(() => errors.length === 1 && (a.q === 1 || b.q === 1));
    expect(errors[0]).toContain("ocupado");
    expect([a, b].filter(p => p.q === 1 && p.r === 0)).toHaveLength(1);
    expect(a.q === 1 ? b.q : a.q).toBe(a.q === 1 ? 2 : 0);
    await until(() => ana.state.monsters.has("training-1:monster"));
    master.send("MASTER_SET_HIDDEN", { entityId: "training-1:monster", hidden: true });
    await until(() => !ana.state.monsters.has("training-1:monster"));
    expect(master.state.monsters.has("training-1:monster")).toBe(true);
    const denied = ana.waitForMessage("ACTION_ERROR");
    ana.send("MASTER_SET_HIDDEN", { entityId: "training-1:monster", hidden: false });
    expect(await denied).toContain("autorizada");
    await ana.leave(); await nilo.leave(); await master.leave();
  });
  it("restaura sala e aprovação após recriar a sala autoritativa", async () => {
    const saved = database.db.select().from(players).all().find(p => p.name === "Ana")!;
    const code = room.roomId;
    const master = await testServer.connectTo(room, { password: "master-test-password", ...version });
    const pending = await testServer.connectTo(room, { name: "Fabio", ...version });
    const withoutCharacter = Array.from(room.state.players.values()).find(p => p.name === "Fabio")!;
    master.send("APPROVE_PLAYER", { targetPlayerId: withoutCharacter.id });
    await until(() => withoutCharacter.status === "NEEDS_CHARACTER_CREATION");
    await pending.leave(); await master.leave();
    await testServer.cleanup();
    room = await testServer.createRoom<GameRoom>("game", { bootstrapKey: "local-key", roomCode: code });
    expect(room.state.players.get(withoutCharacter.id)?.status).toBe("NEEDS_CHARACTER_CREATION");
    expect(database.db.select().from(sessions).all().filter(s => s.status === "ACTIVE")).toHaveLength(1);
    const restored = await testServer.connectTo(room, { name: "Ignored", sessionToken: saved.sessionToken, ...version });
    expect(room.state.players.get(saved.id)?.status).toBe("READY");
    expect(room.state.players.get(saved.id)?.connected).toBe(true);
    expect(room.state.players.get(saved.id)?.characterName).toBe("Ael");
    expect(room.state.players.get(saved.id)?.hp).toBe(110);
    const rejected = database.db.select().from(players).all().find(p => p.name === "Bia")!;
    await expect(testServer.connectTo(room, { name: "Bia", sessionToken: rejected.sessionToken, ...version })).rejects.toThrow();
    await restored.leave();
  });

});
