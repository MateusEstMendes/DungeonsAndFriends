import { afterEach, describe, expect, it } from "vitest";
import { Decoder, Encoder } from "@colyseus/schema";
import type { Client } from "@colyseus/core";
import { getHexEdgeKey, MonsterSchema, PlayerSchema, RoomState } from "@df/shared";
import { characterPayload } from "../../../packages/shared/tests/characterFixture.js";
import { openDatabase } from "../src/db/index.js";
import { characters, players } from "../src/db/schema.js";
import { prepareHost } from "../src/host.js";
import { prepareCharacter } from "../src/rooms/handlers/auth.js";
import { MovementHandler } from "../src/rooms/handlers/movement.js";
import { MasterHandler } from "../src/rooms/handlers/master.js";
import { FovService } from "../src/services/fovService.js";
import { loadBoard, readBoard } from "../src/services/boardRepository.js";
const databases: ReturnType<typeof openDatabase>[] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });
function setup() {
  const database = openDatabase(":memory:"); databases.push(database);
  const { room } = prepareHost(database, "test-password"), state = new RoomState(); state.activeStageId = "training";
  loadBoard(state, readBoard(database));
  const movement = new MovementHandler(state, database, () => {});
  const master = new MasterHandler(state, database, room.id, movement, () => {});
  function addPlayer(name: string, q = 0, r = 0) {
    const saved = database.db.insert(players).values({ name, roomId: room.id, sessionToken: name }).returning().get();
    const character = database.db.insert(characters).values({ ...prepareCharacter(characterPayload()), playerId: saved.id, roomId: room.id, posQ: q, posR: r }).returning().get();
    const p = Object.assign(new PlayerSchema(), { id: saved.id, name, characterId: character.id, currentChamberId: "training-1", q, r, status: "READY", connected: true, speed: 3, remainingSteps: 3 });
    state.players.set(p.id, p); return p;
  }
  return { database, state, movement, master, addPlayer };
}
describe("movimento autoritativo e editor", () => {
  it('releases absent cells, reserves reconnecting cells and chooses the nearest free return position', () => {
    const { state, movement, addPlayer } = setup();
    const a = addPlayer('Returning'), b = addPlayer('Occupant', 1, 0);
    a.connected = false;
    expect(movement.occupied(a.currentChamberId, a)).toBe(false);
    a.reconnecting = true;
    expect(movement.occupied(a.currentChamberId, a)).toBe(true);
    a.reconnecting = false;
    movement.masterMove({ entityId: b.id, chamberId: a.currentChamberId, q: a.q, r: a.r });
    a.connected = true;
    expect(movement.spawn(a)).toBe(true);
    expect([a.q, a.r]).not.toEqual([b.q,b.r]);
    expect(Math.max(Math.abs(a.q), Math.abs(a.r), Math.abs(a.q + a.r))).toBe(1);
    expect(state.players.size).toBe(2);
  });
  it('waits for placement when the chamber is full, rejects movement and allows another chamber', () => {
    const { state, movement, addPlayer, database } = setup();
    const a = addPlayer('Waiting');
    const chamber = state.chambers.get(a.currentChamberId)!;
    const originalCells = [...chamber.cells.entries()];
    chamber.cells.clear(); chamber.cells.set('0,0', 'OBSTACLE');
    expect(movement.spawn(a)).toBe(false);
    expect(a.awaitingPosition).toBe(true);
    expect(movement.occupied(a.currentChamberId, a)).toBe(false);
    expect(() => movement.request(a, { targetQ: 1, targetR: 0, revision: a.moveRevision })).toThrow();
    expect(() => movement.masterMove({ entityId: a.id, chamberId: chamber.id, q: 0, r: 0 })).toThrow();
    movement.masterMove({ entityId: a.id, chamberId: 'training-2', q: -4, r: 0 });
    expect(a.awaitingPosition).toBe(false); expect(a.currentChamberId).toBe('training-2');
    expect(database.db.select().from(characters).get()?.currentChamberId).toBe('training-2');
    for (const [key, terrain] of originalCells) chamber.cells.set(key, terrain);
  });
  it('does not let offline characters block terrain edits', () => {
    const { master, addPlayer } = setup();
    const a = addPlayer('Absent'); a.connected = false;
    expect(() => master.edit({ layer: 'TERRAIN', chamberId: a.currentChamberId, q: a.q, r: a.r, terrain: 'OBSTACLE' })).not.toThrow();
  });
  it("consome passos, inicia 30s ao esgotar e renova sem depender de relógio do cliente", () => {
    const { movement, addPlayer } = setup(), p = addPlayer("Ana");
    movement.request(p, { targetQ: 1, targetR: 0, revision: 0 }, 1000);
    expect(p.remainingSteps).toBe(2); expect(p.moveCooldownEndsAt).toBe(0);
    movement.request(p, { targetQ: 3, targetR: 0, revision: 0 }, 1001);
    expect(p.remainingSteps).toBe(0); expect(p.moveCooldownEndsAt).toBe(31001);
    expect(() => movement.request(p, { targetQ: 2, targetR: 0, revision: 0 }, 31000)).toThrow("intervalo");
    movement.request(p, { targetQ: 2, targetR: 0, revision: 0 }, 31001);
    expect(p.remainingSteps).toBe(2);
    movement.endTurn(p, 31002); expect(p.moveCooldownEndsAt).toBe(61002);
  });
  it("reserva FCFS e aplica prioridade do Mestre com invalidação de comandos antigos", () => {
    const { movement, addPlayer } = setup(), a = addPlayer("Ana"), b = addPlayer("Bia", 2, 0);
    movement.request(a, { targetQ: 1, targetR: 0, revision: 0 }, 1000);
    expect(() => movement.request(b, { targetQ: 1, targetR: 0, revision: 0 }, 1000)).toThrow("ocupado");
    expect(b.q).toBe(2);
    movement.endTurn(a, 1001);
    movement.masterMove({ entityId: a.id, chamberId: "training-1", q: -1, r: 0 });
    expect(a.q).toBe(-1); expect(a.moveRevision).toBe(1);
    expect(() => movement.request(a, { targetQ: 0, targetR: 0, revision: 0 }, 50000)).toThrow("Mestre");
    expect(() => movement.masterMove({ entityId: a.id, chamberId: "training-1", q: b.q, r: b.r })).toThrow("ocupado");
  });
  it("trava spam no modo livre, bloqueia água e transfere pelo primeiro portal", () => {
    const { state, movement, master, addPlayer, database } = setup(), p = addPlayer("Ana");
    master.mode("FREE_EXPLORATION");
    movement.request(p, { targetQ: 5, targetR: 0, revision: 0 }, 1000);
    expect(p.currentChamberId).toBe("training-2"); expect(p.q).toBe(-4);
    expect(() => movement.request(p, { targetQ: -3, targetR: 0, revision: 0 }, 1999)).toThrow("intervalo");
    expect(() => movement.request(p, { targetQ: 0, targetR: 2, revision: 0 }, 2000)).toThrow("bloqueado");
    const saved = database.db.select().from(characters).get()!;
    expect(saved).toMatchObject({ currentChamberId: "training-2", posQ: -4, posR: 0 });
    const blocker = addPlayer("Bia", 4, 0);
    expect(() => movement.request(p, { targetQ: -5, targetR: 0, revision: 0 }, 2000)).toThrow("saída");
    expect(p.currentChamberId).toBe("training-2");
    state.players.delete(blocker.id);
    movement.request(p, { targetQ: -5, targetR: 0, revision: 0 }, 2000);
    expect(p.currentChamberId).toBe("training-1"); expect(p.q).toBe(4);
  });
  it("aloca spawn livre e mantém 10 undo/redo exatos, inclusive expansão de borda", () => {
    const { state, master, addPlayer, movement, database } = setup(), a = addPlayer("Ana"), b = addPlayer("Bia");
    movement.spawn(b); expect([b.q, b.r]).not.toEqual([a.q, a.r]);
    const before = readBoard(database);
    for (let i = 0; i < 10; i++) master.edit({ layer: "TERRAIN", chamberId: "training-1", q: 6 + i, r: 0, terrain: "GRASS" });
    const after = readBoard(database);
    expect(state.chambers.get("training-1")?.bounds.maxQ).toBe(15);
    for (let i = 0; i < 10; i++) master.history(false);
    expect(readBoard(database)).toEqual(before);
    for (let i = 0; i < 10; i++) master.history(true);
    expect(readBoard(database)).toEqual(after);
    master.history(false);
    master.edit({ layer: "OBJECT", chamberId: "training-1", q: 1, r: 0, kind: "TABLE", rotation: 120, hidden: true });
    expect(() => master.history(true)).toThrow("Nada");
    expect([...state.objects.values()].some(o => o.kind === "TABLE" && o.rotation === 120 && o.isHiddenByMaster)).toBe(true);
  }, 15_000);
  it("mantém movimento e rotação de objetos no histórico e persiste paredes bidirecionais", () => {
    const { state, master, database } = setup();
    const before = readBoard(database);
    master.edit({ layer: "WALL", chamberId: "training-1", q: 0, r: 0, direction: 0, erase: false });
    expect(state.chambers.get("training-1")!.walls.has(getHexEdgeKey({ q: 1, r: 0 }, { q: 0, r: 0 }))).toBe(true);
    master.move({ entityId: "training-1:chest", chamberId: "training-1", q: -2, r: 0 });
    master.rotate({ entityId: "training-1:chest", rotation: 240 });
    expect(state.objects.get("training-1:chest")).toMatchObject({ q: -2, r: 0, rotation: 240 });
    for (let i = 0; i < 3; i++) master.history(false);
    expect(readBoard(database)).toEqual(before);
  });
  it("bloqueia cliques repetidos sem gravar duplicatas ou alterar o histórico", () => {
    const { master, database, state } = setup();
    const edit = { layer: "OBJECT", chamberId: "training-1", q: 0, r: 0, kind: "CHEST", rotation: 0, hidden: false };
    master.edit(edit);
    const saved = readBoard(database);
    for (let i = 0; i < 10; i++) expect(() => master.edit({ ...edit, rotation: 60, hidden: true })).toThrow("desse tipo");
    expect(readBoard(database)).toEqual(saved);
    expect([...state.objects.values()].filter(o => o.q === 0 && o.r === 0 && o.currentChamberId === "training-1")).toHaveLength(1);
    master.history(false);
    expect([...state.objects.values()].some(o => o.q === 0 && o.r === 0)).toBe(false);
    master.history(true);
    expect(readBoard(database)).toEqual(saved);
  });
  it("permite tipos diferentes sobrepostos e impede mover outro objeto igual para a célula", () => {
    const { master, database } = setup();
    for (const kind of ["CHEST", "TABLE", "CHAIR", "DOOR", "TORCH"]) master.edit({ layer: "OBJECT", chamberId: "training-1", q: 0, r: 0, kind, rotation: 0, hidden: false });
    const before = readBoard(database);
    expect(before.objects.filter(o => o.chamberId === "training-1" && o.q === 0 && o.r === 0)).toHaveLength(5);
    expect(() => master.move({ entityId: "training-1:chest", chamberId: "training-1", q: 0, r: 0 })).toThrow("desse tipo");
    expect(readBoard(database)).toEqual(before);
    master.move({ entityId: "training-1:chest", chamberId: "training-2", q: 0, r: 0 });
    expect(readBoard(database).objects.find(o => o.id === "training-1:chest")?.chamberId).toBe("training-2");
  });
  it("preserva duplicatas antigas e permite separá-las sem restaurar o empilhamento por Undo", () => {
    const { master, database, state } = setup();
    database.sqlite.prepare("INSERT INTO placed_objects (id,chamber_id,kind,name,q,r) VALUES ('legacy-chest','training-1','CHEST','Baú antigo duplicado',3,-2)").run();
    loadBoard(state, readBoard(database));
    master.move({ entityId: "legacy-chest", chamberId: "training-1", q: 0, r: 0 });
    expect(() => master.history(false)).toThrow("desse tipo");
    expect(readBoard(database).objects.find(o => o.id === "legacy-chest")).toMatchObject({ q: 0, r: 0 });
    master.remove({ entityId: "legacy-chest" });
    expect(readBoard(database).objects.some(o => o.id === "legacy-chest")).toBe(false);
  });
});
describe("culling FOV no codec de rede", () => {
  it('keeps encounter tokens and initiative private to its chamber and master', () => {
    const { state, addPlayer } = setup(), own = addPlayer('Ana');
    own.currentChamberId = 'training-2';
    Object.assign(state.combatState, { active: true, chamberId: 'training-1', turnToken: 'SECRET_COMBAT_TOKEN' });
    state.combatState.turnOrder.push('SECRET_MONSTER_INITIATIVE');
    const gm = Object.assign(new PlayerSchema(), { id: 'gm', role: 'MASTER' }); state.players.set(gm.id, gm);
    const viewer = { send() {} } as unknown as Client, referee = { send() {} } as unknown as Client;
    const encoder = new Encoder(state), fov = new FovService(state);
    const refresh = () => fov.refresh([viewer,referee], client => client === viewer ? own.id : gm.id);
    const wire = (client: Client) => { const bytes = encoder.encodeAll(); return Buffer.from(encoder.encodeAllView(client.view!, bytes.byteLength, { offset: bytes.byteLength })).toString('utf8'); };
    refresh(); expect(wire(viewer)).not.toContain('SECRET_'); expect(wire(referee)).toContain('SECRET_COMBAT_TOKEN');
    own.currentChamberId = 'training-1'; refresh(); expect(wire(viewer)).toContain('SECRET_MONSTER_INITIATIVE');
  });
  it("omite bytes de monstros distantes, atrás de paredes, ocultos e de outra câmara; remove após sair da visão", () => {
    const { state, addPlayer } = setup(), own = addPlayer("Ana");
    const behind = Object.assign(new MonsterSchema(), { id: "behind-wall", name: "SEGREDO_PAREDE", currentChamberId: "training-1", q: 1, r: 0 });
    const hidden = Object.assign(new MonsterSchema(), { id: "hidden", name: "SEGREDO_OCULTO", currentChamberId: "training-1", q: -1, r: 0, isHiddenByMaster: true });
    state.monsters.set(behind.id, behind); state.monsters.set(hidden.id, hidden);
    state.chambers.get("training-1")!.walls.set(getHexEdgeKey(own, behind), true);
    const encoder = new Encoder(state), fov = new FovService(state);
    const playerClient = { send() {} } as unknown as Client, gmClient = { send() {} } as unknown as Client;
    const gm = Object.assign(new PlayerSchema(), { id: "gm", role: "MASTER" }); state.players.set(gm.id, gm);
    fov.refresh([playerClient, gmClient], client => client === playerClient ? own.id : gm.id);
    const received = new RoomState(), decoder = new Decoder(received);
    function full(client: Client) { const shared = encoder.encodeAll(); return encoder.encodeAllView(client.view!, shared.byteLength, { offset: shared.byteLength }).slice(); }
    const bytes = full(playerClient);
    decoder.decode(bytes);
    expect(received.monsters.size).toBe(0); expect(received.objects.has("training-2:chest")).toBe(false);
    const wire = Buffer.from(bytes).toString("utf8");
    for (const secret of ["SEGREDO_PAREDE", "SEGREDO_OCULTO", "training-1:monster", "training-2:chest"]) expect(wire).not.toContain(secret);
    const gmState = new RoomState(); new Decoder(gmState).decode(full(gmClient));
    expect(gmState.monsters.size).toBe(state.monsters.size);
    encoder.discardChanges();
    // A teammate opens a shared sightline from the other side of the wall.
    const ally = addPlayer("Bia", 2, 0);
    fov.refresh([playerClient, gmClient], client => client === playerClient ? own.id : gm.id);
    let it = { offset: 0 }; encoder.encode(it); decoder.decode(encoder.encodeView(playerClient.view!, it.offset, { offset: it.offset })); encoder.discardChanges();
    expect(received.monsters.has(behind.id)).toBe(true);
    expect(received.monsters.has(hidden.id)).toBe(false);
    ally.connected = false;
    fov.refresh([playerClient, gmClient], client => client === playerClient ? own.id : gm.id);
    it = { offset: 0 }; encoder.encode(it); decoder.decode(encoder.encodeView(playerClient.view!, it.offset, { offset: it.offset }));
    expect(received.monsters.has(behind.id)).toBe(false);
  });
});
