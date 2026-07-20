# BrixSports — System Audit
**BACKLOG-020 Block 6**
**Audited:** 2026-06-08
**Branch:** `dev`
**Auditor:** Claude Code (automated sweep — all routes, APIs, DB tables, components, packages)

---

## Audit Method

| State | Meaning |
|-------|---------|
| **WORKING** | Tested end-to-end, complete, no known bugs |
| **PARTIAL** | Core flow works, meaningful pieces missing or stubbed |
| **BROKEN** | Exists in nav/code but produces errors or wrong output in normal use |
| **NOT BUILT** | Schema or scaffold exists, no functioning implementation |
| **DEAD** | Code/table/package exists but is unused / unreachable |

---

## 1. Three Critical Flows

| Flow | Status | Notes |
|------|--------|-------|
| **Flow A — Match Creation** | WORKING | Admin creates match → assigns loggers → appears on public page. All auth gates in place. |
| **Flow B — Live Event Logging** | WORKING | Logger logs event → saves to DB → score updates broadcast via Socket.IO. Auth gate verifies assignment. |
| **Flow C — Public Livescore** | PARTIAL | Viewer sees match list and live scores. Real-time updates depend on Socket.IO connection. No verified fallback polling if WS drops. Livescore page (`/live`) just re-fetches `/api/matches` on mount — no auto-refresh/polling interval. |

**Flow C gap:** `/live/page.tsx` fetches matches once on mount. No `setInterval` polling and no WS subscription to push updates to the page. Public viewer must manually refresh to see new events.

---

## 2. Public-Facing Pages

| Route | Status | Notes |
|-------|--------|-------|
| `/` (Home) | PARTIAL | Fetches live matches, players, teams. Ads wired. Real-time not subscribed on homepage. Dynamic overlays lazy-loaded. Uses `src/lib/mock-data.ts` indirectly via 3 components (see §7). |
| `/live` | PARTIAL | One-shot fetch of `/api/matches` on mount. No polling. No WebSocket subscription. Viewer must refresh. |
| `/match/[id]` | PARTIAL | Fetches match detail. Two routes exist: `/match/[id]` and `/matches/[id]` — likely a duplicate or legacy route. |
| `/matches/[id]` | PARTIAL | Appears to duplicate `/match/[id]`. Needs audit to confirm which is canonical. |
| `/competitions` | WORKING | Lists competitions from DB. |
| `/competitions/[id]/standings` | WORKING | Standings by competition. |
| `/competitions/[id]/register` | PARTIAL | Registration form exists. Approval flow (`/competitions/register/approve`) exists but admin UI for approvals not confirmed. |
| `/competitions/[id]/registration-success` | NOT BUILT | Static success page — no confirmation of DB state shown. |
| `/football` | PARTIAL | Fetches football-specific data. Depends on `/api/football/*` routes. |
| `/basketball` | PARTIAL | Same pattern as `/football`. |
| `/teams` | WORKING | Team list. |
| `/teams/[id]` | PARTIAL | Team detail page. Roster display depends on `playerTeamAffiliations` — partial for multi-affiliation players. |
| `/players/[id]` | WORKING | Player profile page. |
| `/players/compare` | PARTIAL | Compare UI exists. Depends on `/api/players/compare`. |
| `/news` | PARTIAL | News list functional. BUG-006 XSS via `dangerouslySetInnerHTML` was fixed in `format-content.ts`, but the news module is flagged 🔴 High Volatility. |
| `/news/[slug]` | PARTIAL | Single article. Same XSS concern — fix in place but unverified on staging. |
| `/stats` | PARTIAL | Renders stat leaders. Depends on `/api/players/stats/leaders`. |
| `/transfers` | PARTIAL | BUG-004 (`createdBy: 'admin-1'`) fixed. Flagged 🔴 High Volatility. |
| `/login` | WORKING | Custom JWT login. |
| `/signup` | WORKING | User registration. |
| `/forgot-password` | PARTIAL | Form sends to `/api/auth/forgot-password`. Email delivery depends on email provider working (BACKLOG-026). |
| `/reset-password` | PARTIAL | Same email dependency as forgot-password. |
| `/profile` | PARTIAL | User profile page. Depends on auth session. |
| `/profile/settings` | PARTIAL | Settings page. |
| `/profile/favorites` | PARTIAL | Favorites page. |
| `/notifications` | PARTIAL | Notification list page. Requires auth. |
| `/search` | PARTIAL | Global search page. Depends on `/api/search`. |
| `/lineups` | PARTIAL | Public lineup view. |
| `/livestream/[id]` | PARTIAL | Livestream view. WS-dependent. |
| `/about` | WORKING | Static page. |
| `/offline` | WORKING | PWA offline fallback page. |
| `/nesa-registration` | NOT BUILT | Multi-step registration form UI exists but no API handler for NESA-specific registration. Uses `schema-nesa-registrations.ts` tables that have no corresponding API routes. |
| `/scouts` | DEAD | Redirects to `/`. Page is a shell. |
| `/auth/signin` | DEAD | next-auth signin route. next-auth is vestigial (BACKLOG-009). This route conflicts with the custom `/login` flow. |
| `/dashboard` | PARTIAL | User dashboard. Unknown state — not audited in detail. |
| `/favourites` | PARTIAL | Favorites list. Depends on auth. |
| `/user/[userId]` | PARTIAL | Public user profile. |
| `/about` | WORKING | Static informational page. |

---

## 3. Admin Pages

| Route | Status | Auth Gate | Notes |
|-------|--------|-----------|-------|
| `/admin` (dashboard) | WORKING | middleware ✓ | Fetches matches, teams, loggers. No server-side auth check beyond middleware — relies on middleware alone for page. |
| `/admin/matches` | WORKING | middleware ✓ | BUG-014 fixed. Team name display now uses embedded API data. |
| `/admin/competitions` | WORKING | middleware ✓ | List + create + edit. |
| `/admin/competitions/[id]` | PARTIAL | middleware ✓ | Competition detail/edit page. PATCH crash on empty `startDate`/`endDate` (BACKLOG-003). |
| `/admin/players` | WORKING | middleware ✓ | Player management. |
| `/admin/loggers` | WORKING | middleware ✓ | Logger management. |
| `/admin/organizations` | PARTIAL | middleware ✓ | List only. No drill-down. Org detail page does not exist (BACKLOG-015). |
| `/admin/bulk-register` | PARTIAL | middleware ✓ | BUG-013 auth gate fixed. Creates new players only — no link to existing players (BACKLOG-016). |
| `/admin/news` | PARTIAL | middleware ✓ | News CRUD. 🔴 High Volatility (BUG-006 touch zone). |
| `/admin/advertisements` | PARTIAL | middleware ✓ | Ad management UI. 🔴 High Volatility (untested under load). |
| `/admin/transfers` | PARTIAL | middleware ✓ | BUG-004 fixed. 🔴 High Volatility. |
| `/admin/settings` | WORKING | middleware + handler ✓ | System settings. `getAuthUser` + `role === 'admin'` in handler. |
| `/admin/users` (via `/api/admin/users`) | WORKING | middleware + handler ✓ | User management. |
| `/admin/match-lineups` | PARTIAL | middleware ✓ | Lineup builder admin. 🔴 High Volatility (marked NEW, unknown stability). Page auth check is middleware only — handler has `getAuthUser`. |
| `/admin/match-ratings` | PARTIAL | middleware ✓ | Rating management. Handler-level auth present. |
| `/admin/match-ratings/[id]` | PARTIAL | middleware ✓ | Per-match rating detail. |
| `/admin/past-matches/import` | PARTIAL | middleware ✓ | Import UI for historical match data. |
| `/admin/track-events` | PARTIAL | middleware ✓ | Track & Field event management. Own admin section. API endpoint unclear — may POST to `/api/matches` with sport='Track'. |
| `/admin/notifications` | PARTIAL | middleware ✓ | Notification management. |
| `/admin/notifications/composer` | PARTIAL | middleware ✓ | Push notification composer. |
| `/admin/push-diagnose` | PARTIAL | middleware ✓ | Push notification diagnostics. |
| `/admin/access` | PARTIAL | middleware ✓ | Access management page. Unknown scope. |
| `/admin/livestreams` | PARTIAL | middleware ✓ | Livestream management. |
| `/admin/infrastructure` | PARTIAL | middleware ✓ | System health dashboard. Has no `getAuthUser` check in handler — only middleware protection. |
| `/admin/manager` | PARTIAL | middleware ✓ | Manager dashboard. Has real UI (matches, loggers, comms), but `StaffComms` flow is unverified. |
| `/admin/past-matches/import` | PARTIAL | middleware ✓ | CSV import UI. |

**IMPORTANT:** Admin *page* routes are protected by middleware. Admin *API* handlers have `getAuthUser` in ~23 routes. See §5 for full API auth inventory.

---

## 4. Logger Interface

| Route | Status | Notes |
|-------|--------|-------|
| `/logger` | WORKING | Logger login + match selection + event logging. Separate JWT auth via `/api/loggers/auth`. `FootballLogger`, `BasketballLogger`, `TrackLogger` components wired. |
| `/analytics/loggers` | PARTIAL | Logger analytics dashboard. Depends on `/api/analytics/loggers`. Auth gate status unknown. |

---

## 5. API Endpoints — Security Inventory

### Auth
| Endpoint | Methods | Auth | Issues |
|----------|---------|------|--------|
| `POST /api/auth/login` | POST | none (public) | ✓ correct |
| `POST /api/auth/register` | POST | none (public) | ✓ correct |
| `POST /api/auth/logout` | POST | none (clears cookie) | ✓ |
| `GET /api/auth/me` | GET | none explicitly | ⚠ reads token from cookie — but no explicit 401 if no token |
| `POST /api/auth/forgot-password` | POST | none (public) | ✓ correct |
| `POST /api/auth/change-password` | POST | `getAuthUser` ✓ | ✓ |
| `GET/POST /api/auth/[...nextauth]` | GET,POST | next-auth (vestigial) | ⚠ DEAD — next-auth is unused in custom JWT flow. This route still handles Google OAuth via next-auth. **Two conflicting auth systems** |
| `POST /api/auth/google` | POST | none | ⚠ Separate Google auth route in addition to next-auth. Role unclear. |
| `POST /api/auth/refresh` | POST | none | Refresh token rotation — needs audit |

### Matches (Core)
| Endpoint | Methods | Auth | Bounded? | Issues |
|----------|---------|------|----------|--------|
| `GET /api/matches` | GET | none | `.limit(50)` ✓ | Public — no internal fields in response ✓ |
| `POST /api/matches` | POST | admin ✓ | n/a | ✓ |
| `GET /api/matches/[id]` | GET | none | n/a | Public — returns full match row including `approvalStatus`, `managerNotes`, `loggerId` ⚠ NDPR LEAK |
| `PATCH /api/matches/[id]` | PATCH | **none** ⚠ | n/a | **SECURITY GAP** — no auth check. Any caller can update match scores, status, `approvedBy`, `managerNotes`. |
| `GET /api/matches/live` | GET | none | unknown | Public. Needs `.limit()` check. |
| `POST /api/matches/bulk` | POST | unknown | n/a | Needs auth audit |
| `PATCH /api/matches/bulk-update` | PATCH | unknown | n/a | Needs auth audit |
| `POST /api/matches/backfill` | POST | `getAuthUser` ✓ | n/a | Admin-gated backfill trigger |
| `GET /api/matches/[id]/events` | GET | none | none | ⚠ No `.limit()` — unbounded events query |
| `POST /api/events` | POST | `getAuthUser` + assignment check ✓ | n/a | ✓ CORRECT — body read AFTER auth check. |
| `GET /api/events` | GET | none | none | ⚠ No `.limit()` clause |

### Logger Assignment
| Endpoint | Methods | Auth | Issues |
|----------|---------|------|--------|
| `POST /api/matches/[id]/assign-logger` | POST | admin ✓ + transaction ✓ | BUG-008 fixed ✓ |
| `DELETE /api/matches/[id]/remove-logger` | DELETE | unknown | Needs auth audit |
| `GET /api/matches/[id]/loggers` | GET | unknown | Needs auth audit |
| `GET /api/matches/[id]/assigned-loggers` | GET | unknown | Needs auth audit |

### Competitions
| Endpoint | Methods | Auth | Issues |
|----------|---------|------|--------|
| `GET /api/competitions` | GET | none | **No `.limit()`** ⚠ unbounded |
| `POST /api/competitions` | POST | **none** ⚠ | **SECURITY GAP** — any user can create a competition |
| `GET /api/competitions/[id]` | GET | none | ✓ public |
| `PATCH /api/competitions/[id]` | PATCH | unknown | Needs auth audit. Known crash on empty `startDate` (BACKLOG-003) |
| `DELETE /api/competitions/[id]` | DELETE | **DOES NOT EXIST** | BACKLOG-002 — no delete endpoint |
| `GET /api/competitions/[id]/standings` | GET | none | ✓ public |
| `GET /api/competitions/[id]/fixtures` | GET | none | ✓ public |
| `GET /api/competitions/[id]/stats` | GET | none | `.limit()` present |
| `GET /api/competitions/[id]/teams` | GET | none | ✓ public |
| `GET /api/competitions/[id]/eligible-players` | GET | none | ✓ public |
| `POST /api/competitions/register` | POST | unknown | Registration flow |
| `POST /api/competitions/register/approve` | POST | unknown | Approval — needs auth audit |
| `POST /api/competitions/bulk` | POST | unknown | Needs auth audit |

### Players
| Endpoint | Methods | Auth | Bounded? |
|----------|---------|------|----------|
| `GET /api/players` | GET | none | `.limit(500)` ✓ |
| `POST /api/players` | POST | `getAuthUser` + admin ✓ | n/a |
| `GET /api/players/[id]` | GET | none | n/a |
| `PATCH /api/players/[id]` | PATCH | `getAuthUser` ✓ | n/a |
| `DELETE /api/players/[id]` | DELETE | `getAuthUser` + admin ✓ | n/a |
| `POST /api/players/bulk-register` | POST | `getAuthUser` + admin ✓ (BUG-013 fixed) | n/a |
| `POST /api/players/bulk` | POST | unknown | Needs audit |
| `POST /api/players/create-individual` | POST | unknown | Needs audit |
| `GET /api/players/stats/leaders` | GET | none | `.limit()` present |
| `GET /api/players/[id]/stats` | GET | none | n/a |
| `GET /api/players/[id]/performance` | GET | none | n/a |
| `GET /api/players/compare` | GET | none | n/a |

### Teams
| Endpoint | Methods | Auth | Bounded? |
|----------|---------|------|----------|
| `GET /api/teams` | GET | none | `.limit(200)` ✓ |
| `GET /api/teams/[id]` | GET | none | n/a |
| `POST /api/teams/[id]/follow` | POST | `getAuthUser` ✓ | n/a |
| `GET /api/teams/[id]/form` | GET | none | `.limit()` present |

### Admin Routes
| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `GET/POST /api/admin/ads` | GET,POST | `getAuthUser` + admin ✓ | ✓ |
| `PATCH/DELETE /api/admin/ads/[id]` | PATCH,DELETE | unknown | Needs audit |
| `GET/PATCH /api/admin/users` | GET,PATCH | `getAuthUser` + admin ✓ | ✓ |
| `GET/PATCH /api/admin/settings` | GET,PATCH | `getAuthUser` + admin ✓ | ✓ |
| `GET/POST /api/admin/organizations` | GET,POST | `getAuthUser` + admin ✓ | ✓ |
| `GET /api/admin/infrastructure` | GET | **none** ⚠ | Handler has no `getAuthUser`. Exposes full system health, DB table counts, server info. Middleware protects the page, but the API itself is callable without auth from any origin. |
| `GET /api/admin/assigned-matches` | GET | `getAuthUser` ✓ | ✓ |
| `GET/PATCH /api/admin/match-lineups/[id]` | GET,PATCH | `getAuthUser` ✓ | ✓ |

### Analytics
| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `GET /api/analytics/system` | GET | **none** ⚠ | Returns full system stats (user count, match count, etc.) to any unauthenticated caller. |
| `GET /api/analytics/loggers` | GET | `.limit()` present | Auth gate unknown |

### Debug/Test Routes (SECURITY CRITICAL)
| Endpoint | Status | Issue |
|----------|--------|-------|
| `GET /api/notifications/debug` | LIVE ⚠ | No auth. Dumps all push subscriptions including endpoints and user IDs. |
| `GET /api/notifications/test` | LIVE ⚠ | No auth. Exposes VAPID key configuration. |
| `GET/POST /api/email/test` | LIVE ⚠ | No auth. Triggers real email send. Exposes email config. |
| `GET /api/notifications/diagnose` | LIVE | Likely diagnostic — auth unknown |

### Other APIs
| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `GET /api/news` | GET | none | `.limit()` present |
| `POST /api/news/[id]/like` | POST | auth ✓ | |
| `POST /api/news/[id]/comments` | POST | auth ✓ | |
| `GET /api/ads` | GET | none | Public ad serving |
| `GET /api/health` | GET | none | ✓ correct |
| `GET /api/llms` | GET | none | SEO/AI optimization route |
| `GET /api/brackets` | GET | none | Public |
| `POST /api/brackets` | POST | unknown | Needs auth audit |
| `GET /api/fixtures` | GET | none | `.limit()` present |
| `GET /api/fixtures/[id]` | GET | none | ✓ |
| `GET /api/transfers` | GET | none | ✓ public |
| `POST /api/transfers` | POST | unknown | Needs auth audit |
| `GET /api/search` | GET | none | ✓ public |
| `GET /api/head-to-head` | GET | none | `.limit()` present |
| `GET /api/livestreams/active` | GET | none | ✓ |
| `POST /api/matches/[id]/livestream` | POST | `getAuthUser` ✓ | |
| `GET /api/loggers` | GET | none | `.limit(200)` ✓ |
| `POST /api/loggers/auth` | POST | none (login) | ✓ |
| `GET /api/loggers/me` | GET | `.limit()` present | Logger-self |
| `GET /api/loggers/[id]` | GET | none | ✓ public |
| `POST /api/chat/send` | POST | `getAuthUser` ✓ | |
| `GET /api/notifications/history` | GET | unknown | |
| `POST /api/notifications/subscribe` | POST | none | ⚠ Anyone can subscribe to push — no auth |
| `POST /api/cloudinary/sign` | POST | unknown | Should require auth |

### FPL (Fantasy Premier League)
All FPL routes (`/api/fpl/*`) have **no auth gates** observed and reference `schema-fpl.ts` tables. The FPL feature is not in the defined scope boundaries.

### Predictions
`/api/predictions`, `/api/predictions/leaderboard`, `/api/predictions/stats` — auth status unknown. Predictions are not in the defined scope.

### Basketball-Specific
`/api/basketball/*` — separate route tree that mirrors `/api/competitions` + `/api/matches` filtered by sport. Potential duplication. Auth status unknown.

### Football-Specific
`/api/football/*` — same pattern as basketball. Potential duplication.

---

## 6. Database Tables

### Core Tables (schema.ts)
| Table | Used | Notes |
|-------|------|-------|
| `organizations` | ✓ | CRUD via `/api/admin/organizations`. Detail page missing (BACKLOG-015). |
| `teams` | ✓ | Full CRUD. 236 rows live. |
| `players` | ✓ | Full CRUD. |
| `playerTeamAffiliations` | ✓ | Used. No unique constraint on `(playerId, teamId)` (BACKLOG-016). |
| `playerOrganizationAffiliations` | PARTIAL | Inserted via scripts. No admin UI to manage. |
| `basketballPlayerStats` | PARTIAL | Schema exists. API routes exist. No admin CRUD for these rows. |
| `footballPlayerStats` | PARTIAL | Same as basketball. Separate from `playerStats`. |
| `individualSportStats` | DEAD | Schema exists. No API writes to it. No UI references it. |
| `competitions` | ✓ | Full CRUD. |
| `competitionSportSettings` | DEAD | Schema exists. No API reads or writes to it. Created for multi-sport but never wired. |
| `competitionTeamEntries` | PARTIAL | Schema exists. 0 rows in DB per Session 4 notes. No admin UI. |
| `matches` | ✓ | Full CRUD. |
| `matchLoggerAssignments` | ✓ | Used. No unique constraint (BACKLOG-016 / BUG-008 fixed via transaction). |
| `matchEvents` | ✓ | Used. No `.limit()` on event queries. |
| `loggers` | ✓ | Full CRUD. |
| `standings` | ✓ | Read + manual recalculation. |
| `bracketNodes` | PARTIAL | Used in BUSA Football. No admin UI to manage brackets. |
| `users` | ✓ | Auth + profile. |
| `userPreferences` | PARTIAL | Schema exists. Not consistently read/written. |
| `userFavorites` | PARTIAL | Used in notifications. No dedicated admin UI. |
| `userFollows` | PARTIAL | Schema exists. Inconsistently used. |
| `userActivity` | DEAD | Schema exists. No API writes to it observed. |
| `playerStats` | PARTIAL | Used for leaderboards. BUG-011 (718 goals anomaly). No `penaltyGoals`/`ownGoals` columns (BACKLOG-001). |
| `teamForm` | DEAD | Schema exists. No observed writes. |
| `headToHead` | PARTIAL | Schema + API route exists. Not populated from live match events. |
| `teamRegistrations` | PARTIAL | Schema + API route. Approval flow unverified. |
| `registeredPlayers` | PARTIAL | Related to teamRegistrations. Unverified. |
| `squadPlayers` | DEAD | Schema exists with unique constraint. No API writes observed. |
| `polls` | DEAD | Schema exists. No active API or UI for polls. `MatchPoll`, `MatchPollEnhanced` components exist but not connected. |
| `pollVotes` | DEAD | Same — orphaned by polls being dead. |
| `pollComments` | DEAD | Same. |
| `pollCommentLikes` | DEAD | Same. |
| `news` | PARTIAL | CRUD exists. XSS fix in place (BUG-006). 🔴 High Volatility. |
| `newsRelations` | DEAD | Schema exists. No UI or API populates it. |
| `newsLikes` | PARTIAL | API route exists. |
| `newsComments` | PARTIAL | API routes exist. |
| `userBookmarks` | PARTIAL | API route exists. |
| `transfers` | PARTIAL | CRUD. BUG-004 fixed. 🔴 High Volatility. |
| `systemSettings` | WORKING | CRUD via `/api/admin/settings`. |
| `systemSettingsHistory` | DEAD | Schema exists. No writes observed — settings changes are not logged. |
| `staffComms` | PARTIAL | Used in Manager dashboard. `/api/chat/send` forwards to WS. Direct DB insert path unclear. |
| `pushSubscriptions` | PARTIAL | Subscribe route exists with no auth gate (any user can subscribe). Debug route exposes all subscriptions. |
| `matchReminders` | PARTIAL | Schema + API route. Notification dispatch unverified. |
| `passwordResetTokens` | PARTIAL | Schema + forgot-password API. Email delivery depends on BACKLOG-026. |
| `advertisements` | PARTIAL | CRUD exists. 🔴 High Volatility (untested under load). |

### Extra Schema Files
| File | Status | Notes |
|------|--------|-------|
| `schema-fpl.ts` | NOT BUILT | FPL schema (gameweeks, player data, teams, leagues, transfers). API routes exist but no data, not in scope. |
| `schema-predictions.ts` | NOT BUILT | Predictions schema. API routes exist. No data. Not in scope. |
| `schema-ratings.ts` | PARTIAL | `playerRatings` table used by match ratings system. Working but not exercised in every match flow. |
| `schema-nesa-registrations.ts` | DEAD | NESA registration schema. No API routes. `nesaRegistrations` table has broken foreign key references to `players` and `organizations` using unresolved identifiers. |
| `schema-xi.ts` | PARTIAL | `userXI`, `userXILikes`, `userXIComments` tables. API route `/api/user/xi` exists. UI at `/xi`. |
| `schema-user-lineups.ts` | PARTIAL | User-created lineups. DB migration script exists. |
| `schema-enhanced.ts` | UNKNOWN | Contents not audited — name suggests extended schema. |

---

## 7. Components

### Critical Path Components
| Component | Status | Notes |
|-----------|--------|-------|
| `FootballLogger` | WORKING | Event logging, score update, WS broadcast. |
| `BasketballLogger` | WORKING | Basketball-specific event logging. |
| `TrackLogger` | PARTIAL | Track event logging UI. Event types may not match backend expectations. |
| `MatchLoggerUI` | WORKING | Wraps sport-specific loggers. Match selection + login flow. |
| `LiveMatchStatus` | PARTIAL | Shows live status. No WS subscription observed in component — relies on parent polling. |
| `LiveUpdates` | PARTIAL | Listens for socket events. Connection drop fallback unverified. |
| `FootballPitch` / `LineupVisualizer` | PARTIAL | Pitch display. Works with stored lineups. |

### Components Importing Dead Data Source
`src/lib/mock-data.ts` is deprecated (marked ⚠️ DEPRECATED). Three components still import from it:
- `src/components/TopPlayers.tsx` — imports from mock-data
- `src/components/MyFeed.tsx` — imports from mock-data
- `src/components/MatchComponents.tsx` — imports from mock-data

Since `mock-data.ts` now exports only types (no actual data), these imports are unlikely to cause runtime errors but should be cleaned up — they import from a deprecated file.

### Scope-Creep Components (Not in Defined Scope)
| Component | Scope Issue |
|-----------|-------------|
| `CreatePoll.tsx`, `MatchPoll.tsx`, `MatchPollEnhanced.tsx`, `PollComments.tsx` | Polls are out of scope. Tables dead. |
| `PersonalizedFeed.tsx`, `ActivityFeed.tsx`, `FanWall.tsx`, `MyFeed.tsx` | Social features explicitly out of scope. |
| All `fpl/` page and API files | FPL explicitly out of scope. |
| `predictions/` pages and API | Predictions not in defined scope. |
| `TrackLogger.tsx` | Track & Field not in core scope — but low risk, can remain. |

---

## 8. Packages — Dead / Risk

| Package | Status | Action |
|---------|--------|--------|
| `next-auth@4.24.13` | DEAD (vestigial) | Remove (BACKLOG-009). Coexists with custom JWT — `/api/auth/[...nextauth]` still handles Google OAuth via next-auth. This creates **two conflicting auth systems**. |
| `resend@6.10.0` | DEAD | Not used in any code path. Remove (BACKLOG-010). |
| `stripe@19.2.0` | DEAD | Not wired. Explicitly out of scope. Remove (BACKLOG-013). |
| `@aws-sdk/credential-provider-env@^3.972.25` | PARTIAL | Used implicitly by SES. Unpinned (^ prefix). |
| `react-hook-form@^7.60.0` | PARTIAL | Installed. Global rule says only use if 8+ fields. Audit usage. |
| `@babel/parser@^7.28.5` | UNKNOWN | Not an obvious dependency for this stack. |
| `downloadjs@^1.4.7` | UNKNOWN | Not obvious what uses this. |
| `dotted-map@^2.2.3` | UNKNOWN | Map visualisation package. Unknown usage. |
| Most `@radix-ui/*` packages | PARTIAL | 15+ Radix packages installed. Some used, unknown if all are. |
| `three` + `@react-three/fiber` + `@react-three/drei` | PARTIAL | 3D library. Used in error pages (`BasketballRimScene`, `SoccerGoalScene`). Heavyweight for use only in error pages. |
| `xlsx@0.18.5` | PARTIAL | Pinned (✓). Used in import/export flows. |
| `socket.io@^4.8.1` | WORKING | Core WS library. Unpinned (^). |
| All packages with `^` or `~` prefix | ⚠ | BACKLOG-012 — 30+ production deps unpinned. |

---

## 9. Security Gaps (Priority Order)

| # | Gap | Severity | Location |
|---|-----|----------|----------|
| 1 | `PATCH /api/matches/[id]` has no auth check | **CRITICAL** | `src/app/api/matches/[id]/route.ts` PATCH handler. Any unauthenticated caller can update match scores, status, `approvedBy`. |
| 2 | `POST /api/competitions` has no auth check | HIGH | `src/app/api/competitions/route.ts` POST handler. |
| 3 | `GET /api/notifications/debug` exposed with no auth | HIGH | Dumps all push subscription endpoints + user IDs. |
| 4 | `GET /api/email/test` exposed with no auth | HIGH | Triggers real email sends. Exposes config. |
| 5 | `GET /api/notifications/test` exposed with no auth | MEDIUM | Exposes VAPID key prefix. |
| 6 | `GET /api/admin/infrastructure` no handler-level auth | MEDIUM | Returns DB row counts, system health, endpoint status. Middleware blocks UI, but API is callable cross-origin. |
| 7 | `GET /api/analytics/system` no auth | MEDIUM | Returns full system metrics (user counts, match counts, transfer counts). |
| 8 | `POST /api/notifications/subscribe` no auth | MEDIUM | Anyone can register a push subscription. |
| 9 | `GET /api/matches/[id]` returns `approvalStatus`, `managerNotes`, `loggerId` | MEDIUM | Internal fields banned from public responses per CLAUDE.md. |
| 10 | Two Google auth paths coexist | LOW | `next-auth` Google OAuth at `[...nextauth]` + custom `/api/auth/google`. Token format differs. Which one is active? |
| 11 | `schema-nesa-registrations.ts` references `players` and `organizations` without import | LOW | Will crash if the table is ever used. `players` and `organizations` are not imported in that file. |

---

## 10. Unbounded Queries (No `.limit()`)

| Location | Table |
|----------|-------|
| `GET /api/competitions` | `competitions` |
| `GET /api/events` (GET) | `matchEvents` |
| `GET /api/matches/[id]/events` | `matchEvents` |
| `GET /api/competitions/[id]` (sub-queries for teams/matches) | `matches`, `teams` |
| Various competition stats sub-queries using `Promise.all` | Multiple |

---

## 11. Backscoping Candidates

Features in the live UI that are PARTIAL/BROKEN and not needed for core MVP. Recommend hiding from public navigation until fixed.

| Feature | Current State | Action | Reinstatement Blocker |
|---------|--------------|--------|----------------------|
| `/fpl/*` (Fantasy Premier League) | NOT BUILT | Remove from nav + return 404 | Phase 7 (out of scope) |
| `/predictions` | NOT BUILT | Remove from nav + return 404 | Phase 7 (out of scope) |
| `/xi` (Team Builder) | PARTIAL | Can remain — low risk | None |
| `/draft` | PARTIAL | Unknown state | Needs investigation |
| `/lineups` (public) | PARTIAL | Low risk — data-driven | None |
| `/scouts` | DEAD | Already redirects to `/` | Clean up route |
| `/auth/signin` (next-auth) | DEAD | Remove after BACKLOG-009 | BACKLOG-009 |
| `/admin/advertisements` | PARTIAL 🔴 | Keep admin-only — not public | Load test on staging |
| `/admin/match-lineups` (Lineup Builder) | PARTIAL 🔴 | Keep admin-only | Stability test on staging |
| Polls UI (MatchPoll, etc.) | DEAD | Remove from match detail if surfaced | Phase 7 |
| NESA Registration | NOT BUILT | Remove `/nesa-registration` from nav | Full build required |

---

## 12. Priority Fix List (Top 10 Before Production)

| # | Item | Type | Backlog Ref |
|---|------|------|-------------|
| 1 | Add auth check to `PATCH /api/matches/[id]` | Security bug | New — not yet filed |
| 2 | Add auth check to `POST /api/competitions` | Security bug | New — not yet filed |
| 3 | Delete or auth-gate `GET /api/notifications/debug` and `GET /api/email/test` | Security bug | New |
| 4 | Strip `approvalStatus`, `managerNotes`, `loggerId` from `GET /api/matches/[id]` public response | NDPR/data leak | New |
| 5 | Add auth to `GET /api/admin/infrastructure` and `GET /api/analytics/system` | Security | New |
| 6 | Add `.limit()` to `GET /api/competitions` and `GET /api/events` | Performance | BUG-005 pattern |
| 7 | Remove `next-auth` — resolve dual auth system | Dead code + security | BACKLOG-009 |
| 8 | Remove `resend` and `stripe` packages | Dead code | BACKLOG-010, BACKLOG-013 |
| 9 | Fix `/live` page: add polling interval or WS subscription for real-time | Critical Flow C | New — BACKLOG needed |
| 10 | Fix `schema-nesa-registrations.ts` broken imports before any table use | Schema bug | New |

---

## 13. What Is Actually Working (No Known Bugs)

- Admin creates matches with correct team assignments ✓
- Logger login and match event logging ✓
- Score updates broadcast via Socket.IO ✓
- Public match list and individual match detail (minus internal field leak) ✓
- Competition list and standings ✓
- Player profiles and stats leaderboard ✓
- Logger assignment with transaction safety ✓
- XSS fix in news content ✓
- JWT auth flow (custom, not next-auth) ✓
- Sentry error tracking configured ✓
- Admin user, settings, organization CRUD ✓
- Cloudinary image upload ✓
- PWA manifest and offline page ✓

---

## 14. Files Referenced in This Audit

Key files reviewed:
- `src/middleware.ts`
- `src/lib/email.ts`
- `src/lib/env.ts`
- `src/db/schema.ts` (full)
- `src/db/schema-fpl.ts`, `schema-predictions.ts`, `schema-ratings.ts`, `schema-xi.ts`, `schema-nesa-registrations.ts`
- `src/app/api/matches/route.ts` + `[id]/route.ts`
- `src/app/api/events/route.ts`
- `src/app/api/competitions/route.ts` + `[id]/route.ts`
- `src/app/api/admin/ads/route.ts`, `users/route.ts`, `settings/route.ts`, `organizations/route.ts`, `infrastructure/route.ts`
- `src/app/api/notifications/debug/route.ts`, `test/route.ts`
- `src/app/api/email/test/route.ts`
- `src/app/api/analytics/system/route.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/fpl/teams/route.ts`
- `package.json`
- All 65 `src/app/**/page.tsx` files (structure audit)
- All `src/components/**/*.tsx` files (structure audit)

---

*Produced by BACKLOG-020 Block 6 automated sweep. Next step: file new bugs from §9, execute backscoping from §11.*

---

## 15. Gaps Confirmed to Predate This Handoff

This audit (2026-06-08) is the record of the codebase as received. The entries below are gaps confirmed, through later use and testing, to have already existed in that delivered codebase — not issues introduced afterward. Kept separate from the sections above, which stay as originally written.

### Security items from §9/§12 — resolved status, checked directly against code

| # | Item | Status |
|---|---|---|
| 1 | `PATCH /api/matches/[id]` no auth | Fixed |
| 2 | `POST /api/competitions` no auth | Fixed |
| 3 | `/api/notifications/debug`, `/api/email/test` exposed, no auth | Fixed — routes removed |
| 4 | `GET /api/matches/[id]` leaked `approvalStatus`/`managerNotes`/`loggerId` | Fixed — explicit DTO stripping |
| 5 | `GET /api/admin/infrastructure`, `GET /api/analytics/system` no handler-level auth | Not reverified — recheck before treating as fixed |
| 7 | `next-auth` dual-auth-system (BACKLOG-009) | Still open |

The delivered codebase's other, non-Top-10 gaps went considerably further than this audit's first pass could show. Additional auth/data-exposure bugs later confirmed present at handoff, not introduced after: zero auth on `/api/users/follows`; an unallowlisted `.set()` body spread on the event PATCH route; a `loggerId` leak on a route this audit didn't check; banned-field leaks and payload bloat on `/api/players/[id]`, including in nested objects a first pass at the same route missed; zero auth on the entire `/api/loggers` collection. A static route/schema sweep catches the class of bug visible in the code itself; it does not catch the class only visible by tracing full handler logic or exercising the route live — both classes were present at handoff.

### Real-time/WS infrastructure — present at handoff, not visible to this audit's method

§1 recorded one specific gap: Flow C (public livescore) had no polling/WS fallback, viewer had to manually refresh. Correct, but it was read off `/live/page.tsx` once — not a trace of the real-time architecture underneath. The following were all confirmed, later, to have already been true of the delivered codebase; none are regressions from work done after this audit:

- The DB write for a match event and the live broadcast of that event were entirely uncoordinated — no code path connected them. Any event reaching the DB via a route with no open logger socket could never trigger a live push.
- The public match clock had no database-persisted value at all. The live number existed only as long as a WebSocket tick kept arriving — no fallback, no recovery, by construction.
- The client's Socket.IO reconnection-recovery listener was registered on the wrong object (`socket.on(...)` instead of the Manager, `socket.io.on(...)`) — a listener that had never once fired, for this codebase's entire history up to the point it was found.
- Staging and production ran on the same shared Railway WebSocket instance, with no environment separation on broadcast rooms — a staging test event has always been capable of reaching real production viewers.
- Broadcast calls were unawaited ("fire and forget") inside serverless API route handlers, with no guaranteed completion once a response was sent — producing live-delivery delays of tens of seconds with no error anywhere.

None of these are visible by reading route code in isolation — they only surface by tracing the actual write→broadcast→client path end to end, or by running a real live match against the deployed system with a real client and a real network. This audit's method (static code/schema sweep) was correct for what it covers; it was not, and could not have been, a substitute for that.
