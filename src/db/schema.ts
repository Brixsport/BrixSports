import { sqliteTable, text, integer, real, uniqueIndex, foreignKey, unique } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Organizations table
// Represents owning or governing entities such as universities, colleges, departments, and clubs.
export const organizations = sqliteTable('organizations', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    type: text('type').notNull().default('organization'),
    shortName: text('short_name'),
    displayName: text('display_name'),
    parentOrganizationId: text('parent_organization_id'),
    isInternalUnit: integer('is_internal_unit', { mode: 'boolean' }).default(false),
    status: text('status').default('active'),
    location: text('location'),
    metadata: text('metadata'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
    slugIdx: uniqueIndex('organizations_slug_unique').on(table.slug),
    parentOrganizationFk: foreignKey({
        columns: [table.parentOrganizationId],
        foreignColumns: [table.id],
        name: 'organizations_parent_organization_id_fk',
    }),
}));

// Teams table
export const teams = sqliteTable('teams', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    logo: text('logo').notNull(),
    university: text('university').notNull(),
    ownerOrganizationId: text('owner_organization_id').references(() => organizations.id),
    color: text('color').notNull(),
    sport: text('sport').notNull().default('Football'), // 'Football' | 'Basketball' | 'Scrabble' | 'Chess' | 'Table Tennis'
    gender: text('gender').default('male'), // 'male' | 'female' | 'mixed'
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
    jerseyName: text('jersey_name'),
    number: integer('number').notNull().default(0),
    teamId: text('team_id').references(() => teams.id), // Now OPTIONAL — use playerTeamAffiliations instead
    position: text('position').notNull(),
    rating: real('rating').default(7.0),
    eyePoints: integer('eye_points').default(0),
    age: integer('age'),
    height: text('height'),
    weight: text('weight'),
    nationality: text('nationality'),
    college: text('college'), // Nullable — external players may not have this
    department: text('department'), // Nullable — external players may not have this
    university: text('university').notNull().default('Unknown'), // Always required — permanent affiliation
    isExternal: integer('is_external', { mode: 'boolean' }).default(false), // true for non-Bells players
    image: text('image'),
    marketValue: text('market_value'),
    // Multi-sport linking
    profileId: text('profile_id'), // UUID to link same person across sports
    email: text('email'),
    // Attributes (stored as JSON string)
    attributes: text('attributes'), // JSON: {speed, shooting, passing, dribbling, defense, physical}
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Player Team Affiliations table (many-to-many — replaces hard teamId coupling)
// A player can belong to multiple teams simultaneously with no conflicts
export const playerTeamAffiliations = sqliteTable('player_team_affiliations', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    affiliationType: text('affiliation_type').notNull(),
    // 'club' | 'department' | 'college' | 'university' | 'external'
    role: text('role').default('player'),
    status: text('status').default('active'),
    isPrimary: integer('is_primary', { mode: 'boolean' }).default(true),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    startDate: integer('start_date', { mode: 'timestamp' }),
    endDate: integer('end_date', { mode: 'timestamp' }),
    jerseyNumber: integer('jersey_number'),
    position: text('position'),
    nicknames: text('nicknames').default('[]'),
    // JSON array of field aliases e.g. ["Blacko", "No.7"]
    // No expiry — university affiliation is permanent
    season: text('season'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const playerTeamAffiliationsUnique = uniqueIndex('pta_player_team_season_unique')
    .on(playerTeamAffiliations.playerId, playerTeamAffiliations.teamId, playerTeamAffiliations.season);

// Player Organization Affiliations table
// Stores institutional relationships such as university, college, department, and governing-body affiliations.
export const playerOrganizationAffiliations = sqliteTable('player_organization_affiliations', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    affiliationType: text('affiliation_type').notNull(),
    role: text('role').default('member'),
    status: text('status').default('active'),
    isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
    startDate: integer('start_date', { mode: 'timestamp' }),
    endDate: integer('end_date', { mode: 'timestamp' }),
    metadata: text('metadata'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Basketball Player Stats table
export const basketballPlayerStats = sqliteTable('basketball_player_stats', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    season: text('season').notNull().default('2024'),
    competition: text('competition'),
    competitionId: text('competition_id').references(() => competitions.id),
    gamesPlayed: integer('games_played').default(0),
    gamesStarted: integer('games_started').default(0),
    minutesPlayed: integer('minutes_played').default(0),
    totalPoints: integer('total_points').default(0),
    fieldGoalsMade: integer('field_goals_made').default(0),
    fieldGoalsAttempted: integer('field_goals_attempted').default(0),
    threePointersMade: integer('three_pointers_made').default(0),
    threePointersAttempted: integer('three_pointers_attempted').default(0),
    freeThrowsMade: integer('free_throws_made').default(0),
    freeThrowsAttempted: integer('free_throws_attempted').default(0),
    offensiveRebounds: integer('offensive_rebounds').default(0),
    defensiveRebounds: integer('defensive_rebounds').default(0),
    totalRebounds: integer('total_rebounds').default(0),
    assists: integer('assists').default(0),
    turnovers: integer('turnovers').default(0),
    steals: integer('steals').default(0),
    blocks: integer('blocks').default(0),
    personalFouls: integer('personal_fouls').default(0),
    technicalFouls: integer('technical_fouls').default(0),
    pointsPerGame: real('points_per_game').default(0),
    reboundsPerGame: real('rebounds_per_game').default(0),
    assistsPerGame: real('assists_per_game').default(0),
    fieldGoalPercentage: real('field_goal_percentage').default(0),
    threePointPercentage: real('three_point_percentage').default(0),
    freeThrowPercentage: real('free_throw_percentage').default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const basketballPlayerStatsUnique = uniqueIndex('bps_player_season_competition_unique')
    .on(basketballPlayerStats.playerId, basketballPlayerStats.season, basketballPlayerStats.competitionId);

// Football Player Stats table
export const footballPlayerStats = sqliteTable('football_player_stats', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    season: text('season').notNull().default('2024'),
    competition: text('competition'),
    competitionId: text('competition_id').references(() => competitions.id),
    appearances: integer('appearances').default(0),
    starts: integer('starts').default(0),
    minutesPlayed: integer('minutes_played').default(0),
    goals: integer('goals').default(0),
    assists: integer('assists').default(0),
    shotsOnTarget: integer('shots_on_target').default(0),
    shotsOffTarget: integer('shots_off_target').default(0),
    passesCompleted: integer('passes_completed').default(0),
    passesAttempted: integer('passes_attempted').default(0),
    keyPasses: integer('key_passes').default(0),
    tackles: integer('tackles').default(0),
    interceptions: integer('interceptions').default(0),
    clearances: integer('clearances').default(0),
    yellowCards: integer('yellow_cards').default(0),
    redCards: integer('red_cards').default(0),
    ownGoals: integer('own_goals').default(0),
    penaltiesScored: integer('penalties_scored').default(0),
    foulsCommitted: integer('fouls_committed').default(0),
    foulsDrawn: integer('fouls_drawn').default(0),
    saves: integer('saves').default(0),
    cleanSheets: integer('clean_sheets').default(0),
    goalsConceded: integer('goals_conceded').default(0),
    goalsPerGame: real('goals_per_game').default(0),
    assistsPerGame: real('assists_per_game').default(0),
    passAccuracy: real('pass_accuracy').default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const footballPlayerStatsUnique = uniqueIndex('fps_player_season_competition_unique')
    .on(footballPlayerStats.playerId, footballPlayerStats.season, footballPlayerStats.competitionId);

// Individual Sport Stats table (Chess, Scrabble, Table Tennis)
export const individualSportStats = sqliteTable('individual_sport_stats', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    sport: text('sport').notNull(), // 'Chess' | 'Scrabble' | 'Table Tennis'
    season: text('season').notNull().default('2024'),
    competitionId: text('competition_id').references(() => competitions.id),
    // Universal
    gamesPlayed: integer('games_played').default(0),
    wins: integer('wins').default(0),
    losses: integer('losses').default(0),
    draws: integer('draws').default(0),
    // Scrabble specific
    totalScore: integer('total_score').default(0),
    highestScore: integer('highest_score').default(0),
    averageScore: real('average_score').default(0),
    // Table Tennis specific
    setsWon: integer('sets_won').default(0),
    setsLost: integer('sets_lost').default(0),
    // Chess specific
    rating: real('rating').default(0),
    // Extra data
    customStats: text('custom_stats'), // JSON for sport-specific extras
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const individualSportStatsUnique = uniqueIndex('iss_player_sport_season_competition_unique')
    .on(individualSportStats.playerId, individualSportStats.sport, individualSportStats.season, individualSportStats.competitionId);

// Competitions table
export const competitions = sqliteTable('competitions', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    sport: text('sport'),
    isMultiSport: integer('is_multi_sport', { mode: 'boolean' }).default(false),
    format: text('format').notNull(), // 'league' | 'knockout' | 'group_knockout'
    season: text('season').notNull(),
    logo: text('logo'),
    startDate: integer('start_date', { mode: 'timestamp' }),
    endDate: integer('end_date', { mode: 'timestamp' }),
    description: text('description'),
    level: text('level'), // 'inter-university' | 'busa-league' | 'college' | 'department' | 'year-level'
    scope: text('scope').default('internal'), // 'internal' | 'external'
    rules: text('rules'),
    numberOfTeams: integer('number_of_teams').default(0),
    numberOfGroups: integer('number_of_groups').default(0),
    teamsPerGroup: integer('teams_per_group').default(0),
    playersPerSide: integer('players_per_side').default(11), // Default — overridden by competitionSportSettings
    gender: text('gender').default('mixed'),
    registrationOpen: integer('registration_open', { mode: 'boolean' }).default(false),
    registrationDeadline: integer('registration_deadline', { mode: 'timestamp' }),
    maxTeams: integer('max_teams'),
    entryFee: text('entry_fee'),
    hostOrganization: text('host_organization'),
    hostOrganizationId: text('host_organization_id').references(() => organizations.id),
    governingOrganizationId: text('governing_organization_id').references(() => organizations.id),
    followersCount: integer('followers_count').default(0),
    status: text('status').default('upcoming'),
    winnerId: text('winner_id').references(() => teams.id),
    runnerUpId: text('runner_up_id').references(() => teams.id),
    thirdPlaceId: text('third_place_id').references(() => teams.id),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    finalStandings: text('final_standings'),
    highlights: text('highlights'),
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
    isArchived: integer('is_archived', { mode: 'boolean' }).default(false),
    displayOrder: integer('display_order').default(0),
    // Group draw status — for competitions where groups haven't been assigned yet
    groupDrawComplete: integer('group_draw_complete', { mode: 'boolean' }).default(false),
    // Squad/draft settings
    requireSquad: integer('require_squad', { mode: 'boolean' }).default(false), // If true, only squad players can play
    maxSquadSize: integer('max_squad_size').default(25), // Max players in squad (like 25 for World Cup)
    squadDeadline: integer('squad_deadline', { mode: 'timestamp' }), // Deadline to submit squad
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Competition Sport Settings table
// Overrides the competition-level defaults on a per-sport basis
// Essential for multi-sport competitions like NPUGA Special Edition
export const competitionSportSettings = sqliteTable('competition_sport_settings', {
    id: text('id').primaryKey(),
    competitionId: text('competition_id').notNull().references(() => competitions.id, { onDelete: 'cascade' }),
    sport: text('sport').notNull(), // 'Football' | 'Basketball' | 'Scrabble' | 'Chess' | 'Table Tennis'
    format: text('format'), // '5-aside' | '3x3' | '1v1' | 'singles' | 'doubles' | 'standard'
    playersPerSide: integer('players_per_side').notNull(),
    // in minutes — null for non-timed sports. Named for football's 2-half model but
    // reused as "one period's length" for any sport (e.g. basketball's quarter length,
    // 10 min) — a live prod column, so renaming costs a SQL-direct migration
    // (BACKLOG-040 blocks db:push) for a naming-clarity-only change. Deliberately left
    // overloaded rather than renamed; revisit if/when Track's period model needs a
    // genuinely different shape, not preemptively — see TD entry in BACKLOG.md.
    halfDuration: integer('half_duration'),
    // For round/set based sports (Chess, Scrabble, Table Tennis)
    // e.g. {"format":"round-based","tracking":"score-per-game","rounds":3}
    // e.g. {"format":"set-based","bestOf":5,"allowDoubles":true}
    customRules: text('custom_rules'), // JSON
    isTimed: integer('is_timed', { mode: 'boolean' }).default(true), // false for Chess, Scrabble, Table Tennis
    maxSubstitutions: integer('maxSubstitutions'), // null = unlimited
    allowSubbedOutReentry: integer('allowSubbedOutReentry', { mode: 'boolean' }).notNull().default(false),
    extraTimeEnabled: integer('extraTimeEnabled', { mode: 'boolean' }).notNull().default(false),
penaltiesEnabled: integer('penaltiesEnabled', { mode: 'boolean' }).notNull().default(false),
    allowDraws: integer('allowDraws', { mode: 'boolean' }).notNull().default(true),
    pointsForWin: integer('pointsForWin').notNull().default(3),
    pointsForDraw: integer('pointsForDraw').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Competition Team Entries table
// Tracks which teams are entered in which competition, with group assignment (nullable until draw)
export const competitionTeamEntries = sqliteTable('competition_team_entries', {
    id: text('id').primaryKey(),
    competitionId: text('competition_id').notNull().references(() => competitions.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    sport: text('sport').notNull(),
    gender: text('gender').notNull(), // 'male' | 'female'
    groupName: text('group_name'), // Nullable — assigned after draw (e.g. 'A' | 'B' | 'C')
    status: text('status').default('registered'), // 'registered' | 'active' | 'eliminated'
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Matches table
export const matches = sqliteTable('matches', {
    id: text('id').primaryKey(),
    sport: text('sport').notNull(),
    homeTeamId: text('home_team_id').notNull().references(() => teams.id),
    awayTeamId: text('away_team_id').notNull().references(() => teams.id),
    homeScore: integer('home_score').default(0),
    awayScore: integer('away_score').default(0),
    status: text('status').notNull().default('UPCOMING'),
    startTime: text('start_time').notNull(),
    venue: text('venue').notNull(),
    competition: text('competition').notNull(),
    competitionId: text('competition_id').references(() => competitions.id),
    matchType: text('match_type').default('competition'),
    competitionLevel: text('competition_level'),
    friendlyType: text('friendly_type'),
    friendlyDescription: text('friendly_description'),
    loggerId: text('logger_id'),
    stats: text('stats'),
    lineups: text('lineups'),
    highlightsUrl: text('highlights_url'),
    livestreamUrl: text('livestream_url'),
    livestreamType: text('livestream_type'),
    livestreamEnabled: integer('livestream_enabled', { mode: 'boolean' }).default(false),
    livestreamStartTime: integer('livestream_start_time', { mode: 'timestamp' }),
    round: text('round'),
    matchday: integer('matchday'),
    groupName: text('group_name'),
    livestreamEndTime: integer('livestream_end_time', { mode: 'timestamp' }),
    livestreamViewers: integer('livestream_viewers').default(0),
    livestreamChatEnabled: integer('livestream_chat_enabled', { mode: 'boolean' }).default(true),
    livestreamChatUrl: text('livestream_chat_url'),
    approvalStatus: text('approval_status').default('PENDING'),
    managerNotes: text('manager_notes'),
    approvedBy: text('approved_by').references(() => users.id),
    approvedAt: integer('approved_at', { mode: 'timestamp' }),
    penaltiesEnabledOverride: integer('penaltiesEnabledOverride', { mode: 'boolean' }),
    allowDrawsOverride: integer('allowDrawsOverride', { mode: 'boolean' }),
    extraTimeEnabledOverride: integer('extraTimeEnabledOverride', { mode: 'boolean' }),
    currentPeriod: text('current_period').default('NOT_STARTED'),
    minute: integer('minute'),
    extraTime: integer('extra_time'),
    // BACKLOG-105: penalty shootout score, isolated from homeScore/awayScore --
    // the official result stays the ET score per FIFA convention. Only PEN_SCORED
    // events increment these, via SQL atomic COALESCE(col, 0) + 1.
    shootoutHomeScore: integer('shootout_home_score').default(0),
    shootoutAwayScore: integer('shootout_away_score').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Match-Logger Assignments table
export const matchLoggerAssignments = sqliteTable('match_logger_assignments', {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    loggerId: text('logger_id').notNull().references(() => loggers.id, { onDelete: 'cascade' }),
    role: text('role').default('primary'),
    assignedAt: integer('assigned_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    assignedBy: text('assigned_by'),
    status: text('status').default('active'),
});

// Match Events table
export const matchEvents = sqliteTable('match_events', {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    minute: integer('minute').notNull(),
    second: integer('second'),
    period: text('period'),
    teamId: text('team_id').references(() => teams.id),
    playerId: text('player_id').references(() => players.id),
    relatedPlayerId: text('related_player_id').references(() => players.id),
    detail: text('detail'),
    isEyePoint: integer('is_eye_point', { mode: 'boolean' }).default(false),
    value: text('value'),
    loggerId: text('logger_id').references(() => loggers.id),
    loggerName: text('logger_name'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Loggers table
export const loggers = sqliteTable('loggers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').unique(),
    password: text('password'),
    role: text('role').default('logger'),
    status: text('status').default('active'),
    isAvailable: integer('is_available', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Standings table
export const standings = sqliteTable('standings', {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id),
    sport: text('sport').notNull(),
    competition: text('competition').notNull(),
    competitionId: text('competition_id').references(() => competitions.id),
    played: integer('played').default(0),
    won: integer('won').default(0),
    drawn: integer('drawn').default(0),
    lost: integer('lost').default(0),
    goalsFor: integer('goals_for').default(0),
    goalsAgainst: integer('goals_against').default(0),
    goalDifference: integer('goal_difference').default(0),
    points: integer('points').default(0),
    groupName: text('group_name'), // Nullable until draw is complete
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const standingsUnique = uniqueIndex('standings_team_competition_unique')
    .on(standings.teamId, standings.competitionId);

// Bracket/Tournament nodes
export const bracketNodes = sqliteTable('bracket_nodes', {
    id: text('id').primaryKey(),
    competitionId: text('competition_id').references(() => competitions.id),
    competition: text('competition').notNull(),
    sport: text('sport').notNull(),
    title: text('title').notNull(),
    matchId: text('match_id').references(() => matches.id),
    nextMatchId: text('next_match_id'),
    homeTeamId: text('home_team_id').references(() => teams.id),
    awayTeamId: text('away_team_id').references(() => teams.id),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    status: text('status').default('PENDING'),
    round: text('round'),
    position: integer('position'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Users table
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').unique().notNull(),
    password: text('password'),
    name: text('name').notNull(),
    avatar: text('avatar'),
    coverImage: text('cover_image'),
    bio: text('bio'),
    favoriteTeamId: text('favorite_team_id').references(() => teams.id),
    role: text('role').default('user'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User Preferences table
export const userPreferences = sqliteTable('user_preferences', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    theme: text('theme').default('dark'),
    language: text('language').default('en'),
    notifications: integer('notifications', { mode: 'boolean' }).default(true),
    emailNotifications: integer('email_notifications', { mode: 'boolean' }).default(true),
    matchAlerts: integer('match_alerts', { mode: 'boolean' }).default(true),
    playerRatings: integer('player_ratings', { mode: 'boolean' }).default(true),
    scoutUpdates: integer('scout_updates', { mode: 'boolean' }).default(true),
    milestones: integer('milestones', { mode: 'boolean' }).default(true),
    matchReminders: integer('match_reminders', { mode: 'boolean' }).default(true),
    favoriteTeamUpdates: integer('favorite_team_updates', { mode: 'boolean' }).default(true),
    weeklyDigest: integer('weekly_digest', { mode: 'boolean' }).default(false),
    profileVisibility: text('profile_visibility').default('public'),
    showStats: integer('show_stats', { mode: 'boolean' }).default(true),
    showActivity: integer('show_activity', { mode: 'boolean' }).default(true),
    soundEffects: integer('sound_effects', { mode: 'boolean' }).default(true),
    animations: integer('animations', { mode: 'boolean' }).default(true),
    compactMode: integer('compact_mode', { mode: 'boolean' }).default(false),
    favoriteSports: text('favorite_sports'),
    defaultView: text('default_view').default('standings'),
    timezone: text('timezone').default('UTC'),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User Favorites table
export const userFavorites = sqliteTable('user_favorites', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    favoriteType: text('favorite_type').notNull(),
    favoriteId: text('favorite_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User Follows table
export const userFollows = sqliteTable('user_follows', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    followType: text('follow_type').notNull(),
    followId: text('follow_id').notNull(),
    notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User Activity table
export const userActivity = sqliteTable('user_activity', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    activityType: text('activity_type').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    metadata: text('metadata'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Player Statistics table
export const playerStats = sqliteTable('player_stats', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id),
    competition: text('competition').notNull(),
    competitionId: text('competition_id').references(() => competitions.id),
    sport: text('sport').notNull(),
    goals: integer('goals').default(0),
    assists: integer('assists').default(0),
    appearances: integer('appearances').default(0),
    minutesPlayed: integer('minutes_played').default(0),
    yellowCards: integer('yellow_cards').default(0),
    redCards: integer('red_cards').default(0),
    cleanSheets: integer('clean_sheets').default(0),
    saves: integer('saves').default(0),
    averageRating: real('average_rating').default(7.0),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Team Form table
export const teamForm = sqliteTable('team_form', {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id),
    matchId: text('match_id').notNull().references(() => matches.id),
    competition: text('competition').notNull(),
    competitionId: text('competition_id').references(() => competitions.id),
    result: text('result').notNull(),
    goalsFor: integer('goals_for').notNull(),
    goalsAgainst: integer('goals_against').notNull(),
    matchDate: integer('match_date', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Head to Head records
export const headToHead = sqliteTable('head_to_head', {
    id: text('id').primaryKey(),
    team1Id: text('team1_id').notNull().references(() => teams.id),
    team2Id: text('team2_id').notNull().references(() => teams.id),
    competition: text('competition'),
    competitionId: text('competition_id').references(() => competitions.id),
    totalMatches: integer('total_matches').default(0),
    team1Wins: integer('team1_wins').default(0),
    team2Wins: integer('team2_wins').default(0),
    draws: integer('draws').default(0),
    team1GoalsFor: integer('team1_goals_for').default(0),
    team2GoalsFor: integer('team2_goals_for').default(0),
    lastMatchId: text('last_match_id').references(() => matches.id),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Team Registrations table
export const teamRegistrations = sqliteTable('team_registrations', {
    id: text('id').primaryKey(),
    competitionId: text('competition_id').notNull().references(() => competitions.id, { onDelete: 'cascade' }),
    teamName: text('team_name').notNull(),
    schoolName: text('school_name').notNull(),
    shortName: text('short_name').notNull(),
    logo: text('logo'),
    color: text('color').default('#000000'),
    contactName: text('contact_name').notNull(),
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone').notNull(),
    status: text('status').default('pending'),
    playersSubmitted: integer('players_submitted', { mode: 'boolean' }).default(false),
    numberOfPlayers: integer('number_of_players').default(0),
    notes: text('notes'),
    approvedBy: text('approved_by').references(() => users.id),
    approvedAt: integer('approved_at', { mode: 'timestamp' }),
    createdTeamId: text('created_team_id').references(() => teams.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Registered Players table (bulk registration for external universities)
export const registeredPlayers = sqliteTable('registered_players', {
    id: text('id').primaryKey(),
    registrationId: text('registration_id').references(() => teamRegistrations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    jerseyName: text('jersey_name'),
    number: integer('number').notNull(),
    position: text('position').notNull(),
    sport: text('sport').notNull(), // Required for bulk multi-sport registration
    gender: text('gender').notNull().default('male'), // 'male' | 'female'
    university: text('university').notNull(), // Permanent — set once, never changes
    age: integer('age'),
    height: text('height'),
    weight: text('weight'),
    nationality: text('nationality').default('Nigeria'),
    college: text('college'), // Nullable for external players
    department: text('department'), // Nullable for external players
    image: text('image'),
    createdPlayerId: text('created_player_id').references(() => players.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Squad Players table - Selected players for specific competition (like World Cup squad)
export const squadPlayers = sqliteTable('squad_players', {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    competitionId: text('competition_id').notNull().references(() => competitions.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    // Squad-specific jersey number for this competition
    squadNumber: integer('squad_number'),
    // Role in squad
    role: text('role').default('player'), // 'player' | 'captain' | 'vice_captain' | 'goalkeeper' | etc
    // Selection metadata
    selectedBy: text('selected_by').references(() => users.id),
    selectedAt: integer('selected_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    // Status
    status: text('status').default('active'), // 'active' | 'injured' | 'suspended' | 'withdrawn'
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
    // Unique constraint: one player per team per competition
    uniqueSquadPlayer: unique().on(table.teamId, table.competitionId, table.playerId),
}));

// Polls table
export const polls = sqliteTable('polls', {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    pollType: text('poll_type').notNull().default('match_winner'),
    options: text('options').notNull(),
    status: text('status').notNull().default('active'),
    totalVotes: integer('total_votes').default(0),
    endsAt: integer('ends_at', { mode: 'timestamp' }),
    createdBy: text('created_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Poll Votes table
export const pollVotes = sqliteTable('poll_votes', {
    id: text('id').primaryKey(),
    pollId: text('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    optionId: text('option_id').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Poll Comments table
export const pollComments = sqliteTable('poll_comments', {
    id: text('id').primaryKey(),
    pollId: text('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    parentId: text('parent_id'),
    likes: integer('likes').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Poll Comment Likes table
export const pollCommentLikes = sqliteTable('poll_comment_likes', {
    id: text('id').primaryKey(),
    commentId: text('comment_id').notNull().references(() => pollComments.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// News table
export const news = sqliteTable('news', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    content: text('content').notNull(),
    excerpt: text('excerpt'),
    imageUrl: text('image_url'),
    category: text('category').notNull(),
    tags: text('tags'),
    isBreaking: integer('is_breaking', { mode: 'boolean' }).default(false),
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
    authorId: text('author_id').references(() => users.id),
    authorName: text('author_name'),
    views: integer('views').default(0),
    likes: integer('likes').default(0),
    sendPushNotification: integer('send_push_notification', { mode: 'boolean' }).default(false),
    pushNotificationSent: integer('push_notification_sent', { mode: 'boolean' }).default(false),
    pushNotificationSentAt: integer('push_notification_sent_at', { mode: 'timestamp' }),
    status: text('status').notNull().default('draft'),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// News Relations table
export const newsRelations = sqliteTable('news_relations', {
    id: text('id').primaryKey(),
    newsId: text('news_id').notNull().references(() => news.id, { onDelete: 'cascade' }),
    relationType: text('relation_type').notNull(),
    relationId: text('relation_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Transfers table
export const transfers = sqliteTable('transfers', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id),
    fromTeamId: text('from_team_id').references(() => teams.id),
    toTeamId: text('to_team_id').references(() => teams.id),
    transferType: text('transfer_type').notNull(),
    fee: text('fee'),
    status: text('status').notNull().default('rumor'),
    reliability: integer('reliability').default(5),
    source: text('source'),
    description: text('description'),
    imageUrl: text('image_url'),
    sendPushNotification: integer('send_push_notification', { mode: 'boolean' }).default(false),
    pushNotificationSent: integer('push_notification_sent', { mode: 'boolean' }).default(false),
    pushNotificationSentAt: integer('push_notification_sent_at', { mode: 'timestamp' }),
    createdBy: text('created_by').references(() => users.id),
    announcedAt: integer('announced_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    season: text('season'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// News Likes table
export const newsLikes = sqliteTable('news_likes', {
    id: text('id').primaryKey(),
    newsId: text('news_id').notNull().references(() => news.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// News Comments table
export const newsComments = sqliteTable('news_comments', {
    id: text('id').primaryKey(),
    newsId: text('news_id').notNull().references(() => news.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    userName: text('user_name').notNull(),
    content: text('content').notNull(),
    parentId: text('parent_id'),
    likes: integer('likes').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User Bookmarks table
export const userBookmarks = sqliteTable('user_bookmarks', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    newsId: text('news_id').notNull().references(() => news.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// System Settings table
export const systemSettings = sqliteTable('system_settings', {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    value: text('value').notNull(),
    type: text('type').notNull(),
    category: text('category').notNull(),
    description: text('description'),
    updatedBy: text('updated_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// System Settings History table
export const systemSettingsHistory = sqliteTable('system_settings_history', {
    id: text('id').primaryKey(),
    settingKey: text('setting_key').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value').notNull(),
    updatedBy: text('updated_by').references(() => users.id),
    reason: text('reason'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Staff Communication table
export const staffComms = sqliteTable('staff_comms', {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    type: text('type').default('note'),
    priority: text('priority').default('normal'),
    isRead: integer('is_read', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Push Subscriptions table
// BACKLOG-150: anonymous (unauthenticated) viewers can subscribe too -- their
// row's userId points at ANONYMOUS_PUSH_USER_ID (a single well-known sentinel
// user row, see src/lib/notifications/anonymous-subscriber.ts), not a real
// person. deviceId (client-generated, localStorage-persisted) is the real
// per-device identity for anonymous rows; endpoint's own uniqueness prevents
// duplicate rows on re-subscribe either way. Chosen over making userId
// nullable to avoid a SQLite table-rebuild migration (ALTER COLUMN DROP NOT
// NULL isn't supported) -- functionally equivalent, lower migration risk.
export const pushSubscriptions = sqliteTable('push_subscriptions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id'),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Push Subscription <-> Match links table
// Anonymous subscribers have no userFollows/favoriteTeamId row to target by
// team, so they instead opt into specific matches directly ("notify me about
// this match") from the match detail page. Authenticated subscribers keep
// using the existing team-follow targeting in match-notification-service.ts
// unchanged -- this table is anonymous-path-only, but not restricted to it at
// the schema level in case an authenticated user ever wants ad-hoc
// single-match alerts too.
export const pushSubscriptionMatches = sqliteTable('push_subscription_matches', {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id').notNull().references(() => pushSubscriptions.id, { onDelete: 'cascade' }),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Match Reminders table
export const matchReminders = sqliteTable('match_reminders', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    reminderTime: integer('reminder_time', { mode: 'timestamp' }).notNull(),
    minutesBefore: integer('minutes_before').notNull().default(15),
    notificationSent: integer('notification_sent', { mode: 'boolean' }).default(false),
    notificationSentAt: integer('notification_sent_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// BACKLOG-211: persistent record of every notification send attempt.
// sendMatchEventNotification()/sendMatchReminderNotification()/the campaign
// composer previously only console.log'd -- Vercel function logs aren't
// reachable from a dev session, which cost real debugging time twice in one
// session (BUG-200's and BACKLOG-203's own verification passes both had to
// fall back to direct tsx-run diagnostics instead of just reading a log).
// One row per send *call* (not per-subscription) -- enough to answer "did
// this fire, for how many people, did it succeed" without the row count
// exploding on a large audience.
export const notificationSendLog = sqliteTable('notification_send_log', {
    id: text('id').primaryKey(),
    source: text('source').notNull(), // 'match_event' | 'match_reminder' | 'campaign'
    matchId: text('match_id'), // nullable -- campaigns aren't always match-scoped
    eventType: text('event_type'), // e.g. 'GOAL', 'MATCH_START', or the campaign's own `type` field
    targetAudience: text('target_audience'), // campaign-only: 'all' | 'team_followers' | 'match_specific'
    totalSubscriptions: integer('total_subscriptions').notNull().default(0),
    sentCount: integer('sent_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    errors: text('errors'), // JSON array of error strings, nullable
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Password Reset Tokens table
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Advertisements table
export const advertisements = sqliteTable('advertisements', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    imageUrl: text('image_url').notNull(),
    linkUrl: text('link_url').notNull(),
    position: text('position').notNull().default('inline'), // 'top' | 'bottom' | 'sidebar' | 'inline'
    size: text('size').notNull().default('small'), // 'small' | 'medium' | 'large'
    status: text('status').notNull().default('active'), // 'active' | 'inactive'
    priority: integer('priority').default(0), // Higher priority = shown first
    startDate: integer('start_date', { mode: 'timestamp' }),
    endDate: integer('end_date', { mode: 'timestamp' }),
    impressions: integer('impressions').default(0),
    clicks: integer('clicks').default(0),
    createdBy: text('created_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ─────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────

export const teamsRelations = relations(teams, ({ one, many }) => ({
    ownerOrganization: one(organizations, {
        fields: [teams.ownerOrganizationId],
        references: [organizations.id],
    }),
    players: many(players),
    affiliations: many(playerTeamAffiliations),
    homeMatches: many(matches, { relationName: 'homeTeam' }),
    awayMatches: many(matches, { relationName: 'awayTeam' }),
    standings: many(standings),
    competitionEntries: many(competitionTeamEntries),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
    team: one(teams, {
        fields: [players.teamId],
        references: [teams.id],
    }),
    affiliations: many(playerTeamAffiliations),
    organizationAffiliations: many(playerOrganizationAffiliations),
    events: many(matchEvents),
    individualStats: many(individualSportStats),
}));

export const playerTeamAffiliationsRelations = relations(playerTeamAffiliations, ({ one }) => ({
    player: one(players, {
        fields: [playerTeamAffiliations.playerId],
        references: [players.id],
    }),
    team: one(teams, {
        fields: [playerTeamAffiliations.teamId],
        references: [teams.id],
    }),
}));

export const playerOrganizationAffiliationsRelations = relations(playerOrganizationAffiliations, ({ one }) => ({
    player: one(players, {
        fields: [playerOrganizationAffiliations.playerId],
        references: [players.id],
    }),
    organization: one(organizations, {
        fields: [playerOrganizationAffiliations.organizationId],
        references: [organizations.id],
    }),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
    parentOrganization: one(organizations, {
        fields: [organizations.parentOrganizationId],
        references: [organizations.id],
        relationName: 'organizationHierarchy',
    }),
    childOrganizations: many(organizations, {
        relationName: 'organizationHierarchy',
    }),
    ownedTeams: many(teams),
    hostedCompetitions: many(competitions),
    governedCompetitions: many(competitions, {
        relationName: 'governingOrganization',
    }),
    playerAffiliations: many(playerOrganizationAffiliations),
}));

export const competitionsRelations = relations(competitions, ({ one, many }) => ({
    hostOrganizationRef: one(organizations, {
        fields: [competitions.hostOrganizationId],
        references: [organizations.id],
    }),
    governingOrganizationRef: one(organizations, {
        fields: [competitions.governingOrganizationId],
        references: [organizations.id],
        relationName: 'governingOrganization',
    }),
    winner: one(teams, {
        fields: [competitions.winnerId],
        references: [teams.id],
        relationName: 'winner',
    }),
    runnerUp: one(teams, {
        fields: [competitions.runnerUpId],
        references: [teams.id],
        relationName: 'runnerUp',
    }),
    thirdPlace: one(teams, {
        fields: [competitions.thirdPlaceId],
        references: [teams.id],
        relationName: 'thirdPlace',
    }),
    sportSettings: many(competitionSportSettings),
    teamEntries: many(competitionTeamEntries),
}));

export const competitionSportSettingsRelations = relations(competitionSportSettings, ({ one }) => ({
    competition: one(competitions, {
        fields: [competitionSportSettings.competitionId],
        references: [competitions.id],
    }),
}));

export const competitionTeamEntriesRelations = relations(competitionTeamEntries, ({ one }) => ({
    competition: one(competitions, {
        fields: [competitionTeamEntries.competitionId],
        references: [competitions.id],
    }),
    team: one(teams, {
        fields: [competitionTeamEntries.teamId],
        references: [teams.id],
    }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
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
}));

export const newsRelationsRelations = relations(news, ({ many }) => ({
    relations: many(newsRelations),
    likes: many(newsLikes),
    comments: many(newsComments),
    bookmarks: many(userBookmarks),
}));

export const newsLikesRelations = relations(newsLikes, ({ one }) => ({
    news: one(news, { fields: [newsLikes.newsId], references: [news.id] }),
    user: one(users, { fields: [newsLikes.userId], references: [users.id] }),
}));

export const newsCommentsRelations = relations(newsComments, ({ one }) => ({
    news: one(news, { fields: [newsComments.newsId], references: [news.id] }),
    user: one(users, { fields: [newsComments.userId], references: [users.id] }),
}));

export const userBookmarksRelations = relations(userBookmarks, ({ one }) => ({
    news: one(news, { fields: [userBookmarks.newsId], references: [news.id] }),
    user: one(users, { fields: [userBookmarks.userId], references: [users.id] }),
}));

export const individualSportStatsRelations = relations(individualSportStats, ({ one }) => ({
    player: one(players, {
        fields: [individualSportStats.playerId],
        references: [players.id],
    }),
    competition: one(competitions, {
        fields: [individualSportStats.competitionId],
        references: [competitions.id],
    }),
}));

// Squad Players relations
export const squadPlayersRelations = relations(squadPlayers, ({ one }) => ({
    team: one(teams, {
        fields: [squadPlayers.teamId],
        references: [teams.id],
    }),
    competition: one(competitions, {
        fields: [squadPlayers.competitionId],
        references: [competitions.id],
    }),
    player: one(players, {
        fields: [squadPlayers.playerId],
        references: [players.id],
    }),
}));

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type PlayerTeamAffiliation = typeof playerTeamAffiliations.$inferSelect;
export type NewPlayerTeamAffiliation = typeof playerTeamAffiliations.$inferInsert;
export type PlayerOrganizationAffiliation = typeof playerOrganizationAffiliations.$inferSelect;
export type NewPlayerOrganizationAffiliation = typeof playerOrganizationAffiliations.$inferInsert;
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
export type UserActivity = typeof userActivity.$inferSelect;
export type NewUserActivity = typeof userActivity.$inferInsert;
export type PlayerStat = typeof playerStats.$inferSelect;
export type NewPlayerStat = typeof playerStats.$inferInsert;
export type TeamForm = typeof teamForm.$inferSelect;
export type NewTeamForm = typeof teamForm.$inferInsert;
export type HeadToHead = typeof headToHead.$inferSelect;
export type NewHeadToHead = typeof headToHead.$inferInsert;
export type Competition = typeof competitions.$inferSelect;
export type NewCompetition = typeof competitions.$inferInsert;
export type CompetitionSportSetting = typeof competitionSportSettings.$inferSelect;
export type NewCompetitionSportSetting = typeof competitionSportSettings.$inferInsert;
export type CompetitionTeamEntry = typeof competitionTeamEntries.$inferSelect;
export type NewCompetitionTeamEntry = typeof competitionTeamEntries.$inferInsert;
export type IndividualSportStat = typeof individualSportStats.$inferSelect;
export type NewIndividualSportStat = typeof individualSportStats.$inferInsert;
export type Poll = typeof polls.$inferSelect;
export type NewPoll = typeof polls.$inferInsert;
export type PollVote = typeof pollVotes.$inferSelect;
export type NewPollVote = typeof pollVotes.$inferInsert;
export type PollComment = typeof pollComments.$inferSelect;
export type NewPollComment = typeof pollComments.$inferInsert;
export type PollCommentLike = typeof pollCommentLikes.$inferSelect;
export type NewPollCommentLike = typeof pollCommentLikes.$inferInsert;
export type News = typeof news.$inferSelect;
export type NewNews = typeof news.$inferInsert;
export type NewsRelation = typeof newsRelations.$inferSelect;
export type NewNewsRelation = typeof newsRelations.$inferInsert;
export type Transfer = typeof transfers.$inferSelect;
export type NewTransfer = typeof transfers.$inferInsert;
export type NewsLike = typeof newsLikes.$inferSelect;
export type NewNewsLike = typeof newsLikes.$inferInsert;
export type NewsComment = typeof newsComments.$inferSelect;
export type NewNewsComment = typeof newsComments.$inferInsert;
export type UserBookmark = typeof userBookmarks.$inferSelect;
export type NewUserBookmark = typeof userBookmarks.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
export type SystemSettingHistory = typeof systemSettingsHistory.$inferSelect;
export type NewSystemSettingHistory = typeof systemSettingsHistory.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type MatchReminder = typeof matchReminders.$inferSelect;
export type NewMatchReminder = typeof matchReminders.$inferInsert;
export type MatchLoggerAssignment = typeof matchLoggerAssignments.$inferSelect;
export type NewMatchLoggerAssignment = typeof matchLoggerAssignments.$inferInsert;
export type TeamRegistration = typeof teamRegistrations.$inferSelect;
export type NewTeamRegistration = typeof teamRegistrations.$inferInsert;
export type RegisteredPlayer = typeof registeredPlayers.$inferSelect;
export type NewRegisteredPlayer = typeof registeredPlayers.$inferInsert;
export type StaffComm = typeof staffComms.$inferSelect;
export type NewStaffComm = typeof staffComms.$inferInsert;
export type SquadPlayer = typeof squadPlayers.$inferSelect;
export type NewSquadPlayer = typeof squadPlayers.$inferInsert;
export type Advertisement = typeof advertisements.$inferSelect;
export type NewAdvertisement = typeof advertisements.$inferInsert;

// Export other schemas
export { matchPredictions, predictionLeaderboard, predictionComments } from './schema-predictions';
export { userXI, userXILikes, userXIComments } from './schema-xi';
export { userLineups, userLineupLikes, userLineupComments } from './schema-user-lineups';
export { playerRatings, ratingHistory } from './schema-ratings';
export {
    fplGameweeks,
    fplPlayerData,
    fplPlayerGameweekStats,
    fplTeams,
    fplTeamSelections,
    fplTransfers,
    fplLeagues,
    fplLeagueMembers,
    fplH2HFixtures,
    fplDreamTeam,
    fplAchievements
} from './schema-fpl';
