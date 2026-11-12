import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type PlayerRole } from "@df/shared";

export function generateRoomCode() {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join("");
}
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, "hex"));
}
export function loadTokenSecret(path: string) {
  try { return readFileSync(path, "utf8").trim(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const secret = randomBytes(32).toString("hex");
    writeFileSync(path, secret, { mode: 0o600, flag: "wx" });
    return secret;
  }
}
export interface SessionIdentity { playerId: string; roomId: string; role: PlayerRole }
export function signSessionToken(identity: SessionIdentity, secret: string) {
  const body = Buffer.from(JSON.stringify({ ...identity, nonce: randomBytes(16).toString("hex") })).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export function validateSessionToken(token: string, secret: string): SessionIdentity | null {
  if (token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const value = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof value.playerId === "string" && typeof value.roomId === "string" && ["MASTER", "PLAYER"].includes(value.role) ? value : null;
  } catch { return null; }
}
export function maskIp(ip: string) {
  const clean = ip.replace(/^::ffff:/, "");
  return clean.includes(":") ? `${clean.split(":").slice(0, 3).join(":")}::*` : clean.replace(/\.\d+$/, ".*");
}
