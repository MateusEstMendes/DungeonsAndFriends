export const sessionKeys = { token: "df_session_token", reconnect: "df_reconnection_token", room: "df_room_code", name: "df_player_name" } as const;
function read(key: string) { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }
export function savedSession() {
  return { sessionToken: read(sessionKeys.token), reconnectionToken: read(sessionKeys.reconnect), roomCode: read(sessionKeys.room), name: read(sessionKeys.name) };
}
