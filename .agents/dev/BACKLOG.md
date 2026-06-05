# BrixSports — Backlog

## Resolved

- ~~**BUG-005 (partial)**: `/api/matches` — Added `.limit(50)` to GET handler. Other endpoints (`/api/teams`, `/api/players`, `/api/loggers`) still unbounded.~~
- ~~**AUDIT-001**: `/api/events` POST — Added `getAuthUser()` + logger assignment check. Now returns 401/403 correctly.~~
  _> (stashed)_
- ~~**AUDIT-002 (partial)**: `/api/matches` (POST) — Coerced `competitionId` to `null` if empty string, fixing 500 error on match creation. Generic server validation still missing.~~

## Bugs (Open)

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

## Tech Debt

- **TD-001**: Create `src/lib/env.ts` — Centralize all `process.env` reads into a single validated config. Currently 29 env vars are scattered across 30+ files with inconsistent fallbacks and no startup validation. Should use Zod to parse and fail fast on missing required keys.
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
