# BrixSports — Backlog

## Resolved

- ~~**BUG-005 (partial)**: `/api/matches` — Added `.limit(50)` to GET handler. Other endpoints (`/api/teams`, `/api/players`, `/api/loggers`) still unbounded.~~
- ~~**AUDIT-001**: `/api/events` POST — Added `getAuthUser()` + logger assignment check. Now returns 401/403 correctly.~~
  _> (stashed)_
- ~~**AUDIT-002 (partial)**: `/api/matches` (POST) — Coerced `competitionId` to `null` if empty string, fixing 500 error on match creation. Generic server validation still missing.~~
- ~~**BUG-001**: `src/middleware.ts` — Fixed `pathname.startsWith('/admin')` to also cover `/api/admin`. API routes now return 401/403 JSON instead of browser redirect. All debug console.logs removed.~~
- ~~**BUG-003**: `src/app/api/auth/test/route.ts` — File deleted. Debug endpoint no longer live.~~
- ~~**BUG-002**: `/api/admin/users`, `/api/admin/ads`, `/api/admin/settings` — `getAuthUser` + `role === 'admin'` check added to all handlers (GET, PATCH, POST where applicable). `/api/admin/organizations` already had auth — no change needed. `createdBy`/`updatedBy` audit fields now sourced from verified session user, not client-supplied body.~~
- ~~**BUG-007 (NDPR/GDPR Leak)**: `/api/matches` public GET — `email` field removed from `assignedLoggers` select query and response map. Logger emails no longer exposed to public viewers.~~
- ~~**BUG-009**: `POST /api/matches` — `getAuthUser` + admin role check added at top of handler. Handler signature upgraded from `Request` to `NextRequest`.~~
- ~~**BUG-010**: `POST /api/events` — `getAuthUser` added. Admins pass through; loggers verified against `matchLoggerAssignments` (active status) for the specific matchId. `DELETE /api/events` gated to admin or logger role. `GET /api/events` remains public.~~
- ~~**BUG-012**: Event type casing mismatch — added `normalizeType()` helper to `RatingCalculator` (`s.toLowerCase().replace(/[\s_-]+/g, '')`). All event type comparisons in `calculateStatsFromEvents` updated to use it. Score trigger and score tally loop in `POST /api/events` also updated with the same normalization. Handles `Goal`/`GOAL`/`Yellow Card`/`YELLOW_CARD` and all variants consistently.~~
- ~~**BUG-004**: `src/app/admin/transfers/page.tsx` L189 — `createdBy: 'admin-1'` replaced with `user?.id ?? null` sourced from `useAuth()` hook.~~
- ~~**BUG-005 (remaining)**: `/api/teams` — `.limit(200)` added. `/api/loggers` — `.limit(200)` added. `/api/players` — `.limit(500)` added with comment (higher cap because route feeds in-memory search/filter across all players).~~
- ~~**BUG-006**: `src/lib/utils/format-content.ts` — Added `escapeHtml()` helper. Applied to all user-supplied text before template string injection (headings, list items, blockquotes, paragraphs). Link handler in `formatInlineText` now validates URLs — only `http://` and `https://` permitted; all other schemes (`javascript:`, `data:` etc.) replaced with `#`. Closes stored XSS via `dangerouslySetInnerHTML` in news pages.~~
- ~~**BUG-008**: `src/app/api/matches/[id]/assign-logger/route.ts` — Race condition fixed by moving check-then-insert into a Drizzle transaction. `assignedBy` now sourced from verified `authUser.id` (not client body). Missing auth gate added — endpoint now requires `role === 'admin'`.~~
- ~~**BUG-013**: `src/app/api/players/bulk-register/route.ts` — `POST /api/players/bulk-register` had no `getAuthUser` check and no admin role verification. Fixed: `getAuthUser(request)` + `authUser.role !== 'admin'` check added at top of POST handler. Resolved: 2026-06-07.~~
- ~~**BUG-014**: `src/app/admin/matches/page.tsx` — Match cards displayed raw team IDs for teams beyond the `/api/teams` `.limit(200)` cap. Fixed: `homeTeam`/`awayTeam` embedded from API response used directly; `getTeamName(id)` replaced with `getTeamDisplay(match, side)`. Resolved: 2026-06-07.~~
- ~~**BUG-015** _(CRITICAL)_: `PATCH /api/matches/[id]` — no `getAuthUser` check. Fixed: auth + role check added. Resolved: 2026-06-08.~~
- ~~**BUG-016** _(HIGH)_: `POST /api/competitions` — no `getAuthUser` check. Fixed: auth + admin role check added. Resolved: 2026-06-08.~~
- ~~**BUG-017** _(HIGH)_: Three debug/test routes deleted — `/api/notifications/debug`, `/api/notifications/test`, `/api/email/test`. Resolved: 2026-06-08.~~
- ~~**BUG-018** _(MEDIUM — NDPR)_: `GET /api/matches/[id]` leaking `approvalStatus`, `managerNotes`, `loggerId`, `approvedBy`, `approvedAt`. Fixed: explicit DTO destructure. Resolved: 2026-06-08.~~
- ~~**BUG-019** _(MEDIUM)_: `GET /api/admin/infrastructure` and `GET /api/analytics/system` — middleware-only auth. Fixed: handler-level `getAuthUser` + admin check. Resolved: 2026-06-08.~~
- ~~**BUG-020** _(MEDIUM — Critical Flow C)_: `/live` page polled only on mount. Fixed: polling interval 30s → 15s, cleared on unmount. Resolved: 2026-06-08.~~
- ~~**BUG-021** _(MEDIUM)_: `POST /api/notifications/subscribe` — auth gate missing. Resolved: 2026-06-15 (confirmed on code review).~~
- ~~**BUG-022** _(MEDIUM — Performance)_: Unbounded queries on competitions + events routes. Fixed: `.limit()` added. Resolved: 2026-06-15.~~
- ~~**BUG-023** _(LOW)_: `schema-nesa-registrations.ts` — orphaned schema file deleted. Resolved: 2026-06-15.~~
- ~~**BUG-024** _(LOW)_: Suspected duplicate match routes `/match/[id]` vs `/matches/[id]`. False alarm — only `/matches/[id]` ever existed. Resolved: 2026-06-15.~~
- ~~**BUG-025** _(MEDIUM — NDPR)_: `GET /api/matches` exposed `loggerId` to public. Fixed: conditionally returned for admin only. Resolved: 2026-06-15.~~
- ~~**BUG-027** _(MEDIUM)_: `/competitions` page sport filter hid `sport=null` competitions. Fixed: `'All'` tab added as default. Resolved: 2026-06-15.~~
- ~~**BUG-028** _(MEDIUM)_: React hydration error #418 on standings page (Framer Motion `initial` prop). Fixed: `initial` removed from all motion elements; `<motion.tr>` replaced with `<tr>`. Resolved: 2026-06-15.~~
- ~~**BUG-029** _(MEDIUM — NDPR)_: `GET /api/players/[id]` returned `email` to unauthenticated callers. Fixed: `.catch(() => null)` pattern on `getAuthUser`, email conditionally returned for admin only. Resolved: 2026-06-15.~~

## Bugs (Open)

- **BUG-011**: `playerStats` data corruption — 718 goals vs 133 appearances (~5.4 goals/appearance). Root cause identified: duplicate backfill runs with differing `startTime` formats bypass the duplicate match check. No writes made. Needs dedup audit of all `matchEvents` before any data correction. Do not run any backfill until resolved.

- **AUDIT-002 (remaining)**: `POST /api/matches` — Missing comprehensive Zod validation for match creation payload. Partial fix (null coerce on `competitionId`) applied in Session 2. Full schema validation still absent.

- **BUG-026** _(MEDIUM — PWA/Cache)_: SW serves stale JS chunk URLs after a new deploy → unstyled page on direct URL visit (hard nav). Root cause: service worker caches asset URLs from the previous deploy; after a new build the chunk hashes change but the SW still serves the old (now-missing) URLs. Fix: document bypass + `no-store` headers on SW files shipped in Session 19. **Prod verification still open — TEST_CHECKLIST.md items unchecked.**

  Filed: 2026-06-08. Root cause clarified: 2026-06-15. Hotfix shipped: 2026-06-16.

- ~~**BUG-030** _(LOW)_: `/competitions/[id]` base route returns 404.~~ RESOLVED 2026-06-16 — `src/app/competitions/[id]/page.tsx` created with server-side `redirect()` to `[id]/standings`. Commit `3be1731`.

- ~~**BUG-031** _(LOW — Visual)_: `standings/page.tsx` renders raw teamLogo strings at 5 sites.~~ RESOLVED 2026-06-16 — All 5 sites (lines 395, 444, 561, 603, 642) replaced with `<TeamLogo>` component. Import added. Commit `bb0a1ed`.

- ~~**BUG-015** _(CRITICAL)_: `src/app/api/matches/[id]/route.ts` PATCH handler — no `getAuthUser` check. Fixed: `getAuthUser(request)` added before body read. Admin passes through; logger role verified against `isLoggerAssigned(matchId, authUser.id)`. Returns 401/403. Resolved: 2026-06-08.~~

- ~~**BUG-016** _(HIGH)_: `src/app/api/competitions/route.ts` POST handler — no `getAuthUser` check. Fixed: `getAuthUser(request)` + `role === 'admin'` added before body read. Resolved: 2026-06-08.~~

- ~~**BUG-017** _(HIGH)_: Three debug/test routes with no auth gate deleted:
  - `src/app/api/notifications/debug/route.ts` — DELETED
  - `src/app/api/notifications/test/route.ts` — DELETED
  - `src/app/api/email/test/route.ts` — DELETED
    Note: `PushNotificationDebugger.tsx` still calls `/api/notifications/debug` and `/api/notifications/test` — will 404. Track as follow-up: remove those fetch calls from the component. Resolved: 2026-06-08.~~

- ~~**BUG-018** _(MEDIUM — NDPR)_: `GET /api/matches/[id]` leaking `approvalStatus`, `managerNotes`, `loggerId`, `approvedBy`, `approvedAt` in public response. Fixed: explicit destructure excludes all banned fields before response is returned. Resolved: 2026-06-08.~~

- ~~**BUG-019** _(MEDIUM)_: `GET /api/admin/infrastructure` and `GET /api/analytics/system` — middleware-only auth. Fixed: `getAuthUser(request)` + `role === 'admin'` added to both handlers. Resolved: 2026-06-08.~~

- ~~**BUG-020** _(MEDIUM — Critical Flow C)_: `/live` page fetched `/api/matches` once on mount only. Fixed: polling interval already existed at 30s — changed to 15s. Interval is cleared on unmount. Stopgap until WebSocket subscription lands on the public viewer. Resolved: 2026-06-08.~~

- ~~**BUG-021** _(MEDIUM)_: `POST /api/notifications/subscribe` — auth gate missing. Fixed in prior session, confirmed present on code review 2026-06-15. Resolved: 2026-06-15.~~

- ~~**BUG-022** _(MEDIUM — Performance)_: Unbounded queries missing `.limit()` on competitions + events routes. Fixed in prior session, confirmed present on code review 2026-06-15. Resolved: 2026-06-15.~~

- ~~**BUG-029** _(MEDIUM — NDPR)_: `GET /api/players/[id]` is unauthenticated and returns `player.email` in the public response. Email should only be returned when caller is admin. Fix: add `getAuthUser` check, strip `email` from response if `role !== 'admin'`. Filed: 2026-06-15.~~ RESOLVED 2026-06-15 — `getAuthUser(request).catch(() => null)` added. Email conditionally returned for admin callers only.

- ~~**BUG-023** _(LOW)_: `src/db/schema-nesa-registrations.ts` references `players` and `organizations` tables without importing them. Will crash if the table is ever migrated or queried. Fix: add missing imports or delete the schema file if NESA registration is backscoped. Filed: 2026-06-08. Source: SYSTEM_AUDIT.md §9 #11.~~ RESOLVED 2026-06-15 — file deleted. Tables never existed in any live DB. Zero imports anywhere in codebase.

- ~~**BUG-024** _(LOW)_: Duplicate match detail routes — `/match/[id]` (`src/app/match/[id]/page.tsx`) and `/matches/[id]` (`src/app/matches/[id]/page.tsx`) both exist. One is likely legacy. Audit to confirm which is canonical (check all internal links and nav references), delete the other. Filed: 2026-06-08. Source: SYSTEM_AUDIT.md §2.~~ RESOLVED 2026-06-15 — false alarm. `/match/[id]` route never existed. All internal navigation uses `/matches/[id]` (canonical). No fix needed.

- **BUG-026** _(MEDIUM — PWA/Cache)_: SW serves stale JS chunk URLs after a new deploy → unstyled page on direct URL visit (hard nav). Root cause: service worker caches asset URLs from the previous deploy; after a new build the chunk hashes change but the SW still serves the old (now-missing) URLs. Fix: document bypass + `no-store` headers on SW files shipped in Session 19. **Prod verification still open — TEST_CHECKLIST.md items unchecked.**

  Filed: 2026-06-08. Root cause clarified: 2026-06-15. Hotfix shipped: 2026-06-16.

- ~~**BUG-030** _(LOW)_: `/competitions/[id]` base route returns 404.~~ RESOLVED 2026-06-16 — `src/app/competitions/[id]/page.tsx` created with server-side `redirect()` to `[id]/standings`. Commit `3be1731`.

- ~~**BUG-031** _(LOW — Visual)_: `standings/page.tsx` renders raw teamLogo strings at 5 sites.~~ RESOLVED 2026-06-16 — All 5 sites (lines 395, 444, 561, 603, 642) replaced with `<TeamLogo>` component. Import added. Commit `bb0a1ed`.

- **BUG-032** _(MEDIUM — Data Integrity)_: 39 `match_events` rows have `player_id = NULL` on both staging and prod. Events logged without a player reference — goals, cards, or substitutions that were never linked to a player. They count toward match scores and team stats but cannot be attributed to any player, corrupting leaderboards and `playerStats`. Root cause unknown — likely events entered via the logger with no player selected, or backfill rows where CSV reconciliation failed to match a player. **No writes until root cause is confirmed. Do not include these events in any backfill run.** Relates to BUG-011 (playerStats corruption).

  Event IDs (identical on staging and prod): `PgCZ27rPw8puIrqGrn5ET`, `MOW5LnM7BnZPceo1EfNFG`, `0nRXEcu-47yWHnhzxnslR`, `mI8xLOJ9I9b9iYNj-4kJz`, `0V7jfxuB5Xx_QAKiQabJ2`, `VIBs_9slwaVOPDq2bVtoY`, `TUko0OhLCE3xZJL7fFjXz`, `Mky4ZzXeDsii0g0U6x4Lb`, `beDfnn98Kby7MHGqSu4Ih`, `hG-GiJofok53M9n1Dhid8`, `YCWEpHea96oNuwj0D7-SI`, `U9z2I58lOKa9knr02mZVz`, `yxeGjM1dncTLNFbpUVDGe`, `m_S_62bgcUyoxRow7dHZj`, `fRNnOokCdT-4PakPIkdyV`, `fQIeiSok9oJgiI-vyWepw`, `4tSgbmxI3Ck0ef66pkaNb`, `n7ZOn6tJdIz3Bh43Km8R2`, `4S7qyVWm7GtakOizaQWjc`, `oFk3adEagm1T7UZzjXPr5`, `Gd4Fi7XeuoDHSD-IHJjUf`, `3ETpELZx3t006Z-Mohbqx`, `-tN5u2EIsOJ8VsuC4_2G7`, `yAyzsTqkwiQlh5GfjKDBV`, `pDqf4GJggQpxvcP_gVnZW`, `5GG8B7NnXc3Z3fdHCxNIp`, `0hLgkDqfBHAbEpQY3sZLK`, `_PHNbJv4S4Ctq4Iq5lGYs`, `tF3EIAIj0L-X7rD4vt2lH`, `zNA4BBA1n-sE2saQODh82`, `S_vTbEW8q218pz5TgOuvF`, `2rSnM33hfnQ7FW3567CwV`, `7nhZ9HZaKziXUxfWpbKNL`, `95QMnbsU-kaskeVLahq-h`, `LmJmU-jFnFwXZAN_aIN2F`, `_PocAdTBo8G-Al-AysspK`, `tYruNu5Yr15Dlb2it4UkB`, `YNrvnIl5iPcT4y55ACdq7`, `0hYD6ESZNftfG7q2HTCL6`

  Filed: 2026-06-16.

### ~~BACKLOG-036 — TeamLogo component migration (second pass)~~
**Status:** COMPLETE — 2026-06-15
**Priority:** Low
**Filed:** 2026-06-13

TeamLogo component (`src/lib/utils/team-logo.tsx`) handles null/empty logos with initials fallback and `onError` handler. Second-pass migration complete: 13 files migrated, 5 skipped for size regression risk. commit: `a02283b`.

**Migrated (13 files):** `admin/manager`, `TrackLogger`, `admin/transfers`, `user/[userId]`, `search` (team only), `admin/livestreams`, `profile`, `logger`, `MatchLineups`, `LiveStats`, `lineup/MatchSelector`, `GlobalSearch` (team only), `FootballLogger`.

**Skipped (size-sensitive — raw `<img>` retained):** `admin/track-events/page.tsx`, `teams/[id]/page.tsx`, `lineup/TeamSelector.tsx`, `BasketballLogger.tsx`, `FullPitchLineups.tsx`. `comp.logo` instances in `search/page.tsx` and `GlobalSearch.tsx` intentionally excluded (competition logos, not team logos).

### BACKLOG-034 — Pre-Prod Clearance Script (Tier 1 → CI Gate)

**Status:** TIER 1 COMPLETE — script live at `dev/pre-prod-check.ts`
**Priority:** High
**Filed:** 2026-06-08

#### What was built

`dev/pre-prod-check.ts` — automated pre-merge clearance script. Run manually before every PR to `main`. Checks:

- Block 1: Auth gates (5 protected endpoints → 401 unauthenticated)
- Block 2: `/api/matches` response shape — banned NDPR fields absent, `round` present
- Block 3: DB integrity (null competitionId, dirty strings, entry counts)
- Block 4: Round distribution (normalisation complete)
- Block 5: Expected competitions present

Exit 0 = `[CLEAR TO MERGE]`. Exit 1 = `[BLOCKED]`. Ready for CI integration with zero changes.

#### Tier 2 — When BACKLOG-021 (GitHub Actions) is live

Convert to `.github/workflows/pre-prod-check.yml`. Trigger on PR to `main`. Pass staging env vars from GitHub Secrets. No script changes needed.

---

## Tech Debt

- **TD-001** _(IN PROGRESS)_: `src/lib/env.ts` created — typed `env` object and `validateEnv()` startup check in place. `middleware.ts` migrated to use `env.jwtSecret` and `env.isStaging`. Remaining work: migrate all other `process.env` reads across 30+ files, add Zod validation. Full migration deferred — do not scatter `process.env` reads in new code from this point forward.
- **TD-002**: Deduplication for event logging submissions on slow connections to prevent double-tap glitches.
- **TD-003**: Match status transitions need a proper state machine (PENDING → LIVE → FINISHED) with automated triggers.
- **TD-004**: Update `.env.example` to match the actual 29 keys discovered in the codebase (currently only lists 16).
- ~~**TD-005**: Atomic refactor for logger assignment — resolved as part of BUG-008 (2026-06-05). Transaction wraps check-then-insert in `assign-logger/route.ts`.~~
- ~~**TD-006**: Response sanitization for `/api/matches` email leak — resolved as part of BUG-007 (2026-06-05). Email stripped from public `assignedLoggers` select.~~
- **TD-007**: Bulk Register UX placement — `/admin/bulk-register` currently lives as a standalone route but registration flows (team + player creation) may belong inside the competition or team management context instead. Needs a UX review to determine the correct placement before the page grows further.
- ~~**TD-008**~~: `useLiveStandings.ts` — `teamLogo: string` type was wrong (should be `string | null`); `|| '❓'` emoji fallback masked null values causing `TeamLogo` to receive a literal emoji string. RESOLVED 2026-06-16 — type fixed to `string | null`, fallback changed to `null`. Commit `bb0a1ed`.

## Descoped Features (Future Work)

- Payment, sponsorship, or financial processing
- Social features (comments, reactions, follows, DMs)
- External league API integrations
- Automated video or AI-based score detection
- Push notification campaigns
- Advanced analytics dashboards
- Role-based access beyond the defined hierarchy

---

## Feature Backlog

### BACKLOG-041 — Nickname Search Integration in Logger Platform

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-13
**Note:** BACKLOG-037 Step 1 (nicknames column) complete on both staging and prod DBs. No longer blocked.

#### Problem
When a logger searches for a player during live logging, search matches only against `players.name` and `players.jerseyName`. Physical logsheets use field aliases ("Blacko", "No.7 LW") that don't match DB records, forcing loggers to search by full name mid-match.

#### Required Changes
Update player search in the logger interface to also query the `nicknames` JSON array on `player_team_affiliations`.
Match order: exact name → jerseyName → any nickname entry.
Flag nickname matches as lower confidence if needed — but return them.

---

### BACKLOG-040 — Schema Drift: organizations_slug_unique

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-13

#### Problem
`src/db/schema.ts` defines a unique index `organizations_slug_unique` on the `organizations` table, but this index does not exist in the live staging or prod DBs. Drizzle-kit `push` fails with `no such index: organizations_slug_unique` when it tries to reconcile the schema, blocking any future `db:push` runs.

#### Required Changes
Two options:
1. **Create the index in both DBs** — `CREATE UNIQUE INDEX organizations_slug_unique ON organizations (slug)` — run against staging, verify, then prod. Pre-check for duplicate slugs before applying.
2. **Remove the index from schema.ts** — if the slug uniqueness is not actually enforced anywhere.

Audit duplicate slugs first before deciding. Do not run db:push until this is resolved.

---

### BACKLOG-037 — Roster Builder

**Status:** OPEN — Steps 1-7 complete, Step 7b remaining
**Priority:** High
**Filed:** 2026-06-13

#### Problem
No UI or API exists to link existing players to teams without creating duplicate profiles. Bulk register always creates new player rows. The 68 intercollege players were fixed via a one-off script — this must be a repeatable, permanent flow.

#### Implementation Order

**Step 1 — Schema: unique constraint + nicknames column**
- Run dedup query on playerTeamAffiliations first
- Add unique index on (player_id, team_id)
- Add nicknames TEXT column (JSON array) to playerTeamAffiliations for field aliases ("Blacko", "No.7", "Small")
- Run db:push against staging then prod

**Step 2 — API: POST /api/admin/teams/[teamId]/roster**
- Auth: getAuthUser + role === 'admin'
- Discriminated union input:
  `{ mode: 'existing', playerId, jerseyNumber?, position? }`
  `{ mode: 'new', name, jerseyName, number, position, college?, university?, email?, nicknames? }`
- existing mode: verify player exists, check for existing affiliation row, INSERT if not found, skip if duplicate
- new mode: INSERT players row (no legacy teamId), INSERT affiliation row, call syncPlayerOrganizationAffiliations
- Per-entry response: inserted | skipped | error

**Step 3 — API: GET /api/players/search**
- Query params: q (name/nickname search), excludeTeamId
- Returns: id, name, jerseyName, position, current teams, college, university
- Nickname-aware: matches against nicknames JSON array in playerTeamAffiliations
- Auth: admin only

**Step 4 — UI: Roster Builder tab on team detail page**
- Route: /admin/teams/[id] — new "Manage Roster" tab
- Two modes per row: Add Existing | Create New
- Add Existing: search bar → results dropdown → jersey number + position override → confirm
- Create New: inline form same fields as bulk-register per-player row + nicknames field
- Batch submit all rows in one POST request
- Per-row feedback: inserted / skipped / error
- **UI note (fuzzy dedup):** Show a "similar players found" warning panel for any player where name similarity > 70% — let admin decide whether to link or create. Catches variants like "Chukwuemeka" vs "Chukwu" that the unique index and LOWER(name) check won't catch. This is a UI-layer concern, not enforced server-side.

**Step 5 — Bulk register pre-flight dedup** ✓ COMPLETE — 2026-06-15
- Pre-flight query by `LOWER(name)` + college before any INSERT. Match → skip with `reason: 'possible_duplicate'`, `matchedPlayerId`, `matchedPlayerName`. NPUGA email-reuse path exempted.

**Step 6 — CSV import tab on Roster Builder**
- Upload CSV: name/nickname, jersey number, position
- Preview table: auto-match against team's affiliated players (name + nickname aware)
- Each row shows match confidence: exact name → high, jerseyName → medium, nickname → medium, no match → unmatched
- Manual dropdown on any row for admin override (especially sub-threshold matches)
- Unmatched rows default to "Create New" mode
- Confirm → runs same POST /api/admin/teams/[teamId]/roster

**Step 7 — Squad Selector** ✓ COMPLETE — 2026-06-15
- Unique index `squad_players_team_comp_player_unique` added to both staging and prod DBs via SQL direct.
- API: `GET/POST /api/admin/teams/[teamId]/squad`, `GET /api/admin/teams/[teamId]/competitions`, `DELETE /api/admin/teams/[teamId]/squad/[squadPlayerId]`. All admin-gated.
- UI: Squad tab on `/admin/teams/[id]`. Competition dropdown → dual panel (available left / squad right). Two-click remove confirm. commit: `35af3a6`, `7c2cc69`.

**Step 7b (future) — Role assignment UI**
- Add captain, vice-captain, goalkeeper badge assignment per squad player
- role column already stored in squadPlayers (default 'player')
- UI: small role badge dropdown per player in the squad panel
- Do not build until Step 7 (basic add/remove) is verified on staging

#### Notes
- jerseyNumber on playerTeamAffiliations is per-team, separate from players.number — allow null (college football is loose with numbers)
- nicknames field solves the reconciliation problem: "Blacko" matches because the affiliation row stores it
- squadPlayers is Step 7 not Step 1 — get roster working first
- Related: BACKLOG-016 (original roster builder filing), BACKLOG-006 (bulk register existing player select), BACKLOG-018 (match event logsheets)

---

### BACKLOG-038 — Bulk Register Dedup Refinement

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-13
**Note:** BACKLOG-037 Step 5 (pre-flight dedup by name+college) is complete — the core dedup mechanism exists. This item covers the edge case: players registered via `playerTeamAffiliations` only (no legacy `teamId`) who would still bypass jersey number collision checks.

#### Problem
Bulk register's dedup check queries players.teamId (legacy column) for jersey number collision. A player registered via playerTeamAffiliations only (no legacy teamId) would not be caught — creating a duplicate profile.

#### Required Changes
Add pre-flight dedup to POST /api/players/bulk-register:
Before INSERT, search players WHERE name LIKE '%input.name%' AND college = input.college.
If match found with similarity > threshold:
- Add to skippedPlayers with reason: 'possible_duplicate'
- Include matched player id and name in response
- Do not insert

Admin can then use Roster Builder to link the existing player instead.

---

### BACKLOG-039 — Match Import CSV Nickname-Aware Reconciliation

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-13
**Note:** BACKLOG-037 Step 1 (nicknames column) complete on both staging and prod DBs. No longer blocked.

#### Problem
The existing backfill CSV reconciliation preview matches player names against name and jerseyName fields only. Physical logsheets use nicknames and field names ("Blacko", "No.7 LW") that don't match DB records.

#### Required Changes
Update the CSV reconciliation preview auto-match logic in /admin/past-matches/import to also search against the nicknames JSON array in playerTeamAffiliations.
Match order: exact name → jerseyName → any nickname.
Flag as 'needs_review' if only nickname match found (lower confidence).

---

### BACKLOG-035 — Sentry Configuration Cleanup

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-13

#### Problem
Four Sentry configuration warnings on every build:
1. disableLogger deprecated — use webpack.treeshake.removeDebugLogging
2. No instrumentation.ts file — server-side init incomplete
3. sentry.client.config.ts should be renamed to instrumentation-client.ts for Turbopack compatibility
4. No SENTRY_AUTH_TOKEN — source maps not uploading, releases not created

#### Required Changes
1. Add SENTRY_AUTH_TOKEN to Vercel env vars (prod + staging)
2. Create instrumentation.ts at project root for server init
3. Rename sentry.client.config.ts → instrumentation-client.ts
4. Fix disableLogger deprecation in next.config.ts: replace `disableLogger: true` with `webpack.treeshake.removeDebugLogging: true`

#### Notes
- Sentry is capturing errors today — this is fidelity improvement not a blocker
- Source maps needed for readable stack traces in dashboard
- Do not add real DSN values to source code

---

### BACKLOG-001 — Goal Type Breakdown in playerStats

**Status:** OPEN  
**Priority:** Medium  
**Filed:** 2026-06-04

#### Problem

`playerStats.goals` is a flat integer with no breakdown
by goal type. The leaderboard and player stat displays
cannot distinguish between open play goals, penalties,
and own goals.

`matchEvents` already stores the correct type strings:

- `'Goal'` — open play
- `'Penalty'` — penalty goal
- `'Own Goal'` — own goal

But `playerStats` has no corresponding columns to
aggregate these separately.

#### Required Changes

1. Add columns to `playerStats` in schema.ts:
   penaltyGoals integer default 0
   ownGoals integer default 0
   (goals column remains as total goals including pens,
   excluding own goals — mirrors football convention)

2. Run npm run db:push to migrate live DB.

3. Update src/app/api/matches/backfill/route.ts:
   - Increment penaltyGoals separately from goals
   - Do not increment goals OR penaltyGoals for ownGoals
   - Own goal scorer gets ownGoals incremented only

4. Update live logger stats increment path — find where
   playerStats is PATCH incremented after a live goal
   event and add incrementPenaltyGoals / incrementOwnGoals
   handling.

5. Update src/app/api/players/stats/leaders/route.ts
   to support type='penalties' and type='ownGoals'
   as leaderboard filter options.

6. Optionally — backfill penaltyGoals from existing
   matchEvents rows where type = 'Penalty' for all
   players who have historical event data.

#### Notes

- Data is NOT lost — matchEvents already has correct
  type strings. A backfill from events is possible
  at any time.
- The backfill script/UI already sends penalties and
  ownGoals as separate fields to the endpoint — the
  endpoint just needs to write them to new columns.
- Own goals should NOT count toward a player's goals
  tally per standard football convention.
- This is a non-urgent enhancement. Current leaderboard
  shows correct total goals, just without pen breakdown.

---

### BACKLOG-003 — Competition Start/End Date Fields

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-04

#### Problem

startDate and endDate exist in the competitions schema
as timestamp columns but are never wired anywhere:

- Not destructured in POST /api/competitions handler
- Not in the create or edit modal UI
- Not displayed on competition pages
- Always stored as null

Additionally the PATCH /api/competitions/[id] handler
has a live crash bug on these fields:
if (startDate !== undefined)
updateData.startDate = new Date(startDate);
If startDate arrives as empty string, new Date("")
produces Invalid Date and crashes the insert.
This is currently dormant because the UI never sends
these fields — but will break the moment they are added.

#### Required Changes

1. Fix PATCH handler null-safety first before exposing
   fields in UI:
   if (startDate !== undefined && startDate !== '') {
   updateData.startDate = new Date(startDate);
   }
   Same guard for endDate.

2. Add to POST handler — destructure and insert:
   startDate: body.startDate
   ? new Date(body.startDate) : null,
   endDate: body.endDate
   ? new Date(body.endDate) : null,

3. Add to CompetitionModal in competitions/page.tsx:
   Two date inputs (type="date"), optional.
   Convert selected value to ISO string before sending.
   Show as "Season Start" and "Season End".
   Only show if isMultiSport is false or always —
   design decision at implementation time.

4. Display on competition detail page and public
   competition page where relevant.

#### Notes

- Fix the PATCH crash bug BEFORE adding UI fields
- Both fields are nullable — empty = not set, valid state
- Store as timestamp integer in Turso (schema uses
  integer mode for these columns)
- Convert: new Date(dateString).getTime() for insert
  not new Date(dateString) directly

---

### BACKLOG-002 — Competition Archive & Delete

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-04

#### Problem

No archive or delete functionality exists for competitions.
Edit button now works but there is no way to hide or
remove a competition from public view.

#### Required Changes

1. Add archive toggle — PATCH sets isArchived: true.
   Button in competition row: "Archive" if not archived,
   "Unarchive" if already archived.
   Archived competitions hidden from public pages but
   visible in admin with a muted/greyed style.

2. Add soft delete — only if competition has zero matches
   AND zero standings rows. Hard block with clear message
   if data exists: "Cannot delete — X matches recorded."

3. Add force delete (dev/test only) — bypasses the guard.
   Requires typing the competition name to confirm.
   Clearly labeled destructive. Consider hiding behind
   a dev mode flag or separate admin permission level.

4. DELETE /api/competitions/[id] endpoint needs building.
   Currently does not exist. Should:
   - Check matches count for this competitionId
   - Check standings count
   - If either > 0 → 409 with counts in response
   - If both 0 → hard delete all related rows + competition
   - Support ?force=true query param for force delete

#### Notes

- isArchived column already exists in schema (boolean)
- Archive is zero-risk, just a PATCH — do this first
- Delete is higher risk — do after archive is verified
- Force delete should log to Sentry when used

---

### BACKLOG-004 — Multi-Sport Competition Display & Structure

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-04

#### Problem

Multi-sport competitions (e.g. Bells Intercollege) span
multiple sports but the system currently has no way to
group them under one parent competition with sport
sub-categories.

A competition like "BELLS INTERCOLLEGE" should display
as:
BELLS INTERCOLLEGE (Football)
BELLS INTERCOLLEGE (Basketball)
BELLS INTERCOLLEGE (Volleyball)
BELLS INTERCOLLEGE (Track & Field)

Each sport category is a separate tracked competition
with its own matches, standings, and stats — but they
all belong to the same parent umbrella competition.

#### Current Behaviour

isMultiSport is a boolean flag on the competitions row.
It has no parent-child relationship with sport-specific
child competitions. Checking it just sets the flag —
nothing else happens structurally.

#### Required Changes

1. SCHEMA — Add parentCompetitionId to competitions:
   parentCompetitionId: text('parent_competition_id')
   .references(() => competitions.id)
   Nullable — null means it is a top-level competition.
   Run npm run db:push after schema change.

2. COMPETITION CREATION FLOW — When isMultiSport is
   checked and the form is submitted, after creating
   the parent competition row, automatically create
   child competition rows for each selected sport:

   Parent row:
   name: "BELLS INTERCOLLEGE"
   isMultiSport: true
   sport: null

   Child rows (one per sport selected):
   name: "BELLS INTERCOLLEGE (Football)"
   isMultiSport: false
   sport: "Football"
   parentCompetitionId: parent.id
   level, season, scope, format — inherited from parent

3. COMPETITION MODAL — When isMultiSport is checked,
   show a multi-select for sports:
   □ Football □ Basketball □ Volleyball □ Track & Field
   Admin checks which sports are included.
   On submit — creates parent + one child per checked sport.

4. COMPETITIONS LIST — Group child competitions under
   their parent in the admin list. Show parent as a
   header row with children indented below it.
   Public competition page shows the parent with
   sport category tabs/links.

5. MATCHES — When creating a match under a multi-sport
   competition, admin selects the sport-specific child
   competition (e.g. "BELLS INTERCOLLEGE (Football)")
   not the parent. The parent is just an umbrella.

6. STANDINGS & STATS — Each child competition has its
   own independent standings, stats, and leaderboards.
   The parent competition page aggregates and links
   to each child.

7. DISPLAY FORMAT — Everywhere a competition name
   appears (match cards, livescore, admin lists):
   - Child competition shows as:
     "BELLS INTERCOLLEGE (Football)"
   - Or short form on cards: "Intercollege · Football"

#### Implementation Order

1. Schema migration (parentCompetitionId)
2. API — POST creates children when isMultiSport
3. Admin modal — sport multi-select when isMultiSport
4. Admin list — grouped display
5. Public pages — parent page with sport tabs
6. Match creation — filters to child competitions only

#### Notes

- Bells Intercollege is the first use case —
  5 colleges, Football + Basketball minimum
- Current Bells Intercollege competition created
  as a single-sport row — will need to be migrated
  or recreated once this feature lands
- This is a significant feature, not a small fix.
  Do not attempt in a single session.
- All existing single-sport competitions are
  unaffected — parentCompetitionId will be null
  for all of them.

---

### BACKLOG-019 — Post-Match Lifecycle Audit + Automation

**Status:** OPEN
**Priority:** High
**Filed:** 2026-06-07
**Blocked by:** Phase 1 (staging environment) — do not touch on prod

#### Problem

The full post-match event chain is unaudited. It is unknown which
steps are automated vs manual vs broken. The chain is:

```
goal scored
  → matchEvents row inserted
    → match homeScore / awayScore updated
      → competition standings recalculated
        → playerStats incremented
          → playerRatings recalculated
```

Currently, backfill and standings updates are triggered manually
via admin endpoints or scripts. There are no automated hooks that
fire when a match transitions to FINISHED. This means standings and
player stats can be stale or inconsistent after a match ends.

#### Required Changes

1. **Audit phase** — map every step of the chain:
   - Which steps fire automatically (in the event POST handler)?
   - Which require a manual admin trigger?
   - Which have no trigger at all?
   - Are there any steps that silently fail (no error, wrong result)?
   - Cross-reference the architecture assessment in
     `.agents/dev/PROJECT_HISTORY.md` before starting.

2. **Automation hook** — when a match `status` transitions to
   `FINISHED` (via PATCH `/api/matches/[id]`):
   - Trigger standings recalculation for the match's `competitionId`
   - Trigger `playerStats` derivation from all `matchEvents` rows
     for that `matchId` (goal tally, assists, cards, minutes played)
   - Trigger `playerRatings` recalculation for all involved players
   - All three must be atomic-safe: partial failure should not
     leave standings and stats in a split state

3. **Idempotency** — the hook must be safe to re-trigger:
   - Re-processing a FINISHED match must produce the same result
   - Dedup logic required to prevent double-counting events

4. **Observability** — log each hook execution to Sentry (once
   BACKLOG-011 is resolved) with match ID, trigger time, and result
   counts (standings rows updated, players updated, ratings updated)

#### Notes

- Do NOT implement on prod without a staging environment in place
  (Phase 1 / BACKLOG-005). The automation touches standings and
  playerStats — corruption here is difficult to reverse
- BUG-011 (718 goals anomaly) is evidence of what happens when
  backfill runs without dedup — this feature must not repeat that
- playerStats BACKLOG-001 (penaltyGoals / ownGoals columns) should
  be resolved before this hook is built — otherwise the hook will
  not capture the full stat breakdown
- Related: BACKLOG-001, BACKLOG-011 (BUG-011), BACKLOG-005 Phase 1

---

### BACKLOG-018 — Game Event Logsheets (BUSALYMPICS match events)

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-07
**Blocked by:** BACKLOG-016 (Roster Builder — player name mapping UI needed first)

#### Problem

All BUSALYMPICS match fixtures will exist in the DB but the
`matchEvents` table has no rows for these games. Without events,
player stats (goals, assists, cards, ratings) cannot be derived.
Physical logsheets from each match need to be transcribed.

#### Required Changes

Once BACKLOG-016 (Roster Builder + CSV import with player mapping)
is in place:

1. Collect physical logsheets for all BUSALYMPICS matches.
2. For each match — enter events via the match event logger or
   the CSV import flow: goals (minute, player, team), yellow/red
   cards, substitutions.
3. After all events are entered, trigger backfill to recalculate
   `playerStats` from `matchEvents` for affected players.
4. Verify standings and leaderboards update correctly.

#### Notes

- Do not attempt manual SQL entry for events — the player name
  mapping UI (BACKLOG-016) is required to avoid duplicate profiles
- Relates to BUG-011 (playerStats anomaly) — run dedup audit
  before backfill to ensure clean baseline

---

### ~~BACKLOG-017 — Missing BUSALYMPICS Match Scores~~

**Status:** RESOLVED — 2026-06-14. All 3 scores confirmed and patched (staging + prod). MD3 G1: COLNAS 3–1 COLENVS. MD3 G2: COLMANS 0–1 COLENG. All 7 fixtures FINISHED.
**Priority:** HIGH — standings still blocked until all scores confirmed
**Filed:** 2026-06-07
**Updated:** 2026-06-14

#### Status

All 3 fixtures were inserted as `status: UPCOMING` on 2026-06-07 via
`dev/fix-busalympics-remaining-fixtures.ts`. All 7 BUSALYMPICS
fixtures now exist in the DB.

**MD2 G1 CONFIRMED — 2026-06-08:**
`a9CtLwotaXyfsfMf2odAM` PATCHed to FINISHED. COLNAS 1–2 COLENG.

#### Fixture IDs — remaining

| ID                      | Matchday | Home    | Away    | Date       | Status                      |
| ----------------------- | -------- | ------- | ------- | ---------- | --------------------------- |
| `_9nntLoOZZOZGzja8EQE9` | MD3 G1   | COLNAS  | COLENVS | 2026-04-26 | **UPCOMING — score needed** |
| `y3KcCGtHA7N7MybKTHX5K` | MD3 G2   | COLMANS | COLENG  | 2026-04-29 | **UPCOMING — score needed** |

#### Remaining action

Once scores confirmed from physical records:

1. PATCH each match: `{ status: "FINISHED", homeScore: X, awayScore: Y }`
2. Then run BACKLOG-033 (standings recalculation for `9q8LMVqW8KAtF4BJBlyk_`).

#### Notes

- Do not estimate or backfill with placeholder scores
- Do not run standings until BOTH MD3 fixtures are FINISHED (see BACKLOG-033)

---

### BACKLOG-016 — Roster Builder (Replace / Supplement Bulk Register)

**Status:** OPEN
**Priority:** High
**Filed:** 2026-06-07

#### Problem

`/admin/bulk-register` always creates new player rows in non-NPUGA
paths. There is no way to roster an existing player onto a new team
without duplicating their profile. The intercollege roster (68
players across COLNAS/COLENG/COLMANS/COLENVS) was fixed via a
manual one-off script — this needs to be a repeatable UI flow.

Current gaps:

- No search-by-name / search-by-org to find existing players
- No way to add a `playerTeamAffiliations` row without creating a
  new `players` row
- No DB-level uniqueness enforcement on `(playerId, teamId)` in
  `playerTeamAffiliations` — dedup is only checked in application
  code (non-atomic, race-prone — same pattern as BUG-008)
- Endpoint has no auth gate (BUG-013)

#### Required Changes

1. **DB constraint** — add unique index on `(player_id, team_id)` to
   `player_team_affiliations`. This is the foundational fix; all
   other changes build on it. Run `db:push` after schema change.

2. **API** — `POST /api/admin/players/roster` (new endpoint):
   - Auth-gated: `getAuthUser` + `role === 'admin'`
   - Accepts: `{ teamId, players: Array<RosterEntry> }`
   - `RosterEntry` is a discriminated union:
     - `{ mode: 'existing', playerId, jerseyNumber?, position? }`
       → inserts `playerTeamAffiliations` row only
     - `{ mode: 'new', name, jerseyName, number, position, ... }`
       → creates `players` row + `playerTeamAffiliations` row
   - Returns per-entry result: inserted | skipped (duplicate) | error

3. **UI** — `/admin/roster-builder` or integrated into team detail
   page. Per-row toggle: "Existing Player" | "New Player".
   - "Existing Player" mode: live search against `/api/players`
     filtered by name or org. Selecting pre-fills name + position.
     Submit creates only the affiliation row.
   - "New Player" mode: same fields as current bulk-register.
   - Batch submit — all rows sent in one request.
   - Clear success/skip/error feedback per row.

4. **Placement** — should live inside the team detail page
   (`/admin/teams/[id]`) as a "Manage Roster" tab, not as a
   standalone route. Resolves TD-007 (bulk-register placement review).

5. **CSV Import with preview + manual player mapping** — upload a
   CSV of match or roster data → preview screen renders each row →
   shorthand / nickname names are matched to real player profiles
   via a dropdown sourced from the target team's roster →
   unmatched rows are flagged for manual resolution → confirm →
   import runs only on confirmed rows.
   - CSV columns (minimum): name/nickname, jersey number, position
   - Preview table: one row per CSV line, match status
     (auto-matched | needs review | no match found)
   - Auto-match logic: fuzzy name match against `jerseyName` and
     `name` fields on players affiliated to the target team
   - Manual override: dropdown per unmatched row, searchable,
     shows jersey number + position to disambiguate
   - Confirm step before any DB writes
   - Similar pattern to the current backfill import UI but for
     roster data with existing players rather than match events

#### Notes

- Blocked by: BUG-013 (auth gate) must be fixed first
- DB constraint (step 1) is a breaking migration if duplicate rows
  already exist — run a dedup query before applying
- Existing bulk-register can remain for NPUGA/multi-university use
  cases where teams are always new; this is additive, not a rewrite
- Related: BACKLOG-006 (select existing players in bulk-register),
  TD-007 (bulk-register placement), BUG-013 (missing auth gate)

---

### BACKLOG-061 — Competition Detail Page: Tab Audit & Completeness

**Status:** OPEN — trace complete, ready for implementation
**Priority:** Medium
**Filed:** 2026-06-16

#### Problem

The competition detail experience is split across two divergent implementations with no shared code:

1. **`/competitions` split-pane** (`src/app/competitions/page.tsx`) — left panel = competition list, right panel = Standings/Matches/Brackets tabs. Matches and Brackets work here. Standings is a basic table only (no TopScorers/Discipline).

2. **`/competitions/[id]/standings`** (`src/app/competitions/[id]/standings/page.tsx`) — richer tab set (Standings/Top Scorers/Assists/Discipline/Rules) but Matches and Brackets are absent. TopScorers/Assists/Discipline are empty shells (`players={[]}`). Rules is hardcoded mock text. Logo rendering is broken (BUG-031).

Additionally `/competitions/[id]` (base route) returns a 404 — BUG-030.

#### Scope — verified status after trace (2026-06-16)

| Tab | Route | API | UI status |
|-----|-------|-----|-----------|
| Standings | `GET /api/competitions/[id]/standings` | ✅ built | ✅ rendering real data — BUG-031 (logo) |
| Matches | `GET /api/competitions/[id]/fixtures` | ✅ built | ✅ works in split-pane only — not in `[id]/standings` |
| Brackets | `GET /api/brackets?competitionId=` | ✅ built | ✅ works in split-pane + football page — not in `[id]/standings` |
| Top Scorers | `GET /api/competitions/[id]/stats?type=scorers` | ✅ built | ❌ empty shell — fetch not wired |
| Top Assists | `GET /api/competitions/[id]/stats?type=assists` | ✅ built | ❌ empty shell — fetch not wired |
| Discipline | `GET /api/competitions/[id]/stats?type=discipline` | ✅ built | ❌ empty shell — fetch not wired |
| Teams | `GET /api/competitions/[id]/teams` | ✅ built | ❌ no UI tab anywhere |
| Rules | `GET /api/competitions/[id]/match-settings` | ✅ built (Phase A data live) | ❌ hardcoded mock — fetch not wired |

#### Bugs filed from this audit

- **BUG-030** — `/competitions/[id]` base route returns 404. Needs `page.tsx` that redirects to `/competitions/[id]/standings`.
- **BUG-031** — `StandingsRow`, `StandingsMobileCard`, `TopScorersTable`, `TopAssistsTable`, `DisciplinaryTable` in `standings/page.tsx` all render `{team.teamLogo}` / `{player.teamLogo}` as a raw string span. Must replace with `<TeamLogo>` at 5 sites (lines 395, 444, 561, 603, 642).

#### Additional finding

`src/components/FixtureCard.tsx` still uses raw `<img>` tags for team logos (not `TeamLogo` component). Not in the `[id]` route but used in other pages. Track separately.

#### Implementation order

1. **BUG-030** — create `src/app/competitions/[id]/page.tsx` with redirect to `[id]/standings` (1 file, ~5 lines)
2. **BUG-031** — replace 5 `{team.teamLogo}` spans with `<TeamLogo>` in `standings/page.tsx`
3. **Wire Top Scorers/Assists/Discipline** — add 3 `useEffect` fetches to `standings/page.tsx`, pass real data to existing shells
4. **Wire Rules tab** — fetch `GET /api/competitions/[id]/match-settings`, replace hardcoded points/format text with real Phase A data
5. **Teams tab** — add new tab + fetch to `standings/page.tsx` using `GET /api/competitions/[id]/teams`
6. **Matches tab** — add as sixth tab using `GET /api/competitions/[id]/fixtures`, grouped by status (Live → Upcoming → Results). Reuse or adapt `MatchCard` (already uses `TeamLogo`)
7. **Brackets tab** — add seventh tab using `GET /api/brackets?competitionId=`. Extract the inline bracket renderer from `competitions/page.tsx` into a shared component
8. **Architecture decision** — once `[id]/standings` is complete, evaluate whether to retire the split-pane standings view or keep both

#### Notes

- All APIs are already built and functional — this is purely UI work
- `MatchCard` (`src/components/ui/MatchCard.tsx`) already uses `TeamLogo` correctly — safe to reuse for Matches tab
- `stats/route.ts` queries `playerStats` for discipline (card counts), not raw `matchEvents` — discipline data availability depends on `playerStats` being populated for the competition
- Bells-specific priority: Top Scorers + Discipline are highest viewer value for BUSALYMPICS and BUSA League. Brackets only matter for BUSA League KO stage.
- Do not build items 6–8 before items 1–4 are verified on staging

---

### BACKLOG-064 — Duplicate single-name basketball players (joseph × 2, leo × 2)

**Status:** OPEN — confirmed distinct people, low priority
**Priority:** Low
**Filed:** 2026-06-16

#### Finding

Integrity audit found 2 exact-match name collisions:
- `joseph` × 2: `r-GRRz8IbecIZ5UIiOIP-` (Rim Reapers Basketball) and `wt7u32zwM8Q3tbznYPMjj` (Siberia Basketball)
- `leo` × 2: `k-5lN92Hfj0T5rmoM0Xch` (Siberia Basketball) and `vr76h3RUb4i-ZAq24Zu7S` (Rim Reapers Basketball)

Both pairs are different clubs, different IDs. These are **not duplicates** — they are two different players who share the same single-name display label. Confirmed from Session 20 investigation.

#### Required Change

Disambiguate the display names so scoreboards and leaderboards don't collapse them:
- `joseph` (Rim Reapers) → `joseph (RR)` or `joseph (Rim Reapers)`
- `joseph` (Siberia) → `joseph (SIB)` or `joseph (Siberia)`
- Same pattern for the two `leo` entries

This is a UI concern — the player rows are correct in the DB. The leaderboard / playerStats display just needs to differentiate when two players share the same name.

#### Notes

- Do not merge these records — they are distinct people
- Rename at the player row level (UPDATE players SET name = ...) rather than in display code — source-of-truth fix
- Cross-check with the logger who registered them before renaming

---

### BACKLOG-063 — BUSA FC stub teams with zero affiliations

**Status:** OPEN — low risk, low priority
**Priority:** Low
**Filed:** 2026-06-16

#### Finding

12 BUSA-prefixed football club teams exist with zero player affiliations:
`Agenda FC`, `Allianz FC`, `Cruise FC`, `Deadline FC`, `La Fabrica`, `Legacy FC`, `Prime FC`, `Quantum FC`, `Santos`, `Underrated FC`, `Westbridge`, `Wolves FC`

All have `busa-*` IDs suggesting they were seeded as future or historical clubs — not the same as the NPUGA university scaffolding (which is explicitly known-future). These could be:
1. Former BUSA clubs that no longer field teams
2. Placeholder clubs created ahead of a new season
3. Teams that were bulk-created but never had players registered

#### Required Action

Before deleting: confirm with Richard whether any of these clubs are expected to field players in an upcoming season. If none are active, delete as a batch (same pattern as Bells stub cleanup). If any are upcoming, mark them with a note.

#### Notes

- Same FK bloat risk as the Bells stubs — run the same pre-flight checks (affiliations, matches, users.favorite_team_id) before any delete
- `Joga-Bonito` (21 players) is NOT in this list — it is an active club
- `Westbridge` and `Wolves FC` sound like active clubs — verify before touching

---

### ~~BACKLOG-062 — Player Modal: College Select + University Lock~~

**Status:** COMPLETE — 2026-06-16. Commit `f0070e0`.
**Priority:** Medium
**Filed:** 2026-06-16

#### Problem

The player create/edit modal (`src/app/admin/players/page.tsx`) uses free-text `<input>` fields for `college` and `university`. This is the root cause of the DB casing inconsistencies fixed in Session 20 (`ColEng`, `Colmans`, `''`). An admin can type any value and create new dirty variants.

#### Required Changes

1. **College** (line 671) — replace `<input type="text">` with `<select>`:
   ```tsx
   <select value={formData.college || ''} onChange={...}>
     <option value="">None</option>
     <option value="COLENG">College of Engineering</option>
     <option value="COLENVS">College of Environmental Sciences</option>
     <option value="COLMANS">College of Management Sciences</option>
     <option value="COLNAS">College of Natural & Applied Sciences</option>
   </select>
   ```
   Only 4 canonical values. Free-text input must be removed entirely.

2. **University** (line 661) — change to read-only display. The auto-populate useEffect (line 122-129) already sets university from the selected team. The input is editable but shouldn't be — a typo here corrupts the university field for the player. Options:
   - Make it `readOnly` (show value, prevent typing)
   - OR replace with a `<p>` display element that shows the auto-populated value
   - Either way: admin should NOT be able to type a custom university string

3. **Position** (line 621) — optionally convert to `<select>` with standard positions (GK, CB, RB, LB, CDM, CM, CAM, RW, LW, CF, ST). Lower priority — less data corruption risk.

#### Notes

- College cleanup script (`dev/fix-player-college-university.mjs`) ran against staging 2026-06-16. Must run on prod before shipping this modal fix, otherwise modal will show `ColEng` etc. in the select and break validation.
- PATCH `/api/players/[id]` already accepts college as a plain string — no API change needed, just UI enforcement.

---

### BACKLOG-015 — Organizations Detail / Drill-Down Page

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-07

#### Problem

`/admin/organizations` is a list-only view. There is no detail page
for a single organization. Clicking an org card leads nowhere.
All org management (editing, seeing what it owns, seeing its
members) is inaccessible from the UI.

#### Required Changes

1. Create route `/admin/organizations/[id]/page.tsx`.

2. Page sections:
   - Org info header — name, type, status, parent, location.
     Edit controls inline or via modal (PATCH `/api/admin/organizations/[id]`).
   - Child organizations — list of direct children with links.
   - Owned teams — list of teams where `ownerOrganizationId = org.id`,
     each linking to the team roster.
   - Affiliated players — players from `playerOrganizationAffiliations`
     where `organizationId = org.id`, count + paginated list.
   - Hosted competitions — competitions where `hostOrganizationId = org.id`.
   - Governed competitions — competitions where `governingOrganizationId = org.id`.

3. API: `/api/admin/organizations/[id]` GET — return all of the above
   in a single shaped response. Auth-gated (admin only).

4. Navigation: org cards on the list page should link to `[id]` detail.

#### Notes

- Blocked by nothing — can be built independently
- The `organizationsRelations` in schema.ts already defines all the
  joins needed: `ownedTeams`, `hostedCompetitions`,
  `governedCompetitions`, `playerAffiliations`, `childOrganizations`
- PATCH `/api/admin/organizations/[id]` does not exist yet — needs
  building alongside the detail page
- Relates to BACKLOG-004 (multi-sport competitions) — once parent
  competitions exist, this page is where you'd see them grouped

---

### BACKLOG-005 — Next Phase Roadmap

**Status:** OPEN
**Priority:** High
**Filed:** 2026-06-04

#### Phase 1 — Dev/Production Infrastructure

- Set up staging branch (dev/staging) separate from main
- Deploy staging to Vercel as separate project or
  preview deployment with its own env vars
- Separate Turso DB for staging vs production
- Separate Railway WS server for staging
- Environment parity checklist — staging must mirror
  prod config exactly minus real data
- Git branching strategy: main = prod, dev = staging,
  feature branches off dev

#### Phase 2 — Bug Fixes & Pending Blockers

- Fix all OPEN bugs from original audit:
  BUG-001 middleware bypass /api/admin/\*
  BUG-002 admin routes missing getAuthUser
  BUG-003 debug auth endpoint /api/auth/test (DELETE FILE)
  BUG-004 hardcoded createdBy: 'admin-1'
  BUG-005 unbounded queries (partially fixed)
  BUG-006 XSS via dangerouslySetInnerHTML
  BUG-007 assignedLoggers emails exposed in public API
  BUG-008 duplicate logger assignment race condition
- Fix team logo path issue (local paths vs Cloudinary URLs)
- Fix SAVE/BLOCK casing mismatch
  (frontend PascalCase vs calculator UPPERCASE)
- Fix Goal/GOAL casing mismatch in rating calculator
- Fix startDate/endDate PATCH crash (BACKLOG-003)
- Fix competition creation NaN console warnings

#### Phase 3 — UI & Experience Cleanup

- Full UI audit across all public and admin pages
- Consistent loading states everywhere
- Error boundary components for all major sections
- Empty states for all list views
- Mobile responsiveness audit — admin and public
- Fix all console warnings and errors
- Accessibility pass — labels, focus states, contrast

#### Phase 4 — Pending Competitions & Live Data

- Audit all competitions not yet tracked in system
- Create missing competitions with correct structure
- Backfill all untracked historical matches
- Validate standings accuracy for all competitions
- Synchronisation system for physical sheets —
  DONE: backfill script + import UI built this session

#### Phase 5 — System Audit & Testing

- Get full list of all modules, features, routes,
  API endpoints, DB tables, components
- Map every feature to its status:
  Working / Partial / Broken / Not built
- Fix or backlog everything partial or broken
- Unit tests — all utility functions and services
- Integration tests — all API routes
- E2E tests — all critical user flows:
  Match creation → logger assignment → live logging
  → public viewer → match end → stats update
- Load testing — k6 scripts already written:
  Test 1: viewer load
  Test 2: logger burst  
  Test 3: combined match day simulation

#### Phase 6 — Tier Validation

- Audit current system against MVP definition
- Research non-negotiable production requirements:
  Page visit tracking
  Fingerprinting and IP logging
  Analytics and KPIs
  Performance monitoring (Core Web Vitals)
  Error rate tracking (Sentry already installed)
  Uptime monitoring
  Rate limiting on all public endpoints
  GDPR/NDPR compliance audit
  Security headers (CSP, HSTS, etc)
- Determine: are we MVP or production ready?
- Define the gap and prioritise what blocks
  production launch

#### Phase 7 — Revenue & Monetisation

- Ads system — admin interface for managing ads
- Manager center — full feature audit and completion
- System banners and announcements interface
- Google AdSense integration research
- Direct sponsorship/banner ad system
- Other revenue streams research:
  Premium competition features
  Team/player profile upgrades
  Data API access for third parties
  Livestream monetisation

#### Phase 8 — End to End Testing

- Full E2E test suite covering every user role:
  Admin, Manager, Logger, Public viewer
- Performance benchmarks
- Security penetration testing
- Cross-browser and cross-device testing
- Final sign-off checklist before production launch

#### Notes

- Physical sheet sync is DONE —
  backfill script + import UI built this session
- Staging infrastructure is the first unblock —
  nothing else in Phase 2+ should touch prod directly
- Tier validation (Phase 6) should happen BEFORE
  Phase 7 — no point building revenue features on
  an unstable foundation
- Full module/feature inventory should be the
  first task of Phase 5 — everything else depends on it

---

### BACKLOG-006 — Bulk Register: Select Existing Players

**Status:** OPEN  
**Priority:** Medium  
**Filed:** 2026-06-05

#### Problem

Bulk Player Registration (`/admin/bulk-register`) only
supports creating new player profiles from scratch.
There is no way to select or link existing players
already in the DB to a team during bulk registration.

This causes duplicate player profiles when the same
player has played in multiple competitions — they get
registered fresh each time instead of reusing their
existing profile.

#### Required Changes

1. Add a search/select mode to each player row in
   the bulk register form:  
   Toggle per row: "New Player" | "Existing Player"

2. "Existing Player" mode shows a searchable dropdown
   fetching from `/api/players` with name search.
   Selecting a player pre-fills name, jersey name,
   position from their existing profile.
   On submit — links existing `playerId` to the team
   via a new `teamId` assignment or affiliation record
   rather than creating a duplicate profile.

3. Consider player affiliations table — a player can
   belong to multiple teams across competitions.
   Check if `playerTeamAffiliations` already exists
   in schema before building (it does — verify usage).

#### Notes

- Critical for Bells Intercollege where players from
  existing BUSA teams may also play for their college teams
- Duplicate profiles corrupt leaderboards and stats
- `playerTeamAffiliations` table already exists in schema —
  the link mechanism is there, the UI just doesn't use it
- Fix before next major bulk registration event
- Related: TD-007 (bulk register placement review) —
  resolve placement question before adding more features
  to this page

---

### ~~BACKLOG-007 — Fix Orphaned Intercollege Teams~~

**Status:** RESOLVED — 2026-06-07 (Session 4)  
**Priority:** High  
**Filed:** 2026-06-05

All 4 teams linked to their org via `dev/fix-backlog007.ts`. Verified live 2026-06-08:

- `mhXc8I0hBxe5W6eCw3do9` (College of Natural & Applied Sciences / CNAS) → `org_org_bells-university-colnas`
- `k6BgZFG_mtatQ11NZNQb9` (College of Engineering / CENG) → `org_org_bells-university-coleng`
- `ISzKeGGXuvW2h5QGmnWcp` (College of Management Sciences / CMANS) → `org_org_bells-university-colmans`
- `U6R7aZSXNvA0iMsdVi3XV` (College of Environmental Sciences / CENVS) → `org_org_bells-university-colenvs`

---

### ~~BACKLOG-008 — Enrol Intercollege Teams in Competitions~~

**Status:** RESOLVED — 2026-06-07 (Session 4)  
**Priority:** High  
**Filed:** 2026-06-05

4 rows inserted into `competition_team_entries` via `dev/fix-backlog008.ts`. Verified live 2026-06-08:

- College of Engineering → BUSALYMPICS (FOOTBALL) (`9q8LMVqW8KAtF4BJBlyk_`)
- College of Environmental Sciences → BUSALYMPICS (FOOTBALL)
- College of Management Sciences → BUSALYMPICS (FOOTBALL)
- College of Natural & Applied Sciences → BUSALYMPICS (FOOTBALL)

All entries: `sport: Football`, `gender: male`, `status: registered`

---

### BACKLOG-009 — Remove Vestigial next-auth Package

**Status:** OPEN  
**Priority:** Low  
**Filed:** 2026-06-05

#### Problem

Two auth systems coexist: custom JWT (active) and `next-auth@4.24.13` (vestigial, unused). The `next-auth` package is dead weight and increases attack surface.

#### Required Changes

Audit all imports of `next-auth` across the codebase. If confirmed unused, remove the package and any associated config files (`[...nextauth]` route if it exists).

---

### BACKLOG-010 — Audit and Remove Unused Email Providers

**Status:** OPEN  
**Priority:** Low  
**Filed:** 2026-06-05

#### Problem

Three email providers are installed: `@aws-sdk/client-ses`, `resend`, `nodemailer`. It is unclear which is the active provider. Unused packages should be removed.

#### Required Changes

Trace all email-sending code paths. Identify the active provider. Remove unused packages from `package.json`.

---

### ~~BACKLOG-011 — Install and Configure Sentry~~

**Status:** RESOLVED — 2026-06-07

`@sentry/nextjs@10.56.0` installed (exact pin). Configured via:

- `sentry.client.config.ts` — browser instrumentation + session replay
- `sentry.server.config.ts` — server-side instrumentation
- `sentry.edge.config.ts` — edge runtime instrumentation
- `next.config.ts` — wrapped with `withSentryConfig` (source maps, tunnel route `/monitoring`, logger tree-shake)
- `src/app/global-error.tsx` — captures unhandled errors via `Sentry.captureException`
- `.env.example` — `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` added

**To activate:** add real DSN values to `.env.local` and Vercel project env vars.

---

### BACKLOG-012 — Pin All Production Dependencies

**Status:** OPEN  
**Priority:** Medium  
**Filed:** 2026-06-05

#### Problem

30+ production dependencies are unpinned (using `^` prefix), violating the global project rule of exact version pinning for production deps.

#### Required Changes

Run a dep audit. Pin all `^` and `~` prefixed production deps in `package.json` to exact versions. Lock file should already reflect what is installed — use it as the source of truth.

---

### BACKLOG-013 — Audit Stripe Installation

**Status:** OPEN  
**Priority:** Low  
**Filed:** 2026-06-05

#### Problem

`stripe` is installed in `package.json` but payments are explicitly out of scope. The package may be dead weight or wired to unreachable code paths.

#### Required Changes

Audit all `stripe` imports. If unused, remove the package. If wired up partially, document what exists and leave dormant until Phase 7 (Revenue & Monetisation).

---

### BACKLOG-020 — Phase 6: Architecture, Audit & Backscoping

**Status:** OPEN  
**Priority:** High  
**Filed:** 2026-06-08  
**Depends on:** Phase 5 system audit (BACKLOG-005 Phase 5)

---

#### Block 1 — Modular Monolith Enforcement

##### Problem

The codebase has no enforced module boundaries. API routes, DB queries,
and business logic are intermixed across folders with no ownership model.
As the codebase grows, cross-module coupling will make changes
increasingly risky and refactoring expensive.

##### Proposed Module Boundaries

| Module         | Owns                                                             |
| -------------- | ---------------------------------------------------------------- |
| `match-engine` | matches, matchEvents, scoring, standings, matchLoggerAssignments |
| `identity`     | auth, users, loggers, players, teams, organizations              |
| `competition`  | competitions, competition_team_entries, brackets, eligibility    |
| `media`        | news/articles, highlights, livestream, ads                       |
| `admin`        | all `/api/admin/*` and `/admin/*` routes — internal module only  |

##### Rules per module

- Each module owns its DB tables — no other module queries them directly
- Cross-module data access goes through an explicit internal API
  (e.g. `match-engine` calls `identity.getPlayer(id)`, not
  `db.select().from(players)` directly)
- No circular dependencies between modules

##### Implementation

1. Map current code to proposed modules (output of Phase 5 audit)
2. Establish folder structure: `src/modules/match-engine/`, etc.
3. Migrate routes and logic into module folders incrementally
4. Enforce boundaries with `eslint-plugin-boundaries` or path alias
   restrictions in `tsconfig.json`
5. Document ownership in a `MODULES.md` at project root

##### Notes

- This is a large, multi-session refactor — do not attempt in one go
- Prepares codebase for potential future microservice extraction if
  scale demands it, but does NOT commit to that path
- Blocked by: Phase 5 full feature audit must complete first so we
  know what we're actually reorganising
- Start with `match-engine` and `identity` — highest coupling risk

---

#### Block 2 — Full Feature Audit (4-State Matrix)

##### Problem

No complete inventory exists of what is actually working vs broken vs
partially built vs not built. Decisions about what to fix, backscope,
or deprecate are being made without a full picture.

##### Audit Method

For every feature visible in the codebase and live UI, assign one of:

| State         | Meaning                                                              |
| ------------- | -------------------------------------------------------------------- |
| **WORKING**   | Tested end-to-end, complete, no known bugs                           |
| **PARTIAL**   | Core flow works, but meaningful pieces are missing or stubbed        |
| **BROKEN**    | Exists in nav/code but produces errors or wrong output in normal use |
| **NOT BUILT** | Schema or scaffold exists, no functioning implementation             |

##### Scope

- All public-facing pages (`/`, `/livescore`, `/matches`, `/players`, `/standings`, etc.)
- All admin pages (`/admin/*`)
- All API routes (`/api/*`)
- All DB tables (does a corresponding UI/API use them?)
- All components marked NEW, WIP, or known to be stubs

##### Decision per PARTIAL/BROKEN feature

For each feature in that state, evaluate and decide:

- **Fix now** — if it's in a critical user flow and the fix is scoped
- **Backscope** — if it's a non-critical feature not ready for users
  (see Block 3)
- **Deprecate** — if it will never be built or has been superseded

##### Output

A `FEATURE_AUDIT.md` in `.agents/dev/` with the full matrix, decision
column, and owner/blocker notes. This becomes the master reference for
Phase 6 and Phase 7 planning.

##### Notes

- Run this audit on the `dev` branch against the staging deployment
  once staging is live — not against prod
- Every BROKEN feature visible to users is a live reputation risk
- Relates to: BACKLOG-005 Phase 5, Block 1 (module boundaries)

---

#### Block 3 — Backscoping

##### Problem

Features that are PARTIAL or BROKEN but not worth fixing immediately
are currently live in the UI, creating a degraded user experience and
a false impression of the platform's capability.

##### Backscoping Rules

1. Feature is removed from navigation and routing (returns 404 or
   redirects to a `/coming-soon` stub)
2. The underlying code is NOT deleted — only disabled/hidden
3. Every backscoped feature is logged in this backlog with:
   - Status: `BACKSCOPED`
   - What's needed to reinstate it
   - Who/what blocks reinstatement

##### Implementation

- Audit nav links and remove PARTIAL/BROKEN destinations
- Add a simple `ComingSoon` page component for 404 fallbacks
- Use Next.js `notFound()` or a redirect in the page component —
  no complex feature-flag infrastructure needed at this stage

##### Known Backscoping Candidates

| Feature                          | Current state                          | Blocker to reinstate                  |
| -------------------------------- | -------------------------------------- | ------------------------------------- |
| Manager page                     | Confirmed stub — no real content       | Full manager center feature (Phase 7) |
| `next-auth` remnants             | Vestigial package, dead routes         | BACKLOG-009 (audit + remove)          |
| Stripe integration               | Installed, unused, out of scope        | Phase 7 (Revenue & Monetisation)      |
| Any admin page missing auth gate | Security risk if any remain            | Audit needed — check after Phase 5    |
| Lineup Builder                   | Marked NEW, unknown stability 🔴       | Stability audit + test on staging     |
| Ads feature                      | Recently added, untested under load 🔴 | Load test on staging                  |
| Transfers page                   | Intersects BUG-004 🔴                  | BUG-004 full resolution               |
| News / articles                  | Intersects BUG-006 XSS 🔴              | BUG-006 complete + XSS audit          |

##### Notes

- Backscoping is NOT the same as deleting — the code stays, users just
  can't reach broken features
- Priority: backscope before Phase 7 revenue work — no point monetising
  a platform with visible broken pages
- Candidates marked 🔴 are already flagged High Volatility in CLAUDE.md

---

#### Block 4 — Per-PR Turso DB Branching (CI Automation)

##### Problem

Every PR that touches DB logic currently shares the staging database.
Concurrent PRs can corrupt each other's test state and there is no
isolation between branches at the data layer.

##### Solution

When a PR is opened against `dev`, a GitHub Action automatically
creates a Turso DB branch from the production DB snapshot. The Vercel
preview deployment for that PR is configured to use the branched DB.
When the PR is merged or closed, the branch is automatically deleted.
Zero manual setup. Full isolation per PR.

##### Implementation

**Workflow 1 — Branch creation:**
`.github/workflows/turso-branch-create.yml`

- Trigger: `pull_request` events `opened`, `reopened`
- Steps:
  1. Call Turso Platform API to create a branch from the parent DB
     named `pr-{PR_NUMBER}` (e.g. `pr-42`)
  2. Retrieve the branched DB URL and generate an auth token
  3. Call Vercel API to set env vars on the PR's preview deployment:
     `TURSO_CONNECTION_URL` → branched DB URL
     `TURSO_AUTH_TOKEN` → branched DB token

**Workflow 2 — Branch deletion:**
`.github/workflows/turso-branch-delete.yml`

- Trigger: `pull_request` event `closed` (covers both merge and close)
- Steps:
  1. Call Turso Platform API to delete the `pr-{PR_NUMBER}` branch
  2. No Vercel cleanup needed — preview deployments expire automatically

##### Required GitHub Secrets

| Secret              | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `TURSO_API_TOKEN`   | Turso Platform API auth (create/delete branches) |
| `TURSO_ORG_NAME`    | Turso organisation slug                          |
| `TURSO_DB_NAME`     | Parent DB name to branch from                    |
| `VERCEL_TOKEN`      | Vercel API auth (set preview env vars)           |
| `VERCEL_PROJECT_ID` | Target Vercel project                            |
| `VERCEL_TEAM_ID`    | Vercel team (if applicable)                      |

##### Constraints

- Branch lifecycle is tied strictly to the PR — no permanent DB changes
- Branch is a snapshot from prod at creation time — not a live replica
- Schema migrations against a PR branch must be run explicitly in CI
  if the PR includes a `db:push` step
- The parent DB used for branching should be the staging DB, not prod,
  once staging is established — avoids exposing prod data in preview envs

##### Blocked by

- Staging environment must be stable and verified (BACKLOG-005 Phase 1)
- GitHub Actions must be enabled on the new org repo
  (`github.com/Brixsport/BrixSports`)
- `TURSO_API_TOKEN` requires Turso Pro plan (branching is not on free tier)

---

#### Block 5 — Modular Monolith Structure (Refined)

##### Problem

The codebase has no enforced module boundaries. All routes, DB access,
and business logic live in a flat `src/app/` and `src/lib/` structure
with no ownership model. As the codebase grows this becomes a source
of coupling, unintended side-effects, and slow onboarding.

##### Proposed Modules

| Module         | Owns                                                              |
| -------------- | ----------------------------------------------------------------- |
| `match-engine` | matches, matchEvents, scoring, standings, live logging, WebSocket |
| `identity`     | auth, users, loggers, players, teams, orgs, affiliations          |
| `competition`  | competitions, competition_team_entries, brackets, draws           |
| `media`        | news/articles, highlights, livestream, ads                        |
| `admin`        | all `/api/admin/*` and `/admin/*` routes — internal-only module   |

##### Rules per Module

- Owns its DB tables — no other module queries them directly via Drizzle
- Exposes a clean internal API: named service functions, not raw queries
  (e.g. `matchEngine.getMatchWithTeams(id)` not
  `db.select().from(matches).where(eq(matches.id, id))` called from
  another module)
- No barrel imports across module boundaries — each module has an
  explicit public surface (`index.ts` or `api.ts`)
- No circular dependencies between modules

##### Folder Structure (target)

```
src/
  modules/
    match-engine/
      api/          ← API route handlers
      services/     ← business logic
      db/           ← queries scoped to this module's tables
      index.ts      ← public surface
    identity/
    competition/
    media/
    admin/
  shared/
    lib/            ← utilities with no module ownership
    components/     ← UI components used across modules
    db/             ← schema definitions (read-only from modules)
```

##### Enforcement

- `eslint-plugin-boundaries` configured with module import rules
- Or: path alias restrictions in `tsconfig.json` — each module only
  imports from `@/shared` and its own subtree
- CI lint step fails on boundary violations

##### Implementation Order

1. Phase 5 audit completes — all features mapped
2. Draw module boundary map (which files belong where)
3. Create folder structure, move files incrementally
4. Add lint rule, fix all violations
5. Document ownership in `MODULES.md` at project root

##### Notes

- This is NOT a rewrite — it is a folder restructure and import
  discipline pass. Existing logic does not change.
- Start with `match-engine` — highest coupling risk, most critical flows
- `identity` second — auth and player data are referenced everywhere
- `media` and `admin` are the most self-contained — easiest to move last
- Blocked by: Block 6 (full feature audit) must complete first

---

#### Block 6 — Full Feature Audit (Phase 5 Entry Point)

##### Problem

No complete inventory exists of what the system actually does. Every
architectural decision, refactor plan, and production sign-off requires
knowing exactly what is WORKING, PARTIAL, BROKEN, or NOT BUILT. Without
this map, Phase 5 work is blind.

##### Scope

**High-Level Design sweep:**

- Every public route — what it renders, what data it fetches, who can
  access it
- Every admin route — what it manages, what auth it requires
- Every API endpoint — HTTP method, auth gate, input validation, query
  safety (bounded? parameterised?), response shape (DTO or raw row?)
- Every WebSocket event — emitter, listeners, payload shape
- Every DB table — is it read anywhere? written anywhere? orphaned?
- Every installed package — is it actively used? by what? safe to remove?

**Low-Level Design sweep:**

- Every component with client state — is it correct? does it handle
  error and loading states?
- Every form — validation present? error surfaced to user? submission
  confirmed server-side before success state shown?
- Every DB query — bounded with `.limit()`? correctly typed? uses index?
- Every auth check — present at handler level (not just middleware)?
  correct role verified? server-side only?

##### Output

A `SYSTEM_AUDIT.md` in `.agents/dev/` containing:

| Section                | Contents                                                        |
| ---------------------- | --------------------------------------------------------------- |
| Feature matrix         | Every feature tagged WORKING / PARTIAL / BROKEN / NOT BUILT     |
| Backscoping candidates | PARTIAL/BROKEN features to pull from live UI until fixed        |
| Security gaps          | Auth, validation, or exposure issues not already in bug backlog |
| Dead code              | Orphaned DB tables, unused packages, unreachable routes         |
| Priority fix list      | Top 10 items to address before production sign-off              |

##### Prerequisites for This Audit

- Staging environment live and verified (BACKLOG-005 Phase 1)
- Run against `dev` branch + staging deployment — never against prod directly
- The auditor must have admin access to the staging app to manually
  exercise every route

##### This Audit Unblocks

- Block 5 (modular monolith boundary drawing)
- BACKLOG-005 Phase 6 (tier validation — MVP vs production readiness)
- BACKLOG-005 Phase 8 (E2E testing — can't write tests for unknown flows)
- Production launch sign-off
- Backscoping execution (Block 3)

---

### BACKLOG-021 — GitHub Rulesets (Branch Protection)

**Status:** OPEN — implement after PR guard is tested  
**Priority:** High  
**Filed:** 2026-06-08  
**Blocked by:** PR guard workflow (`pr-guard.yml`) must be live and verified first

#### Required Changes

Configure GitHub Rulesets on the `Brixsport/BrixSports` repo:

**`main` ruleset:**

- Require PR before merging (no direct pushes)
- Require at least 1 approving review
- Require status checks to pass: `check-branch-target` (pr-guard)
- Dismiss stale reviews on new push
- Block force pushes

**`dev` ruleset:**

- Require PR before merging (no direct pushes)
- Require status checks to pass: `check-branch-target` (pr-guard)
- Block force pushes
- Allow admins to bypass for hotfix emergency merges

#### Notes

- Rulesets are configured in GitHub repo Settings → Rules → Rulesets
- Do not enable required reviews on `dev` until the team is larger —
  solo developer workflow still needs merge ability without a second reviewer
- Test `pr-guard.yml` manually on a dummy PR before locking down with rulesets

---

### BACKLOG-022 — Hotfix Auto-Sync (main → dev)

**Status:** OPEN — implement carefully with conflict detection  
**Priority:** Medium  
**Filed:** 2026-06-08

#### Problem

When a hotfix is merged to `main`, `dev` can drift and cause conflicts
on the next feature PR. Currently there is no automated sync.

#### Required Changes

GitHub Action: `.github/workflows/hotfix-sync.yml`

- Trigger: `push` to `main`
- Attempts `git merge main` into `dev`
- If clean merge: pushes to `dev` automatically
- If conflict: opens a GitHub Issue titled
  "⚠️ Auto-sync failed: main → dev conflict — manual merge required"
  and posts the conflicting files. Does NOT force-push or silently fail.

#### Notes

- Conflict detection is non-negotiable — silent failure here would
  cause divergence that is painful to resolve later
- The auto-sync commit message should be:
  `chore: sync main → dev after hotfix [hotfix branch name]`
- Blocked by: BACKLOG-021 (rulesets) — auto-sync should only run
  after branch protection is in place so it cannot accidentally
  push broken code to `dev`

---

### BACKLOG-023 — CONTRIBUTING.md — Branch Workflow Documentation

**Status:** OPEN  
**Priority:** Medium  
**Filed:** 2026-06-08

#### Required Changes

Rewrite `CONTRIBUTING.md` to accurately document the current branching
model and remove all placeholder text (`YOUR_USERNAME`, `ORIGINAL_OWNER`).

Sections to include:

1. **Branch model** — diagram of `main` / `dev` / `feature/*` / `hotfix/*`
2. **Naming conventions** — `feature/short-description`, `fix/bug-name`,
   `hotfix/critical-fix-name`
3. **PR rules** — feature/_ → dev, hotfix/_ → main, what the PR guard
   checks, what happens on violation
4. **Merge strategy** — squash merge preferred for features,
   merge commit for hotfixes (to preserve history)
5. **Commit format** — `type(scope): description` as per CLAUDE.md
6. **What to do after a hotfix** — remind contributor that main → dev
   sync is automated but to watch for the conflict issue notification

#### Notes

- The current `CONTRIBUTING.md` has generic placeholder text from
  project scaffolding — it does not reflect the actual workflow
- Cross-reference CLAUDE.md Git Branching Rules section

---

### BACKLOG-024 — DNS CNAME: staging.brixsports.com

**Status:** OPEN — pending DNS access confirmation  
**Priority:** Low (can use Vercel auto-subdomain in the interim)  
**Filed:** 2026-06-08

#### Required Changes

1. In the DNS provider for `brixsports.com`:
   - Add CNAME record: `staging` → `cname.vercel-dns.com`
   - Or use Vercel's A record approach if CNAME at root is required
2. In the Vercel staging project dashboard:
   - Add custom domain: `staging.brixsports.com`
   - Vercel will issue an SSL certificate automatically (Let's Encrypt)
3. Update `STAGING_PLAN.md` and `NEXT_PUBLIC_APP_URL` staging env var
   to `https://staging.brixsports.com` once verified

#### Notes

- Until DNS is set up, the Vercel auto-generated subdomain
  (e.g. `brixsports-staging.vercel.app`) is sufficient for internal use
- Confirm: does `brixsports.com` DNS live in Vercel, Cloudflare,
  or another provider? This determines the exact steps
- SSL is handled by Vercel automatically — no manual cert work needed

---

### BACKLOG-025 — Google OAuth Staging Config

**Status:** OPEN  
**Priority:** Medium  
**Filed:** 2026-06-08  
**Scope:** Staging only (until resolved)  
**Blocked by:** Google Console access not yet available

#### Problem

The staging deployment will fail Google OAuth login until the staging
URL is added as an authorized redirect URI in the Google OAuth app.
Google rejects any redirect URI not explicitly whitelisted — the staging
Vercel URL will not match the prod OAuth config.

#### Fix Options

1. **Preferred** — Add staging URL to existing OAuth app:
   Google Console → APIs & Services → Credentials → OAuth 2.0 Client →
   Authorized redirect URIs → add `https://staging.brixsports.com/api/auth/callback/google`
   (and the Vercel preview URL if using auto-subdomain in the interim)

2. **Alternative** — Create a separate OAuth client for staging with its
   own `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, set in Vercel
   staging env vars only.

#### Workaround (until fixed)

Disable Google login on staging via feature flag or env var:

- Add `ENABLE_GOOGLE_LOGIN=false` to staging Vercel env vars
- Gate the Google sign-in button in the UI on this flag
- Staging users log in with email/password only

#### Notes

- This does not affect production — prod OAuth config is unchanged
- Must be resolved before staging is opened to any external testers
  who rely on Google login

---

### BACKLOG-026 — Broken AWS SES Config (Non-functional Email)

**Status:** OPEN  
**Priority:** High — affects production  
**Filed:** 2026-06-08  
**Scope:** Production + staging

#### Problem

`AWS_SES_FROM_EMAIL` is set to the literal string `"AWS_SES_FROM_EMAIL"`
in the production Vercel environment — this is not a valid email address.
All email sending via SES is currently broken. Any feature that sends
email (password reset, notifications) silently fails or errors.

#### Fix

1. In AWS SES console, verify the intended sender address
   (e.g. `noreply@brixsports.com`) if not already verified.
   SES in sandbox mode requires both sender AND recipient to be verified.
2. Set the correct value in **both** Vercel projects:
   - Prod: `AWS_SES_FROM_EMAIL=noreply@brixsports.com`
   - Staging: `AWS_SES_FROM_EMAIL=noreply@brixsports.com`
     (or a staging-specific address if you want separate sender identity)
3. Verify email sending works end-to-end after the fix.

#### Related

- **BACKLOG-010** — audit which of the three installed email providers
  (SES, Resend, Nodemailer) is actually the active code path before
  fixing the config. No point fixing SES env vars if Resend is the
  active sender.
- BACKLOG-010 should be resolved first or concurrently — identify the
  live provider, remove the dead ones, then fix the config for the
  surviving provider only.

#### Notes

- This is a production bug, not staging-only — fix in prod Vercel env
  vars as soon as the correct sender address is confirmed
- Do not commit any real email addresses to source code or `.env.example`

---

### BACKLOG-027 — Railway Staging WebSocket Service Not Created

**Status:** OPEN  
**Priority:** Low (staging only — prod unaffected)  
**Filed:** 2026-06-08  
**Scope:** Staging

#### Problem

No separate Railway WebSocket service exists for staging. The staging
Vercel deployment currently points to the production WS server
(`NEXT_PUBLIC_WS_URL` in staging env vars references the prod Railway
service). This means:

- Live event logging on staging affects prod WS connections
- Staging load or bugs can destabilise the prod WS server
- True end-to-end staging isolation is not possible until resolved

#### Fix

1. In Railway dashboard, create a new service from the `dev` branch of
   `ws-server/` directory (or deploy the same `ws-server/` code).
   Name it `brixsports-ws-staging`.
2. Set environment variables on the staging WS service:
   - `PORT` (Railway sets this automatically)
   - `WS_API_KEY` — a different key from prod (generate separately)
   - `VERCEL_URL` → `https://staging.brixsports.com`
     (or the Vercel auto-subdomain until DNS is set up)
3. Copy the deployed Railway URL into the Vercel staging project:
   - `NEXT_PUBLIC_WS_URL=https://brixsports-ws-staging.railway.app`
   - `WS_SERVER_URL=https://brixsports-ws-staging.railway.app`
     (if the app uses a server-side WS URL separately)

#### Impact of not fixing

- Live event logging is untestable in isolation on staging
- BACKLOG-019 (post-match automation) cannot be safely tested on staging
  until the WS server is isolated

#### Notes

- Both prod and staging WS services must be independently restartable
  without affecting each other
- Blocked by nothing — can be set up any time Railway access is available
- Low priority only because staging itself is not yet fully live;
  elevate to High once staging deployment is in use

---

### ~~BACKLOG-028 — Backscope Dead/Partial Features from Public Nav~~

**Status:** RESOLVED — 2026-06-11
**Priority:** High
**Filed:** 2026-06-08
**Source:** SYSTEM_AUDIT.md §11

#### Problem

Several features are reachable via URL but are either NOT BUILT, DEAD, or
conflict with the canonical auth system. Users landing on them get broken
experiences or empty pages.

#### Required Changes

Remove from navigation and return 404 or redirect to `/` for:

- `/fpl/*` (Fantasy Premier League) — NOT BUILT, schema + API routes only,
  no data, not in scope
- `/predictions` — NOT BUILT, schema + API routes only, not in scope
- `/scouts` — DEAD, already redirects to `/`, clean up route file entirely
- `/nesa-registration` — NOT BUILT, no API handler, schema has broken FKs
- `/auth/signin` — DEAD, vestigial next-auth route, conflicts with `/login`
- Polls UI (`MatchPoll`, `MatchPollEnhanced`, `CreatePoll`) — DEAD tables,
  remove from match detail page if surfaced anywhere

#### Rules

- Code is NOT deleted — only hidden from users
- Use `notFound()` in page components or remove nav links
- No feature-flag infrastructure needed at this stage
- Every backscoped feature logged here with reinstatement blocker

#### Reinstatement Blockers

| Feature              | Blocker                                    |
| -------------------- | ------------------------------------------ |
| `/fpl/*`             | Phase 7 (out of scope)                     |
| `/predictions`       | Phase 7 (out of scope)                     |
| `/scouts`            | No future use planned                      |
| `/nesa-registration` | Full build required (schema + API + admin) |
| `/auth/signin`       | BACKLOG-009 (next-auth removal)            |
| Polls UI             | Phase 7 (out of scope)                     |

#### Resolution — 2026-06-11

All six features backscoped. Nothing deleted — all code preserved as commented-out blocks
with `// BACKSCOPED: 2026-06-08 — BACKLOG-028` markers throughout source.

**Page gates (direct URL → 404):**
- `src/app/fpl/page.tsx` + 4 sub-pages (`create-team`, `leagues`, `team`, `transfers`) → `notFound()`
- `src/app/predictions/page.tsx` → `notFound()`
- `src/app/nesa-registration/page.tsx` → `notFound()`
- `src/app/auth/signin/page.tsx` → `notFound()`
- `src/app/scouts/page.tsx` → `notFound()` (was redirect to `/`, now 404)

**UI surfaces commented out:**
- Profile page: "My Predictions" QuickActionButton
- `src/app/matches/[id]/page.tsx`: Predictions + Polls tab buttons + content panels + imports
- `src/components/MatchOverlay.tsx`: Predict + Poll tabs + content + imports
- `src/components/BasketballMatchOverlay.tsx`: Predict + Fan Poll tabs + content + imports
- `src/components/matches/UpcomingMatchView.tsx`: Prediction/Poll tab block + Quick Vote sidebar + state + imports
- `src/app/sitemap.ts`: `/fpl` + `/predictions` entries commented out

**New artifact:** `.agents/dev/BACKSCOPE.md` — full journal with reinstatement criteria per feature.
**TSC:** zero new errors introduced.

---

### ~~BACKLOG-029 — Auth Audit Sweep (Unknown Endpoints)~~

**Status:** RESOLVED — 2026-06-08
**Priority:** High
**Filed:** 2026-06-08
**Source:** SYSTEM_AUDIT.md §5

#### Problem

The system audit flagged these endpoints as "auth unknown" — each needs
`getAuthUser` + correct role check confirmed or added. Until verified,
these may be open mutation surfaces.

#### Endpoints to Audit

- `DELETE /api/matches/[id]/remove-logger` — `src/app/api/matches/[id]/remove-logger/route.ts`
- `GET /api/matches/[id]/loggers` — `src/app/api/matches/[id]/loggers/route.ts`
- `GET /api/matches/[id]/assigned-loggers` — `src/app/api/matches/[id]/assigned-loggers/route.ts`
- `POST /api/matches/bulk` — `src/app/api/matches/bulk/route.ts`
- `PATCH /api/matches/bulk-update` — `src/app/api/matches/bulk-update/route.ts`
- `POST /api/players/bulk` — `src/app/api/players/bulk/route.ts`
- `POST /api/players/create-individual` — `src/app/api/players/create-individual/route.ts`
- `POST /api/brackets` — `src/app/api/brackets/route.ts`
- `POST /api/transfers` — `src/app/api/transfers/route.ts`
- `PATCH /api/competitions/[id]` — `src/app/api/competitions/[id]/route.ts`
- `POST /api/competitions/register` — `src/app/api/competitions/register/route.ts`
- `POST /api/competitions/register/approve` — `src/app/api/competitions/register/approve/route.ts`
- `POST /api/competitions/bulk` — `src/app/api/competitions/bulk/route.ts`
- `POST /api/cloudinary/sign` — `src/app/api/cloudinary/sign/route.ts`
- `PATCH/DELETE /api/admin/ads/[id]` — `src/app/api/admin/ads/[id]/route.ts`
- `GET /api/notifications/history` — `src/app/api/notifications/history/route.ts`
- `GET /api/analytics/loggers` — `src/app/api/analytics/loggers/route.ts`

#### Per-Endpoint Action

Open each file. Check if `getAuthUser(request)` is called before any DB
write or sensitive read. Check if the correct role is verified. If missing,
add auth gate matching the BUG-001/002 pattern. Log result per endpoint
(auth present / missing / added).

---

### BACKLOG-030 — Clean Up Deprecated mock-data.ts Imports

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-08
**Source:** SYSTEM_AUDIT.md §7

#### Problem

`src/lib/mock-data.ts` is marked DEPRECATED (migrated 2025-12-30). Three
components still import from it:

- `src/components/TopPlayers.tsx`
- `src/components/MyFeed.tsx`
- `src/components/MatchComponents.tsx`

The file now exports only types (no actual data), so no runtime breakage
occurs today — but imports from a deprecated file are misleading and will
cause confusion when the file is eventually deleted.

#### Required Changes

For each component:

1. Check what is imported from mock-data (likely type-only imports)
2. If type-only, move the type definition inline or to a shared types file
3. If data-dependent, replace with proper API fetch
4. Remove the mock-data import

#### Notes

- If any of these components are part of backscoped features (BACKLOG-028),
  defer cleanup until reinstatement — no point cleaning up dead code
- Do not delete `src/lib/mock-data.ts` itself until all imports are removed

---

### BACKLOG-031 — Dead/Heavyweight Package Audit

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-08
**Source:** SYSTEM_AUDIT.md §8

#### Problem

Several packages in `package.json` are either unused or disproportionately
heavy for their actual use in the codebase.

#### Packages to Evaluate

**Remove if unused:**

- `@babel/parser` — not an obvious dependency for this stack. Grep for
  imports; remove if zero usage outside node_modules.
- `downloadjs` — trace usage across all files; remove if unused.
- `dotted-map` — map visualisation package; trace usage, remove if unused.

**Evaluate for lighter alternatives:**

- `three` + `@react-three/fiber` + `@react-three/drei` — used ONLY in two
  error page components (`src/components/error/BasketballRimScene.tsx`,
  `src/components/error/SoccerGoalScene.tsx`). Estimated 500KB+ bundle
  weight for 404/error pages only. Evaluate replacing with lightweight
  SVG or CSS animations.

#### Process

For each package: grep for imports across `src/**`. If zero non-trivial
imports, remove from `package.json` and run `npm install` to update
lock file. Test build. Document result.

---

### ~~BACKLOG-032 — Display Round/Matchday Label on Match Cards~~

**Status:** RESOLVED — 2026-06-08
**Priority:** Medium
**Filed:** 2026-06-08

#### Problem

The `round` field is populated on all matches (e.g. `"Match Day 1"`, `"Match Day 2"`,
`"Final"`) but is not rendered on the public match card (`/live` page) or the admin
match list. Viewers and admins have no way to tell which round a match belongs to
without opening the match detail.

#### Required Changes

1. **Public match card** (`src/app/live/page.tsx`) — add `round` string next to the
   competition name in the card header.
   Format: `"BUSALYMPICS · Match Day 2"` or `"BUSALYMPICS · Final"`
   Only render if `round` is non-null.

2. **Admin match list card** (`src/app/admin/matches/page.tsx`, line ~410) — same
   treatment in the card header line. `round` is already present in form state —
   just add it to the display.

3. `matchday` integer is **not** needed in the display — `round` string is sufficient.
   `matchday` remains useful as a sort key only.

#### Notes

- `round` column: string (`"Match Day 1"`, `"Final"`, etc.) — render as-is
- `matchday` column: integer (1, 2, 3) or null (for Final) — sort key only, do not display
- The `/api/matches` GET response already returns `round` — no API change needed
- The Final fixture (`_lkHo5y1m6ArqvLsi1ixe`) has `matchday: null` and `round: "Final"` —
  both cases handled correctly if round is rendered when non-null

---

### ~~BACKLOG-033 — BUSALYMPICS Standings Recalculation~~

**Status:** RESOLVED — 2026-06-14. All scores patched, standings written to both staging and prod. 4 rows upserted. Final excluded correctly. COLENG top (6pts).
**Was:** OPEN — blocked on BACKLOG-017 (2 of 3 missing scores still unconfirmed)
**Priority:** High
**Filed:** 2026-06-08

#### Problem

BUSALYMPICS standings cannot be correctly calculated until all fixtures are FINISHED.
Two MD3 fixtures remain UPCOMING with unconfirmed scores:

| Match ID                | Fixture           | Round       |
| ----------------------- | ----------------- | ----------- |
| `_9nntLoOZZOZGzja8EQE9` | COLNAS vs COLENVS | Match Day 3 |
| `y3KcCGtHA7N7MybKTHX5K` | COLMANS vs COLENG | Match Day 3 |

**Do not run standings recalculation until both MD3 fixtures are FINISHED.**
Partial standings with 2 UPCOMING games will produce wrong table positions.

#### Required Changes

1. Once MD3 G1 (COLNAS vs COLENVS) score is confirmed:
   PATCH `_9nntLoOZZOZGzja8EQE9` → `{ status: "FINISHED", homeScore: X, awayScore: Y }`

2. Once MD3 G2 (COLMANS vs COLENG) score is confirmed:
   PATCH `y3KcCGtHA7N7MybKTHX5K` → `{ status: "FINISHED", homeScore: X, awayScore: Y }`

3. After both are FINISHED, trigger standings recalculation for BUSALYMPICS:
   `competitionId: 9q8LMVqW8KAtF4BJBlyk_`

### BACKLOG-033-B — Game Event Handler for Key Match Events (Goals, Assists, Cards)

**Status:** OPEN
**Priority:** High
**Filed:** 2026-06-08

#### Problem

Match events are captured in `matchEvents` table but the system lacks robust
handling for key events that directly impact standings and player stats. Goals
and assists are the most critical — they affect final scores, standings points,
and player rankings.

Currently:

- Events are inserted via `POST /api/events` but handling is incomplete
- Not all event types are reliably captured or normalized
- Goals are the priority; assists and cards come second
- Standing recalculation (BACKLOG-033 handler) depends on reliable event data

#### Required Changes

1. **Event Type Normalization & Mapping** — standardize all event types:
   - Mapping table for all variants: `Goal`/`GOAL`/`goal`, etc.
   - Already partially fixed in BUG-012 via `normalizeType()` in RatingCalculator

2. **Event Handlers** — per event type, define what happens:

   **Goal events** (PRIORITY 1):
   - Parse: player ID, team, minute, goal type (open play / penalty / own goal)
   - Write to `matchEvents` with normalized type
   - Increment player stats: `goals`, `penaltyGoals` (if applicable), `ownGoals` (if own goal)
   - Increment team `goalsFor` / `goalsAgainst`
   - Trigger score update on the match (homeScore / awayScore)

   **Assist events** (PRIORITY 1):
   - Parse: assisting player ID, team, minute, primary goal scorer
   - Write to `matchEvents` with type `'Assist'`
   - Increment assisting player stats: `assists`
   - Link to corresponding Goal event for audit trail

   **Card events** (PRIORITY 2):
   - Yellow Card: increment player `yellowCards`
   - Red Card: increment player `redCards`; mark player as sent-off for match
   - Record expulsion minute if red card

3. **Validation & Deduplication** — prevent duplicate events:
   - Check `(matchId, playerId, type, minute)` tuple before inserting
   - If goal already recorded at same minute by same player, log as skipped (not duplicate)
   - Attach warnings to response for review

4. **Event Submission Flow**:
   /_ Lines 560-562 omitted _/
   - Single POST handler `/api/events` accepts array or single event
   - Returns per-event status: `{ inserted, skipped, error }`
   - Auth: logger assigned to match or admin role

5. **Non-Critical Events** — capture but do not block on:
   - Substitutions (PRIORITY 3)
   - Fouls / free kicks (PRIORITY 3)
   - Possession / formation changes (PRIORITY 4)
   - Optional fields; do not fail if missing

#### Implementation Notes

- Goals must be captured reliably — they directly affect match result and standings
- Assists optional for now but table structure must support them (BACKLOG-001)
- Cards optional but recommended for player discipline history
- Once robust, this handler feeds BACKLOG-019 (post-match automation)
- Related: BUG-012 (event type casing), BACKLOG-001 (penaltyGoals/ownGoals),
  BACKLOG-019 (post-match hook), BACKLOG-034 (clearance script)

#### Success Criteria

- All goal events reliably captured and normalized
- Player stats (goals, assists, cards) correctly incremented
- Standing recalculation produces correct points
- No duplicate events for same goal at same minute
- Deduplication handles retry safely (idempotent)

#### Notes

- Do not estimate or backfill with placeholder scores — physical records required
- BACKLOG-017 must be fully resolved (all 3 missing scores confirmed) before this runs
- Related: BACKLOG-019 (post-match automation) — once that hook exists, standings
  recalculation will fire automatically on PATCH to FINISHED. Until then, manual trigger.

---

### BACKLOG-042 — Duplicate Player Merge Tool

**Status:** OPEN
**Priority:** Low — build after real duplicates appear in prod
**Filed:** 2026-06-13

#### Problem
Two player profiles for the same person can exist with 
different names (e.g. "Chukwuemeka" vs "Chukwu") or 
created in different competitions. The unique index on 
playerTeamAffiliations prevents same-team duplicates 
but not same-person different-profile across teams.

#### Required Changes
Admin tool at /admin/players/merge:
- Search two players by name
- Show side-by-side: name, college, teams, stats, events
- Select canonical profile (keep) and duplicate (merge from)
- On confirm:
  - Update all matchEvents.playerId references to canonical
  - Update all playerTeamAffiliations.playerId to canonical
  - Update all playerStats.playerId to canonical
  - Delete duplicate players row
  - Log merge in RUNLOG with both IDs

#### Notes
- Do not build until real duplicates appear in prod data
- Fuzzy warning panel in Roster Builder (BACKLOG-037 Step 4) 
  is the prevention layer — this is the cure
- Merge is irreversible — require typed confirmation

---

### BACKLOG-043 — Temp Player / Unregistered Player Flow

**Status:** OPEN
**Priority:** Medium — hit in real matches
**Filed:** 2026-06-13

#### Problem
During a match, a player shows up who is not on the 
registered roster. Logger needs to log their goal/card 
but cannot find them in the player search. Currently 
no way to handle this without stopping the match flow.

#### Required Changes
In the logger platform (FootballLogger/BasketballLogger):
- "Unregistered Player" button on player search
- Creates a temp player entry scoped to this match only:
  tempName: string (e.g. "No.9 COLNAS" or "Unknown Forward")
  teamId: current match team
  matchId: current match
  isTemp: true flag on players row or separate tempPlayers table
- Event logs against this temp player normally
- After match: admin can resolve temp player → 
  link to real player profile (triggers BACKLOG-042 merge flow)
  or create as new permanent profile

#### Notes
- College football is loose — this will happen regularly
- Temp entries must be clearly flagged in match events 
  and stats so they don't corrupt leaderboards
- Resolution flow (temp → real) is Part 2, 
  can ship temp creation first

---

### ~~BACKLOG-046 — Player Profile Edit Page~~

**Status:** COMPLETE — 2026-06-15
**Priority:** Medium
**Filed:** 2026-06-14

#### Problem
`PATCH /api/players/[id]` exists and is implemented (line 294 of `src/app/api/players/[id]/route.ts`) but there is no admin UI to drive it. Player profiles can only be edited via direct API calls or scripts.

#### Required Changes
- `src/app/admin/players/[id]/page.tsx` — player detail + edit page
- Fields: `name`, `jerseyName`, `number`, `position`, `college`, `department`, `university`, `age`, `height`, `weight`, `nationality`, `image` (Cloudinary upload)
- Nicknames management: view/add/remove nicknames from `playerTeamAffiliations` rows for this player
- Current teams: list all affiliations with `affiliationType`, `isPrimary`, `isActive` — ability to deactivate an affiliation
- Jersey number override per team: edit `jerseyNumber` on the affiliation row, not on the `players` row
- "Merge with another player" button → links to BACKLOG-042 (Duplicate Merge Tool)

#### Notes
- Follows same pattern as `/admin/teams/[id]` built in BACKLOG-037 Step 4
- Do not build before BACKLOG-037 Steps 5-6 are complete — roster builder and player edit are related surfaces
- Related: BACKLOG-042 (merge), BACKLOG-037 (roster builder), BACKLOG-041 (nickname search)

---

### BACKLOG-045 — Teams List Pagination

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-15

Current `.limit(500)` on `GET /api/teams` is a temporary ceiling. Build cursor-based pagination on the API and infinite scroll or page controls on `/admin/teams` when team count approaches 500.

---

### BACKLOG-044 — Match Config: Duration, Substitution Rules, Format

**Status:** PHASE A COMPLETE — Phase B pending
**Priority:** High — affects live logging correctness
**Filed:** 2026-06-13

#### Problem
The system assumes all matches are 90-minute, 
3-substitution football. Real matches at Bells vary:
- NPUGA 5-aside: 40 mins, unlimited rolling subs, 
  players can re-enter after subbing off
- Friendly: custom duration, no sub limit
- BUSA League: standard 90 mins, 5 subs
- Cup Final: 90 mins + extra time + penalties possible

No match config exists. The logger platform has no 
concept of match duration, sub limits, or rolling subs.

#### Schema
Revive competitionSportSettings table (exists, 0 rows, 
no API, no UI). Add fields:
- matchDuration: integer (minutes, default 90)
- halfDuration: integer (minutes, default 45)  
- maxSubstitutions: integer | null (null = unlimited)
- rollingSubstitutions: boolean (default false)
  true = player can re-enter after being subbed off
- extraTimeEnabled: boolean (default false)
- extraTimeDuration: integer (minutes, default 15)
- penaltiesEnabled: boolean (default false)
- teamSize: integer (default 11)

Per-match override: same fields on matches table 
as nullable columns — if set, override competition config.

#### Logger Platform Changes
- FootballLogger reads matchConfig on mount
- Match timer counts down from matchDuration not up 
  (or counts up with a duration ceiling)
- Sub tracking: counts subs used vs maxSubstitutions, 
  warns when limit reached
- If rollingSubstitutions = true: allow same player 
  to be subbed back in without blocking
- Half time auto-prompt at halfDuration mark

#### Admin Changes
- Competition creation modal: sport settings tab
  (duration, sub rules, team size)
- Match creation: optional per-match overrides
- Display match format on match cards 
  (e.g. "5-aside · 40 mins" vs "11-aside · 90 mins")

#### Notes
- competitionSportSettings already exists in schema — 
  additive columns only, no table rebuild
- This affects rating calculator too — 
  minutes played weight differs in 40-min vs 90-min game
- Do not build before Roster Builder (BACKLOG-037) 
  is complete — logger platform changes should come 
  after roster is stable
- Related: BACKLOG-033-B (event handler), 
  BACKLOG-019 (post-match automation)
- Competition-level squad limits belong here (max squad size per
  competition). Do not enforce limits in BACKLOG-037 Step 7 —
  read them from competition sport settings once BACKLOG-044 is built.

#### Phase A — Complete (Session 18, 2026-06-15)
- Schema: 8 new columns on `competitionSportSettings`, 3 override columns on `matches`
- API: `GET/POST /api/competitions/[id]/match-settings` (upsert by sport)
- API: `GET /api/matches/[id]/config` (3-layer merge: match override → competition → sport default)
- Admin UI: "Match Settings" collapsible section in competition modal
- Admin UI: "Override Match Settings" collapsible section in match creation/edit modal
- DB migration run against staging (11 ALTER TABLE statements)

#### Phase B — Pending (BACKLOG-044-B)
- `src/lib/eventValidation.ts` — replace hardcoded `maxSubstitutions: 3` with config fetch
- `src/components/logger/substitution-manager.ts` — replace hardcoded sport constants with config
- `FootballLogger.tsx` — fetch `/api/matches/[id]/config` on mount; pass config to sub manager and timer
- Match timer: count down from `matchDuration`, warn at `halfDuration`
- Sub tracking: count subs used, warn when `maxSubstitutions` reached (skip check if null = unlimited)
- Rolling subs: if `allowSubbedOutReentry = true`, do not block player from re-entering
- Prod DB migration: run same 11 ALTERs against `libsql://brixsportv2-brixsports` via `.env.production`

---

### BACKLOG-047 — Roster Add Existing: Eligibility Filters

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-15

#### Problem
"Add Existing" player search in the Roster Builder has no filters.
All players in the system are searchable regardless of sport,
university, or current squad status. This allows cross-sport or
cross-university additions with no warning.

#### Required Changes
- Filter search results by sport when adding to a team roster
- Filter by university for BUSA-scoped competitions
- Show warning if player is already in active squad for another
  team in the same competition
- Eligibility checks (age, academic standing, transfer window) — Phase 7

#### Notes
- Do not build before Squad Selector (BACKLOG-037 Step 7) is complete
- Related: BACKLOG-037 Step 3 (GET /api/players/search)

---

### BACKLOG-048 — Friendly Match Support

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-15

#### Problem
Every match requires a competitionId. Friendly matches have no
competition. Current workaround is creating a "Friendlies" dummy
competition — this corrupts standings and stats.

#### Required Changes
1. Add matchType column to matches table via SQL direct (not db:push):
   ALTER TABLE matches ADD COLUMN match_type TEXT NOT NULL DEFAULT 'competitive'
   Values: 'competitive' | 'friendly'

2. Make competitionId nullable for friendly matches — already nullable
   in schema, just needs enforcement in match creation flow.

3. Match creation form: toggle "Friendly" hides competition field,
   sets matchType to 'friendly'.

4. Friendly matches excluded from standings calculations.

5. Friendly matches show "Friendly" badge instead of competition
   name on public pages and match cards.

6. Stats from friendlies: do not count toward player stats or
   leaderboards by default. Competition sport settings can override
   this when BACKLOG-044 (match config) is built.

#### Notes
- matchType column uses SQL direct — safe, additive, no db:push needed
- Related: BACKLOG-044 (match config), BACKLOG-033-B (event handler)
- Squad selection (BACKLOG-037 Step 7) should exclude friendly matches
  from the competition dropdown — squads are competition-scoped only

---

### BACKLOG-049 — Seasonal Affiliations + Transfer Window

**Status:** OPEN
**Priority:** Low — not needed for Bells pilot
**Filed:** 2026-06-15

Add startDate and endDate to playerTeamAffiliations.
"Current" affiliation = endDate IS NULL OR endDate > now().
Transfer = close old affiliation, open new one.
Squad selection filters to active affiliations only.
Related: BACKLOG-037 Step 7, BACKLOG-048 (friendly matches)

---

### BACKLOG-050 — Team Type Field

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-15

Add teamType column to teams table via SQL direct:
'university' | 'college' | 'club' | 'busa' | 'external'
Currently implied by ownerOrganizationId — fragile.
Squad selection and eligibility checks need explicit team type.
Related: BACKLOG-047 (eligibility filters)

---

### BACKLOG-051 — Nigerian Football Format Research

**Status:** OPEN
**Priority:** Medium — needed before Phase 7 competition features
**Filed:** 2026-06-15

Dedicated research session needed. Output: FOOTBALL_FORMATS.md
Topics: NPFL/NUC eligibility, NUGA/BUSA formats, age bands,
academic eligibility, transfer windows, NPUGA rules.
Findings seed specific backlog entries for competition config.
Related: BACKLOG-044 (match config), BACKLOG-004 (multi-sport)

---

### BACKLOG-052 — Team Uniqueness + Duplicate Audit

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-15

Teams should be unique on (ownerOrganizationId, sport, gender).
No uniqueness constraint exists today — duplicate team names possible.
Display name should derive from org + sport + gender, not free text.
Known duplicate: Bells team (same name, different sport) — needs
read-only trace before any cleanup.
Male/female teams: same org + sport, different gender column —
both valid rows, need clear display differentiation in UI.
Related: BACKLOG-014 (org duplicate entries)

---

### ~~BACKLOG-053 — Inline Roster Editing (Affiliation-Level Fields)~~

**Status:** COMPLETE — 2026-06-15 (Session 17)
**Priority:** Medium
**Filed:** 2026-06-15

Both parts implemented and committed (dcd464c, 2e83f6d):
- Part 1: `affiliationId` in roster GET, PATCH handler at `roster/[affiliationId]`, inline jersey/position/nicknames edit on Squad tab.
- Part 2: Roster tab re-architected to show `squadPlayers` for selected competition. Dual panel (pool left / squad right). `squadNumber` inline edit → PATCH `squad/[squadPlayerId]`. Squad tab now holds `playerTeamAffiliations` pool + Add Players panel.

#### Problem
Roster table on /admin/teams/[id] shows jersey number, position,
and nicknames but none are editable inline. Admins must go to
a separate script or API call to fix these. Jersey numbers and
nicknames are affiliation-level fields — editing them should not
affect the player's profile or other team affiliations.

#### Scope
Editable in roster context (playerTeamAffiliations row only):
- jerseyNumber — per-team jersey number
- nicknames — JSON array of field aliases for this team
- position — per-team position override (does not change players.position)
- isActive — deactivate affiliation without deleting

NOT editable from roster (profile-level, edit via BACKLOG-046):
- name, jerseyName, college, university, rating

#### Implementation
- Edit icon per row in roster table
- Opens inline form (not a modal) — replaces the row with input fields
- PATCH /api/admin/teams/[teamId]/roster/[affiliationId] (new endpoint)
- Save → row reverts to display mode with updated values
- Cancel → no change

#### Notes
- affiliationId is the playerTeamAffiliations.id — need to confirm
  it's returned in the roster GET response (add if missing)
- Related: BACKLOG-046 (player profile edit), BACKLOG-037 Step 3
  (roster GET endpoint)

---

### BACKLOG-054 — Match-Level Position Override (Formation Roster)

**Status:** OPEN
**Priority:** Medium — needed before formation/lineup features
**Filed:** 2026-06-15

#### Problem
A player's canonical position (players.position) and per-team
position (playerTeamAffiliations) don't cover match-specific
role changes. MCtee is a CB but plays RB in a specific match.
This override needs to live at the match level, not corrupt
the player profile or team affiliation.

#### Data Model
matches.lineups JSON already exists (stores lineup per match).
Add position override per player entry in the lineup JSON:
{
  playerId: string,
  position: string,        // overrides profile position for this match
  shirtNumber: number,     // overrides jersey number for this match
  role: 'starter' | 'substitute'
}

#### Implementation
- Formation/lineup editor reads squad for the match's competition
- Admin drags player to position on pitch — position auto-set from
  placement, or manually overridden via dropdown
- Override stored in matches.lineups JSON — no new table needed
- Match event logging reads lineup JSON for position context

#### Notes
- matches.lineups JSON column already exists — additive change
- Related: BACKLOG-044 (match config), BACKLOG-037 Step 7 (squad),
  existing /admin/match-lineups page (needs audit — may already
  do some of this)

---

### BACKLOG-055 — Player Profile Position as Canonical Truth

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-15

#### Problem
players.position is a free-text field with no validation.
Positions like 'CB', 'Centre Back', 'center-back' all mean
the same thing but are stored differently. This breaks
filtering, stat grouping, and formation display.

#### Required Changes
1. Define canonical position list per sport:
   Football: GK, CB, LB, RB, LWB, RWB, CDM, CM, CAM,
             LM, RM, LW, RW, CF, ST, SS
   Basketball: PG, SG, SF, PF, C
2. Validate position on player create/update against the list
3. Migration: normalise existing position strings to canonical
   values (read-only audit first, then SQL direct)
4. Position dropdown in all player forms — no free text entry

#### Notes
- VALID_POSITIONS list already exists in the CSV import parser
  (src/app/admin/teams/[id]/page.tsx) — extract to a shared
  constant in src/lib/constants/positions.ts
- Related: BACKLOG-046 (player profile edit), BACKLOG-053
  (roster inline edit)

---

### BACKLOG-056 — Role-Scoped Player Edit Permissions

**Status:** OPEN
**Priority:** Low — not needed until manager role exists
**Filed:** 2026-06-15

When manager role is introduced, PATCH /api/players/[id] needs
role-scoped field allowlists:
- admin: all 19 fields (current behaviour)
- manager: name, jerseyName, number, position, age, college,
  department only — no rating, marketValue, email, eyePoints
- manager scope: only players affiliated to their team(s)

/admin/players/[id] edit page: hide sensitive fields
(rating, eyePoints, marketValue) from manager role.

Related: BACKLOG-050 (team type), future manager role feature

### BACKLOG-057 — Rename Pool/Squad Tab Labels

**Status:** OPEN
**Priority:** Low — cosmetic/terminology only
**Filed:** 2026-06-16

Current labels are swapped conceptually:
- "Roster" tab → should be **"Pool"** (permanent jersey numbers, persists across competitions)
- "Squad" tab → should be **"Squad"** (competition-scoped, editable squad numbers inline)

Pool tab loads permanent jersey numbers already set on the player record.
Squad tab (competition-scoped) shows competition squad numbers, editable inline.

No data model change needed — purely a label/copy change in the relevant tab component.

Related: BACKLOG-053 (inline roster editing), BACKLOG-056

---

### BACKLOG-058 — Logger Offline Event Queue (PRE-LIVE-MATCH BLOCKER)

**Status:** OPEN
**Priority:** CRITICAL — live match data loss risk
**Filed:** 2026-06-16

#### Problem
sw-admin.js has syncMatchEvents() written and the background sync handler
is in place. But FootballLogger never writes to IndexedDB on network failure
and never calls registration.sync.register('sync-match-events').
If connection drops mid-match, events are silently lost. No retry, no queue.

#### Fix
- On POST /api/matches/[id]/events network failure → write event to IndexedDB
  (pendingEvents store)
- Show "Queued — will sync" badge in logger UI
- Call registration.sync.register('sync-match-events')
- SW drains queue on network restore → POST each pending event
- Notify client → update UI to "Synced ✓"

#### Files
- FootballLogger component (add IndexedDB write + sync.register on failure)
- sw-admin.js (sync handler already exists — verify drain logic is correct)

#### Notes
- Do not build before BACKLOG-059 SW audit is complete
- This is a pre-live-match blocker — must ship before any real match is logged

---

### BACKLOG-059 — SW Scope Conflict Audit (PRE-LIVE-MATCH BLOCKER)

**Status:** OPEN
**Priority:** HIGH — potential SW scope conflict in production
**Filed:** 2026-06-16

#### Problem
Three SWs exist: sw.js, sw-user.js, sw-admin.js.
sw.js and sw-user.js both handle push events.
Unclear which layout registers which — possible scope conflict where
two SWs fight over the same registration scope.

#### Fix
- Audit root layout.tsx and admin layout.tsx — confirm which SW each registers
- Confirm sw.js is not double-registering on same scope as sw-user.js
- Retire sw.js or repurpose as logger-only push handler
- Document final SW ownership in PWA_IMPLEMENTATION_GUIDE.md

#### Notes
- Must resolve before BACKLOG-058 (logger offline queue)
- Pre-live-match blocker

---

### BACKLOG-060 — SW Architecture Cleanup

**Status:** OPEN
**Priority:** MEDIUM — quality improvement, not blocking
**Filed:** 2026-06-16

#### Problem
Current SWs use blanket API caching — volatile data (live events) treated
same as static data (team rosters). Cloudinary requests intercepted by SW
unnecessarily, wasting Cache Storage quota.

#### Fix
- Skip res.cloudinary.com requests in both sw-user.js and sw-admin.js
- Per-route API TTL strategy:
  - Never cache: /api/matches/[id]/events (POST), /api/auth/*, /api/matches/[id]/config
  - Network-first 30s stale: /api/matches, /api/competitions
  - Stale-while-revalidate: /api/players, /api/teams
- Retire sw.js after BACKLOG-059 audit confirms it's safe to remove

#### Depends on: BACKLOG-059
