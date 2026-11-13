import {
  CharacterCreationSchema, validatePointBuy, applyRacialModifiers, getModifier,
  calculateMaxHp, calculateMaxMp, calculateBaseDefense, calculatePassiveDodge, calculateSpeed, calculateFlatDR,
} from "@df/shared";
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

/** Validação e derivação autoritativas: nenhum status calculado vem do cliente. */
export function prepareCharacter(input: unknown) {
  const payload = CharacterCreationSchema.parse(input);
  const pointBuy = validatePointBuy(payload.baseAttributes);
  if (!pointBuy.valid) throw new Error(pointBuy.error);
  const base = payload.baseAttributes;
  const final = applyRacialModifiers(base, payload.raceId, payload.humanBonusAttribute);
  const dexMod = getModifier(final.dex);
  const maxHp = calculateMaxHp(getModifier(final.con));
  const maxMp = calculateMaxMp(final.int, getModifier(final.wis));
  return {
    name: payload.name, raceId: payload.raceId, archetypeId: payload.archetypeId,
    baseStr: base.str, baseDex: base.dex, baseCon: base.con, baseInt: base.int, baseWis: base.wis, baseCha: base.cha,
    finalStr: final.str, finalDex: final.dex, finalCon: final.con, finalInt: final.int, finalWis: final.wis, finalCha: final.cha,
    hp: maxHp, maxHp, mp: maxMp, maxMp,
    defense: calculateBaseDefense(dexMod, payload.raceId),
    dodgeChance: calculatePassiveDodge(dexMod, payload.raceId),
    speed: calculateSpeed(dexMod), flatDr: calculateFlatDR(payload.raceId),
    visualConfigJson: JSON.stringify(payload.visualConfig),
    portraitWebp: payload.portraitBase64.replace(/^data:image\/webp;base64,/, ""),
    tokenWebp: payload.tokenBase64.replace(/^data:image\/webp;base64,/, ""),
  };
}
