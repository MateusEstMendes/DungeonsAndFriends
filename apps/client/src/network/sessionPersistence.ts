import { SessionCredentialsPayloadSchema, type SessionCredentialsPayload } from "@df/shared";
export const sessionKeys = { token: "df_session_token", reconnect: "df_reconnection_token", room: "df_room_code", name: "df_player_name" } as const;
function read(key: string) { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }
export function savedSession() {
  return { sessionToken: read(sessionKeys.token), reconnectionToken: read(sessionKeys.reconnect), roomCode: read(sessionKeys.room), name: read(sessionKeys.name) };
}
export function persistCredentials(credentials: SessionCredentialsPayload) {
  const data = SessionCredentialsPayloadSchema.parse(credentials);
  try {
    localStorage.setItem(sessionKeys.token, data.sessionToken);
    localStorage.setItem(sessionKeys.reconnect, data.reconnectionToken);
    localStorage.setItem(sessionKeys.room, data.roomCode);
    localStorage.setItem(sessionKeys.name, data.playerName);
    return true;
  } catch { return false; }
}
export function persistReconnectionToken(token: string) {
  try { localStorage.setItem(sessionKeys.reconnect, token); return true; } catch { return false; }
}
export function clearSession() {
  try { Object.values(sessionKeys).forEach(key => localStorage.removeItem(key)); } catch { /* armazenamento indisponível */ }
}
