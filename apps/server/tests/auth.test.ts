import { describe, expect, it } from "vitest";
import { generateRoomCode, hashPassword, maskIp, signSessionToken, validateSessionToken, verifyPassword } from "../src/rooms/handlers/auth.js";

describe("autenticação", () => {
  it("gera 10.000 códigos sem caracteres ambíguos", () => {
    for (let i = 0; i < 10_000; i++) expect(generateRoomCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
  });
  it("assina identidade e recusa adulteração e outra chave", () => {
    const identity = { playerId: "player", roomId: "room", role: "PLAYER" as const };
    const token = signSessionToken(identity, "secret");
    expect(validateSessionToken(token, "secret")).toMatchObject(identity);
    expect(validateSessionToken(token, "other")).toBeNull();
    expect(validateSessionToken(`x${token}`, "secret")).toBeNull();
    expect(validateSessionToken("malformed", "secret")).toBeNull();
    expect(signSessionToken(identity, "secret")).not.toBe(token);
  });
  it("usa salt e valida a senha sem remover espaços", () => {
    const hash = hashPassword(" senha ");
    expect(hash).not.toBe(hashPassword(" senha "));
    expect(verifyPassword(" senha ", hash)).toBe(true);
    expect(verifyPassword("senha", hash)).toBe(false);
    expect(verifyPassword("senha", "bad")).toBe(false);
  });
  it("mascara endereços IPv4 e IPv6", () => {
    expect(maskIp("::ffff:192.168.1.23")).toBe("192.168.1.*");
    expect(maskIp("2001:db8:1234:abcd::1")).toBe("2001:db8:1234::*");
  });
});
