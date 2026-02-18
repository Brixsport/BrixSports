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
    sport: text('sport').notNull().default('Football'), // 'Football' | 'Basketball' | 'Track' | etc
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
    jerseyName: text('jersey_name'), // Name on jersey for logger identification
    number: integer('number').notNull(),
    teamId: text('team_id').notNull().references(() => teams.id),
    position: text('position').notNull(),
    rating: real('rating').default(7.0),
    eyePoints: integer('eye_points').default(0),
    age: integer('age'),
    height: text('height'),
    weight: text('weight'),
    nationality: text('nationality'),
    college: text('college'), // For interdepartmental competitions (e.g., COLENG, COLNAS)
    department: text('department'), // For interdepartmental competitions
    image: text('image'),
    marketValue: text('market_value'),
    // Multi-sport linking
    profileId: text('profile_id'), // UUID to link same person across sports
    email: text('email'), // For admin matching only
    // Attributes (stored as JSON string)
    attributes: text('attributes'), // JSON: {speed, shooting, passing, dribbling, defense, physical}
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Basketball Player Stats table
export const basketballPlayerStats = sqliteTable('basketball_player_stats', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    season: text('season').notNull().default('2024'),
    // Game stats
    gamesPlayed: integer('games_played').default(0),
    gamesStarted: integer('games_started').default(0),
    minutesPlayed: integer('minutes_played').default(0),
    // Scoring
    totalPoints: integer('total_points').default(0),
    fieldGoalsMade: integer('field_goals_made').default(0),
    fieldGoalsAttempted: integer('field_goals_attempted').default(0),
    threePointersMade: integer('three_pointers_made').default(0),
    threePointersAttempted: integer('three_pointers_attempted').default(0),
    freeThrowsMade: integer('free_throws_made').default(0),
    freeThrowsAttempted: integer('free_throws_attempted').default(0),
    // Rebounds
    offensiveRebounds: integer('offensive_rebounds').default(0),
    defensiveRebounds: integer('defensive_rebounds').default(0),
    totalRebounds: integer('total_rebounds').default(0),
    // Playmaking
    assists: integer('assists').default(0),
    turnovers: integer('turnovers').default(0),
    // Defense
    steals: integer('steals').default(0),
    blocks: integer('blocks').default(0),
    // Fouls
    personalFouls: integer('personal_fouls').default(0),
    technicalFouls: integer('technical_fouls').default(0),
    // Averages (calculated)
    pointsPerGame: real('points_per_game').default(0),
    reboundsPerGame: real('rebounds_per_game').default(0),
    assistsPerGame: real('assists_per_game').default(0),
    fieldGoalPercentage: real('field_goal_percentage').default(0),
    threePointPercentage: real('three_point_percentage').default(0),
    freeThrowPercentage: real('free_throw_percentage').default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Football Player Stats table
export const footballPlayerStats = sqliteTable('football_player_stats', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    season: text('season').notNull().default('2024'),
    // Game stats
    appearances: integer('appearances').default(0),
    starts: integer('starts').default(0),
    minutesPlayed: integer('minutes_played').default(0),
    // Scoring
    goals: integer('goals').default(0),
    assists: integer('assists').default(0),
    shotsOnTarget: integer('shots_on_target').default(0),
    shotsOffTarget: integer('shots_off_target').default(0),
    // Passing
    passesCompleted: integer('passes_completed').default(0),
    passesAttempted: integer('passes_attempted').default(0),
    keyPasses: integer('key_passes').default(0),
    // Defense
    tackles: integer('tackles').default(0),
    interceptions: integer('interceptions').default(0),
    clearances: integer('clearances').default(0),
    // Discipline
    yellowCards: integer('yellow_cards').default(0),
    redCards: integer('red_cards').default(0),
    foulsCommitted: integer('fouls_committed').default(0),
    foulsDrawn: integer('fouls_drawn').default(0),
    // Goalkeeper (if applicable)
    saves: integer('saves').default(0),
    cleanSheets: integer('clean_sheets').default(0),
    goalsConceded: integer('goals_conceded').default(0),
    // Averages (calculated)
    goalsPerGame: real('goals_per_game').default(0),
    assistsPerGame: real('assists_per_game').default(0),
    passAccuracy: real('pass_accuracy').default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});


// Matches table
export const matches = sqliteTable('matches', {
    id: text('id').primaryKey(),
    sport: text('sport').notNull(), // 'Football' | 'Basketball' | 'Track' | etc
    homeTeamId: text('home_team_id').notNull().references(() => teams.id),
    awayTeamId: text('away_team_id').notNull().references(() => teams.id),
    homeScore: integer('home_score').default(0),
    awayScore: integer('away_score').default(0),
    status: text('status').notNull().default('UPCOMING'), // 'LIVE' | 'FINISHED' | 'UPCOMING' | 'HALF_TIME'
    startTime: text('start_time').notNull(), // ISO 8601 date string
    venue: text('venue').notNull(),
    competition: text('competition').notNull(),
    matchType: text('match_type').default('competition'), // 'competition' | 'friendly'
    competitionLevel: text('competition_level'), // 'busa-league' | 'college' | 'department' | 'year-level' | 'external'
    friendlyType: text('friendly_type'), // 'internal' | 'external'
    friendlyDescription: text('friendly_description'),
    loggerId: text('logger_id'),
    // Stats (stored as JSON string)
    stats: text('stats'), // JSON: {possession, shots, shotsOnTarget, corners, fouls, yellowCards, redCards, saves}
    // Lineups (stored as JSON string)
    lineups: text('lineups'), // JSON: {home: [], away: []}
    // Livestream fields
    highlightsUrl: text('highlights_url'), // URL to highlights video
    livestreamUrl: text('livestream_url'), // URL to stream (YouTube, Twitch, HLS, etc.)
    livestreamType: text('livestream_type'), // 'youtube' | 'twitch' | 'facebook' | 'hls' | 'dash' | 'custom'
    livestreamEnabled: integer('livestream_enabled', { mode: 'boolean' }).default(false),
    livestreamStartTime: integer('livestream_start_time', { mode: 'timestamp' }),
    livestreamEndTime: integer('livestream_end_time', { mode: 'timestamp' }),
    livestreamViewers: integer('livestream_viewers').default(0),
    livestreamChatEnabled: integer('livestream_chat_enabled', { mode: 'boolean' }).default(true),
    livestreamChatUrl: text('livestream_chat_url'), // Optional separate chat URL
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Match-Logger Assignments table (many-to-many relationship for multi-logger support)
export const matchLoggerAssignments = sqliteTable('match_logger_assignments', {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    loggerId: text('logger_id').notNull().references(() => loggers.id, { onDelete: 'cascade' }),
    role: text('role').default('primary'), // 'primary' | 'secondary' | 'backup'
    assignedAt: integer('assigned_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    assignedBy: text('assigned_by'), // Admin who made the assignment
    status: text('status').default('active'), // 'active' | 'removed'
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
    // Multi-logger support
    loggerId: text('logger_id').references(() => loggers.id),
    loggerName: text('logger_name'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Loggers table
export const loggers = sqliteTable('loggers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').unique(),
    password: text('password'), // Hashed
    role: text('role').default('logger'), // 'logger' | 'admin'
    status: text('status').default('active'), // 'active' | 'inactive' | 'on_break'
    isAvailable: integer('is_available', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Standings table (computed from matches, but can be cached)
export const standings = sqliteTable('standings', {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id),
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
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Bracket/Tournament nodes
export const bracketNodes = sqliteTable('bracket_nodes', {
    id: text('id').primaryKey(),
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
    coverImage: text('cover_image'),
    bio: text('bio'),
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
    matchReminders: integer('match_reminders', { mode: 'boolean' }).default(true),
    favoriteTeamUpdates: integer('favorite_team_updates', { mode: 'boolean' }).default(true),
    weeklyDigest: integer('weekly_digest', { mode: 'boolean' }).default(false),
    profileVisibility: text('profile_visibility').default('public'), // 'public' | 'friends' | 'private'
    showStats: integer('show_stats', { mode: 'boolean' }).default(true),
    showActivity: integer('show_activity', { mode: 'boolean' }).default(true),
    soundEffects: integer('sound_effects', { mode: 'boolean' }).default(true),
    animations: integer('animations', { mode: 'boolean' }).default(true),
    compactMode: integer('compact_mode', { mode: 'boolean' }).default(false),
    favoriteSports: text('favorite_sports'), // JSON array: ['Football', 'Basketball']
    defaultView: text('default_view').default('standings'), // 'standings' | 'brackets' | 'matches'
    timezone: text('timezone').default('UTC'),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User Favorites table (teams, players, matches)
export const userFavorites = sqliteTable('user_favorites', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    favoriteType: text('favorite_type').notNull(), // 'team' | 'player' | 'match' | 'competition'
    favoriteId: text('favorite_id').notNull(), // ID of the favorited item
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User Follows table (teams, players, competitions with notification preferences)
export const userFollows = sqliteTable('user_follows', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    followType: text('follow_type').notNull(), // 'team' | 'player' | 'competition'
    followId: text('follow_id').notNull(), // ID of the followed item
    notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User Activity table (track user actions for activity feed)
export const userActivity = sqliteTable('user_activity', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    activityType: text('activity_type').notNull(), // 'match_watched' | 'favorite_added' | 'prediction_made' | 'team_followed' | etc
    entityType: text('entity_type'), // 'match' | 'team' | 'player' | 'competition'
    entityId: text('entity_id'), // ID of the related entity
    metadata: text('metadata'), // JSON: additional data about the activity
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Player Statistics table (for top scorers, assists, etc.)
export const playerStats = sqliteTable('player_stats', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id),
    competition: text('competition').notNull(),
    sport: text('sport').notNull(),
    // Football/Basketball stats
    goals: integer('goals').default(0),
    assists: integer('assists').default(0),
    appearances: integer('appearances').default(0),
    minutesPlayed: integer('minutes_played').default(0),
    // Disciplinary
    yellowCards: integer('yellow_cards').default(0),
    redCards: integer('red_cards').default(0),
    // Additional stats
    cleanSheets: integer('clean_sheets').default(0), // For goalkeepers
    saves: integer('saves').default(0),
    // Performance
    averageRating: real('average_rating').default(7.0),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Team Form table (last N matches for form guide)
export const teamForm = sqliteTable('team_form', {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id),
    matchId: text('match_id').notNull().references(() => matches.id),
    competition: text('competition').notNull(),
    result: text('result').notNull(), // 'W' | 'D' | 'L'
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
    totalMatches: integer('total_matches').default(0),
    team1Wins: integer('team1_wins').default(0),
    team2Wins: integer('team2_wins').default(0),
    draws: integer('draws').default(0),
    team1GoalsFor: integer('team1_goals_for').default(0),
    team2GoalsFor: integer('team2_goals_for').default(0),
    lastMatchId: text('last_match_id').references(() => matches.id),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Competitions table (for rules and format)
export const competitions = sqliteTable('competitions', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    sport: text('sport').notNull(),
    format: text('format').notNull(), // 'league' | 'knockout' | 'group_knockout'
    season: text('season').notNull(),
    startDate: integer('start_date', { mode: 'timestamp' }),
    endDate: integer('end_date', { mode: 'timestamp' }),
    description: text('description'),
    level: text('level'), // 'inter-university' | 'busa-league' | 'college' | 'department' | 'year-level'
    scope: text('scope').default('internal'), // 'internal' | 'external'
    rules: text('rules'), // JSON: competition rules
    numberOfTeams: integer('number_of_teams').default(0),
    numberOfGroups: integer('number_of_groups').default(0),
    teamsPerGroup: integer('teams_per_group').default(0),
    playersPerSide: integer('players_per_side').default(11), // 11 for standard football, 5 for 5-aside
    gender: text('gender').default('mixed'), // 'male' | 'female' | 'mixed'
    registrationOpen: integer('registration_open', { mode: 'boolean' }).default(false),
    registrationDeadline: integer('registration_deadline', { mode: 'timestamp' }),
    maxTeams: integer('max_teams'), // Maximum teams allowed to register
    entryFee: text('entry_fee'), // Entry fee if applicable
    hostOrganization: text('host_organization'), // e.g., "Bells University"
    followersCount: integer('followers_count').default(0),
    status: text('status').default('upcoming'), // 'upcoming' | 'ongoing' | 'completed' | 'archived'
    // Winner tracking
    winnerId: text('winner_id').references(() => teams.id), // Champion team
    runnerUpId: text('runner_up_id').references(() => teams.id), // Runner-up team
    thirdPlaceId: text('third_place_id').references(() => teams.id), // Third place team
    completedAt: integer('completed_at', { mode: 'timestamp' }), // When competition ended
    finalStandings: text('final_standings'), // JSON: final standings/results
    highlights: text('highlights'), // Competition highlights/summary
    // Display settings
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false), // Show on homepage
    isArchived: integer('is_archived', { mode: 'boolean' }).default(false), // Hide from main views
    displayOrder: integer('display_order').default(0), // Order on homepage (lower = higher priority)
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Team Registrations table (for competition sign-ups)
export const teamRegistrations = sqliteTable('team_registrations', {
    id: text('id').primaryKey(),
    competitionId: text('competition_id').notNull().references(() => competitions.id, { onDelete: 'cascade' }),
    teamName: text('team_name').notNull(),
    schoolName: text('school_name').notNull(), // University/School name
    shortName: text('short_name').notNull(),
    logo: text('logo'), // Team logo URL
    color: text('color').default('#000000'),
    contactName: text('contact_name').notNull(), // Team manager/coach name
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone').notNull(),
    status: text('status').default('pending'), // 'pending' | 'approved' | 'rejected'
    playersSubmitted: integer('players_submitted', { mode: 'boolean' }).default(false),
    numberOfPlayers: integer('number_of_players').default(0),
    notes: text('notes'), // Additional notes or requirements
    approvedBy: text('approved_by').references(() => users.id), // Admin who approved
    approvedAt: integer('approved_at', { mode: 'timestamp' }),
    createdTeamId: text('created_team_id').references(() => teams.id), // Team ID after approval
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Registered Players table (for players in team registrations)
export const registeredPlayers = sqliteTable('registered_players', {
    id: text('id').primaryKey(),
    registrationId: text('registration_id').notNull().references(() => teamRegistrations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    jerseyName: text('jersey_name'), // Name on jersey
    number: integer('number').notNull(),
    position: text('position').notNull(),
    age: integer('age'),
    height: text('height'),
    weight: text('weight'),
    nationality: text('nationality').default('Nigeria'),
    college: text('college'), // For interdepartmental
    department: text('department'),
    image: text('image'), // Player photo URL
    createdPlayerId: text('created_player_id').references(() => players.id), // Player ID after approval
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Polls table (for match predictions and fan engagement)
export const polls = sqliteTable('polls', {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    question: text('question').notNull(), // e.g., "Who will win this match?"
    pollType: text('poll_type').notNull().default('match_winner'), // 'match_winner' | 'score_prediction' | 'mvp' | 'custom'
    options: text('options').notNull(), // JSON array: [{id, label, teamId?}]
    status: text('status').notNull().default('active'), // 'active' | 'closed' | 'completed'
    totalVotes: integer('total_votes').default(0),
    endsAt: integer('ends_at', { mode: 'timestamp' }), // When poll closes
    createdBy: text('created_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Poll Votes table
export const pollVotes = sqliteTable('poll_votes', {
    id: text('id').primaryKey(),
    pollId: text('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    optionId: text('option_id').notNull(), // ID of the selected option
    ipAddress: text('ip_address'), // For anonymous voting tracking
    userAgent: text('user_agent'), // For anonymous voting tracking
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Poll Comments table (for discussions)
export const pollComments = sqliteTable('poll_comments', {
    id: text('id').primaryKey(),
    pollId: text('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    parentId: text('parent_id'), // For replies
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
    imageUrl: text('image_url'), // URL to image (can be external or uploaded to cloud storage)
    category: text('category').notNull(), // 'match' | 'transfer' | 'injury' | 'general' | 'breaking'
    tags: text('tags'), // JSON array of tags
    isBreaking: integer('is_breaking', { mode: 'boolean' }).default(false),
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
    authorId: text('author_id').references(() => users.id), // Admin who created it
    authorName: text('author_name'),
    views: integer('views').default(0),
    likes: integer('likes').default(0),
    // Push notification fields
    sendPushNotification: integer('send_push_notification', { mode: 'boolean' }).default(false),
    pushNotificationSent: integer('push_notification_sent', { mode: 'boolean' }).default(false),
    pushNotificationSentAt: integer('push_notification_sent_at', { mode: 'timestamp' }),
    // Admin control
    status: text('status').notNull().default('draft'), // 'draft' | 'published' | 'archived'
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});


// News Relations table (link news to teams, players, competitions)
export const newsRelations = sqliteTable('news_relations', {
    id: text('id').primaryKey(),
    newsId: text('news_id').notNull().references(() => news.id, { onDelete: 'cascade' }),
    relationType: text('relation_type').notNull(), // 'team' | 'player' | 'competition' | 'match'
    relationId: text('relation_id').notNull(), // ID of the related entity
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Transfers table
export const transfers = sqliteTable('transfers', {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull().references(() => players.id),
    fromTeamId: text('from_team_id').references(() => teams.id),
    toTeamId: text('to_team_id').references(() => teams.id),
    transferType: text('transfer_type').notNull(), // 'permanent' | 'loan' | 'free' | 'draft'
    fee: text('fee'), // Transfer fee as string (e.g., "Undisclosed", "$1M")
    status: text('status').notNull().default('rumor'), // 'rumor' | 'confirmed' | 'completed' | 'failed'
    reliability: integer('reliability').default(5), // 1-10 scale for rumors
    source: text('source'), // News source or reporter
    description: text('description'),
    imageUrl: text('image_url'), // URL to transfer announcement image
    // Push notification fields
    sendPushNotification: integer('send_push_notification', { mode: 'boolean' }).default(false),
    pushNotificationSent: integer('push_notification_sent', { mode: 'boolean' }).default(false),
    pushNotificationSentAt: integer('push_notification_sent_at', { mode: 'timestamp' }),
    // Admin control
    createdBy: text('created_by').references(() => users.id), // Admin who created it
    announcedAt: integer('announced_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    season: text('season'), // e.g., "2024/2025"
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
    parentId: text('parent_id'), // For replies
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
    type: text('type').notNull(), // 'string' | 'number' | 'boolean' | 'json'
    category: text('category').notNull(), // 'algorithm' | 'system' | 'features'
    description: text('description'),
    updatedBy: text('updated_by').references(() => users.id), // Admin who updated it
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// System Settings History table (for versioning and audit trail)
export const systemSettingsHistory = sqliteTable('system_settings_history', {
    id: text('id').primaryKey(),
    settingKey: text('setting_key').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value').notNull(),
    updatedBy: text('updated_by').references(() => users.id),
    reason: text('reason'), // Optional reason for the change
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Push Subscriptions table (for Web Push notifications)
export const pushSubscriptions = sqliteTable('push_subscriptions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(), // Public key
    auth: text('auth').notNull(), // Auth secret
    userAgent: text('user_agent'), // Browser/device info
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Match Reminders table (for scheduled match notifications)
export const matchReminders = sqliteTable('match_reminders', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    reminderTime: integer('reminder_time', { mode: 'timestamp' }).notNull(), // When to send the reminder
    minutesBefore: integer('minutes_before').notNull().default(15), // How many minutes before match
    notificationSent: integer('notification_sent', { mode: 'boolean' }).default(false),
    notificationSentAt: integer('notification_sent_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
    players: many(players),
    homeMatches: many(matches, { relationName: 'homeTeam' }),
    awayMatches: many(matches, { relationName: 'awayTeam' }),
    standings: many(standings),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
    team: one(teams, {
        fields: [players.teamId],
        references: [teams.id],
    }),
    events: many(matchEvents),
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

export const competitionsRelations = relations(competitions, ({ one }) => ({
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
}));


// Types
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
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



export const newsRelationsRelations = relations(news, ({ many }) => ({
    relations: many(newsRelations),
    likes: many(newsLikes),
    comments: many(newsComments),
    bookmarks: many(userBookmarks),
}));

export const newsLikesRelations = relations(newsLikes, ({ one }) => ({
    news: one(news, {
        fields: [newsLikes.newsId],
        references: [news.id],
    }),
    user: one(users, {
        fields: [newsLikes.userId],
        references: [users.id],
    }),
}));

export const newsCommentsRelations = relations(newsComments, ({ one }) => ({
    news: one(news, {
        fields: [newsComments.newsId],
        references: [news.id],
    }),
    user: one(users, {
        fields: [newsComments.userId],
        references: [users.id],
    }),
}));

export const userBookmarksRelations = relations(userBookmarks, ({ one }) => ({
    news: one(news, {
        fields: [userBookmarks.newsId],
        references: [news.id],
    }),
    user: one(users, {
        fields: [userBookmarks.userId],
        references: [users.id],
    }),
}));

// Export prediction schemas
export { matchPredictions, predictionLeaderboard, predictionComments } from './schema-predictions';

// Export XI schemas
export { userXI, userXILikes, userXIComments } from './schema-xi';

// Export User Lineups schemas
export { userLineups, userLineupLikes, userLineupComments } from './schema-user-lineups';

// Export Rating schemas
export { playerRatings, ratingHistory } from './schema-ratings';

// Export FPL schemas
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
