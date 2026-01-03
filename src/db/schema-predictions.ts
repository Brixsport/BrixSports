import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users, matches } from './schema';

// Match Predictions table
export const matchPredictions = sqliteTable('match_predictions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    predictedHomeScore: integer('predicted_home_score').notNull(),
    predictedAwayScore: integer('predicted_away_score').notNull(),
    predictedWinner: text('predicted_winner'), // 'home', 'away', 'draw'
    confidence: integer('confidence').default(50), // 0-100
    points: integer('points').default(0), // Points earned if correct
    isCorrect: integer('is_correct', { mode: 'boolean' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Prediction Leaderboard table
export const predictionLeaderboard = sqliteTable('prediction_leaderboard', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    totalPredictions: integer('total_predictions').default(0),
    correctPredictions: integer('correct_predictions').default(0),
    totalPoints: integer('total_points').default(0),
    accuracy: integer('accuracy').default(0), // Percentage
    rank: integer('rank'),
    streak: integer('streak').default(0), // Current winning streak
    longestStreak: integer('longest_streak').default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Prediction Comments table
export const predictionComments = sqliteTable('prediction_comments', {
    id: text('id').primaryKey(),
    predictionId: text('prediction_id').notNull().references(() => matchPredictions.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    userName: text('user_name').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
