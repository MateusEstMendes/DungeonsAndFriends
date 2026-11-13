import { ATTRIBUTE_IDS } from "../rules/pointBuy.js";
import { RACE_IDS } from "../rules/races.js";
import { ARCHETYPE_IDS } from "../rules/classes.js";
import { z } from "zod";
import { PROTOCOL_VERSION, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../constants.js";

export const RoomCodeSchema = z.string().trim().toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`));
export const PlayerNameSchema = z.string().trim().min(1).max(40)
  .regex(/^[^\u0000-\u001f\u007f]+$/, "O nome não pode conter caracteres de controle");
export const VersionHandshakePayloadSchema = z.strictObject({
  clientVersion: z.literal(PROTOCOL_VERSION),
});
// O código da sala é passado a joinById; não precisa ser duplicado no payload.
export const JoinRequestPayloadSchema = VersionHandshakePayloadSchema.extend({
  name: PlayerNameSchema,
  sessionToken: z.string().min(1).max(4096).optional(),
});
export const MasterAuthPayloadSchema = VersionHandshakePayloadSchema.extend({
  password: z.string().min(1).max(256),
});
// O comando APPROVE_PLAYER ou REJECT_PLAYER determina a decisão.
// A autorização do remetente deverá ser verificada pelo servidor.
export const ApprovalDecisionPayloadSchema = z.strictObject({
  targetPlayerId: z.uuid(),
});

export type JoinRequestPayload = z.infer<typeof JoinRequestPayloadSchema>;
export type MasterAuthPayload = z.infer<typeof MasterAuthPayloadSchema>;
export type ApprovalDecisionPayload = z.infer<typeof ApprovalDecisionPayloadSchema>;
export type VersionHandshakePayload = z.infer<typeof VersionHandshakePayloadSchema>;

export const SessionCredentialsPayloadSchema = z.strictObject({
  playerId: z.uuid(),
  playerName: PlayerNameSchema,
  role: z.enum(["MASTER", "PLAYER"]),
  sessionToken: z.string().min(1).max(4096),
  reconnectionToken: z.string().min(1).max(4096),
  roomCode: RoomCodeSchema,
});
export type SessionCredentialsPayload = z.infer<typeof SessionCredentialsPayloadSchema>;

export const BaseAttributesSchema = z.strictObject({
  str: z.number().int().min(8).max(15), dex: z.number().int().min(8).max(15),
  con: z.number().int().min(8).max(15), int: z.number().int().min(8).max(15),
  wis: z.number().int().min(8).max(15), cha: z.number().int().min(8).max(15),
});
export const VISUAL_LAYER_IDS = [
  "00_back_hair", "10_body_base", "20_skin_details", "30_ears", "40_eyes_iris",
  "50_mouth_fangs", "60_facial_hair", "70_front_hair", "80_horns",
] as const;
const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor RGB #RRGGBB.");
export const VisualConfigSchema = z.strictObject({
  layers: z.partialRecord(z.enum(VISUAL_LAYER_IDS), z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/)),
  colors: z.record(z.string().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/), HexColorSchema)
    .refine(colors => Object.keys(colors).length <= 16, "Máximo de 16 cores."),
});
// Aceita base64 puro e o data URL retornado por canvas.toDataURL('image/webp').
// Limita cada imagem a 64 KiB e verifica o contêiner RIFF/WEBP, sem depender de Buffer no browser.
export const MAX_WEBP_BYTES = 64 * 1024;
// Duas imagens em base64 e os metadados da ficha.
export const MAX_CHARACTER_MESSAGE_BYTES = 192 * 1024;
export const WebPBase64Schema = z.string().min(16).max(Math.ceil(MAX_WEBP_BYTES / 3) * 4 + 23)
  .refine(value => {
    const base64 = value.replace(/^data:image\/webp;base64,/, "");
    if (base64.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) return false;
    const binary = atob(base64);
    if (binary.length < 20 || binary.length > MAX_WEBP_BYTES || btoa(binary) !== base64) return false;
    const size = (binary.charCodeAt(4) | binary.charCodeAt(5) << 8 | binary.charCodeAt(6) << 16 | binary.charCodeAt(7) << 24) >>> 0;
    return binary.startsWith("RIFF") && binary.slice(8, 12) === "WEBP" && size + 8 === binary.length
      && ["VP8 ", "VP8L", "VP8X"].includes(binary.slice(12, 16));
  }, "Envie uma imagem WebP em base64 de até 64 KiB.");
export const CharacterCreationSchema = z.strictObject({
  name: PlayerNameSchema,
  baseAttributes: BaseAttributesSchema,
  humanBonusAttribute: z.enum(ATTRIBUTE_IDS).optional(),
  raceId: z.enum(RACE_IDS),
  archetypeId: z.enum(ARCHETYPE_IDS),
  visualConfig: VisualConfigSchema,
  portraitBase64: WebPBase64Schema,
  tokenBase64: WebPBase64Schema,
}).superRefine((value, ctx) => {
  if ((value.raceId === "HUMAN") !== (value.humanBonusAttribute !== undefined)) {
    ctx.addIssue({ code: "custom", path: ["humanBonusAttribute"], message: "Escolha o ponto extra apenas para Humanos; a escolha é obrigatória para essa raça." });
  }
});
export type CharacterCreationPayload = z.infer<typeof CharacterCreationSchema>;
export type VisualConfig = z.infer<typeof VisualConfigSchema>;
