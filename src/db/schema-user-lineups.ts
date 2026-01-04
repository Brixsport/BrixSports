import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { users } from './schema';
import { matches } from './schema';

// User-created lineups (for sharing dream lineups with friends)
export const userLineups = sqliteTable('user_lineups', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g., "My Dream XI", "Best Combined XI"
    description: text('description'),
    formation: text('formation').notNull(),
    teamType: text('team_type').notNull(), // 'home' | 'away' | 'combined'
    sport: text('sport').notNull(), // 'Football' | 'Basketball'
    // Lineup data (stored as JSON)
    starters: text('starters').notNull(), // JSON array of LineupPlayer
    substitutes: text('substitutes'), // JSON array of LineupPlayer
    // Social features
    isPublic: integer('is_public', { mode: 'boolean' }).default(true),
    likesCount: integer('likes_count').default(0),
    sharesCount: integer('shares_count').default(0),
    viewsCount: integer('views_count').default(0),
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User lineup likes
export const userLineupLikes = sqliteTable('user_lineup_likes', {
    id: text('id').primaryKey(),
    lineupId: text('lineup_id').notNull().references(() => userLineups.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User lineup comments
export const userLineupComments = sqliteTable('user_lineup_comments', {
    id: text('id').primaryKey(),
    lineupId: text('lineup_id').notNull().references(() => userLineups.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    parentId: text('parent_id'), // For replies
    likesCount: integer('likes_count').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Relations
export const userLineupsRelations = relations(userLineups, ({ one, many }) => ({
    user: one(users, {
        fields: [userLineups.userId],
        references: [users.id],
    }),
    match: one(matches, {
        fields: [userLineups.matchId],
        references: [matches.id],
    }),
    likes: many(userLineupLikes),
    comments: many(userLineupComments),
}));

export const userLineupLikesRelations = relations(userLineupLikes, ({ one }) => ({
    lineup: one(userLineups, {
        fields: [userLineupLikes.lineupId],
        references: [userLineups.id],
    }),
    user: one(users, {
        fields: [userLineupLikes.userId],
        references: [users.id],
    }),
}));

export const userLineupCommentsRelations = relations(userLineupComments, ({ one }) => ({
    lineup: one(userLineups, {
        fields: [userLineupComments.lineupId],
        references: [userLineups.id],
    }),
    user: one(users, {
        fields: [userLineupComments.userId],
        references: [users.id],
    }),
}));

// Types
export type UserLineup = typeof userLineups.$inferSelect;
export type NewUserLineup = typeof userLineups.$inferInsert;
export type UserLineupLike = typeof userLineupLikes.$inferSelect;
export type NewUserLineupLike = typeof userLineupLikes.$inferInsert;
export type UserLineupComment = typeof userLineupComments.$inferSelect;
export type NewUserLineupComment = typeof userLineupComments.$inferInsert;
