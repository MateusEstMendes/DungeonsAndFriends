CREATE TABLE maps (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE chambers (
  id TEXT PRIMARY KEY NOT NULL, map_id TEXT NOT NULL REFERENCES maps(id), name TEXT NOT NULL,
  biome TEXT NOT NULL DEFAULT 'DUNGEON', min_q INTEGER NOT NULL, max_q INTEGER NOT NULL,
  min_r INTEGER NOT NULL, max_r INTEGER NOT NULL, spawn_q INTEGER NOT NULL DEFAULT 0,
  spawn_r INTEGER NOT NULL DEFAULT 0, offset_x INTEGER NOT NULL DEFAULT 0,
  offset_y INTEGER NOT NULL DEFAULT 0, portals_json TEXT NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
CREATE TABLE terrain_cells (
  id TEXT PRIMARY KEY NOT NULL, chamber_id TEXT NOT NULL REFERENCES chambers(id),
  q INTEGER NOT NULL, r INTEGER NOT NULL, terrain TEXT NOT NULL,
  CONSTRAINT terrain_cells_terrain_valid CHECK(terrain IN ('STONE','GRASS','DIRT','SAND','WATER','DEEP_WATER','OBSTACLE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX terrain_cells_chamber_q_r_unique ON terrain_cells(chamber_id, q, r);
--> statement-breakpoint
CREATE TABLE walls (id TEXT PRIMARY KEY NOT NULL, chamber_id TEXT NOT NULL REFERENCES chambers(id), edge_key TEXT NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX walls_chamber_edge_unique ON walls(chamber_id, edge_key);
--> statement-breakpoint
CREATE TABLE placed_objects (
  id TEXT PRIMARY KEY NOT NULL, chamber_id TEXT NOT NULL REFERENCES chambers(id), kind TEXT NOT NULL,
  name TEXT NOT NULL, q INTEGER NOT NULL, r INTEGER NOT NULL, rotation INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0 CONSTRAINT placed_objects_hidden_valid CHECK(hidden IN (0,1))
);
--> statement-breakpoint
CREATE TABLE editor_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL REFERENCES rooms(id),
  before_json TEXT NOT NULL, after_json TEXT NOT NULL, undone INTEGER NOT NULL DEFAULT 0 CONSTRAINT editor_history_undone_valid CHECK(undone IN (0,1))
);
--> statement-breakpoint
ALTER TABLE characters ADD COLUMN current_chamber_id TEXT NOT NULL DEFAULT 'training-1';
--> statement-breakpoint
ALTER TABLE characters ADD COLUMN pos_q INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE characters ADD COLUMN pos_r INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE characters ADD COLUMN move_cooldown_ends_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE characters ADD COLUMN remaining_steps INTEGER NOT NULL DEFAULT -1;
--> statement-breakpoint
ALTER TABLE rooms ADD COLUMN active_stage_id TEXT NOT NULL DEFAULT 'training';
--> statement-breakpoint
ALTER TABLE rooms ADD COLUMN exploration_mode TEXT NOT NULL DEFAULT 'DUNGEON_TENSE_30S';
