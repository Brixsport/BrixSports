// DEAD — no API routes or UI reference this schema.
// Candidate for deletion in BACKLOG-028 backscoping pass.
// Missing imports (players, organizations) cause tsc errors — intentionally not fixed here;
// this file should be deleted, not repaired.

// NESA-specific registration tables
import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// NESA Festival Registrations table
export const nesaRegistrations = sqliteTable('nesa_registrations', {
  id: text('id').primaryKey(),
  playerId: text('player_id').references(() => players.id),
  universityId: text('university_id').references(() => organizations.id),
  economicsDeptId: text('economics_dept_id').references(() => organizations.id),
  
  // Registration details
  registrationType: text('registration_type').notNull(), // 'individual' | 'team'
  sports: text('sports').notNull(), // JSON array of sports
  
  // Verification status
  isEconomicsVerified: integer('is_economics_verified', { mode: 'boolean' }).default(false),
  verificationDocument: text('verification_document'), // Path to student ID/economics proof
  verifiedBy: text('verified_by'),
  verifiedAt: integer('verified_at', { mode: 'timestamp' }),
  
  // Registration status
  status: text('status').default('pending'), // 'pending' | 'verified' | 'approved' | 'rejected'
  rejectionReason: text('rejection_reason'),
  
  // Sport-specific data
  sportDetails: text('sport_details'), // JSON: {football: {...}, basketball: {...}, tracks: [...]}
  
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// NESA Track Event Entries (for 1-per-school rule)
export const nesaTrackEntries = sqliteTable('nesa_track_entries', {
  id: text('id').primaryKey(),
  registrationId: text('registration_id').references(() => nesaRegistrations.id),
  playerId: text('player_id').references(() => players.id),
  universityId: text('university_id').references(() => organizations.id),
  
  event: text('event').notNull(), // '100m' | '200m' | '400m'
  personalBest: text('personal_best'), // Optional PB time
  
  // School-level tracking (1 per school per event)
  isSchoolRepresentative: integer('is_school_representative', { mode: 'boolean' }).default(false),
  
  status: text('status').default('registered'), // 'registered' | 'confirmed' | 'withdrawn'
  
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  // Unique constraint: 1 player per university per event
  uniqueUniversityEvent: unique().on(table.universityId, table.event),
}));

// NESA Esports Entries
export const nesaEsportsEntries = sqliteTable('nesa_esports_entries', {
  id: text('id').primaryKey(),
  registrationId: text('registration_id').references(() => nesaRegistrations.id),
  playerId: text('player_id').references(() => players.id),
  universityId: text('university_id').references(() => organizations.id),
  
  game: text('game').notNull(), // 'FC26' | 'Call_of_Duty' | 'eFootball'
  category: text('category').notNull(), // 'singles' | 'doubles' | 'team'
  gamerTag: text('gamer_tag').notNull(),
  platform: text('platform').notNull(), // 'PS5' | 'Mobile'
  
  // For doubles/team events
  teammates: text('teammates'), // JSON array of teammate IDs
  
  status: text('status').default('registered'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// NESA Team Registrations (for football/basketball)
export const nesaTeamRegistrations = sqliteTable('nesa_team_registrations', {
  id: text('id').primaryKey(),
  universityId: text('university_id').references(() => organizations.id),
  sport: text('sport').notNull(), // 'Football_Male' | 'Football_Female' | 'Basketball_Male'
  
  // Team details
  teamName: text('team_name').notNull(),
  contactPerson: text('contact_person').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone').notNull(),
  
  // Player roster
  registeredPlayers: text('registered_players'), // JSON array of player IDs
  
  // Status
  status: text('status').default('pending'), // 'pending' | 'approved' | 'rejected'
  approvalNotes: text('approval_notes'),
  approvedBy: text('approved_by'),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
