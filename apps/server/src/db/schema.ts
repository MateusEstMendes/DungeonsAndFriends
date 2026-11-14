import type { RaceId, ArchetypeId } from "@df/shared";
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, unique, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const dungeonsMigrations = sqliteTable("_dungeons_migrations", {
  version: text("version").primaryKey(),
  appliedAt: integer("applied_at").notNull(),
  checksum: text("checksum").notNull(),
});

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  masterPasswordHash: text("master_password_hash").notNull(),
  activeStageId: text("active_stage_id").notNull().default("training"),
  explorationMode: text("exploration_mode", { enum: ["DUNGEON_TENSE_30S", "FREE_EXPLORATION"] }).notNull().default("DUNGEON_TENSE_30S"),
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
  characterId: text("character_id").references((): AnySQLiteColumn => characters.id),
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

// APPROVED continua sendo a autorização persistida; READY é derivado da ficha existente.
export const characters = sqliteTable("characters", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  playerId: text("player_id").notNull().unique().references((): AnySQLiteColumn => players.id),
  roomId: text("room_id").notNull().references(() => rooms.id),
  name: text("name").notNull(),
  raceId: text("race_id").$type<RaceId>().notNull(),
  archetypeId: text("archetype_id").$type<ArchetypeId>().notNull(),
  baseStr: integer("base_str").notNull(),
  baseDex: integer("base_dex").notNull(),
  baseCon: integer("base_con").notNull(),
  baseInt: integer("base_int").notNull(),
  baseWis: integer("base_wis").notNull(),
  baseCha: integer("base_cha").notNull(),
  finalStr: integer("final_str").notNull(),
  finalDex: integer("final_dex").notNull(),
  finalCon: integer("final_con").notNull(),
  finalInt: integer("final_int").notNull(),
  finalWis: integer("final_wis").notNull(),
  finalCha: integer("final_cha").notNull(),
  hp: integer("hp").notNull(),
  maxHp: integer("max_hp").notNull(),
  mp: integer("mp").notNull(),
  maxMp: integer("max_mp").notNull(),
  defense: integer("defense").notNull(),
  dodgeChance: integer("dodge_chance").notNull(),
  speed: integer("speed").notNull(),
  flatDr: integer("flat_dr").notNull(),
  visualConfigJson: text("visual_config_json").notNull(),
  portraitWebp: text("portrait_webp").notNull(),
  tokenWebp: text("token_webp").notNull(),
  currentChamberId: text("current_chamber_id").notNull().default("training-1"),
  posQ: integer("pos_q").notNull().default(0),
  posR: integer("pos_r").notNull().default(0),
  moveCooldownEndsAt: integer("move_cooldown_ends_at").notNull().default(0),
  remainingSteps: integer("remaining_steps").notNull().default(-1),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
}, table => [index("characters_room_id_idx").on(table.roomId)]);

export const maps = sqliteTable("maps", {
  id: text("id").primaryKey(), name: text("name").notNull(),
});
export const chambers = sqliteTable("chambers", {
  id: text("id").primaryKey(), mapId: text("map_id").notNull().references(() => maps.id),
  name: text("name").notNull(), biome: text("biome").notNull().default("DUNGEON"),
  minQ: integer("min_q").notNull(), maxQ: integer("max_q").notNull(),
  minR: integer("min_r").notNull(), maxR: integer("max_r").notNull(),
  spawnQ: integer("spawn_q").notNull().default(0), spawnR: integer("spawn_r").notNull().default(0),
  offsetX: integer("offset_x").notNull().default(0), offsetY: integer("offset_y").notNull().default(0),
  portalsJson: text("portals_json").notNull().default("[]"),
});
export const terrainCells = sqliteTable("terrain_cells", {
  id: text("id").primaryKey(), chamberId: text("chamber_id").notNull().references(() => chambers.id),
  q: integer("q").notNull(), r: integer("r").notNull(), terrain: text("terrain").notNull(),
}, t => [unique("terrain_cells_chamber_q_r_unique").on(t.chamberId, t.q, t.r), check("terrain_cells_terrain_valid", sql`${t.terrain} IN ('STONE','GRASS','DIRT','SAND','WATER','DEEP_WATER','OBSTACLE')`)]);
export const walls = sqliteTable("walls", {
  id: text("id").primaryKey(), chamberId: text("chamber_id").notNull().references(() => chambers.id), edgeKey: text("edge_key").notNull(),
}, t => [unique("walls_chamber_edge_unique").on(t.chamberId, t.edgeKey)]);
export const placedObjects = sqliteTable("placed_objects", {
  id: text("id").primaryKey(), chamberId: text("chamber_id").notNull().references(() => chambers.id),
  kind: text("kind").notNull(), name: text("name").notNull(),
  q: integer("q").notNull(), r: integer("r").notNull(), rotation: integer("rotation").notNull().default(0),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
}, t => [check("placed_objects_hidden_valid", sql`${t.hidden} IN (0,1)`)]);
export const editorHistory = sqliteTable("editor_history", {
  id: integer("id").primaryKey({ autoIncrement: true }), roomId: text("room_id").notNull().references(() => rooms.id),
  beforeJson: text("before_json").notNull(), afterJson: text("after_json").notNull(),
  undone: integer("undone", { mode: "boolean" }).notNull().default(false),
}, t => [check("editor_history_undone_valid", sql`${t.undone} IN (0,1)`)]);

export const monstersCatalog = sqliteTable('monsters_catalog', {
  id: text('id').primaryKey(), name: text('name').notNull(),
  hp: integer('hp').notNull(), mp: integer('mp').notNull().default(0),
  str: integer('str').notNull(), dex: integer('dex').notNull(), int: integer('int').notNull(),
  speed: integer('speed').notNull(), flatDr: integer('flat_dr').notNull().default(0),
  passiveDodge: integer('passive_dodge').notNull().default(0),
  attackType: text('attack_type').notNull(), baseDamage: integer('base_damage').notNull(),
});
export const combatEncounters = sqliteTable('combat_encounters', {
  id: text('id').primaryKey(), roomId: text('room_id').notNull().references(() => rooms.id),
  chamberId: text('chamber_id').notNull(), status: text('status', { enum: ['ACTIVE','ENDED','FLED'] }).notNull().default('ACTIVE'),
  biome: text('biome').notNull(), round: integer('round').notNull(),
  turnOrderJson: text('turn_order_json').notNull(), activeParticipantId: text('active_participant_id').notNull(),
  remainingActions: integer('remaining_actions').notNull(), actionIndex: integer('action_index').notNull().default(0),
  fleeMode: text('flee_mode').notNull().default('NORMAL'), isPaused: integer('is_paused', { mode: 'boolean' }).notNull().default(false),
  turnToken: text('turn_token').notNull(), cutoffsJson: text('cutoffs_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t => [index('combat_encounters_room_idx').on(t.roomId), uniqueIndex('combat_encounters_one_active').on(t.roomId).where(sql`${t.status} = 'ACTIVE'`)]);
export const combatParticipants = sqliteTable('combat_participants', {
  id: text('id').notNull(), encounterId: text('encounter_id').notNull().references(() => combatEncounters.id),
  kind: text('kind').notNull(), statsJson: text('stats_json').notNull(),
  hp: integer('hp').notNull(), mp: integer('mp').notNull(),
}, t => [unique('combat_participants_encounter_entity').on(t.encounterId, t.id)]);
export const activeBuffs = sqliteTable('active_buffs', {
  id: text('id').primaryKey(), encounterId: text('encounter_id').notNull().references(() => combatEncounters.id),
  participantId: text('participant_id').notNull(), kind: text('kind').notNull(),
  amount: integer('amount').notNull(), expiresRound: integer('expires_round').notNull(),
});
