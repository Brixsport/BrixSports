# BrixSports — Build Journal

## Architecture Decisions

- **Database**: Turso (LibSQL) via Drizzle ORM
- **Auth**: Custom JWT (jose / jsonwebtoken). Validation is strictly server-side.
- **Real-time**: Custom WebSockets broadcasting events and score updates.
- **Client**: Next.js App Router with TailwindCSS. PWA implementation required for offline event queueing for loggers.

---

## Sessions

### Session 27 — 2026-06-19

**Focus:** Logger flow hardening, Start Match / End Match ordering fix, college shortName DB update, code review sweep.

**Built / Fixed:**

- **BUG-049 — Start Match + End Match PATCH-before-transition fix** (`src/components/FootballLogger.tsx`)
  - Both handlers had the same ghost-state failure: local state flipped before PATCH resolved, PATCH errors swallowed by `console.error` only.
  - Start Match: added `isStartingMatch` state. PATCH fires first, awaited. On 200 → `transitionStatus('FIRST_HALF')`. On failure → `alert()`, button re-enables, period stays NOT_STARTED.
  - handleFinalize: `transitionStatus('FINISHED')` moved inside try block, after `res.ok` check. `isSaving` reused (already exclusively scoped). On failure → existing alert fires, period unchanged.
  - Commit: `0561748`

- **College football shortName update** (staging + prod DB, both confirmed)
  - CENG → COLENG, CENVS → COLENVS, CMANS → COLMANS, CNAS → COLNAS
  - Basketball unchanged: COLENG-B / COLENVS-B / COLMANS-B / COLNAS-B (sport disambiguation intentional)
  - Scripts: `dev/check-college-shortnames.mjs`, `dev/update-college-shortnames.mjs`

**Code review findings (7 new bugs filed, not yet fixed):**

- BUG-050 (CRITICAL): JWT_SECRET hardcoded fallback in `loggers/auth/route.ts`
- BUG-051 (CRITICAL): Logger can PATCH any `status` string including `FINISHED` — no enum/role gate
- BUG-052 (CRITICAL): Logger can directly write `homeScore`/`awayScore` via PATCH — bypasses event scoring
- BUG-053 (MEDIUM): No brute-force protection on logger auth endpoint — PRODUCTION gate
- BUG-054 (MEDIUM): OWN GOAL undo (DELETE /events) doesn't invert team direction — mirror of BUG-047
- BUG-055 (MEDIUM): `isScoringEvent || value` too broad — any truthy `value` field triggers score increment
- BUG-056 (LOW): 401 mid-match on event POST silently drops event, no logger UI feedback
- TD-010: Period transitions (HT confirm, 2nd half) have no server PATCH — period state ephemeral
- TD-011: `season: '2024'` hardcoded in `updatePlayerStats`

**Deferred:**
- BUG-047 live smoke test (Penalty + OG through real logger UI) — still SHIPPED, not RESOLVED
- BACKLOG-058 full test checklist (Tests 1–4) — still SHIPPED, not RESOLVED
- BACKLOG-044 Phase B (timer ceiling, sub counter) — not started; blocked by smoke tests

**Next session:**
⚠️ HARD BLOCKER — must resolve BUG-050, BUG-051, BUG-052 before any new feature work. These are CRITICAL auth/data-integrity holes surfaced by code review. Then run BUG-047 + BACKLOG-058 smoke tests. Only then Phase B.

---

### Session 26 — 2026-06-19

**Focus:** BACKLOG-058 offline queue end-to-end testing, logger flow debugging, event pipeline audit, Penalty/OG score fix, player name investigation.

---

#### What was built / fixed

**BUG-042 — Blank player names on logger confirm-lineup screen (RESOLVED, commit `04d49dc`)**

- **Root cause:** Admin lineup publish stores lightweight stubs: `{ playerId, jerseyNumber, jerseyName, position, isCaptain }`. The FootballLogger confirm screen rendered `p.name`, `p.number`, `p.position` directly on those stubs — fields that don't exist.
- **Fix:** Resolve each starter's `playerId` against the already-fetched `homePlayers`/`awayPlayers` array; fall back to stub fields (`jerseyName`, `jerseyNumber`, `position`) if the full record isn't found.
- **Pattern applied to both home and away sides in `FootballLogger.tsx`.**

**BUG-044 — Logger auth: all API calls returning 401 (RESOLVED, commit `7808a20`)**

- **Root cause (traced):** `POST /api/loggers/auth` returned the JWT in JSON body only. `getAuthUser()` reads `authToken` cookie first, then `Authorization` header — but neither was set. Every subsequent logger API call (PATCH match status, POST events) failed auth silently.
- **Root cause investigation:** HAR file loaded to trace exact request sequence. `PATCH /api/matches/[id]` 401 was initially suspected to be a missing role check, but the PATCH handler already had a logger+`isLoggerAssigned` check at line 431. The real failure was `getAuthUser()` returning null because no token was available.
- **Fix (two parts):**
  1. `src/app/api/loggers/auth/route.ts` — set `authToken` httpOnly cookie on the `NextResponse` before returning. Cookie `maxAge: 7 days` matches JWT expiry.
  2. `src/app/logger/page.tsx` — store token in `localStorage('authToken')` on successful login for the offline queue SW sync path; clear it on logout.
- **Why both?** The cookie handles server-side auth for all API calls; localStorage handles the offline event queue because the service worker (`syncMatchEvents`) reads `localStorage` to attach the token to queued event requests.

**BUG-047 — Penalty and Own Goal events do not update the match score (RESOLVED, this session)**

- **Root cause:** Score update condition in `POST /api/matches/[id]/events` was:
  ```ts
  if (type.toUpperCase() === 'GOAL' || value)
  ```
  The client sends `type: 'Penalty'` or `type: 'Own Goal'`. Neither matches `'GOAL'`. `value` is never included in the payload (confirmed by reading `confirmEvent` in `FootballLogger.tsx` — payload is constructed without a `value` field). So Penalty goals and Own Goals silently saved to DB without incrementing either team's score.
- **Additional OG bug:** For Own Goal events `teamId` is the player's team (the team that conceded). The previous logic credited that team — the wrong direction.
- **Fix in `src/app/api/matches/[id]/events/route.ts`:**
  ```ts
  const upperType = type.toUpperCase();
  const isOwnGoal = upperType === 'OWN GOAL';
  const isScoringEvent = upperType === 'GOAL' || upperType === 'PENALTY' || isOwnGoal || value;

  if (isScoringEvent) {
      const points = typeof value === 'number' ? value : 1;
      // OG: teamId is the conceding team — credit the opposing side
      const isHomeTeam = isOwnGoal
          ? teamId !== match.homeTeamId
          : teamId === match.homeTeamId;
      ...
  }
  ```

---

#### Investigation findings (no immediate code fix)

**Player #10 null name on CNAS lineup (BUG-048 filed)**

- DB query of `busa-kings-player-10`: `{ name: 'Innocent Kedem', jersey_name: null }` — player has a `name` but `jerseyName` was never filled in.
- Lineup stub stored by admin: `{ playerId: 'busa-kings-player-10', jerseyNumber: 10, jerseyName: null }`.
- BUG-042 fix resolves blank name when the player IS in the team's eligible-players list (full record found → `full.name` displayed). But this player is from BUSA Kings team, placed in a CNAS departmental match lineup. `homePlayers` (fetched from eligible-players API for CNAS) does not include BUSA Kings players — so `homePlayers.find(pl => pl.id === p.playerId)` returns `undefined`, fallback hits `p.jerseyName` = `null`.
- **Context:** this is a departmental match where players from different clubs represent their college. Expected pattern — not an isolated case.
- **Decision:** Root is a data entry gap (admin must fill `jerseyName` for cross-team players in departmental lineups). No code fix this session. BUG-048 filed with UX mitigation suggestion (warn admin at publish time if any starter has `jerseyName: null`).

**Event pipeline audit — what fires on `POST /api/matches/[id]/events`**

Full chain confirmed:
1. INSERT event row
2. UPDATE `matches.homeScore`/`awayScore` (now correctly handles GOAL, PENALTY, OWN GOAL)
3. `updatePlayerStats(sport, playerId, type, value)` — player stat row updated
4. Non-blocking internal `fetch` → `POST /api/matches/[id]/ratings` — ratings recalculation
5. **Nothing else.** No WebSocket emit server-side. No standings update.

All client-side socket emits in `FootballLogger.tsx` are dead — Railway free tier expired. System degrades gracefully: public pages fall back to 15-second polling. Not a crash.

**WebSocket status**

All `emit(...)` calls in FootballLogger are fire-and-forget with no crash on failure. The logger logs `[FootballLogger] Socket NOT connected` to console and continues. Polling fallback on `/live` and public match pages means live updates still reach viewers within ~15 seconds. BACKLOG-096 filed for future WS replacement (Railway → alternative or Ably/Pusher).

**Clock investigation**

`MatchStateManager` is timestamp-based (`startTimestamp`, `lastTickTimestamp`) persisted to `localStorage`. Clock at 16:35 on logger entry was real elapsed match time from when the match was set LIVE by admin — not a bug.

---

#### Bugs filed this session

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| BUG-042 | LOW | Blank player names on logger confirm screen | RESOLVED `04d49dc` |
| BUG-043 | LOW | Silent publish button disable (no captain tooltip) | OPEN |
| BUG-044 | HIGH | Logger auth 401 — no cookie set | RESOLVED `7808a20` |
| BUG-044b | MEDIUM | Logger `/api/auth/me` → 401 (admin endpoint, not logger) | OPEN |
| BUG-045 | MEDIUM | "INVALID DATE" on logger match card | OPEN |
| BUG-046 | MEDIUM | Black spinner on `/matches/[id]` from admin session | OPEN |
| BUG-047 | HIGH | Penalty/OG events don't update score | RESOLVED this session |
| BUG-048 | LOW | Cross-team player in dept match: `jerseyName: null` not surfaced at publish | OPEN |

**Backlog items filed:**
- BACKLOG-095 — data freshness per-zone strategy (logger vs public vs admin)
- BACKLOG-096 — no server-side WS emit on event save
- BACKLOG-097 — no standings update on goal (needs audit on FINISHED transition)

---

#### Decisions made

- **Logger auth dual-path** (cookie + localStorage) is intentional: cookie for live API calls, localStorage for offline queue SW path. Both must stay in sync — logout must clear both.
- **Railway WS dead** — treat as degraded-graceful for now. No immediate fix. System works on polling.
- **Cross-team departmental match player** — `jerseyName: null` is a data entry gap, not a code regression. Admin responsible for filling it in the lineup builder for cross-team players. Fix: warn at publish time if null.
- **BACKLOG-044 Phase B** (timer ceiling, sub counter wiring) — still the formal "next" planned feature, not yet started.

---

#### Commits this session

| Hash | Scope | Description |
|------|-------|-------------|
| `04d49dc` | `fix(logger)` | BUG-042 — resolve player stubs against full roster on confirm screen |
| `7808a20` | `fix(logger)` | BUG-044 — set authToken cookie in logger auth response; store in localStorage |
| *(uncommitted)* | `fix(events)` | BUG-047 — Penalty/OG score update logic |

> BUG-047 fix is staged but not yet committed at session end.

---

#### Next session (revised — do not skip to Phase B)

0. **BUG-047 live smoke test (2 minutes)** — code fix is correct on paper but no real event has gone through the updated path. Log one Penalty and one Own Goal through the actual logger UI on staging. Confirm score increments correctly and OG credits the opposing team. See TEST_CHECKLIST.md → BUG-047 section. **Run this before anything else — same category of gap as BACKLOG-058's false RESOLVED.**
1. **Verify 33d9b4d scope** — DONE this session. Commit is real and matches BACKLOG-058. Auth was broken when it landed; see BACKLOG-058 status correction.
2. **Run BACKLOG-058 test checklist for real** — now that BUG-044 is fixed, token IS in localStorage and cookie. Run Tests 1–4 from TEST_CHECKLIST.md against a live match: online path, offline path, drain path, expiry-guard path. Do not proceed to Phase B until all four pass. **Do not mark BACKLOG-058 RESOLVED again until "Synced ✓" badge is visible in the UI.**
3. **Run BUG-047 prod score audit** — `node dev/audit-penalty-og-scores.mjs` with `.env.production` credentials. If mismatches found, scope the correction separately (do not combine with BUG-011). If clean, close BUG-047 fully.
4. **BUG-044b** — `/api/loggers/me` endpoint for logger dashboard stats.
5. **BUG-045** — INVALID DATE guard on logger match card.
6. **BACKLOG-044 Phase B** — only after steps 0–3 are done.

---

### Session 23 — 2026-06-17

**Focus:** College affiliation data integrity — diagnose, correct individual cases, plan bulk reconcile for 110 players with no college affiliation.

**Built:**

- **`dev/fix-joga-player2-college-affiliation.mjs`** — delete wrong CENVS affiliation + insert correct COLENG affiliation for `busa-joga-player-2` on **staging**. Verified: 2 rows (team + correct college). Retained in dev/.
- **`dev/fix-joga-player2-college-affiliation-prod.mjs`** — same operation on **prod** (`libsql://brixsportv2-brixsports`). Uses `player_id + team_id + affiliation_type` predicate (no hardcoded row ID). Verified: 2 rows confirmed, parity with staging. Retained in dev/.
- **`dev/query-bells-college-diagnostic.mjs`** — read-only diagnostic: total Bells students, breakdown by college, non-Bells count, affiliation mismatches (players with college set but wrong/missing affiliation row). Run against staging.
- **`dev/preflight-joga-player2-college-row.mjs`** — point-in-time preflight confirming the wrong CENVS row existed before the fix.
- **`dev/query-bells-college-distribution.mjs`** — college distribution query (written, not run this session — superseded by diagnostic).

**Data findings (staging):**

- 178 total Bells students. 0 non-Bells players.
- College breakdown: NULL (110), COLENG (35), COLNAS (21), COLMANS (7), COLENVS (5)
- 0 affiliation mismatches — all 68 players with college set have correct affiliation rows
- 110 players have `college = NULL` — cannot be auto-affiliated until college is set via admin modal
- The COLENG count (35) includes the McTee fix applied this session (was 34 pre-fix)

**Architecture decisions:**

- **`players.college` is display metadata only** — neither admin modal writes a `playerTeamAffiliations` row. The affiliation row is what connects a player to a college team for roster/squad/eligibility. Both fields must be set independently until BACKLOG-066 lands.
- **Reconcile script pattern confirmed:** read `players.college`, look up correct team_id from map, delete any wrong college affiliation, insert correct one if missing. Idempotent — safe to re-run. Handles all cases: missing row, wrong row, already correct (skip).

**Bugs encountered:** None.

**Deferred:**

- `dev/backfill-college-affiliations.mjs` — the reconcile script for all 110 players. Not built yet — blocked on Richard setting `players.college` for all 110 via the admin modal.
- BACKLOG-066 (college field change auto-manages affiliation) — depends on BACKLOG-049.

**Additional fixes (end of session):**
- `dev/fix-mcanthony-college-prod.mjs` — McAnthony Uzowuru (`busa-joga-player-2`) had `players.college = 'COLENVS'` on prod but `COLENG` on staging and COLENG affiliation on both. Corrected prod college field to `COLENG`. Post-diagnostic confirmed full parity: staging and prod both at 178 total, 110 NULL, COLENG 35, COLNAS 21, COLMANS 7, COLENVS 5, 0 mismatches.

**Continuation (same session):**
- Richard updated college for 13 more players via admin modal on staging — NULL count dropped from 110 → 97, mismatch count rose to 14
- Built and ran `dev/backfill-college-affiliations-staging.mjs` — deleted 1 wrong row (Sukunmi SK's COLENVS affiliation, college=COLENG), inserted 14 missing affiliation rows (COLENG×8, COLENVS×3, COLMANS×1, COLNAS×2)
- Verify output: 81 players with college set, 0 remaining mismatches ✓
- Filed BACKLOG-067 (competition display name per squad entry), BACKLOG-068 (multi-sport player profile merge audit), BACKLOG-069 (partial player profile audit)
- Updated BACKLOG-057 scope: Pool/Squad tab rename + "Add Player" panel relocation confirmed as pure UI change (no data model change)

**Next session:** Richard sets college for remaining 97 NULL players → re-run diagnostic to confirm 0 NULL → build prod version of backfill script → verify prod diagnostic parity → run on prod → final parity check.

---

### Session 23 (continued) — 2026-06-17

**Focus:** College affiliation backfill (10 existing + 20 new BUSALYMPICS profiles), prod mirror, player profile form fixes, security audit, backlog filing.

**Built:**
- **`dev/backfill-college-affiliations-staging.mjs`** — deletes wrong affiliation rows + inserts missing ones for all 4 colleges. Idempotent. Run: 1 deleted (Sukunmi SK wrong COLENVS row), 14 inserted. Result: 81 players, 0 mismatches staging.
- **`dev/precheck-busalympics-players.mjs`** — pre-flight name match against DB before creating new profiles. Surfaces existing rows with similar names so they're not duplicated.
- **`dev/create-busalympics-players.mjs`** — creates 20 new BUSALYMPICS profiles (11 COLENVS, 9 COLMANS) with college + team affiliations. TOJU: COLENVS college + Wolves FC team affiliation.
- **`dev/copy-new-players-to-prod.mjs`** — copies 30 new players (full row + all affiliation rows) from staging → prod by explicit ID list. Pre-checks for existing IDs, skips safely.
- **`src/app/api/players/route.ts`** — removed `position` from required fields. Added `teamId: body.teamId || null` and `number: body.number ?? 0` to prevent FK + NOT NULL failures when fields are omitted.
- **`src/app/admin/players/page.tsx`** — removed `required` from Jersey # and Assigned Team. Team select placeholder changed to "No team assigned".

**Bugs encountered:**
- `SQLITE_CONSTRAINT: FOREIGN KEY` — `teamId: ''` not coerced to null. Fix: `body.teamId || null`.
- `SQLITE_CONSTRAINT: NOT NULL on players.number` — null sent when field empty. Fix: `body.number ?? 0`.
- `SQLITE_CONSTRAINT: NOT NULL on players.position` — DB column NOT NULL; script fix: pass `''`. API fix: server no longer rejects missing position.
- `mirror-college-to-prod.mjs` returned `rowsAffected: 0` for all 30 — script does UPDATE not INSERT; new players absent from prod so no rows matched. Built `copy-new-players-to-prod.mjs` to INSERT by explicit ID list.

**Data state after session:**
- Staging: 208 Bells students, 0 college affiliation mismatches
- Prod: 30 new players inserted, 37 affiliation rows, 0 missing affiliations — full parity with staging

**Deferred:**
- 97 Bells players still `college = NULL` — Richard to set via admin modal
- `players.number` nullable schema migration (BACKLOG-072)
- Client-side error feedback on player create form (BACKLOG-071)
- BUSA league full audit: event dedup, playerStats reset, team affiliation wiring (BACKLOG-074)
- Security upgrades: Next.js 15.5.18, drizzle-orm 0.45.2, swiper patch (BACKLOG-073)

**Next session:** Continue setting college for 97 NULL players → re-run `query-bells-college-diagnostic.mjs` → run `backfill-college-affiliations-staging.mjs` + `copy-new-players-to-prod.mjs` → then BACKLOG-073 Item C (swiper patch) → then BACKLOG-074 Phase 1 (event log dedup audit).

---

### Session 22 — 2026-06-16

**Focus:** BUG-032 null playerId gate on POST /api/events. Housekeeping: RUNLOG merge, BACKLOG cleanup, data investigation (joseph/leo players, Bells BUSA-league college gap).

**Built:**

- **`src/app/api/events/route.ts` — BUG-032 fix:**
  - Added `PLAYER_REQUIRED_TYPES` guard block between substitution validation and `newEvent` object creation. Rejects POST bodies where `playerId` is absent for Goal, Penalty, Own Goal, Yellow Card, Red Card, Assist, Save. Returns `400 { error: "Event type 'X' requires a playerId" }`.
  - Normalization logic mirrors `RatingCalculator.normalizeType()` — `type.toLowerCase().replace(/[\s_-]+/g, '')` — so all casing variants of each type hit the same check.
  - Removed unused `desc` import from `drizzle-orm`.
  - Renamed local `normalizedType` → `normalizedEventType` to avoid TS2451 collision with the existing `normalizedType` const in the score recalculation block at line ~309.
  - tsc: zero new errors. Pre-existing errors in other files unchanged.
  - Commit: `7b445e5`

**Data investigations (read-only, staging):**

- `dev/query-joseph-leo-affiliations.mjs` — confirmed 4 distinct players (JOSEPH/LEO on Siberia, joseph/leo on Rim Reapers). No duplicate rows. Filed BACKLOG-065 as suspicious — pending manual verification against physical records.
- `dev/query-bells-no-college.mjs` — identified 110 Bells BUSA-league players across 22 teams with no college affiliation. Full list in RUNLOG Session 22.

**Housekeeping:**

- `dev/RUNLOG.md` (stale secondary) merged into `.agents/dev/RUNLOG.md` (canonical) and deleted. Unique entry rescued: Session 13 `query-col-teams.mjs`.
- `BACKLOG.md` Bugs (Open) section cleaned: removed duplicate BUG-026/030/031 entries; resolved entries moved to Bugs (Resolved) section.
- BACKLOG-065 filed (suspicious players) and BACKLOG.md updated.

**Bugs encountered:**

- `normalizedType` TS2451 redeclaration — new const in the player guard block collided with existing `normalizedType` at line ~309 in the same function scope. Renamed to `normalizedEventType`.

**Deferred:**

- 39 existing null-player event rows on staging + prod — not touched. Require separate audit before any backfill.
- 110 Bells BUSA-league players with no college affiliation — identified this session, resolution deferred to next session.
- BACKLOG-065 — joseph/leo player identity pending physical record verification.

**Next session:** Resolve college affiliations for the 110 identified Bells BUSA-league players — assign each player to their correct college team row. Then BACKLOG-061 step 3 (TopScorers/Assists/Discipline in standings page).

---

### Session 19 — 2026-06-16

**Focus:** BACKLOG-044 Phase A schema cleanup, prod DB migration, UI improvements, BUG-026 hotfix.

**Built:**

- **Schema cleanup (`src/db/schema.ts`):** Removed `matchDuration` and `extraTimeDuration` from `competitionSportSettings`. `matchDuration` is now computed as `halfDuration * 2` in the config route — not stored.
- **`src/app/api/matches/[id]/config/route.ts`:** Removed `matchDuration` and `extraTimeDuration` from `SPORT_DEFAULTS` type and both sport objects. Config response now computes `matchDuration: halfDuration * 2` inline.
- **`src/app/api/competitions/[id]/match-settings/route.ts`:** Removed `matchDuration` and `extraTimeDuration` from POST body destructure and both upsert/insert blocks.
- **Staging DB:** Dropped `match_duration` and `extraTimeDuration` columns from `competition_sport_settings` via `drop-redundant-columns-staging.mjs`. Both confirmed absent via pragma.
- **Prod DB migration (BACKLOG-044 Phase A):** `migrate-sport-settings-prod.mjs` ran 10 ALTER TABLE ADD COLUMN statements against `libsql://brixsportv2-brixsports`. All succeeded. `competition_sport_settings`: +7 columns. `matches`: +3 override columns. Script deleted.
- **Admin UI — `src/app/admin/competitions/page.tsx`:**
  - `playersPerSide` raw number input replaced with 3-button selector: Standard (11) / 5-aside / Custom (shows number input). State: `playersOption`, `playersCustom`. Edit mode derives correct option from loaded value via `derivePlayersOption()`.
  - Rolling subs (`allowSubbedOutReentry`) ON now hides `maxSubstitutions` input + Unlimited checkbox entirely.
  - Edit modal now fetches existing match settings from `GET /api/competitions/[id]/match-settings` via `handleEditClick` before opening — starts from real saved values, not defaults.
- **BUG-026 fix (`next.config.ts`, `public/sw-user.js`, `public/sw-admin.js`):**
  - `next.config.ts`: added `source: '/sw:path*.js'` with `Cache-Control: no-store, max-age=0`.
  - `sw-user.js` + `sw-admin.js`: version bumped `v1 → v2`, document bypass added at top of fetch handler (HTML pages always network-only).
  - `sw.js`: push-only, no caching — confirmed no changes needed.
- **Backlog:** BACKLOG-057 (tab rename), BACKLOG-058 (logger offline queue — CRITICAL), BACKLOG-059 (SW scope audit), BACKLOG-060 (SW architecture cleanup) filed.
- **RUNLOG.md:** Staging drop + prod migration logged.
- **TEST_CHECKLIST.md:** BUG-026 moved from Known Broken to fixed. BACKLOG-044 Phase A and PWA test items added.

**Bugs encountered:**

- `import 'dotenv/config'` loads `.env` not `.env.local` — URL_INVALID crash at libsql client. Fixed with `config({ path: '.env.local' })`. Saved to memory (`feedback_dotenv_local.md`). Also documented: `.env.local` = staging, `.env.production` = prod.
- Staging `match_duration` column was snake_case (`match_duration`) but schema called it `matchDuration` — drop script initially used wrong name. Fixed by running pragma first to inspect actual column names.
- `CompetitionModal` linter applied `matchDuration`/`extraTimeDuration` removal mid-session before the Edit tool ran — caused "string not found" error on second pass. Resolved by re-reading the file.

**Deferred:**

- `match_duration` (original pre-Phase-A column) still present on prod — was not in scope to drop this session.
- BACKLOG-044 Phase B (logger integration — DB-driven sub counter, halfDuration timer, eventValidation.ts).
- BACKLOG-059 SW scope audit (must come before Phase B logger work).

**Next session:** BACKLOG-059 — SW scope conflict audit (layout.tsx registration check, sw.js retirement decision). Then BACKLOG-044 Phase B.

---

### Session 18 — 2026-06-15

**Focus:** Backlog verification sweep and BUG-026 root cause update.

**Verified (code-confirmed):**

- BUG-021 — `getAuthUser` confirmed in `notifications/subscribe/route.ts`
- BUG-022 — `.limit(500)` confirmed in `competitions/route.ts`
- BUG-023 — `schema-nesa-registrations.ts` confirmed deleted
- BUG-024 — confirmed false alarm (no `/match/[id]` route ever existed)
- BUG-025 — `loggerId` confirmed conditionally admin-only in `matches/route.ts`
- BUG-027 — `'All'` tab confirmed present in `competitions/page.tsx`
- BUG-028 — no `motion.tr` remaining in standings page
- BUG-029 — `email` confirmed destructured and stripped in `players/[id]/route.ts`
- BACKLOG-036 — `TeamLogo` import confirmed in `FootballLogger.tsx` and others
- BACKLOG-037 Steps 1-7 — all API routes and tabs confirmed present
- BACKLOG-046 — `src/app/admin/players/[id]/page.tsx` confirmed exists
- BACKLOG-053 Part 1 — `affiliationId` / `editingAffiliationId` confirmed (8 hits in team detail page)

**Updated:**

- BUG-026 — root cause clarified: SW serves stale JS chunk URLs after new deploy → unstyled page. Deferred until post-core-feature completion.
- BACKLOG-046 — status updated to COMPLETE in backlog.

**Later in Session 18 — BACKLOG-044 Phase A:**

**Schema (`src/db/schema.ts`):**
- `competitionSportSettings`: added 8 columns — `maxSubstitutions` (nullable integer), `allowSubbedOutReentry`, `extraTimeEnabled`, `extraTimeDuration`, `penaltiesEnabled`, `allowDraws`, `pointsForWin`, `pointsForDraw`
- `matches`: added 3 nullable override columns — `penaltiesEnabledOverride`, `allowDrawsOverride`, `extraTimeEnabledOverride`

**New API routes:**
- `src/app/api/competitions/[id]/match-settings/route.ts` — `GET` (public list), `POST` (admin upsert by competitionId+sport). Upsert pattern: check for existing row, update if found, insert with nanoid if not.
- `src/app/api/matches/[id]/config/route.ts` — public `GET`. Three-layer merge: match override → competition setting → sport default (hardcoded for football/basketball). Two-query pattern (no `competition` relation on `matchesRelations`).

**Admin UI changes:**
- `src/app/admin/competitions/page.tsx` — added `defaultMatchSettings`, `MatchSettingsForm` type, `saveMatchSettings()` helper (POSTs to `/api/competitions/[id]/match-settings`). Collapsible "Match Settings" section in `CompetitionModal` with duration grid, sub limit (number + unlimited toggle + rolling reentry), extra time, penalties, draws, and points grid.
- `src/app/admin/matches/page.tsx` — added 3 override fields to `formData`, collapsible "Override Match Settings for This Fixture" with three-way inherit/on/off toggles per field.

**DB migration (staging only):**
- `migrate-sport-settings-columns.mjs` — 11 ALTER TABLE ADD COLUMN statements, run against staging Turso. All succeeded. Script deleted.
- Prod migration pending (BACKLOG-044-B prerequisite).

**Bug encountered:** `import 'dotenv/config'` loads `.env` not `.env.local`. Fixed with explicit `config({ path: resolve(cwd(), '.env.local') })`. Same issue as Session 15 — now in RUNLOG.

**Next session:** BACKLOG-044 Phase B (FootballLogger config fetch, sub limit enforcement, rolling subs). Prod DB migration first.

---

### Session 13 — 2026-06-15

**Focus:** Verify Roster Builder on staging, close BUG-025, raise teams API limit, add BACKLOG-037 Step 5 (bulk register dedup), file new backlog items, create TEST_CHECKLIST.md.

**Built:**

- **`src/app/api/matches/route.ts` — BUG-025 fix:** `getAuthUser(request).catch(() => null)` added at top of GET handler. `loggerId` now conditionally included — present for `isAdmin` callers, stripped for public. `assignedLoggers` was already absent from the DB row. Lines changed: +2 (auth check), destructure rename, +1 spread conditional.

- **`src/app/api/teams/route.ts` — limit raised:** `.limit(200)` → `.limit(500)`. Root cause of missing college teams: 236 teams in DB, 200 cap cut off the last 36 which included CNAS/CENG/CMANS/CENVS.

- **`src/app/admin/teams/page.tsx` — catch block:** Silent `catch {}` → `catch (err) { console.error('Teams fetch failed:', err); }`. Failures now visible in console.

- **`src/app/api/players/bulk-register/route.ts` — BACKLOG-037 Step 5:** Pre-flight dedup check inserted before both player INSERT paths (lines ~220-248). Query: `LOWER(name) = LOWER(input.name) AND college match`. If match found and caller is not on the NPUGA email-reuse path → skip with `reason: 'possible_duplicate'`, `matchedPlayerId`, `matchedPlayerName` in `skippedPlayers`. `sql` added to drizzle import. `skippedPlayers` type widened to include optional `matchedPlayerId?` and `matchedPlayerName?`.

- **`.agents/dev/TEST_CHECKLIST.md`** — created. Full manual test checklist covering Critical Flows A/B/C, all admin surfaces (including Roster Builder), public pages, auth, security pre-prod-check, and Known Broken section.

- **BACKLOG-045 filed** — Teams list pagination (500 is temporary ceiling).
- **BACKLOG-046 filed** — Player Profile Edit page (`/admin/players/[id]` — PATCH API exists, no UI).

- **Staging verification:** Roster Builder confirmed end-to-end — `/admin/teams` loads college teams when searching "college", CNAS roster shows 21 players, existing player search works, new player form with nicknames field works, ADD PLAYERS panel submits correctly.

**Bugs encountered:**

- **College teams missing from teams list:** `/api/teams` `.limit(200)`, 236 teams in DB — college teams were in the missing 36. Root cause was a too-low limit set before DB grew. Fix: raised to 500.
- **Teams page `shortName` filter already correct:** Filter at lines 78-83 already matched `name`, `shortName`, `university` — no change needed. Confirmed by reading the file. The search "college" (not "colnas") finds them correctly since `shortName` is `CNAS` not `COLNAS`.

**Resolved:** BUG-025 (loggerId NDPR leak on public matches list), BACKLOG-037 Step 5 (bulk register dedup).

**Deferred:**
- BACKLOG-037 Steps 6-7 (CSV import tab, Squad Selector)
- BUG-021 (notifications/subscribe no auth)
- BUG-022 (unbounded queries — competitions, events)
- BUG-027 (competitions list incomplete)
- BUG-028 (hydration error #418)
- BACKLOG-036 (logo second pass — 18 files)
- BACKLOG-046 (player profile edit page)

**Next session:** BUG-021 (5 min — add `getAuthUser` to `POST /api/notifications/subscribe`), then BUG-022 (add `.limit()` to competitions + events routes), then investigate BUG-027 (competitions list missing entries).

---

### Session 14 — 2026-06-15

**Focus:** Close BUG-021/022 (confirmed already resolved), fix BUG-027 (competitions filter) and BUG-028 (hydration #418), complete BACKLOG-036 TeamLogo second pass (13 files), add BACKLOG-037 Step 6 (CSV Import tab), update test checklist.

**Built:**

- **`src/app/competitions/page.tsx` — BUG-027:** `activeTab` type widened to include `'All'`. Default changed `'Football'` → `'All'`. Tab array extended: `['All', 'Football', 'Basketball', 'Track']`. Filter logic: `selectedSport === 'All' ? competitions : competitions.filter(c => c.isMultiSport || c.sport === selectedSport)`. Tab-switch handler: `sport === 'All' ? competitions[0]` instead of `competitions.find(c => c.sport === sport)`.

- **`src/app/competitions/[id]/standings/page.tsx` — BUG-028:** Moved misplaced `useParams`/`useEffect` imports from line 147 to top of file. Replaced `<motion.tr>` with plain `<tr>`. Removed `initial={{ opacity: 0, y: 20 }}` from `StandingsMobileCard`. Removed `initial={{ opacity: 0, x: -20 }}` from `TopScorersTable`, `TopAssistsTable`, `DisciplinaryTable` (3 occurrences via `replace_all`). Kept all `animate` and `transition` props intact.

- **BACKLOG-036 second pass — 13 files migrated to `TeamLogo` component:**
  - `src/app/admin/manager/page.tsx` (2 instances)
  - `src/components/TrackLogger.tsx` (4 instances — removed `team?.logo &&` guard; TeamLogo handles null internally)
  - `src/app/admin/transfers/page.tsx` (2)
  - `src/app/user/[userId]/page.tsx` (1 — used `profile.favoriteTeam`, not `user.favoriteTeam`)
  - `src/app/search/page.tsx` (1 team instance; `comp.logo` at line 293 intentionally skipped)
  - `src/app/admin/livestreams/page.tsx` (2 — preserved `border-2 border-gray-900` via `className`)
  - `src/app/profile/page.tsx` (2 — CRLF file; fixed via node.js inline replace)
  - `src/app/logger/page.tsx` (2 — preserved `mx-auto mb-2` via `className`)
  - `src/components/MatchLineups.tsx` (3)
  - `src/components/LiveStats.tsx` (2)
  - `src/components/lineup/MatchSelector.tsx` (2)
  - `src/components/GlobalSearch.tsx` (1 team instance; `comp.logo` at line 316 intentionally skipped)
  - `src/components/FootballLogger.tsx` (2 — preserved `mx-auto mb-1.5` via `className`)
  - **Skipped (size-sensitive layout):** `admin/track-events`, `teams/[id]`, `lineup/TeamSelector`, `BasketballLogger`, `FullPitchLineups`

- **`src/app/admin/teams/[id]/page.tsx` — BACKLOG-037 Step 6 (CSV Import tab):**
  - Added `Upload` to lucide imports
  - Added 4 new types: `CSVRaw`, `MatchResult`, `Resolution`, `CSVPreviewRow` (extended with `linkSearch` field for inline search state)
  - Extended `activeTab` union: `'roster' | 'csv' | 'info'`
  - Added 4 CSV state vars: `csvFile`, `csvRows`, `csvImporting`, `csvResults`
  - `updateCsvRow(index, patch)` — patches single row in `csvRows`
  - `parseAndMatchCSV(file)` — `FileReader` → split → match against `roster` state (exact name → jerseyName → nickname priority), auto-resolves high to `existing`, none to `new`, medium to `pending`
  - `handleCSVImport()` — POSTs `{ entries }` to existing `/api/admin/teams/${teamId}/roster`, inlines roster refresh after success, surfaces errors via `showError`
  - CSV tab UI: file upload label (Section A), preview table with per-row action column (Section B), summary bar (Section C), import button with blocker guard (Section D), results panel (Section E)

- **`.agents/dev/TEST_CHECKLIST.md`:** Added BUG-027 (5 items), BUG-028 (3 items), BACKLOG-036 (3 items), BACKLOG-037 Step 6 (13 items). Removed resolved bugs from Known Broken.

**Bugs encountered:**

- **CRLF line endings in 3 files** (`search/page.tsx`, `livestreams/page.tsx`, `profile/page.tsx`) — Edit tool string matching fails on Windows CRLF files because `old_string` uses `\n` only. Root cause: files authored on Windows. Fix: node.js inline script with `.replace(/\r\n/g, '\n')` to normalise before writing.
- **`user/[userId]/page.tsx` wrong variable name** — initial edit used `user.favoriteTeam.logo` but file uses `profile.favoriteTeam.logo`. Caught by grepping before edit.
- **`RosterPlayer` uses `playerId` not `id`** — directive specified `match.player.id` in auto-resolve; fixed to `match.player.playerId` during implementation.
- **`nicknames` is already `string[]`** — directive included `JSON.parse(p.nicknames)` in matching logic but the GET handler already parses the JSON before returning roster. Fixed: direct array access.
- **BUG-021 and BUG-022 already fixed** — confirmed by reading the files; backlog updated to resolved without code change.

**Resolved:** BUG-021, BUG-022 (confirmed pre-existing), BUG-027, BUG-028, BACKLOG-036.

**Deferred:**
- `chore: session 14 wrap` commit (and earlier `feat: BACKLOG-036` + `feat: BACKLOG-037 Step 6`) — commits were declined by user at prompt; code is complete but unstaged
- BACKLOG-037 Step 7 (Squad Selector)
- BUG-023 (dead schema file), BUG-024 (duplicate match routes), BUG-026 (PWA CSS)
- BACKLOG-045 (teams pagination), BACKLOG-046 (Player Profile Edit)

**Next session:** Commit all staged work (`feat: BACKLOG-036`, `feat: BACKLOG-037 Step 6`, `chore: session 14 wrap`). Then BACKLOG-037 Step 7 (Squad Selector — revive `squadPlayers` table, competition → per-team squad selection UI).

---

### Session 15 — 2026-06-15

**Focus:** BACKLOG-037 Step 7 — Squad Selector. Full implementation: unique DB constraint, three API routes, and dual-panel UI tab on the team detail page.

**Built:**

- **`squad_players` unique index (staging + prod):** `CREATE UNIQUE INDEX IF NOT EXISTS squad_players_team_comp_player_unique ON squad_players (team_id, competition_id, player_id)` — run via `dev/add-squad-players-unique-index.mjs` against both DBs. Verified in `sqlite_master`. Script deleted after run. Logged in RUNLOG.md.

- **`src/app/api/admin/teams/[teamId]/competitions/route.ts` (GET):** Returns competitions this team is enrolled in, joined from `competitionTeamEntries → competitions`. Filters out `isArchived = true`. Auth: `getAuthUser + role === 'admin'`. Response: `{ competitions: [{ id, name, sport, status, season }] }`. Note: spec said `status !== 'archived'` but schema uses boolean `isArchived` — used the real column.

- **`src/app/api/admin/teams/[teamId]/squad/route.ts` (GET + POST):** GET requires `?competitionId`, joins `squadPlayers → players`, returns squad with all metadata. POST validates roster membership via `playerTeamAffiliations` before insert; application-level dedup check before hitting DB constraint; graceful catch on `UNIQUE constraint failed` for race condition. `selectedBy` sourced from `authUser.id`.

- **`src/app/api/admin/teams/[teamId]/squad/[squadPlayerId]/route.ts` (DELETE):** Fetches row first, verifies `row.teamId === teamId` before deleting — prevents cross-team deletion via URL manipulation. Returns 204/404/403.

- **`src/app/admin/teams/[id]/page.tsx` — Squad tab (268 lines added):** `SquadPlayer` and `TeamCompetition` types added. `activeTab` extended to `'roster' | 'csv' | 'squad' | 'info'`. 6 new state vars: `squadCompetitions`, `selectedCompetitionId`, `squad`, `squadLoading`, `squadSaving`, `confirmingRemove`. Functions: `fetchSquadCompetitions` (called on mount), `fetchSquad` (useEffect on `selectedCompetitionId`), `handleAddToSquad`, `handleRemoveFromSquad`. Derived state: `squadPlayerIds` (Set), `availablePlayers`, `availableCount`. UI: competition dropdown (Section A), dual panel — Available left / Squad right (Section B), summary bar (Section C). Remove requires two-click confirm (`confirmingRemove` state).

- **`.agents/dev/BACKLOG.md`:** BACKLOG-037 Step 7b filed (role assignment UI, deferred). BACKLOG-044 Notes updated (squad limits belong in competition sport settings). BACKLOG-047 through BACKLOG-052 filed.

- **`.agents/dev/RUNLOG.md`:** Session 15 entries added for staging and prod index creation.

**Bugs encountered:**

- **`dotenv/config` doesn't load `.env.local`** — `import 'dotenv/config'` loads `.env` by default. `.env.local` requires `config({ path: '.env.local' })`. Fixed in the index script before running.

- **Spec said `status !== 'archived'` but schema uses `isArchived` boolean** — competitions table has no `status === 'archived'` value; archived state is tracked by `isArchived: boolean`. Used `.filter((r) => !r.isArchived)` instead of status string comparison. If spec and schema diverge, always trust the schema.

**Resolved:** BACKLOG-037 Step 7 (Squad Selector API + UI).

**Deferred:**
- BACKLOG-037 Step 7b (role assignment UI — captain/vice_captain/goalkeeper badges)
- BACKLOG-045 (teams pagination), BACKLOG-046 (player profile edit)
- BUG-023, BUG-024, BUG-026
- BACKLOG-047 through BACKLOG-052 (all filed this session, all OPEN)

**Next session:** Verify Squad Selector end-to-end on staging. Then BACKLOG-046 — Player Profile Edit page (`/admin/players/[id]` — PATCH API already exists at line 294 of `src/app/api/players/[id]/route.ts`, no UI built yet).

---

### Session 17 — 2026-06-15

**Focus:** BACKLOG-053 — complete Roster tab re-architecture (Part 1: affiliationId + inline affiliation edit; Part 2: swap tab contents, add squadNumber inline edit, PATCH endpoints).

**Built:**

- **`src/app/api/admin/teams/[teamId]/roster/route.ts` — affiliationId added:** `affiliationId: playerTeamAffiliations.id` added to GET select. Needed to target inline affiliation edits from the UI.

- **`src/app/api/admin/teams/[teamId]/roster/[affiliationId]/route.ts` — NEW PATCH handler:** Auth-gated (`getAuthUser + role === 'admin'`). Fetches row, verifies `existing.teamId !== teamId` → 403 (cross-team protection). Accepts `jerseyNumber`, `position`, `nicknames`, `isActive`. Returns updated row. Full try/catch with finally.

- **`src/app/api/admin/teams/[teamId]/squad/[squadPlayerId]/route.ts` — PATCH handler appended:** Alongside existing DELETE. Same auth + cross-team protection pattern. Accepts `squadNumber`, `role`, `status`. Returns updated `squadPlayer` row.

- **`src/app/admin/teams/[id]/page.tsx` — BACKLOG-053 Part 1 (commit dcd464c):**
  - `affiliationId` field added to `RosterPlayer` type
  - New state: `editingAffiliationId`, `affiliationEdits` (partial affiliation fields)
  - `handleSaveAffiliation()` — PATCHes `/api/admin/teams/${teamId}/roster/${affiliationId}`, refreshes roster, clears edit state
  - Squad tab rows: pencil icon → inline jersey/position/nicknames fields → Save/Cancel

- **`src/app/admin/teams/[id]/page.tsx` — BACKLOG-053 Part 2 (commit 2e83f6d):**
  - **Roster tab** now holds: competition dropdown (from `squadCompetitions`), dual panel (pool left = `availablePlayers`, squad right = `squadPlayers`), squadNumber inline edit per squad row (pencil → number input → PATCH `squad/[squadPlayerId]` → refresh → close). `handleAddToSquad`/`handleRemoveFromSquad` unchanged — now consumed by Roster tab.
  - **Squad tab** now holds: flat `playerTeamAffiliations` table with inline affiliation edit (jerseyNumber, position, nicknames) + Add Players to Pool panel (existing search + create new form). Previously this was the Roster tab layout.
  - New state: `editingSquadNumberId`, `squadNumberInput`
  - New handler: `handleSaveSquadNumber()` — PATCHes `squad/${squadPlayerId}`, refreshes squad, closes edit

**Bugs encountered:**

- **Pre-existing tsc error at `page.tsx:1393`** — `row.resolution.playerId` in CSV tab. TypeScript can't narrow the `Resolution` discriminated union through JSX conditions. Untouched code, not introduced this session. Low priority.

- **Write tool blocked on new file** — `squad/[squadPlayerId]/route.ts` couldn't be written because it hadn't been Read first. Fixed: read file (DELETE handler was already there), used Edit to append PATCH handler.

- **Bash bracket escaping on Windows** — `ls` with `[teamId]` path brackets failed with EOF. Fixed: used forward slashes in path.

**Resolved:** BACKLOG-053 (both parts) — Roster tab shows competition squad, Squad tab shows affiliation pool.

**Deferred:**
- BUG-026 (PWA CSS cache failure)
- BACKLOG-044 (match config: duration, sub rules, team size per competition)
- BACKLOG-045 (teams pagination)
- BACKLOG-037 Step 7b (role assignment UI on squad players)
- CSV tab tsc error at line 1393 (pre-existing, low priority)

**Next session:** Verify BACKLOG-053 on staging — navigate to `/admin/teams/[id]`, select a competition on Roster tab, confirm dual panel, confirm squadNumber inline edit saves. Then BUG-026 or BACKLOG-044.

---

### Session 16 — 2026-06-15

**Focus:** Clean up remaining BUGs from last session, complete BACKLOG-046 (Player Profile Edit), and identify Roster tab mental model mismatch.

**Built:**

- **BUG-023 — `src/db/schema-nesa-registrations.ts` deleted.** Orphaned file referenced `players` and `organizations` tables without importing them. Zero imports anywhere in codebase. File deleted; tsc errors from that file eliminated.

- **BUG-024 — closed as false alarm.** `/match/[id]` route never existed. `/matches/[id]` is and always was the canonical route. All internal navigation already uses the canonical path. No fix needed.

- **BUG-029 — `GET /api/players/[id]` email strip.** `getAuthUser(request).catch(() => null)` added at top of handler. `email` returned only when `authUser?.role === 'admin'`. Public access unaffected — catch ensures unauthenticated callers get `null` auth, not a 401.

- **BACKLOG-037 Step 7 tab order + label rename:** Tab order changed to Roster → Squad → CSV Import → Info. Labels renamed: "Roster" = competition squad (picked players), "Squad" = full affiliated pool. Matches football terminology.

- **BACKLOG-046 — `/admin/players/[id]` Player Profile Edit page:** Full field edit (name, jerseyName, number, position, college, university, email, bio, nationality, DOB, height, weight, foot, rating). Memberships list (via playerOrganizationAffiliations). Org affiliations. Recent events. PATCH uses existing `/api/players/[id]` PATCH handler. View link added to players list alongside existing modal edit button.

- **BACKLOG-049 through BACKLOG-056 — filed.**

**Bugs encountered:**

- **Roster tab mental model mismatch discovered mid-session.** BACKLOG-053 directive was drafted but NOT run after recognising the issue: Roster tab currently shows `playerTeamAffiliations` rows (the full affiliated pool). It should show `squadPlayers` for the selected competition. Inline edit belongs on `squadPlayers.squadNumber` + `position`, not the affiliation row. Squad tab keeps the affiliated pool. Deferred to next session.

**Resolved:** BUG-023, BUG-024, BUG-029, BACKLOG-037 Step 7 (tab order/labels), BACKLOG-046.

**Deferred:**
- BACKLOG-053 — Roster tab re-architecture (show squadPlayers, not playerTeamAffiliations)
- BUG-026 (PWA CSS cache failure)
- BACKLOG-044 (match config: duration, sub rules)
- BACKLOG-047 through BACKLOG-052 (filed last session, all OPEN)

**DB changes:**
- `squad_players_team_comp_player_unique` unique index added to `squad_players` on both staging and prod via SQL direct (Session 15 — logged in RUNLOG.md).

**Next session:** Re-architect Roster tab to show `squadPlayers` for the selected competition. Inline edit targets `squadPlayers.squadNumber + position`. Squad tab keeps `playerTeamAffiliations` pool view.

---

### Sessions 11-12 — 2026-06-14

**Focus:** BUSALYMPICS data completion (BACKLOG-017 + BACKLOG-033), Three.js hotfix to prod, and BACKLOG-037 Steps 1-4 (Roster Builder foundation) + TeamLogo utility.

**Built:**

- **`dev/patch-busalympics-scores.ts` (run + deleted):** PATCHed MD3 G1 (`_9nntLoOZZOZGzja8EQE9` COLNAS 3–1 COLENVS) and MD3 G2 (`y3KcCGtHA7N7MybKTHX5K` COLMANS 0–1 COLENG) on staging + prod. Also corrected MD2 G1 on staging (was wrong score). All 7 BUSALYMPICS fixtures now FINISHED on both DBs.

- **`dev/recalculate-busalympics-standings.ts` (run + deleted):** Upserted 4 standings rows for `competitionId: 9q8LMVqW8KAtF4BJBlyk_` on staging + prod. Final excluded correctly. COLENG top of group (6pts, +3 GD).

- **SQL direct — staging + prod:**
  - `ALTER TABLE player_team_affiliations ADD COLUMN nicknames TEXT DEFAULT '[]'` — confirmed both DBs.
  - `CREATE UNIQUE INDEX pta_player_team_unique ON player_team_affiliations (player_id, team_id)` — confirmed both DBs.
  - `src/db/schema.ts` updated to match: `nicknames` column + `pta_player_team_unique` index.

- **`src/app/api/admin/teams/[teamId]/roster/route.ts` (276 lines):** `POST /api/admin/teams/[teamId]/roster` — discriminated union (`mode: 'existing' | 'new'`), dedup against existing affiliation, `syncPlayerOrganizationAffiliations` on new-mode inserts. `tsc` clean.

- **`src/app/api/players/search/route.ts` (219 lines):** `GET /api/players/search` — `q` (name/jerseyName/nickname), `excludeTeamId`, admin-only. Nickname search parses JSON array from `playerTeamAffiliations.nicknames`. `tsc` clean.

- **`src/app/admin/teams/page.tsx` (231 lines):** Teams list page — cards with logo, org, crest type, "Manage Roster" CTA.

- **`src/app/admin/teams/[id]/page.tsx` (919 lines):** Team detail with Roster Builder tab — "Add Existing" player search with debounce + dropdown, "Create New" inline form, batch submit, per-row inserted/skipped/error feedback. Fuzzy dedup warning panel for >70% name similarity.

- **`src/lib/utils/team-logo.tsx`:** `isValidLogo()` guard (rejects empty string, non-http local paths, invalid URLs) + `TeamLogo` component with `onError` fallback to styled initials avatar. Migrated: `src/components/ui/MatchCard.tsx` (6 instances), `src/app/competitions/page.tsx` (5), `src/app/admin/page.tsx` (2) — 13 total. First-pass complete.

- **`src/components/AdminSidebar.tsx`:** Teams entry added under Player Management section.

- **Three.js hotfix:** `src/app/error.tsx` and `src/app/not-found.tsx` Three.js `dynamic` import and Scene JSX commented out. Pushed to prod. Error pages no longer load ~500KB Three.js bundle.

- **New backlog/bug items filed:** BACKLOG-036 (college team logos), BACKLOG-037 (Roster Builder — already in flight), BACKLOG-038 (Bulk Register dedup), BACKLOG-039 (CSV nickname reconciliation), BACKLOG-040 (schema drift: organizations_slug_unique), BACKLOG-041 (nickname search in logger), BACKLOG-042 (Duplicate Merge Tool), BACKLOG-043 (Temp Player flow), BACKLOG-044 (Match Config: duration/sub rules). BUG-027 (competitions list incomplete), BUG-028 (hydration error #418 on competition detail).

**Bugs encountered:**

- **College team logos are empty string in DB** — `isValidLogo('')` returns false, initials fallback renders. Root cause: logos were never uploaded for COLNAS/COLENG/COLMANS/COLENVS. No code bug, data gap only. Tracked as BACKLOG-036.
- **BUSA team logos use local public/ paths** (`/assests/...` typo) — `isValidLogo` initially blocked these. Fixed: `isValidLogo` now only rejects empty string and clearly invalid values, not local paths. Local paths resolve today; Cloudinary migration is future work (BACKLOG-036).
- **organizations_slug_unique schema drift** — `src/db/schema.ts` declares the index but it does not exist in staging or prod. `db:push` fails. Root cause: index was added to schema after DBs were created without a push. Workaround: use SQL direct. Tracked as BACKLOG-040. Do not run `db:push` until resolved.

**Resolved:** BACKLOG-017 (all 3 missing MD3 scores confirmed + patched), BACKLOG-033 (standings written to both DBs).

**Deferred:**
- BACKLOG-037 Steps 5-7 (Bulk Register dedup refinement, CSV import tab, Squad Selector)
- BACKLOG-036 second pass — 18 files, 40 logo instances still using raw `<img>` instead of TeamLogo
- BUG-025 (assignedLoggers NDPR leak on public /api/matches list — strip 2 fields, quick fix)
- BUG-027 (competitions list missing BUSALYMPICS Football)
- BUG-028 (hydration error #418 on competition detail page)
- BACKLOG-026 (AWS SES broken email)
- BUG-021–024 (notifications auth, unbounded queries, schema-nesa, duplicate routes)

**Next session:** Verify Roster Builder on staging (/admin/teams → pick a team → add player). Then BUG-025 (strip `assignedLoggers` + `loggerId` from public `/api/matches` DTO — quick warm-up). Then BACKLOG-037 Step 5 (bulk-register pre-flight dedup: name+college similarity check, return `possible_duplicate` in skippedPlayers).

---

### Session 11 — 2026-06-11

**Focus:** Rules of Hooks violation fix in match detail page, Three.js error scene backscope, platform model documentation.

**Built:**

- **`src/app/matches/[id]/page.tsx` — hook move:** `const isUpcoming` (derived from `matchData?.match?.status`) and `useEffect([isUpcoming])` moved from after the two early-return guards (`loading` and `!matchData`) to immediately after the last hook declaration block (line 48). Removed the now-redundant `const isUpcoming = match.status === 'UPCOMING'` that remained after the early returns. Fix applied on both `dev` (commit `1215ce2`) and `hotfix/fix-matches-hooks-violation` branches.

- **`src/app/error.tsx` + `src/app/not-found.tsx` — Three.js backscope:** Commented out `dynamic` import, Scene dynamic loader, and JSX usage in both files. BACKSCOPED markers reference BACKLOG-031. Component files (`SoccerGoalScene.tsx`, `BasketballRimScene.tsx`) untouched and not deleted.

- **`.agents/dev/PLATFORM_MODEL.md`** — created. Documents the Google Drive mental model, what the schema already handles (~80%), the three missing pieces before University 2 onboards (users.universityId FK, admin permission scoping, affiliation-aware feed ordering), cross-university competition options A/B, and the implementation order.

**Bugs encountered:**

- `cherry-pick 1215ce2` onto `hotfix/fix-matches-hooks-violation` produced a 3-file conflict. Root cause: the hotfix branch has Predictions/Polls reinstated (imports active, `activeTab` type includes `'polls' | 'predictions'`) while the dev branch has them BACKSCOPED. The diff for `page.tsx` diverged at the `setActiveTab('predictions')` vs `setActiveTab('overview')` call inside the moved useEffect. Resolved by aborting the cherry-pick and applying the fix directly on the hotfix branch.
- After the hook move, duplicate `const isUpcoming` existed in the same function scope (new one at line 48, old one at line 235). TypeScript TS2451 — fixed by removing the old declaration. The JSX below the early returns continued using `isUpcoming` from the moved const, which now correctly derives from `matchData?.match?.status`.

**Resolved:** Rules of Hooks violation — `useEffect` after conditional return (matches detail page)

**Deferred:**
- Commit + PR for `hotfix/fix-matches-hooks-violation` → `main` (fix applied, not yet committed)
- BACKLOG-017 — 2 missing MD3 BUSALYMPICS scores (physical records)
- BACKLOG-033 — standings recalculation (blocked on BACKLOG-017)
- BUG-026 — PWA/cache CSS rendering failure on direct URL visits
- BACKLOG-034 — competition config business logic audit

**Next session:** Commit the hotfix branch (`git add src/app/matches/[id]/page.tsx && git commit`) then open PR to `main`. After merge, address BACKLOG-034 — competition config audit.

---

### Session 10 — 2026-06-11

**Focus:** Post-merge prod verification (dev → main landed), BACKLOG-028 backscoping, WORKFLOW.md full documentation, pre-prod-check tooling upgrade.

**Built:**

- **`dev/pre-prod-check.ts` — `--staging` / `--production` flag** — script now reads `process.argv`. `--production` loads `.env.production`; default (or `--staging`) loads `.env.local`. Header output shows `[STAGING]` or `[PRODUCTION]` label. WORKFLOW.md updated with both command forms.

- **`.agents/dev/BACKSCOPE.md`** — new permanent journal. One entry per backscoped feature: current state, what exists in code, what's missing to reinstate, reinstate-when condition, risk if reinstated early. Covers /fpl/*, /predictions, /scouts, /nesa-registration, /auth/signin, Polls UI.

- **`WORKFLOW.md` — fully documented** — added: Hotfix flow (branch/merge/audit procedure, when NOT to use), Partial Feature / Backscope flow (Option A comment-out pattern with exact format, Option B feature-flag path for future), pre-merge checklist updated with `--staging`/`--production` variants, `.env.local` vs `.env.production` rule made explicit.

- **BACKLOG-028 RESOLVED — backscoping execution:**
  - Page gates (`notFound()`): `src/app/fpl/page.tsx` + 4 sub-pages, `src/app/predictions/page.tsx`, `src/app/nesa-registration/page.tsx`, `src/app/auth/signin/page.tsx`, `src/app/scouts/page.tsx` (was redirect to `/`, now 404)
  - UI surfaces commented out (format: `// BACKSCOPED: 2026-06-08 — BACKLOG-028. Reinstate when: ...`):
    - `src/app/profile/page.tsx` — "My Predictions" QuickActionButton
    - `src/app/matches/[id]/page.tsx` — Predictions tab button + Polls tab button + both content panels + MatchPoll/MatchPredictionCard/MatchVotePoll imports
    - `src/components/MatchOverlay.tsx` — Predict + Poll tab entries + content blocks + imports
    - `src/components/BasketballMatchOverlay.tsx` — Predict + Fan Poll tab entries + content blocks + imports + unused `Target` icon
    - `src/components/matches/UpcomingMatchView.tsx` — Prediction/Poll tab block + Quick Vote sidebar + activeTab state + unused imports
    - `src/app/sitemap.ts` — `/fpl` + `/predictions` entries commented out (was already done correctly)

**Bugs encountered:**

- First pass of backscoping used hard deletes instead of comment-outs in component files — caught during git diff review. Root cause: session started before the comment-out convention was established. Fixed by re-adding all deleted content as commented blocks with BACKSCOPED markers before committing.
- Profile page Privacy & Security button lost its indentation when the "My Predictions" line above it was deleted (empty string replacement collapsed the line). Fixed when converting to comment-out format.

**Resolved:** BACKLOG-028 (backscope dead nav items)

**Deferred:**
- BACKLOG-017 — 2 missing MD3 BUSALYMPICS scores, awaiting physical records
- BACKLOG-033 — standings recalculation, blocked on BACKLOG-017
- BUG-026 — PWA/cache CSS rendering failure on direct URL visits
- BACKLOG-034 — competition config business logic audit (not started this session)

**Next session:** BACKLOG-034 — competition config business logic audit. Start by reading `src/app/api/competitions/route.ts` and all sub-routes. Key known issues: N+1 query in `includeStats` path, dual FK-or-name lookup pattern that's now stale (all matches have `competitionId`), no `try/catch/finally` on DB reads.

---

### Session 9 — 2026-06-08

**Focus:** Pre-prod data clearance, automated pre-merge tooling, and staging/prod DB parity.

**Built:**

- **`dev/pre-prod-check.ts`** — permanent reusable pre-merge clearance script. 5 blocks: auth gates (Block 1), response shape/NDPR checks (Block 2), DB integrity counts (Block 3), round distribution (Block 4), competition presence (Block 5). Exit 0 = CLEAR TO MERGE, exit 1 = BLOCKED. Committed to repo via `.gitignore` negation (`!dev/pre-prod-check.ts`). Ready for Tier 2 CI integration with zero changes (already exits 0/1).

- **`.agents/dev/WORKFLOW.md`** (new) — documents environment map (`.env.local` = staging always, `.env.production` = prod), three DB change categories (schema / code / data) with their paths to prod, pre-merge checklist, and Tier 2 CI upgrade path.

- **`.gitignore` updates** — added `.env.prod` / `.env*.production` coverage; `!dev/pre-prod-check.ts` negation to allow the one reusable script to be committed while keeping all one-off scripts gitignored.

- **BACKLOG-034 filed** — pre-prod clearance script Tier 1 complete, Tier 2 path documented.

- **BACKLOG-007 + BACKLOG-008 marked RESOLVED** — verified live on prod DB. The earlier confusion (zero rows returned when querying by abbreviated name) was because `teams.name` stores full college names (`"College of Engineering"`) not shorthand (`"COLENG"`). Queried by ID from RUNLOG confirmed all 4 teams linked and enrolled.

- **Staging DB brought to parity with prod** — `dev/fix-staging-data.ts` applied: 59/59 legacy matches backfilled with `round` + `competition_id`; 59/59 `competition` strings stripped of ` - suffix`; 3 competition names renamed to use parens (`BUSALYMPICS (FOOTBALL)` etc.); new competitions already existed, skipped.

- **Pre-prod check: 20/20 CLEAR TO MERGE** — all blocks green on staging app + staging DB.

**Bugs encountered:**

- `.env.local` was pointing at **staging** not prod, contradicting the session-start assumption. Caught when `identify-db.ts` printed hostname `brixsportsv2-staging`. Root cause: `.env.local` was updated between sessions. Fix: wrote `.env.production` pattern to gitignore, documented `.env.local = staging always` rule in WORKFLOW.md.
- Running pre-prod check against **prod app** (`brixsports.com`) showed 10 failures — 500s and NDPR leaks. These are expected: prod is running the old unpatched code. The `dev` branch fixes are what the PR delivers. Check is correct; it needs to run against staging (dev code), not prod.
- Top-level `await` in `.ts` scripts compiled as CJS by tsx — caused `TransformError`. Fix: always wrap in `async function main()`.
- `dotenv.config()` without explicit path loads `.env` not `.env.local`. Fix: `dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })` explicitly.

**Resolved:** BACKLOG-007, BACKLOG-008 (verified); staging DB parity complete.

**Deferred:**
- Commit + PR `dev → main` (staged, awaiting user go-ahead)
- BACKLOG-017 (2 MD3 BUSALYMPICS scores) — awaiting physical records
- BACKLOG-033 (standings recalculation) — blocked on BACKLOG-017

**Next session:** Open PR `dev → main`. 5 files staged. Then address BUG-025 (NDPR leak on `/api/matches` public list — `loggerId` + `assignedLoggers` still exposed on prod).

---

### Session 8 — 2026-06-08

**Focus:** BACKLOG-032 — Round label display on match cards. Data investigation, normalisation, display fix across all render paths.

**Built:**

- **Data investigation:** Discovered two-tier data problem — BUSALYMPICS matches used `round` column correctly; legacy BUSA League Football/Basketball matches had round baked into the denormalized `competition` string with no `competitionId` FK and no `round` column value.

- **`dev/normalise-legacy-match-rounds.ts` (run + deleted):** Backfilled `competitionId` and `round` on 59 legacy matches. First apply failed — competition IDs in directive were placeholder strings, not real DB IDs. Real IDs confirmed via diagnostic query (`xm1OcBFeugKxLDHH6Xi6p` for football, `m-4qhMBvnUP2a-GcU-Rsv` for basketball), map corrected, re-run successful. 59/59 rows written.

- **`dev/strip-competition-suffix.ts` (run + deleted):** Stripped now-redundant suffix from `competition` strings on the same 59 rows (`"BUSA League Football - Final"` → `"BUSA League Football"`). 59/59 rows written. Verified: 0 matches remaining with ` - ` in competition where round is set.

- **BACKLOG-032 display fix — all render paths:**
  - `src/types/index.ts` — added `round?: string | null` to global `Match` interface
  - `src/app/page.tsx` — added `round: match.round ?? null` to all 4 transform maps (both fetch paths: initial + status-change refetch); added round label to individual match rows in homepage list
  - `src/components/ui/MatchCard.tsx` — added `round` to prop interface; updated all 3 variants (compact, live, detailed)
  - `src/components/matches/UpcomingMatchView.tsx` — added `round` to local `Match` interface; updated 2 renders (hero heading + match info panel)
  - `src/components/MatchComponents.tsx` — updated 2 renders with `(match as any).round` cast (file uses deprecated mock-data `Match` type which has no `round` field — tracked in BACKLOG-030)
  - `src/app/live/page.tsx` — updated in previous session (Session 7)
  - `src/app/admin/matches/page.tsx` — updated in previous session (Session 7)

- **BUG-026 filed:** PWA/cache issue — CSS fails to render on direct URL visits (hard nav). Service worker or precache manifest not including CSS bundle correctly. Filed: 2026-06-08, found by manual staging QA.

**Bugs encountered:**

- BACKLOG-032 initial commit (Session 7) only fixed `/live` and admin matches page. BUSALYMPICS matches are FINISHED/UPCOMING — never appear on `/live`. Real render paths were homepage (`page.tsx`) and shared components (`MatchCard.tsx`, etc.) — found via grep.
- First normalisation apply failed with FK constraint — directive used placeholder IDs. Diagnosed and corrected in-session.

**Resolved:** BACKLOG-032 (full — data + display)

**Deferred:**
- BACKLOG-033 (BUSALYMPICS standings) — blocked on MD3 G1 and MD3 G2 physical scores still unconfirmed
- BACKLOG-028 (backscope dead nav items) — not started
- BACKLOG-017 (2 missing BUSALYMPICS match scores) — awaiting physical records
- BUG-026 (PWA/cache CSS issue) — filed, not investigated

**Next session:** BACKLOG-028 (backscope dead nav items — low risk, self-contained) or BUG-026 investigation (PWA cache config).

---

### Session 7 — 2026-06-08

**Focus:** Session recovery after context-window cutoff. Commit all uncommitted session 6 changes. Run security/code-review/flow-checker agents before committing. Complete BUG-021 through BUG-025 sprint.

**Built:**

- **Context recovery audit:** Identified orphan `BUILD_JOURNAL.md` at project root (wrong location — canonical is `.agents/dev/`). Deleted orphan. Identified 12 uncommitted files from session 6 that were complete but never staged.

- **Commit `b1a6ec9` — BUG-015 through BUG-020 + hardening:**
  - `src/app/api/matches/[id]/route.ts`: PATCH now requires `getAuthUser` before body read; admin passes through, logger role gated by `isLoggerAssigned`; DELETE handler had zero auth — admin gate added (new critical find from code-reviewer); approval fields (`approvalStatus`/`approvedBy`/`approvedAt`/`managerNotes`) now admin-only in PATCH — loggers were previously able to write these; 409 conflict response no longer leaks `currentLoggerId`; GET events use explicit DTO stripping `loggerId` from every event row; `relatedPlayer` uses shaped select instead of raw `db.select()`.
  - `src/app/api/competitions/route.ts`: POST gated; `.limit(500)` added to unbounded GET query.
  - `src/app/api/admin/infrastructure/route.ts`: GET gated with `getAuthUser` + admin.
  - `src/app/api/analytics/system/route.ts`: GET gated.
  - `src/app/api/analytics/loggers/route.ts`: `email` stripped from `logger` object in GET response DTO; `.limit(10000)` added to per-logger events fetch.
  - `src/app/live/page.tsx`: `setInterval(fetchLiveMatches, 15000)` with `clearInterval` on unmount.
  - 3 debug routes deleted: `notifications/debug`, `notifications/test`, `email/test`.
  - `src/components/notifications/PushNotificationDebugger.tsx`: removed `debugSubscriptions()` and `testVAPIDConfig()` functions and buttons (called deleted routes); replaced `user?.email` in DOM with `user?.role` (NDPR fix).
  - `.agents/rules/security.md` added to commit (was untracked).

- **Commit `6542800` — BUG-021 through BUG-025:**
  - `src/app/api/notifications/subscribe/route.ts`: `getAuthUser` added to POST before body read (BUG-021).
  - `src/app/api/events/route.ts`: `.limit(100)` added to GET (BUG-022).
  - `src/app/api/matches/[id]/events/route.ts`: `.limit(200)` added to GET (BUG-022).
  - `src/app/api/matches/route.ts`: stripped `loggerId`, `assignedLoggers`, `approvalStatus`, `managerNotes`, `approvedBy`, `approvedAt` from public GET response DTO; removed the entire `assignmentsList` fetch block (was building data only to expose it publicly); added `.limit(200)` to per-match events inline fetch (BUG-025).
  - `src/db/schema-nesa-registrations.ts`: marked DEAD at top of file — no routes or UI reference it; candidate for deletion in BACKLOG-028 (BUG-023).
  - `src/app/match/[id]/page.tsx`: deleted — legacy duplicate of `/matches/[id]` (BUG-024).
  - `src/components/ui/MatchCard.tsx`: 3 `/match/` hrefs updated to `/matches/` (BUG-024).
  - `src/app/page.tsx`: `router.push('/match/...')` updated to `/matches/` (BUG-024).
  - `src/app/football/page.tsx`: same update (BUG-024).

**Bugs encountered:**

- **Bash shell died mid-session:** After git commit, the Bash tool's shell lost all PATH entries — `npx`, `node`, `grep`, `tail` all returned 127. Root cause: session environment degraded, likely a subshell spawned without inheriting PATH. Git remained functional (different tool path). Workaround: used Grep/Read tools for verification instead of tsc. `tsc` confirmed clean in the earlier part of the session; no new errors introduced in BUG-021–025 changes (all changes were additive — `.limit()`, auth gate, destructure, comment, link text swaps).
- **Agents found DELETE handler with zero auth (new critical):** code-reviewer and security agents both independently caught that `DELETE /api/matches/[id]` had no `getAuthUser` call at all — any anonymous request could delete any match. This was not in the original BUG list. Fixed in `b1a6ec9`.
- **Agents found logger PATCH approval field bypass:** Assigned loggers could write `approvalStatus`/`approvedBy` via PATCH because the role check passed but the field list was not role-scoped. Fixed in `b1a6ec9`.
- **BUG-018 was only half-done after session 6:** The match DTO was stripped but the events array used `...row.event` spread — `loggerId` was still present on every event row in the response. Security agent caught this. Fixed with explicit event DTO in `b1a6ec9`.

**Resolved:** BUG-015, BUG-016, BUG-017, BUG-018, BUG-019, BUG-020, BUG-021, BUG-022, BUG-023, BUG-024, BUG-025, BACKLOG-029.

**Deferred:**

- BACKLOG-033 (BUSALYMPICS standings) — blocked on MD3 G1 and MD3 G2 physical scores still unconfirmed
- BACKLOG-032 (round label on match cards) — not started
- BACKLOG-028 (backscope dead nav items) — not started
- Pre-existing tsc errors in `src/db/` scripts and various unrelated `src/app/` files — pre-dated this session, not introduced here

**Next session:** BACKLOG-032 (display round/matchday label on match cards — public live page + admin match list) or BACKLOG-028 (backscope dead nav items: /fpl/\*, /predictions, /scouts, /nesa-registration, /auth/signin, polls UI). Either is self-contained and low-risk.

---

### Session 6 — 2026-06-08

**Focus:** BACKLOG-029 Auth Sweep — audit and fix 17 unprotected API endpoints. BUG-015 through BUG-020 sprint. Security rule creation. BUSALYMPICS score entry.

**Built:**

- **BACKLOG-029 (RESOLVED):** Audited 17 endpoints flagged "auth unknown" from system audit. All 17 had zero auth. All 17 fixed with `getAuthUser(request)` + role check before body read.
  - Files changed: `competitions/register/approve`, `competitions/bulk`, `matches/bulk`, `matches/bulk-update`, `matches/[id]/remove-logger`, `matches/[id]/loggers`, `matches/[id]/assigned-loggers`, `players/bulk`, `players/create-individual`, `transfers`, `competitions/[id]`, `cloudinary/sign`, `admin/ads/[id]`, `analytics/loggers`, `notifications/history`, `brackets`, `competitions/register`
  - Additional agent-identified fixes: `analytics/loggers` POST handler had no auth (missed in sweep); DELETE ordering bug in `matches/[id]/loggers`; `matches/bulk-update` had client-writable `loggerId` (removed)
- **`src/lib/match-logger-helpers.ts`:** Replaced `...a.logger!` spread with explicit DTO in `getMatchLoggers` and `getPrimaryLogger`. Spread was leaking `email` field of every assigned logger to any caller with logger role.
- **`src/lib/auth.ts`:** Removed hardcoded JWT fallback secret (`'your-secret-key-change-in-production'`). Both `verifyAuth` and `generateToken` now use `env.jwtSecret` from `src/lib/env.ts`. Startup fails fast if `JWT_SECRET` absent. Removed 4 `console.log` calls that wrote auth header presence and user email on every authenticated request.
- **`src/app/api/transfers/route.ts` GET:** Removed `createdBy` from public response. Shaped `player` sub-object to safe fields only (name, jerseyName, number, position, image). BUG-004 recurrence also fixed in POST: `createdBy` now sourced from `authUser.id` not body.
- **`src/app/api/competitions/[id]/route.ts` GET:** Shaped `competitionMatches` array to exclude `loggerId` (banned public field) before returning.
- **`src/app/api/competitions/register/route.ts` GET:** Stripped `contactEmail` and `contactPhone` from public registration status response.
- **`.agents/rules/security.md`:** Created (always_on). Enforces: no hardcoded secrets, no secrets in git, correct DB script pattern using `dotenv/config` + `process.env`, env-based API tokens.

- **BUG-015 (RESOLVED):** `PATCH /api/matches/[id]` — added `getAuthUser` before body read. Admin passes through; logger role calls `isLoggerAssigned(matchId, authUser.id)` from `match-logger-helpers.ts` — 403 if not assigned.
- **BUG-016 (RESOLVED):** `POST /api/competitions` — `getAuthUser` + `role === 'admin'` added.
- **BUG-017 (RESOLVED):** Deleted `notifications/debug/route.ts`, `notifications/test/route.ts`, `email/test/route.ts`. Note: `PushNotificationDebugger.tsx` still calls the deleted endpoints — follow-up needed to remove those fetch calls.
- **BUG-018 (RESOLVED):** `GET /api/matches/[id]` — explicit destructure excludes `loggerId`, `approvalStatus`, `managerNotes`, `approvedBy`, `approvedAt` before response is returned.
- **BUG-019 (RESOLVED):** `GET /api/admin/infrastructure` and `GET /api/analytics/system` — `getAuthUser` + `role === 'admin'` added to both handlers.
- **BUG-020 (RESOLVED):** `/live` page already had a `setInterval` at 30s — changed to 15s. Stopgap until Socket.IO WS subscription is wired to the public viewer.

- **BUSALYMPICS MD2 G1:** Match `a9CtLwotaXyfsfMf2odAM` PATCHed directly via libsql client to FINISHED (COLNAS 1–2 COLENG). DB verified: 1 row affected.
- **BACKLOG-032 + BACKLOG-033 filed:** Round display on match cards; BUSALYMPICS standings blocked on MD3 scores.

**Bugs encountered:**

- **Inline secret in node eval (security violation):** Turso auth token was hardcoded directly in a `node -e` eval command to run a DB query when the turso CLI was unavailable. User called this out immediately. Root cause: no established pattern for inline DB queries without the CLI. Fix: `.agents/rules/security.md` created; memory saved. Dev scripts must always use `import 'dotenv/config'` and `process.env`.
- **analytics/loggers POST missing auth (agent catch):** The code-reviewer agent found the POST handler (leaderboard endpoint) on `analytics/loggers/route.ts` was completely unprotected — missed in the manual sweep because the GET was fixed but the second export in the same file was not. Root cause: file had two exported handlers; the sweep fixed only the first one. Prevention: when fixing a file, always scan all exports, not just the first.
- **DELETE ordering bug in matches/[id]/loggers:** Identity check (`authUser.id !== loggerId`) ran before null check (`if (!loggerId)`). If a logger sent a DELETE with no `loggerId` query param, the identity check compared `authUser.id !== null` which is always truthy → wrong 403 instead of correct 400. Fixed: null check moved above identity check.

**Resolved:** All items listed above.

**Deferred:**

- Commit: user declined the commit at session end — all changes are unstaged/uncommitted on `dev`
- `PushNotificationDebugger.tsx` fetch calls to deleted routes — will 404 in production
- MD3 G1 and MD3 G2 BUSALYMPICS scores — physical records still needed
- BACKLOG-033 standings recalculation — hard gate: not until both MD3 fixtures FINISHED
- BUG-021 through BUG-024 — not touched this session
- analytics/loggers GET response still includes `email` field — strip in follow-up
- tsc: exits 0, zero new errors

**Next session:** Commit session 6 changes → PushNotificationDebugger.tsx cleanup → BACKLOG-032 (round label on match cards) or BUG-021 sprint.

---

### Session 5 — 2026-06-08

**Focus:** BACKLOG-020 Block 6 — Full system audit. Sweep all routes, API endpoints, DB schema, components, and services. Produce SYSTEM_AUDIT.md.

**Built:**

- `.agents/dev/SYSTEM_AUDIT.md` — 14-section audit: feature state matrix (WORKING/PARTIAL/BROKEN/NOT BUILT), full API security inventory, DB table usage map, component catalogue, backscoping candidates, dead packages, priority fix list of 10 items before production.

**Bugs encountered:** None during audit itself — this was a read-only sweep.

**Resolved:** None — audit-only session. No code changed.

**New bugs filed from audit findings:**

- BUG-015 _(CRITICAL)_ — `PATCH /api/matches/[id]` has no auth. Any caller can update match scores, status, `approvedBy`. File: `src/app/api/matches/[id]/route.ts`.
- BUG-016 _(HIGH)_ — `POST /api/competitions` has no auth. Any caller can create a competition. File: `src/app/api/competitions/route.ts`.
- BUG-017 _(HIGH)_ — Three debug/test routes live with no auth: `/api/notifications/debug`, `/api/notifications/test`, `/api/email/test`. Expose push subscriptions, VAPID keys, and trigger real email sends.
- BUG-018 _(MEDIUM — NDPR)_ — `GET /api/matches/[id]` returns `approvalStatus`, `managerNotes`, `loggerId` in public response — banned internal fields.
- BUG-019 _(MEDIUM)_ — `GET /api/admin/infrastructure` and `GET /api/analytics/system` have no handler-level auth — middleware-only, callable cross-origin.
- BUG-020 _(MEDIUM — Flow C)_ — `/live` page fetches matches once on mount. No polling interval, no WS subscription. Public viewer must manually refresh to see score changes.
- BUG-021 — `POST /api/notifications/subscribe` no auth gate.
- BUG-022 — Unbounded queries on `GET /api/competitions`, `GET /api/events`, `GET /api/matches/[id]/events`.
- BUG-023 — `schema-nesa-registrations.ts` broken imports (will crash on use).
- BUG-024 — Duplicate `/match/[id]` and `/matches/[id]` routes.

**New backlog items filed:**

- BACKLOG-028 — Backscope dead/partial features from public nav (fpl, predictions, scouts, nesa-registration, auth/signin, polls)
- BACKLOG-029 — Auth audit sweep: 17 endpoints flagged "auth unknown"
- BACKLOG-030 — Clean up deprecated mock-data.ts imports in 3 components
- BACKLOG-031 — Dead/heavyweight package audit (three.js, babel/parser, downloadjs, dotted-map)

**Key audit findings:**

- Flow A (Match Creation) — WORKING ✓
- Flow B (Live Event Logging) — WORKING ✓
- Flow C (Public Livescore) — PARTIAL — `/live` page has no real-time update mechanism (BUG-020)
- Two conflicting auth systems coexist: custom JWT (active) + next-auth (vestigial, BACKLOG-009)
- 6 dead DB tables: `individualSportStats`, `competitionSportSettings`, `teamForm`, `userActivity`, `systemSettingsHistory`, `newsRelations`
- 3 dead packages: `resend`, `stripe`, `next-auth` (vestigial)
- `next-auth` Google OAuth still active via `[...nextauth]` route — two Google sign-in paths exist simultaneously

**Deferred:**

- BACKLOG-026 (AWS SES fix) — skipped per Richard's instruction, stays in backlog
- Manual staging setup (Turso DB, Vercel project, Railway WS) — still pending
- Fixing any of the newly filed bugs — audit only this session

**Next session:** Fix BUG-015 first (`PATCH /api/matches/[id]` auth) — CRITICAL, directly compromises match integrity. Then BUG-016 (competitions POST), BUG-017 (delete/gate debug routes), BUG-018 (strip internal fields from public match response). All four are small targeted fixes in known files.

---

### Session 1 - May 3, 2026

- Executed the "May 9th Event Stability" Dry-Run Audit on critical paths.
- Uncovered severe zero-auth vulnerability in `/api/events` (anyone can write events).
- Uncovered critical performance threat: `/api/matches` has an unbounded polling query fetching all matches every 30s.
- Logged all new and existing bugs into `BACKLOG.md`.
- **FIXED**: Added `.limit(50)` to `/api/matches` GET handler (BUG-005 partial).
- **FIXED**: Added `getAuthUser()` + logger assignment check to `/api/events` POST (AUDIT-001).
- Built complete `.env` from codebase scan (29 keys across 30+ files). Added `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `WS_API_KEY`, Cloudinary server keys, and AWS SES keys that were missing from `.env.example`.
- Discovered WS server on Railway is down — `bun.lock` out of sync with `package.json` causing frozen lockfile build failure.

### Session 2 — May 4, 2026

**Focus:** Infrastructure audit and high-priority bug remediation.
**Built:**

- `src/app/api/matches/route.ts`: Coerced `competitionId` to `null` if empty string to fix 500 error on match creation.
  **Bugs encountered:**
- **Match Creation 500**: Root cause was `competitionId: ""` triggering a Foreign Key violation in LibSQL (empty string != null).
- **NDPR/GDPR Leak**: `assignedLoggers` emails and internal fields exposed in public `/api/matches` response.
- **Race Condition (BUG-008)**: Match logger assignment lacks atomic uniqueness checks.
  **Resolved:**
- Fixed the 500 error in match creation by sanitizing `competitionId` before insert.
- Audited `ws-server/index.js` for environment variables; identified `PORT`, `WS_API_KEY`, `VERCEL_URL`, and `NEXT_PUBLIC_APP_URL` as critical for Railway deployment.
  **Deferred:**
- Resolving the privacy leak in `/api/matches` (requires role-based branching).
- Atomic refactor for logger assignment.
  **Next session:**
- Complete Railway deployment fix: `git add bun.lock`, `git commit -m "fix: update bun lockfile"`, `git push`.
- Verify WebSocket connectivity once Railway build passes.
- Implement response sanitization for `/api/matches` to prevent email leaks.

### Session 6 — 2026-06-08

**Focus:** Phase 1 staging scaffold — infrastructure, governance, security hardening, env management.

**Built / Changed:**

- `src/middleware.ts` — Staging-wide JWT auth gate added (`env.isStaging`). All routes require valid session on staging except `/api/auth/*` and `/login`. All redirects unified to `/login` (was split between `/login` and `/sign-in` — inconsistency fixed). `JWT_SECRET` constant now reads from `env.jwtSecret`. `process.env.NEXT_PUBLIC_ENV` reads replaced with `env.isStaging` from `src/lib/env.ts`. Matcher expanded to cover all non-static routes.
- `src/lib/env.ts` — **New file.** Centralised typed `env` object (13 vars) + `validateEnv()` startup function that throws on 4 required missing vars. Partial TD-001 implementation — full migration of 30+ `process.env` reads across codebase deferred.
- `.github/workflows/pr-guard.yml` — **New file.** GitHub Action: fails PRs where `feature/*`/`fix/*` don't target `dev`, or `hotfix/*` doesn't target `main`. Posts explanatory markdown comment with branch table on violation. Uses `GITHUB_TOKEN` (no additional secrets needed).
- `CLAUDE.md` — Git Governance section added: full branch model, merge rules, environment table, feature + hotfix workflow scripts. Session Conventions section added: env var rules, pre-commit checks, schema migration protocol, DB script logging rules.
- `.env.example` — `NEXT_PUBLIC_ENV` added with values `development | staging | production` and per-environment instructions.
- `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` — `environment` field added reading `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT`.
- `src/app/api/players/bulk-register/route.ts` — `getAuthUser` + admin role check added at top of POST handler (BUG-013).
- `src/app/admin/matches/page.tsx` — `Match` interface extended with `homeTeam?`/`awayTeam?`. `getTeamName(id)` replaced with `getTeamDisplay(match, side)` that reads embedded `shortName` first, falls back to local teams list, then raw ID (BUG-014).
- `dev/fix-busalympics-remaining-fixtures.ts` — Inserted 3 BUSALYMPICS fixtures as UPCOMING: MD2 G1, MD3 G1, MD3 G2. All 7 BUSALYMPICS fixtures now in DB.
- `.agents/dev/BACKLOG.md` — TD-001 marked IN PROGRESS. BACKLOG-020 (Blocks 1–6) filed. BACKLOG-021 through BACKLOG-027 filed.
- `.agents/dev/RUNLOG.md` — Created. Full audit trail of all DB scripts run across sessions 1–6.
- `.agents/dev/STAGING_PLAN.md` — Created. Full staging environment plan (Vercel, Turso, Railway, parity checklist, implementation order).
- `.agents/dev/CONTEXT_TRANSFER_SESSION_4.md` — Full session handoff doc written.
- Multiple public-facing docs (`CONTRIBUTING.md`, `README.md`, `VERCEL_DEPLOYMENT.md`, `DEVELOPER_ONBOARDING.md`, `src/app/docs/page.tsx`) — old placeholder repo URLs replaced with `github.com/Brixsport/BrixSports`.

**Bugs encountered:**

- **PR guard COMMENT indentation** — bash heredoc with indented body lines caused leading whitespace in all comment lines, breaking markdown table rendering. Root cause: heredoc content was indented to match script indent level. Fix: `cat <<EOF` with content at column 0.
- **Middleware redirect inconsistency** — staging gate redirected to `/sign-in`; admin gate redirected to `/login`. These are two different URLs — one would produce a 404. Root cause: written independently without cross-checking. Fix: unified to `/login` (confirmed canonical URL).
- **Dead pathname check** — `pathname.startsWith('/sign-in?')` in middleware exemption. Root cause: misunderstanding that Next.js middleware `pathname` never contains query string. Fix: removed dead check.

**Resolved:** All three issues above before commit.

**Deferred:**

- TD-001 full migration: 30+ files still read `process.env` directly. `env.ts` file created, `middleware.ts` migrated, remaining files deferred.
- BACKLOG-021 (GitHub Rulesets): PR guard must be tested on a real PR first.
- BACKLOG-026 (broken `AWS_SES_FROM_EMAIL` in prod): confirmed broken, fix deferred — needs Google Console + AWS SES access.
- Manual staging infrastructure: Turso staging DB, Vercel staging project, Railway staging WS — all deferred to manual setup steps.

**Next session:** BACKLOG-026 first (live prod bug — email broken). Then manual staging setup following `STAGING_PLAN.md` section 5 checklist. Then BACKLOG-020 Block 6 (full system audit) once staging is live.

---

### Session 5 — 2026-06-07

**Focus:** Phase 4 — Bells Intercollege data setup: org links, competition enrolment, player affiliations, match fixtures.

**Built / Changed:**

- `dev/fix-backlog007.ts` — UPDATE 4 college teams to set `ownerOrganizationId`. COLNAS/COLENG/COLMANS/COLENVS now linked to their respective org records. Gitignored.
- `dev/fix-backlog008.ts` — INSERT 4 rows into `competition_team_entries` for BUSALYMPICS. Gitignored.
- `dev/fix-college-affiliations.ts` — INSERT 68 `playerTeamAffiliations` rows (college type, isPrimary: false). Dedup-checked per row. Players sourced from `playerOrganizationAffiliations` — no new player profiles created. Gitignored.
- `dev/fix-match-fixtures.ts` — INSERT 4 BUSALYMPICS match fixtures (FINISHED): MD1 G1, MD1 G2, MD2 G2, Final. All confirmed via SELECT after insert. Gitignored.
- `.agents/dev/BACKLOG.md` — BUG-013, BACKLOG-015 through BACKLOG-019 added.
- `.agents/dev/PROJECT_HISTORY.md` — Session 4 entry appended.
- `.agents/dev/CONTEXT_TRANSFER_SESSION_3.md` — Full context transfer doc written.
- `UNIFIED_EVENT_PANEL.tsx`, `UNIFIED_EVENT_PANEL_COMPLETE.tsx` — Deleted from project root (orphaned fragments causing 150+ tsc errors). Confirmed `tsc --noEmit` exits 0 after deletion.

**Bugs encountered:**

- Turso `ConnectTimeoutError` mid-COLENG on college affiliations insert (68 sequential round trips). Script died at `busa-joga-player-8`. Resolved by re-run — dedup check correctly identified all already-inserted rows, inserted the 1 missing row, completed cleanly.

**Resolved:** Turso timeout handled by dedup-safe re-run pattern. No data loss.

**Deferred:**

- BACKLOG-017: 3 missing BUSALYMPICS scores (MD2 COLNAS/COLENG, MD3 COLNAS/COLENVS, MD3 COLMANS/COLENG). Blocking standings.
- BUG-013: `POST /api/players/bulk-register` still has no auth gate.
- BUG-011: playerStats 718 goals anomaly — investigation only, no writes.
- BACKLOG-018: game event logsheets — blocked by BACKLOG-016.
- BACKLOG-019: post-match lifecycle automation — blocked by staging environment.

**Next session:** Confirm 3 missing BUSALYMPICS scores → insert remaining fixtures using `dev/fix-match-fixtures.ts` as template → run standings calculation for BUSALYMPICS.

---

### Session 4 — 2026-06-05

**Focus:** Phase 2 Bug Sprint — full security and stability sweep across all open BUG-001 through BUG-012 items.

**Built / Changed:**

- `src/middleware.ts` — Fixed `pathname.startsWith('/admin')` to also cover `/api/admin`. API routes now return 401/403 JSON instead of a browser redirect. All debug `console.log` statements removed.
- `src/app/api/auth/test/route.ts` — **Deleted.** Debug endpoint was live in production with no auth gate.
- `src/app/api/admin/users/route.ts` — `getAuthUser` + `role === 'admin'` added to GET and PATCH.
- `src/app/api/admin/ads/route.ts` — `getAuthUser` + `role === 'admin'` added to GET (signature fixed to `NextRequest`) and POST. `createdBy` now sources from `authUser.id`.
- `src/app/api/admin/settings/route.ts` — `getAuthUser` + `role === 'admin'` added to GET, PATCH, POST. `updatedBy` now sources from `authUser.id`; client-supplied `userId` body field removed.
- `src/app/api/matches/route.ts` — Stripped `email` from `assignedLoggers` in public GET response. Added `getAuthUser` + admin check to POST. Upgraded both handler signatures from `Request` to `NextRequest`. Import updated to `NextRequest`.
- `src/app/api/events/route.ts` — Added `getAuthUser` to POST (admins pass; loggers verified against `matchLoggerAssignments` for the specific `matchId`). Added role gate to DELETE (admin or logger). GET remains public. Import added.
- `src/lib/services/rating-calculator.ts` — Added `normalizeType()` helper (`s.toLowerCase().replace(/[\s_-]+/g, '')`). All 14 event-type comparisons in `calculateStatsFromEvents` updated to use it, fixing the `Goal`/`GOAL`/`Yellow Card`/`YELLOW_CARD` casing mismatch for live-logged matches.
- `src/app/api/events/route.ts` (score block) — Score trigger and score tally loop updated with same `normalizeType` normalization. Fixes live goals not incrementing the score.
- `src/app/admin/transfers/page.tsx` — `createdBy: 'admin-1'` replaced with `user?.id ?? null` from `useAuth()`. Import added.
- `src/app/api/teams/route.ts` — `.limit(200)` added to GET.
- `src/app/api/loggers/route.ts` — `.limit(200)` added to GET.
- `src/app/api/players/route.ts` — `.limit(500)` added to full-table fetch branch (higher cap — feeds in-memory search).
- `src/lib/utils/format-content.ts` — Added `escapeHtml()` helper. Applied to all user-supplied text before template string injection (headings, list items, blockquotes, paragraph lines). Link handler now validates URLs — only `http://` and `https://` pass; all other schemes become `#`. Closes stored XSS via `dangerouslySetInnerHTML` in news pages.
- `src/app/api/matches/[id]/assign-logger/route.ts` — Race condition fixed: check-then-insert moved into a Drizzle transaction. `assignedBy` now from `authUser.id` (not client body). Missing auth gate added (admin only). Duplicate response changed from 400 to 409.
- `.agents/dev/BACKLOG.md` — BUG-001 through BUG-012 entries added. BUG-001/002/003/004/005/006/007/008/009/010/012 moved to Resolved. BACKLOG-007 through BACKLOG-013 appended.
- `.agents/dev/SYSTEM_ARCHITECTURE.md` — Full system audit written by agent subagent.
- `.agents/dev/PHASE_ROADMAP_ASSESSMENT.md` — Full phase roadmap assessment written by agent subagent.
- `.agents/dev/PROJECT_HISTORY.md` — Created. Session 3 entry written.
- `~/.claude/agent-skills/` — Context docs stored for next.js, drizzle-orm, zod, socket.io, cloudinary, turso.
- `scripts/db-audit-query.ts` — Created by audit agent to run live DB queries.

**Bugs encountered:**

- `POST /api/events` score update was silently broken for live matches: the `normalizeEventType` fix revealed the score trigger (`['GOAL', ...].includes(type)`) was checking UPPERCASE against PascalCase logger output — scores never updated for live goals. Fixed in same pass.
- `format-content.ts` had two distinct XSS vectors: raw HTML injection through unescaped template strings, and `javascript:` URL injection via the link regex replacement.
- `assign-logger` route had no auth check at all — any unauthenticated caller could assign loggers to matches.

**Resolved:** All 11 bugs above. See BACKLOG.md Resolved section for per-bug detail.

**Deferred:**

- BUG-011: playerStats 718 goals / 133 appearances anomaly. Root cause identified (duplicate backfill runs with differing `startTime` formats bypass the duplicate match check). Investigation only — no writes. Requires audit of all matchEvents before any data correction.
- BACKLOG-007 → BACKLOG-008: Intercollege team org links and competition enrollment.

**Next session:** Phase 4 — Bells Intercollege live data. Start with BACKLOG-007: UPDATE intercollege teams (CNAS, CENG, CMANS, CENVS) to set correct `ownerOrganizationId` from the `organizations` table. Then BACKLOG-008: insert `competition_team_entries` rows.

---

### Session 20 — 2026-06-16

**Focus:** BACKLOG-061 tab audit → BUG-030/031 fixes → BACKLOG-059 SW scope fixes → Player DB normalisation (staging) → Player modal field trace.

**Built:**

**Phase 1 — Competition detail audit (read-only):**
- Traced all 8 competition detail tabs. Confirmed: Standings renders real data (logo broken), TopScorers/Assists/Discipline are empty shells, Rules is hardcoded, Matches/Brackets only in split-pane. All 8 APIs already built.
- Filed BUG-030, BUG-031, BACKLOG-061.

**Phase 2 — BUG-030 fix (commit `3be1731`):**
- `src/app/competitions/[id]/page.tsx` — CREATED. 6-line server component with `redirect('/competitions/${params.id}/standings')`. Fixes 404 on base competition URL.

**Phase 3 — BUG-031 + TD-008 (commit `bb0a1ed`):**
- `src/app/competitions/[id]/standings/page.tsx` — 5 sites where `{team/player.teamLogo}` rendered as a raw string span replaced with `<TeamLogo logo={X} name={Y} size="md" />`. Sites: lines 395 (StandingsRow), 444 (StandingsMobileCard), 561 (TopScorers), 603 (TopAssists), 642 (Disciplinary). `import { TeamLogo }` added.
- `src/hooks/useLiveStandings.ts` — `teamLogo: string` → `string | null` (line 15). Fallback `|| '❓'` → `|| null` (line 75). Emoji fallback was masking null — `TeamLogo` handles null correctly with initials.

**Phase 4 — BACKLOG-059 SW scope fixes (commit `4977e42`):**
- `src/hooks/usePWA.ts` — Path guard added before `registerServiceWorker()` call. If `swPath.includes('sw-user')` AND current path starts with `/admin` or `/logger`, returns early without registering. Guard lives in the hook, not in `PWAProvider`, so it fires before registration happens (PWAProvider's useEffect ran too late — after usePWA had already registered).
- `src/lib/notifications/push-service.ts` — Removed `navigator.serviceWorker.register('/sw-user.js')` call (line ~40). Replaced with `getRegistration('/')` — uses the existing registration from `PWAProvider` instead of creating a competing one. Console warn if no registration found.
- `src/components/pwa/PWAProvider.tsx` — Removed unused `useEffect` import. Dropped `{ registration, isRegistered, error }` destructure (hook result unused after cleanup). Deleted dead suppression useEffect block (30-52) that tried to suppress registration after-the-fact.
- `public/sw.js` — Confirmed dead (no registrar in `src/`). **Pending manual deletion**: `del public\sw.js` + `git commit`.

**Phase 5 — Player DB normalisation (staging):**
- `dev/fix-player-college-university.mjs` — Written and run against staging. Results:
  - College: `ColEng → COLENG` (2 rows), `Colmans → COLMANS` (1 row), `'' → NULL` (3 rows)
  - University: 178 rows updated (`'Bells University'` + `'Bells University of Technolgy'` → `'Bells University of Technology'`)
  - Post-verify: 5 canonical college values (NULL×111, COLENG×34, COLENVS×6, COLMANS×7, COLNAS×21). Single distinct university value.
- RUNLOG.md updated — Session 20 DB run logged.
- **Prod run: PENDING.** Must verify on staging first (done), then apply same script against `.env.production`.

**Phase 6 — Player modal + API trace (read-only):**
- `src/app/admin/players/page.tsx` modal fields mapped: Team = `<select>` (line 607, ✅ correct), Position = `<input type="text">` (line 621, should be select), University = `<input type="text">` (line 661, should be locked/read-only), College = `<input type="text">` (line 671, **should be `<select>` with COLENG/COLENVS/COLMANS/COLNAS**), Department = `<input type="text">` (line 681).
- `src/app/api/players/[id]/route.ts` PATCH handler traced (line 300-415): team change is fully handled — updates both `players.teamId` and `playerTeamAffiliations`. Old affiliations demoted to `isPrimary: false` (never deleted, by design). `syncPlayerOrganizationAffiliations` called after team change. No gap.

**Bugs encountered:**

- BUG-031 Edit 3 — import `old_str` initially used incomplete fragment. Fixed by reading exact line first.
- BUG-031 Edit 8 (Disciplinary) — indent was 12-space not 8-space in actual file. Fixed by reading lines 638-648 before edit.
- BACKLOG-059 — `PWAProvider` dead useEffect suppression ran after `usePWA` had already registered the SW. Race window: useEffect fires asynchronously, so the "don't register" guard always lost. Root cause: guard in the wrong layer.

**Resolved:** BUG-030, BUG-031, TD-008, BACKLOG-059 (code complete, `sw.js` deletion pending).

**Deferred:**

- `public/sw.js` manual deletion — run `del public\sw.js && git add public/sw.js && git commit -m "chore(pwa): delete retired sw.js (BACKLOG-059)"`
- Player college/university DB fix on **prod** — same script, swap env to `.env.production`
- Player modal UX fixes (BACKLOG-062) — college → `<select>`, university → locked — pending next directive
- BACKLOG-061 steps 3-8 (wire TopScorers/Assists/Discipline/Rules/Teams/Matches/Brackets fetches)
- BACKLOG-044 Phase B (logger integration — now unblocked by BACKLOG-059)
- BACKLOG-058 (logger offline queue — CRITICAL for live match resilience)
- 6 confirmed duplicate player pairs from DB audit — need BACKLOG-042 (merge tool) or manual resolution

**Next session:** Run player DB fix on prod (5 min). Then BACKLOG-062 (college `<select>`, university locked in player modal). Then BACKLOG-061 step 3 (wire TopScorers/Assists/Discipline fetches in standings/page.tsx).

---

### Session 21 — 2026-06-16

**Focus:** BACKLOG-062 (player modal dropdowns) → Prod DB normalisation → Animashun duplicate cleanup → Bells stub team cleanup → Full DB integrity audit.

**Built:**

- **BACKLOG-062 — Player modal select dropdowns (`src/app/admin/players/page.tsx`, commit `f0070e0`):**
  - Position (line ~621): free-text `<input>` → grouped `<select>` with Football (GK/CB/LB/RB/LWB/RWB/CDM/CM/CAM/LM/RM/LW/RW/CF/ST/SS) and Basketball (PG/SG/SF/PF/C/G/F) `<optgroup>` sections.
  - University (line ~661): free-text `<input>` → `<select>` locked to `Bells University of Technology` + `Other` + empty.
  - College (line ~671): free-text `<input>` → `<select>` locked to COLNAS / COLENG / COLMANS / COLENVS + empty. Department field (line 717) confirmed untouched.

- **Prod college/university normalisation (RUNLOG logged):**
  - `dev/fix-player-college-university-prod.mjs` run against prod. Results matched staging exactly: `ColEng → COLENG` (2), `Colmans → COLMANS` (1), `'' → NULL` (3), university normalised (178). Post-verify: 5 college values canonical, single university value. Script deleted.

- **Animashun duplicate delete (RUNLOG logged):**
  - `dev/delete-animashun-stub.mjs` run against staging then prod. Deleted 1 `player_team_affiliations` row + 1 `players` row for `sQVPtcWxrN3VBeGvL88_O` ("Animashun") on both DBs. Pre-flight confirmed 0 events, 0 stats. Post-verify: exactly 1 Animashun row remains (`Animashun Oluwanifemi`, `player-1767972615670-yet6lrue1`). Scripts deleted.

- **Bells stub team cleanup (RUNLOG logged):**
  - `dev/delete-bells-stub-teams.mjs` run against staging then prod. Deleted 10 team rows: `bells-uni-id` ("Bells University") + 9 "Bells University of Technology [Sport] (M/F)" variants. Pre-flight: 0 affiliations, 0 matches. FK blocker found and resolved: `users.favorite_team_id` — 2 accounts had stub teams as favourite (`temitopeyr@gmail.com`, `ramotaadenike67@gmail.com`), nulled before delete. Post-verify: exactly 4 Bells-related teams remain (4 college teams, correct player counts). Scripts deleted.

- **Full DB integrity audit (`dev/audit-player-team-integrity.mjs`, read-only):**
  - Ran against staging and prod — both identical.
  - Results: college ✅, university ✅, affiliations orphans ✅, match event orphans 🔴 (39 null player_id — BUG-032), BUSA FC stubs flagged (BACKLOG-063).

**Bugs encountered:**

- `users.favorite_team_id` FK constraint blocked team deletes — not caught by affiliation/matches pre-flight because table is `users`, not `user_profiles` (checked schema.ts for the right column name). Fixed by running PRAGMA foreign_key_list on all tables to find all FK children, adding `users.favorite_team_id` null step to the delete script. **Saved to known-issues.**

**Filed:**

- **BUG-032** — 39 `match_events` rows with `player_id = NULL` on both staging and prod. No writes — investigation only. Event IDs preserved in backlog.
- **BACKLOG-063** — 12 BUSA FC stub teams with zero affiliations. Awaiting decision on which are active vs dead.
- **BACKLOG-064** — `joseph` × 2 and `leo` × 2 exact-name collisions (distinct players on different basketball clubs). Need disambiguation via name rename.

**Resolved:** BACKLOG-062 (player modal dropdowns).

**Deferred:**

- BACKLOG-063 decision (which BUSA FC stubs to delete) — awaiting Richard's confirmation on active clubs
- BACKLOG-064 name disambiguation (`joseph (RR)` / `joseph (SIB)` etc.)
- BUG-032 root cause investigation (null player_id events) — 39 rows, no writes until source understood
- BACKLOG-061 step 3 (wire TopScorers/Assists/Discipline/Rules fetches in standings/page.tsx)
- BACKLOG-044 Phase B (logger integration)
- BACKLOG-058 (logger offline queue — CRITICAL)

**Next session:** BACKLOG-061 step 3 — wire TopScorers (`GET /api/competitions/[id]/stats?type=scorers`), Assists (`type=assists`), and Discipline (`type=discipline`) fetches in `src/app/competitions/[id]/standings/page.tsx`. All 3 APIs are built and returning data. UI shells exist — just need `useEffect` fetches wired in.

---

### Session 3 — 2026-06-04

**Focus:** Refactor Competition admin forms and setup backlog architecture.
**Built:** Consolidated create/edit forms into reusable CompetitionModal. Fixed UI disabling logic. Populated backlog with multi-sport architectural roadmap.
**Bugs encountered:** TypeScript 'Cannot find name initialData' error caused by self-referencing inside an interface.
**Resolved:** Hoisted defaultFormData and mapped types using typeof to resolve circular reference.
**Deferred:** All newly added backlog items (001, 002, 003, 004).
**Next session:** Execute BACKLOG-001 — Goal Type Breakdown schema migration

---

### Session 24 — 2026-06-17

**Focus:** Security gate fixes (BUG-034/035), full system read, basketball college data cleanup, backlog filing batch.

**Built / Changed:**
- `src/app/api/matches/[id]/events/route.ts` — POST and DELETE handlers: added `getAuthUser()` before `request.json()`, admin pass-through, logger verified against `matchLoggerAssignments` (active status), `loggerId` now sourced from `authUser.id` not client body. Imports: added `matchLoggerAssignments`, `and`, `getAuthUser`. (BUG-034, commit `0e55cd4`)
- `src/app/api/squads/route.ts` — POST, DELETE, PATCH handlers: added `getAuthUser()` + `role === 'admin'` gate on all three. GET left public. (BUG-035, commit `0e55cd4`)
- `src/app/admin/bulk-register/page.tsx` — `maxLength` on shortName input raised from 5 to 12, placeholder updated to `COLENG-B`. (commit `2c1cf5d`)
- `dev/scripts/backfill-college-affiliations-staging.mjs` — sport guard added: INSERT now excludes players whose primary team sport != Football. Prevents basketball/other-sport players being affiliated to football college team IDs in future runs.
- `dev/` scripts created (gitignored): `audit-basketball-college-affiliations.mjs`, `cleanup-basketball-college-affiliations.mjs`, `cleanup-basketball-college-affiliations-prod.mjs`, `create-basketball-college-teams-staging.mjs`, `wire-basketball-college-affiliations.mjs`, `audit-basketball-state.mjs`, `verify-basketball-final.mjs`
- 4 basketball college teams created on staging + prod: `coleng-basketball` (COLENG-B), `colnas-basketball` (COLNAS-B), `colmans-basketball` (COLMANS-B), `colenvs-basketball` (COLENVS-B)
- 5 basketball players wired to correct college teams on staging + prod: KAMKID/RICHARD/ZUBBY → COLENG Basketball; LIGHT/OJAY → COLNAS Basketball
- BACKLOG.md: filed BUG-033 Part 1 resolved, BUG-034–041, BACKLOG-075–092

**Bugs encountered:**
- Turso connection drops mid-sequential-INSERT (Windows Node.js assertion error `UV_HANDLE_CLOSING`). Root cause: Windows libuv async handle closed before process.exit() — script data is already committed, it is a process cleanup race. Workaround: run scripts separately, use INSERT OR IGNORE for idempotency.
- Bash heredoc with apostrophes in content fails shell parsing. Root cause: single-quoted heredoc EOF terminates on any `'` inside the body. Workaround: use Edit tool append pattern instead of heredoc for long text.

**Resolved:**
- BUG-033 Part 1 (data): 5 basketball players wrongly affiliated to football college teams (backfill script had no sport guard). Deleted wrong affiliations on staging + prod. Sport guard added to backfill script.
- BUG-034 (CRITICAL): `POST /api/matches/[id]/events` had zero auth. Any caller could inject live match events. Fix: `getAuthUser()` + logger assignment check, `loggerId` sourced from session.
- BUG-035 (MEDIUM): `POST/PATCH/DELETE /api/squads` had zero auth. Fix: admin gate on all three mutations.
- shortName 5-char UI cap blocking `COLENG-BKT` format inputs.
- BACKLOG-076 resolved: 4 basketball college teams created and 5 players wired.

**Deferred:**
- BUG-033 Part 2 (UI): Squad tab pool sport filter — blocked on BACKLOG-068 (multi-sport player audit)
- BUG-036–039 (polls, user XI, reminders auth gaps) — low attack surface, deprioritised
- BUG-041 (React error #418 on homepage, TBT 9–16s) — Lighthouse 22/100 performance
- BACKLOG-090 (CSR/RSC architecture decision) — requires BUG-041 resolved first
- 78 basketball players still have `college = NULL` — blocked on Richard setting colleges via admin UI
- COLMANS/COLENVS basketball players not yet wired (no players with those colleges + Basketball primary team yet)

**Next session:** BUG-041 — React hydration error #418 on homepage. Audit homepage components for Framer Motion `initial` prop usage and SSR/CSR mismatches. Then Lighthouse re-run to measure delta.

---

### Session 25 — 2026-06-19

**Focus:** PWA backlog audit and reconciliation, BACKLOG-093 (logger SW gap), BACKLOG-058 (offline event queue), BACKLOG-094 filed.

**Built / Changed:**

- **`src/app/logger/layout.tsx`** (new file, commit `71d57f7`) — `PWAProvider` with `swPath="/sw-admin.js"`, `scope="/logger"`. Closes the critical gap where `/logger` had zero SW coverage: `usePWA.ts:13-16` blocks `sw-user.js` on logger paths, so without this layout the logger ran with no service worker at all. No server-side JWT check — logger page owns its own login form.
- **`public/sw-admin.js`** — `syncMatchEvents()` auth fix (commit `ca35f2d`): added token presence guard (`if (!event.token) { continue; }`) before every POST. Without this, tokenless events would 401 indefinitely and trigger infinite retry storms. Also added schema comment documenting the `token` field and BACKLOG-058 contract.
- **`src/components/FootballLogger.tsx`** — BACKLOG-058 offline queue wiring (commit `33d9b4d`):
  - Three helpers added at module level: `openAdminDB()` (opens `BrixsportAdminDB` v1, creates `pendingMatchEvents` store), `queueOfflineEvent()` (adds row with `{ matchId, data, token, timestamp }`), `jwtSecondsRemaining()` (base64 decode of exp claim, no library)
  - `payload` hoisted above try block (was inside try — invisible to catch, caused TS2304)
  - Catch block (network failure) — three-path logic: (1) no token → alert + return; (2) token < 30 min remaining → alert + return; (3) token healthy → write to `BrixsportAdminDB.pendingMatchEvents` → `sync.register('sync-match-events')`
  - `!res.ok` else branch added — logs server error, does NOT touch IndexedDB (server error ≠ network failure)
  - `queuedOfflineCount` state + orange "N Queued" badge in status bar
  - `SYNC_COMPLETE` postMessage listener → resets badge count
- **`.agents/dev/BACKLOG.md`** (commit `fc32231`): BACKLOG-058 closed (RESOLVED), BACKLOG-093 closed (RESOLVED), BACKLOG-094 filed (logger JWT TTL too long).
- **`CLAUDE.md`** (commit `fc32231`): Added "Backlog Close — Mandatory Before Moving On" to Definition of Done. Added BACKLOG.md update step to Before Every Commit.
- **`.agents/dev/SESSION_25_RECON.md`** (new file, commit `fc32231`): read-only reconciliation verdicts for BACKLOG-059, SW state, BACKLOG-058, BACKLOG-044 Phase B, git status, and PWA guide discrepancy register.

**Bugs encountered:**

- **TS2304 `Cannot find name 'payload'`** — `payload` declared inside `try` block was invisible to the `catch` block. Root cause: const scoping. Fix: hoist `const payload = { ... }` above the try statement.
- **Tokenless events sent to 401 endpoint** — original sync code logged a warning but still POSTed without a token → 401 → endless retry. Fix: `continue` to skip entirely in `syncMatchEvents()` when no token.

**Architecture decisions:**

- **Two disconnected IndexedDB implementations exist**: `offline-queue.ts` (`brixsport-offline.events` store) has no reader anywhere — it is effectively dead code. `sw-admin.js` drains `BrixsportAdminDB.pendingMatchEvents`. FootballLogger now writes directly to `BrixsportAdminDB` to match the drain side. `offline-queue.ts` left untouched.
- **JWT stored in IndexedDB (unencrypted)** — conscious accepted risk. Mitigated by refusing to queue if token < 30 min from expiry. Logger accounts have no admin access — compromise enables false event injection only. BACKLOG-094 filed for future TTL shortening + refresh flow. Do not shorten TTL until a silent refresh flow is in place (hard expiry mid-match is worse than a long TTL).
- **Background sync auth pattern** — token stored at write time by FootballLogger and read back in `syncMatchEvents()`. SW background sync fires outside any browser session, so no cookie or live auth context is available. Token must be embedded in the queued row.

**Resolved:**

- BACKLOG-093: Logger has no service worker coverage. Fixed via `src/app/logger/layout.tsx`.
- BACKLOG-058: Offline event queue unwired. Fixed: FootballLogger catch now writes to `BrixsportAdminDB.pendingMatchEvents` with JWT, drain side (`syncMatchEvents`) now attaches Bearer header.

**Filed:**

- BACKLOG-094: Logger JWT TTL 7 days — shorten to 8–12h + add silent refresh flow (Low priority, not a live blocker).

**Deferred:**

- BACKLOG-044 Phase B: match config fetch on logger mount, timer ceiling from config, sub counter wired to `maxSubstitutions`. Next item in dependency chain after BACKLOG-093 + BACKLOG-058.
- BACKLOG-094: JWT TTL shortening — do not implement until silent refresh flow is ready.

**Next session:** BACKLOG-044 Phase B — fetch match config from `/api/matches/[id]/config` on FootballLogger mount; wire `halfDuration` to timer ceiling; wire `maxSubstitutions` to sub counter; enforce event validation from `eventValidation.ts`.

**Next session:** BUG-041 — React hydration error #418 on homepage. Audit homepage components for Framer Motion `initial` prop usage and SSR/CSR mismatches. Then Lighthouse re-run to measure delta.
