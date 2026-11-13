import { describe, expect, it } from "vitest";
import { Encoder, Decoder, StateView } from "@colyseus/schema";
import {
  ApprovalDecisionPayloadSchema, JoinRequestPayloadSchema,
  MasterAuthPayloadSchema, PlayerSchema, PROTOCOL_VERSION,
  RoomCodeSchema, RoomState, VersionHandshakePayloadSchema,
} from "../src/index.js";

describe("contratos de entrada", () => {
  it("normaliza código e nome e rejeita caracteres ambíguos", () => {
    expect(RoomCodeSchema.parse(" ab2cd ")).toBe("AB2CD");
    for (const code of ["AB0CD", "ABOCD", "AB1CD", "ABICD", "ABCD", "ABCDEF"]) {
      expect(RoomCodeSchema.safeParse(code).success).toBe(false);
    }
    expect(JoinRequestPayloadSchema.parse({ name: "  Ana  ", clientVersion: PROTOCOL_VERSION }).name).toBe("Ana");
  });
  it("recusa versões incompatíveis e tentativas de atribuir privilégios", () => {
    expect(VersionHandshakePayloadSchema.safeParse({ clientVersion: "0.2.0" }).success).toBe(false);
    expect(JoinRequestPayloadSchema.safeParse({ name: "Ana", clientVersion: PROTOCOL_VERSION, role: "MASTER" }).success).toBe(false);
    expect(JoinRequestPayloadSchema.safeParse({ name: " ", clientVersion: PROTOCOL_VERSION }).success).toBe(false);
    expect(ApprovalDecisionPayloadSchema.safeParse({ targetPlayerId: "" }).success).toBe(false);
  });
  it("preserva espaços da senha e recusa senha vazia", () => {
    expect(MasterAuthPayloadSchema.parse({ password: " senha ", clientVersion: PROTOCOL_VERSION }).password).toBe(" senha ");
    expect(MasterAuthPayloadSchema.safeParse({ password: "", clientVersion: PROTOCOL_VERSION }).success).toBe(false);
  });
});

describe("estado sincronizado", () => {
  it("transmite jogadores e alterações de aprovação via codec Colyseus", () => {
    const state = new RoomState();
    state.roomCode = "AB2CD";
    const player = new PlayerSchema();
    player.id = "9df0402f-5064-42f5-a35c-77e1524eac46";
    player.name = "Ana";
    state.players.set(player.id, player);
    const encoder = new Encoder(state);
    const view = new StateView(); view.add(player);
    const received = new RoomState();
    const decoder = new Decoder(received);
    const full = encoder.encodeAll();
    decoder.decode(encoder.encodeAllView(view, full.byteLength, { offset: full.byteLength }));
    expect(received.players.get(player.id)?.status).toBe("PENDING_APPROVAL");
    encoder.discardChanges();
    player.status = "NEEDS_CHARACTER_CREATION";
    player.connected = true;
    const it = { offset: 0 }; encoder.encode(it);
    decoder.decode(encoder.encodeView(view, it.offset, { offset: it.offset }));
    expect(received.players.get(player.id)?.status).toBe("NEEDS_CHARACTER_CREATION");
    expect(received.players.get(player.id)?.connected).toBe(true);
  });
});
