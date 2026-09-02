import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './schema';

// User XI (Team Builder) table
export const userXI = sqliteTable('user_xi', {
    id: text('id').primaryKey(),
    // BACKLOG-324: nullable -- an anonymous save (see anonymousId below) has no
    // real users row. Exactly one of userId/anonymousId is set; enforced in
    // application code (src/app/api/user/xi/route.ts), not a DB constraint.
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    // Opaque id derived from a server-signed, httpOnly anonymous-identity cookie
    // (src/lib/anonymousIdentity.ts) -- never client-passed. Null for saves owned
    // by a real logged-in user.
    anonymousId: text('anonymous_id'),
    name: text('name').notNull(), // Team name
    formation: text('formation').notNull(), // e.g., "4-3-3", "4-4-2"
    players: text('players').notNull(), // JSON array of player IDs with positions
    isPublic: integer('is_public', { mode: 'boolean' }).default(false),
    likes: integer('likes').default(0),
    views: integer('views').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User XI Likes table
export const userXILikes = sqliteTable('user_xi_likes', {
    id: text('id').primaryKey(),
    xiId: text('xi_id').notNull().references(() => userXI.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// User XI Comments table
export const userXIComments = sqliteTable('user_xi_comments', {
    id: text('id').primaryKey(),
    xiId: text('xi_id').notNull().references(() => userXI.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    userName: text('user_name').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
