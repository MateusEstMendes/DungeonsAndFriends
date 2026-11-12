import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const dungeonsMigrations = sqliteTable("_dungeons_migrations", {
  version: text("version").primaryKey(),
  appliedAt: integer("applied_at").notNull(),
  checksum: text("checksum").notNull(),
});

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  masterPasswordHash: text("master_password_hash").notNull(),
  status: text("status", { enum: ["LOBBY", "ACTIVE", "PAUSED"] }).notNull().default("LOBBY"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
}, table => [
  check("rooms_code_valid", sql`length(${table.code}) = 5 AND ${table.code} NOT GLOB '*[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]*'`),
  check("rooms_status_valid", sql`${table.status} IN ('LOBBY', 'ACTIVE', 'PAUSED')`),
]);

export const players = sqliteTable("players", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  roomId: text("room_id").notNull().references(() => rooms.id),
  name: text("name").notNull(),
  sessionToken: text("session_token").notNull().unique(),
  reconnectionToken: text("reconnection_token"),
  approvalStatus: text("approval_status", { enum: ["PENDING_APPROVAL", "APPROVED", "REJECTED", "NEEDS_CHARACTER_CREATION"] }).notNull().default("PENDING_APPROVAL"),
  lastSeenAt: integer("last_seen_at").notNull().$defaultFn(() => Date.now()),
}, table => [
  index("players_room_id_idx").on(table.roomId),
  check("players_approval_status_valid", sql`${table.approvalStatus} IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NEEDS_CHARACTER_CREATION')`),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id),
  status: text("status", { enum: ["ACTIVE", "CLOSED"] }).notNull().default("ACTIVE"),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
}, table => [
  index("sessions_room_id_idx").on(table.roomId),
  check("sessions_status_valid", sql`${table.status} IN ('ACTIVE', 'CLOSED')`),
]);
