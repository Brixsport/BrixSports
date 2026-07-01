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

### Session 30 — 2026-06-24

**Focus:** Close BACKLOG-058 (offline drain), fix BUG-061 (away roster), implement TD-010 (period persistence).

**Built / Fixed:**

- **BACKLOG-058 RESOLVED** — SW drain fix (`public/sw-admin.js`) — commit `49ce483`
  - Root cause: `db.getAll(storeName)` and `db.delete(storeName, key)` are Dexie.js API patterns. `openDB()` returns a raw `IDBDatabase` — neither method exists on it. Crash: `db.getAll is not a function` at line 166.
  - Fix: added `idbGetAll(db, storeName)` and `idbDelete(db, storeName, key)` promise helpers using raw IDB `transaction → objectStore` API. Replaced all 4 Dexie-style calls in both `syncMatchEvents()` and `syncAdminChanges()`.
  - Live Test 3 passed on staging: 15 queued events drained, IDB cleared to 0, events visible on public page. Full chain confirmed end-to-end.

- **BUG-061 RESOLVED** — Away team roster fix (`src/components/FootballLogger.tsx`) — commit `e847902`
  - Root cause: `getPlayerTeam(player)` calls `getPrimaryTeam()` which resolves to the player's `isPrimary` membership. Multi-affiliated players (college + BUSA team) had their college team as primary — `getPlayerTeam(p)?.id === match.awayTeamId` failed → player dropped from away roster.
  - Fix: `(player as any).memberships?.some((m: any) => m.team?.id === match.awayTeamId) || getPlayerTeam(player)?.id === match.awayTeamId` — checks all memberships first, falls back to primary team.

- **TD-010 SHIPPED** — Period state persistence (`src/db/schema.ts`, `src/app/api/matches/[id]/route.ts`, `src/components/FootballLogger.tsx`, `src/types/index.ts`) — commit `b66eb95`
  - `currentPeriod: text('current_period').default('NOT_STARTED')` added to matches schema
  - PATCH handler: accepts `body.currentPeriod`, writes to DB — no new role gate (same logger+admin access)
  - FootballLogger mount: seeds `MatchStateManager` with `clock: { period: seedPeriod }` from `match.currentPeriod` — DB value wins over `localStorage` via `initial?.clock` spread at match-state-manager.ts:1266
  - Period transition PATCHes: fire-and-forget after `FIRST_HALF` (Start Match inline handler) and after `completePeriodTransition` (handlePeriodEndConfirm) — non-blocking `.catch()` only
  - Staging migration run: `ALTER TABLE matches ADD COLUMN current_period TEXT DEFAULT 'NOT_STARTED'` — column confirmed, sample rows defaulted correctly
  - DB write confirmed: match `AIr6gMTlUscTNHzYTL8fI` shows `current_period: FIRST_HALF` after Start Match PATCH

- **TD-010 period trace (READ ONLY)** — confirmed period is 100% ephemeral pre-fix: `MatchStateManager` reads `localStorage` only, zero DB writes on any transition, no `current_period` column in schema. `initial?.clock` at line 1266 confirmed as the correct injection point (spreads after `...saved?.clock`, so DB value always wins over stale localStorage).

- **BUG-061–065 filed** from BACKLOG-058 Test 3 live run:
  - BUG-061 RESOLVED (away roster)
  - BUG-062 OPEN: Lineup wipes on browser refresh — viewState not persisted
  - BUG-063 OPEN: HALF_TIME not shown on public page — closes when TD-010 migration + loggers API fix land
  - BUG-064 OPEN: Match tabs horizontal scroll on mobile
  - BUG-065 OPEN: Event counter display broken in logger header

**TD-010 — fully correct, pending clean verification:**
- Staging migration applied ✓, DB PATCH writes confirmed ✓ (`current_period: FIRST_HALF` in DB after Start Match)
- `getLoggerMatches` (match-logger-helpers.ts) uses `match: matches` — full row select — `current_period` flows through automatically ✓ No code gaps.
- **Why period still showed NOT_STARTED on the test match:** match `AIr6gMTlUscTNHzYTL8fI` was started and transitioned to 2ND HALF *before* `b66eb95` deployed and *before* the migration ran. Those transitions never wrote `current_period`. Migration defaulted all existing rows to `NOT_STARTED`. Hard refresh read the default → seed fell through → correct given the history, not a bug in the implementation.
- **Real verification:** spin a fresh test match after `b66eb95` is deployed, start it, transition to FIRST_HALF, hard refresh → must show FIRST_HALF. Existing match is a write-off for TD-010 testing purposes.

**Bugs filed this session:**
- BUG-061 (RESOLVED), BUG-062, BUG-063, BUG-064, BUG-065

**Deferred:**
- `GET /api/loggers/[id]` fix — add `current_period` to assignedMatches select
- Prod migration for TD-010 (pending staging period-survival verification)
- BACKLOG-044 Phase B (blocked on TD-010 full verification)
- BUG-060 (stat decrement on event DELETE)
- BUG-062 (lineup wipes on refresh)

**Next session:**
1. Read `src/app/api/loggers/[id]/route.ts` — confirm `current_period` is in assignedMatches response. If missing, add it. This is the final piece of TD-010.
2. Verify period survives refresh on staging after fix
3. Run prod migration
4. Then BACKLOG-044 Phase B

---

### Session 32 — 2026-06-25

**Focus:** Live match pipeline audit, stat fixes, TD-010 completion, BUG-063 homepage card, test match cleanup.

**Built / Fixed:**

- **`src/app/page.tsx`** (BUG-063 homepage) — Two fixes (`024e086`): (1) Football match transform (line 132–149) was an explicit object construction that omitted `currentPeriod` — added `currentPeriod: match.currentPeriod ?? null`. (2) Homepage `LiveMatchStatus` call (line 735) had no `fallbackPeriod` — added `fallbackPeriod={(match as any).currentPeriod ?? undefined}`. Root cause: homepage renders matches inline with its own JSX, does not use `src/components/ui/MatchCard.tsx` at all — the MatchCard fix (056388d) was invisible to the homepage.
- **`src/components/FootballLogger.tsx`** (sub picker bug) — `getActiveRoster` had no awareness of in-match substitutions. Players who were subbed off stayed in the event player picker permanently. Fix (`024e086`): derive `subbedOffIds` from `matchState.events` where `type === 'Substitution'` for the team (the event's `playerId` is always the player who went OFF), then exclude them at every `getActiveRoster` return path.

- **`src/components/LiveStats.tsx`** — Fixed shape mismatch: API returns `shots: [homeVal, awayVal]` arrays, component was reading flat `stats.homeShots` / `stats.awayShots` keys → all stats showed zero. Added dual-format reader (array-first, flat fallback). Fixed possession `5050%` / `NaN%` — array was passed as a number, `100 - [50,50]` = NaN. (`7faaab9`)
- **`src/app/api/matches/[id]/route.ts`** — Added `statsEmpty` guard (`Object.keys(stats).length === 0`) so persisted empty stats object `{}` no longer blocks the event-computed stats path. (`7faaab9`)
- **`src/app/api/matches/[id]/events/route.ts`** — Three changes: (1) friendly guard — `updatePlayerStats` skips when `match.matchType === 'friendly'`; (2) added `OWN GOAL → ownGoals++`, `PENALTY → penaltiesScored++`, `FOUL → foulsCommitted++` cases to the Football switch; (3) these three event types were previously silently ignored — correct stat columns now targeted. (`7faaab9`)
- **`src/db/schema.ts`** — Added `ownGoals: integer('own_goals').default(0)` and `penaltiesScored: integer('penalties_scored').default(0)` to `footballPlayerStats`. (`7faaab9`)
- **Migration** — `dev/migrate-football-stats-columns.mjs` applied to staging: `ALTER TABLE football_player_stats ADD COLUMN own_goals INTEGER DEFAULT 0` and `penalties_scored INTEGER DEFAULT 0`.
- **KIN vs COLNAS friendly cleanup** — `dev/cleanup-kin-colnas-match.mjs --apply`: rolled back friendly-polluted stats for 5 players (Samuel Ademoyegun goals 3→2, Nasirudeen Alabi yellow 3→1 red 1→0, Temidayo Olusesi goals 1→0, Ola-praise Abadoni assists 1→0, Reward Akpoterabor assists 1→0). Match deleted, cascade cleaned events + assignments.
- **`src/components/FootballLogger.tsx`** (TD-010) — Three inline `onClick` handlers for period transitions were calling `transitionStatus()` only, with no DB PATCH: Start 2nd Half (line 1435), Start Extra Time (line 1443), Start Penalties (line 1447). All three now fire `fetch PATCH /api/matches/${match.id}` with `{ currentPeriod: 'SECOND_HALF' | 'EXTRA_TIME_1' | 'PENALTY_SHOOTOUT' }` fire-and-forget after the state transition. Match Start (`FIRST_HALF`) and period-end transitions (`handlePeriodEndConfirm`) were already correct. (`13aa12b`)
- **`src/components/LiveMatchStatus.tsx`** (BUG-063) — Added `fallbackPeriod?: string` prop and `PERIOD_LABELS` map. No-WS fallback was hardcoded `"LIVE"` — now shows correct period label (`1ST HALF`, `HT`, `2ND HALF`, `PK`, `FT`) from `currentPeriod` DB value on initial load. (`056388d`)
- **`src/components/ui/MatchCard.tsx`** (BUG-063) — Added `currentPeriod?: string | null` to props interface. Compact variant passes it as `fallbackPeriod` to `LiveMatchStatus`. Live variant's hardcoded HTML badge (`"LIVE"` text) replaced with `<LiveMatchStatus variant="badge" fallbackPeriod={...} />`. (`056388d`)
- **Backlog** — Filed BACKLOG-103 (notification preferences) → immediately backscoped/WONT FIX. Filed BACKLOG-104 (friendly stat aggregation filter). Filed BACKLOG-105 (is_test flag on matches).

**Bugs encountered:**

- **Match stats all zero** — `stats` column on `matches` when stored as `'{}'` is truthy, skipped the computed-from-events path. Also `LiveStats` was reading flat key format (`homeShots`) but API returns array format (`shots[0]`). Both required fixes.
- **Possession `5050%` / `NaN%`** — `stats.possession = [50, 50]` passed to `homeValue` prop rendered as `"5050"` (array toString). `100 - [50,50]` → NaN.
- **Friendly match writing player stats** — no `matchType` check existed before `updatePlayerStats` call. Required one-liner guard.
- **TD-010 partial** — Period survived `FIRST_HALF` and `HALF_TIME` refreshes. `SECOND_HALF` didn't persist because Start 2nd Half button had no PATCH — identified as inline onClick with no named handler, called only `transitionStatus()` on the state manager.

**Test results (fresh match run):**
- TD-010 FIRST_HALF ✅, HALF_TIME ✅, SECOND_HALF ❌ → fixed `13aa12b` — re-verify required
- BUG-063 HT on public page ✅, detail page period label ✅. Homepage card still showed `LIVE` → fixed `056388d`
- Phase B timer ceiling ✅ (halfDuration loaded from config). Sub cap INCONCLUSIVE — `maxSubstitutions` null for BUSA League (correct behaviour, no cap set)
- LiveStats shape fix: Stats tab now shows real numbers — needs re-verification on next test

**Deferred:**

- Fresh match re-verification for TD-010 SECOND_HALF (and ET/PK now covered)
- Prod migrations: `own_goals + penalties_scored` and `current_period` — both staged, do NOT run prod until fresh match test passes
- BUG-066 (goal not counting as shot) — filed
- BUG-062 (lineup wipes on logger refresh) — filed, not started
- BACKLOG-102 (live clock on public pages) — not started

**Next session:**
1. Fresh test match on staging — verify TD-010 SECOND_HALF persistence on hard refresh + homepage period label + sub picker exclusion. Use same 8-phase test plan.
2. If all pass: run both prod migrations (`current_period`, `own_goals + penalties_scored`).
3. Then BUG-066 (goal → shot stat).

---

### Session 32c — 2026-06-25

**Focus:** Close the full 32b carry-over list: auth gate on event delete/patch route, shootout stat guard, BUG-070 empty bench message, wire undo button to DB. Session assessment + backlog hygiene.

**Built / Fixed:**

- **BUG-071 RESOLVED** (`da8d9ce`) — `src/app/api/matches/[id]/events/[eventId]/route.ts`
  - Both PATCH and DELETE had zero auth. Added `getAuthUser` + logger/admin role check + logger assignment check to both handlers. Pattern mirrors parent `DELETE /events` route exactly.
  - Bonus: DELETE was only reverting GOAL score. Fixed to handle PENALTY and OWN GOAL with correct inversion logic (OWN GOAL: `teamId` is conceding team → revert opponent's score, not `teamId` team's score).

- **BACKLOG-105 interim guard SHIPPED** (`da8d9ce`) — `src/app/api/matches/[id]/events/route.ts`
  - `isPenaltyShootout = match.currentPeriod === 'PENALTY_SHOOTOUT'` added. Score increment and `updatePlayerStats` both skipped when flag is true. Prevents shootout events corrupting match score and career stats until full BACKLOG-105 implementation.

- **BUG-070 RESOLVED** (`2cc6398`) — `src/components/FootballLogger.tsx`
  - `emptyMessage` prop added to `PlayerSelectionModal`. Sub-IN call site passes `'No lineup published for this team'` vs `'No available substitutes'` based on `lineups[selectedTeam]` being null. Previously opened blank with no feedback.

- **Undo button SHIPPED** (`07a046a`) — `src/components/FootballLogger.tsx`
  - `handleUndo` rewritten as async. Previously: local state pop + WS broadcast only — no DB call.
  - Now: `DELETE /api/matches/${match.id}/events/${eventToUndo.id}` first. `manager.undoLastEvent()` only called after confirmed 200. On failure: alert shown, local state unchanged. `isUndoing` loading state disables button during request.
  - Temp ID timing note: if `confirmEvent` hasn't fired yet when undo is tapped, `eventToUndo.id` is still `temp_XXX`. DELETE returns 404. Alert fires, nothing changes. Logger retries once `confirmEvent` completes.

- **BACKLOG-106 filed** — `match_player_stats` table spec. Standalone scope cut from BACKLOG-019. One table, one write path change, one recompute helper on delete. BUG-060 cross-referenced to this item instead of BACKLOG-019.

- **BUG-072 filed** — Second Yellow undo removes only the auto Red Card, not the triggering Yellow. Low priority, documented for future handling.

- **Session rule established** — No new feature work until BUG-062 (lineup refresh), fresh match verify (TD-010 SECOND_HALF + undo + sub picker), and BUG-054 (OWN GOAL undo parent path) are done.

**State manager read findings:**
- `undoLastEvent` removes by array position (last event), not by ID. Safe for Option A (immediate undo after logging). Temp→server ID swap race is non-corrupting: 404 → alert → logger retries.
- Second Yellow auto-inserts Red Card via `recordEvent`. `undoLastEvent` removes only the Red Card. Yellow stays. Correct data, confusing UX. Filed BUG-072.
- `Penalty Saved` / `Penalty Missed` already exist as `FootballEventType` and are handled in `calculateMatchStats`. BACKLOG-104 (logger UI + `updatePlayerStats` cases) is the only remaining work when that ships.

**Bugs filed this session:**
- BUG-072 (second yellow undo removes Red only)
- BACKLOG-106 (per-match stat rows — replaces mutable increment model)

**Session assessment:**
- Live match readiness: ~68% staging, ~52% prod
- Bug hygiene score: 6/10 — filing quality high, return/closure velocity low
- Key risks: BUG-062 (lineup wipes on refresh), TD-010 SECOND_HALF unverified, BUG-060 (stat orphan on undo)

**Deferred:**
- BUG-062 (lineup wipes on logger refresh) — must fix before first live match
- Fresh match staging test — TD-010 SECOND_HALF + undo + sub picker + BUG-063 homepage + LiveStats
- BUG-054 (OWN GOAL undo direction on parent DELETE path)
- BUG-060 (stat decrement on event delete) — immediate follow-up after undo is live-verified

**Next session:**
1. BUG-062 — trace root cause first (viewState not persisted vs period rehydration path), then fix
2. Fresh staging match — 8-point test: TD-010 SECOND_HALF refresh, undo button live, sub picker pools, BUG-063 labels, LiveStats numbers, sub cap gate. Each SHIPPED item becomes RESOLVED only on this test.
3. BUG-054 — OWN GOAL undo score inversion on parent `DELETE /events` handler
4. BUG-060 — stat decrement mirror in DELETE handler (unblocked now that undo is wired)

---

### Session 32b — 2026-06-25

**Focus:** Complete BUG-067 (sub picker correctness), fix BUG-066 (shots stat), run prod migrations, file/resolve cosmetic BUG-068, scope undo events work, document penalty shootout business logic.

---

**The Sub Picker Root Cause Chain — Full Trace (read this before touching picker logic again)**

This took the full session to fully diagnose. The bug looked simple ("incoming sub not showing") but had four distinct failure layers:

**Layer 1 — Initial commit `863fce7` (wrong fix)**
Added `subbedOnIds` to `getActiveRoster` to include players who came ON. Appeared to work because the test showed Omari greyed out with BENCH tag. But the real question — "is Omari in `roster` at all?" — wasn't yet answered. DB confirmed he was (Kings FC affiliation, `player-1767972273154-jdc7gsxyp`). So `addSubbedOn` was finding him. But Omari was declared in the lineup's `substitutes` list, meaning he was already in `lineupIds` → already in `base` → `addSubbedOn` just deduped him. The BENCH tag was cosmetic. He was selectable.

**Layer 2 — Outgoing player still showing during their own sub (Case A)**
Toheeb was visible in the sub-IN picker while the logger was selecting his replacement. Root cause: `subbedOffIds` is built from `matchState.events` — the Substitution event for Toheeb hasn't fired yet at the moment the sub-IN picker opens. He's `playerComingOut` in React state but not yet excluded. Fix: add `playerComingOut` to `subbedOffIds` directly. `playerComingOut` is React state, always current, set synchronously before `showSubInModal = true`.

**Layer 3 — Outgoing player still showing after confirmed sub (Case B)**
After Toheeb's sub was confirmed and logged, a NEW third sub attempt still showed Toheeb. Root cause: `matchState` subscription is async. There is a timing gap between `confirmEvent` dispatching to the state manager and `matchState.events` updating in React. When the logger taps the next sub immediately after, `matchState.events` still doesn't include Toheeb's event → `subbedOffIds` misses him. First attempted fix: `pendingSubbedOff` Set, written synchronously in `handleSubIn`. This worked for Case B but broke the normal event picker — `pendingSubbedOff` merged globally, so Toheeb was excluded from goal/card/foul pickers too, shrinking the "active" count after each sub.

**Layer 4 — Data integrity failure (actual root cause)**
While investigating why the picker count dropped, discovered: Omari (a bench player who came ON) was visible in the sub-OUT picker (who's going off). Sub-OUT picker should show ON-PITCH players only. But `getActiveRoster` was a single function serving both pickers — once you've been "on pitch", you're in the lineup pool, and the pool was: starters + bench filtered by `lineupIds`. Bench players who came on mid-match were both in `lineupIds` (from bench) AND in the on-pitch pool. Result: a logger could select Omari to go OFF even though he was the player who just came ON. This was logged, and for a brief moment Omari appeared twice in the system — once as a sub-on and once as a pending sub-off.

**The correct mental model (final implementation — `13ab3cb`):**

```
getOnPitchPlayers(team):
  starterIds (from published lineup) - subbedOffIds + subbedOnPlayers
  = who is actually on the pitch right now

getAvailableBench(team):
  benchIds (from published lineup) - subbedOnIds - playerComingOut
  = who can still come on

Each picker uses only one pool:
  Normal event / sub-OUT / assist / penalty → getOnPitchPlayers
  Sub-IN → getAvailableBench
```

Key insight: the single-function `getActiveRoster` approach fails as soon as player state has multiple dimensions (original position + current on-pitch status). Two functions with explicit semantics is not overengineering — it reflects the reality that the two pickers have genuinely different requirements.

**`pendingSubbedOff` post-mortem:** it was a correct fix for the timing gap (Case B) but applied in the wrong scope. After the rewrite, it became unnecessary because `getAvailableBench` derives from `matchState.events` only — and by the time a second sub is initiated, the first sub's event has propagated. The timing gap that `pendingSubbedOff` was patching only existed because `getActiveRoster` was serving both pickers and the sub-IN picker needed to know about an in-progress sub's outgoing player. With separate pools, that ambiguity is gone.

---

**Built / Fixed:**

- **BUG-067 — RESOLVED** across 3 commits:
  - `863fce7`: first attempt — `subbedOnIds` in `getActiveRoster`, correctly excluded outgoing player (partial)
  - `0d30d14`: `playerComingOut` added to exclusion set (Case A fix)
  - `13ab3cb`: full rewrite — `getOnPitchPlayers` + `getAvailableBench` replacing `getActiveRoster`; `pendingSubbedOff` removed entirely
  - File: `src/components/FootballLogger.tsx`

- **BUG-066 — RESOLVED** (`9d37967`)
  - `updatePlayerStats` Football switch now increments `shotsOnTarget` on GOAL and PENALTY. OWN GOAL explicitly excluded (defending player credited with ownGoal, no shot credit — correct per football convention).
  - File: `src/app/api/matches/[id]/events/route.ts`

- **BUG-068 — SHIPPED (uncommitted)** — cosmetic fix
  - `PlayerSelectionModal` marked incoming subs as BENCH based on `!starterIds.has(p.id)` — pure lineup check, no awareness of who came on mid-match.
  - Fix: added `subbedOnPlayerIds?: Set<string>` prop; `isBench = !starterIds.has(p.id) && !subbedOnPlayerIds?.has(p.id)`. Call site passes `getSubSets(...).subbedOnIds` for the normal event / sub-OUT pickers.
  - File: `src/components/FootballLogger.tsx`

- **Prod migrations applied:**
  - `current_period TEXT DEFAULT 'NOT_STARTED'` on `matches` — prod confirmed ✓
  - `own_goals INTEGER DEFAULT 0` on `football_player_stats` — prod confirmed ✓
  - `penalties_scored INTEGER DEFAULT 0` on `football_player_stats` — prod confirmed ✓
  - Scripts: `dev/migrate-prod-td010.mjs`, `dev/migrate-prod-football-stats.mjs`

**Bugs filed this session:**
- BUG-068 (cosmetic — incoming sub styled as BENCH in sub-OUT picker) — SHIPPED, uncommitted
- BUG-069 (PENALTY + GOAL double-count on shotsOnTarget) — CLOSED by convention (PENALTY = scored, BACKLOG-104 covers outcome variants)
- BUG-070 (empty bench UX — sub-IN modal shows empty list silently when no lineup published)
- BACKLOG-104 (penalty outcome tracking: PENALTY MISSED / PENALTY SAVED event types + stat cases)
- BACKLOG-105 (penalty shootout score isolation: PENALTY_SHOOTOUT period must not write to home/away score or player stats — interim guard needed in events route)

**Decisions made:**
- PENALTY convention: PENALTY = scored (goal + stat). PENALTY MISSED / PENALTY SAVED are future event types (BACKLOG-104). BUG-069 closed.
- Penalty shootout events currently corrupt match score and stats (home/away score increments, `penaltiesScored` increments — both wrong). Interim guard (`if currentPeriod === 'PENALTY_SHOOTOUT': skip score + stat writes`) must land before any shootout is played. Full shootout score system is BACKLOG-105.
- Basketball logger has no mirror of BUG-067 — uses explicit `homeStarters`/`homeSubs` arrays swapped atomically in `handleSubIn`, no async event state.
- Auth gate on DELETE/PATCH `/api/matches/[id]/events/[eventId]` is zero — no `getAuthUser`, no role check. Must be gated before undo button ships.

**Deferred / pending commits:**
- BUG-068 cosmetic fix — uncommitted, pending commit in next session with auth gate
- Auth gate on `[eventId]/route.ts` — not yet written
- Undo last event button (Option A) — not started, blocked on auth gate
- BUG-070 (empty bench message) — one-liner, same session as undo

**Next session:**
1. Commit BUG-068 cosmetic fix (`FootballLogger.tsx` already edited)
2. Add auth gate (logger OR admin) to DELETE + PATCH on `src/app/api/matches/[id]/events/[eventId]/route.ts`
3. Add interim PENALTY_SHOOTOUT guard to `src/app/api/matches/[id]/events/route.ts` (skip score + stat writes when `currentPeriod === 'PENALTY_SHOOTOUT'`)
4. Wire undo last event button (Option A) in `FootballLogger.tsx`
5. BUG-070 one-liner (empty bench message)
6. Commit all together, push to staging, verify undo works on a test match

---

### Session 31 — 2026-06-25

**Focus:** Verify TD-010 API gap, ship BACKLOG-044 Phase B (match config on mount, timer ceiling, sub cap), fix BUG-063 (period label on public match page).

**Built / Fixed:**

- **TD-010 API gap — confirmed closed (no code change needed)**
  - Read `src/app/api/loggers/[id]/route.ts` — `assignedMatches` comes from `getLoggerMatches(id)` which uses `match: matches` (full row select in `match-logger-helpers.ts`). `current_period` flows through automatically. No omission to fix.
  - Also confirmed: the old test match showing `NOT_STARTED` after Session 30 was expected — the match was started and transitioned *before* `b66eb95` deployed and *before* the migration ran, so those transitions never wrote `current_period`. Migration defaulted all existing rows to `NOT_STARTED`. Not a bug.

- **BACKLOG-044 Phase B — SHIPPED (`64b0974`)** — `src/components/FootballLogger.tsx` — 26 insertions
  - Added `useState<number | null>(null)` for `maxSubstitutions` (~line 116)
  - After `MatchStateManager` init on mount: `GET /api/matches/[id]/config` → applies `config.halfDuration` via `updateConfig` + `setHalfDuration`; stores `config.maxSubstitutions`. Alert on failure, falls back to hardcoded default.
  - Sub cap gate in `handleSubIn`: reads `matchState?.stats?.substitutions[teamIndex]`, blocks with `alert()` if at cap; skipped if `maxSubstitutions === null`.
  - Task 4 Amendment (lock toggle after match starts) was pre-existing — `isLocked = currentPeriod !== 'NOT_STARTED'` already in place at line 1791.
  - **Live verification (partial):** period `HALF_TIME` written correctly ✅, `halfDuration: 35` loaded from config ✅, toggle locked in `HALF_TIME` ✅. Sub cap gate NOT YET TESTED — pending next live match.

- **BUG-063 — SHIPPED (`ea4a1d5`)** — `src/app/matches/[id]/page.tsx` — 26 insertions, 5 deletions
  - Root cause traced: `match.status` DB column is always `LIVE` — it never holds `FIRST_HALF`/`HALF_TIME` etc. WS path (`match:time:update` with `period`) already updates local `match.status` in React state. `LiveMatchStatus` component already handles period labels via WS. The gap was: initial page load with no WS → `matchTime` is null → no period label shown, just `LIVE`.
  - Also: MatchStateManager fully read — confirmed `broadcastTimeUpdate()` is a DOM CustomEvent (local only). The WS emit is in `FootballLogger`'s `useEffect` watching `matchState` (line 450). Public page has no direct connection to MatchStateManager.
  - Fix: `displayPeriod = matchTime?.period ?? match.currentPeriod ?? match.status`. Score header now shows period badge (1ST HALF / HT / 2ND HALF) + minute for active play; HT/FT label for stopped play. Overview status card updated. `MatchCard` unchanged (already uses `LiveMatchStatus` via WS).
  - WS disconnection: `useMatchTimer` holds last value in `useState` — frozen until page refresh. On fresh load with no WS, `match.currentPeriod` (TD-010) is the fallback.

- **Backlog/journal filed:**
  - BUG-063 updated to SHIPPED
  - BACKLOG-102 filed (live viewer clock — `MM:SS` on detail page via WS, `MM'` on cards via poll)
  - BACKLOG-044 Phase B status updated to SHIPPED/conditionally done

**Deferred:**
- TD-010 + Phase B full verification — fresh test match required (period survival on refresh + sub cap gate)
- Prod migration for TD-010 — after fresh match test passes
- BACKLOG-102 (live viewer clock) — not started
- BUG-060 (stat decrement on event DELETE)
- BUG-062 (lineup wipes on logger refresh)

**Next session:**
1. Spin fresh test match on staging — verify `currentPeriod` survives hard refresh (TD-010) and sub cap gate blocks past limit (Phase B). Both checks close in one session.
2. If both pass: run prod migration for TD-010.
3. Then BUG-063 live verification on the same match.

---

### Session 29 — 2026-06-24

**Focus:** Commit and verify BUG-058b fix, enforce RESOLVED lifecycle rules, trace and fix Timeline 500, triage test match pollution, elevate TD-010 to pre-match-day blocker.

**Built / Fixed:**

- **BUG-058b SHIPPED** (`src/app/api/auth/refresh/route.ts`, `src/components/FootballLogger.tsx`) — commit `1057f22`
  - `POST /api/auth/refresh`: normalises `payload.userId ?? payload.id`, branches on `role === 'logger'` to query `loggers` table directly (not via `getAuthUser`), signs token with `{ id, email, role }`, returns token in response body (previously cookie-only).
  - `FootballLogger.tsx`: mount `useEffect` calls `POST /api/auth/refresh` with `credentials: 'include'`, reads `data.token` from body, writes to `localStorage.authToken`. Survives AuthContext wipe on every subsequent mount.
  - Confirmed: refresh route has its own direct `loggers` table query — independent of the `getAuthUser` fix. Not a pass-through risk.

- **BUG-059 RESOLVED** (`src/components/LiveMatchTimeline.tsx`) — commit `8c56f67`
  - Root cause: `eyePoints` prop destructured from `matchData` (page.tsx:234), but `GET /api/matches/[id]` never returns `eyePoints` key → `undefined`. Line 437 called `eyePoints.length` unconditionally → TypeError → Timeline tab crash every time.
  - Observed as a "500" in the network panel — actually a client-side render crash, not a server error. Sentry will log as client exception, not server 500. Documented for BACKLOG-035 triage.
  - Fix: `(eyePoints ?? []).length` and `(eyePoints ?? []).map(...)`. One-line guard, no logic change.
  - Follow-up: `eyePoints` is a real feature (per-match Eye Point award list from `eyePointAwards` table in schema-enhanced.ts). API never wires it. Panel silently empty even when Eye Point events exist. Filed as BACKLOG-094 — fix is client-side derive from `events.filter(e => e.isEyePoint)`.

- **RESOLVED lifecycle rules enforced** (`CLAUDE.md`) — commit `51e17df`
  - Added "What Does NOT Count as Evidence" section. Explicitly invalid: UI state, 201 status codes, logger score display, absence of console errors, vague smoke test pass.
  - Rule: any bug that writes to the DB requires a DB query result as evidence before RESOLVED label applies.

- **BUG-047 properly RESOLVED** (`dev/verify-bug-047-scores.mjs`) — commit `2bc973f`
  - Was incorrectly marked RESOLVED based on "logger showed 2-3." Logger score is locally computed — not DB state.
  - Verification script ran `SELECT home_score, away_score FROM matches` + full event audit against staging match `LFkN14uB90brGn2E8sW1N`. Result: expected 3-3, DB 3-3. Both OG events credited the opponent team (not `teamId` team). PASS.
  - Only now legitimately RESOLVED with DB query output as evidence.

- **TD-010 elevated to CRITICAL pre-live-match blocker** — commit `dd5a939`
  - Period transitions (HT, 2nd half start, FT) do no server PATCH. Period state lives in React `useState` only. Phone refresh mid-match resets period to `NOT_STARTED` at 0:00 — same trust-failure category as BUG-049.
  - Re-scoped to minimal fix: `currentPeriod` column on `matches`, PATCH on each transition, read on mount. Timer precision not required — period label is what matters.
  - BACKLOG-044 Phase B explicitly blocked on TD-010. Both must land together before first match day.

**Bugs filed this session:**
- **BUG-059** — Timeline tab TypeError on `eyePoints.length` (RESOLVED, `8c56f67`)
- **BUG-060** — `DELETE /api/matches/[id]/events` reverts score but not `footballPlayerStats` — ghost stat on deleted goal. Same class as BUG-011 from delete direction.
- **BACKLOG-094** — Eye Point Awards panel silently never renders (API doesn't return `eyePoints` array)

**Test match triage:**
- Match `LFkN14uB90brGn2E8sW1N` status: FINISHED (finalise PATCH went through). Score: 3-3 (DB confirmed).
- Dirty stat rows: Emmanuel Adeyanju (+1 goal, +1 assist), Benjamin Adenuga (+1 goal), Justin (+1 goal, no stats row — write never fired), Tisco Jr (+1 assist, no-op).
- Own Goals, Penalties, Fouls: zero stat impact — `updatePlayerStats` switch has no case for these types. Confirmed gap.
- Cleanup script written: `dev/cleanup-test-match.mjs`. Dry-run output verified. **Run `--apply` to execute — not yet done.**

**Stat pipeline gaps confirmed:**
- Football stats written on event POST: Goal, Assist, Yellow Card, Red Card, Save only.
- Penalty (scores match, not player), Own Goal (scores match, not player), Foul — no stat write.
- Stats are mutable increments — no rollback on event DELETE. `footballPlayerStats` orphans on event undo.
- Standings: computed at read time from `matches` rows, not touched during event logging.
- Ratings: fire-and-forget background fetch on POST, non-blocking.

**Deferred:**
- ~~`dev/cleanup-test-match.mjs --apply`~~ — DONE (run Session 29, see RUNLOG Session 29)
- BACKLOG-058 Tests 1–4 re-run on staging (BUG-058b now deployed; Test 3 drain fix now landed — re-run required)
- TD-010 implementation
- BACKLOG-044 Phase B (blocked on TD-010)
- BACKLOG-094 fix (eyePoints client-side derive)
- BUG-060 fix (stat decrement on event delete)

**Additional fix landed this session (Session 30):**
- **BACKLOG-058 Test 3 drain crash fixed** (`public/sw-admin.js`) — commit `49ce483`
  - Root cause: `db.getAll(storeName)` and `db.delete(storeName, key)` are Dexie.js patterns. `openDB()` returns a raw `IDBDatabase` — neither method exists on that object. Crash: `db.getAll is not a function` at line 166.
  - Fix: added `idbGetAll(db, storeName)` and `idbDelete(db, storeName, key)` promise helpers using raw IDB transaction → objectStore API. Replaced all 4 Dexie-style calls in both `syncMatchEvents()` and `syncAdminChanges()`.
  - `node --check` passes.

- **BACKLOG-058 RESOLVED** — Test 3 passed live on staging (2026-06-24)
  - SW background sync fired, drained 15 queued events (events 1–15 all POSTed successfully)
  - IDB `pendingMatchEvents` store: Total entries: 0 after drain — queue fully cleared
  - Public page: offline events visible (Own Goal 36:28, Red Card, Yellow Card, Foul 36:54–57)
  - Verified on staging via Chrome DevTools Application tab (IDB inspector) + public page observation

- **TD-010 period trace completed** (read-only analysis)
  - `currentPeriod` is derived from `matchState?.clock.period ?? 'NOT_STARTED'`
  - `matchState` comes from `MatchStateManager`, which rehydrates from `localStorage.getItem('match_state_${matchId}')` on mount
  - Period transitions (`transitionStatus()`) write only to in-memory state + `localStorage.setItem()` — **zero DB writes, zero PATCH calls**
  - `matches` table has no `current_period` column — confirmed via schema.ts
  - PATCH handler (`/api/matches/[id]/route.ts`) has no period field — confirmed by grep
  - Period survival: same device/browser only. Different phone, cleared storage, or private mode → resets to `NOT_STARTED`

**Bugs filed this session:**
- BUG-061 — Away team roster not populating in player picker (HIGH, pre-match blocker)
- BUG-062 — Lineup data wipes on browser refresh (MEDIUM)
- BUG-063 — HALF_TIME not reflected on public page — blocked by TD-010 (MEDIUM)
- BUG-064 — Match tabs horizontal scroll on mobile (LOW)
- BUG-065 — Event counter in logger header broken (LOW)

**Next session:**
1. Implement TD-010: `currentPeriod` column on `matches` + PATCH on every period transition + mount read in FootballLogger seeding the StateManager
2. BUG-061 — trace and fix away team roster query
3. Then BACKLOG-044 Phase B

### Session 28 — 2026-06-22

**Focus:** Resolve BUG-050/051/052 (CRITICAL JWT and auth guards), smoke test logger flow on staging, diagnose 401 root cause, file + fix BUG-057.

**Built / Fixed:**

- **BUG-050 (expanded) — JWT fallback removed from all 7 files** (`src/middleware.ts`, `src/app/api/auth/refresh/route.ts`, `src/app/api/auth/me/route.ts`, `src/app/admin/layout.tsx`, `src/app/api/loggers/auth/route.ts`, `src/app/api/matches/[id]/livestream/route.ts`, `src/app/api/matches/[id]/lineup/unlock/route.ts`, `src/app/api/matches/[id]/lineup/publish/route.ts`)
  - All 7 call sites (both sign and verify) replaced `process.env.JWT_SECRET || 'your-secret-key-change-in-production'` with `env.jwtSecret` + explicit guard.
  - jose call sites: throw at module level on empty secret. jsonwebtoken call sites: return 500.
  - jose already enforces 32-byte minimum; explicit guard added for consistency.
  - Commit: `1824256`

- **BUG-051 — Status enum gate + logger role restriction** (`src/app/api/matches/[id]/route.ts`)
  - PATCH now validates `status` against `['PENDING','UPCOMING','LIVE','FINISHED','CANCELLED']` → 422 on unknown value.
  - Logger role restricted to `['LIVE','FINISHED']` — `FINISHED` kept because `handleFinalize` PATCHes it as logger.
  - Commit: `1824256`

- **BUG-052 — Admin-only score writes** (`src/app/api/matches/[id]/route.ts`)
  - `homeScore`/`awayScore` PATCH writes gated to `admin` role; non-negative integer guard added.
  - Event-driven scoring (`POST /events` → `db.update` directly) confirmed separate code path — unaffected.
  - Commit: `1824256`

**Smoke test — root cause found (BUG-057):**

Logger logged into staging via `/logger` login page. `POST /api/loggers/auth` returned 200, `authToken` cookie was set (confirmed in DevTools). But every subsequent call — `PATCH /api/matches/[id]`, `POST /api/matches/[id]/events`, `GET /api/auth/me` — returned 401.

Root cause: `getAuthUser()` in `src/lib/auth.ts` is broken for logger sessions.
- Logger JWTs carry `{ id, email, role }`. Admin JWTs carry `{ userId, email, role }`.
- `verifyAuth` casts to `AuthUser` (has `userId` field) — but the spread doesn't rename `id` → `userId`. So `authData.userId` is `undefined` for all logger tokens.
- `getAuthUser` queries `users` table with `WHERE id = undefined` → no rows → returns `null` → 401.
- This means **every logger API call has always returned 401**. Start Match, log events, End Match — all broken.

Fix written in `src/lib/auth.ts` (not yet committed):
1. `verifyAuth`: decode as `{ userId?: string; id?: string; email; role }`, return `userId: decoded.userId ?? decoded.id ?? ''`.
2. `getAuthUser`: when `authData.role === 'logger'`, query `loggers` table and return a shaped `AuthenticatedUser` with null defaults for user-only fields.

**Also noted:**
- `BUG-044b`: Logger dashboard `GET /api/auth/me` will still return 401 for loggers — that endpoint is admin-auth only. Separate fix needed (`/api/loggers/me` endpoint). Not in scope this session.
- WebSocket errors on staging (`wss://brixsports-production.up.railway.app`) — pre-existing BACKLOG-027. Not a regression.
- Staging-wide auth gate in middleware (env.isStaging) correctly exempts `/api/auth/*` but NOT `/api/loggers/*`. Logger login goes through `/api/loggers/auth` which is exempted. OK.

**Deferred:**
- BUG-047 smoke test — blocked on BUG-057 commit + deploy
- BACKLOG-058 Tests 1–4 — blocked on BUG-057
- BACKLOG-044 Phase B — blocked on smoke tests

**Next session:**
1. Commit BUG-057 fix (`src/lib/auth.ts`) after tsc clean
2. Push to `fix/bug-057-logger-auth` branch, PR to dev, merge
3. Deploy staging → smoke test: logger login → Start Match → log Goal → check score → End Match
4. Run BUG-047 (Penalty + OG) and BACKLOG-058 (offline queue) after Start Match confirmed working
5. BACKLOG-044 Phase B only after all smoke tests pass

> **Update (same session):** BUG-057 committed directly to dev (commit `1401ee2`), pushed. Staging deployed. Smoke test run:
> - Logger login → authToken cookie set ✅
> - Start Match (PATCH `{ status: "LIVE" }`) → 200 ✅
> - 9 events posted (Goal ×2, Penalty ×1, Own Goal ×2, Foul ×3, Assist ×1) → all 201 ✅
> - Logger showed 2-3 at First Half. Public page showed 2-2 (polling lag, not a bug). ✅
> - BUG-047 confirmed RESOLVED. BUG-057 confirmed RESOLVED.
> - Flow B confirmed live for the first time end-to-end.
> - **Next session starts with:** BACKLOG-058 Tests 1–4 (offline queue), then BACKLOG-044 Phase B.

> **Update (same session) — BACKLOG-058 Test 2 (offline path) + BUG-058b:**
>
> Ran BACKLOG-058 Test 2: went offline, pushed an event from the logger. Expected: IndexedDB write. Observed: alert "Network error: could not save this event and no session found. Please re-login and re-log this event manually." — no IndexedDB write, no queue row.
>
> **Root cause — BUG-058b:** `AuthContext.tsx` (line 74) runs `checkAuth` on every page mount. It calls `GET /api/auth/me`, which returns 401 for logger sessions (that endpoint is admin-only). On 401, `checkAuth` calls `localStorage.removeItem('authToken')`. By the time FootballLogger's offline `catch` block reads `localStorage.getItem('authToken')`, the token is gone → `!token` guard fires → alert, no queue write.
>
> **Fix — two files:**
> 1. `src/app/api/auth/refresh/route.ts` — updated to handle logger tokens. Normalises `payload.userId ?? payload.id`, branches on `actorRole === 'logger'` to query the `loggers` table, signs new token with `{ id, email, role }` (matching what `/api/loggers/auth` issues), and now returns `token` in the JSON body (previously cookie-only).
> 2. `src/components/FootballLogger.tsx` — added mount `useEffect` that calls `POST /api/auth/refresh` with `credentials: 'include'`, reads `data.token` from the response body, and writes it back to `localStorage.authToken`. Runs once on mount, silently skips if offline. This ensures the token survives the AuthContext wipe.
>
> tsc clean on both files. **Not yet committed** — waiting for backlog + journal update first.
>
> **Next session starts with:** commit BUG-058b fix, push to dev, redeploy staging, re-run BACKLOG-058 Tests 1–4 in full.

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

---

### Session 33 — 2026-06-25

**Focus:** Test match audit and cleanup (KIN vs JOG), PWA iOS limitations documentation, BUG-076 root cause investigation and fix.

**Built / Fixed:**

- **KIN vs JOG test match cleanup** — `dev/audit-kin-jog-test-match.mjs` + `dev/cleanup-kin-jog-test-match.mjs --apply`
  - Match `VdOX62T7r6V0uZWCoYO9e` deleted. 49 events removed, 1 logger assignment removed.
  - Stats decremented for 11 players: Victor Ememe, Temidayo Olusesi, Samuel Olapite, Nasirudeen Alabi, Timileyin Teniola, Hussein Johnson, Justin Onyeka, Innocent Kedem, Ola-praise Abadoni, Osemudiamen Amromawhe, Ayomiposi Peters.
  - Verified: match does not exist in DB post-cleanup. All stat floors held at 0 via MAX(0, col + delta).

- **BUG-076 SHIPPED** (`60aa93d`) — `src/components/FootballLogger.tsx`
  - Root cause: `handleFinalize` (the only path that writes `status: 'FINISHED'`) was guarded by `currentPeriod !== 'FINISHED'`. When logger confirms "End 2nd Half" modal → `handlePeriodEndConfirm` transitions `currentPeriod` to `'FINISHED'` → re-render hides End Match button → `handleFinalize` permanently unreachable. Every real match would be stuck `status: LIVE` forever.
  - Fix 1: `handlePeriodEndConfirm` now detects `nextPeriod === 'FINISHED' && homeScore !== awayScore` and folds `status: 'FINISHED'` into the same PATCH (single DB write for the decisive whistle).
  - Fix 2: End Match button guard relaxed from `currentPeriod !== 'FINISHED' && currentPeriod !== 'NOT_STARTED'` to `currentPeriod !== 'NOT_STARTED'` — keeps it visible at FINISHED as a fallback for ET/Penalties paths where the auto-finalize doesn't trigger.
  - Confirmed by HAR: 5 match PATCHes in the test session — none carried `status: FINISHED`. The `currentPeriod: FINISHED` PATCH at 14:39 UTC (3h after match) was from the period modal, not `handleFinalize`.

- **PWA_LIMITATIONS.md filed** — `.agents/dev/PWA_LIMITATIONS.md`
  - Background Sync broken on iOS (sync.register no-ops). Push from browser tab not supported. `beforeinstallprompt` absent. Cookie isolation in Home Screen PWA. SW lifetime ~30s on iOS background.
  - Manifest scope bug confirmed in every console log: `start_url` outside `scope` blocks iOS install.
  - Staging WS confirmed 100% dead: 70 failed connections to `wss://brixsports-production.up.railway.app` throughout entire HAR session.

- **Bugs filed:** BUG-073 (sub detail direction inverted), BUG-074 (staging WS → prod URL), BUG-075 (manifest scope), BUG-076 (status stuck LIVE — fixed same session), BACKLOG-107 (iOS drain fallback)

**Bugs encountered:**

- **8 events status=0 in HAR** — initially appeared as data loss (including a goal). Confirmed NOT lost: requests were aborted by page navigation (reload at 11:03), server never received them. SW offline queue caught them, all 8 resent and confirmed 201 after reload. No data loss.
- **3 bad substitution events in test match DB** — Omari Dennis listed as OUT twice (once at 48', again at 63'58"), phantom Daniel Tiamiyu sub at 64' (duplicate of 48'). Caused by BUG-067 sub picker not yet deployed at time of test. Cleaned via match delete.
- **Sub `detail` field direction inverted (BUG-073)** — discovered during sub event analysis. `detail` = `"{outPlayer} IN for {inPlayer}"` but correct English/semantics is `"{inPlayer} IN for {outPlayer}"`. Cosmetic only — display reads `playerId`/`relatedPlayerId` directly.

**Deferred:**

- BUG-062 — lineup/player selector empty on refresh. Fix clear: if `currentPeriod !== NOT_STARTED` on mount, skip confirm screen + re-fetch lineups. Cache exploration explicitly deferred (no feature branch).
- BACKLOG-107 — iOS online/visibilitychange drain fallback. Not started.
- BUG-075 — manifest scope fix. Not started.
- BUG-074 — staging WS env var. Not started.
- Fresh staging match test — needed to RESOLVE TD-010 SECOND_HALF, BUG-076, BUG-067, LiveStats. Prod migrations blocked until this passes.

**Next session:**
1. Fix BUG-062 — auto-refetch lineups + skip confirm screen when match already in progress on mount (`currentPeriod !== NOT_STARTED`)
2. Fix BACKLOG-107 — `online`/`visibilitychange` drain handler in FootballLogger.tsx for iOS
3. Run fresh staging match test (8-point checklist) to RESOLVE all SHIPPED items
4. If staging test passes: run prod migrations (`current_period`, `own_goals`, `penalties_scored`)

---

### Session 33C — 2026-06-26

**Focus:** Pre-match-day soft blocker sweep — close all fixable bugs before the 8-point staging test match.

**Built / Fixed:**

- **BACKLOG-107 SHIPPED** (`dfad1f6`) — `src/components/FootballLogger.tsx` + `public/sw-admin.js`
  - iOS has no Background Sync API — `sync.register('sync-match-events')` is a no-op on iPhone.
  - Fix: new `useEffect` in FootballLogger with `window.addEventListener('online', triggerDrain)` + `document.addEventListener('visibilitychange', handler)`.
  - `triggerDrain`: tries Background Sync tag re-register first (Android/desktop); falls back to `navigator.serviceWorker.controller.postMessage({ type: 'DRAIN_MATCH_EVENTS' })` when SyncManager absent (iOS).
  - `sw-admin.js` message handler extended: `DRAIN_MATCH_EVENTS` case calls `syncMatchEvents()` directly.
  - Cleanup on unmount. No new tsc errors.

- **BUG-075 SHIPPED** (`5866ab4`) — `public/manifest-admin.json`
  - `scope: "/admin/"` blocked `start_url: "/admin?source=pwa"` and the Logger shortcut at `/logger` — both outside the scope. Fix: `scope: "/"` covers all routes the PWA uses.
  - One character change. Console warning eliminated, iOS Home Screen install unblocked.

- **BUG-054 + BUG-060 SHIPPED** (`3bbad31`) — `src/app/api/matches/[id]/events/route.ts`
  - **BUG-054**: Parent `DELETE /events` scoring condition was `event.value || type === 'GOAL'` — missed PENALTY and OWN GOAL entirely. OWN GOAL also used wrong team direction (decremented conceding team's score, not opponent's). Fix: mirrored the [eventId] route pattern exactly — `isScoringEvent = GOAL || PENALTY || OWN GOAL`; OWN GOAL inverts `isHomeTeam` (`teamId !== homeTeamId`).
  - **BUG-060**: DELETE never called `updatePlayerStats` in reverse. Ghost stats accumulated on every undo. Fix: added `decrementPlayerStats()` function (mirror of `updatePlayerStats` with `Math.max(0, x - 1)` floor on all fields). Called after event delete with same guards as POST: skip friendlies (`matchType !== 'friendly'`) and penalty shootout (`currentPeriod === 'PENALTY_SHOOTOUT'`). Match now fetched before delete (not inside score-revert if-block) so guards are available for both paths. Covers all 8 football cases and 9 basketball cases.

- **BUG-055 SHIPPED** (`43583c1`) — `src/app/api/matches/[id]/events/route.ts`
  - `isScoringEvent = upperType === 'GOAL' || upperType === 'PENALTY' || isOwnGoal || value` — `|| value` caused any event with a truthy `value` field to silently increment the score. One token removed. Type-explicit scoring only.

- **BUG-053 SHIPPED** (`7d90e05`) — `src/app/api/loggers/auth/route.ts`
  - No brute-force protection on logger login. Fix: module-level `loginAttempts: Map<string, { count, resetAt }>`. IP from `x-forwarded-for` (leftmost, handles proxy chains). 5 failures in 15 min → 429. Increments on both failure branches (logger not found + wrong password). Clears on success. Resets on Vercel cold start — documented in comment as MVP gate, not full prod solution.

- **BUG-073 confirmed already correct** — `${relatedName} IN for ${outName}` reads `{inPlayer} IN for {outPlayer}`. `relatedPlayerId = playerInId` (coming ON); `playerId = playerComingOut` (going OFF). String was never wrong at current HEAD.

- **BUG-068 confirmed already committed** — `subbedOnPlayerIds` prop wired at line 1711, consumed at line 2344, `isBench` override at line 2393. Landed in `31fc5a3`.

**Bugs filed this session:** none

**Deferred:**
- 8-point staging match test — all SHIPPED items below remain unverified
- Backlog hygiene pass (BUG-073 RESOLVED with no code change, BUG-075/107/053/054/055/060 SHIPPED → need closing after test)

**All items SHIPPED but not yet RESOLVED (require fresh staging match):**

| Item | Commit | What to verify |
|------|--------|----------------|
| TD-010 (period persistence) | `b66eb95`, `13aa12b` | SECOND_HALF survives hard refresh |
| BACKLOG-044 Phase B | `64b0974` | Timer ceiling from config, sub cap gate |
| BUG-063 (period labels public page) | `ea4a1d5`, `056388d`, `024e086` | Correct label at each period on public page + homepage |
| BUG-062 (logger refresh fast path) | `3a3ea3c`, `37712ba` | Hard refresh mid-match resumes active logger view |
| BUG-077 (starters pre-selected in edit modal) | `d96db0a` | Edit modal opens with correct starters highlighted |
| BUG-078 (currentPeriod FINISHED on End Match) | `91bd33d` | Public page shows FT after End Match |
| BUG-076 (status stuck LIVE) | `60aa93d` | UNVERIFIED — needs match ending decisively at 90' |
| BACKLOG-107 (iOS drain) | `dfad1f6` | Queue drains on tab resume + reconnect on iPhone |
| BUG-075 (manifest scope) | `5866ab4` | Console warning gone, iOS install works |
| BUG-054/060 (undo correctness) | `3bbad31` | OWN GOAL undo reverts correct team; stat row decrements |
| BUG-055 (|| value scoring) | `43583c1` | Non-scoring events with value field don't touch score |
| BUG-053 (rate limit) | `7d90e05` | 5 bad logins → 429 on 6th attempt |

**Next session:**
1. Run 8-point staging match test — verify all SHIPPED items above, resolve or mark UNVERIFIED
2. If test passes: run prod migrations (`current_period`, `own_goals`, `penalties_scored`)
3. Backlog hygiene pass — close all SHIPPED entries that pass the test

---

### Session 33D — 2026-06-26

**Focus:** Pre-test-match sweep — small self-contained bug fixes, dashboard stats wiring, UX polish. No match needed to verify most items.

**Built / Fixed:**

- **BUG-044b SHIPPED** (`4be7f8d`) — `src/app/api/loggers/me/route.ts` + `src/app/logger/page.tsx`
  - Old `/api/loggers/me` read `x-logger-id` from a header/query param with zero JWT auth and returned only the profile — no stats.
  - Rewrite: `getAuthUser(request)` → 403 if not logger role. Queries `loggers` table by `authUser.id`. Returns `stats: { totalEvents, loggedMatches }` via `count()` on `match_events WHERE loggerId = id` and `matchLoggerAssignments WHERE loggerId = id`.
  - Dashboard in `logger/page.tsx`: new `loggerStats` state, `useEffect` calls `/api/loggers/me` on login, populates "Total Events" and "Logged Matches" cells (previously hardcoded `"-"`).

- **BUG-045 SHIPPED** (`4be7f8d`) — `src/app/logger/page.tsx` line 374
  - `{new Date(match.startTime).toLocaleTimeString(...)}` with no guard produced `"INVALID DATE"` when `startTime` is null.
  - Fix: null + `isNaN(new Date(...).getTime())` guard, falls back to `'Time TBC'`.

- **BUG-064 SHIPPED** (`905d30a`) — `src/app/matches/[id]/page.tsx` line 352
  - Tab bar had `overflow-x-auto` but no `scrollbar-hide` — scrollbar chrome bled into layout on mobile.
  - Fix: added `scrollbar-hide` (project-wide custom utility in `globals.css`, used in 10+ other places). One token change.

- **BUG-065 SHIPPED** (`905d30a`) — `src/components/FootballLogger.tsx`
  - No event counter existed in the logger header — the count was only used for undo button disabled state, never displayed.
  - Fix: counter pill added just before the undo button showing `recordedEvents.length` (large number) + `"Evts"` label. Updates live via `matchState?.events ?? []` subscription.

- **TEST_CHECKLIST.md updated** (`db363ac`) — Phases 8 and 9 added covering BUG-044b/045 (Phase 8, no match needed) and BUG-065/064 (Phase 9). Existing Phase 8 → Phase 10, iOS → Phase 11.

**Deferred:**
- BUG-056 (LOW): 401 mid-match silently drops event — alert on 4xx in FootballLogger — recommended for next session before test match
- BACKLOG-094 (MEDIUM): Eye Point Awards panel always empty — client-side derive from `events.filter(e => e.isEyePoint)` — 2 lines
- BUG-043 (LOW): Publish Lineups button silently disabled with no hint — tooltip only

**Sub cap gate clarification:** `maxSubstitutions` is set on the competition in `/admin/competitions` → Match Settings. Per-match override for sub cap not yet in the match creation UI.

**Next session:**
1. Ship BUG-056 (alert on 4xx event POST) + BACKLOG-094 (Eye Point derive) + BUG-043 (tooltip) — all code-only, no match needed
2. Run the full 11-phase staging test match — first live run with all SHIPPED items since Session 30

---

### Session 33E — 2026-06-26

**Focus:** Three code-only pre-test-match fixes (BUG-056, BUG-043, BACKLOG-094 scoped down). No match needed for any of them.

**Built / Fixed:**

- **BUG-056 SHIPPED** (`5cb6738`) — `src/components/FootballLogger.tsx` lines 713–718
  - Server rejection branch (`else` after `if (res.ok)`) previously only `console.error`'d. Logger had zero UI feedback when a 4xx dropped an event mid-match.
  - Fix: 401 → `alert('Session expired — please log in again to continue logging.')`, 403 → `alert('Not authorised to log events for this match. Contact admin.')`, generic 4xx → `alert('Event failed to save (${res.status}) — check connection and retry.')`. `console.error` retained alongside for debugging.
  - Scope note: only the online POST path is affected. Offline queue path (catch block) already had its own alerts — untouched.

- **BUG-043 SHIPPED** (`5cb6738`) — `src/app/admin/match-lineups/page.tsx` lines 635–645
  - Publish Official Lineups button disabled silently when `!homeCaptain || !awayCaptain`. Admin with 11/11 starters saw a greyed button with no explanation.
  - Fix: wrapper `div` changed from `justify-center` to `flex-col items-center gap-2`. Amber `<p className="text-xs text-amber-400 mt-1">Set a captain for both teams before publishing.</p>` rendered conditionally below button when either captain unset.

- **BACKLOG-094 scoped out** — BACKLOG.md note updated. Eye Point Awards panel on public Timeline was described as "derive from events client-side." Investigation revealed `isEyePoint` is a per-event flag tied to player rating bonuses — award panel on public match page is not a meaningful feature and was explicitly deferred by Richard. No code change.

**Deferred:**
- Full 11-phase staging test match — 14 SHIPPED items still pending verification
- Prod migrations (`current_period`, `own_goals`, `penalties_scored`) — gated behind test match

**Next session:**
1. Run the full 14-checkpoint staging test match (mapped in session 33E conversation — use the one-shot run order)
2. For every phase that passes: DB query → evidence block → SHIPPED → RESOLVED in BACKLOG.md
3. If all pass: run three prod migration statements from TEST_CHECKLIST.md POST-TEST GATE

---

### Session 34 — 2026-06-27

**Focus:** Run the deferred 14-checkpoint staging test match; resolve all SHIPPED items; pre-match admin bug sweep; prod migration confirmation.

**Built / Fixed:**

- **BUG-079 (two-part fix)** — `src/app/admin/competitions/page.tsx`
  - Part 1 (`0d916c2`): `GET /api/competitions/[id]/match-settings` returns `{ settings: [...] }` (array). `handleEditClick` read `data.settings` as a plain object — all fields `undefined`, form always showed defaults. Fix: `Array.isArray(data.settings) ? data.settings[0] : data.settings`.
  - Part 2 (`e5e2b84`): Modal mounts before async fetch resolves — `useState` initialises from `undefined` → defaults, ignores prop update. Fix: `useEffect` in `CompetitionModal` syncs `matchSettings` + `playersOption` whenever `initialMatchSettings` prop changes.

- **BACKLOG-107 / BACKLOG-108 / BACKLOG-109 / BACKLOG-110 filed** — rolling subs test coverage, optional match start time/venue, event timestamps showing regulation ceiling instead of real stoppage minute.

- **Competition match settings wired into Create Match override panel** (`src/app/admin/matches/page.tsx`) — when competition selected, fetches match-settings and shows inherited values summary + updates INHERIT button labels with inherited value (e.g. "inherit (on)").

- **Test match cleanup** — `dev/cleanup-jog-kings-test-match.mjs` — deleted Joga-Bonito vs Kings FC test match (`Kuld3e6xsjLj9amJg4cHx`): 15 events, 2 logger assignments, 1 yellow card stat decremented, match row deleted.

- **Staging test match (14 phases)** — all passed except Phase 6 partial:
  - Phases 1–5, 7–14: ✅ RESOLVED — TD-010, BUG-062/063/065/076/077/078, BUG-044b/045/053/054/055/060, BACKLOG-044 Phase B
  - Phase 6: ⚠️ PARTIAL — subbed-on player missing from general event picker after sub (shows 10 not 11), even after hard refresh. BACKLOG-106 confirmed as the fix path.
  - Phase 11: ✅ PASS — clock face (`getFormattedTime()`) reads `absoluteMinute` raw, no clamp. Clock keeps ticking past ceiling correctly.

**Bugs encountered:**

- Competition sport settings appeared to not save — DB write was correct; both the array→object read shape mismatch AND the async-mount useState initialisation were independently causing the form to show stale defaults. Needed two commits to fully fix.

**Resolved:** BUG-079 (two commits). 14 test match items closed to RESOLVED (see BACKLOG.md). Prod migrations confirmed live on `brixsportv2-brixsports.aws-eu-west-1.turso.io`.

**HAR audit:** 50 failures = 20× 401 `/api/auth/me` (AuthContext on logger page, no cookie — expected, harmless) + 30× WS status 0 (BUG-074, staging WS → prod Railway which was down). Zero unexpected API errors.

**Deferred:**
- BACKLOG-106 (subbed-on player missing from general event picker) — pre-match-day blocker
- BACKLOG-110 (event timestamps show 45' not 47' during stoppage) — displayMinute Math.min clamp
- BACKLOG-109 (optional start time/venue on match creation)
- BACKLOG-108 (rolling subs test coverage — separate match required)
- Commit of competition match settings wiring in Create Match modal (pending Richard review)

**Next session:**
1. Fix BACKLOG-106 — `getOnPitchPlayers` must rehydrate subbed-on players from DB events on mount, not just localStorage. After fix, run a sub scenario to verify 11 players shown in general picker after substitution.

---

### Session 35 — 2026-06-29

**Focus:** Fix BACKLOG-106 (subbed-on player missing from general event picker), BUG-080 (no polling fallback on public match page), BUG-075 (logger PWA manifest), test checklist cleanup.

**Built / Fixed:**

- **BACKLOG-106 — two-part fix:**
  - Part 1 (`eb60ec8`): `PlayerSelectionModal` had `filterStartersOnly=true` for every non-sub event. Filter at line 2402 excluded any player not in `starterIds` (original lineup starters). Subbed-on players are never starters — stripped from the general event and assist pickers even though `getOnPitchPlayers` correctly included them. Fix: `filterStartersOnly && !starterIds.has(p.id) && !subbedOnPlayerIds?.has(p.id)` — one line covers all event types (fouls, shots, cards, everything). Assist modal also wired with `subbedOnPlayerIds` — same gap. Red card exclusion fires before this guard — correct.
  - Part 2 (`8e26b84`): Fresh session path (tab close, device switch, AuthContext wipe) — `matchState.events` empty on mount, `subbedOnIds = []`, subbed-on player invisible. Fix: after `MatchStateManager` init, if `clock.period !== NOT_STARTED && events.length === 0`, fetch `GET /api/matches/[id]/events`, map DB rows to `MatchEvent` shape (null snapshots, `minute → absoluteMinute`), call `mergeExternalEvents`. Known gap: DB seed skipped if localStorage has any events (guard is `events.length === 0`) — partial cache won't rehydrate missing events.

- **BUG-080 — polling fallback + toast** (`d186621`, `ef8f9d8`, `064c603`): `/matches/[id]` had no fallback when WS disconnected — page froze on stale data. Fix: `useEffect` polls `GET /api/matches/[id]` via existing `fetchMatchData()` every 10s when `isConnected === false && isLive`. Interval clears on reconnect or unmount. Disconnect fires amber toast once ("Live updates paused — refreshing automatically"), reconnect fires green toast once. `disconnectToastFired` ref prevents toast spam if WS flaps. Live dot stays green — polling is silent fallback. `ToastContainer` + `useToast` wired into match detail page.

- **BUG-075 — logger PWA manifest** (`a76e429`): Logger layout referenced `manifest-admin.json` (start_url `/admin?source=pwa`). A logger installing from `/logger` would launch into `/admin` — inaccessible. Created `public/manifest-logger.json` with `start_url: "/logger?source=pwa"` and `scope: "/logger"`. Logger layout updated. Admin manifest untouched. Scope note: API fetch calls are scope-immune; logger has no deep-links outside `/logger` so scope is safe.

- **TEST_CHECKLIST.md** (`a76e429`): Session 34 phases 1–5, 7–11, 14 ticked RESOLVED. New phases added: Phase 6 BACKLOG-106 three-scenario test (same session / tab close reopen / hard refresh), Phase 12 BUG-080 polling test, Phase 13 BUG-075 iOS install verify. Post-test migration gate removed (already applied session 34). Known Broken section updated.

**Bugs encountered:** None new this session.

**Resolved:** BACKLOG-106 (both paths), BUG-080, BUG-075 — all SHIPPED. Move to RESOLVED after Railway is up and Phase 6/12/13 pass on staging.

**Deferred:**
- Railway WS infra — pay $5 hobby plan or Render/Fly.io free tier. Blocking RESOLVED status on BUG-080 and BACKLOG-106.
- BUG-072 (LOW) — second yellow undo leaves Yellow Card; fix: `undoLastEvent` detects `Red Card (Second Yellow)` and cascades to preceding Yellow for same player
- BACKLOG-104 (MEDIUM) — penalty missed/saved outcomes; no schema change; 3 outcome buttons in logger UI
- BACKLOG-105 — full penalty shootout; separate score columns, PEN_SCORED/MISSED/SAVED event types, public display

**Next session:**
1. Railway decision first — get WS back up
2. Run Phase 6 (three BACKLOG-106 scenarios), Phase 12 (BUG-080 polling), Phase 13 (BUG-075 iOS install) to close all three to RESOLVED
3. Then BUG-072 (second yellow undo cascade) — small scope, one session

---

### Session 36 — 2026-06-29

**Focus:** BUG-072 (second yellow undo cascade), BACKLOG-104 (penalty outcomes), BACKLOG-111 (file), BACKLOG-112 (file)

**Built / Fixed:**

- **BUG-072 — SHIPPED** (`238e4ec`): `handleUndo` in `FootballLogger.tsx` detects `detail === 'Red Card (Second Yellow)'`, finds the preceding Yellow Card for the same player, issues a second DELETE to DB, calls `undoLastEvent()` twice. Partial failure case handled — if Yellow delete fails after Red is deleted, Red is removed from local state before surfacing the alert. No changes to `match-state-manager.ts`.

- **BACKLOG-111 — Filed**: Stat reversion on undo (all event types). Deferred from BUG-072 — decrement logic must mirror POST increment exactly including floor guards, friendly match guard, shootout guard. Scope: `DELETE /api/matches/[id]/events/[eventId]` handler. Build after BACKLOG-104 lands (so PENALTY MISSED/SAVED cases are included).

- **BACKLOG-104 — Architected, IN PROGRESS**: Penalty outcome tracking — full system design confirmed. Three-outcome flow (Scored/Missed/Saved), PenaltySequenceModal Step 2, keeper picker inline-optional, push notifications (PENALTY_SAVED, PENALTY_MISSED), WS broadcast for all three outcomes, stats mapping with explicit null-check on relatedPlayerId. 7 files. No schema change. Build next.

- **BACKLOG-112 — Filed**: Goal Disallowed / Overturned. Mental model documented — distinct from Undo (keeps match narrative, score reverts, push fires). Workaround: Undo covers MVP. Full build deferred until VAR/offside overturns become common.

**Deferred:**
- BACKLOG-104 implementation (next in session)
- BACKLOG-105 (full penalty shootout) — dedicated session, pre-prod blocker before first knockout match
- BACKLOG-106, BUG-080, BUG-075 — awaiting Railway WS to verify SHIPPED status

---

### Session 36 — 2026-06-29 (continued — implementation)

**Focus:** BUG-072 (second yellow undo cascade), BACKLOG-104 (penalty outcomes), BACKLOG-111 (stat reversion on undo), BACKLOG-112 (file only)

**Built / Fixed:**

- **BUG-072 SHIPPED** (`238e4ec`): `handleUndo` in `FootballLogger.tsx` detects `detail === 'Red Card (Second Yellow)'`, finds the preceding Yellow Card for the same player, issues a second DB DELETE, calls `undoLastEvent()` twice. Partial failure case handled. No changes to `match-state-manager.ts`.

- **BACKLOG-104 SHIPPED** (`10d90d7`): Full penalty outcome system — `Penalty Missed` and `Penalty Saved` (already in `FootballEventType` union, never wired). `PenaltySequenceModal` gains keeper picker inline in Step 3 (GKs floated to top, optional/skippable). `onSubmit` passes `keeperId` as `relatedPlayerId`. Stats: Missed → `shotsOffTarget++`; Saved → `shotsOnTarget++` (taker) + `saves++` (keeper, null-checked). Push notifications: `PENALTY_SAVED` and `PENALTY_MISSED` wired through full pipeline — `event-driven-notifier.ts` → `match-notification-service.ts` → `match-event/route.ts`. Keeper shown as headline in Penalty Saved push. PENALTY_SHOOTOUT buttons fixed (`Shot off Target` → `Penalty Missed`, `Save` → `Penalty Saved`). Event feed icons added in `LiveMatchTimeline.tsx` and `MatchTimeline.tsx` (`PENALTY SAVED` amber 🛡️, `PENALTY MISSED` red ❌). `notifiableEvents` updated. 8 files, no schema change. BACKLOG-105 hand-off: shootout buttons currently emit `'Penalty Missed'`/`'Penalty Saved'` — must be renamed to `PEN_MISSED`/`PEN_SAVED` when BACKLOG-105 lands.

- **BACKLOG-111 SHIPPED** (`f44edfa`): Stat reversion on event undo — `[eventId]/route.ts` DELETE handler had no stat revert call at all. Root cause: `decrementPlayerStats` existed in `events/route.ts` (collection route) but was never exported or reachable from `[eventId]/route.ts` (the route FootballLogger actually calls). Self-contained `revertPlayerStat` function added directly to `[eventId]/route.ts`. Switch covers: GOAL, ASSIST, OWN GOAL, PENALTY, PENALTY MISSED, PENALTY SAVED, FOUL, YELLOW CARD, RED CARD, SAVE. All with `Math.max(0, x-1)` floor. Guards: `matchType !== 'friendly'`, `!isPenaltyShootout`. Match fetch moved unconditional, null-guarded on both score-revert and stat-revert paths. `PENALTY SAVED` also reverts keeper `saves--` via `event.relatedPlayerId` (null-checked).

- **BACKLOG-112 Filed**: Goal Disallowed / Overturned — full mental model documented (distinct from Undo: keeps match narrative, score reverts, push fires). Workaround: Undo covers MVP. Deferred.

- **BACKLOG-111 filed** (session planning): stat reversion on undo — filed from BUG-072 scope decision.

**Bugs encountered:** None new this session.

**Resolved:** BUG-072, BACKLOG-104, BACKLOG-111 — all SHIPPED. Move to RESOLVED after staging verification.

**Deferred:**
- BACKLOG-105 (full penalty shootout) — dedicated session, pre-prod blocker before first knockout match. Starting reference: PENALTY_SHOOTOUT button mapping table in session 36 notes.
- BUG-046 (black screen on /matches/[id] from admin session) — needs reproduction + Network tab capture before any code fix
- BUG-011 (718 goals / playerStats corruption) — data surgery session, best done with Railway up

**Next session:**
1. Commit the pending backlog update if not done (BACKLOG-111 SHIPPED)
2. Decide: Railway restoration + staging verification of BACKLOG-106/BUG-080/BUG-075/BUG-072/BACKLOG-104/BACKLOG-111, OR start BACKLOG-105 session
3. If Railway is up: run verification scenarios before touching any new code

---

### Session 37 — 2026-06-29

**Focus:** Bug triage — dead code cleanup (BUG-054), bench tag regression in PenaltySequenceModal (BUG-068), stale backlog audit (BUG-030, BUG-031)

**Built / Fixed:**

- **BUG-054 parent route deleted** (`6c73835`): `DELETE /api/matches/[id]/events` (collection route) took `?eventId` query param — the old undo pattern superseded when `[eventId]/route.ts` was built. Grep confirmed nothing in the UI ever called it. Handler (lines 209–316) and its exclusive `decrementPlayerStats` helper (lines 451–568, ~228 lines total) removed from `events/route.ts`. All top-level imports remain used by GET/POST handlers — zero orphaned imports. The helper used only dynamic `await import('@/db/schema')` inside the function body, leaving no top-level footprint.

- **BUG-068 PenaltySequenceModal fix** (`6c73835`): `PenaltySequenceModal` received correct `homePlayers`/`awayPlayers` via `getOnPitchPlayers` (which includes subbed-on players) but determined "on pitch vs bench" using `attackerStarterIds`/`defenderStarterIds` derived from `lineup.starters` only. Subbed-on players appeared in the list but rendered with the BENCH tag and greyed styling. Fix: added `homeSubbedOnIds`/`awaySubbedOnIds` props (`Set<string>` from `getSubSets(teamId).subbedOnIds`), derived `attackerSubbedOnIds`/`defenderSubbedOnIds` inside modal, built union sets `attackerOnPitchIds = new Set([...attackerStarterIds, ...attackerSubbedOnIds])` and same for defender side. All 6 render sites (3× defender, 3× attacker) updated to use `OnPitchIds`. Step 3 (keeper picker) had no `starterIds` checks — clean. Note: `PlayerSelectionModal` was fixed for the same root cause in BACKLOG-106 (session 35); `PenaltySequenceModal` was a missed second instance.

- **BUG-030 / BUG-031 closed as stale** (`6c97c03`): Both bugs (competitions/[id] 404, raw logo string in standings) were already resolved in the codebase — redirect exists at `competitions/[id]/page.tsx`, `<TeamLogo>` used at all 5 sites in `standings/page.tsx`. Backlog entries closed.

**Bugs encountered:** None new.

**Resolved:** BUG-054 (dead code deleted), BUG-068 (PenaltySequenceModal — both known instances now fixed), BUG-030/031 (stale closure).

**Deferred:**
- Railway WS restoration — blocks RESOLVED status on BACKLOG-106, BUG-080, BUG-075, BUG-072, BACKLOG-104, BACKLOG-111
- BACKLOG-105 (full penalty shootout) — dedicated session, pre-prod blocker before knockout matches
- BUG-046 (black screen on /matches/[id] from admin) — needs Network tab reproduction first
- BUG-011 (718 goals / playerStats corruption) — data surgery, needs Railway

**Next session:**
1. Railway decision — restore ($5/mo) or switch to Render/Fly.io free tier
2. Once Railway up: run verification phases 6/12/13 to close BACKLOG-106, BUG-080, BUG-075, BUG-072, BACKLOG-104, BACKLOG-111 to RESOLVED
3. Then BACKLOG-105 (penalty shootout) — dedicated session

---

### Session 37 (continued) — 2026-06-29

**Focus:** /code-review + /feature audit on sessions 33–37 output; critical fix triage; BACKLOG-105 architecture

**Built / Fixed:**

- **`revertPlayerStat` try/catch + Sentry** (`6feb3e5`, `1924f26`): BACKLOG-111 introduced `revertPlayerStat` in `[eventId]/route.ts` without a try/catch — if the stat DB write failed after event deletion, the outer catch block returned 500. Event was already deleted. Logger saw a false failure and might retry a now-missing event. Root cause: the original `decrementPlayerStats` had `// Don't throw` guard explicitly; the rewrite dropped it. Fix: wrap entire function body in try/catch. Added `Sentry.captureException(error, { extra: { playerId, eventType, sport } })` in the catch — `console.error` alone only reaches Vercel function logs, not Sentry dashboard. Sentry confirmed wired: `@sentry/nextjs@10.56.0` in package.json, `sentry.server.config.ts` reads `SENTRY_DSN`, `global-error.tsx` already calls `captureException`. Sentry import added to `[eventId]/route.ts`.

- **Second yellow WS broadcast fix** (`6feb3e5`): `handleUndo` in `FootballLogger.tsx` emitted one `event:undo` WS signal for the Red Card deletion only. Yellow Card removal was local-state-only — public viewers saw the Yellow Card persist on the live timeline until next WS message. Fix: after both DB deletes confirm and `undoLastEvent()` is called twice, emit a second `event:undo` with `precedingYellow.id` and updated state.

- **isPenaltyShootout guard — non-issue confirmed**: Review flagged this as a potential gap (career stats written during shootout for Penalty Missed/Saved types). Reading `events/route.ts:173` confirmed the guard `!isPenaltyShootout` already gates ALL `updatePlayerStats` calls including new types. No fix needed.

- **TEST_CHECKLIST phases 15/16/17** (`1924f26`): BUG-072, BACKLOG-104, BACKLOG-111 had no verification phases — only listed as "OPEN/LOW" in Known Broken. Added Phase 15 (second yellow cascade), Phase 16 (penalty outcomes), Phase 17 (stat reversion), each with exact DB check steps. All 6 SHIPPED items now have test phases (6/12/13/15/16/17).

- **BACKLOG-105 architecture finalised** (no code this session — Railway gate + sim timing): 7-file scope confirmed. Key decisions: SQL atomic increment (`COALESCE + 1`, eliminates read-modify-write race), SQL direct migration (db:push blocked by BACKLOG-040), `match:score:updated` WS payload extended with optional `shootoutHomeScore?`/`shootoutAwayScore?` (backward compatible — existing listeners ignore absent fields), separate `shootoutScore` state on public page. Event types unchanged — `period` column differentiates shootout events at query time. BACKLOG-113 filed (simplified shootout modal UX, ~40 lines, deferred).

- **BUG-011 decision framework documented**: Path A (read-only audit, `dev/audit-player-stats.mjs`) must run before any backfill. Backfilling BUSA match events without auditing first recreates BUG-011 exactly — that's how it was originally created.

**Bugs encountered:** None new.

**Resolved this session:** `revertPlayerStat` critical gap (false 500 + silent stat drift), second yellow WS broadcast gap, Sentry capture gap.

**Deferred:**
- BACKLOG-105 full build — Railway must be up first; build + verify in same session as the 6 SHIPPED items
- BUG-011 Path A audit — one read-only session, no writes until after sim closes SHIPPED items
- BACKLOG-113 (simplified shootout modal) — deferred until after first live shootout feedback
- Two-logger conflict — operational workaround doc not yet written

**Next session:**
1. Railway decision — restore or switch to Render/Fly.io
2. Once Railway up: BACKLOG-105 build (7 files, SQL direct migration staging first)
3. Sim run — Phases 6/12/13/15/16/17 + BACKLOG-105 verification — close all 7 to RESOLVED
4. BUG-011 Path A audit in parallel or after sim

**ARCHITECTURE CORRECTION (same session):** BACKLOG-105 mental model had a career stats leak risk. Original plan reused `'Penalty'`/`'Penalty Missed'`/`'Penalty Saved'` event types during shootout, relying solely on `isPenaltyShootout` guard to block stat writes. Rule confirmed: shootout goals/saves do not count toward career stats (FIFA standard). Corrected design uses distinct `'PEN_SCORED'`/`'PEN_MISSED'`/`'PEN_SAVED'` types — `updatePlayerStats` switch has no case for these → `default: return` → zero stat writes, no guard needed, no leakage possible. ShootoutModal promoted from BACKLOG-113 deferred item into core BACKLOG-105 scope — 10+ rapid kicks during live match require simplified UI (team → taker → outcome), not the full PenaltySequenceModal. File delta updated to 8 files (new `ShootoutModal.tsx` component). BACKLOG-113 absorbed.

---

### Session 38 — 2026-06-29

**Focus:** Last test match cleanup + notification system audit and full wire-up

**Built / Fixed:**

- **Test match cleanup (`EOWw93XEolhP83o1LOJGl`):** Audited last Joga-Bonito vs Kings FC test match (FINISHED, 1-0, 11 events). Reverted 5 player stat entries (Justin Onyeka goals/shotsOnTarget, Samuel Olapite assists, McAnthony Uzowuru fouls×2, Japheth Oseiegbu saves, Michael Oguntola shotsOffTarget). Match fully deleted from DB. Scripts: `dev/audit-jog-kings-s38.mjs`, `dev/cleanup-jog-kings-s38.mjs`, `dev/delete-match-s38.mjs`.

- **BUG fix — `homeTeamId`/`awayTeamId` in notification payload (`8b95d35`):** `event-driven-notifier.ts` was setting both `homeTeamId` and `awayTeamId` to `event.teamId` (the scoring team only). Away team subscribers never received push notifications. Root cause: notifier is a window singleton initialized via side-effect import with zero match context — it only receives match data through `MATCH_NOTIFICATION_TRIGGER` CustomEvent payload. Fix: `match-state-manager.ts` `triggerNotification()` now includes `homeTeamId: this.state.homeTeamId` and `awayTeamId: this.state.awayTeamId` in the dispatch detail. Notifier reads them from event detail instead of duplicating `event.teamId`. Also fixed `teamName` being set to `event.playerSnapshot?.teamId` (an ID) instead of `event.playerSnapshot?.name`.

- **MATCH_START / HALF_TIME / MATCH_END push triggers wired (`a9fed4b`):** All three period transition notifications were defined in `match-notification-service.ts` but never dispatched. Fix: `transitionStatus()` in `match-state-manager.ts` now calls `triggerPeriodNotification(to)` after every period change. Only `FIRST_HALF` → `MATCH_START`, `HALF_TIME` → `HALF_TIME`, `FINISHED` → `MATCH_END` produce a dispatch — all other periods (`SECOND_HALF`, `EXTRA_TIME_*`, `PENALTY_SHOOTOUT`, `ABANDONED`) fall through to `null` and return early. Notifier updated with `handlePeriodEvent()` that handles the `periodEventType` shape alongside existing match event shape — same queue, same retry pipeline.

**Architecture note (singleton pattern):** `EventDrivenNotifier` has no constructor context. All match data must flow through `MATCH_NOTIFICATION_TRIGGER` CustomEvent `detail`. Any future match context the notifier needs must be added to the dispatch payload, not the instantiation call.

**Full notification status post this session:**
- Goal / Penalty scored → ✅ both teams notified
- Red Card → ✅ both teams notified  
- Penalty Saved / Missed → ✅ both teams notified
- MATCH_START → ✅ wired (`a9fed4b`)
- HALF_TIME → ✅ wired (`a9fed4b`)
- MATCH_END → ✅ wired (`a9fed4b`)

**Permission prompt path for verification:** SettingsOverlay as a viewer account (not PushNotificationDebugger). Must also follow one of the two test teams to receive event pushes.

**Deferred:**
- Test sim run (Phases 6/12/13/15/16/17) — Railway is up, fresh match needed from admin
- BACKLOG-105 (full penalty shootout) — next dedicated session
- BUG-011 Path A audit

**Next session:**
1. Create fresh test match in admin → assign logger → run Phases 6/12/13/15/16/17
2. Verify push fires via SettingsOverlay subscription on a viewer account following one of the teams
3. BACKLOG-105 build if sim completes cleanly

---

### Session 38C (Wrap) — 2026-06-29

**Focus:** HAR + console log audit of live HT staging match; full WS + notification system failure-mode audit; bug filing and fix ordering.

**No code committed this session — audit and triage only.**

**HAR Ground Truth (viewer + logger, 2026-06-29 HT match):**

- Viewer HAR: 1142 entries, 33 WS connections.
  - WS[9]–[18]: 10 successful connections. 3× `match:subscribe` per connect confirmed (subscribe storm — BUG-089).
  - WS[19]–[28]: 10× `Unexpected response code: 404` from 14:30–14:32 — Railway ~2m40s restart window. Both viewer and logger exhausted 5 reconnect attempts and required page reload.
  - WS[29]+: Recovery 14:37.
- Logger HAR: 1103 entries, 18 WS connections.
  - ~100+ `PATCH /api/matches/.../loggers` calls — all 200 except 2 during Railway window. Route is healthy; prior "missing route" note was a false finding.
  - 24 events logged (all 201). `status=0` events at 10:55 and 11:00 → reappeared as 201 = SW offline queue drain confirmed working.
  - `GET /api/auth/me` returns 401 for logger — expected by design (cookie-based, logger uses localStorage).
  - `PATCH /matches/.../{"currentPeriod":"HALF_TIME"}` → 200 confirmed.

**False findings from session 38 summary corrected:**
1. "PATCH /loggers 404 = missing route" — DISPROVED. ~100 successful PATCH calls; 2 failures during Railway outage only.
2. "Logger auth/me 401 = bug" — EXPECTED. Logger tokens in localStorage, not cookies. Design by intent.
3. "Room rejoin on reconnect missing" — DISPROVED. `useMatchSubscription` has `isConnected` in dep array → auto-resubscribes. Always was correct.
4. "reconnect_failed event" — WRONG. Actual code in `useWebSocket.tsx:95–103` counts `connect_error` events manually and calls `sharedSocket?.disconnect()` at attempt 5. Socket.IO `reconnect_failed` event is never listened to. Any fix must target the `connect_error` count path.

**Notification system full trace:**
Complete pipeline: logger event → `MATCH_NOTIFICATION_TRIGGER` CustomEvent → `EventDrivenNotifier` → `POST /api/notifications/match-event` → audience query (userFollows + userFavorites + users.favoriteTeamId) → `webpush.sendNotification()` → browser SW push handler → notification display.

Pipeline is structurally complete. Delivers zero notifications in practice because `pushSubscriptions` table is always empty — no enrollment UI exists (BUG-084).

Additional breaks in the pipeline even if a subscription existed:
- Dedup key includes `Date.now()` → dedup never works (BUG-085)
- `sentCount=0` logged as success (BUG-086)
- `GET /api/notifications` event query uses `'GOAL'` (uppercase) but events stored as `'Goal'` (title case) → always 0 rows (BUG-088)
- `PATCH /api/users/follows` / GET / POST / DELETE have no auth guard (BUG-081, BUG-082)
- `userFavorites` query no `.limit()` (BACKLOG-115)

**Bugs filed this session:** BUG-081 through BUG-090
**Backlog items filed:** BACKLOG-114, BACKLOG-115, BACKLOG-116
**Accepted risks:** NOTIF-12 — offline notification queuing is a production-level concern; accepted at MVP with handful of viewers. No action item.

**Fix order established:**
1. BUG-081/082 — auth guards on `/api/users/follows` (CRITICAL security, 4 handlers, ~4 lines each)
2. BUG-083 — normalize type before switch in LiveMatchTimeline (`type.toUpperCase().replace(/\s+/g, '_')`)
3. BUG-080 — reconnect CTA: add `reconnectFailed` boolean to SocketContext, persistent "tap to retry" banner
4. BUG-084 — push enrollment UI: "Enable Notifications" button in SettingsOverlay
5. BUG-085 — remove `_${Date.now()}` from notifier dedup key
6. BUG-089 — subscribe storm dedup: module-level Set, skip emit if already subscribed on current socket ID
7. BUG-086/087/088 — notifier observability, favorites race, GET fabrication / type casing
8. BUG-074 — staging Railway URL (existing)
9. BACKLOG-105 — penalty shootout full implementation

**Next session:**
1. Commit uncommitted working tree (`page.tsx`, `LiveMatchTimeline.tsx`, agent files)
2. Fix BUG-081/082 (4 auth guards on `/api/users/follows` GET/POST/PATCH/DELETE)
3. Fix BUG-083 (normalize type string before switch in `LiveMatchTimeline.tsx`)
4. Deploy to staging, verify with Railway up: Phase 12 (silent poll + amber toast), Phase 15 (second yellow cascade)
5. If Railway stable: BUG-084 push enrollment UI

---

### Session 38 — 2026-06-29 (continued)

**Focus:** Public viewer page WS/polling fixes, player name fallback, event dedup, period labels

**Built / In Progress (NOT committed — carrying to next session):**

- **Silent polling (IN PROGRESS — `src/app/matches/[id]/page.tsx`):** `fetchMatchData` now accepts `silent = false` param. Polling interval and reconnect calls pass `silent=true` — no `setLoading(true)` during background refreshes. Eliminates full-page spinner every 10s during WS outage.

- **Reconnect sync (IN PROGRESS — `src/app/matches/[id]/page.tsx`):** New `useEffect` watches `isConnected` false→true transition and calls `fetchMatchData(true)` once — pulls missed events from DB silently on WS restore.

- **Event dedup fix (IN PROGRESS — `src/app/matches/[id]/page.tsx`):** `latestEvent` dedup now checks `type + minute + playerId + teamId` combo in addition to `id`. Fixes duplicate timeline entries caused by dual broadcast paths — logger `event:log` carries temp state-manager ID, API POST broadcast carries permanent DB ID, both arrived as separate `event:new` signals and both passed the old `id`-only check.

- **Player name fallback in LiveMatchTimeline (IN PROGRESS — `src/components/LiveMatchTimeline.tsx`):** All player name reads now fall back through `event.player?.name → event.playerSnapshot?.name → event.playerSnapshot?.jerseyName`. DB-fetched events carry nested `player` object; WS events from `match-state-manager` carry `playerSnapshot` instead — mismatch caused blank names on real-time events before hard refresh. Added `playerSnapshot` and `playerId`/`teamId` to `Event` interface.

- **Period labels updated (IN PROGRESS — `src/app/matches/[id]/page.tsx`):** `1ST HALF → H1`, `2ND HALF → H2`, added `SUSPENDED → SUSP`. `NOT_STARTED`, `PENDING`, `UPCOMING` intentionally not mapped — viewer shows start date for those states, not a period badge. `POSTPONED` label deferred (status not yet wired).

**Root cause notes logged this session:**
- Dual broadcast paths (logger `event:log` + API `broadcastMatchEvent`) produce two `event:new` signals per event with different IDs — dedup by ID alone is insufficient
- `LiveMatchTimeline` uses `event.player?.name` (DB shape) but WS events carry `event.playerSnapshot?.name` (state manager shape) — both shapes must be handled client-side
- `fetchMatchData(setLoading=true)` during 10s polling caused full content replacement — viewer experience broken on WS failure

**Phase 15 (second yellow cascade) — Railway WS was down during test (404). Red Card writes to DB correctly but broadcast fails on both paths (socket not connected + Railway HTTP endpoint down). Shows on hard refresh, not real-time. NOT a logic regression. Needs Railway up to close as RESOLVED.**

**Deferred to next session:**
- Commit all above changes after final review
- Phase 15 re-verify with Railway up
- WS reconnect after `reconnect_failed` — manual retry CTA (persistent button after exhausted retries, not a toast)
- Amber toast investigation (may not fire if `isConnected` never transitions true→false during session)
- Phase 16, 17 full verification
- BACKLOG-105 (penalty shootout)

**Next session:**
1. Deploy current uncommitted changes to staging
2. Re-run Phase 12 (polling — verify silent, no refresh, amber toast fires)
3. Re-run Phase 15 with Railway up
4. Commit + close SHIPPED items to RESOLVED with DB evidence
5. BACKLOG-105 if time allows

---

### Session 38C — 2026-06-30

**Focus:** Fix BUG-081/082 (no auth on follows route), BUG-083 (Yellow Card icon never renders), systemic logger cookie bleed (BACKLOG-118), root-cause auth bug for logger-role users in users table.

**Built / Fixed:**

- **BUG-081/082 RESOLVED — `src/app/api/users/follows/route.ts`** (commits `1a98902`, `8f282b0`)
  - All 4 handlers (GET/POST/DELETE/PATCH) now call `getAuthUser` + 401 guard
  - GET: returns only the requesting user's follows (ownership enforced via `resolveEffectiveUserId`)
  - POST/DELETE/PATCH: `effectiveId !== userId && role !== 'admin'` → 403
  - Used `resolveEffectiveUserId()` for ownership checks so logger-with-fan-account resolves to their `users` table ID

- **BUG-083 SHIPPED (visual verify pending) — `src/components/LiveMatchTimeline.tsx`**
  - Root cause: `type.toUpperCase()` on `'Yellow Card'` produces `'YELLOW CARD'` (space preserved); switch cases use underscores (`'YELLOW_CARD'`). No case ever matched.
  - Fix: all 3 switch normalizations changed to `type.toUpperCase().replace(/\s+/g, '_')` — in `getEventIcon()`, `getEventColor()`, `getEventDescription()`
  - Case labels `'PENALTY SAVED'`/`'PENALTY MISSED'` updated to `'PENALTY_SAVED'`/`'PENALTY_MISSED'`

- **BACKLOG-118 — Logger cookie bleed fix — 4 routes patched** (commits `8f282b0`, `ec15246`)
  - Root cause: `authToken` cookie set with `path: '/'` → bleeds into all viewer-app routes. Logger's JWT carries their `loggers` table ID, not a `users` table ID — so DB queries for `userFavorites`/`userFollows` keyed to `users.id` always return empty (400 no match, not 401).
  - `resolveEffectiveUserId(authUser)` helper added to `src/lib/auth.ts`: if `role !== 'logger'` → return `authUser.id`; if logger → look up fan account in `users` by email, return that ID (fallback to original ID)
  - Applied to: `follows/route.ts`, `favorites/route.ts`, `teams/[id]/follow/route.ts`, `notifications/route.ts`

- **Auth fallback fix — `src/lib/auth.ts`** (commit `0ea32be`)
  - Root cause: `users` table has some accounts with `role='logger'` (users who also work as loggers and registered via the viewer login path). `getAuthUser()` branches on `role === 'logger'` and queries the `loggers` table — ID not found there → returns null → 401.
  - Fix: if `loggers` table lookup misses, fall through to `users` table lookup instead of returning null. Logger-role users in the users table now resolve correctly.

- **BACKLOG-117 filed** — SSO as the long-term fix for the dual-identity problem (logger account + fan account with same email → one unified account). Descoped to future work.
- **BACKLOG-118 filed + updated to SHIPPED** — logger cookie bleed: root cause, affected routes, fix approach, pending items all documented.

**Commits:**
| Hash | Scope | Description |
|------|-------|-------------|
| `1a98902` | `fix(auth)` | BUG-081/082 — auth guards on follows route + logger email bridge |
| `8f282b0` | `fix(auth)` | Logger cookie bleed — resolveEffectiveUserId across all viewer-app user-scoped routes |
| `0ea32be` | `fix(auth)` | getAuthUser fallback: logger-role user in users table falls through to users table lookup |
| `ec15246` | `chore(backlog)` | BACKLOG-118 → SHIPPED; BUG-081/082 → RESOLVED; BACKLOG-117 filed |

**Bugs encountered:**
- Logger with `role='logger'` in `users` table (registered via viewer path) gets `getAuthUser` returning null — `loggers` table branch runs but ID isn't there, no fallback. Fix: `if (logger) return ...; // else fall through`. Confirmed by decoding JWT payload (role='logger', userId matches users table not loggers table).
- HAR showed `cookies: []` on the follows request — initially suspected cookie not being sent. Root cause: httpOnly cookies are NEVER shown in HAR exports (browser security). Cookie was present and being sent correctly. SW (`sw-user.js`) was intercepting the console's network fetch but the actual API requests had full cookie access.

**tsc status:** Exit code 1 — all pre-existing errors in `src/db/` scripts and several route files (`admin/news`, `squads`, `ratings`, basketball routes, etc.). Zero new errors introduced this session.

**Deferred:**
- BACKLOG-118 live verification: retry `fetch('/api/users/follows?userId=...', { credentials: 'include' })` on staging post-`0ea32be` deploy — should now return 200
- BUG-083 visual verification: open match timeline with Yellow/Red Card events — should show correct coloured icons
- BUG-080 verification: polling fallback with Railway WS down — explicitly deferred to Session 38D

**Next session (38D):**
1. ~~BACKLOG-118 live verify~~ — RESOLVED `a84ddec` (DB confirmed, `user_follows` empty on staging = correct 200)
2. Diagnose viewer-app UI issue (reported broken at end of 38C — root cause unknown, investigate first)
3. BUG-083 visual check: navigate to match with yellow card events → icon must render (not blank)
4. BUG-080 verification: kill Railway WS → confirm silent poll every ~10s, amber "Updating" banner appears, reconnect sync fires on restore

### Session 38D — 2026-06-30

**Focus:** BUG-080 reconnect discipline (two root causes fixed), live clock UX overhaul (isStale indicator, mm:ss), BUG-083 completion on MatchTimeline.tsx, formal read-only verification of 38C claims (Directives 1-5).

**Built / Fixed:**

- **BUG-080 — Reconnect discipline** (`74ca73b`)
  - Root cause 1: `isLiveStatus` check in polling effect (line 163) and toast effect (line 181) used `=== 'LIVE' || === 'HALF_TIME'`. WS timer effect in `page.tsx` overwrites `match.status` with `matchTime.period` (e.g. `'SECOND_HALF'`) on each tick — so both effects exited early during SECOND_HALF, neither polling nor toast ever fired.
    Fix: `LIVE_STATES` Set of 7 live-ish period values moved to module scope; both effects now use `LIVE_STATES.has()`.
  - Root cause 2: `sharedSocket?.disconnect()` was called at `connect_error` attempt 5. This permanently killed Socket.IO internal reconnect loop — on Railway return, nothing retried.
    Fix: `disconnect()` call removed from `connect_error` handler. Added `reconnect_failed` listener with 30 s manual retry loop (`reconnectAttempts = 0; sharedSocket?.connect()`).
  - `src/hooks/useWebSocket.tsx` — useMatchTimer return changed from raw time to `{ time, isStale }`. `isStale=true` on disconnect, `false` on next tick. `time` never nulled on disconnect — preserves last-known minute.
  - `src/components/LiveMatchStatus.tsx` — reads `{ time: matchTime, isStale }`. Stale state: `opacity-50` on badge/default, dot loses `animate-pulse`. Shows frozen clock, never drops to bare DB period label on transient hiccup.
  - `src/app/matches/[id]/page.tsx` line 51 — `const { time: matchTime } = useMatchTimer(matchId)` (return shape change cascade fix).
  - Wrong initial fix rejected: `setTime(null)` on disconnect caused `53'` to `2ND HALF` flicker on brief hiccup — UX regression. Corrected to isStale flag.

- **BUG-083 — MatchTimeline.tsx normalization** (`efb0081`)
  - `1c7a6f3` (38C) patched `LiveMatchTimeline.tsx` only. `MatchTimeline.tsx` was missed — confirmed via grep showing bare `toUpperCase()` at lines 31, 65, 95.
  - `src/components/MatchTimeline.tsx` lines 31, 65, 95: `.replace(/\s+/g, '_')` added to all three switch normalizations. `PENALTY_SAVED`/`PENALTY_MISSED` case labels corrected. `RED_CARD_(SECOND_YELLOW)` added to icon/color switches and cards filter.
  - Parity gap identified (NOT fixed this session): `LiveMatchTimeline.tsx` has no `RED_CARD_(SECOND_YELLOW)` case at lines 63, 98, 248. Needs own scoped directive.

- **mm:ss clock (NOT committed — pending live render check)**
  - Directive 4 (read-only trace): WS server is a pure passthrough. Logger runs `setInterval(tick, 1000)` in `match-state-manager.ts` line 268. `FootballLogger.tsx` line 558 emits `match:time:update` with `second` field in payload. `useMatchTimer` was discarding `second`.
  - `src/hooks/useWebSocket.tsx` — `useMatchTimer` state type extended to include `second: number`. `handleTimeUpdate` stores `data.second ?? 0`.
  - `src/components/LiveMatchStatus.tsx` — `clock = \`${minute}:${String(second).padStart(2, '0')}\`` renders in active-play and ET cases.
  - Scope gap: `page.tsx` line 394 renders its own clock via `matchTime.minute` directly — still bare minute. Deferred.

**Directive 2 — 38C formal verification verdicts:**

| Item | Verdict |
|---|---|
| BUG-083 LiveMatchTimeline.tsx | CONFIRMED — commit 1c7a6f3, diff verified |
| BUG-083 MatchTimeline.tsx | NOT CONFIRMED (unpatched — fixed this session efb0081) |
| BUG-081/082 auth guards | SHIPPED in code; live-tested by Richard |
| getAuthUser logger fallback | SHIPPED in code; live-tested by Richard |
| resolveEffectiveUserId x4 | SHIPPED in code; live-tested by Richard |
| Scope outside 4 files | CLEAR — transfers/route.ts:176 is audit-only |

**Commits:**
| Hash | Scope | Description |
|------|-------|-------------|
| `74ca73b` | `fix(realtime)` | Preserve last-known clock minute on WS disconnect; BUG-080 reconnect fixes |
| `efb0081` | `fix(ui)` | BUG-083 complete normalization in MatchTimeline.tsx |

**Bugs encountered:**
- `LIVE_STATES` initially defined inside component after early returns — effects at 163/181 referenced it before scope. Fixed: moved to module scope.
- Return shape change `useMatchTimer` cascaded TS errors to `page.tsx` line 51. Fixed: destructured as `const { time: matchTime }`.
- Known-issues entry 2026-06-29 (line 15) stated `reconnect_failed` is never emitted — was true only because `disconnect()` prevented it from firing. Now obsolete after `disconnect()` was removed. Entry corrected.

**tsc status:** Zero new errors. Pre-existing errors in `src/db/` scripts and several unrelated route files unchanged.

**Uncommitted at wrap:**
| File | Change | Why held |
|---|---|---|
| `src/hooks/useWebSocket.tsx` | `second` stored in useMatchTimer state | mm:ss needs live render check |
| `src/components/LiveMatchStatus.tsx` | mm:ss clock render | UX change, needs visual verify on staging |

**Deferred:**
- BUG-080 Railway-down staging verify: amber toast fires, silent poll every 10 s, reconnect recovery on WS restore
- BACKLOG-119 full visual verify: HT label red, FT neutral
- BUG-083 staging visual verify: Yellow Card yellow icon, Red Card red icon — both MatchTimeline and LiveMatchTimeline
- LiveMatchTimeline.tsx `RED_CARD_(SECOND_YELLOW)` parity fix (scoped directive needed)
- page.tsx line 394 mm:ss (match detail header clock, separate render path from LiveMatchStatus)
- Formal evidence blocks for BUG-081/082, getAuthUser, resolveEffectiveUserId (Richard confirmed live-tested; BACKLOG still SHIPPED not RESOLVED)
- BUG-091 (favourite heart optimistic UI — no write confirmed)
- BUG-092 (undo not clearing viewer timeline — no `match:event:deleted` WS broadcast)

**Next session (38E):**
1. Commit mm:ss after visual check on staging (home page cards show `53:09` not `53'`)
2. Fix `page.tsx` line 394 — mm:ss in match detail header clock
3. Fix `LiveMatchTimeline.tsx` `RED_CARD_(SECOND_YELLOW)` parity
4. Write formal evidence blocks for BUG-081/082, getAuthUser, resolveEffectiveUserId
5. BUG-080 Railway-down staging verify

---

### Session 38E (Branch) — 2026-07-01

**Note:** This was a branch/side session — no new features or fixes shipped. Dedicated implementation work resumes in Session 39.

**Focus:** Full system architecture documentation, Eye Point design critique, BrixSports domain positioning, staging CORS fix, notification pipeline audit.

**Built / Fixed:**

- **ARCHITECTURE.md — created** (`.agents/dev/ARCHITECTURE.md`)
  - Full system architecture document covering all 12 subsystems: infrastructure topology, actor model, database layer, auth architecture, API surface (~110 routes), real-time architecture (5-layer full breakdown with Directive 6 clock risks embedded), PWA/SW, notification pipeline, frontend architecture, Three Critical Flows, and known structural gaps (18 open items).
  - Generated from full codebase read: `server.js`, `match-state-manager.ts`, `useWebSocket.tsx`, `schema.ts`, `auth.ts`, `notifications/*`, `sw-admin.js`, full API route listing, BACKLOG.md, and BUILD_JOURNAL.md sessions 27–38D.

- **server.js — CORS staging fix** (uncommitted)
  - Added `'https://staging.brixsports.com'` to the explicit allowlist.
  - Added `isVercelPreview = origin?.endsWith('.vercel.app')` wildcard check — covers all PR preview deployments automatically without needing per-deploy env vars.
  - Root cause: Railway WS server CORS allowlist never included staging domain or Vercel preview URLs → WS blocked on staging → Flow B/C untestable on staging. Filed as BUG-074 previously; now patched.
  - **Needs Railway redeploy to take effect.**

**Design decisions documented:**

**Eye Point Awards — table is redundant**
- `eye_point_awards` table (in `schema-enhanced.ts`) duplicates data already in `matchEvents`: `matchId`, `playerId`, `loggerId` (awardedBy), `detail` (reason), `createdAt` (timestamp), `isEyePoint: boolean`.
- Decision: the `isEyePoint` flag on `matchEvents` is the correct model. `WHERE isEyePoint = true AND matchId = X` serves all use cases. The separate table is a second source of truth for the same fact — an integrity risk.
- Eye Points as a concept are sound — they capture qualitative impact (individual brilliance, carries, key duels) that doesn't map to a discrete event. But under manual logging, they're constrained: a logger can't track granular actions AND flag brilliance simultaneously, so Eye Points are biased toward on-ball moments the logger is already watching. Fine as a rating bonus signal (`+0.5 per eye point`). Not worth schema overhead.
- Eye Points feed into player ratings. Highest rating → MotM. They are NOT Man of the Match — they influence it.

**BrixSports domain positioning**
- Domain map: Physical tracking (Second Spectrum/AWS) → Event data providers (Opta/Stats Perform) → Intelligence layer (StatsBomb/Oracle) → Grassroots loggers (Hudl Assist/Fanatix) → Fan-facing livescore (SofaScore/FlashScore).
- BrixSports sits at the intersection of **grassroots logger + fan-facing livescore**, with an aspirational reach toward a light analytics layer (rating system, Eye Points, player performance tracking).
- Key architectural moat: **contextual depth over horizontal breadth**. SofaScore is wide/shallow. Opta is infrastructure. BrixSports is deep in one context (BUSA League, Nigerian university sports) — which unlocks things horizontal platforms can't build: fan communities that know these players, push for matches that matter to this specific audience, ratings calibrated to this league.
- **Manual logging ceiling:** current system captures Tier 1 Opta data (basic match facts — goals, cards, subs, fouls by minute). Everything above (possession chains, pressing intensity, xG, carry progression) requires computer vision or a dedicated per-match analyst with specialised software. The rating system is a good heuristic within this ceiling — but the right future question is "what data can we realistically collect at this tier?" not "how do we improve the formula?"
- When the core system is locked in: audit the event taxonomy first. Event type strings are currently inconsistent (spaced vs underscored — BUG-083 territory). A canonical, exhaustive taxonomy for Football and Basketball is the foundation everything analytical sits on.

**Notification pipeline — DB confirmed findings (2026-07-01):**

Live prod DB query (`dev/check-push-subscriptions.mjs`) returned:

| # | user_id | provider | created_at |
|---|---------|----------|------------|
| 1 | H3pwXW_u3B7XAm0nnD4d1 | Apple Push (iOS Safari) | 1780651633 |
| 2 | uBM_X1MbuQuzhczxGbgNN | Apple Push (iOS Safari) | 1780578862 |
| 3 | admin-001 | FCM (Android/Chrome) | 1771813665 |

3 real subscribers on prod. Pipeline is live. BUG-084 ("no enrollment UI, table always empty") was a false finding — retracted. Enrollment UI confirmed in SettingsOverlay, OnboardingModal, and NotificationPermission. BUG-085 (dedup key) is the active issue.

Separately: staging test match fired a real VAPID push to prod subscribers because VAPID keys were shared across environments. Root cause: `notification:global` on shared Railway WS + shared VAPID private key in Vercel env vars. VAPID keys rotated on staging (2026-07-01). Prod rotation pending (no Vercel dashboard access). `JWT_SECRET` generated separately for staging (`openssl rand -hex 32` via Node crypto). Filed as BUG-074 expansion. `.env.example` updated to remove real keys and document per-env key requirement.

**Addendum (2026-07-01):** The notification content was confirmed as "Yanko scored a goal" — player-specific text matching the GOAL VAPID payload template (`${event.playerName} scores! ...`). This rules out the WS toast path (which carries no player name). The recipient was on an **iPad** — confirming it was one of the 2 Apple Push (`web.push.apple.com`) subscribers, not the FCM/Android subscriber (admin-001). VAPID delivery through Apple's push infrastructure confirmed end-to-end.

**Commits:**
- None this session (architecture doc + CORS fix — CORS needs Railway redeploy before committing is meaningful).

**Deferred (carried from 38D + this session):**
- Commit `server.js` CORS fix and trigger Railway redeploy
- Commit mm:ss (`useWebSocket.tsx` + `LiveMatchStatus.tsx`) after visual check
- Fix `page.tsx` line 394 — mm:ss in match detail header clock
- Fix `LiveMatchTimeline.tsx` `RED_CARD_(SECOND_YELLOW)` parity
- Formal evidence blocks for BUG-081/082, getAuthUser, resolveEffectiveUserId
- BUG-080 Railway-down staging verify (amber toast, silent poll, reconnect recovery)
- Remove redundant `eye_point_awards` table (or leave in schema-enhanced.ts as non-production — confirm which schema is live first)
- CRITICAL open: PATCH [eventId] open spread, score-before-delete ordering, loggerId public leak, BUG-085 dedup key, BUG-089 subscribe storm

**Next session (39 — first dedicated implementation session):**
1. Confirm server.js CORS on Railway — staging WS smoke test
2. Commit mm:ss after visual check
3. Fix PATCH [eventId] open spread (CRITICAL security)
4. Fix score-before-delete in DELETE [eventId] (CRITICAL data integrity)
5. Strip loggerId from GET /events public response (CRITICAL NDPR)

---

### Session 39 — 2026-07-01

**Focus:** Stability close before backfill break. ARCHITECTURE.md surgical patches, four Tier-0 event-route fixes, session docs, clean working tree.

**Built / Fixed:**

- **ARCHITECTURE.md patches (5)** — `.agents/dev/ARCHITECTURE.md` — commit `0bd7fa8`
  - Patch 1: JWT rotation note (auth section) — corrected claim: staging/prod use separate `JWT_SECRET`; loggers and admins within an env share one secret (not separate per role — false claim in original directive caught and corrected before execution)
  - Patch 2: BUG IDs annotated inline on Auth/Security gap table rows (BUG-093, BUG-094, BUG-095, BUG-083)
  - Patch 3: Two new Real-Time/Clock gap rows (BUG-074 shared Railway WS, no mutation audit trail) — BUG-074 fix description corrected to "dedicated staging Railway service" not env-prefixed room names (rejected approach per Session 38E)
  - Patch 4: Push enrollment section corrected — stale "not yet built" heading updated, BUG-084 gap table row struck RESOLVED, push subscriptions scale gaps subsection added
  - Patch 5: Two new Data Integrity gap rows (basketball stats unverified, `fixtures` table relationship undocumented)

- **BUG-093 RESOLVED** — `fafab3a` — `src/app/api/matches/[id]/events/[eventId]/route.ts`
  - PATCH handler replaced open `...updates` body spread with explicit allowlist: `type`, `minute`, `second`, `teamId`, `playerId`, `relatedPlayerId`, `detail`, `period` only. `matchId`, `loggerId`, `createdAt`, `isEyePoint`, `id` immutable.
  - No active UI caller of PATCH `[eventId]` exists — zero regression risk confirmed by grep.

- **BUG-094 RESOLVED** — `358ee05` — same file
  - DELETE handler: `db.delete()` now runs before score revert. If delete throws, catch returns 500 before revert executes. Score integrity preserved on DB failure path.
  - Bundled in same commit: BUG-083 normalization applied to `revertPlayerStat` switch — `.toUpperCase().replace(/\s+/g, '_')` + underscore case labels.

- **BUG-095 RESOLVED** — `4c73aba` — `src/app/api/matches/[id]/events/route.ts`
  - Auth-aware `loggerId`/`loggerName` strip. Intermediate commit `b6d3112` (unconditional strip) caught breaking `FootballLogger.tsx:466` logger seed path and `useMultiLogger.ts:141` conflict detection — corrected before push.
  - Public callers: fields stripped. Authenticated callers: full row returned.

- **BUG-083 (route files) RESOLVED** — `57b5bc8` — `src/app/api/matches/[id]/events/route.ts`
  - POST scoring and `updatePlayerStats` Football switch: `.toUpperCase().replace(/\s+/g, '_')` normalization applied, case labels converted to underscore form. Basketball switch untouched (different taxonomy, title-case format intentional).

- **server.js CORS fix** — `abdc684`
  - `staging.brixsports.com` added to allowlist. Vercel preview wildcard (`origin?.endsWith('.vercel.app')`) added. Railway redeploy required to take effect.

- **mm:ss changes REVERTED** — `src/components/LiveMatchStatus.tsx`, `src/hooks/useWebSocket.tsx`
  - Decision: revert before break. Two visible inconsistencies would have shipped: badge shows `45:32`, header still shows `45'`; polling fallback resets seconds to `00` each 10s cycle. Full mm:ss wiring is a clean one-session job — do it whole after break.

**Session doc commits:**
- `0bd7fa8` — ARCHITECTURE.md patches + CLAUDE.md readiness checklist update + .env.example key rotation docs + architecture plan doc

**Bugs filed this session:** none (all filing was done in sessions 38C–38E)

**Known issues from this session:**
- `b6d3112` (intermediate BUG-095 commit) exists in history as a superseded wrong approach — superseded by `4c73aba`. History is slightly noisy but final state is correct.
- BUG-095 pending: curl verify on staging that unauthenticated GET `/events` strips loggerId correctly.
- BUG-094 pending: live undo test on staging to confirm score reverts in correct order.
- server.js CORS requires Railway redeploy — commit is in, effect is pending.

**7 commits ahead of origin/dev at wrap:** `fafab3a`, `358ee05`, `b6d3112`, `57b5bc8`, `4c73aba`, `abdc684`, `0bd7fa8`

**Next session (post-backfill — Session 40):**
1. Push dev branch to origin
2. Railway redeploy — confirm staging WS connects (BUG-074 CORS fix live)
3. Staging smoke test: curl GET `/events` unauthenticated — confirm no loggerId in response (BUG-095 evidence)
4. Staging undo test — confirm score reverts correctly (BUG-094 evidence)
5. Full mm:ss live clock wiring — one session, whole feature: `LiveMatchStatus.tsx`, `useWebSocket.tsx`, `page.tsx` header, polling fallback handling, visual verify
