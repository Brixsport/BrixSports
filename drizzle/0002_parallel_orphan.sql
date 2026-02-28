CREATE TABLE `password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_token_unique` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `staff_comms` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'note',
	`priority` text DEFAULT 'normal',
	`is_read` integer DEFAULT false,
	`created_at` integer,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP INDEX "fpl_leagues_code_unique";--> statement-breakpoint
DROP INDEX "loggers_email_unique";--> statement-breakpoint
DROP INDEX "news_slug_unique";--> statement-breakpoint
DROP INDEX "password_reset_tokens_token_unique";--> statement-breakpoint
DROP INDEX "push_subscriptions_endpoint_unique";--> statement-breakpoint
DROP INDEX "system_settings_key_unique";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
ALTER TABLE `competitions` ALTER COLUMN "sport" TO "sport" text;--> statement-breakpoint
CREATE UNIQUE INDEX `fpl_leagues_code_unique` ON `fpl_leagues` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `loggers_email_unique` ON `loggers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `news_slug_unique` ON `news` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE UNIQUE INDEX `system_settings_key_unique` ON `system_settings` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `competitions` ADD `is_multi_sport` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `basketball_player_stats` ADD `competition` text;--> statement-breakpoint
ALTER TABLE `basketball_player_stats` ADD `competition_id` text REFERENCES competitions(id);--> statement-breakpoint
ALTER TABLE `bracket_nodes` ADD `competition_id` text REFERENCES competitions(id);--> statement-breakpoint
ALTER TABLE `football_player_stats` ADD `competition` text;--> statement-breakpoint
ALTER TABLE `football_player_stats` ADD `competition_id` text REFERENCES competitions(id);--> statement-breakpoint
ALTER TABLE `head_to_head` ADD `competition_id` text REFERENCES competitions(id);--> statement-breakpoint
ALTER TABLE `match_events` ADD `period` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `competition_id` text REFERENCES competitions(id);--> statement-breakpoint
ALTER TABLE `matches` ADD `round` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `matchday` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `group_name` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `approval_status` text DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE `matches` ADD `manager_notes` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `approved_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `matches` ADD `approved_at` integer;--> statement-breakpoint
ALTER TABLE `player_stats` ADD `competition_id` text REFERENCES competitions(id);--> statement-breakpoint
ALTER TABLE `standings` ADD `competition_id` text REFERENCES competitions(id);--> statement-breakpoint
ALTER TABLE `standings` ADD `group_name` text;--> statement-breakpoint
ALTER TABLE `team_form` ADD `competition_id` text REFERENCES competitions(id);--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `match_alerts` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `player_ratings` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `scout_updates` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `milestones` integer DEFAULT true;