import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, persistCredentials, persistReconnectionToken, savedSession } from "../src/network/sessionPersistence";
const credentials = {
  playerId: "9df0402f-5064-42f5-a35c-77e1524eac46", playerName: "Ana", role: "PLAYER" as const,
  sessionToken: "signed-token", reconnectionToken: "AB2CD:native-token", roomCode: "AB2CD",
};
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("persistência da sessão no navegador", () => {
  it("salva as chaves do protocolo e substitui o token após aprovação", () => {
    expect(persistCredentials(credentials)).toBe(true);
    expect(values.get("df_session_token")).toBe("signed-token");
    expect(values.get("df_reconnection_token")).toBe("AB2CD:native-token");
    expect(values.get("df_room_code")).toBe("AB2CD");
    persistCredentials({ ...credentials, sessionToken: "approved-token" });
    persistReconnectionToken("AB2CD:rotated-native-token");
    expect(savedSession()).toEqual({ sessionToken: "approved-token", reconnectionToken: "AB2CD:rotated-native-token", roomCode: "AB2CD", name: "Ana" });
    clearSession();
    expect(savedSession()).toEqual({ sessionToken: "", reconnectionToken: "", roomCode: "", name: "" });
  });
  it("recusa credenciais inválidas antes de sobrescrever a sessão salva", () => {
    persistCredentials(credentials);
    expect(() => persistCredentials({ ...credentials, roomCode: "BAD" })).toThrow();
    expect(savedSession().roomCode).toBe("AB2CD");
  });
  it("tolera armazenamento bloqueado pelo navegador", () => {
    vi.stubGlobal("localStorage", { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } });
    expect(persistCredentials(credentials)).toBe(false);
    expect(persistReconnectionToken("token")).toBe(false);
    expect(savedSession().sessionToken).toBe("");
  });
});
