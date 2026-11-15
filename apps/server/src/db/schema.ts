import type { RaceId, ArchetypeId, AttributeId, InventorySlot, ItemId, SpellId } from "@df/shared";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, sqliteTable, text, unique, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

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
  index("idx_players_room_token").on(table.roomId, table.sessionToken),
  check("players_approval_status_valid", sql`${table.approvalStatus} IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NEEDS_CHARACTER_CREATION')`),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id),
  status: text("status", { enum: ["ACTIVE", "CLOSED"] }).notNull().default("ACTIVE"),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
}, table => [
  index("sessions_room_id_idx").on(table.roomId),
  uniqueIndex("sessions_room_id_id_unique").on(table.roomId, table.id),
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
  gold: integer("gold").notNull().default(50),
  humanBonusAttribute: text("human_bonus_attribute").$type<AttributeId>(),
  baseFinalDex: integer("base_final_dex"),
  starterKitGranted: integer("starter_kit_granted", { mode: "boolean" }).notNull().default(false),
  visualConfigJson: text("visual_config_json").notNull(),
  portraitWebp: text("portrait_webp").notNull(),
  tokenWebp: text("token_webp").notNull(),
  currentChamberId: text("current_chamber_id").notNull().default("training-1"),
  posQ: integer("pos_q").notNull().default(0),
  posR: integer("pos_r").notNull().default(0),
  moveCooldownEndsAt: integer("move_cooldown_ends_at").notNull().default(0),
  remainingSteps: integer("remaining_steps").notNull().default(-1),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
}, table => [index("characters_room_id_idx").on(table.roomId),
  check("characters_gold_valid", sql`typeof(${table.gold}) = 'integer' AND ${table.gold} >= 0 AND ${table.gold} <= 9007199254740991`),
  check("characters_starter_kit_valid", sql`${table.starterKitGranted} IN (0,1)`),
  check("characters_human_bonus_valid", sql`${table.humanBonusAttribute} IS NULL OR (${table.raceId} = 'HUMAN' AND ${table.humanBonusAttribute} IN ('str','dex','con','int','wis','cha'))`),
]);

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
}, t => [index("idx_cells_chamber_qr").on(t.chamberId, t.q, t.r), unique("terrain_cells_chamber_q_r_unique").on(t.chamberId, t.q, t.r), check("terrain_cells_terrain_valid", sql`${t.terrain} IN ('STONE','GRASS','DIRT','SAND','WATER','DEEP_WATER','OBSTACLE')`)]);
export const walls = sqliteTable("walls", {
  id: text("id").primaryKey(), chamberId: text("chamber_id").notNull().references(() => chambers.id), edgeKey: text("edge_key").notNull(),
}, t => [unique("walls_chamber_edge_unique").on(t.chamberId, t.edgeKey)]);
export const placedObjects = sqliteTable("placed_objects", {
  id: text("id").primaryKey(), chamberId: text("chamber_id").notNull().references(() => chambers.id),
  kind: text("kind").notNull(), name: text("name").notNull(),
  q: integer("q").notNull(), r: integer("r").notNull(), rotation: integer("rotation").notNull().default(0),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
}, t => [check("placed_objects_archived_valid", sql`${t.isArchived} IN (0,1)`), check("placed_objects_hidden_valid", sql`${t.hidden} IN (0,1)`)]);
export const editorHistory = sqliteTable("editor_history", {
  id: integer("id").primaryKey({ autoIncrement: true }), roomId: text("room_id").notNull().references(() => rooms.id),
  beforeJson: text("before_json").notNull(), afterJson: text("after_json").notNull(),
  discarded: integer("discarded", { mode: "boolean" }).notNull().default(false),
  undone: integer("undone", { mode: "boolean" }).notNull().default(false),
}, t => [check("editor_history_discarded_valid", sql`${t.discarded} IN (0,1)`), check("editor_history_undone_valid", sql`${t.undone} IN (0,1)`)]);

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
  globalAiEnabled: integer('global_ai_enabled', { mode: 'boolean' }).notNull().default(false),
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

export const itemsCatalog = sqliteTable('items_catalog', {
  id: text('id').$type<ItemId>().primaryKey(), name: text('name').notNull(), category: text('category').notNull(),
  handedness: text('handedness'), slot: text('slot').notNull(), basePriceGold: integer('base_price_gold').notNull(),
  damageDice: text('damage_dice'), damageType: text('damage_type'), armorType: text('armor_type'),
  defenseBonus: integer('defense_bonus').notNull().default(0), drBonus: integer('dr_bonus').notNull().default(0),
  dexPenalty: integer('dex_penalty').notNull().default(0), dodgeMod: integer('dodge_mod').notNull().default(0),
  maxDexBonus: integer('max_dex_bonus'), effectJson: text('effect_json'),
}, t => [check('items_price_valid', sql`typeof(${t.basePriceGold}) = 'integer' AND ${t.basePriceGold} >= 0 AND ${t.basePriceGold} <= 9007199254740991`)]);
export const spellsCatalog = sqliteTable('spells_catalog', {
  id: text('id').$type<SpellId>().primaryKey(), name: text('name').notNull(), description: text('description').notNull(),
  mpCost: integer('mp_cost').notNull(), targetMode: text('target_mode').notNull(), damageDice: text('damage_dice').notNull(),
  attribute: text('attribute').notNull(), element: text('element').notNull(), effectJson: text('effect_json'),
}, t => [check('spells_mp_valid', sql`typeof(${t.mpCost}) = 'integer' AND ${t.mpCost} >= 0`)]);
export const inventories = sqliteTable('inventories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  characterId: text('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  itemId: text('item_id').$type<ItemId>().notNull().references(() => itemsCatalog.id),
  slot: text('slot').$type<InventorySlot>().notNull().default('BAG'), quantity: integer('quantity').notNull().default(1),
}, t => [index('inventories_character_idx').on(t.characterId),
  index('idx_inventories_char_slot').on(t.characterId, t.slot),
  uniqueIndex('inventories_equipped_slot_unique').on(t.characterId, t.slot).where(sql`${t.slot} != 'BAG'`),
  uniqueIndex('inventories_bag_stack_unique').on(t.characterId, t.itemId).where(sql`${t.slot} = 'BAG'`),
  check('inventories_slot_valid', sql`${t.slot} IN ('MAIN_HAND','OFF_HAND','ARMOR','BAG')`),
  check('inventories_quantity_valid', sql`typeof(${t.quantity}) = 'integer' AND ${t.quantity} >= 1 AND ${t.quantity} <= 1000000 AND (${t.slot} = 'BAG' OR ${t.quantity} = 1)`),
]);
export const characterGrimoire = sqliteTable('character_grimoire', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  characterId: text('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  spellId: text('spell_id').$type<SpellId>().notNull().references(() => spellsCatalog.id),
}, t => [unique('character_grimoire_spell_unique').on(t.characterId, t.spellId)]);
export const npcShops = sqliteTable('npc_shops', {
  objectId: text('object_id').primaryKey().references(() => placedObjects.id),
  npcName: text('npc_name').notNull(), dialogue: text('dialogue').notNull().default(''),
  inventoryJson: text('inventory_json').notNull().default('[]'),
}, t => [check('npc_shops_inventory_valid', sql`json_valid(${t.inventoryJson}) AND json_type(${t.inventoryJson}) = 'array'`)]);
export const chests = sqliteTable('chests', {
  objectId: text('object_id').primaryKey().references(() => placedObjects.id),
  gold: integer('gold').notNull().default(0), itemsJson: text('items_json').notNull().default('[]'),
}, t => [check('chests_gold_valid', sql`typeof(${t.gold}) = 'integer' AND ${t.gold} >= 0 AND ${t.gold} <= 9007199254740991`),
  check('chests_items_valid', sql`json_valid(${t.itemsJson}) AND json_type(${t.itemsJson}) = 'array'`)]);

export const crashRecoveryCheckpoints = sqliteTable('crash_recovery_checkpoints', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  roomId: text('room_id').notNull().unique().references(() => rooms.id),
  sessionId: text('session_id').notNull(),
  serializedRoomState: text('serialized_room_state').notNull(),
  combatSnapshotJson: text('combat_snapshot_json'),
  lastEventType: text('last_event_type').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t => [
  foreignKey({ columns: [t.roomId, t.sessionId], foreignColumns: [sessions.roomId, sessions.id] }),
  check('recovery_room_json_valid', sql`json_valid(${t.serializedRoomState}) AND json_type(${t.serializedRoomState}) = 'object'`),
  check('recovery_combat_json_valid', sql`${t.combatSnapshotJson} IS NULL OR (json_valid(${t.combatSnapshotJson}) AND json_type(${t.combatSnapshotJson}) = 'object')`),
]);
