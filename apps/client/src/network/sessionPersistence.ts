import { SessionCredentialsPayloadSchema, type SessionCredentialsPayload } from "@df/shared";
import { sessionKeys } from './sessionStorage';
export { sessionKeys, savedSession } from './sessionStorage';
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
