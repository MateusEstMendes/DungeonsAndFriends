CREATE UNIQUE INDEX `sessions_room_id_id_unique` ON `sessions` (`room_id`,`id`);
--> statement-breakpoint
CREATE TABLE `crash_recovery_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`session_id` text NOT NULL,
	`serialized_room_state` text NOT NULL,
	`combat_snapshot_json` text,
	`last_event_type` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`,`session_id`) REFERENCES `sessions`(`room_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "recovery_room_json_valid" CHECK(json_valid("crash_recovery_checkpoints"."serialized_room_state") AND json_type("crash_recovery_checkpoints"."serialized_room_state") = 'object'),
	CONSTRAINT "recovery_combat_json_valid" CHECK("crash_recovery_checkpoints"."combat_snapshot_json" IS NULL OR (json_valid("crash_recovery_checkpoints"."combat_snapshot_json") AND json_type("crash_recovery_checkpoints"."combat_snapshot_json") = 'object'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crash_recovery_checkpoints_room_id_unique` ON `crash_recovery_checkpoints` (`room_id`);--> statement-breakpoint
ALTER TABLE `editor_history` ADD COLUMN `discarded` integer NOT NULL DEFAULT 0 CONSTRAINT `editor_history_discarded_valid` CHECK (`discarded` IN (0,1));
--> statement-breakpoint
CREATE INDEX `idx_inventories_char_slot` ON `inventories` (`character_id`,`slot`);--> statement-breakpoint
CREATE INDEX `idx_players_room_token` ON `players` (`room_id`,`session_token`);--> statement-breakpoint
CREATE INDEX `idx_cells_chamber_qr` ON `terrain_cells` (`chamber_id`,`q`,`r`);
