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
