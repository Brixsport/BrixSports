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

## Bugs (Open)

- ~~**BUG-013**: `src/app/api/players/bulk-register/route.ts` — `POST /api/players/bulk-register` has no `getAuthUser` check and no admin role verification. Fixed: `getAuthUser(request)` + `authUser.role !== 'admin'` check added at top of POST handler, before body is read. Returns 401. Matches BUG-001/002 pattern exactly.~~

- ~~**BUG-014**: `src/app/admin/matches/page.tsx` — Match cards displayed raw team IDs for teams beyond the `/api/teams` `.limit(200)` cap (236 teams in DB). Fixed: added `homeTeam`/`awayTeam` to `Match` interface (API already returns them). Replaced `getTeamName(id)` with `getTeamDisplay(match, side)` which reads `shortName` from the embedded API response first, falls back to the local teams-list lookup, then raw ID. All four call sites updated. Resolved 2026-06-07.~~

- **BUG-001**: `src/middleware.ts` — `matcher` includes `/api/admin/*` but internal `if` check only matches `/admin`. All admin API routes are currently bypassed by middleware.
- **BUG-002**: `/api/admin/*` — Handlers (e.g., `users`, `ads`, `settings`) missing internal `getAuthUser` and `hasRole` checks.
- **BUG-003**: `src/app/api/auth/test/route.ts` — Debug endpoint live in production (leaks auth cookie state).
- **BUG-004**: `src/app/admin/transfers/page.tsx L189` — `createdBy: 'admin-1'` hardcoded (corrupts audit trail).
- **BUG-005 (remaining)**: `/api/teams, /api/players, /api/loggers` — Unbounded queries (no `.limit()` clause).
- **BUG-006**: `src/lib/utils/format-content.ts` — `formatNewsContent` fails to escape HTML tags in input. Leads to stored XSS via `dangerouslySetInnerHTML` in news pages.
- **BUG-007 (NDPR/GDPR Leak)**: `/api/matches` public response — `assignedLoggers` includes real emails in the response map (Privacy Violation).
- **BUG-008 (Race Condition)**: Match `assignedLoggers` array — Duplicate logger entries (same logger inserted twice). Match logger assignment lacks atomic uniqueness checks.
  - **Trace**: `src/app/api/matches/[id]/assign-logger/route.ts`
  - **Root Cause**: Non-atomic "Check-then-Insert" pattern. The handler `awaits` a SELECT (L27) and then `awaits` an INSERT (L47). Concurrent requests pass the check simultaneously before either has finished inserting.
  - **Fix Needed**: Implement a unique constraint in `matchLoggerAssignments` schema or use a transaction with `upsert` logic.
- **AUDIT-002 (remaining)**: `/api/matches` (POST) — Missing comprehensive Zod validation for match creation payload.
- **BUG-009**: `src/app/api/matches/route.ts` — `POST /api/matches` has no `getAuthUser` check. Unauthenticated match creation is possible. Fix: add `getAuthUser` + `role === 'admin'` check at top of POST handler.
- **BUG-010**: `src/app/api/events/route.ts` — Verify and add auth check to `POST /api/events`. Currently unconfirmed whether handler enforces logger identity server-side.
- **BUG-011**: `playerStats` data corruption — 718 goals vs 133 appearances (~5.4 goals/appearance). Likely caused by duplicate backfill runs without deduplication. Needs investigation before any further backfill runs.
- **BUG-012**: Event type casing mismatch — rating calculator uses `'GOAL'`, `'SAVE'`, `'BLOCK'` (uppercase) but `FootballLogger` dispatches `'Goal'`, `'Save'`, `'Block'` (PascalCase). Breaks all rating calculations for live-logged matches.

## Tech Debt

- **TD-001** *(IN PROGRESS)*: `src/lib/env.ts` created — typed `env` object and `validateEnv()` startup check in place. `middleware.ts` migrated to use `env.jwtSecret` and `env.isStaging`. Remaining work: migrate all other `process.env` reads across 30+ files, add Zod validation. Full migration deferred — do not scatter `process.env` reads in new code from this point forward.
- **TD-002**: Deduplication for event logging submissions on slow connections to prevent double-tap glitches.
- **TD-003**: Match status transitions need a proper state machine (PENDING → LIVE → FINISHED) with automated triggers.
- **TD-004**: Update `.env.example` to match the actual 29 keys discovered in the codebase (currently only lists 16).
- **TD-005**: Atomic refactor for logger assignment (resolves BUG-008).
- **TD-006**: Implement response sanitization for `/api/matches` to prevent email leaks (resolves BUG-007).
- **TD-007**: Bulk Register UX placement — `/admin/bulk-register` currently lives as a standalone route but registration flows (team + player creation) may belong inside the competition or team management context instead. Needs a UX review to determine the correct placement before the page grows further.

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
     penaltyGoals  integer  default 0
     ownGoals      integer  default 0
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
   □ Football  □ Basketball  □ Volleyball  □ Track & Field
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

### BACKLOG-017 — Missing BUSALYMPICS Match Scores (Partially Resolved)
**Status:** PARTIAL — fixtures in DB as UPCOMING, scores still needed
**Priority:** HIGH — standings still blocked until scores confirmed
**Filed:** 2026-06-07
**Updated:** 2026-06-07

#### Status
All 3 fixtures inserted as `status: UPCOMING` on 2026-06-07 via
`dev/fix-busalympics-remaining-fixtures.ts`. All 7 BUSALYMPICS
fixtures now exist in the DB. Standings unblocked once scores are
confirmed and rows PATCHed to FINISHED.

#### Inserted fixture IDs

| ID | Matchday | Home | Away | Date |
|----|----------|------|------|------|
| `a9CtLwotaXyfsfMf2odAM` | MD2 | COLNAS | COLENG | 2026-04-22 |
| `_9nntLoOZZOZGzja8EQE9` | MD3 | COLNAS | COLENVS | 2026-04-26 |
| `y3KcCGtHA7N7MybKTHX5K` | MD3 | COLMANS | COLENG | 2026-04-29 |

#### Remaining action
Once scores confirmed from physical records:
1. PATCH each match: `{ status: "FINISHED", homeScore: X, awayScore: Y }`
2. Run standings recalculation for BUSALYMPICS (`9q8LMVqW8KAtF4BJBlyk_`).

#### Notes
- Do not estimate or backfill with placeholder scores
- Existing 4 FINISHED fixtures verified: all matchday/round values correct

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
  BUG-001 middleware bypass /api/admin/*
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

### BACKLOG-007 — Fix Orphaned Intercollege Teams
**Status:** OPEN  
**Priority:** High  
**Filed:** 2026-06-05  

#### Problem
4 intercollege teams (CNAS, CENG, CMANS, CENVS) were created with `ownerOrganizationId = null`. They are orphaned from the org hierarchy. The corresponding org records (COLNAS, COLENG, COLMANS, COLENVS) exist in the `organizations` table but are not linked.

#### Required Changes
UPDATE each of the 4 teams to set the correct `ownerOrganizationId` from the `organizations` table. Run as a targeted script — do not use the bulk backfill.

#### Notes
- Must be done before BACKLOG-008 (competition_team_entries)
- Confirm org IDs from live DB before running UPDATE

---

### BACKLOG-008 — Enrol Intercollege Teams in Competitions
**Status:** OPEN  
**Priority:** High  
**Filed:** 2026-06-05  

#### Problem
`competition_team_entries` table has 0 rows. All 236 teams and all 3 competitions exist but no team is formally enrolled in any competition via the join table. The 4 intercollege teams need entries created once their org links (BACKLOG-007) are fixed.

#### Required Changes
After BACKLOG-007 is resolved, insert rows into `competition_team_entries` for each intercollege team → competition pairing.

#### Notes
- Blocked by BACKLOG-007
- Verify correct competition IDs from live DB before inserting

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

| Module | Owns |
|--------|------|
| `match-engine` | matches, matchEvents, scoring, standings, matchLoggerAssignments |
| `identity` | auth, users, loggers, players, teams, organizations |
| `competition` | competitions, competition_team_entries, brackets, eligibility |
| `media` | news/articles, highlights, livestream, ads |
| `admin` | all `/api/admin/*` and `/admin/*` routes — internal module only |

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

| State | Meaning |
|-------|---------|
| **WORKING** | Tested end-to-end, complete, no known bugs |
| **PARTIAL** | Core flow works, but meaningful pieces are missing or stubbed |
| **BROKEN** | Exists in nav/code but produces errors or wrong output in normal use |
| **NOT BUILT** | Schema or scaffold exists, no functioning implementation |

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

| Feature | Current state | Blocker to reinstate |
|---------|--------------|---------------------|
| Manager page | Confirmed stub — no real content | Full manager center feature (Phase 7) |
| `next-auth` remnants | Vestigial package, dead routes | BACKLOG-009 (audit + remove) |
| Stripe integration | Installed, unused, out of scope | Phase 7 (Revenue & Monetisation) |
| Any admin page missing auth gate | Security risk if any remain | Audit needed — check after Phase 5 |
| Lineup Builder | Marked NEW, unknown stability 🔴 | Stability audit + test on staging |
| Ads feature | Recently added, untested under load 🔴 | Load test on staging |
| Transfers page | Intersects BUG-004 🔴 | BUG-004 full resolution |
| News / articles | Intersects BUG-006 XSS 🔴 | BUG-006 complete + XSS audit |

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

| Secret | Purpose |
|--------|---------|
| `TURSO_API_TOKEN` | Turso Platform API auth (create/delete branches) |
| `TURSO_ORG_NAME` | Turso organisation slug |
| `TURSO_DB_NAME` | Parent DB name to branch from |
| `VERCEL_TOKEN` | Vercel API auth (set preview env vars) |
| `VERCEL_PROJECT_ID` | Target Vercel project |
| `VERCEL_TEAM_ID` | Vercel team (if applicable) |

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

| Module | Owns |
|--------|------|
| `match-engine` | matches, matchEvents, scoring, standings, live logging, WebSocket |
| `identity` | auth, users, loggers, players, teams, orgs, affiliations |
| `competition` | competitions, competition_team_entries, brackets, draws |
| `media` | news/articles, highlights, livestream, ads |
| `admin` | all `/api/admin/*` and `/admin/*` routes — internal-only module |

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

| Section | Contents |
|---------|---------|
| Feature matrix | Every feature tagged WORKING / PARTIAL / BROKEN / NOT BUILT |
| Backscoping candidates | PARTIAL/BROKEN features to pull from live UI until fixed |
| Security gaps | Auth, validation, or exposure issues not already in bug backlog |
| Dead code | Orphaned DB tables, unused packages, unreachable routes |
| Priority fix list | Top 10 items to address before production sign-off |

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
3. **PR rules** — feature/* → dev, hotfix/* → main, what the PR guard
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
