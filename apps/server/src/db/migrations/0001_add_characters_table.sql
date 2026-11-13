CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`race_id` text NOT NULL,
	`archetype_id` text NOT NULL,
	`base_str` integer NOT NULL,
	`base_dex` integer NOT NULL,
	`base_con` integer NOT NULL,
	`base_int` integer NOT NULL,
	`base_wis` integer NOT NULL,
	`base_cha` integer NOT NULL,
	`final_str` integer NOT NULL,
	`final_dex` integer NOT NULL,
	`final_con` integer NOT NULL,
	`final_int` integer NOT NULL,
	`final_wis` integer NOT NULL,
	`final_cha` integer NOT NULL,
	`hp` integer NOT NULL,
	`max_hp` integer NOT NULL,
	`mp` integer NOT NULL,
	`max_mp` integer NOT NULL,
	`defense` integer NOT NULL,
	`dodge_chance` integer NOT NULL,
	`speed` integer NOT NULL,
	`flat_dr` integer NOT NULL,
	`visual_config_json` text NOT NULL,
	`portrait_webp` text NOT NULL,
	`token_webp` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `characters_player_id_unique` ON `characters` (`player_id`);--> statement-breakpoint
CREATE INDEX `characters_room_id_idx` ON `characters` (`room_id`);--> statement-breakpoint
ALTER TABLE `players` ADD `character_id` text REFERENCES characters(id);