import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Teams table
export const teams = sqliteTable('teams', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    logo: text('logo').notNull(),
    university: text('university').notNull(),
    color: text('color').notNull(),
    // Stats
    played: integer('played').default(0),
    won: integer('won').default(0),
    drawn: integer('drawn').default(0),
    lost: integer('lost').default(0),
    goalsFor: integer('goals_for').default(0),
    goalsAgainst: integer('goals_against').default(0),
    points: integer('points').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Players table
export const players = sqliteTable('players', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    number: integer('number').notNull(),
    teamId: text('team_id').notNull().references(() => teams.id),
    position: text('position').notNull(),
    rating: real('rating').default(7.0),
    eyePoints: integer('eye_points').default(0),
    age: integer('age'),
    height: text('height'),
    weight: text('weight'),
    nationality: text('nationality'),
    image: text('image'),
    marketValue: text('market_value'),
    // Attributes (stored as JSON string)
    attributes: text('attributes'), // JSON: {speed, shooting, passing, dribbling, defense, physical}
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Competitions table (NEW/ENHANCED)
export const competitions = sqliteTable('competitions', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    sport: text('sport').notNull(), // 'Football' | 'Basketball' | 'Track'
    type: text('type').notNull(), // 'LEAGUE' | 'TOURNAMENT' | 'CUP'
    season: text('season').notNull(), // e.g., '2024/2025'
    description: text('description'),
    logo: text('logo'),
    banner: text('banner'),
    status: text('status').notNull().default('UPCOMING'), // 'UPCOMING' | 'ONGOING' | 'COMPLETED'
    startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
    endDate: integer('end_date', { mode: 'timestamp' }),
    venue: text('venue'),
    organizer: text('organizer'),
    rules: text('rules'), // JSON string
    prizes: text('prizes'), // JSON string
    // Engagement metrics
    followersCount: integer('followers_count').default(0),
    viewsCount: integer('views_count').default(0),
    // Settings
    isPublic: integer('is_public', { mode: 'boolean' }).default(true),
    allowRegistration: integer('allow_registration', { mode: 'boolean' }).default(false),
    maxTeams: integer('max_teams'),
    currentTeamsCount: integer('current_teams_count').default(0),
    createdBy: text('created_by').notNull(), // Admin user ID
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Competition Teams (Many-to-Many relationship)
export const competitionTeams = sqliteTable('competition_teams', {
    id: text('id').primaryKey(),
    competitionId: text('competition_id').notNull().references(() => competitions.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    groupName: text('group_name'), // For group stages
    seed: integer('seed'), // Seeding for tournaments
    registeredAt: integer('registered_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Matches table
export const matches = sqliteTable('matches', {
    id: text('id').primaryKey(),
    sport: text('sport').notNull(), // 'Football' | 'Basketball' | 'Track' | etc
    competitionId: text('competition_id').references(() => competitions.id), // NEW
    homeTeamId: text('home_team_id').notNull().references(() => teams.id),
    awayTeamId: text('away_team_id').notNull().references(() => teams.id),
    homeScore: integer('home_score').default(0),
    awayScore: integer('away_score').default(0),
    status: text('status').notNull().default('UPCOMING'), // 'LIVE' | 'FINISHED' | 'UPCOMING' | 'HALF_TIME'
    startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
    venue: text('venue').notNull(),
    competition: text('competition').notNull(),
    round: text('round'), // 'GROUP_A' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'FINAL'
    matchday: integer('matchday'), // For league competitions
    loggerId: text('logger_id'),
    // Stats (stored as JSON string)
    stats: text('stats'), // JSON: {possession, shots, shotsOnTarget, corners, fouls, yellowCards, redCards, saves}
    // Lineups (stored as JSON string)
    lineups: text('lineups'), // JSON: {home: [], away: []}
    // Engagement
    viewersCount: integer('viewers_count').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Match Events table
export const matchEvents = sqliteTable('match_events', {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // Event type varies by sport
    minute: integer('minute').notNull(),
    second: integer('second'),
    teamId: text('team_id').references(() => teams.id),
    playerId: text('player_id').references(() => players.id),
    relatedPlayerId: text('related_player_id').references(() => players.id),
    detail: text('detail'),
    isEyePoint: integer('is_eye_point', { mode: 'boolean' }).default(false),
    value: text('value'), // JSON for additional data
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Loggers table
export const loggers = sqliteTable('loggers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').unique(),
    password: text('password'), // Hashed
    role: text('role').default('logger'), // 'logger' | 'admin'
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Standings table (computed from matches, but can be cached)
export const standings = sqliteTable('standings', {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id),
    competitionId: text('competition_id').notNull().references(() => competitions.id), // NEW
    sport: text('sport').notNull(),
    competition: text('competition').notNull(),
    played: integer('played').default(0),
    won: integer('won').default(0),
    drawn: integer('drawn').default(0),
    lost: integer('lost').default(0),
    goalsFor: integer('goals_for').default(0),
    goalsAgainst: integer('goals_against').default(0),
    goalDifference: integer('goal_difference').default(0),
    points: integer('points').default(0),
    form: text('form'), // Last 5 matches: 'WWDLL'
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Bracket/Tournament nodes
export const bracketNodes = sqliteTable('bracket_nodes', {
    id: text('id').primaryKey(),
    competitionId: text('competition_id').notNull().references(() => competitions.id), // NEW
    competition: text('competition').notNull(),
    sport: text('sport').notNull(),
    title: text('title').notNull(),
    matchId: text('match_id').references(() => matches.id),
    nextMatchId: text('next_match_id'),
    homeTeamId: text('home_team_id').references(() => teams.id),
    awayTeamId: text('away_team_id').references(() => teams.id),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    status: text('status').default('PENDING'), // 'PENDING' | 'LIVE' | 'FINISHED'
    round: text('round'), // 'FINAL' | 'SEMI_FINAL' | 'QUARTER_FINAL' | etc
    position: integer('position'), // For ordering
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Users table (for fans/viewers)
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').unique().notNull(),
    password: text('password'), // Hashed
    name: text('name').notNull(),
    avatar: text('avatar'),
    bio: text('bio'),
    university: text('university'),
    favoriteTeamId: text('favorite_team_id').references(() => teams.id),
    role: text('role').default('user'), // 'user' | 'admin' | 'logger'
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User Preferences table
export const userPreferences = sqliteTable('user_preferences', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    theme: text('theme').default('dark'), // 'dark' | 'light'
    language: text('language').default('en'),
    notifications: integer('notifications', { mode: 'boolean' }).default(true),
    emailNotifications: integer('email_notifications', { mode: 'boolean' }).default(true),
    favoriteSports: text('favorite_sports'), // JSON array: ['Football', 'Basketball']
    defaultView: text('default_view').default('standings'), // 'standings' | 'brackets' | 'matches'
    timezone: text('timezone').default('UTC'),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User Favorites table (teams, players, matches, competitions)
export const userFavorites = sqliteTable('user_favorites', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    favoriteType: text('favorite_type').notNull(), // 'team' | 'player' | 'match' | 'competition'
    favoriteId: text('favorite_id').notNull(), // ID of the favorited item
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User Follows table (NEW - for following teams/players/competitions)
export const userFollows = sqliteTable('user_follows', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    followType: text('follow_type').notNull(), // 'team' | 'player' | 'competition'
    followId: text('follow_id').notNull(), // ID of the followed item
    notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Notifications table (NEW)
export const notifications = sqliteTable('notifications', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'MATCH_START' | 'GOAL' | 'MATCH_END' | 'COMPETITION_UPDATE'
    title: text('title').notNull(),
    message: text('message').notNull(),
    relatedType: text('related_type'), // 'match' | 'competition' | 'team' | 'player'
    relatedId: text('related_id'),
    isRead: integer('is_read', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Player Time Tracking (NEW - for substitutions)
export const playerTimeTracking = sqliteTable('player_time_tracking', {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull().references(() => players.id),
    timeOn: integer('time_on').notNull(), // Minute player entered
    timeOff: integer('time_off'), // Minute player exited (null if still playing)
    totalMinutes: integer('total_minutes').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Eye Point Awards (NEW)
export const eyePointAwards = sqliteTable('eye_point_awards', {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull().references(() => players.id),
    awardedBy: text('awarded_by').notNull(), // Logger/Admin ID
    reason: text('reason'),
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
    players: many(players),
    homeMatches: many(matches, { relationName: 'homeTeam' }),
    awayMatches: many(matches, { relationName: 'awayTeam' }),
    standings: many(standings),
    competitionTeams: many(competitionTeams),
}));

export const competitionsRelations = relations(competitions, ({ many }) => ({
    teams: many(competitionTeams),
    matches: many(matches),
    standings: many(standings),
    brackets: many(bracketNodes),
}));

export const competitionTeamsRelations = relations(competitionTeams, ({ one }) => ({
    competition: one(competitions, {
        fields: [competitionTeams.competitionId],
        references: [competitions.id],
    }),
    team: one(teams, {
        fields: [competitionTeams.teamId],
        references: [teams.id],
    }),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
    team: one(teams, {
        fields: [players.teamId],
        references: [teams.id],
    }),
    events: many(matchEvents),
    timeTracking: many(playerTimeTracking),
    eyePoints: many(eyePointAwards),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
    competition: one(competitions, {
        fields: [matches.competitionId],
        references: [competitions.id],
    }),
    homeTeam: one(teams, {
        fields: [matches.homeTeamId],
        references: [teams.id],
        relationName: 'homeTeam',
    }),
    awayTeam: one(teams, {
        fields: [matches.awayTeamId],
        references: [teams.id],
        relationName: 'awayTeam',
    }),
    events: many(matchEvents),
    playerTracking: many(playerTimeTracking),
}));

export const matchEventsRelations = relations(matchEvents, ({ one }) => ({
    match: one(matches, {
        fields: [matchEvents.matchId],
        references: [matches.id],
    }),
    team: one(teams, {
        fields: [matchEvents.teamId],
        references: [teams.id],
    }),
    player: one(players, {
        fields: [matchEvents.playerId],
        references: [players.id],
    }),
}));

export const standingsRelations = relations(standings, ({ one }) => ({
    team: one(teams, {
        fields: [standings.teamId],
        references: [teams.id],
    }),
    competition: one(competitions, {
        fields: [standings.competitionId],
        references: [competitions.id],
    }),
}));

export const usersRelations = relations(users, ({ many }) => ({
    favorites: many(userFavorites),
    follows: many(userFollows),
    notifications: many(notifications),
    preferences: many(userPreferences),
}));

// Types
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type Competition = typeof competitions.$inferSelect;
export type NewCompetition = typeof competitions.$inferInsert;
export type CompetitionTeam = typeof competitionTeams.$inferSelect;
export type NewCompetitionTeam = typeof competitionTeams.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type NewMatchEvent = typeof matchEvents.$inferInsert;
export type Logger = typeof loggers.$inferSelect;
export type NewLogger = typeof loggers.$inferInsert;
export type Standing = typeof standings.$inferSelect;
export type NewStanding = typeof standings.$inferInsert;
export type BracketNode = typeof bracketNodes.$inferSelect;
export type NewBracketNode = typeof bracketNodes.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
export type UserFavorite = typeof userFavorites.$inferSelect;
export type NewUserFavorite = typeof userFavorites.$inferInsert;
export type UserFollow = typeof userFollows.$inferSelect;
export type NewUserFollow = typeof userFollows.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type PlayerTimeTracking = typeof playerTimeTracking.$inferSelect;
export type NewPlayerTimeTracking = typeof playerTimeTracking.$inferInsert;
export type EyePointAward = typeof eyePointAwards.$inferSelect;
export type NewEyePointAward = typeof eyePointAwards.$inferInsert;
