CREATE TABLE `_dungeons_migrations` (
	`version` text PRIMARY KEY NOT NULL,
	`applied_at` integer NOT NULL,
	`checksum` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`session_token` text NOT NULL,
	`reconnection_token` text,
	`approval_status` text DEFAULT 'PENDING_APPROVAL' NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "players_approval_status_valid" CHECK("players"."approval_status" IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NEEDS_CHARACTER_CREATION'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_session_token_unique` ON `players` (`session_token`);--> statement-breakpoint
CREATE INDEX `players_room_id_idx` ON `players` (`room_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`master_password_hash` text NOT NULL,
	`status` text DEFAULT 'LOBBY' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "rooms_code_valid" CHECK(length("rooms"."code") = 5 AND "rooms"."code" NOT GLOB '*[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]*'),
	CONSTRAINT "rooms_status_valid" CHECK("rooms"."status" IN ('LOBBY', 'ACTIVE', 'PAUSED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_code_unique` ON `rooms` (`code`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sessions_status_valid" CHECK("sessions"."status" IN ('ACTIVE', 'CLOSED'))
);
--> statement-breakpoint
CREATE INDEX `sessions_room_id_idx` ON `sessions` (`room_id`);