import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { users, players, matches } from './schema';

// FPL Gameweeks table
export const fplGameweeks = sqliteTable('fpl_gameweeks', {
    id: text('id').primaryKey(),
    name: text('name').notNull(), // e.g., "Gameweek 1"
    number: integer('number').notNull(),
    season: text('season').notNull(), // e.g., "2024/2025"
    startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
    endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
    deadlineDate: integer('deadline_date', { mode: 'timestamp' }).notNull(), // Transfer deadline
    status: text('status').notNull().default('upcoming'), // 'upcoming' | 'active' | 'completed'
    isActive: integer('is_active', { mode: 'boolean' }).default(false),
    averageScore: real('average_score').default(0),
    highestScore: integer('highest_score').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// FPL Player Prices and Stats
export const fplPlayerData = sqliteTable('fpl_player_data', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id),
    season: text('season').notNull(),
    position: text('position').notNull(), // 'GK' | 'DEF' | 'MID' | 'FWD'
    price: real('price').notNull().default(5.0), // In millions (e.g., 7.5)
    totalPoints: integer('total_points').default(0),
    form: real('form').default(0), // Average points per game in last 5 games
    selectedBy: integer('selected_by').default(0), // Number of teams that own this player
    transfersIn: integer('transfers_in').default(0),
    transfersOut: integer('transfers_out').default(0),
    // Availability
    isAvailable: integer('is_available', { mode: 'boolean' }).default(true),
    injuryStatus: text('injury_status'), // 'fit' | 'doubtful' | 'injured' | 'suspended'
    newsUpdate: text('news_update'), // Latest news about the player
    // Stats
    goalsScored: integer('goals_scored').default(0),
    assists: integer('assists').default(0),
    cleanSheets: integer('clean_sheets').default(0),
    goalsConceded: integer('goals_conceded').default(0),
    ownGoals: integer('own_goals').default(0),
    penaltiesSaved: integer('penalties_saved').default(0),
    penaltiesMissed: integer('penalties_missed').default(0),
    yellowCards: integer('yellow_cards').default(0),
    redCards: integer('red_cards').default(0),
    saves: integer('saves').default(0),
    bonus: integer('bonus').default(0),
    bps: integer('bps').default(0), // Bonus Points System
    influence: real('influence').default(0),
    creativity: real('creativity').default(0),
    threat: real('threat').default(0),
    ictIndex: real('ict_index').default(0), // Influence, Creativity, Threat combined
    minutesPlayed: integer('minutes_played').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// FPL Player Gameweek Performance
export const fplPlayerGameweekStats = sqliteTable('fpl_player_gameweek_stats', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id),
    gameweekId: text('gameweek_id').notNull().references(() => fplGameweeks.id),
    matchId: text('match_id').references(() => matches.id),
    minutesPlayed: integer('minutes_played').default(0),
    goalsScored: integer('goals_scored').default(0),
    assists: integer('assists').default(0),
    cleanSheet: integer('clean_sheet', { mode: 'boolean' }).default(false),
    goalsConceded: integer('goals_conceded').default(0),
    ownGoals: integer('own_goals').default(0),
    penaltiesSaved: integer('penalties_saved').default(0),
    penaltiesMissed: integer('penalties_missed').default(0),
    yellowCards: integer('yellow_cards').default(0),
    redCards: integer('red_cards').default(0),
    saves: integer('saves').default(0),
    bonus: integer('bonus').default(0),
    bps: integer('bps').default(0),
    influence: real('influence').default(0),
    creativity: real('creativity').default(0),
    threat: real('threat').default(0),
    ictIndex: real('ict_index').default(0),
    totalPoints: integer('total_points').default(0),
    wasHome: integer('was_home', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// FPL User Teams
export const fplTeams = sqliteTable('fpl_teams', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    season: text('season').notNull(),
    // Budget
    budget: real('budget').default(100.0), // Starting budget in millions
    bankBalance: real('bank_balance').default(0), // Remaining money
    teamValue: real('team_value').default(100.0),
    // Chips
    benchBoostUsed: integer('bench_boost_used', { mode: 'boolean' }).default(false),
    benchBoostGameweek: integer('bench_boost_gameweek'),
    tripleCaptainUsed: integer('triple_captain_used', { mode: 'boolean' }).default(false),
    tripleCaptainGameweek: integer('triple_captain_gameweek'),
    freeHitUsed: integer('free_hit_used', { mode: 'boolean' }).default(false),
    freeHitGameweek: integer('free_hit_gameweek'),
    wildcardUsed: integer('wildcard_used', { mode: 'boolean' }).default(false),
    wildcardGameweek: integer('wildcard_gameweek'),
    // Stats
    totalPoints: integer('total_points').default(0),
    overallRank: integer('overall_rank'),
    gameweekRank: integer('gameweek_rank'),
    freeTransfers: integer('free_transfers').default(1),
    transfersMade: integer('transfers_made').default(0),
    pointsDeducted: integer('points_deducted').default(0),
    // Formation (e.g., "4-4-2")
    formation: text('formation').default('4-4-2'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// FPL Team Selections (Squad of 15 players)
export const fplTeamSelections = sqliteTable('fpl_team_selections', {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => fplTeams.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull().references(() => players.id),
    gameweekId: text('gameweek_id').notNull().references(() => fplGameweeks.id),
    position: integer('position').notNull(), // 1-15 (1-11 starting, 12-15 bench)
    isCaptain: integer('is_captain', { mode: 'boolean' }).default(false),
    isViceCaptain: integer('is_vice_captain', { mode: 'boolean' }).default(false),
    multiplier: integer('multiplier').default(1), // 1, 2 (captain), or 3 (triple captain)
    purchasePrice: real('purchase_price').notNull(), // Price when bought
    sellingPrice: real('selling_price'), // Price when sold (if applicable)
    pointsScored: integer('points_scored').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// FPL Transfers
export const fplTransfers = sqliteTable('fpl_transfers', {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => fplTeams.id, { onDelete: 'cascade' }),
    gameweekId: text('gameweek_id').notNull().references(() => fplGameweeks.id),
    playerInId: text('player_in_id').notNull().references(() => players.id),
    playerOutId: text('player_out_id').notNull().references(() => players.id),
    playerInPrice: real('player_in_price').notNull(),
    playerOutPrice: real('player_out_price').notNull(),
    isFreeTransfer: integer('is_free_transfer', { mode: 'boolean' }).default(true),
    pointsCost: integer('points_cost').default(0), // -4 for extra transfers
    transferType: text('transfer_type').default('normal'), // 'normal' | 'wildcard' | 'free_hit'
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// FPL Leagues
export const fplLeagues = sqliteTable('fpl_leagues', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    code: text('code').notNull().unique(), // Join code
    season: text('season').notNull(),
    leagueType: text('league_type').notNull().default('classic'), // 'classic' | 'head_to_head'
    isPrivate: integer('is_private', { mode: 'boolean' }).default(true),
    adminUserId: text('admin_user_id').notNull().references(() => users.id),
    description: text('description'),
    maxMembers: integer('max_members').default(50),
    currentMembers: integer('current_members').default(0),
    prizeInfo: text('prize_info'), // JSON: prize details
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// FPL League Members
export const fplLeagueMembers = sqliteTable('fpl_league_members', {
    id: text('id').primaryKey(),
    leagueId: text('league_id').notNull().references(() => fplLeagues.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => fplTeams.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    rank: integer('rank'),
    lastRank: integer('last_rank'),
    totalPoints: integer('total_points').default(0),
    joinedAt: integer('joined_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// FPL Head-to-Head Fixtures (for H2H leagues)
export const fplH2HFixtures = sqliteTable('fpl_h2h_fixtures', {
    id: text('id').primaryKey(),
    leagueId: text('league_id').notNull().references(() => fplLeagues.id, { onDelete: 'cascade' }),
    gameweekId: text('gameweek_id').notNull().references(() => fplGameweeks.id),
    team1Id: text('team1_id').notNull().references(() => fplTeams.id),
    team2Id: text('team2_id').notNull().references(() => fplTeams.id),
    team1Points: integer('team1_points').default(0),
    team2Points: integer('team2_points').default(0),
    winnerId: text('winner_id').references(() => fplTeams.id),
    isDraw: integer('is_draw', { mode: 'boolean' }).default(false),
    status: text('status').default('pending'), // 'pending' | 'completed'
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// FPL Dream Team (Best XI each gameweek)
export const fplDreamTeam = sqliteTable('fpl_dream_team', {
    id: text('id').primaryKey(),
    gameweekId: text('gameweek_id').notNull().references(() => fplGameweeks.id),
    playerId: text('player_id').notNull().references(() => players.id),
    position: integer('position').notNull(), // 1-11
    points: integer('points').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// FPL Achievements/Badges
export const fplAchievements = sqliteTable('fpl_achievements', {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => fplTeams.id, { onDelete: 'cascade' }),
    achievementType: text('achievement_type').notNull(), // 'top_100' | 'perfect_captain' | 'differential_king' | etc
    gameweekId: text('gameweek_id').references(() => fplGameweeks.id),
    title: text('title').notNull(),
    description: text('description'),
    icon: text('icon'),
    earnedAt: integer('earned_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Relations
export const fplGameweeksRelations = relations(fplGameweeks, ({ many }) => ({
    playerStats: many(fplPlayerGameweekStats),
    teamSelections: many(fplTeamSelections),
    transfers: many(fplTransfers),
    h2hFixtures: many(fplH2HFixtures),
    dreamTeam: many(fplDreamTeam),
}));

export const fplPlayerDataRelations = relations(fplPlayerData, ({ one }) => ({
    player: one(players, {
        fields: [fplPlayerData.playerId],
        references: [players.id],
    }),
}));

export const fplTeamsRelations = relations(fplTeams, ({ one, many }) => ({
    user: one(users, {
        fields: [fplTeams.userId],
        references: [users.id],
    }),
    selections: many(fplTeamSelections),
    transfers: many(fplTransfers),
    leagueMembers: many(fplLeagueMembers),
    achievements: many(fplAchievements),
}));

export const fplLeaguesRelations = relations(fplLeagues, ({ one, many }) => ({
    admin: one(users, {
        fields: [fplLeagues.adminUserId],
        references: [users.id],
    }),
    members: many(fplLeagueMembers),
    h2hFixtures: many(fplH2HFixtures),
}));

// Types
export type FplGameweek = typeof fplGameweeks.$inferSelect;
export type NewFplGameweek = typeof fplGameweeks.$inferInsert;
export type FplPlayerData = typeof fplPlayerData.$inferSelect;
export type NewFplPlayerData = typeof fplPlayerData.$inferInsert;
export type FplPlayerGameweekStats = typeof fplPlayerGameweekStats.$inferSelect;
export type NewFplPlayerGameweekStats = typeof fplPlayerGameweekStats.$inferInsert;
export type FplTeam = typeof fplTeams.$inferSelect;
export type NewFplTeam = typeof fplTeams.$inferInsert;
export type FplTeamSelection = typeof fplTeamSelections.$inferSelect;
export type NewFplTeamSelection = typeof fplTeamSelections.$inferInsert;
export type FplTransfer = typeof fplTransfers.$inferSelect;
export type NewFplTransfer = typeof fplTransfers.$inferInsert;
export type FplLeague = typeof fplLeagues.$inferSelect;
export type NewFplLeague = typeof fplLeagues.$inferInsert;
export type FplLeagueMember = typeof fplLeagueMembers.$inferSelect;
export type NewFplLeagueMember = typeof fplLeagueMembers.$inferInsert;
export type FplH2HFixture = typeof fplH2HFixtures.$inferSelect;
export type NewFplH2HFixture = typeof fplH2HFixtures.$inferInsert;
export type FplDreamTeam = typeof fplDreamTeam.$inferSelect;
export type NewFplDreamTeam = typeof fplDreamTeam.$inferInsert;
export type FplAchievement = typeof fplAchievements.$inferSelect;
export type NewFplAchievement = typeof fplAchievements.$inferInsert;
