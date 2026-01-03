CREATE TABLE `basketball_player_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`season` text DEFAULT '2024' NOT NULL,
	`games_played` integer DEFAULT 0,
	`games_started` integer DEFAULT 0,
	`minutes_played` integer DEFAULT 0,
	`total_points` integer DEFAULT 0,
	`field_goals_made` integer DEFAULT 0,
	`field_goals_attempted` integer DEFAULT 0,
	`three_pointers_made` integer DEFAULT 0,
	`three_pointers_attempted` integer DEFAULT 0,
	`free_throws_made` integer DEFAULT 0,
	`free_throws_attempted` integer DEFAULT 0,
	`offensive_rebounds` integer DEFAULT 0,
	`defensive_rebounds` integer DEFAULT 0,
	`total_rebounds` integer DEFAULT 0,
	`assists` integer DEFAULT 0,
	`turnovers` integer DEFAULT 0,
	`steals` integer DEFAULT 0,
	`blocks` integer DEFAULT 0,
	`personal_fouls` integer DEFAULT 0,
	`technical_fouls` integer DEFAULT 0,
	`points_per_game` real DEFAULT 0,
	`rebounds_per_game` real DEFAULT 0,
	`assists_per_game` real DEFAULT 0,
	`field_goal_percentage` real DEFAULT 0,
	`three_point_percentage` real DEFAULT 0,
	`free_throw_percentage` real DEFAULT 0,
	`updated_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bracket_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`competition` text NOT NULL,
	`sport` text NOT NULL,
	`title` text NOT NULL,
	`match_id` text,
	`next_match_id` text,
	`home_team_id` text,
	`away_team_id` text,
	`home_score` integer,
	`away_score` integer,
	`status` text DEFAULT 'PENDING',
	`round` text,
	`position` integer,
	`created_at` integer,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `competitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sport` text NOT NULL,
	`format` text NOT NULL,
	`season` text NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`description` text,
	`level` text,
	`scope` text DEFAULT 'internal',
	`rules` text,
	`number_of_teams` integer DEFAULT 0,
	`number_of_groups` integer DEFAULT 0,
	`teams_per_group` integer DEFAULT 0,
	`followers_count` integer DEFAULT 0,
	`status` text DEFAULT 'upcoming',
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `football_player_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`season` text DEFAULT '2024' NOT NULL,
	`appearances` integer DEFAULT 0,
	`starts` integer DEFAULT 0,
	`minutes_played` integer DEFAULT 0,
	`goals` integer DEFAULT 0,
	`assists` integer DEFAULT 0,
	`shots_on_target` integer DEFAULT 0,
	`shots_off_target` integer DEFAULT 0,
	`passes_completed` integer DEFAULT 0,
	`passes_attempted` integer DEFAULT 0,
	`key_passes` integer DEFAULT 0,
	`tackles` integer DEFAULT 0,
	`interceptions` integer DEFAULT 0,
	`clearances` integer DEFAULT 0,
	`yellow_cards` integer DEFAULT 0,
	`red_cards` integer DEFAULT 0,
	`fouls_committed` integer DEFAULT 0,
	`fouls_drawn` integer DEFAULT 0,
	`saves` integer DEFAULT 0,
	`clean_sheets` integer DEFAULT 0,
	`goals_conceded` integer DEFAULT 0,
	`goals_per_game` real DEFAULT 0,
	`assists_per_game` real DEFAULT 0,
	`pass_accuracy` real DEFAULT 0,
	`updated_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fpl_achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`achievement_type` text NOT NULL,
	`gameweek_id` text,
	`title` text NOT NULL,
	`description` text,
	`icon` text,
	`earned_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `fpl_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`gameweek_id`) REFERENCES `fpl_gameweeks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fpl_dream_team` (
	`id` text PRIMARY KEY NOT NULL,
	`gameweek_id` text NOT NULL,
	`player_id` text NOT NULL,
	`position` integer NOT NULL,
	`points` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`gameweek_id`) REFERENCES `fpl_gameweeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fpl_gameweeks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`number` integer NOT NULL,
	`season` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`deadline_date` integer NOT NULL,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`is_active` integer DEFAULT false,
	`average_score` real DEFAULT 0,
	`highest_score` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `fpl_h2h_fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`gameweek_id` text NOT NULL,
	`team1_id` text NOT NULL,
	`team2_id` text NOT NULL,
	`team1_points` integer DEFAULT 0,
	`team2_points` integer DEFAULT 0,
	`winner_id` text,
	`is_draw` integer DEFAULT false,
	`status` text DEFAULT 'pending',
	`created_at` integer,
	FOREIGN KEY (`league_id`) REFERENCES `fpl_leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`gameweek_id`) REFERENCES `fpl_gameweeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team1_id`) REFERENCES `fpl_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team2_id`) REFERENCES `fpl_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `fpl_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fpl_league_members` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rank` integer,
	`last_rank` integer,
	`total_points` integer DEFAULT 0,
	`joined_at` integer,
	FOREIGN KEY (`league_id`) REFERENCES `fpl_leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `fpl_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fpl_leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`season` text NOT NULL,
	`league_type` text DEFAULT 'classic' NOT NULL,
	`is_private` integer DEFAULT true,
	`admin_user_id` text NOT NULL,
	`description` text,
	`max_members` integer DEFAULT 50,
	`current_members` integer DEFAULT 0,
	`prize_info` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fpl_leagues_code_unique` ON `fpl_leagues` (`code`);--> statement-breakpoint
CREATE TABLE `fpl_player_data` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`season` text NOT NULL,
	`position` text NOT NULL,
	`price` real DEFAULT 5 NOT NULL,
	`total_points` integer DEFAULT 0,
	`form` real DEFAULT 0,
	`selected_by` integer DEFAULT 0,
	`transfers_in` integer DEFAULT 0,
	`transfers_out` integer DEFAULT 0,
	`is_available` integer DEFAULT true,
	`injury_status` text,
	`news_update` text,
	`goals_scored` integer DEFAULT 0,
	`assists` integer DEFAULT 0,
	`clean_sheets` integer DEFAULT 0,
	`goals_conceded` integer DEFAULT 0,
	`own_goals` integer DEFAULT 0,
	`penalties_saved` integer DEFAULT 0,
	`penalties_missed` integer DEFAULT 0,
	`yellow_cards` integer DEFAULT 0,
	`red_cards` integer DEFAULT 0,
	`saves` integer DEFAULT 0,
	`bonus` integer DEFAULT 0,
	`bps` integer DEFAULT 0,
	`influence` real DEFAULT 0,
	`creativity` real DEFAULT 0,
	`threat` real DEFAULT 0,
	`ict_index` real DEFAULT 0,
	`minutes_played` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fpl_player_gameweek_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`gameweek_id` text NOT NULL,
	`match_id` text,
	`minutes_played` integer DEFAULT 0,
	`goals_scored` integer DEFAULT 0,
	`assists` integer DEFAULT 0,
	`clean_sheet` integer DEFAULT false,
	`goals_conceded` integer DEFAULT 0,
	`own_goals` integer DEFAULT 0,
	`penalties_saved` integer DEFAULT 0,
	`penalties_missed` integer DEFAULT 0,
	`yellow_cards` integer DEFAULT 0,
	`red_cards` integer DEFAULT 0,
	`saves` integer DEFAULT 0,
	`bonus` integer DEFAULT 0,
	`bps` integer DEFAULT 0,
	`influence` real DEFAULT 0,
	`creativity` real DEFAULT 0,
	`threat` real DEFAULT 0,
	`ict_index` real DEFAULT 0,
	`total_points` integer DEFAULT 0,
	`was_home` integer DEFAULT false,
	`created_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gameweek_id`) REFERENCES `fpl_gameweeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fpl_team_selections` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`player_id` text NOT NULL,
	`gameweek_id` text NOT NULL,
	`position` integer NOT NULL,
	`is_captain` integer DEFAULT false,
	`is_vice_captain` integer DEFAULT false,
	`multiplier` integer DEFAULT 1,
	`purchase_price` real NOT NULL,
	`selling_price` real,
	`points_scored` integer DEFAULT 0,
	`created_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `fpl_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gameweek_id`) REFERENCES `fpl_gameweeks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fpl_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`season` text NOT NULL,
	`budget` real DEFAULT 100,
	`bank_balance` real DEFAULT 0,
	`team_value` real DEFAULT 100,
	`bench_boost_used` integer DEFAULT false,
	`bench_boost_gameweek` integer,
	`triple_captain_used` integer DEFAULT false,
	`triple_captain_gameweek` integer,
	`free_hit_used` integer DEFAULT false,
	`free_hit_gameweek` integer,
	`wildcard_used` integer DEFAULT false,
	`wildcard_gameweek` integer,
	`total_points` integer DEFAULT 0,
	`overall_rank` integer,
	`gameweek_rank` integer,
	`free_transfers` integer DEFAULT 1,
	`transfers_made` integer DEFAULT 0,
	`points_deducted` integer DEFAULT 0,
	`formation` text DEFAULT '4-4-2',
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fpl_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`gameweek_id` text NOT NULL,
	`player_in_id` text NOT NULL,
	`player_out_id` text NOT NULL,
	`player_in_price` real NOT NULL,
	`player_out_price` real NOT NULL,
	`is_free_transfer` integer DEFAULT true,
	`points_cost` integer DEFAULT 0,
	`transfer_type` text DEFAULT 'normal',
	`created_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `fpl_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`gameweek_id`) REFERENCES `fpl_gameweeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_in_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_out_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `head_to_head` (
	`id` text PRIMARY KEY NOT NULL,
	`team1_id` text NOT NULL,
	`team2_id` text NOT NULL,
	`competition` text,
	`total_matches` integer DEFAULT 0,
	`team1_wins` integer DEFAULT 0,
	`team2_wins` integer DEFAULT 0,
	`draws` integer DEFAULT 0,
	`team1_goals_for` integer DEFAULT 0,
	`team2_goals_for` integer DEFAULT 0,
	`last_match_id` text,
	`updated_at` integer,
	FOREIGN KEY (`team1_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team2_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `loggers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`password` text,
	`role` text DEFAULT 'logger',
	`status` text DEFAULT 'active',
	`is_available` integer DEFAULT true,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loggers_email_unique` ON `loggers` (`email`);--> statement-breakpoint
CREATE TABLE `match_events` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`type` text NOT NULL,
	`minute` integer NOT NULL,
	`second` integer,
	`team_id` text,
	`player_id` text,
	`related_player_id` text,
	`detail` text,
	`is_eye_point` integer DEFAULT false,
	`value` text,
	`logger_id` text,
	`logger_name` text,
	`created_at` integer,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`logger_id`) REFERENCES `loggers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`match_id` text NOT NULL,
	`predicted_home_score` integer NOT NULL,
	`predicted_away_score` integer NOT NULL,
	`predicted_winner` text,
	`confidence` integer DEFAULT 50,
	`points` integer DEFAULT 0,
	`is_correct` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`sport` text NOT NULL,
	`home_team_id` text NOT NULL,
	`away_team_id` text NOT NULL,
	`home_score` integer DEFAULT 0,
	`away_score` integer DEFAULT 0,
	`status` text DEFAULT 'UPCOMING' NOT NULL,
	`start_time` text NOT NULL,
	`venue` text NOT NULL,
	`competition` text NOT NULL,
	`match_type` text DEFAULT 'competition',
	`competition_level` text,
	`friendly_type` text,
	`friendly_description` text,
	`logger_id` text,
	`stats` text,
	`lineups` text,
	`livestream_url` text,
	`livestream_type` text,
	`livestream_enabled` integer DEFAULT false,
	`livestream_start_time` integer,
	`livestream_end_time` integer,
	`livestream_viewers` integer DEFAULT 0,
	`livestream_chat_enabled` integer DEFAULT true,
	`livestream_chat_url` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `news` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`content` text NOT NULL,
	`excerpt` text,
	`image_url` text,
	`category` text NOT NULL,
	`tags` text,
	`is_breaking` integer DEFAULT false,
	`is_featured` integer DEFAULT false,
	`author_id` text,
	`author_name` text,
	`views` integer DEFAULT 0,
	`likes` integer DEFAULT 0,
	`send_push_notification` integer DEFAULT false,
	`push_notification_sent` integer DEFAULT false,
	`push_notification_sent_at` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_slug_unique` ON `news` (`slug`);--> statement-breakpoint
CREATE TABLE `news_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`news_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`content` text NOT NULL,
	`parent_id` text,
	`likes` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`news_id`) REFERENCES `news`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `news_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`news_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`news_id`) REFERENCES `news`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `news_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`news_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`relation_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`news_id`) REFERENCES `news`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `player_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`competition` text NOT NULL,
	`sport` text NOT NULL,
	`goals` integer DEFAULT 0,
	`assists` integer DEFAULT 0,
	`appearances` integer DEFAULT 0,
	`minutes_played` integer DEFAULT 0,
	`yellow_cards` integer DEFAULT 0,
	`red_cards` integer DEFAULT 0,
	`clean_sheets` integer DEFAULT 0,
	`saves` integer DEFAULT 0,
	`average_rating` real DEFAULT 7,
	`updated_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`number` integer NOT NULL,
	`team_id` text NOT NULL,
	`position` text NOT NULL,
	`rating` real DEFAULT 7,
	`eye_points` integer DEFAULT 0,
	`age` integer,
	`height` text,
	`weight` text,
	`nationality` text,
	`image` text,
	`market_value` text,
	`attributes` text,
	`created_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `poll_comment_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`comment_id`) REFERENCES `poll_comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poll_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`parent_id` text,
	`likes` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`user_id` text,
	`option_id` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `polls` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`question` text NOT NULL,
	`poll_type` text DEFAULT 'match_winner' NOT NULL,
	`options` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`total_votes` integer DEFAULT 0,
	`ends_at` integer,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prediction_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`prediction_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`prediction_id`) REFERENCES `match_predictions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prediction_leaderboard` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`total_predictions` integer DEFAULT 0,
	`correct_predictions` integer DEFAULT 0,
	`total_points` integer DEFAULT 0,
	`accuracy` integer DEFAULT 0,
	`rank` integer,
	`streak` integer DEFAULT 0,
	`longest_streak` integer DEFAULT 0,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `standings` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`sport` text NOT NULL,
	`competition` text NOT NULL,
	`played` integer DEFAULT 0,
	`won` integer DEFAULT 0,
	`drawn` integer DEFAULT 0,
	`lost` integer DEFAULT 0,
	`goals_for` integer DEFAULT 0,
	`goals_against` integer DEFAULT 0,
	`goal_difference` integer DEFAULT 0,
	`points` integer DEFAULT 0,
	`updated_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`updated_by` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_settings_key_unique` ON `system_settings` (`key`);--> statement-breakpoint
CREATE TABLE `system_settings_history` (
	`id` text PRIMARY KEY NOT NULL,
	`setting_key` text NOT NULL,
	`old_value` text,
	`new_value` text NOT NULL,
	`updated_by` text,
	`reason` text,
	`created_at` integer,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_form` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`match_id` text NOT NULL,
	`competition` text NOT NULL,
	`result` text NOT NULL,
	`goals_for` integer NOT NULL,
	`goals_against` integer NOT NULL,
	`match_date` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`logo` text NOT NULL,
	`university` text NOT NULL,
	`color` text NOT NULL,
	`sport` text DEFAULT 'Football' NOT NULL,
	`played` integer DEFAULT 0,
	`won` integer DEFAULT 0,
	`drawn` integer DEFAULT 0,
	`lost` integer DEFAULT 0,
	`goals_for` integer DEFAULT 0,
	`goals_against` integer DEFAULT 0,
	`points` integer DEFAULT 0,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`from_team_id` text,
	`to_team_id` text,
	`transfer_type` text NOT NULL,
	`fee` text,
	`status` text DEFAULT 'rumor' NOT NULL,
	`reliability` integer DEFAULT 5,
	`source` text,
	`description` text,
	`image_url` text,
	`send_push_notification` integer DEFAULT false,
	`push_notification_sent` integer DEFAULT false,
	`push_notification_sent_at` integer,
	`created_by` text,
	`announced_at` integer,
	`completed_at` integer,
	`season` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`activity_type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`metadata` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`news_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`news_id`) REFERENCES `news`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`favorite_type` text NOT NULL,
	`favorite_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_follows` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`follow_type` text NOT NULL,
	`follow_id` text NOT NULL,
	`notifications_enabled` integer DEFAULT true,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`theme` text DEFAULT 'dark',
	`language` text DEFAULT 'en',
	`notifications` integer DEFAULT true,
	`email_notifications` integer DEFAULT true,
	`favorite_sports` text,
	`default_view` text DEFAULT 'standings',
	`timezone` text DEFAULT 'UTC',
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_xi` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`formation` text NOT NULL,
	`players` text NOT NULL,
	`is_public` integer DEFAULT false,
	`likes` integer DEFAULT 0,
	`views` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_xi_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`xi_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`xi_id`) REFERENCES `user_xi`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_xi_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`xi_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`xi_id`) REFERENCES `user_xi`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`name` text NOT NULL,
	`avatar` text,
	`cover_image` text,
	`bio` text,
	`favorite_team_id` text,
	`role` text DEFAULT 'user',
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`favorite_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);