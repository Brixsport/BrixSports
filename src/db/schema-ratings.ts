import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Player Ratings Table
export const playerRatings = sqliteTable('player_ratings', {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => teams.id),

    // Auto-calculated rating during match
    autoRating: real('auto_rating').default(6.0).notNull(),

    // Final rating after logger adjustment
    finalRating: real('final_rating'),

    // Adjustment details
    adjustedBy: text('adjusted_by'), // Logger ID who adjusted
    adjustmentNotes: text('adjustment_notes'),
    adjustmentTime: integer('adjustment_time', { mode: 'timestamp' }),

    // Man of the Match
    isMotM: integer('is_motm', { mode: 'boolean' }).default(false),

    // Rating breakdown (for transparency)
    ratingBreakdown: text('rating_breakdown', { mode: 'json' }).$type<{
        goals: number;
        assists: number;
        eyePoints: number;
        cards: number;
        shots: number;
        fouls: number;
        positionBonus: number;
    }>(),

    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

// Rating History (track changes over time during match)
export const ratingHistory = sqliteTable('rating_history', {
    id: text('id').primaryKey(),
    ratingId: text('rating_id').notNull().references(() => playerRatings.id, { onDelete: 'cascade' }),
    rating: real('rating').notNull(),
    minute: integer('minute').notNull(), // Match minute when rating changed
    reason: text('reason'), // What caused the change (e.g., "Goal scored")
    timestamp: integer('timestamp', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

// Import matches and players tables
import { matches } from './schema';
import { players } from './schema';
import { teams } from './schema';
