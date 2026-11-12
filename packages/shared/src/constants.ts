export const PROTOCOL_VERSION = "0.1.0" as const;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

export const PLAYER_ROLES = ["MASTER", "PLAYER"] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];
export const APPROVAL_STATUSES = [
  "PENDING_APPROVAL", "APPROVED", "REJECTED", "NEEDS_CHARACTER_CREATION",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export const SESSION_STATUSES = ["LOBBY", "ACTIVE", "PAUSED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];
