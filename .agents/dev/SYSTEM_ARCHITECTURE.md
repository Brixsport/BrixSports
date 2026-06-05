# BrixSports — System Architecture
> Audit Date: 2026-06-05 | Auditor: Antigravity

---

## STEP 1 — Repository Map

### Top-Level Directories

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js App Router pages and API routes |
| `src/components/` | Shared React components (admin, lineup, notifications, etc.) |
| `src/db/` | Drizzle schema, seed scripts, migration utilities, one-off DB scripts |
| `src/lib/` | Business logic, auth, socket, services, utilities |
| `scripts/` | CLI scripts for DB management and data backfill |
| `public/` | Static assets (icons, images, manifest) |
| `ws-server/` | Standalone Socket.IO WebSocket server (deployed to Railway) |
| `dev/` | Developer artifacts — test scripts, query files |
| `.agents/` | Claude Code rules, backlog, and audit files |
| `drizzle/` | Drizzle ORM migration snapshots |
| `migrations/` | Raw migration SQL files |
| `data/` | Static data files (team/player imports) |
| `notes/` | Ad-hoc dev notes |

### src/app/ — All Pages and API Routes

**Admin Pages**
- `/admin` — Dashboard with match/team/logger stats
- `/admin/matches` — Full match management (CRUD, approval)
- `/admin/players` — Player management
- `/admin/teams` — Team management (inferred, not listed)
- `/admin/competitions` — Competition management (two versions: page.tsx, page-enhanced.tsx)
- `/admin/competitions/page-enhanced.tsx` — Enhanced competition view (orphaned draft)
- `/admin/organizations` — Organization hierarchy management
- `/admin/loggers` — Logger management and assignment
- `/admin/access` — Access/role management
- `/admin/transfers` — Transfer records management
- `/admin/news` — News/articles management
- `/admin/advertisements` — Ad management
- `/admin/notifications` — Push notification management
- `/admin/infrastructure` — System infrastructure overview
- `/admin/settings` — System settings
- `/admin/match-lineups` — Lineup editor
- `/admin/match-ratings` — Player rating adjustments
- `/admin/bulk-register` — Bulk team/player registration
- `/admin/track-events` — Track & field event logging
- `/admin/manager` — Manager center
- `/admin/push-diagnose` — Push notification diagnostics
- `/admin/livestreams` — Livestream management

**Public Pages**
- `/` — Home (live matches, featured)
- `/live` — Live match center
- `/football` — Football hub
- `/basketball` — Basketball hub
- `/competitions` — Competition listing
- `/matches/[id]` — Match detail page
- `/match/[id]` — Match detail (duplicate route — needs audit)
- `/players/[id]` — Player profile
- `/players/compare` — Player comparison tool
- `/teams/[id]` — Team profile
- `/teams` — Teams listing
- `/stats` — Stats leaderboards
- `/news` — News listing
- `/news/[slug]` — News article
- `/transfers` — Transfer news
- `/lineups` — Lineup gallery
- `/livestream/[id]` — Livestream viewer
- `/predictions` — Match predictions
- `/search` — Global search
- `/profile` — User profile
- `/profile/favorites` — User favorites
- `/profile/settings` — User settings
- `/dashboard` — User dashboard
- `/notifications` — User notifications
- `/favourites` — User favourites
- `/login`, `/signup`, `/forgot-password`, `/reset-password` — Auth pages
- `/auth/signin` — NextAuth sign-in page
- `/scouts` — Scout view
- `/xi` — User XI builder
- `/xi/gallery` — XI gallery
- `/draft` — Draft page
- `/fpl` — Fantasy league hub
- `/fpl/create-team`, `/fpl/leagues`, `/fpl/team`, `/fpl/transfers` — FPL sub-pages
- `/analytics/loggers` — Logger analytics
- `/about`, `/docs` — Info pages
- `/nesa-registration` — NESA external registration
- `/user/[userId]` — Public user profile
- `/offline` — PWA offline page

**API Routes (full list in Step 9)**

### src/components/ — Component Files
See full list from filesystem scan. Key groupings:
- Admin UI: `AdminDashboardLayout`, `AdminSidebar`, `Toast`, `ConfirmDialog`, `SkeletonLoader`, `ErrorBoundary`
- Logger UI: `FootballLogger`, `BasketballLogger`, `TrackLogger`, `MatchLoggerUI`
- Live: `LiveMatchCard`, `LiveMatchStatus`, `LiveMatchSummary`, `LiveMatchTimeline`, `LiveUpdates`
- Lineup: `lineup/` subfolder — 9 components
- Notifications: `notifications/` subfolder — 3 components
- Livestream: `livestream/` subfolder — 4 components
- Stats: `StandingsGrid`, `StandingsFilters`, `PlayerStatsModal`, `TeamStatsChart`, `TopPlayers`
- Auth: `auth/AuthModal`, `auth/AuthWrapper`
- Predictions: `predictions/` subfolder — 3 components
- Ads: `ads/AdBanner`
- Blog: `blog/` subfolder — 4 components

### src/db/ — Files
- `schema.ts` — Main Drizzle schema (all production tables)
- `schema-enhanced.ts` — Extended schema variant
- `schema-fpl.ts` — Fantasy league tables
- `schema-nesa-registrations.ts` — NESA registration tables
- `schema-predictions.ts` — Prediction/leaderboard tables
- `schema-ratings.ts` — Player ratings tables
- `schema-user-lineups.ts` — User lineup tables
- `schema-xi.ts` — User XI tables
- `index.ts` — DB client initialization
- `migrations/` — Migration scripts (5 files)
- `utils/player-profile.ts` — Player profile utilities
- Many `seed-*.ts` and `add-*.ts` scripts for data seeding
- `check-*.ts` and `analyze-*.ts` scripts for data verification

### src/lib/ — Files
- `auth.ts` — JWT verification, `getAuthUser`, `generateToken`
- `cloudinary.ts` — Cloudinary upload helpers
- `email.ts` — Email sending via AWS SES / Nodemailer / Resend
- `socket.ts` — Socket.IO broadcast helpers (local + remote WS server)
- `eventValidation.ts` — Match event validation
- `match-logger-helpers.ts` — Logger-specific match utilities
- `match-state-manager.ts` — Match state lifecycle
- `multiLogger.ts` — Multi-logger coordination
- `ratingCalculator.ts` — Player rating calculation
- `sessionStore.ts` — Session management
- `player-data.ts` — Player enrichment/affiliation utilities
- `player-affiliation-utils.ts` — Affiliation resolution helpers
- `offline-queue.ts` / `offline/queue-manager.ts` / `offline/sync-manager.ts` — Offline event queue for PWA
- `notifications/` — Push notification services
- `services/rating-calculator.ts` — Rating service
- `services/substitution-manager.ts` — Substitution validation
- `services/team-stats-calculator.ts` — Team stats aggregation
- `utils/` — 9 utility modules (SEO, formatting, FPL points, etc.)

### scripts/ — Files
- `migrate-matches.ts` — Update competition names
- `backfill-past-matches.ts` — Backfill historical match data
- `assign-match.ts` — Assign logger to match
- `list-users.ts` — List all users
- `list-competitions.ts` — List competitions
- `check-teams.ts`, `check-busa.ts` — Team/competition verification
- `manage-competitions.ts` — Competition management CLI
- `correct-competitions.ts` — Fix competition data
- `cleanup-duplicates.ts` — Remove duplicate records
- `update-busa.ts`, `update-npuga-details.ts` — Specific data fixes
- `add-upcoming-competitions.ts` — Add new competitions
- `create-intercollege-teams.ts` — Create intercollege team records
- `db-audit-query.ts` — DB audit script (created in this audit)

---

## STEP 2 — Tech Stack Fingerprint

### package.json Analysis

| Category | Package | Version | Pinned? |
|----------|---------|---------|---------|
| Framework | `next` | 15.3.8 | YES (exact) |
| React | `react`, `react-dom` | ^19.0.0 | NO — uses ^ |
| Database ORM | `drizzle-orm` | ^0.44.7 | NO |
| DB Client | `@libsql/client` | ^0.15.15 | NO |
| DB Type | LibSQL (SQLite-compatible) | — | — |
| DB Hosting | Turso (remote) / local.db (dev) | — | — |
| Auth Library | `jsonwebtoken` | ^9.0.3 | NO |
| Auth 2 | `jose` | ^6.1.3 | NO |
| Auth 3 | `next-auth` | ^4.24.13 | NO (also installed — potentially conflicting) |
| Passwords | `bcryptjs` | ^3.0.3 | NO |
| Real-time | `socket.io` | ^4.8.1 | NO |
| Real-time Client | `socket.io-client` | ^4.8.3 | NO |
| Media Storage | `cloudinary` | ^2.8.0 | NO |
| Media 2 | `next-cloudinary` | ^6.17.5 | NO |
| Error Monitoring | `@sentry/*` | NOT FOUND in package.json | — |
| Styling | `tailwindcss` | ^4 | NO |
| ID Generation | `nanoid` | ^5.1.6 | NO |
| Date Utilities | `date-fns` | ^4.1.0 | NO |
| Validation | `zod` | ^4.1.2 | NO |
| Email (AWS) | `@aws-sdk/client-ses` | 3.1029.0 | YES (one exact) |
| Email (2) | `resend` | ^6.10.0 | NO |
| Email (3) | `nodemailer` | ^7.0.13 | NO |
| Push Notifications | `web-push` | ^3.6.7 | NO |
| Payments | `stripe` | ^19.2.0 | NO (in deps but out of scope) |
| Rich Text | `@tiptap/*` | ^3.14.x | NO |
| Charts | `recharts` | ^3.0.2 | NO |
| Animation | `framer-motion` | ^12.23.24 | NO |
| 3D | `three`, `@react-three/fiber` | ^0.183.2 | NO |
| Tables | `xlsx` | 0.18.5 | YES (exact) |
| Form | `react-hook-form` | ^7.60.0 | NO |
| UI Components | `@radix-ui/*` | ^1.x-^2.x | NO (all ^ unpinned) |
| Toast | `sonner` | ^2.0.6 | NO |
| Dev Tooling | `tsx`, `typescript`, `eslint` | — | — |

**FLAG: Sentry not found in package.json** — CLAUDE.md and project.md claim Sentry is configured but the package is absent. Either it was removed or it's imported via a CDN (not the npm SDK). This is a monitoring gap.

**FLAG: next-auth AND custom JWT both installed** — Two auth systems present (`next-auth@4.24.13` and custom `jose`/`jsonwebtoken`). The custom JWT system is what's actively used. `next-auth` may be vestigial.

**FLAG: Three email providers installed** — `@aws-sdk/client-ses`, `resend`, and `nodemailer` all present. Unclear which is active.

**FLAG: stripe present** — Payment library installed but payments are explicitly out of scope.

**Unpinned production dependencies (^ prefix):** react, react-dom, drizzle-orm, @libsql/client, jsonwebtoken, jose, next-auth, bcryptjs, socket.io, socket.io-client, cloudinary, next-cloudinary, zod, date-fns, nanoid, ALL @radix-ui/* components, framer-motion, recharts, sonner, web-push, resend, nodemailer, and 30+ others. Only `@aws-sdk/client-ses` (3.1029.0) and `xlsx` (0.18.5) and `csv-parse` (6.2.1) are exact.

---

## STEP 3 — Full Database Schema

### Tables in Production

**Core Domain Entities**

| Table | Purpose |
|-------|---------|
| `organizations` | Hierarchy of universities, colleges, departments |
| `teams` | Sports teams owned by organizations |
| `players` | Individual players (multi-sport, multi-team capable) |
| `competitions` | Competitions/leagues/tournaments |
| `matches` | Individual match records |
| `match_events` | Goals, cards, substitutions, and other events during a match |
| `loggers` | Dedicated match logger accounts |
| `standings` | Team standings per competition |
| `users` | Public user accounts |

**Join / Bridge Tables**

| Table | Purpose |
|-------|---------|
| `player_team_affiliations` | Many-to-many: players ↔ teams (replaces direct teamId) |
| `player_organization_affiliations` | Many-to-many: players ↔ organizations |
| `competition_team_entries` | Teams entered in competitions, with group assignment |
| `match_logger_assignments` | Loggers assigned to matches |
| `squad_players` | Players selected into a competition squad |
| `user_favorites` | User-to-entity favorites |
| `user_follows` | User-to-entity follows |
| `user_bookmarks` | User-to-news bookmarks |
| `news_relations` | News-to-entity relationships |
| `poll_votes` | User votes on polls |
| `poll_comment_likes` | Likes on poll comments |
| `news_likes` | Likes on news articles |

**Stats Tables**

| Table | Purpose |
|-------|---------|
| `player_stats` | General player stats per competition (goals, appearances, etc.) |
| `football_player_stats` | Detailed football stats per player |
| `basketball_player_stats` | Detailed basketball stats per player |
| `individual_sport_stats` | Stats for Chess/Scrabble/Table Tennis |
| `team_form` | Per-match form records for teams |
| `head_to_head` | Head-to-head aggregate records between two teams |
| `player_ratings` | Live match player ratings |
| `rating_history` | Historical rating changes |

**Feature Tables**

| Table | Purpose |
|-------|---------|
| `news` | News/article content |
| `news_comments` | Comments on news |
| `polls` | Match-linked polls |
| `poll_comments` | Comments on polls |
| `transfers` | Player transfer records |
| `advertisements` | Ad management records |
| `push_subscriptions` | VAPID push subscription endpoints |
| `match_reminders` | Scheduled push reminders for matches |
| `staff_comms` | Staff/admin notes on matches |
| `bracket_nodes` | Knockout bracket structure |
| `team_registrations` | External team registration requests |
| `registered_players` | Players registered via bulk registration |
| `password_reset_tokens` | Password reset tokens |
| `system_settings` | Key-value system configuration |
| `system_settings_history` | Audit log for settings changes |
| `user_preferences` | Per-user settings |
| `user_activity` | User activity audit log |
| `logger_sessions` | Logger session tracking |
| `competition_sport_settings` | Per-sport settings for multi-sport competitions |
| `prediction_leaderboard` | Match prediction leaderboard |
| `match_predictions` | Individual match predictions |
| `prediction_comments` | Comments on predictions |

**FPL / Fantasy Tables (all empty in DB)**
`fpl_gameweeks`, `fpl_player_data`, `fpl_player_gameweek_stats`, `fpl_teams`, `fpl_team_selections`, `fpl_transfers`, `fpl_leagues`, `fpl_league_members`, `fpl_h2h_fixtures`, `fpl_dream_team`, `fpl_achievements`

**User Content Tables**
`user_lineups`, `user_lineup_likes`, `user_lineup_comments`, `user_xi`, `user_xi_likes`, `user_xi_comments`

### Column Details (Core Tables)

**organizations**
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text PK | NO | — |
| name | text | NO | — |
| slug | text UNIQUE | NO | — |
| type | text | NO | 'organization' |
| short_name | text | YES | — |
| display_name | text | YES | — |
| parent_organization_id | text FK→organizations | YES | — |
| is_internal_unit | integer (boolean) | YES | false |
| status | text | YES | 'active' |
| location | text | YES | — |
| metadata | text (JSON) | YES | — |
| created_at | integer (timestamp) | YES | now() |
| updated_at | integer (timestamp) | YES | now() |

**teams**
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text PK | NO | — |
| name | text | NO | — |
| short_name | text | NO | — |
| logo | text | NO | — |
| university | text | NO | — |
| owner_organization_id | text FK→organizations | YES | — |
| color | text | NO | — |
| sport | text | NO | 'Football' |
| gender | text | YES | 'male' |
| played/won/drawn/lost/goals_for/goals_against/points | integer | YES | 0 |
| created_at | integer | YES | now() |

**players**
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text PK | NO | — |
| name | text | NO | — |
| jersey_name | text | YES | — |
| number | integer | NO | 0 |
| team_id | text FK→teams | YES | — (now optional, use affiliations) |
| position | text | NO | — |
| rating | real | YES | 7.0 |
| college | text | YES | — |
| university | text | NO | 'Unknown' |
| is_external | integer (boolean) | YES | false |
| profile_id | text | YES | — (cross-sport linking) |
| attributes | text (JSON) | YES | — |
| created_at | integer | YES | now() |

**competitions**
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text PK | NO | — |
| name | text | NO | — |
| sport | text | YES | — |
| is_multi_sport | integer (boolean) | YES | false |
| format | text | NO | — |
| season | text | NO | — |
| start_date / end_date | integer (timestamp) | YES | — |
| level | text | YES | — |
| status | text | YES | 'upcoming' |
| winner_id / runner_up_id / third_place_id | text FK→teams | YES | — |
| host_organization_id / governing_organization_id | text FK→organizations | YES | — |
| is_archived | integer (boolean) | YES | false |
| created_at / updated_at | integer | YES | now() |

**matches**
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text PK | NO | — |
| sport | text | NO | — |
| home_team_id / away_team_id | text FK→teams | NO | — |
| home_score / away_score | integer | YES | 0 |
| status | text | NO | 'UPCOMING' |
| start_time | text | NO | — |
| venue | text | NO | — |
| competition | text | NO | — (denormalized string) |
| competition_id | text FK→competitions | YES | — |
| logger_id | text | YES | — (legacy, use match_logger_assignments) |
| approval_status | text | YES | 'PENDING' |
| approved_by | text FK→users | YES | — |
| lineups / stats | text (JSON) | YES | — |
| created_at / updated_at | integer | YES | now() |

**match_events**
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | text PK | NO | — |
| match_id | text FK→matches | NO | — |
| type | text | NO | — |
| minute | integer | NO | — |
| second | integer | YES | — |
| team_id | text FK→teams | YES | — |
| player_id | text FK→players | YES | — |
| related_player_id | text FK→players | YES | — |
| detail / value | text | YES | — |
| is_eye_point | integer (boolean) | YES | false |
| logger_id | text FK→loggers | YES | — |
| created_at | integer | YES | now() |

### Relationship Tree (FK Hierarchy)

```
organizations
  ├── parent_organization_id → organizations.id (self-referential)
  └── [owns] → teams.owner_organization_id

teams
  └── [players via] player_team_affiliations.team_id

players
  ├── team_id → teams.id (legacy, optional)
  ├── [affiliations] → player_team_affiliations.player_id
  └── [org affiliations] → player_organization_affiliations.player_id

competitions
  ├── host_organization_id → organizations.id
  ├── governing_organization_id → organizations.id
  ├── winner_id / runner_up_id / third_place_id → teams.id
  ├── [teams] → competition_team_entries.competition_id
  └── [sport settings] → competition_sport_settings.competition_id

matches
  ├── home_team_id / away_team_id → teams.id
  ├── competition_id → competitions.id
  ├── approved_by → users.id
  ├── [events] → match_events.match_id
  └── [loggers] → match_logger_assignments.match_id

match_events
  ├── match_id → matches.id
  ├── team_id → teams.id
  ├── player_id → players.id
  ├── related_player_id → players.id
  └── logger_id → loggers.id

standings
  ├── team_id → teams.id
  └── competition_id → competitions.id

users
  └── favorite_team_id → teams.id
```

---

## STEP 4 — Live Database State

**Database:** Turso remote + local.db (local.db queried during audit)
**Connection pattern:** `createClient({ url: TURSO_CONNECTION_URL || 'file:./local.db', authToken: TURSO_AUTH_TOKEN })`

### Row Counts (all tables)

| Table | Rows |
|-------|------|
| organizations | 172 |
| teams | 236 |
| players | 179 |
| player_team_affiliations | 179 |
| player_organization_affiliations | 315 |
| competitions | 3 |
| matches | 59 |
| match_events | 154 |
| match_logger_assignments | 2 |
| standings | 22 |
| loggers | 6 |
| users | 18 |
| player_stats | 65 |
| football_player_stats | 31 |
| news | 2 |
| news_relations | 10 |
| transfers | 6 |
| advertisements | 1 |
| system_settings | 12 |
| push_subscriptions | 3 |
| player_ratings | 22 |
| user_favorites | 34 |
| user_preferences | 7 |
| prediction_leaderboard | 3 |
| All FPL tables | 0 (empty) |
| basketball_player_stats | 0 |
| individual_sport_stats | 0 |
| bracket_nodes | 0 |
| team_form | 0 |
| head_to_head | 0 |
| squad_players | 0 |

### Competitions (3 total)
| ID | Name | Sport | Status | Level |
|----|------|-------|--------|-------|
| 9q8LMVqW8KAtF4BJBlyk_ | BUSALYMPICS | Football | completed | college |
| xm1OcBFeugKxLDHH6Xi6p | BUSA LEAGUE FOOTBALL | Football | completed | busa-league |
| m-4qhMBvnUP2a-GcU-Rsv | BUSA LEAGUE BASKETBALL | Basketball | completed | null |

**OBSERVATION:** Only 3 competitions in DB. All marked `completed`. No active or upcoming competitions. System appears to be in a post-season state.

### Recent Matches (last 20)
All 59 matches are FINISHED / APPROVED or PENDING approval. No LIVE or UPCOMING matches. All from BUSA League Football fixtures.

### Event Types Distribution (154 events)
| Type | Count |
|------|-------|
| Interception | 36 |
| Clearance | 20 |
| Throw In | 14 |
| Free Kick | 14 |
| Shot off Target | 10 |
| Substitution | 9 |
| Foul | 9 |
| Catch | 7 |
| Corner | 6 |
| Save | 5 |
| **Goal** | **5** |
| Block | 5 |
| Shot on Target | 4 |
| Shot | 4 |
| Offside | 3 |
| Goal Kick | 2 |
| Tackle | 1 |

**NOTE:** Event types use PascalCase (`Goal`, `Save`, `Block`). The rating calculator references suggest possible UPPERCASE mismatches for `SAVE`/`BLOCK`/`GOAL` — confirmed in BACKLOG as a known bug.

### Intercollege Teams
| Short Name | Name | Owner Org |
|------------|------|-----------|
| CNAS | College of Natural & Applied Sciences | null |
| CENG | College of Engineering | null |
| CMANS | College of Management Sciences | null |
| CENVS | College of Environmental Sciences | null |

**NOTE:** All 4 intercollege teams have `owner_organization_id = null`. They are not linked to their organization records.

### Player Stats Summary
- 65 player_stats rows
- 718 total goals
- 133 total appearances

**ANOMALY:** 718 goals across 133 appearances is implausibly high (avg ~5.4 goals per appearance). This strongly suggests stats data is corrupted or inflated from multiple backfill runs or a counting error.

### Users (18 total)
- 1 `admin` role user: `admin@brixsport.com` (ID: `admin-001`)
- 2 `logger` role users
- 15 `user` role accounts (real user emails visible)

---

## STEP 5 — Business Domain Model

### 1. ORGANIZATIONS HIERARCHY

Organizations represent the institutional layer. Types:
- `university` — Top-level institution (e.g., Bells University of Technology)
- `college` — Faculty within a university (e.g., COLENG, COLNAS)
- `department` — Sub-unit within a college
- `organization` — Generic (default fallback type)

**Ownership chain:**
```
Organization (university)
  └── Organization (college, parentOrganizationId → university.id)
        └── Organization (department, parentOrganizationId → college.id)
              └── Team (ownerOrganizationId → organization.id)
```

**How to create a new college team from scratch:**
1. Ensure university org exists in `organizations`
2. Create college org: `type='college'`, `parentOrganizationId = university.id`
3. Create team row: set `ownerOrganizationId = college.id`, set `sport`, `name`, `shortName`, `university`
4. Add players via `players` table with `teamId = team.id` (legacy) or via `player_team_affiliations`
5. Add `playerTeamAffiliations` rows linking each player to the team
6. Optionally add `playerOrganizationAffiliations` linking each player to their college org

**Current state:** The 4 intercollege teams have `ownerOrganizationId = null` — not linked to their college organizations. The organizations table has duplicate college entries (e.g., `COLMANS` appears as both `org_org_bells-university-colmans` and `kEpOHOZMpUMIVOIiHQyOc`).

### 2. COMPETITIONS LIFECYCLE

States: `upcoming` → `ongoing` → `completed` (also `active` used in some places)

- Teams are registered via `competition_team_entries` (bridge table)
- Group assignment is nullable until group draw is complete (`groupDrawComplete` flag)
- `standings` table is updated after each match (via backfill or live logging post-match logic)
- `approvalStatus` on matches: `PENDING` → `APPROVED` — admin must approve before match data is public
- No automated triggers for standings updates — they are written explicitly by the backfill route or logger route

**MISSING:** No event-driven standings recalculation. Standings must be manually triggered or computed at backfill time.

### 3. MATCH LIFECYCLE

States: `UPCOMING` → `LIVE` → `HALF_TIME` → `LIVE` → `FINISHED`

Roles involved:
- Admin creates match, sets teams, assigns logger
- Logger receives match assignment, logs events via `/logger` page
- Admin approves the match (`approvalStatus: APPROVED`)
- Public viewers see the match on `/live` and `/matches/[id]`

Logger assignment flow:
1. Admin calls `POST /api/matches/[id]/assign-logger` with `loggerId`
2. A row is inserted into `match_logger_assignments`
3. Logger logs in at `/api/loggers/auth` with email/password (separate from user auth)
4. Logger uses `FootballLogger` / `BasketballLogger` component
5. Events are posted to `POST /api/events`
6. Score updates are broadcast via Socket.IO

**KNOWN RACE CONDITION (BUG-008):** Logger assignment does not use a transaction — duplicate loggers can be inserted.

### 4. STATS PIPELINE

- `player_stats` rows are written by the backfill route (`POST /api/matches/backfill`)
- Live match events do NOT automatically update `player_stats` — they update `playerRatings` (in-match) but `player_stats` requires a backfill or explicit post-match update
- `standings` are written by the backfill route and by the match status change handlers
- `football_player_stats` (detailed) appears to be populated by separate seed/import scripts, not live logging
- **Known casing bugs:** Event type `'Save'` (PascalCase in DB) vs `'SAVE'` (UPPERCASE in rating calculator) — mismatch means save events don't trigger rating bonuses. Same for `'Block'`/`'BLOCK'` and `'Goal'`/`'GOAL'`
- No real-time stats materialization — all stats are either pre-seeded or backfill-written

### 5. AUTH & ROLES

**Roles in system:** `admin`, `logger`, `user` (also `scout` normalized to `user`)

**Permissions:**
- `admin` — full access to all admin API routes (when correctly enforced)
- `logger` — access to logger dashboard and event logging API
- `user` — access to user profile, favorites, notifications
- unauthenticated — access to all public read endpoints

**JWT implementation:**
- `jsonwebtoken` library (not `jose` for signing — jose is imported but may not be the active signer)
- Token stored in `authToken` cookie OR `Authorization: Bearer` header
- `getAuthUser(request)` function: verifies JWT → queries DB for user → returns full user object
- Token expiry: 7 days
- Default JWT secret fallback: `'your-secret-key-change-in-production'` — if `JWT_SECRET` env var missing, this insecure default is used

**Middleware protection:**
- `src/middleware.ts` has a matcher that includes `/api/admin/*` routes
- **BUG-001:** Internal handler check only matches `/admin` (not `/api/admin`) — middleware bypass confirmed

**Logger auth is separate from user auth:**
- Loggers authenticate via `POST /api/loggers/auth` with email + bcrypt password
- Logger sessions tracked in `logger_sessions` table (0 rows in DB — unused or not persisted)

### 6. REAL-TIME ARCHITECTURE

**WebSocket server:** Standalone Socket.IO server in `ws-server/` directory, deployed to Railway.

**Local dev:** `server.js` runs a custom HTTP server that mounts the Socket.IO instance directly. `global.io` is used for same-process broadcasting.

**Production (Vercel):** Serverless — no persistent Socket.IO. Events broadcast via HTTP POST to the Railway WS server at `NEXT_PUBLIC_WS_URL/broadcast` with `x-api-key` auth.

**Events emitted:**
- `event:new` — new match event (goal, card, etc.)
- `match:score:updated` — score change
- `match:status:changed` — status transition
- `rating:updated` — player rating change
- `stats:updated` — team stats change
- `event:deleted` — event removed

**Public livescore subscription:**
- Client connects to the WS server via socket.io-client
- Joins room `match:{matchId}`
- Listens for `match:score:updated` and `event:new`
- **Known issue:** `NEXT_PUBLIC_WS_URL` vs `WS_SERVER_URL` env var — the broadcast function reads both but the client-side socket connection likely needs the `NEXT_PUBLIC_` version. Mismatch can cause silent failures in production.

**Fallback on WS failure:** If broadcast fails (catch block in `socket.ts`), a console warning is logged but the API response still succeeds. Public page refreshes every 30s as a fallback (in `/live/page.tsx`).

---

## STEP 6 — Critical Flow Traces

### FLOW A — Create a Match (Admin)

1. Admin on `/admin/matches` page fills the match creation form
2. `POST /api/matches` is called (no auth check in this public route — **BUG**)
3. Handler validates: competition coerced to null if empty, stats/lineups serialized as JSON
4. Inserts into `matches` table with `status='UPCOMING'`, `approvalStatus='PENDING'`
5. Returns the created match object
6. Admin then assigns a logger via `POST /api/matches/[id]/assign-logger`
7. Match appears on `/api/matches` (public) immediately, but approval gating on public display depends on client-side filtering

**ISSUE:** `POST /api/matches` has no `getAuthUser` check — any unauthenticated request can create a match. Admin page uses cookies but the API doesn't enforce it.

### FLOW B — Log a Goal Event (Logger Live)

1. Logger on `/logger` page, `FootballLogger` component loaded
2. Logger presses "Goal" button → component calls `POST /api/events`
3. `/api/events` POST handler:
   - Validates required fields (matchId, type, minute)
   - NOTE: No auth check confirmed in the first 80 lines — the BACKLOG notes AUDIT-001 as resolved but the code above shows no auth check visible in the POST handler shown
   - Inserts event into `match_events`
   - Calculates player rating update via `RatingCalculator`
   - Updates `players.rating` in DB
   - Calls `broadcastMatchEvent` and `broadcastScoreUpdate` via `socket.ts`
4. `socket.ts` broadcasts to Railway WS server or local `global.io`
5. Public `/matches/[id]` page receives the event via socket, updates score display

**CASING BUG:** If type is `'Goal'` (PascalCase from FootballLogger), but rating calculator checks for `'GOAL'`, the rating increment is skipped silently.

### FLOW C — Public Livescore Page Load

1. Viewer opens `/live` — this is a `'use client'` component (CSR only)
2. `useEffect` on mount: `GET /api/matches` — returns all matches with limit 50
3. Client filters for `status === 'LIVE'` matches
4. **BUG-007:** `assignedLoggers` with real emails is included in response (NDPR violation)
5. Page polls every 30 seconds (`setInterval`)
6. For real-time: `LiveUpdates` component connects to WS server via socket.io-client
7. Score updates received over socket; no fallback to HTTP if socket drops (just the 30s poll)

**ISSUE:** No SSR — `/live` page returns empty for crawlers and initial load flashes. User sees spinner until data loads.

### FLOW D — Backfill a Past Match

1. Admin uses the backfill UI or calls `POST /api/matches/backfill`
2. Handler: `getAuthUser` + role check (correctly enforced — this route is properly protected)
3. Validates match data and player rows
4. Checks for existing match with same `homeTeamId`, `awayTeamId`, `startTime` (unless `forceInsert: true`)
5. Inserts match into `matches` with `status='FINISHED'`, `approvalStatus='APPROVED'`
6. Inserts `matchEvents` rows for each player event
7. Inserts/updates `player_stats` rows per player
8. Updates `standings` for both teams
9. Returns created match ID and stats summary

### FLOW E — Leaderboard Loads

1. `/stats` page fetches `GET /api/players/stats/leaders?sport=Football&type=goals`
2. Handler queries `player_stats` table aggregated by `playerId`
3. Returns top N players with their stats
4. **BUG:** Stats anomaly noted — 718 total goals across 65 rows. Leaderboard may show inflated numbers.

---

## STEP 7 — Admin Pages Inventory

| Route | Title | Status | Purpose | Issues |
|-------|-------|--------|---------|--------|
| `/admin` | Dashboard | ✅ Working | Overview stats — matches, teams, loggers | Fetches from unauthenticated public APIs |
| `/admin/matches` | Match Management | ✅ Working | Create/edit/delete matches, assign loggers, backfill | POST /api/matches has no auth check |
| `/admin/players` | Player Management | ✅ Working | CRUD players, view stats | Unbounded queries (BUG-005) |
| `/admin/competitions` | Competition Management | ✅ Working | Create/edit competitions | startDate/endDate PATCH crash risk (BACKLOG-003) |
| `/admin/competitions/page-enhanced.tsx` | Enhanced Competitions | 🔲 Stub | Draft enhanced view — not linked to any route | Orphaned file |
| `/admin/organizations` | Organization Management | ⚠️ Partial | View/manage org hierarchy | Limited CRUD; college creation not validated |
| `/admin/loggers` | Logger Management | ✅ Working | Create/edit loggers, assign to matches | |
| `/admin/access` | Access Control | ⚠️ Partial | User role management | /api/admin/users has no auth check (BUG-002) |
| `/admin/transfers` | Transfers | ⚠️ Partial | Transfer record management | BUG-004: createdBy hardcoded to 'admin-1' |
| `/admin/news` | News Management | ⚠️ Partial | Create/edit news articles | BUG-006: XSS via dangerouslySetInnerHTML |
| `/admin/advertisements` | Advertisements | ⚠️ Partial | Ad management | New feature; limited testing |
| `/admin/notifications` | Push Notifications | ⚠️ Partial | Send push notifications | VAPID configured; reliability unknown |
| `/admin/infrastructure` | Infrastructure | ❓ Unknown | System infrastructure view | Content unknown without full read |
| `/admin/settings` | System Settings | ⚠️ Partial | Key-value system config | /api/admin/settings auth status unknown |
| `/admin/match-lineups` | Match Lineups | ⚠️ Partial | Lineup editor per match | Lineup Builder marked HIGH VOLATILITY |
| `/admin/match-ratings` | Match Ratings | ⚠️ Partial | Manual rating adjustments | Intersects rating calculator casing bugs |
| `/admin/bulk-register` | Bulk Register | ✅ Working | Bulk team/player creation | TD-007: placement review needed |
| `/admin/track-events` | Track Events | ❓ Unknown | Track & field event logging | Scope unclear |
| `/admin/manager` | Manager Center | 🔲 Stub | Team manager interface | Not fully built |
| `/admin/push-diagnose` | Push Diagnostics | ✅ Working | Debug push notifications | Dev/ops tool |
| `/admin/livestreams` | Livestreams | 🔲 Stub | Livestream management | Not connected to active feature |

---

## STEP 8 — Public Pages Inventory

| Route | Purpose | Status | Data Sources | Notes |
|-------|---------|--------|-------------|-------|
| `/` | Home — live matches, featured content | ✅ Working | /api/matches, /api/news | CSR |
| `/live` | Live match center | ✅ Working | /api/matches (filter LIVE) | CSR, 30s poll, no SSR |
| `/football` | Football hub | ✅ Working | /api/football/* | CSR |
| `/basketball` | Basketball hub | ✅ Working | /api/basketball/* | CSR |
| `/competitions` | Competition listing | ✅ Working | /api/competitions | CSR |
| `/matches/[id]` | Match detail | ✅ Working | /api/matches/[id], /api/events | Socket.IO for live |
| `/match/[id]` | Match detail (duplicate) | ❓ Unknown | Possibly same as above | DUPLICATE ROUTE — needs audit |
| `/players/[id]` | Player profile | ✅ Working | /api/players/[id] | CSR |
| `/players/compare` | Player comparison | ⚠️ Partial | /api/players/compare | CSR |
| `/teams/[id]` | Team profile | ✅ Working | /api/teams/[id] | CSR |
| `/teams` | Teams listing | ✅ Working | /api/teams | CSR, unbounded (BUG-005) |
| `/stats` | Leaderboards | ⚠️ Partial | /api/players/stats/leaders | Stats anomaly — inflated goals |
| `/news` | News listing | ✅ Working | /api/news | CSR |
| `/news/[slug]` | News article | ⚠️ Partial | /api/news/[id] | BUG-006: XSS risk |
| `/transfers` | Transfer news | ✅ Working | /api/transfers | CSR |
| `/lineups` | Lineup gallery | ⚠️ Partial | /api/* | Lineup Builder HIGH VOLATILITY |
| `/predictions` | Predictions | ⚠️ Partial | /api/predictions | FPL-adjacent feature |
| `/search` | Global search | ✅ Working | /api/search | CSR |
| `/profile` | User profile | ✅ Working | /api/auth/me | Requires auth |
| `/login`, `/signup` | Auth | ✅ Working | /api/auth/* | Custom JWT |
| `/fpl/*` | Fantasy league | 🔲 Stub | /api/fpl/* | All FPL DB tables empty |
| `/livestream/[id]` | Livestream viewer | 🔲 Stub | /api/livestreams/* | Not production-ready |

---

## STEP 9 — API Routes Full Inventory

### Admin Routes

| Endpoint | Methods | Auth Gated | Purpose | Issues |
|----------|---------|-----------|---------|--------|
| /api/admin/users | GET, PATCH | **NO** | List users, change roles | **BUG-002: No auth check** |
| /api/admin/ads | GET, POST | **NO** | Ad management | **BUG-002: No auth check** |
| /api/admin/ads/[id] | PATCH, DELETE | **NO** | Individual ad CRUD | **BUG-002: No auth check** |
| /api/admin/settings | GET, POST, PATCH | **NO** | System settings | **BUG-002: No auth check** |
| /api/admin/organizations | GET, POST | **NO** | Organization CRUD | **BUG-002: No auth check** |
| /api/admin/infrastructure | GET | **NO** | Infrastructure status | **BUG-002: No auth check** |
| /api/admin/assigned-matches | GET | **NO** | Logger assigned matches | **BUG-002: No auth check** |
| /api/admin/match-lineups/[id] | GET, POST | Unknown | Lineup management | Needs review |

### Auth Routes

| Endpoint | Methods | Auth Gated | Purpose | Issues |
|----------|---------|-----------|---------|--------|
| /api/auth/login | POST | NO | Login → JWT | Default secret fallback |
| /api/auth/register | POST | NO | User registration | |
| /api/auth/logout | POST | NO | Clear auth cookie | |
| /api/auth/me | GET | YES (cookie) | Get current user | |
| /api/auth/test | GET | NO | **Debug endpoint in production** | **BUG-003: DELETE THIS FILE** |
| /api/auth/forgot-password | POST | NO | Password reset email | |
| /api/auth/change-password | POST | YES | Change password | |
| /api/auth/refresh | POST | NO | Refresh token | |
| /api/auth/google | GET, POST | NO | Google OAuth | |
| /api/auth/[...nextauth] | ALL | — | NextAuth catch-all | Vestigial — conflicts with custom auth |

### Match Routes

| Endpoint | Methods | Auth Gated | Purpose | Issues |
|----------|---------|-----------|---------|--------|
| /api/matches | GET, POST | GET: NO, POST: **NO** | List/create matches | **POST has no auth check** |
| /api/matches/[id] | GET, PATCH, DELETE | PATCH/DELETE: **unclear** | Single match CRUD | Needs audit |
| /api/matches/[id]/assign-logger | POST | **unclear** | Assign logger | BUG-008: race condition |
| /api/matches/[id]/assigned-loggers | GET | NO | Get assigned loggers | BUG-007: emails in response |
| /api/matches/backfill | POST | YES (admin) | Backfill past match | Correctly protected |
| /api/matches/live | GET | NO | Live matches only | |
| /api/matches/bulk | POST | Unknown | Bulk match insert | |
| /api/matches/bulk-update | POST | Unknown | Bulk status update | |

### Player Routes

| Endpoint | Methods | Auth Gated | Purpose | Issues |
|----------|---------|-----------|---------|--------|
| /api/players | GET, POST | GET: NO, POST: **unknown** | List/create players | GET unbounded (BUG-005) |
| /api/players/[id] | GET, PATCH, DELETE | PATCH/DELETE: unknown | Single player CRUD | |
| /api/players/bulk | POST | Unknown | Bulk player import | |
| /api/players/bulk-register | POST | Unknown | Bulk registration | |
| /api/players/stats/leaders | GET | NO | Leaderboard | Stats anomaly |
| /api/players/compare | GET | NO | Player comparison | |

### Event Routes

| Endpoint | Methods | Auth Gated | Purpose | Issues |
|----------|---------|-----------|---------|--------|
| /api/events | GET, POST | **NO (POST)** | Log/fetch events | AUDIT-001 listed as resolved but not confirmed |
| /api/events/sync | POST | Unknown | Event sync | |

### Other Domain Routes (all unauthenticated GET)

| Group | Routes | Issues |
|-------|--------|--------|
| Teams | /api/teams, /api/teams/[id], /api/teams/bulk, /api/teams/stats | GET unbounded (BUG-005) |
| Competitions | /api/competitions, /api/competitions/[id] and sub-routes, /api/competitions/bulk | — |
| Standings | /api/standings | Unbounded GET |
| Loggers | /api/loggers, /api/loggers/[id], /api/loggers/auth, /api/loggers/me | GET unbounded |
| News | /api/news, /api/news/[id] and sub-routes | BUG-006 XSS |
| Transfers | /api/transfers, /api/transfers/[id] | — |
| Polls | /api/polls, /api/polls/vote, /api/polls/comments | Vote auth unknown |
| Notifications | Many /api/notifications/* routes | — |
| Users | /api/users/[id], /api/users/activity, etc. | Auth partially unclear |
| FPL | All /api/fpl/* routes | Unused |
| Search | /api/search | Unbounded |
| Email test | /api/email/test | **Dev endpoint exposed in production** |

---

## STEP 10 — Conventions Reference

### ID Generation
- Method: `nanoid` from `nanoid` package
- Import: `import { nanoid } from 'nanoid'`
- Usage: `const id = nanoid()` — generates URL-safe random ID
- NOTE: Some legacy data uses UUID v4 format (`uuid()`) and some uses `Date.now()` hashes. Not consistent across all scripts.

### Timestamp Format
- DB storage: `integer(mode: 'timestamp')` — Unix epoch integer
- JS side: `new Date()` objects via Drizzle's `$defaultFn`
- Query results return integers (not Date objects from raw SQL)

### getAuthUser Pattern
```typescript
// Import
import { getAuthUser } from '@/lib/auth';

// Usage
const user = await getAuthUser(request);
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```

### Standard Error Response Shape
```json
{ "error": "Human-readable error message" }
```
HTTP status: 400 (validation), 401 (unauth), 403 (forbidden), 404 (not found), 500 (server)

### Standard Success Response Shape
- No single standard — varies by route. Common patterns:
  - Array response: `return NextResponse.json(arrayOfItems)`
  - Object response: `return NextResponse.json({ success: true, data: {...} })`
  - Created resource: `return NextResponse.json(createdItem, { status: 201 })`

### DB Query Style
- Drizzle ORM query builder exclusively
- Pattern: `db.select().from(table).where(eq(table.col, val)).limit(50)`
- Relations: `db.query.tableName.findMany({ with: { relation: true } })`
- Inserts: `db.insert(table).values(row)` or `.returning()`

### Toast Pattern
```typescript
// Import
import { useToast } from '@/hooks/useToast';
// Usage
const { toasts, success, error, removeToast } = useToast();
success('Operation successful!');
error('Something went wrong');
// Render: <ToastContainer toasts={toasts} onClose={removeToast} />
```

### Modal Pattern
- Admin modals use inline `AnimatePresence` + `motion.div` from `framer-motion`
- `@radix-ui/react-dialog` also used in some components
- No single standardized modal wrapper

### 'use client' Usage Rules
- All pages with `useState`, `useEffect`, event handlers: `'use client'` at top
- All admin pages are client components
- API route files: never use client directive
- Layout files: server by default unless they need context

### File Naming Conventions
- Pages: `page.tsx`
- API routes: `route.ts`
- Components: PascalCase.tsx (e.g., `FootballLogger.tsx`)
- Utilities: kebab-case.ts (e.g., `match-logger-helpers.ts`)
- Schema files: `schema.ts`, `schema-[feature].ts`

### Component Naming Conventions
- All React components: PascalCase
- Admin-specific components in `src/components/admin/`
- Feature-grouped in subfolders: `lineup/`, `auth/`, `notifications/`, etc.

---

## STEP 11 — Known Issues Consolidated Registry

| ID | Severity | File | Description | Status |
|----|----------|------|-------------|--------|
| BUG-001 | 🔴 Critical | `src/middleware.ts` | Middleware matcher covers `/api/admin/*` but internal check only matches `/admin` — all admin API routes bypass middleware auth | OPEN |
| BUG-002 | 🔴 Critical | `src/app/api/admin/users/route.ts`, `ads/route.ts`, `settings/route.ts`, `organizations/route.ts` | Admin API handlers missing `getAuthUser` and role checks — any unauthenticated request can read/modify admin data | OPEN |
| BUG-003 | 🔴 Critical | `src/app/api/auth/test/route.ts` | Debug auth endpoint live in production — leaks auth state and cookie info | OPEN — DELETE FILE |
| BUG-004 | 🟠 High | `src/app/admin/transfers/page.tsx` L189 | `createdBy: 'admin-1'` hardcoded — corrupts audit trail for all transfers | OPEN |
| BUG-005 | 🟠 High | `/api/teams`, `/api/players`, `/api/loggers` | Unbounded queries — no `.limit()` clause on GET handlers | OPEN (partially fixed for /api/matches) |
| BUG-006 | 🔴 Critical | `src/lib/utils/format-content.ts` | `formatNewsContent` does not escape HTML — stored XSS via `dangerouslySetInnerHTML` in news pages | OPEN |
| BUG-007 | 🔴 Critical | `src/app/api/matches/route.ts` L65 | `assignedLoggers` array includes real email addresses in public match response — NDPR/GDPR violation | OPEN |
| BUG-008 | 🟠 High | `src/app/api/matches/[id]/assign-logger/route.ts` | Non-atomic check-then-insert for logger assignment — concurrent requests cause duplicate logger entries | OPEN |
| BUG-009 (NEW) | 🟠 High | `src/app/api/matches/route.ts` POST | No auth check on POST /api/matches — any unauthenticated user can create matches | OPEN |
| BUG-010 (NEW) | 🟡 Medium | `src/app/api/events/route.ts` POST | Auth check for event logging not confirmed in code read — may be missing despite AUDIT-001 claiming fix | NEEDS VERIFICATION |
| BUG-011 (NEW) | 🟡 Medium | `src/db/` and `players` table | Player stats anomaly: 718 goals across 133 appearances — data corruption likely from multiple backfill runs | OPEN |
| BUG-012 (NEW) | 🟡 Medium | `src/lib/services/rating-calculator.ts` | SAVE/BLOCK/GOAL casing mismatch — events stored as PascalCase in DB but calculator checks UPPERCASE | OPEN |
| BUG-013 (NEW) | 🟡 Medium | `teams` table | 4 intercollege teams have `ownerOrganizationId = null` — not linked to their org hierarchy | OPEN |
| BUG-014 (NEW) | 🟡 Medium | `organizations` table | Duplicate college org entries for same college (e.g., COLMANS appears twice with different IDs) | OPEN |
| BUG-015 (NEW) | 🟢 Low | `src/app/match/[id]/page.tsx` | Duplicate route — both `/match/[id]` and `/matches/[id]` appear to serve match detail | NEEDS AUDIT |
| TD-001 | 🟡 Medium | Multiple files | No centralized env validation — 29 env vars scattered, no startup failure on missing keys | OPEN |
| TD-002 | 🟡 Medium | Logger UI | No deduplication for event logging on slow connections | OPEN |
| TD-003 | 🟡 Medium | Match status | No state machine for status transitions — manual and error-prone | OPEN |
| TD-004 | 🟢 Low | `.env.example` | Only 16 of 29 actual env keys documented | OPEN |
| TD-005 | 🟠 High | Logger assignment | Atomic refactor needed for BUG-008 | OPEN |
| TD-006 | 🔴 Critical | Public match API | Response sanitization missing for BUG-007 | OPEN |
| TD-007 | 🟢 Low | `/admin/bulk-register` | UX placement review needed | OPEN |
| BACKLOG-001 | 🟡 Medium | `player_stats` schema | Goal type breakdown (penalties, own goals) missing | OPEN |
| BACKLOG-002 | 🟡 Medium | `/api/competitions/[id]` | No archive/delete functionality for competitions | OPEN |
| BACKLOG-003 | 🟡 Medium | `/api/competitions/[id]` | startDate/endDate PATCH crash on empty string | OPEN |
| BACKLOG-004 | 🟡 Medium | `competitions` schema | Multi-sport parent-child structure not built | OPEN |
| BACKLOG-006 | 🟡 Medium | `/admin/bulk-register` | No existing player select in bulk registration | OPEN |
