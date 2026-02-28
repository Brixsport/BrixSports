CREATE TABLE `player_team_affiliations` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`team_id` text NOT NULL,
	`affiliation_type` text NOT NULL,
	`is_active` integer DEFAULT true,
	`joined_date` integer,
	`left_date` integer,
	`created_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP INDEX `password_reset_tokens_token_idx`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_players` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`jersey_name` text,
	`number` integer,
	`team_id` text,
	`position` text NOT NULL,
	`rating` real DEFAULT 7,
	`eye_points` integer DEFAULT 0,
	`age` integer,
	`height` text,
	`weight` text,
	`nationality` text,
	`college` text,
	`department` text,
	`university` text DEFAULT 'Bells University' NOT NULL,
	`image` text,
	`market_value` text,
	`profile_id` text,
	`email` text,
	`attributes` text,
	`created_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_players`("id", "name", "jersey_name", "number", "team_id", "position", "rating", "eye_points", "age", "height", "weight", "nationality", "college", "department", "university", "image", "market_value", "profile_id", "email", "attributes", "created_at") SELECT "id", "name", "jersey_name", "number", "team_id", "position", "rating", "eye_points", "age", "height", "weight", "nationality", "college", "department", "university", "image", "market_value", "profile_id", "email", "attributes", "created_at" FROM `players`;--> statement-breakpoint
DROP TABLE `players`;--> statement-breakpoint
ALTER TABLE `__new_players` RENAME TO `players`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `registered_players` ADD `university` text;