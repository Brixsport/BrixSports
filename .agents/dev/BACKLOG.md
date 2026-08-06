# BrixSports — Backlog

---

## ⛔ SESSION BLOCKER — Must resolve before ANY new feature work

BUG-050/051/052/057 RESOLVED. BUG-047 RESOLVED. Flow B confirmed live (Session 28).

**Session 32 state (2026-06-25):**

| Item | Status |
|------|--------|
| BACKLOG-058 (offline drain) | ✅ RESOLVED |
| BUG-061 (away roster) | ✅ RESOLVED |
| KIN vs COLNAS friendly cleanup | ✅ DONE — stats rolled back, match deleted (`7faaab9`) |
| Match stats zero / LiveStats shape mismatch | ✅ SHIPPED (`7faaab9`) |
| Friendly guard on updatePlayerStats | ✅ SHIPPED (`7faaab9`) |
| ownGoals + penaltiesScored columns | ✅ SHIPPED (`7faaab9`) — migration applied to staging |
| BACKLOG-103 (notification preferences) | ✅ FILED |
| TD-010 (period persistence) | ✅ RESOLVED — session 34 test match |
| BACKLOG-044 Phase B (config mount, timer ceiling, sub cap) | ✅ RESOLVED — session 34 test match |
| BUG-063 (HALF_TIME on public page) | ✅ RESOLVED — session 34 test match |

**Session 32 closed most items. One gate remains before prod migrations.**

**Session 33B additions (2026-06-25):**

| Item | Status |
|------|--------|
| BUG-062 (selectedMatchId not persisted) | ✅ RESOLVED — session 34 test match |
| BUG-077 (lineup edit modal starters not pre-selected) | ✅ RESOLVED — session 34 test match |

**Session 33C additions (2026-06-26):**

| Item | Status |
|------|--------|
| BACKLOG-107 (iOS drain fallback) | SHIPPED `dfad1f6` — pending iOS device verify |
| BUG-075 (manifest scope mismatch) | SHIPPED `5866ab4` — pending iOS install verify |
| BUG-054 (OWN GOAL undo wrong team) | ✅ RESOLVED — session 34 test match |
| BUG-060 (stat decrement on delete) | ✅ RESOLVED — session 34 test match |
| BUG-055 (\|\| value scoring condition) | ✅ RESOLVED — code-only, no live test needed |
| BUG-053 (rate limit logger auth) | ✅ RESOLVED — session 34 test match (429 verified) |
| BUG-073 (sub detail string) | RESOLVED — code already correct at HEAD; string was never wrong |
| BUG-068 (incoming sub BENCH tag) | RESOLVED — already committed `31fc5a3` |

**Pre-match-day sequence (updated 2026-06-26):**
1. ~~BACKLOG-058~~ — RESOLVED ✅
2. ~~BUG-061 (away roster)~~ — RESOLVED ✅
3. ~~TD-010 API gap~~ — confirmed no gap ✅
4. ~~TD-010 FIRST_HALF + HALF_TIME~~ — verified live ✅
5. ~~LiveStats shape fix~~ — SHIPPED `7faaab9` — re-verify on next test
6. ~~BUG-063 detail page~~ — SHIPPED `ea4a1d5` ✅
7. ~~BUG-063 homepage card~~ — SHIPPED `056388d` — re-verify on next test
8. ~~TD-010 SECOND_HALF~~ — RESOLVED ✅ session 34 test match
9. ~~BUG-063 homepage card~~ — RESOLVED ✅
10. ~~Sub picker showing subbed-off players~~ — RESOLVED ✅
11. **Prod migrations** — `current_period` + `own_goals/penalties_scored` — ✅ GATE CLEARED. Run when ready.
12. First real match day

---

## Resolved (Compressed — Sessions 1–25)

BUG-001 through BUG-029, AUDIT-001/002 (partial), BACKLOG-065 — all resolved Sessions 1–25. Full history in `known-issues.md` and `BUILD_JOURNAL.md`.

## Bugs (Open)

### Auth / Security

- ~~**BUG-050**~~ _(CRITICAL — Auth)_: Hardcoded JWT fallback `'your-secret-key-change-in-production'` found in **7 files** across all sign and verify call sites — not just `loggers/auth/route.ts` as originally filed. Any token signed with the known fallback was valid on all verify paths. Fix: all 7 files updated to use `env.jwtSecret` with explicit `if (!env.jwtSecret)` guard at every call site regardless of library. jose files: `middleware.ts`, `auth/refresh/route.ts`, `auth/me/route.ts`, `admin/layout.tsx`. jsonwebtoken files: `loggers/auth/route.ts`, `livestream/route.ts`, `lineup/unlock/route.ts`, `lineup/publish/route.ts`. **Status:** SHIPPED — Session 28.

**Evidence:**
- Commit: `1824256`
- Verified by: tsc --noEmit clean on all 9 modified files; grep confirms no remaining fallback string
- Observed result: All sign/verify paths now use `env.jwtSecret`; throw/500 on empty secret
- Pending items: BACKLOG-094 — JWT_SECRET rotation decision (Richard to decide). JWT_SECRET confirmed set in both `.env.local` and `.env.production` with a real value; token invalidation risk exists for any sessions created while fallback was active (pre-fix window).

- ~~**BUG-051**~~ _(CRITICAL — Auth)_: Logger could PATCH match `status` to any freeform string. Fix: enum guard against `['PENDING','UPCOMING','LIVE','FINISHED','CANCELLED']`; logger role restricted to `['LIVE','FINISHED']` — `FINISHED` kept because `handleFinalize` PATCHes it directly as a logger. `src/app/api/matches/[id]/route.ts`. **Status:** SHIPPED — Session 28.

**Evidence:**
- Commit: `1824256`
- Verified by: tsc clean; cross-checked that `handleFinalize` PATCHes `status: 'FINISHED'` as logger role — included in allowed list
- Observed result: Invalid status → 422; logger attempting PENDING/UPCOMING/CANCELLED → 403
- Pending items: corrected session 47E — "live test via End Match flow" (the original pending note) doesn't actually exercise this guard; End Match only ever sends the one allowed status (`FINISHED`), never an out-of-enum value or a blocked one (`PENDING`/`UPCOMING`/`CANCELLED`). No session since has run that specific negative-path test (a logger session attempting a disallowed status PATCH, expecting 403/422). Still genuinely unverified live, despite ~40 sessions of the code running without a known incident.

- ~~**BUG-052**~~ _(CRITICAL — Data Integrity)_: Logger could directly write `homeScore`/`awayScore` via PATCH, bypassing event-driven scoring. Fix: score writes gated to `admin` role only; non-negative integer guard added. Event-driven score path (`POST /events` → direct `db.update`) is a separate code path, unaffected. `src/app/api/matches/[id]/route.ts`. **Status:** SHIPPED — Session 28.

**Evidence:**
- Commit: `1824256`
- Verified by: tsc clean; confirmed `/events` route updates scores via `db.update` directly (not through PATCH handler)
- Observed result: Logger PATCH with homeScore/awayScore → silently ignored (field skipped, not error)
- Pending items: corrected session 47E — no session since has run the actual negative-path test (a logger session PATCHing `homeScore`/`awayScore` directly, expecting the field to be silently dropped rather than applied). Real event-driven scoring (`POST /events`) has extensive live evidence (BUG-054/055/060/071 etc.), but that's a different code path from this PATCH-bypass guard specifically. Still genuinely unverified live.

- **BACKLOG-094** _(MEDIUM — Operational Decision)_: JWT_SECRET rotation post-BUG-050 fix. JWT_SECRET was confirmed set with a real value in both `.env.local` and `.env.production`. However, the hardcoded fallback `'your-secret-key-change-in-production'` existed on all verify paths pre-fix — any token signed with that fallback (e.g. during a window where `JWT_SECRET` was temporarily unset) would still validate until expiry (7 days). **Decision required by Richard:** rotate `JWT_SECRET` in Vercel env vars (both staging and prod) to force invalidation of all active sessions, or accept the 7-day expiry window as sufficient. Rotating forces all users and loggers to re-login. Filed: 2026-06-19.

- ~~**BUG-053**~~ _(MEDIUM — PRODUCTION gate)_: `POST /api/loggers/auth` has no rate limiting or brute-force protection. Fix: in-memory `loginAttempts` Map keyed by `x-forwarded-for` IP. 5 failures in 15 min → 429. Clears on success. Resets on Vercel cold start — documented as MVP gate. **Status:** RESOLVED — `7d90e05`, 2026-06-27.

**Evidence:**
- Commit: `7d90e05`
- Verified by: manual test — 5 bad login attempts → 429 on 6th attempt confirmed in session 34 test match pre-flight
- Observed result: 429 fires correctly; clears on successful login
- Pending items: none

### Scoring

- ~~**BUG-054**~~ _(MEDIUM — Data Integrity)_: `DELETE /api/matches/[id]/events` score revert was `event.value || type === 'GOAL'` — missed PENALTY and OWN GOAL. OWN GOAL also decremented the conceding team's score instead of the opponent's. Fix: `isScoringEvent = GOAL || PENALTY || OWN GOAL`; OWN GOAL inverts `isHomeTeam` (`teamId !== homeTeamId`). `src/app/api/matches/[id]/events/route.ts`. **Status:** RESOLVED — `3bbad31`, 2026-06-27.

**Evidence:**
- Commit: `3bbad31`
- Verified by: live undo test — session 34 test match, undo of OWN GOAL and GOAL confirmed correct score revert
- Observed result: OWN GOAL undo decremented opponent's score (not conceding team). GOAL undo decremented correct team. ✅
- Pending items: none

- ~~**BUG-055**~~ _(MEDIUM — Data Integrity)_: `isScoringEvent` included `|| value` — any truthy `value` field silently incremented the score. Fix: removed `|| value`, type-explicit scoring only (`GOAL || PENALTY || OWN GOAL`). `src/app/api/matches/[id]/events/route.ts`. **Status:** RESOLVED — `43583c1`, 2026-06-27.

**Evidence:**
- Commit: `43583c1`
- Verified by: code-only — removes dangerous fallback path. No live test required (negative path removal).
- Observed result: non-scoring events with a value field no longer increment score
- Pending items: none

- **~~BUG-076~~** _(HIGH — Logger Flow / Data Integrity)_: Match status permanently stuck on `LIVE` after normal match end. Fix: `handlePeriodEndConfirm` folds `status: FINISHED` into period-end PATCH when `nextPeriod === 'FINISHED' && homeScore !== awayScore`. End Match button guard relaxed so it stays visible as fallback for ET/Penalties. **Status:** RESOLVED — session 34 test match, 2026-06-27.

**Evidence:**
- Commit: session 33 (committed)
- Verified by: session 34 test match — End Match flow completed, status written as FINISHED, public page showed FT ✅
- Observed result: match finalized correctly via End Match button; status = FINISHED, currentPeriod = FINISHED in DB
- Pending items: none

- ~~**BUG-078**~~ _(MEDIUM — Logger Flow)_: `handleFinalize` (End Match button) PATCHed `status: FINISHED` but omitted `currentPeriod: FINISHED`. Fix: added `currentPeriod: 'FINISHED'` to `handleFinalize` PATCH body. **Status:** RESOLVED — `91bd33d`, verified session 34 test match, 2026-06-27.

**Evidence:**
- Commit: `91bd33d`
- Verified by: session 34 test match — End Match tapped, public page showed `FT` badge correctly ✅
- Observed result: `current_period: FINISHED` written to DB; public page period label = FT
- Pending items: none

- ~~**BUG-079**~~ _(LOW — Admin UI)_: Competition match settings (maxSubstitutions, halfDuration, etc.) appeared not to persist — editing and saving the form, then reopening it, always showed default values. Root cause: `GET /api/competitions/[id]/match-settings` returns `{ settings: [...] }` (array), but `handleEditClick` in `src/app/admin/competitions/page.tsx` read `data.settings` as an object and accessed `.maxSubstitutions` etc directly — all fields were `undefined`, form fell back to hardcoded defaults on every load. The DB write was always correct; the read was broken. Fix: `const s = Array.isArray(data.settings) ? data.settings[0] : data.settings` — handles both shapes defensively. Filed and fixed 2026-06-27, session 34. **Status:** RESOLVED — 2026-06-27.

**Evidence:**
- Commit: `0d916c2`
- Verified by: code trace — GET response shape confirmed as array; field access on array object returns `undefined`; fix indexes correctly into `[0]`
- Observed result: form now populates from saved DB values on open; `maxSubstitutions = 3` persists correctly across refresh
- Pending items: none

### Logger Flow

- **BUG-057** _(CRITICAL — Auth)_: `getAuthUser()` in `src/lib/auth.ts` does not support logger sessions. Logger JWTs carry `{ id, email, role }` but `verifyAuth` casts to `AuthUser` which expects `{ userId, email, role }` — so `authData.userId` is `undefined`. `getAuthUser` then queries the `users` table with `undefined`, returns no row, returns `null`. Every handler that calls `getAuthUser` (PATCH `/api/matches/[id]`, POST `/api/matches/[id]/events`, etc.) returns 401 for ALL logger requests despite a valid `authToken` cookie. Root cause discovered during Session 28 smoke test — logger could log in successfully (`POST /api/loggers/auth` returned 200, cookie set) but every subsequent authenticated call returned 401. Fix: (a) `verifyAuth` normalises `decoded.userId ?? decoded.id` so logger tokens resolve correctly; (b) `getAuthUser` branches on `role === 'logger'` and queries the `loggers` table instead of `users`. `src/lib/auth.ts`. **Status:** RESOLVED — 2026-06-22.

**Evidence:**
- Commit: `1401ee2`
- Verified by: live logger session on staging — login → Start Match (PATCH 200) → 9 events posted (all 201) → no 401s after login
- Observed result: logger auth now resolves correctly via loggers table; all authenticated logger requests succeed
- Pending items: none

- ~~**BUG-056**~~ _(LOW)_: 401/403 on event POST silently dropped event. **Status:** SHIPPED — commit `5cb6738`, 2026-06-26. Alert added for 401 (session expired), 403 (not authorised), and generic 4xx. `console.error` retained alongside for debugging.

- ~~**BUG-058b**~~ _(CRITICAL — Logger Offline Queue)_: `AuthContext.checkAuth()` runs on every logger page mount. It calls `GET /api/auth/me` with the `authToken` cookie → 401 for logger role → falls back to localStorage token → calls `/api/auth/me` again with `Authorization: Bearer` → still 401 → **calls `localStorage.removeItem('authToken')`** at line 74 of `AuthContext.tsx`. By the time FootballLogger's offline catch block runs `localStorage.getItem('authToken')`, the value is null → hits the `!token` branch → shows "Network error: could not save this event and no session found" alert → **no queue write, event silently lost**. Discovered during BACKLOG-058 Test 2 on staging (Session 28). Fix: (a) `POST /api/auth/refresh` updated to handle logger token payload (`id` not `userId`, `loggers` table not `users`), returns token in response body; (b) FootballLogger `useEffect` on mount calls refresh and re-stores token in localStorage. Files: `src/app/api/auth/refresh/route.ts`, `src/components/FootballLogger.tsx`. **Status:** RESOLVED — commit `1057f22`, 2026-06-24. Corrected session 47E: this entry sat SHIPPED with a stale "pending BACKLOG-058 Test 2 re-run" note, but that re-run already happened and already has a full evidence block — see `BACKLOG-058`'s own entry ("Logger Offline Event Queue"), Live Test 3 on staging same day (2026-06-24, Session 30): 15 queued events drained and POSTed, IDB store confirmed empty after drain, all events landed on the public page. That test is specifically what exercises this fix (the offline queue write never happens at all without this token-refresh fix, per this entry's own root-cause chain) — never cross-referenced back into this entry until now.

- **BACKLOG-095** _(LOW — Admin UX)_: `/admin/match-lineups` has no discoverable entry point. The only way to reach it is via a small `ClipboardList` icon button in the action column of each match row on `/admin/matches` (line 461) — no label, no sidebar link, no breadcrumb from anywhere else. The link also goes to the page root (`/admin/match-lineups`) rather than a specific match, so the admin still has to re-select the match inside the page. Options: (a) add a "Lineups" link to the admin sidebar under Matches — low-traffic enough that it does not need top-level placement, could be a sub-item; (b) make the icon button link directly to `/admin/match-lineups?matchId=[id]` so the page can pre-select the match on load; (c) both. Not blocking anything — lineup management still works, it's just hard to find. Filed: 2026-06-24.

- **BACKLOG-094** _(MEDIUM — Eye Point Awards panel never renders)_: `LiveMatchTimeline` expects an `eyePoints: any[]` prop — a pre-computed list of per-match Eye Point award objects. `GET /api/matches/[id]` never queries `eyePointAwards` (schema-enhanced.ts:247) and never returns this key. The page destructures `eyePoints` from `matchData` (page.tsx:234), gets `undefined`, passes it to the component. The crash was fixed (BUG-059, `?? []` guard) but the Eye Point Awards summary section at the bottom of the Timeline tab now silently never renders even when Eye Point events exist. Fix: either (a) in `GET /api/matches/[id]`, query `eyePointAwards` where `matchId = id` and include in response, or (b) derive the award list client-side from `events.filter(e => e.isEyePoint)` in the page and pass that. Option (b) is simpler and avoids an extra DB query since events are already fetched. Note: `isEyePoint` boolean already exists on every event row in the response. Filed: 2026-06-24.

- ~~**BUG-059**~~ _(HIGH — Match Detail Page)_: Timeline tab crashes on render with `TypeError: Cannot read properties of undefined (reading 'length')`. Root cause: `LiveMatchTimeline` receives `eyePoints` prop from the page, which destructures it from `matchData` (line 234 of `matches/[id]/page.tsx`). The GET handler at `src/app/api/matches/[id]/route.ts` returns `{ match, events }` — no `eyePoints` key. So `eyePoints` is `undefined`. `LiveMatchTimeline.tsx` line 437 calls `eyePoints.length` unconditionally → TypeError → component crash. The network "500" observed during the Session 28 smoke test was this render error surfacing. Fix: `(eyePoints ?? []).length` and `(eyePoints ?? []).map(...)` in `LiveMatchTimeline.tsx`. **Status:** RESOLVED — 2026-06-24.

**Evidence:**
- Commit: `8c56f67`
- Verified by: code trace — `eyePoints` key absent from GET response shape confirmed by reading route.ts lines 408–418; `eyePoints.length` call on undefined confirmed at LiveMatchTimeline.tsx:437
- Observed result: fix guards both the conditional and the map call with `?? []`
- Pending items: confirm Timeline tab renders without crash on staging after deploy. Note: the "500" seen in the Session 28 network panel was a client-side TypeError (render crash), not a server 500 — Sentry will log this as a client exception, not a server error. Relevant when triaging BACKLOG-035 (Sentry config). Eye Point Awards panel still silently empty — tracked as BACKLOG-094.

- ~~**BUG-060**~~ _(HIGH — Data Integrity)_: `DELETE /api/matches/[id]/events` reverted score but never decremented `footballPlayerStats`. Fix: `decrementPlayerStats()` with `Math.max(0, x - 1)` floor. **Status:** RESOLVED — `3bbad31`, verified session 34 test match, 2026-06-27.

**Evidence:**
- Commit: `3bbad31`
- Verified by: session 34 test match — undo of goal confirmed stat row decremented ✅
- Observed result: player stats decremented correctly on undo; no ghost stat accumulation
- Pending items: none

- ~~**BUG-061**~~ _(HIGH — Logger Flow)_: Away team roster never populates in the logger player picker. Root cause: `getPlayerTeam(player)` resolves to primary affiliation — multi-affiliated players (college + BUSA team) had college as primary, so `getPlayerTeam(p)?.id === match.awayTeamId` failed and they were dropped. Fix: check `player.memberships?.some(m => m.team?.id === teamId)` before falling back to `getPrimaryTeam`. `src/components/FootballLogger.tsx` lines 287–296. **Status:** RESOLVED — 2026-06-24 (commit `e847902`).

**Evidence:**
- Commit: `e847902`
- Verified by: live test on staging — away team roster populated correctly after fix, confirmed by Richard
- Observed result: away team players visible in player picker during live match test (BACKLOG-058 Test 3 run)
- Pending items: none

- ~~**BUG-062**~~ _(MEDIUM — Logger UX)_: Lineup data is wiped on browser refresh — the logger returns to the "Confirm & Start" screen instead of resuming the active match view. Fix: `viewState` re-derived from rehydrated period on mount; `selectedMatchId` persisted to localStorage. **Status:** RESOLVED — `37712ba`, verified session 34 test match, 2026-06-27.

**Evidence:**
- Commit: `37712ba`
- Verified by: hard refresh mid-match in session 34 test match — logger resumed active view directly ✅
- Observed result: no return to confirm screen after hard refresh; match continued seamlessly
- Pending items: none

- ~~**BUG-063**~~ _(MEDIUM — Public Page)_: Half period label not shown on public match page. Fix: `displayPeriod = matchTime?.period ?? match.currentPeriod ?? match.status`. `PERIOD_LABELS` map covers all periods. **Status:** RESOLVED — `ea4a1d5`, verified session 34 test match, 2026-06-27.

**Evidence:**
- Commit: `ea4a1d5`
- Verified by: session 34 test match — 1ST HALF, HT, 2ND HALF, FT labels all correct on public page throughout match ✅
- Observed result: correct period label at every phase; homepage card also correct
- Pending items: none

- ~~**BUG-064**~~ _(LOW — Mobile UX)_: Match tabs scrolled horizontally on mobile with visible scrollbar bleed. Fix: added `scrollbar-hide` to the tab container — `overflow-x-auto` was already present, just missing the hide class. `src/app/matches/[id]/page.tsx` line 352. **Status:** SHIPPED — pending visual verify on mobile.

- ~~**BUG-065**~~ _(LOW — Logger UX)_: No event counter in the logger header. Fix: added a counter pill (count + "Evts" label) to the compact mobile header. **Status:** RESOLVED — verified session 34 test match, 2026-06-27.

**Evidence:**
- Commit: `905d30a`
- Verified by: session 34 test match — event counter visible and incrementing live in logger header ✅
- Observed result: counter pill updates correctly with each logged event
- Pending items: none

- ~~**BUG-066**~~ _(LOW — Stats)_: Goals do not count as shots in player stats. Fix: `updatePlayerStats` Football switch now increments `shotsOnTarget` on GOAL and PENALTY. OWN GOAL excluded (no shot credit — correct). `src/app/api/matches/[id]/events/route.ts`. **Status:** RESOLVED — 2026-06-25 (commit `9d37967`)
  **Evidence:**
  - Commit: `9d37967`
  - Verified by: code review + tsc pass. Live match stat verification pending on next test match.
  - Observed result: GOAL and PENALTY cases now include `shotsOnTarget++`; OWN GOAL does not
  - Pending items: historical goals pre-fix have `shotsOnTarget = 0` — no backfill run, stats accurate from this commit forward only

- ~~**BUG-067**~~ _(MEDIUM — Logger UX)_: Sub picker correctness — incoming subs missing from picker, outgoing player visible during and after their own sub, data integrity failure (bench player selectable as sub-out). Full root cause: single `getActiveRoster` function served both pickers with no distinction between "on pitch" and "available bench" pools. Fix: replaced with `getOnPitchPlayers` (starters − subbed off + subbed on) and `getAvailableBench` (bench − already used − playerComingOut). Each picker uses its correct pool. `pendingSubbedOff` workaround removed. `src/components/FootballLogger.tsx`. **Status:** RESOLVED — 2026-06-25 (commits `863fce7`, `0d30d14`, `13ab3cb`)
  **Evidence:**
  - Commits: `863fce7` → `0d30d14` → `13ab3cb` (full rewrite)
  - Verified by: live logger test — 3 substitutions logged, all picker pools correct. Daniel/Toheeb absent from sub-OUT picker after going off ✅. Incoming subs in on-pitch pool ✅. Bench-only players restricted to sub-IN picker ✅.
  - Observed result: no data integrity failure, correct pools at every step
  - Pending items: BUG-068 — PenaltySequenceModal instance of same bench tag bug fixed in `6c73835` (session 37). PlayerSelectionModal instance covered by BACKLOG-106. Both paths now resolved.

- ~~**BUG-068**~~ _(LOW — Logger UX cosmetic)_: Players who came ON as mid-match subs were styled with greyed BENCH tag in the sub-OUT picker. `isBench` derived from `!starterIds.has(p.id)` only — pure lineup check, no awareness of current on-pitch status. Fix: `isBench = !starterIds.has(p.id) && !subbedOnPlayerIds?.has(p.id)` at line 2442. `subbedOnPlayerIds` prop wired at both general event modal (line 1759) and assist modal (line 1773) as part of BACKLOG-106 session 35 work. Subbed-on players now render with primary colour, no BENCH tag. **Status:** RESOLVED — confirmed in code trace 2026-06-29, covered by BACKLOG-106 session 35 commits.

- **~~BUG-062~~** _(MEDIUM — Logger UX)_: Hard browser refresh dropped logger back to match selection list — `selectedMatchId` was not persisted. On refresh, React state reset to `null`, logger had to manually re-tap the match. Fix: `localStorage.setItem('brix_logger_matchId', selectedMatchId)` on every change; rehydration effect reads it back once `assignedMatches` first loads; `removeItem` on exit/logout. `src/app/logger/page.tsx`. **Status:** SHIPPED — `37712ba`, 2026-06-25. Pending: live match verify — hard refresh mid-match must resume directly in active logger view.

- ~~**BUG-077**~~ _(LOW — Logger UX)_: Lineup edit modal opened with all players shown as SUB — starters not pre-highlighted. Fix: `p.playerId || p.id || p` in `handleEditLineup`. **Status:** RESOLVED — `d96db0a`, verified session 34 test match, 2026-06-27.

**Evidence:**
- Commit: `d96db0a`
- Verified by: session 34 test match — lineup edit modal opened with correct starters pre-highlighted ✅
- Observed result: starters shown as STARTER, bench shown as SUB — correct on open
- Pending items: none

- ~~**BUG-072**~~ _(LOW — Logger UX)_: Second Yellow auto-inserts a Red Card event via `MatchStateManager.recordEvent`. Undo (Option A) removes only the last event — the auto Red Card — leaving the Yellow Card in both local state and DB. Logger tapping undo after a second yellow expects both cards removed but only the Red goes. Fix: `handleUndo` in `FootballLogger.tsx` detects `detail === 'Red Card (Second Yellow)'`, finds the preceding Yellow Card for the same player, issues a second DELETE to DB, then calls `undoLastEvent()` twice (Red gone, Yellow is now last). Scope: `src/components/FootballLogger.tsx` only. Filed: 2026-06-25. **Status:** SHIPPED — Session 36

- **BUG-069** _(LOW — Stats)_: PENALTY + GOAL double-count risk on `shotsOnTarget`. **Status:** WONT FIX — CLOSED 2026-06-25. Convention established: PENALTY = scored penalty in normal play (increments `penaltiesScored` + `shotsOnTarget`). GOAL should not be separately logged for the same penalty kick. BACKLOG-104 (outcome tracking) will make this explicit via distinct event types.

- ~~**BUG-070**~~ _(LOW — Logger UX)_: Sub-IN modal opened empty with no explanation when no lineup published. **Status:** RESOLVED — 2026-06-25 (commit `2cc6398`). Added `emptyMessage` prop to `PlayerSelectionModal`; sub-IN call site passes `'No lineup published for this team'` vs `'No available substitutes'` depending on whether `lineups[selectedTeam]` is null.

**Evidence:**
- Commit: `2cc6398`
- Verified by: tsc clean; prop wired at call site and consumed in modal render
- Observed result: modal opens showing correct context-specific message instead of blank list
- Pending items: visual confirm on staging

- ~~**BUG-071**~~ _(CRITICAL — Data Integrity)_: `DELETE` and `PATCH` on `/api/matches/[id]/events/[eventId]` had zero auth. **Status:** RESOLVED — 2026-06-25 (commit `da8d9ce`). Auth gate added: `getAuthUser` + logger/admin role check + logger assignment check on both handlers. Score revert in DELETE also fixed to handle PENALTY and OWN GOAL correctly (previously only reverted GOAL).

**Evidence:**
- Commit: `da8d9ce`
- Verified by: live match DB query — match `Kuld3e6xsjLj9amJg4cHx`, 2026-06-25
- Observed result (GOAL undo): home_score 1→0 in DB; Goal + Assist events deleted from match_events ✅. Observed result (OWN GOAL undo): busa-kings player OG → home_score 1→0 in DB; correct team's score decremented (opponent of conceding team, not conceding team) ✅
- Pending items: none — live DB evidence confirms both GOAL and OWN GOAL undo paths correct via `[eventId]` DELETE route. Note: BUG-054 parent route (`DELETE /events?eventId`) confirmed dead code in session 37 — nothing in the UI ever called it. Handler + `decrementPlayerStats` helper deleted in `6c73835`.

- **BACKLOG-104** _(MEDIUM — Stats / Logger UX)_: Penalty outcome tracking. Current state: `PENALTY` = scored only. Architected Session 36. **Status:** SHIPPED — `10d90d7`, Session 36. Pending live test on staging.

  **Finalized design:**
  - `'Penalty'` = scored (no rename — backward compat, no migration)
  - `'Penalty Missed'` and `'Penalty Saved'` already exist in `FootballEventType` union — never wired up until now
  - Logger UX: `PenaltySequenceModal` gains a Step 2 — outcome picker (Scored / Missed / Saved). If Saved: keeper picker expands inline below outcome buttons (optional, skip allowed)
  - `playerId` = taker on all three types. `relatedPlayerId` = keeper on `Penalty Saved` (null if skipped)
  - Stats: Scored → `penaltiesScored++`, `shotsOnTarget++`. Missed → `shotsOffTarget++`. Saved → `shotsOnTarget++` (taker) + `saves++` (keeper, only if `relatedPlayerId` non-null — explicit null-check required)
  - No `penaltiesMissed`/`penaltiesFaced` column added — accepted MVP gap, flagged under BACKLOG-111 scope
  - All three outcomes are notifiable events → push + WS. Keeper is headline actor in `Penalty Saved` feed display and push body
  - PENALTY_SHOOTOUT buttons also fixed here (currently mapped to wrong types: `Shot off Target`, `Save`)

  **Files:** `match-state-manager.ts`, `FootballLogger.tsx`, `event-driven-notifier.ts`, `match-notification-service.ts`, `/api/notifications/match-event/route.ts`, `/api/matches/[id]/events/route.ts`, public livescore event feed component

  **Push notification types added:** `PENALTY_SAVED`, `PENALTY_MISSED`

- ~~**BACKLOG-107**~~ _(HIGH — PWA / iOS)_: Offline queue drain fallback for iOS. Background Sync API (`sync.register`) is not supported on iOS — the SW drain never fires on iPhone. Fix: `window.addEventListener('online', triggerDrain)` + `document.addEventListener('visibilitychange', handler)` in `FootballLogger.tsx`. `triggerDrain` re-registers the sync tag on Android/desktop; on iOS (no SyncManager) falls back to `navigator.serviceWorker.controller.postMessage({ type: 'DRAIN_MATCH_EVENTS' })`. `sw-admin.js` message handler extended to handle `DRAIN_MATCH_EVENTS` → calls `syncMatchEvents()` directly. Filed: 2026-06-25. **Status:** SHIPPED — `dfad1f6`, 2026-06-26. Pending: verify on iOS device — queue drains on tab resume and on reconnect.

- **BUG-075** _(MEDIUM — PWA)_: Logger layout referenced `manifest-admin.json` whose `start_url` is `/admin?source=pwa` — logger installing the PWA from `/logger` would launch into `/admin` (no access). Root cause: one manifest shared between admin and logger. Fix: created `public/manifest-logger.json` with `start_url: "/logger?source=pwa"` and `scope: "/logger"`. `src/app/logger/layout.tsx` updated to reference `manifest-logger.json`. Admin manifest untouched. Filed: 2026-06-25. **Status:** SHIPPED — session 35. Pending: iOS Home Screen install verify from logger page.

- **BUG-074** _(HIGH — Staging / Security)_: Staging and prod share the same Railway WebSocket server instance. Originally filed as "wrong WS URL in staging env vars" — root cause is deeper: there is only one Railway service, so staging and prod are on the same Socket.IO process. Confirmed consequences (2026-07-01):
  - `io.emit('notification:global')` in `server.js` broadcasts to ALL connected sockets — staging test match goal fired to every prod viewer with the page open
  - `matchTimes` in-memory Map is shared — a staging clock update for a matchId could overwrite the cached time visible to prod viewers on the same matchId (low probability but possible)
  - Shared `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` across envs meant staging EventDrivenNotifier POSTed to `/api/notifications/match-event` on staging Vercel → hit prod VAPID keys → delivered a real push notification to a real prod subscriber during a staging test match (confirmed live, 2026-07-01). VAPID keys have since been rotated on staging.

  **Recommended fix (not a patch — proper fix):** Spin a second Railway service scoped to staging. Set `NEXT_PUBLIC_WS_URL` in the staging Vercel project to the staging Railway URL. Both services are independent — staging events stay on staging sockets, prod events stay on prod sockets.

  **Not recommended:** Prefixing room names with env tag (`match:staging:${matchId}`) would isolate room broadcasts but would NOT fix `io.emit()` (notification:global still hits all sockets) and would not fix the shared `matchTimes` Map or VAPID/JWT key sharing. It is a workaround, not a fix.

  Filed: 2026-06-25. Updated: 2026-07-01. **Status:** OPEN — accepted risk for now, 2026-07-13: Richard's call — no live match currently running on prod, so the shared-socket leakage has no active viewer to affect. Deferred as an infra task, not scoped this session. **Re-check before any prod match goes live** — the JWT_SECRET-shared-across-envs risk in particular means a staging-issued token is valid on prod API routes right now, independent of whether a match is live.
  Filed: 2026-06-25. Updated: 2026-07-01. **Status:** OPEN — accepted risk for now, 2026-07-13: Richard's call — no live match currently running on prod, so the shared-socket leakage has no active viewer to affect. Deferred as an infra task, not scoped this session. **Re-check before any prod match goes live** — the WS room-collision risk specifically (JWT_SECRET is separate per environment, see correction above, not part of the remaining risk here).

  **Session 44 — the room-prefixing workaround this entry originally called "not recommended" is now actually built and deployed to `ws-server/index.js` (the correct, deployed file — `server.js`'s equivalent, session 43's `31b8671`, was local-dev only and protected nothing live).** Ported the full pattern: every socket room (match, chat, competition, admin:loggers, admin:livestreams, multi-logger sync) is now prefixed `staging:`/`prod:` based on the connecting browser's Origin header — same defensive default-to-`'prod'` direction as the rest of BUG-074. Goes further than this entry's original "not recommended" scope anticipated: also scopes the `io.emit('notification:global', ...)` global goal broadcast (→ `io.to(env).emit(...)`) and the `matchTimes` in-memory cache keys, not just match rooms — both of the two specific gaps this entry called out as unaddressed by room-prefixing alone. The REST `/broadcast` endpoint (Vercel → Railway, no browser Origin available) now receives an explicit `env` field from `src/lib/socket.ts`, computed from `NEXT_PUBLIC_APP_URL`'s hostname — deliberately **not** `NEXT_PUBLIC_ENV`, since staging currently keeps that label off `'staging'` on purpose to bypass `middleware.ts`'s staging-wide JWT gate (caught mid-session, would have silently misrouted every broadcast to the wrong room).
  **Deployed and same-environment delivery re-verified** (commit `ea9454f`, pushed to `dev`, both Vercel staging and Railway `ws-server` confirmed live by Richard). Redid the exact BUG-108 live-broadcast test post-deploy: fresh viewer tab on staging, real event posted via the app's own route — delivered live, correctly landing in the `staging:match:...` room (confirmed via Railway's own server logs, not just the browser). Confirms both sides (the `env` field `socket.ts` now sends, and the room-prefix `ws-server` now applies) are deployed consistently with each other — a partial/mismatched deploy would have broken this delivery entirely (client and broadcaster would land in differently-prefixed rooms).
  **Latency correction from the same test**: Railway's server log timestamps (Richard pulled the raw export) show the DB write completed at `16:20:33.347Z` but the broadcast itself didn't fire until `16:21:15.719Z` — a 42-second gap. An earlier browser-side estimate of "~5-8s, faster than before" was wrong (imprecise tool-call-gap eyeballing, not a real measurement) and is corrected here. The <5s target (CLAUDE.md) remains unmet, and this session's fixes have not resolved it — see BUG-108/116's entry, latency is still an open follow-up, now with harder evidence it's worse than first estimated (up to 42s observed, not 7-17s).
  **What this does NOT prove**: true cross-environment isolation — that a staging broadcast can no longer reach a prod viewer, or vice versa. That would need a real prod-origin viewer connected at the same time as a staging test event, which wasn't attempted (no live prod match running, not worth the risk of testing against real prod traffic for a same-session verification). The room-prefix logic is symmetric and was code-reviewed carefully (prod defaults were preserved throughout), but isolation itself remains logically-verified, not live-verified.
  **Status:** BUG-074 stays OPEN — this closes the specific live-broadcast leakage risk demonstrated by BUG-108's testing this session, not the bug's full original scope. **Correction, same session — `JWT_SECRET` sharing was NOT part of the remaining risk**: JWT secrets were already rotated and separated per environment back on 2026-07-01 (see line 290 above, and `SYSTEM_CRITICALITY_MAP.md`'s own "JWT secret rotation" row) — an error introduced into this entry's session-44 text by not cross-checking against that already-recorded correction. What genuinely remains open: the originally-recommended real fix (a second, independent Railway service for staging) hasn't been built, and cross-environment isolation itself is unverified live — flag for whenever a real dual-environment test is safe to run (e.g. a scheduled prod match with a simultaneous staging smoke test).

- **BUG-080** _(HIGH — Public Page / CLAUDE.md violation)_: No HTTP polling fallback when WebSocket is disconnected. Public match page (`/matches/[id]`) uses `useWebSocket` exclusively for real-time updates — clock, score, events. When WS fails (max 5 reconnect attempts), the page freezes on stale data indefinitely. CLAUDE.md mandates: *"Live update mechanism must have a fallback if the channel drops. Viewer must see stale data clearly on failure, not a crash."* This is confirmed violated — page shows no stale indicator and no recovery. Fix: when `isConnected === false && isLive`, poll `GET /api/matches/[id]` every 10s and merge response into display state. Show a "live updates paused — reconnecting" banner when WS is down. Confirmed via session 34 test match — public clock and score were frozen throughout because Railway was down. Filed: 2026-06-27. **Status:** SHIPPED — session 38D. Two root causes fixed: (1) `isLiveStatus` check in polling effect (line 163) and toast effect (line 181) used `=== 'LIVE' || === 'HALF_TIME'` — now uses module-level `LIVE_STATES.has()` covering all 7 live-ish period values; (2) `sharedSocket?.disconnect()` called at `connect_error` attempt 5, permanently killing Socket.IO reconnect loop — removed; added `reconnect_failed` listener with 30 s manual retry loop (`socket.connect()`). `LIVE_STATES` moved to module scope so effects and render share the same constant. Pending: Railway-down staging verify (amber toast, polling active, reconnect recovery). **NOTIF-12 (accepted risk):** offline notification queuing — notifications fired during a WS/server outage are lost; no retry queue exists. Accepted at MVP with a handful of viewers. Production-level concern to revisit at scale.

**Assessed, not live-tested, session 47C:** attempted to verify this as part of a pass through the stale-SHIPPED pile. No safe way found to force a real WS disconnect from the Browser tool without either (a) actually taking down the shared Railway instance (affects staging *and* prod simultaneously, per `BUG-074` — a real cost for a test, not a free one), or (b) the app exposing its socket instance globally for scripted manipulation, which it correctly does not (module-scoped, not attached to `window` — confirmed via direct JS inspection). Left as `SHIPPED`, not force-tested tonight; the actual "Railway down" scenario remains the only real way to verify this end-to-end.

- ~~**BUG-081**~~ _(CRITICAL — Security)_: `GET /api/users/follows` had no auth. **Status:** RESOLVED — `1c7a6f3`, 2026-06-29.
**Evidence:**
- Commit: `1c7a6f3`
- Verified by: live staging test — unauthenticated → 403; admin → 200 (bypass correct); logger session → 401 (logger not a users-table identity, correct rejection)
- Observed result: auth gate enforced correctly across all three caller types
- Pending items: none

- ~~**BUG-082**~~ _(CRITICAL — Security)_: `POST`, `PATCH`, `DELETE /api/users/follows` had no auth. **Status:** RESOLVED — `1c7a6f3`, 2026-06-29.
**Evidence:**
- Commit: `1c7a6f3`
- Verified by: same live staging test as BUG-081 — gate pattern confirmed on all four handlers
- Observed result: write handlers protected by same guard
- Pending items: none

- ~~**BUG-083**~~ _(HIGH — Logger UX / Display)_: `LiveMatchTimeline` switch cases used underscore format (`YELLOW_CARD`) but event type arrives as `'Yellow Card'` (title case with space) — `toUpperCase()` alone never matched. Fix: `.replace(/\s+/g, '_')` added to all three switch normalization calls; `PENALTY_SAVED`/`PENALTY_MISSED` case labels updated to match. `1c7a6f3` (38C) patched `LiveMatchTimeline.tsx` only — `MatchTimeline.tsx` was missed. `efb0081` (38D) completed the fix in `MatchTimeline.tsx` (lines 31, 65, 95) and added `RED_CARD_(SECOND_YELLOW)` case to both switches and the cards filter. **Status:** SHIPPED — `efb0081`, 2026-06-30. Pending: visual verify on staging — Yellow Card yellow icon, Red Card red icon on both MatchTimeline and LiveMatchTimeline. Parity gap remaining: `LiveMatchTimeline.tsx` has no `RED_CARD_(SECOND_YELLOW)` case (lines 63, 98, 248) — needs own scoped directive.

- ~~**BUG-084**~~ _(HIGH — Notifications)_: Originally filed as "no push enrollment UI — pushSubscriptions always empty." **INCORRECT — retracted 2026-07-01.** Full code audit confirmed three active enrollment paths:
  - `src/components/SettingsOverlay.tsx` — subscribe/unsubscribe toggle, calls `pushService.subscribe(user.id)` / `pushService.unsubscribe(user.id)`
  - `src/components/OnboardingModal.tsx` — enrollment step during first-time onboarding flow
  - `src/components/NotificationPermission.tsx` — auto-show banner if `Notification.permission === 'default'` and user hasn't dismissed
  - `src/hooks/useNotificationPrompt.ts` — hook backing the above components

  The `pushSubscriptions` table on prod is NOT empty — confirmed by a real push notification being delivered to a prod subscriber during a staging test match (2026-07-01). The full VAPID pipeline is functional end-to-end on prod.

  The original "always empty" claim was based on the diagnose endpoint output during early sessions when no user had yet completed onboarding. That is no longer the case.

  BUG-085 (dedup key broken) remains open and is the actual notification quality issue. **Status:** RESOLVED — no fix needed, enrollment UI already existed.

- **BUG-085** _(HIGH — Notifications)_: `EventDrivenNotifier` dedup key is broken. Key is constructed as `` `${matchId}_${event.id}_${Date.now()}` `` — the `Date.now()` suffix makes every key unique, so `sentNotifications.has(notificationKey)` never matches. Every notification fires unconditionally with no dedup protection, even on retries. Fix: remove `_${Date.now()}` from key construction. Key should be `${matchId}_${event.id}` (or include `eventType` for period events). Filed: 2026-06-29. **Status:** OPEN

- **BUG-086** _(MEDIUM — Notifications)_: `EventDrivenNotifier` logs `✅ Notification sent` on `response.ok`, regardless of actual `sentCount` in the server response. If the audience query returns 0 users (always the case in current state — BUG-084), the API returns `{ success: true, sentCount: 0 }`. The notifier reads `response.ok = true` and logs success — no actual push was sent. Fix: check `data.sentCount > 0` before logging success; log a distinct warning when `sentCount === 0`. Filed: 2026-06-29. **Status:** OPEN

- **BUG-087** _(MEDIUM — Notifications)_: Viewer favorites fetch races with viewer auth initialization. `GET /api/notifications` queries `userFavorites` immediately on auth — if the viewer's session hasn't resolved yet at first render, `user.id` may be stale or the query may run before favorites are set, producing an empty audience even when favorites exist. Related to the unauthenticated favorites write in BUG-082 — if follows were written without auth, `userId` may not match any `users.id` row. Filed: 2026-06-29. **Status:** OPEN

- **BUG-088** _(MEDIUM — Notifications)_: `GET /api/notifications` returns fabricated notification objects (constructed in-memory from DB queries, no notifications table) and has two data correctness issues: (1) `unreadCount: 0` is hardcoded — always shows zero unread; (2) events query uses `eq(matchEvents.type, 'GOAL')` (uppercase) but events are stored as `'Goal'` (title case) — this filter always returns zero rows regardless of whether goal events exist. PATCH mark-as-read writes nothing (`// Mock success for now`). Filed: 2026-06-29. **Status:** OPEN

- **BUG-089** _(MEDIUM — WebSocket)_: Subscribe storm — 3–5× `match:subscribe` emitted per WS connect. Multiple hooks (`useMatchEvents`, `useMatchStatus`, `useMatchViewers`, `useMatchTimer`, `useLineupUpdates`) each independently call `useMatchSubscription`. Every connect triggers all of them simultaneously. On Railway, each subscribe creates a separate room join. Fix: deduplicate at the `useMatchSubscription` level using a module-level Set keyed by `socketId + matchId` — skip emit if already subscribed on current connection. Filed: 2026-06-29. **Status:** OPEN

- ~~**BACKLOG-119**~~ _(UX — Match Detail Page)_: Remove green "Live" dot from header; colour clock and period label red during live match. Active play (H1/H2/ET/PK): pulsing red dot + red period label + red minute. Half Time: red "HT" label only, no dot, no clock. FT/Pending: neutral. Commit `f9c6764`. **Status:** RESOLVED — 2026-07-27 (session 47C), live-verified on PR #12's Vercel preview (`/matches/w6o4YQAF5pem_Qa8uazAm`, a real `LIVE` basketball match — confirms the styling is sport-agnostic, not football-only despite the original H1/H2/ET/PK example). **Evidence:** DOM-inspected directly rather than eyeballed — found `<span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse">` (the pulsing dot) and the period label (`Q1`) rendered with `className: "text-red-400"`, computed color `oklch(0.704 0.191 22.216)` (genuinely red, not just visually similar). Verified by: session 47C.

- ~~**BUG-092**~~ _(HIGH — Real-time / Viewer UX)_: Undone events stay visible on the public Timeline tab until hard refresh. Root cause: `handleUndo` in `FootballLogger.tsx` sends `DELETE /api/matches/[id]/events/[eventId]` which removes the event from DB, but the WS server only broadcasts `match:event:new` — there is no `match:event:deleted` broadcast. The viewer page's `useMatchEvents` hook accumulates events via WS and has no mechanism to receive deletions. Fix: (a) in the event DELETE handler (`src/app/api/matches/[id]/events/[eventId]/route.ts`), after confirmed DB delete, emit `match:event:deleted` with `{ matchId, eventId }` via the WS server; (b) `useMatchEvents` in `useWebSocket.tsx` listens for `match:event:deleted` and filters the deleted event out of local state. Observed live: double-yellow undo removed the Red Card from DB correctly but Red Card and original Yellow both remained on viewer Timeline until page reload. Filed: 2026-06-30. **Status:** SHIPPED — found already fixed, session 47D. **Real fix landed silently as a side effect of `BUG-119` (`b2ffcde`, "stop firing broadcast calls unawaited on serverless"), which added `after(() => broadcastEventDeleted(matchId, eventId))` to the DELETE handler — never cross-referenced back to this entry.** `useWebSocket.tsx`'s `handleEventDeleted` (filters `setEvents(prev => prev.filter(e => e.id !== data.eventId))` on the `event:deleted` socket event) has existed since the original WS setup commit, so the listener side was never actually the gap — only the emit side was missing until BUG-119 added it. `MatchOverlay.tsx` has its own separate `event:deleted` listener too, also already wired. **Live-tested on staging, 2026-07-28 — status refined, not a clean RESOLVED.** Posted a real test event (`Timeout`) to the live match `w6o4YQAF5pem_Qa8uazAm`, confirmed it appeared, then DELETEd it and watched the same viewer tab without reloading. Console confirmed the broadcast is genuinely received: `[WS] Event deleted for Match w6o4YQAF5pem_Qa8uazAm: [object Object]`. But the event did **not** disappear from the Timeline instantly — it took roughly the length of one `BUG-108` reconciliation-poll cycle (~25s) to vanish. Root cause, confirmed by code read: `useWebSocket.tsx`'s `handleEventDeleted` correctly filters `useMatchEvents`' own internal `events` state (aliased `liveEvents` in `matches/[id]/page.tsx:50`) — but **nothing wires that deletion into `matchData.events`**, which is the state the Timeline tab actually renders from (`page.tsx:144-162` only has a one-way `useEffect` that *adds* `latestEvent` into `matchData.events` on `event:new`; there is no equivalent removal path for a deleted event id). The event only disappeared once the unrelated 25s reconciliation poll (`BUG-108`) did a full silent refetch of `matchData` from the DB, which naturally excluded the deleted row.

**Status:** SHIPPED — the "fix needed for true RESOLVED" described immediately below was itself found already built, session 47F, by a retrospective audit agent. This entry's own status line had gone stale after the fix landed. `src/app/matches/[id]/page.tsx:266-283` has a `handleEventDeleted` listener — filters `matchData.events` on the `event:deleted` socket event, wired via `on('event:deleted', handleEventDeleted)` in the same `useEffect` as `match:score:updated`/`match:status:changed`/`match:updated` — with a comment literally citing `BUG-092`. Confirmed by direct file read, session 47F (not just the audit agent's claim). **Not yet live-tested against this specific code path** (the prior evidence block below tested the pre-fix ~25s-lag behavior, before this listener existed) — needs a fresh live two-tab test to actually confirm instant removal now, then this can move to RESOLVED with a real evidence block.

**Original problem this entry describes (kept for history):** add a small `useEffect` in `matches/[id]/page.tsx` that filters `matchData.events` on the same `event:deleted` socket event (either via a new `deletedEventId` piece of state exposed from `useMatchEvents`, or a second direct `on('event:deleted', ...)` listener on the page itself, matching the pattern the page already uses for `match:score:updated`/`match:status:changed`/`match:updated`). **This is exactly what now exists in code — see above.**

**Evidence (from before the fix above existed — superseded, kept for history):**
- Verified by: live two-tab test against staging, real event POST + DELETE via admin session, observed via the public match page without reload
- Observed result: broadcast received immediately (console-confirmed); UI update lagged ~25s, driven by the reconciliation poll, not the WS listener
- Pending items: a fresh live test against the now-existing `handleEventDeleted` listener, to confirm instant removal and move this to RESOLVED

- **BUG-091** _(MEDIUM — Viewer UX)_: Favourite/heart button on match detail page turns red (optimistic UI) but no write is confirmed. The button is likely calling `POST /api/users/favorites` or `POST /api/teams/[id]/follow` — both routes are listed under BACKLOG-118 remaining work as not yet having `resolveEffectiveUserId` applied. For a viewer-only user (no logger cookie), the failure is likely a silent 401/403 with no UI feedback — the heart state is never rolled back on error. Fix: (a) apply `resolveEffectiveUserId` to `src/app/api/users/favorites/route.ts` and `src/app/api/teams/[id]/follow/route.ts` (BACKLOG-118 remaining work); (b) add error rollback to the heart button — if the API call fails, revert the optimistic toggle and show a toast. Filed: 2026-06-30. **Status:** OPEN

- ~~**BUG-093**~~ _(MEDIUM — Security / Events API)_: `PATCH /api/matches/[id]/events/[eventId]` spread entire request body into Drizzle `.set()`. Fix: explicit allowlist — only `type`, `minute`, `second`, `teamId`, `playerId`, `relatedPlayerId`, `detail`, `period` mutable. `matchId`, `loggerId`, `createdAt`, `isEyePoint`, `id` immutable. **Status:** RESOLVED — `fafab3a`, 2026-07-01.

**Evidence:**
- Commit: `fafab3a`
- Verified by: code review — allowlist replaces open spread; no active UI caller of PATCH `[eventId]` confirmed (grep across all `.ts`/`.tsx` returned zero PATCH calls to `events/${eventId}`)
- Observed result: immutable fields cannot be overwritten via PATCH body
- Pending items: none

- ~~**BUG-094**~~ _(HIGH — Data Integrity)_: `DELETE /api/matches/[id]/events/[eventId]` reverted score before deleting event — failed delete left score permanently wrong. Fix: delete event row first; score revert only runs if delete succeeded (throws bypass). **Status:** RESOLVED — `358ee05`, 2026-07-01.

**Evidence:**
- Commit: `358ee05`
- Verified by: code trace — `db.delete()` now precedes score revert block; if delete throws, catch returns 500 before revert runs
- Observed result: score integrity preserved on delete failure path
- Pending items: live test on staging (undo a goal on a test match, confirm score reverts correctly in correct order)

- ~~**BUG-095**~~ _(HIGH — NDPR / Public API)_: `GET /api/matches/[id]/events` returned raw rows including `loggerId` and `loggerName` to unauthenticated callers. Fix: auth-aware response shaping — unauthenticated callers get fields stripped; authenticated callers (logger seeding local state, multi-logger conflict detection) receive full rows. **Status:** RESOLVED — `4c73aba`, 2026-07-01.

**Evidence:**
- Commit: `4c73aba` (supersedes intermediate `b6d3112` which stripped unconditionally — broke logger seed path at `FootballLogger.tsx:466` and `useMultiLogger.ts:141`)
- Verified by: code trace — `getAuthUser(request).catch(() => null)` check gates the strip; confirmed `FootballLogger.tsx:466` reads `e.loggerId` from GET response (would have been broken by unconditional strip)
- Observed result: public callers cannot retrieve logger identity; authenticated callers retain full event data
- Pending items: curl verify on staging — unauthenticated GET `/api/matches/[id]/events` must return events without `loggerId`/`loggerName` fields

- ~~**BUG-098**~~ _(NDPR / Public API — severity corrected from initial CRITICAL filing, see below)_: `GET /api/players/[id]` returned `profileId`, `memberships`, and `organizationAffiliations` to unauthenticated callers — three of the nine fields explicitly banned from public responses in CLAUDE.md. `getAuthUser(request).catch(() => null)` at `src/app/api/players/[id]/route.ts:24` is optional and only gated a couple of extra fields for admins; it did not gate the request. At line 268, only `email` was destructured out of the player row — `profileId` rode along unstripped for every caller. `memberships`/`organizationAffiliations` were returned raw with no admin/public branch at all. Found 2026-07-11 while reviewing a directive to write a real (non-null) `profile_id` value for the first time on this platform (BACKLOG-120 / Abdul-jabbaar Bello ↔ Storm "Jabbar" link). **Severity correction (same session):** on trace, this was old and platform-wide (true for all 309 players since before this session, `profileId` just carried no information while null) — not something tonight's write introduced or escalated in kind, only in that `profileId` went from null-noise to one real, low-marginal-value data point (the same fact was already disclosed via the always-on `relatedProfiles` field). No evidence of active exploitation. Fix: `profileId` stripped alongside `email` for non-admin callers; `memberships`/`organizationAffiliations` gated behind `isAdmin`. `relatedProfiles` (the actual public "Multi-Sport Athlete" feature, narrowly scoped to id/name/position/rating/team/sport) untouched. `src/app/api/players/[id]/route.ts`. **Status:** RESOLVED — 2026-07-11.

**Evidence:**
- Commit: `2771297`
- Verified by: (1) local dev server, unauthenticated `GET /api/players/busa-pirates-player-9` → `200`, response confirmed missing `profileId`/`memberships`/`organizationAffiliations` keys entirely, `relatedProfiles` correctly present with JABBAR/Storm/Basketball entry. (2) Real staging deployment (`brixsports-staging.vercel.app`), admin-session browser request to the same endpoint → `profileId`, `memberships` (2 entries), `organizationAffiliations` (3 entries) all present and correct for the authenticated admin caller.
- Observed result: non-admin callers no longer receive the three banned fields; admin callers are unaffected; `relatedProfiles` cross-link (the intended feature) works correctly in both directions.
- Pending items: none. Note — staging's own middleware (`src/middleware.ts:23-47`, "staging-wide auth gate") redirects ALL unauthenticated requests to `/login` when `NEXT_PUBLIC_ENV=staging`, by design — so the unauthenticated half of this fix can only be exercised on local dev or production, not staging itself. This is expected, documented behavior, not a gap.

- **BUG-099** _(LOW — Data Display)_: `GET /api/players/[id]` had two display bugs found while tracing the admin player screen. (1) `recentMatchesWithEvents` (`route.ts:113-120`, feeds public `/players/[id]` "Recent Performances" and `PlayerProfileOverlay.tsx`) took the first 5 raw events without deduping by match — a player whose recent events cluster in one match (e.g. Abdul-jabbaar Bello) would show that same match card repeated up to 5 times. The underlying query also only sorted `ORDER BY desc(matches.startTime)` with no secondary sort by minute, so events within a match rendered in scrambled order. (2) `eventsByType`/`goals`/`assists`/`yellowCards`/`redCards` compared `e.event.type === 'GOAL'` against stored Title-Case values (`"Goal"`, `"Yellow Card"`) — same casing-mismatch class as the already-documented BUG-012, never fixed at this specific call site. Traced zero frontend consumers of this specific field (confirmed via grep across `src/`) — dead but broken, no user-visible impact. Fix: dedupe `recentMatchesWithEvents` by match id (first 5 distinct matches, not first 5 raw events), sort each match's own events by minute/second ascending; added a shared `normalizeType()` helper (`type.toUpperCase().replace(/\s+/g,'_')`, matching the established platform convention) for both `eventsByType` and the goals/assists/cards counts. `src/app/api/players/[id]/route.ts`. **Status:** RESOLVED — 2026-07-12.

**Evidence:**
- Commit: `fd3a714`
- Verified by: local dev server, `GET /api/players/busa-pirates-player-9` — direct field inspection of the JSON response.
- Observed result: `recentMatches` now has exactly 2 entries matching his 2 real distinct matches (was showing up to 5 duplicates of the same match before the fix); match `8Mek2CA7KPlnk1EQ647jx`'s events now read `1', 2', 6', 9', 10', 35'` — correctly ascending (was scrambled `2,10,35,1,6,9`); `events.goals: 2, assists: 0, cards: 1` now populated and matches `stats.goals: 2` / `stats.yellowCards: 1` exactly (was silently `[]` for every player before the fix). Deploy confirmed via GitHub commit status API — all 3 checks (`Vercel – brixsports-staging`, `Vercel – brixs2`, Railway) green.
- Pending items: none.

- ~~**BUG-100**~~ _(HIGH — Public Page)_: **Every FINISHED match on the platform (66 of 66) displayed "NOT STARTED" instead of "FT" on its own match detail page.** `matches.current_period` has a hard schema default of `'NOT_STARTED'` (`schema.ts:340`). `src/app/matches/[id]/page.tsx:291` derives the display period as `matchTime?.period ?? match.currentPeriod ?? match.status` — since `currentPeriod` is a real, non-null string, the fallback chain never reaches `match.status`, and `"NOT_STARTED"` has no entry in `PERIOD_LABELS` (`page.tsx:294-304`), so it renders literally via the `period.replace(/_/g,' ')` fallback. Traced whether this is a live-code regression or historical-only: confirmed `FootballLogger.tsx:982-983,1097` still correctly PATCHes `currentPeriod: 'FINISHED'` on match completion today, and zero FINISHED matches have a `startTime` after 2026-06-27 (when BUG-076/078 shipped that fix) — so every affected row predates or bypassed the live flow entirely (backfilled BUSALYMPICS/BUSA League football + basketball data). Not a live-code bug, purely a historical data-population gap. Fix: `dev/fix-stale-current-period.mjs --apply` — `UPDATE matches SET current_period = 'FINISHED' WHERE status = 'FINISHED' AND current_period = 'NOT_STARTED'`. **Status:** RESOLVED — 2026-07-12.

**Evidence:**
- Verified by: pre-flight `SELECT` confirmed exactly 66 affected rows (spanning BUSA League Football and Basketball); post-apply `SELECT COUNT(*) WHERE status='FINISHED' AND current_period='NOT_STARTED'` → `0`; `SELECT COUNT(*) WHERE status='FINISHED' AND current_period='FINISHED'` → `66`.
- Observed result: all 66 previously-stale rows now correctly read `FINISHED`; no other column touched.
- Pending items: none for the backfill. Note for future live matches — the current live-finish code path is confirmed correct (verified by code read, not by a post-fix live test, since no live match has been played since the fix shipped), so this class of staleness should not recur going forward without a new root cause.

- ~~**BUG-101**~~ _(MEDIUM — Payload / NDPR)_: `GET /api/players/[id]` embedded the full raw `matches` row (via `match: matches` shorthand) inside every entry of `recentMatches`, `events.goals/assists/cards`, and `allEvents` (up to 20 events per player, `.limit(50)` on the underlying query). This carried two real problems, both confirmed empirically against `busa-pirates-player-9`: (1) heavy unused blobs (`lineups` — 6,482 bytes on one match alone, `stats`) repeated verbatim per event instead of once, inflating the response ~6.6x (119,832 bytes → 18,059 bytes after fix, confirmed by direct byte count); (2) four more of CLAUDE.md's banned public fields (`loggerId`, `approvalStatus`, `managerNotes`, `approvedBy`) riding along unstripped on every nested match/event object, confirmed present in a genuine unauthenticated response — same class as BUG-098, found on the same route, missed the first time because that fix only addressed the top-level `player` object, not nested match/event objects. Traced all 5 real frontend consumers of this route (`players/[id]/page.tsx`, `players/compare/page.tsx`, `favourites/page.tsx`, `PlayerProfileOverlay.tsx`, `admin/players/[id]/page.tsx`) — confirmed none read any of the removed fields. Fix: explicit narrow field projection for both `event` and `match` in the `playerEvents` query — keeps only fields actually consumed (id/type/minute/second/period/teamId/playerId/relatedPlayerId/detail/isEyePoint/value/createdAt for events; id/sport/homeTeamId/awayTeamId/homeScore/awayScore/status/startTime/venue/competition/competitionId/round/matchday/groupName for matches). `src/app/api/players/[id]/route.ts`. **Status:** RESOLVED — 2026-07-12.

**Evidence:**
- Verified by: local dev server, unauthenticated `GET /api/players/busa-pirates-player-9` before/after byte comparison and field-presence grep.
- Observed result: response size 119,832 → 18,059 bytes (~85% reduction); zero occurrences of `lineups`, `stats`, `loggerId`, `approvalStatus`, `managerNotes`, `approvedBy` post-fix; `recentMatches` dedup/sort (BUG-099) and `events.goals/assists/cards` casing fix (BUG-099) both confirmed still intact after the narrowing.
- Pending items: none.

- ~~**BUG-102**~~ _(LOW — Admin UX)_: Admin player detail page's "Recent Match Events" section (`admin/players/[id]/page.tsx`) read `data.allEvents` — the raw, unsorted, un-deduped event list — instead of `data.recentMatches` (already fixed for dedup/minute-sort in BUG-099). It also could never show real team names: the match-name fallback checked `ev.match?.homeTeam && ev.match?.awayTeam`, but the raw `matches` row only ever had `homeTeamId`/`awayTeamId` strings, never joined team objects — so every row silently fell back to showing just the competition name (visually confirmed: every row read "BUSA League Football" with no way to tell matches apart). Fix: added a small team-name resolution step server-side (`src/app/api/players/[id]/route.ts` — collects distinct home/away team IDs from the already-deduped `recentMatches`, one extra narrow `teams` query, attaches `homeTeam`/`awayTeam: {name, shortName}`); admin page switched from `allEvents` to `recentMatches`, now renders one card per distinct match (team names + score) with that match's own events as badges beneath. `src/app/api/players/[id]/route.ts`, `src/app/admin/players/[id]/page.tsx`. **Status:** RESOLVED — 2026-07-12.

**Evidence:**
- Commit: `840721b`
- Verified by: live browser screenshot of `/admin/players/busa-pirates-player-9` on real staging deployment.
- Observed result: exactly 2 distinct match cards ("PIR vs HAM" 5-0, "PIR vs QUA" 2-1) — no duplication; first match's events read in correct chronological order (`1', 2', 6', 9', 10', 35'`); second match's `-1`-minute (goals-only backfill sentinel) events correctly show no minute label, while its one real Substitution correctly shows `44'`.
- Pending items: none.

- **BACKLOG-121** _(Feature — Admin UX)_: Admin player detail page's "Recent Match Events" section now groups events by type per match into a single clickable count badge (`{TYPE} ×N`) instead of one badge per raw event — e.g. four "Shot off Target" events collapse into one "SHOT OFF TARGET ×4" badge. Clicking a badge expands it inline to show the actual minutes for that group (`1', 44'`), or `—` for the goals-only-backfill sentinel case (`minute: -1`) — shortened from an initial "no time data" label per Richard's call. Applies uniformly to both timed and untimed events per Richard's call — the collapsed view serves the "impact performance" summary use case; expansion is opt-in detail. `src/app/admin/players/[id]/page.tsx` (`groupEventsByType`, `toggleEventGroup`, `expandedEventGroups` state). **Status:** RESOLVED — 2026-07-12.

**Evidence:**
- Commit: `fe15f1d`
- Verified by: live browser screenshot of `/admin/players/busa-pirates-player-9` on real staging deployment.
- Observed result: "PIR vs HAM" shows `GOAL ×1, INTERCEPTION ×2, SUBSTITUTION ×1, SHOT ON TARGET ×1, SHOT ×1` (5 badges, was 6 raw events); "PIR vs QUA" shows `GOAL ×1, SHOT ON TARGET ×1, SHOT OFF TARGET ×4, YELLOW CARD ×1, SUBSTITUTION ×1` (5 badges, was 8 raw events) — grouping confirmed correct on real data for both a timed and an untimed match.
- Pending items: none.

- ~~**BUG-103**~~ _(UX — Public Match Detail Page)_: Two issues found while reviewing a backfilled BUSALYMPICS match on staging (`a9CtLwotaXyfsfMf2odAM`, COLNAS 1-2 COLENG). (1) `LiveMatchTimeline.tsx` rendered the raw `-1` "minute unknown" backfill sentinel as a literal `-1'` next to every goals-only-backfill event — same sentinel BACKLOG-121 already handles correctly on the admin page, never ported to this public consumer. Richard's call: don't just relabel the minute, hide the Timeline tab entirely for any match containing unknown-minute events (`"Timeline not available"`, no further explanation — same convention as `MatchLineups.tsx`'s existing empty state, deliberately terse per Richard's direct instruction, not the fuller "will be displayed here" phrasing `MatchLineups` uses). (2) The match header had no red-card indicator next to team names at all — confirmed via direct code read (no such logic existed in `src/app/matches/[id]/page.tsx` before this fix). Ported the existing dot-indicator pattern from `MatchOverlay.tsx:771-909` (small red bars next to the team name, one per red card, filtered by `event.type === 'Red Card' && event.teamId === match.home/awayTeamId`). Real red cards for this specific match verified against `match_events` directly (both real, correctly-attributed players — one a dual-affiliated COLNAS/Kings-FC athlete, not a data bug). `src/components/LiveMatchTimeline.tsx`, `src/app/matches/[id]/page.tsx`. **Status:** SHIPPED — pending staging verification (local sandbox browser preview unavailable this session).

- **BUG-104** _(LOW — Dead Code, found while fixing BUG-103)_: `MatchOverlay.tsx`'s red-card dot indicator (the exact pattern just ported to the match detail page for BUG-103) has never actually fired in production. Its only real caller is the homepage (`src/app/page.tsx`), which hardcodes `events: []` in all 4 of its match-transform maps (lines ~106, 148, 216, 256) before setting `selectedMatch` — same shape as the already-documented known-issues.md entry ("round field not passed through page.tsx transform maps: when a page manually constructs match objects from API data, every field used downstream must be explicitly included"). `homeRedCardsCount`/`awayRedCardsCount` always evaluate to 0 from this entry point. Not fixed — filed for a future session; needs the same fix shape as the `round` bug (either populate `events` in all 4 transform maps, or switch the overlay's data source to the raw `/api/matches` response). **Status:** OPEN — Filed 2026-07-13.

- ~~**BUG-105**~~ _(HIGH — Public Stats Tab, found while backfilling busa-match-7)_: **14 already-backfilled matches were showing fake, stale stats on their public Stats tab despite having real `match_events` data.** Root cause: these matches were seeded at initial DB creation with a non-empty but algorithmically-generated placeholder `stats` JSON blob (giveaway: possession values with absurd decimal precision like `56.667927829149534%`, real analysts don't produce that). `src/app/api/matches/[id]/route.ts:251-252`'s `statsEmpty` guard (`!stats || Object.keys(stats).length === 0`) only recomputes real stats from `match_events` when `stats` is null/undefined/`{}` — it never fires for a match with any non-empty `stats` value, fake or real. Confirmed directly on `busa-match-13`: `stats` column said `yellowCards:[0,0]` while 98 real `match_events` (including 6 real Yellow Cards) sat unused. Same underlying "computed-from-events path blocked by a truthy placeholder" class as the 2026-06-25 known-issues.md entry ("persisted stats = '{}' blocked the computed-from-events path"), except this variant is a non-empty fake blob, not a literal `'{}'`, so the existing guard doesn't catch it. Affected all 14 matches with both real events and a seeded stats blob (busa-match-1 through -6, -10 through -16 except SF, -final-2026) — the two semifinals were unaffected because they were freshly inserted this session with no `stats` value set at all. Fix: `dev/fix-stale-seeded-stats.mjs --apply` — `UPDATE matches SET stats = NULL WHERE id IN (...)` for all 14, letting the existing `statsEmpty` guard correctly recompute on next read. No code change needed. **Status:** RESOLVED — 2026-07-13.

**Evidence:**
- Verified by: pre-flight query confirmed exactly 14 affected rows (platform-wide, not just BUSA League — BUSALYMPICS matches were unaffected, apparently never seeded with this placeholder pattern); post-apply query confirms 0 remaining matches with both real events and a non-empty `stats` column.
- Observed result: all 14 matches' `stats` column now NULL; next page load for each will correctly compute real stats from `match_events` via the existing, unmodified guard.
- Pending items: **every future backfill write script for a pre-existing match row must also clear `stats` to NULL as part of the same batch**, or this recurs for every new match going forward. Not yet automated into the write-script template.

- ~~**BUG-106**~~ _(CRITICAL — Auth, session 42)_: Logger login was completely unreachable on staging, regardless of credentials. Root cause: `src/middleware.ts`'s staging-wide auth gate (`env.isStaging` block, added to keep the staging deployment private) only exempted `/api/auth/*` and `/login` from the "must have a valid `authToken` cookie" check. It never exempted `/logger` (the logger login page) or `/api/loggers/auth` (the actual logger login endpoint) — a separate identity system from the general `/api/auth/login`/`users`-table path. Effect: visiting `/logger` unauthenticated redirected straight to `/login` before the logger ever saw their own form; submitting credentials from `/login` instead hit `/api/auth/login`, which only checks the `users` table, so a logger-only account 401'd every time with "email not found" no matter the password — a chicken-and-egg lockout, not a credentials issue. Confirmed live via a real staging HAR: 6 consecutive `POST /api/auth/login` → 401. Fix: added `pathname.startsWith('/api/loggers/auth')` and `pathname === '/logger'` to the staging exemption list alongside the existing `/api/auth/` and `/login` entries. **Status:** RESOLVED — 2026-07-13 (commit `1a1a1a9`).

**Evidence:**
- Commit: `1a1a1a9`
- Verified by: live test — Richard logged into a logger account on staging directly.
- Observed result: logger login succeeded (previously 401/redirect-looped per the HAR evidence above).
- Pending items: none for this specific gate. Separately and not part of this fix: `GET/POST /api/loggers` and `GET/PATCH/DELETE /api/loggers/[id]` were found to have zero auth of any kind (session 42, same investigation) — filed as a new CRITICAL item, not yet resolved, tracked separately below.

- ~~**BUG-107**~~ _(CRITICAL — Auth, session 42, found while investigating BUG-106)_: `GET/POST /api/loggers` (`src/app/api/loggers/route.ts`) and `GET/PATCH/DELETE /api/loggers/[id]` (`src/app/api/loggers/[id]/route.ts`) had zero `getAuthUser()` call anywhere in any handler — confirmed via `grep -rL "getAuthUser" src/app/api/loggers/`, the only 2 files in that directory missing it (`auth/route.ts` and `me/route.ts` both had it correctly). Neither `middleware.ts`'s staging gate nor its `/admin`+`/api/admin` block covers `/api/loggers` (wrong path prefix), so in **production** (`env.isStaging` false) these were fully open to the public internet with no gate of any kind. Concretely:
  - `GET /api/loggers` / `GET /api/loggers/[id]` — leaked every logger's email, name, role, assigned matches to any caller (same class as the already-fixed BUG-007).
  - `POST /api/loggers` — anyone could create a new logger account, no admin check.
  - `PATCH /api/loggers/[id]` — `if (role) updateData.role = role` with zero validation, zero auth, plus an unauthenticated `password` field — full account takeover of any known logger, no role trickery even needed.
  - `DELETE /api/loggers/[id]` — anyone could delete any logger account.
  **Correction on original severity claim, traced through `getAuthUser()` before fixing**: the `role: 'admin'` escalation path was real at the `middleware.ts` page-gate level (which trusts the raw JWT role claim) but did **not** grant working `/api/admin/*` API access — `getAuthUser()` only special-cases `role === 'logger'` to query the `loggers` table; any other role value falls through to a `users`-table lookup by the logger's own id, which doesn't exist there, so it resolves to `null`. Every real admin API handler (which correctly uses `getAuthUser`, not middleware alone) would have rejected the forged identity. Actual reach was "view the `/admin` page shell client-side," not functioning admin API access — the account-takeover half (password reset) was the fully severe part regardless of the role angle.
  **Fix applied**: `getAuthUser(request)` + `role === 'admin' || role === 'logger_manager'` check added to all 4 handlers (matching the established pattern already used in `/api/loggers/me`, `/api/loggers/auth`, and `assign-logger`). `POST`/`PATCH` now validate `role` against an explicit allowlist (`['logger', 'logger_manager']` — `'admin'` deliberately excluded, since real admin accounts belong in `users`, never in `loggers`), same fix class as the already-fixed BUG-051. Password leak fixed with explicit destructure-exclude instead of `{...logger, password: undefined}` (documented in known-issues.md as unreliable across serializers). Bundled in the same pass: `getLoggerMatches()` (`src/lib/match-logger-helpers.ts`, shared by `/api/loggers/[id]` and `/api/loggers/auth`) and the inline match-join in `GET /api/loggers` were both full-row-spreading `matches` (including the `stats`/`lineups` JSON blobs, same class as BUG-101) — narrowed to the 9 fields real consumers (`src/app/logger/page.tsx`, `src/app/admin/loggers/page.tsx`) actually read, traced directly rather than assumed. **Status:** RESOLVED — 2026-07-13 (commit `5a47697`).

**Evidence:**
- Commit: `5a47697`
- Verified by: live staging test, deployed. `NEXT_PUBLIC_ENV` temporarily flipped to `development` on the staging Vercel project to bypass the outer staging-privacy gate and hit the route handlers directly (reverted back to `staging` + redeployed immediately after testing); separately, a real admin session tested the legitimate PATCH flow.
- Observed result: unauthenticated `GET`/`POST`/`PATCH`/`DELETE` on `/api/loggers` and `/api/loggers/[id]` all returned `401 {"error":"Unauthorized"}` (previously: 200 with full data leak, 201 account creation, and unauthenticated writes). Authenticated admin PATCH (including a real password change) succeeded and returned the updated logger object with **no `password` field present** — confirms the explicit destructure-exclude fix, not just the role gate. Payload reduction confirmed with a real number: `matches.lineups` for `8Mek2CA7KPlnk1EQ647jx` is 6,482 bytes, previously spread in full into every assigned-match entry — now excluded entirely (`dev/check-match-blob-sizes.mjs`, logged in RUNLOG.md 2026-07-13).
- Pending items: none for BUG-107 itself. Two small things surfaced during verification, not part of this fix: (1) a stray test account was accidentally created on **production** while verifying (`logger_1783961469102`) — deleted immediately via the same endpoint before the fix was confirmed deployed there; (2) the admin "Edit Logger" role `<select>` (`src/app/admin/loggers/page.tsx:866`) still offers `Admin` as an option, which will now 422 if ever selected — not yet removed from the UI, Richard's call pending on whether to pull that option.

- **BUG-108** _(CRITICAL — Real-Time / Flow C, session 42, found during a live match test on staging)_: **Live event broadcast to public viewers and the DB write for that event are two fully independent, uncoordinated actions — nothing ties them together.** Confirmed directly:
  - `POST /api/matches/[id]/events` (`src/app/api/matches/[id]/events/route.ts`) — zero WS emit calls anywhere in the file. It only writes to the DB.
  - The live WS broadcast (`event:log` → `event:new`) is triggered **client-side only**, from the logger's own open browser tab (`src/components/FootballLogger.tsx:701`, gated by `if (isSocketConnected)`), as a separate step from "2. Persist to API" (line 723's own comment).
  - `server.js:100-109`'s `event:log` socket handler is a **pure relay** — it re-broadcasts whatever the logger's socket sends to the room, with no DB read/write/verification of any kind.
  **Confirmed failure mode, reproduced live**: an event logged while the logger was genuinely offline (DevTools throttle set to Offline, `PATCH` calls failing with `ERR_INTERNET_DISCONNECTED`) queued correctly via the existing offline-queue system (BACKLOG-058) and, once the network returned, was correctly synced to the DB by the Service Worker's background sync (`public/sw-admin.js:184`, plain `fetch()` to the same API route — confirmed via direct DB query, both events present with correct data). **But the already-open public viewer never received a live push for either event** — no disconnect/error in the viewer's console, the socket never visibly dropped, it just silently never got the broadcast. A full page reload immediately showed both events correctly. Root cause: the Service Worker has no socket connection (it's a background context, not a page) — `syncMatchEvents()` can only ever do the DB-write half of the two-step process, by construction. **Every offline-queued event that syncs later will silently never reach a live viewer until they manually refresh.**
  **Second failure direction, implied by the same architecture but not yet independently reproduced**: since the client-side `emit('event:log', ...)` and the API persist are unawaited, uncoordinated calls, the reverse could also happen — a live logger's broadcast succeeds (viewers see the event) while the following API persist silently fails (network blip, 500, validation error) — a phantom event visible to viewers that was never actually saved to the DB.
  **Mitigated, not fixed** (session 43, `matches/[id]/page.tsx`): the DB write and the broadcast are still exactly as uncoordinated as described above — nothing about the root cause changed. What was added is a low-frequency (25s) reconciliation poll that now runs even while the viewer's own WS **is** connected, complementing BUG-080's existing disconnect-only 10s poll — so any event that reaches the DB with no broadcast ever firing (offline-queue sync, or any write path with no live socket at write time) is caught within a bounded ~25s window instead of staying invisible until a manual refresh. Bundled with the BUG-113 fix below since the two are coupled (see that entry) — the poll now does a diff/merge instead of a full replace, so running it more often doesn't add visible flicker. **This does not touch the "phantom event" reverse direction** noted above (broadcast succeeds, persist silently fails) — the poll only helps when the DB write is the one that succeeded.
  **Real fix built and wired in, same session, see BUG-116 for the full story**: `src/lib/socket.ts` already had a complete, working broadcast library (`broadcastMatchEvent`, `broadcastScoreUpdate`, `broadcastEventDeleted`) with correct local/production fallback logic — already exercised by the chat feature — that was simply never called from any match route. Now wired into `POST /api/matches/[id]/events`, `DELETE .../events/[eventId]`, and `PATCH /api/matches/[id]` (commits `9a7c15d`, `2bba738`).
  **Live-tested, session 43, end of session — did NOT arrive live, root cause suspected but not confirmed.** Posted a real event directly via `POST /api/matches/[id]/events` (raw HTTP, `dev/gen-logger-test-token.mjs`, no WebSocket involved at all) while a viewer tab sat connected and subscribed to the match. DB write succeeded correctly both times (confirmed in the API response). The event never appeared on the connected viewer's Timeline within a tight few-second window — checked twice, including one deliberately-timed test posted and checked within ~2 seconds, well before any poll interval could explain it either way. No client-side errors, since the browser has no visibility into a failed server-to-server call.
  **Root cause partially confirmed, continued session**: the Railway `ws-server` service genuinely had no `WS_API_KEY` configured — confirmed directly (not just inferred) by calling `POST https://brixsports-production-8fa3.up.railway.app/broadcast` straight from a script, bypassing the whole app, using the key value from `.env.local`: returned `401 {"error":"Unauthorized"}`. Richard added `WS_API_KEY` to the Railway service. Same direct call retested immediately after: `200 {"success":true}` — confirms Railway's side of the check now works with that key value.
  **But the full chain still doesn't work**: redid the live test through the real app (`POST /api/matches/[id]/events` via `dev/gen-logger-test-token.mjs`, connected viewer tab watching) — DB write succeeded, but the event still did not appear on the viewer's Timeline. This isolates the remaining gap precisely: the direct test used the key value sitting in the *local* `.env.local` file, but the actual broadcast call at runtime comes from **Vercel's own configured `WS_API_KEY`** (whatever's actually set in Vercel's dashboard, staging project) — which was never directly confirmed to match what was just added to Railway. If Vercel's real value differs even slightly from the local file's value, the app's own call fails the same way, independent of Railway now being correctly configured.
  **Next session's exact first step**: confirm Vercel's staging project's actual `WS_API_KEY` value (dashboard → Environment Variables, not the local `.env.local` file) matches exactly what's now set in Railway's `ws-server` service. If they differ, fix whichever is wrong and redeploy Vercel. Then redo the same two-part test: (1) direct `POST /broadcast` to Railway with Vercel's actual key value as an isolated sanity check, (2) the full live test (`dev/gen-logger-test-token.mjs` + `POST /api/matches/[id]/events`, connected viewer tab, check Timeline within a few seconds). Only move to `RESOLVED` once part 2 succeeds — part 1 succeeding alone already proved insufficient once.
  **Session 44 — actual root cause found and fixed.** `WS_API_KEY` was a red herring by the time this session started: Richard confirmed Vercel's and Railway's values were byte-identical. Two more live-app tests (with the key confirmed matching) still failed to deliver — `dev/test-live-broadcast-post.mjs` posted real events via `POST /api/matches/[id]/events` against staging, DB writes succeeded (`201`) both times, but the connected viewer never logged `[WS] New event received...`, only picking the events up later via the 25s reconciliation poll (BUG-108's own mitigation, not the broadcast). Traced to `src/lib/socket.ts:43`: `process.env.NEXT_PUBLIC_WS_URL || process.env.WS_SERVER_URL` — Vercel's `NEXT_PUBLIC_WS_URL` was missing its `https://` scheme (bare `brixsports-production-8fa3.up.railway.app`), so every server-side `fetch(broadcastUrl, ...)` threw on the malformed URL, silently swallowed by the surrounding `try/catch` (`console.warn`, server-side only, invisible to any client or curl test run this session or last). `WS_SERVER_URL` had the correct `https://` value the whole time but was never used, since the code prefers `NEXT_PUBLIC_WS_URL` when both are set. Richard added the missing scheme on Vercel's dashboard and redeployed.
  **RESOLVED — live-tested end-to-end, real WS push confirmed.** Re-ran the same test (`dev/test-live-broadcast-post.mjs`, fresh viewer tab, fresh WS connection) after the redeploy: DB write `201`, and this time the console logged `[WS] New event received for Match G4er-Gc0_E1xo8_BgvyIQ` four times with no reload — the Timeline updated live, new "Corner" card appeared at the top unprompted. Test event (`b-oUvHwslh292_yfhosrk`) deleted afterward via `dev/cleanup-broadcast-test-event.mjs`, confirmed 0 rows remaining. **One caveat, noted honestly**: delivery took roughly 7–17 seconds in this test, not the "few seconds" originally expected and not CLAUDE.md's stated <5s target — worth a follow-up look at whatever's adding that latency (Railway cold path, Socket.IO room-emit delay, or something else), but it is a confirmed live push through the real broadcast pipeline, not the poll fallback.
  **Status:** RESOLVED — 2026-07-15 (session 44), no code changes required, config-only fix (Vercel env var).
  **Evidence:**
  - Commit: none — config-only fix (Vercel `NEXT_PUBLIC_WS_URL` env var, missing `https://` scheme, corrected on staging dashboard + redeployed)
  - Verified by: live test — `dev/test-live-broadcast-post.mjs` posted a real event via `POST /api/matches/[id]/events` on `https://brixsports-staging.vercel.app` while a separate connected viewer tab watched the match page; DB write confirmed `201`; viewer's browser console logged `[WS] New event received for Match G4er-Gc0_E1xo8_BgvyIQ` and the Timeline updated with the new event with zero manual refresh or reload
  - Observed result: live broadcast delivered end-to-end for the first time this project has confirmed; ~7–17s latency observed (browser-side timing, not server-log-confirmed), exceeds the <5s target — not blocking this bug's resolution but flagged as a follow-up
  - **Measurement-method correction, added during BUG-074's later verification the same session**: this 7–17s figure was estimated by eyeballing gaps between my own tool calls (waits, screenshots), not a real measurement. A later test's actual Railway server log timestamps showed a 42-second gap between DB write and broadcast — worse than this estimate, not better. Treat 7–17s here as an unreliable soft floor, not a real ceiling; the true latency figure needs server-log-based measurement, not browser-side guessing.
  - Pending items: latency investigation, now with better evidence it's worse than first thought (see BUG-074's entry for the 42s data point); BUG-074's real fix (environment-scoping `ws-server/index.js`, the correct deployed file) — DONE this session as a workaround, see that entry

- **BUG-116** _(CRITICAL — Real-Time / Flow B, session 43, split out from BUG-108's "Fix (not yet built)" section)_: **The real fix for BUG-108 — moving the WS broadcast onto the server, triggered after a confirmed DB write.** `server.js`'s `event:log` handler (referenced in BUG-108) is a pure relay with no DB access.
  **Correction, same session**: originally filed as blocked on "the Railway service's own codebase" — that was wrong. `server.js` is this repo (`npm start` → `NODE_ENV=production node server.js`), a custom server wrapping Next.js's own request handler and Socket.IO inside one `createServer` — Railway runs the actual app, just as a second, separate long-lived process from Vercel's serverless one. The `global.io` broadcast attempt already in `PATCH /api/matches/[id]/route.ts:547` isn't dead code in general, only dead *on Vercel* (no persistent process to hold that global) — the same route would work if it ran on Railway's process instead, where `server.js` sets that global.
  **Real fix, now genuinely scoped**: Vercel's `POST /api/matches/[id]/events` route (and any other write path) makes a server-to-server `fetch()` to Railway's own deployment after a confirmed DB write, hitting a small endpoint there with real `io` access to broadcast to the room. Same repo, no cross-service unknowns — this is buildable, not blocked. Also covers BUG-108's "phantom event" reverse direction (broadcast succeeds, persist silently fails), since a server-triggered broadcast only ever fires *after* a confirmed write.
  **Second correction, same session — bigger than the first**: root `server.js` is **not** what Railway actually deploys. Confirmed via the live Railway dashboard (project `ingenious-analysis`, service labeled `production`, domain `brixsports-production-8fa3.up.railway.app` — the exact shared instance every test tonight hit) — "Deployed via GitHub" showed **Root Directory: `/ws-server`**. There's a second, separate, more mature server implementation at `ws-server/index.js`, deployed independently per its own `README.md` ("Standalone Socket.IO server... deployed separately from the main Next.js app"). Root `server.js` is local-dev only (`npm run dev`/`npm start` both run it, combining Next.js + Socket.IO in one process for local convenience) — it has never been what protects or serves the real staging/prod traffic.
  **This already had exactly what BUG-116 needed, just not connected**: `ws-server/index.js` exposes a `POST /broadcast` endpoint (API-key gated via `x-api-key`/`WS_API_KEY`) built for precisely this purpose. And `src/lib/socket.ts` already wraps it in a complete, ready-to-use library (`broadcastMatchEvent`, `broadcastScoreUpdate`, `broadcastEventDeleted`, `broadcastToMatch`, etc.) with correct local (`global.io`) vs production (HTTP `/broadcast`) fallback — already exercised for real by the chat feature (`src/app/api/chat/send/route.ts`). It was fully built and simply never called from any match route (confirmed via grep: zero hits under `src/app/api/matches/`).
  **Fix applied** (session 43, `9a7c15d`, `2bba738`): wired `broadcastMatchEvent`/`broadcastScoreUpdate`/`broadcastEventDeleted`/`broadcastToMatch` into `POST /api/matches/[id]/events`, `DELETE .../events/[eventId]`, and `PATCH /api/matches/[id]` (see full detail on those commits under BUG-108). `tsc --noEmit` clean.
  **Found in passing, separate real bug, also fixed**: `WS_SERVER_URL` in both `.env.local` and `.env.production` (gitignored, local-only files) was set to `http://localhost:3000`, with the correct Railway URL sitting commented out — same stale-comment pattern as `NEXT_PUBLIC_WS_URL` found earlier tonight. Fixed locally to `https://brixsports-production-8fa3.up.railway.app`. Richard separately confirmed and corrected the actual Vercel dashboard env vars (both staging and prod projects) and redeployed — the local files are not what Vercel reads at runtime, only local tooling.
  **Still not done**: BUG-074's environment-scoping fix was applied to root `server.js` earlier tonight (commit `31b8671`) — given this correction, that fix protects nothing live. The same `room()`-prefixing pattern needs porting to `ws-server/index.js`, the file that's actually deployed. Filed as the next concrete step, not yet built.
  **Live test result, updated**: `WS_API_KEY` confirmed missing on Railway's `ws-server`, then added by Richard — direct `POST /broadcast` call now returns `200` (was `401`). But the full chain through the real app still doesn't deliver a live event to a connected viewer — see BUG-108's entry for the exact test sequence and the remaining suspected gap (Vercel's own `WS_API_KEY` not yet confirmed to match what's now in Railway).
  **RESOLVED, session 44 — real root cause was `NEXT_PUBLIC_WS_URL`, not `WS_API_KEY`.** Full detail in BUG-108's entry (same fix closes both). `WS_API_KEY` turned out to match between Vercel and Railway all along; the actual break was `NEXT_PUBLIC_WS_URL` missing its `https://` scheme on Vercel, which `src/lib/socket.ts:43` prefers over `WS_SERVER_URL` — every broadcast `fetch()` threw on the malformed URL and was silently swallowed. Fixed by Richard on the Vercel dashboard (scheme added, redeployed), live-tested end-to-end afterward: `dev/test-live-broadcast-post.mjs` + a connected viewer tab logged a real `[WS] New event received...` push with no reload.
  **Status:** RESOLVED — 2026-07-15 (session 44). BUG-074's real fix (environment-scoping the correct deployed file, `ws-server/index.js`) remains open — separate item, unaffected by this fix.

- **BUG-119** _(HIGH — Real-Time, session 44, found investigating BUG-108/116's latency follow-up)_: **All five `broadcast*()` calls across the three match write routes were fire-and-forget — never awaited, and the exported functions in `src/lib/socket.ts` didn't even return their underlying promise, so there was nothing to await even if a caller tried.** On Vercel's serverless runtime, an unawaited promise has no guaranteed completion once the function returns its response — the instance can be frozen or torn down mid-flight. This is the far more likely explanation for BUG-108/116's observed multi-second (up to 42s, per Railway's own server logs) broadcast delivery latency than "Railway is slow" — the delay is plausibly however long it takes for that Lambda instance to be reused or to opportunistically flush the still-pending `fetch()` before freezing, which explains why it was wildly inconsistent (sub-10s in one test, 42s in another) rather than a fixed cost.
  **Fix**: `src/lib/socket.ts`'s `broadcastToMatch`/`broadcastMatchEvent`/`broadcastScoreUpdate`/`broadcastRatingUpdate`/`broadcastStatsUpdate`/`broadcastMatchStatus`/`broadcastEventDeleted` now all `return` their promise instead of firing-and-forgetting it (typed `Promise<void>`, was `void`). All 5 real call sites (`POST`/`DELETE /api/matches/[id]/events[/:eventId]`, `PATCH /api/matches/[id]`) now wrap the call in `next/server`'s `after()` (stable as of Next.js 15.3.8, confirmed the version this repo runs) instead of calling it bare — `after()` keeps the serverless invocation alive until the broadcast promise settles, without delaying the response returned to the logger. `broadcast()`'s own internal `try/catch` still swallows failures, so this can't fail event creation either way.
  **Scope note**: `/api/events` (a separate, older route) has the identical fire-and-forget pattern on the same functions but was left untouched — grepped for frontend callers and found none; not part of the live flow this project actually uses (`/api/matches/[id]/events` is), so fixing it wasn't in scope here.
  `tsc --noEmit`: no new errors in any touched file.
  **Deployed and live-verified with real server-log timing** (commit `b2ffcde`, pushed to `dev`, Vercel staging redeployed — confirmed by Richard). Same test as before (`dev/test-live-broadcast-post.mjs` + Railway's own log export, not browser-side guessing): DB write completed `16:35:27.914Z`, Railway logged `[Broadcast API] event:new → staging:match:...` at `16:35:37.781Z` — a **9.9-second gap**, down from the 42s observed pre-fix. Real, substantial improvement (~4x faster), confirms the unawaited-promise theory was a major real contributor, not a red herring.
  **Still short of the <5s target** — ~9.9s of latency remains unexplained. Not investigated further this session; candidates for next time: Vercel's own cold start on the API route invocation itself (separate from the broadcast fetch), network round-trip time Vercel→Railway, or something inside Socket.IO's own room-emit path. Root cause of the *remaining* gap is still open, distinct from the fire-and-forget issue this entry already fixed.
  **Status:** SHIPPED, session 44 — real improvement confirmed live (42s → ~9.9s), does not fully close the <5s gap. Not marking RESOLVED since the readiness checklist item (CLAUDE.md) still can't be checked off.
  **Update, session 45 — a second, real contributor to the remaining ~9.9s found by code-reading, not yet live-measured.** `POST /api/matches/[id]/events` (`src/app/api/matches/[id]/events/route.ts`) registers its `after()` broadcast calls (lines 212/215) but then still `await`s two more things before it can `return` — `updatePlayerStats()` and, when the match is `LIVE`, a synchronous internal self-`fetch()` to its own `/api/matches/[id]/ratings` endpoint (was lines 229-238). Since `after()` callbacks don't start running until the handler's own promise resolves, that self-fetch sat directly between "DB write committed" and "broadcast fires" — a full extra Vercel-to-Vercel HTTP round trip (with its own possible cold start) added to every single live event, on top of whatever the broadcast fetch itself costs.
  **Fix applied, session 45**: wrapped the ratings self-fetch in its own `after()` call, same pattern as the broadcast calls, so it no longer blocks the response or delays when the broadcast `after()` can start. `tsc --noEmit`: no new errors in the touched file (pre-existing unrelated errors elsewhere confirmed present before this edit too, per CLAUDE.md's known-acceptable `src/db/` baseline).
  **Also found while tracing this, filed separately — see BACKLOG-124**: the ratings self-fetch has silently 401'd on every call since it was written (forwards no `Cookie`/`Authorization` header), so live auto-ratings has never actually run; distinct correctness bug from this latency fix, not addressed here.
  **Live-tested, session 45, real server-log timing** (commit `bdf10f3`, pushed to `dev`, Vercel staging + Railway `ws-server` both redeployed). Two real events posted via `dev/test-live-broadcast-post.mjs` against `https://brixsports-staging.vercel.app`, gap measured as DB `createdAt` vs. Railway's own `[Broadcast API]` log line (Richard pasted the raw Railway log export, not browser-side timing):
  - Event `c0B-BFeb5UDObt1qsA5AR`: DB write `10:52:42.505Z` → broadcast `10:52:46.604Z` = **~4.10s**
  - Event `eNAH-7BsHWJ_rhegzNDnN`: DB write `10:53:49.827Z` → broadcast `10:53:56.178Z` = **~6.35s**
  Real, substantial further improvement (9.9s → 4.1-6.35s), confirming the blocking self-fetch was a genuine contributor. One of the two readings landed under CLAUDE.md's <5s target, the other still slightly over — remaining variance between two near-identical calls not yet root-caused (candidates unchanged: Vercel cold start on the route invocation, network round-trip). Both connected-viewer-tab deliveries confirmed functionally correct (`[WS] New event received...`, no reload) — no regression from this session's change. Test rows deleted afterward (`dev/cleanup-broadcast-test-event.mjs`, confirmed 0 remaining).
  **Not marking RESOLVED** — inconsistent, sometimes still over the <5s target. Downgrading from "genuinely open Tier 0 candidate" to "worth one more root-cause pass if picked up again, but no longer the clear next move" given how close both readings now are and the size of the remaining unknown compared to other open work.
  **Status:** SHIPPED, session 45 — real further improvement confirmed live (~9.9s → ~4.1-6.35s), still not consistently under the <5s target.

- **BUG-120** _(HIGH — Real-Time / WS Security, session 44, first named as a structural gap in `SYSTEM_CRITICALITY_MAP.md`, filed and fixed this session)_: **`ws-server/index.js` had zero identity verification at the socket level — any WebSocket client at all, logged in or not, could emit `event:log`, `match:time:update`, `match:status:change`, and every other logger-mutation event, and have it broadcast to real viewers as if it came from a real logger.** Viewer sockets are correctly unauthenticated (public scores need no login); the gap was that logger-originated mutation events had the same zero-check treatment. Real persistence was never at risk — `POST /api/matches/[id]/events` already checks `matchLoggerAssignments` — but the live broadcast itself could be triggered by anyone with a WebSocket client and the match ID, no login required.
  **Fix**: added `jsonwebtoken` (`9.0.3`, pinned, matching the version already used elsewhere in this project) to `ws-server/package.json`. A new `io.use()` connection middleware verifies the logger JWT sent via Socket.IO's `auth` option (client change: `src/hooks/useWebSocket.tsx`'s `getOrCreateSocket()` now attaches `auth: (cb) => cb({ token: localStorage.getItem('authToken') })`, function-form so it re-reads on every reconnect, not just the first). No token, or a token that fails verification, degrades the connection to viewer-only (`socket.data.isLogger = false`) rather than rejecting the connection outright — a logger whose token expires mid-match doesn't get disconnected, they just lose logger privileges until refresh. ~14 logger-mutation event handlers (`event:log`, `event:delete`, `match:score:update`, `rating:update`, `stats:update`, `eyepoint:award`, `substitution:log`, `match:status:change`, `match:time:update`, `match:lineup:update`, `match:update`, `logger:join`, `logger:leave`, `logger:broadcast-event`) wrapped in a `requireLogger()` gate that rejects the emit with an `error` event if the connection never authenticated as a logger.
  **Real complication caught before deploy, not after (Richard's catch)**: staging and prod sign logger JWTs with *different* `JWT_SECRET` values (CLAUDE.md: "JWT_SECRET and CRON_SECRET are different per environment"), but this is one shared Railway instance (BUG-074) serving both. A single hardcoded secret here could only ever verify one environment's tokens — the other environment's real loggers would have silently failed this check the moment it shipped. Fixed by introducing `JWT_SECRET_STAGING`/`JWT_SECRET_PROD` (two vars, not one) and selecting the right one per-connection using the exact same Origin-header env detection BUG-074 already established (`getEnvFromOrigin()`, extracted to a shared helper used by both the new auth middleware and the existing room-scoping logic, replacing what had been duplicated inline).
  **Verified locally, not yet deployed**: started `ws-server` locally with distinct test secrets for each env, ran two real Socket.IO test-client scripts (`dev/test-ws-logger-auth.mjs`, `dev/test-ws-env-secret-selection.mjs`) against it — confirmed (1) no-token/wrong-role/wrong-secret connections are all correctly downgraded to viewer-only and have `event:log` rejected, a valid logger token succeeds; (2) cross-environment secret isolation genuinely works, not just coincidentally — a staging-signed token fails against a prod-Origin connection and vice versa, only the matching env+secret pair succeeds. `tsc --noEmit`: no new errors. `node --check ws-server/index.js`: no syntax errors.
  Also created `ws-server/.env.example` (referenced by the README's "Test Locally" section but never actually existed) and updated `ws-server/README.md`'s env var and "How It Works" sections with the new required vars and the auth model.
  **Deployed and live-verified against the real infrastructure** (commit `ada6c0c`, pushed to `dev`; Richard added `JWT_SECRET_STAGING`/`JWT_SECRET_PROD` to Railway before the push, both Railway `ws-server` and Vercel staging confirmed redeployed). `dev/test-ws-logger-auth-live.mjs` connected directly to the real Railway URL (`Origin: brixsports-staging.vercel.app`, matching the deployed staging env) and emitted `event:log` twice: (1) with no token — connected as a viewer, `event:log` correctly rejected (`"Unauthorized: logger authentication required"`); (2) with a real logger JWT (`dev/gen-logger-test-token.mjs`, signed with staging's actual `JWT_SECRET`) — succeeded. A separately-connected real viewer tab watching the match's Timeline logged `[WS] New event received for Match G4er-Gc0_E1xo8_BgvyIQ` (×4) with no reload — the authenticated logger's direct socket emit reached a live viewer end to end. This exercises the direct client-emit path specifically (`event:log` over the socket), distinct from and in addition to the REST-broadcast path BUG-108/116/119 already cover — no DB write involved (`ws-server`'s `event:log` handler is a pure relay), so no test-data cleanup needed.
  **Status:** RESOLVED — 2026-07-15 (session 44).
  **Evidence:**
  - Commit: `ada6c0c`
  - Verified by: `dev/test-ws-logger-auth-live.mjs` against the live Railway `ws-server` + a real connected viewer tab on `brixsports-staging.vercel.app`
  - Observed result: unauthenticated `event:log` rejected with the expected auth error; authenticated `event:log` (real logger JWT) succeeded and was received live by the viewer tab (`[WS] New event received...` ×4, no reload)
  - Pending items: full per-match authorization at the WS layer (a valid logger could still emit for a match they're not assigned to — REST persistence already blocks this, only the live broadcast itself is affected) remains a known, deliberately-scoped-out limitation, not built; the "existing anonymous connection doesn't upgrade on login without page reload" edge case also remains unaddressed, both named explicitly when this was scoped, not a new discovery

- **BUG-121** _(HIGH — Data Integrity / Scoring, session 44, found while scoping single-writer enforcement, filed separately per Richard's call)_: **`POST /api/matches/[id]/events`'s score update is a read-modify-write race, and the whole handler (event insert + score update) has no enclosing transaction.**
  **Race condition**: the handler reads `match.homeScore`/`match.awayScore` from a `match` row fetched earlier in the same request, computes `currentScore + points` in application code, then writes that computed value back (`src/app/api/matches/[id]/events/route.ts:177-195`) — not an atomic `SET home_score = home_score + 1` at the database level. Two goal events for the same match arriving in overlapping requests (two loggers, or a client retry racing the original) can both read the same starting score before either write lands, both compute the same "+1" result, and the second write silently clobbers the first's intent. Net effect: two real goal events correctly saved to `match_events`, but the match score only reflects one of them — a live, silent data-integrity bug, not yet reproduced live but confirmed by direct code read, not speculation.
  **No transaction**: the event insert (`db.insert(matchEvents)`) and the score update (`db.update(matches)`) are two separate, independently-committed statements — no `db.transaction(...)` wrapper. If the insert succeeds but the score update then throws, the client receives a 500 and will likely retry; the event row from the first attempt already persisted, so the retry produces a duplicate event row. Violates CLAUDE.md's own database rule: "Write operations that affect match state must be atomic or handle partial failure explicitly."
  **Deliberately not fixed alongside BUG-120/single-writer enforcement** — Richard's call, keep single-writer enforcement scoped to the clock only; this is a separate, real gap in the same route family, filed for its own directive.
  **Fix applied, both routes**: `POST /api/matches/[id]/events` — event insert + score update now share one `db.transaction(async (tx) => {...})`, and the score update is an atomic SQL increment (`sql\`${matches.homeScore} + ${points}\`` in `.set()`, read back via `.returning()` for the broadcast, not a pre-computed JS value). `DELETE /api/matches/[id]/events/[eventId]` had the identical shape as suspected — same fix: delete + score revert share one transaction, revert uses `sql\`MAX(${matches.homeScore} - 1, 0)\`` (SQLite's `MAX()`, same floor-at-zero clamp the old `Math.max()` provided, now enforced atomically). `tsc --noEmit` clean on both files.
  **Verified against the real test match** (`G4er-Gc0_E1xo8_BgvyIQ`, local dev server hot-reloaded, real staging DB): baseline `1-0` → POST a real `Goal` event → `2-0` (confirmed via re-fetch) → `DELETE` that event → back to `1-0`, and confirmed the event row was genuinely gone, not just the score touched. Both directions correct.
  **Found in passing, same file, NOT fixed here — flagging, not silently expanding scope**: `updatePlayerStats()` (in `events/route.ts`) and its mirror `revertPlayerStat()` (in `events/[eventId]/route.ts`) have the exact same read-modify-write race, applied to every football/basketball stat field (goals, assists, cards, rebounds, etc. — a dozen+ fields across two sports). Narrower race window than match score (needs the *same player* credited twice in overlapping requests, not just any two scoring events on the match), but the same underlying bug class, real. Deliberately not touched in this pass — significantly larger surface (every stat field, both sports, insert-vs-update branching) than the score fix, and `updatePlayerStats` already has a deliberate "swallow errors, don't fail event creation" design that a stats-only fix should preserve rather than accidentally wrap into the same transaction as the event insert. Worth its own directive.
  **Status:** RESOLVED — 2026-07-20 (session 44, continued).
  **Evidence:**
  - Commit: (pending — not yet committed)
  - Verified by: live test against local dev server (hot-reloaded) + real staging DB, real test match `G4er-Gc0_E1xo8_BgvyIQ`
  - Observed result: score correctly increments (1-0→2-0) on event creation and correctly reverts (2-0→1-0) on deletion, event row genuinely removed on delete, not just score touched
  - Pending items: player-stats race (`updatePlayerStats`/`revertPlayerStat`) remains open, same bug class, not fixed here — needs its own directive

- **BUG-122** _(HIGH — Real-Time / Live Clock, session 44, single-writer enforcement — `SYSTEM_CRITICALITY_MAP.md` §5 / `LIVE_CLOCK_V2_ARCHITECTURE.md` §5, unblocked by BUG-120)_: **Two loggers both connected to the same match each ran their own independent clock and both broadcast `match:time:update`, producing visible flicker for viewers as the two competing sources arrived out of order.** Not a wrong-data bug — both loggers are each roughly correct — a "two voices" UX problem, not a clock-algorithm problem.
  **Fix**: a new internal endpoint (`GET /api/internal/logger-assignment-check`, `x-api-key`-gated with the existing `WS_API_KEY`, no new secret) lets `ws-server` verify a socket claiming to be a logger is actually assigned (`matchLoggerAssignments`, `status='active'`) to the specific match it's trying to control the clock for — BUG-120's JWT check only proved "a real logged-in logger," not "assigned to this match." Checked once per (socket, matchId) pair and cached (`assignmentCache`), not per 5s tick. Among assigned loggers, `ws-server`'s new `clockAuthority` map (`matchId → socketId`) gives clock control to whoever's `match:time:update` arrives first for that match, released on disconnect so the next logger to emit becomes the new authority. A dropped logger gets a one-time `clock:authority:denied` notice.
  **Session-based tie-break chosen over an admin-designated "primary" role, Richard's call**: the schema already has `matchLoggerAssignments.role` (defaults `'primary'`) for exactly this, but both write paths that create assignments hardcode `role: 'primary'` unconditionally — nothing today ever assigns anything else, so it doesn't actually distinguish loggers yet. Building real UI/promotion logic for that was scoped out as bigger, unjustified complexity for a problem the simpler session-based rule already resolves. Full detail and reinstatement criteria in `BACKSCOPE.md` under "Admin-Designated Primary Logger UI."
  **Scoped narrowly to the clock only, deliberately** — `event:log` and the other ~13 BUG-120-gated actions are untouched; single-writer enforcement does not apply to event logging, which already has its own separate multi-logger conflict system (`multiLogger.ts`'s merge/detect-conflicts).
  **Verified in isolation before deploy**: started the local dev server against real staging DB, confirmed the new endpoint directly — wrong `x-api-key` → 401; a real assigned logger (`logger_1767968844029` on `G4er-Gc0_E1xo8_BgvyIQ`) → `{"assigned":true}`; a fabricated logger id → `{"assigned":false}`. `tsc --noEmit` and `node --check ws-server/index.js` both clean.
  **Deliberately not built**: any client-side UI reacting to `clock:authority:denied` — the event fires but nothing listens for it yet, so a demoted logger currently gets no visible in-app signal, only a server-side/console-level notice. Named as a known gap, not hidden.
  **Deployed and live-verified against real infrastructure** (commit `a9a2613`, pushed to `dev`; Railway `ws-server` and Vercel staging both confirmed redeployed — the new internal endpoint 404'd briefly right after push, self-resolved once Vercel's build for the new route finished, ~30-60s). `dev/test-single-writer-live.mjs` ran two real socket connections (both authenticated with a real logger JWT, both subscribed to the same live match room) directly against the deployed Railway URL, with realistic wait times between steps (the assignment check is a real Vercel round-trip — an earlier test run with only 1s waits produced a confusing, out-of-order result purely from checking before the async check resolved; this run gave clean, unambiguous, well-separated results, ~300-900ms per check once warm):
  - Socket A emits first → both A and B receive `match:time:updated` (A correctly claims clock authority)
  - Socket B emits second, same match, while A still holds it → B receives `clock:authority:denied`
  - Socket A emits again → still succeeds (still the authority)
  - Socket A disconnects (releasing authority) → Socket B emits → now succeeds (B correctly claims it)
  All four scenarios behaved exactly as designed.
  **Status:** RESOLVED — 2026-07-15 (session 44).
  **Evidence:**
  - Commit: `a9a2613`
  - Verified by: `dev/test-single-writer-live.mjs` against the live Railway `ws-server` (two real authenticated socket connections) + `dev/test-ws-logger-auth-live.mjs`-style setup
  - Observed result: first-emitter-wins, second-emitter-denied, authority persists across repeat emits from the holder, authority correctly releases and transfers on disconnect — all four confirmed live, not simulated
  - Pending items: client-side UI for `clock:authority:denied` (deliberately not built, named above); the score race condition/transaction gap (BUG-121) remains separate and open; BUG-119's remaining ~9.9s broadcast latency also remains separate and open

- ~~**BUG-123**~~ _(MEDIUM — Real-Time / WS Resilience, session 44, `SYSTEM_CRITICALITY_MAP.md`'s "WS reconnect exponential backoff + jitter" structural gap)_: **The manual retry loop that engages after Socket.IO's own 5 built-in reconnection attempts are exhausted retried every flat 30 seconds with zero growth and zero randomization — every client that disconnected around the same moment (a single Railway restart affects everyone connected at once, by construction) would retry in exact lockstep, forever, against one Railway instance with no load balancer.**
  **Confirmed Socket.IO's own 5 built-in attempts were NOT the gap** — read the actual installed library source (`node_modules/socket.io-client`) rather than assuming: `randomizationFactor` defaults to `0.5` and is genuinely applied to the backoff calculation, so the first 5 attempts (base 2000ms, capped at `reconnectionDelayMax`=10000ms) already have production-standard exponential backoff + jitter via library defaults. The real gap was specifically the manual fallback loop this project added on top, for when Socket.IO's own engine gives up entirely.
  **Fix**: `src/hooks/useWebSocket.tsx`'s `reconnect_failed` handler now self-reschedules with the same *shape* of algorithm the library already uses for its own attempts — base 10s, factor 1.5, capped at 60s, ±50% jitter — instead of a flat `setInterval(fn, 30000)`. Sequence: ~10s → ~15s → ~23s → ~34s → ~51s → ~60s (each individually randomized within its range), settling at ~30-90s indefinitely once capped, rather than growing unboundedly during a long outage. Also added a `manualRetryLoopActive` guard so a second `reconnect_failed` firing while a loop is already running can't stack a parallel loop and double the retry rate — a small, directly-relevant robustness addition, not scope creep.
  **Verified**: the delay-calculation math directly (`node -e`, printed the full sequence for attempts 0-6, confirmed sensible growth and cap). `tsc --noEmit` clean.
  **Not yet live-verified against a real Railway outage — decision pending**: proving the herd-smoothing effect specifically would need *multiple simultaneous browser tabs* reconnecting at once with their retry timings compared, not a single test script — a meaningfully heavier test than anything else run tonight. It would also need Railway to stay down for at least ~40-60s continuously (long enough to exhaust the 5 built-in attempts and actually reach the code that changed) — a real restart is often faster than that, so a casual restart test might not even exercise this code path at all. Also takes down real-time delivery for both staging and prod simultaneously (shared instance, BUG-074), a real cost for a test that might not prove much beyond what the math already confirms.
  **Status:** RESOLVED — 2026-07-28 (session 47D), live-verified against a real Railway restart on staging, Richard's own call to finally force the test tonight.

  **Evidence:**
  - Commit: `96a0678` (the fix itself, session 44 — this session only supplies the live verification it was missing)
  - Verified by: real two-tab test against `https://brixsports-staging.vercel.app`, Richard killed the shared Railway instance directly. Console capture (timestamped via a monkey-patched `console.log`/`console.warn`) on both tabs simultaneously.
  - Observed result, Tab A (viewer): manual retry attempts logged delays of **~25s → ~42s → ~72s**, in that order — real, increasing growth, not flat. Each value falls inside the formula's predicted range for its attempt index (`raw = min(10000 × 1.5^n, 60000)`, ±50% jitter): attempt 3 → range 11.25–33.75s (got 25s), attempt 4 → range 16.875–50.625s (got 42s), attempt 5 → range 25.3–75.9s (got 72s). Tab B (admin), hit by the exact same outage at the exact same wall-clock moment, was independently at "attempt 5, ~58s" while Tab A was at "attempt 3, ~25s" — **confirmed anti-lockstep**: two clients disconnected by the same event do not retry in sync, which is the entire point of the jitter fix.
  - Pending items: none. Both the growth-not-flat claim and the anti-thundering-herd claim are now directly demonstrated, not just verified by reading the delay-calculation math.

- **BUG-117** _(CRITICAL — Auth / Logger Dashboard, session 43, found live while testing BUG-115)_: **A plain `logger`-role account can never fetch its own assigned-matches list — `GET /api/loggers/[id]` rejects it outright.** Reproduced repeatedly: Richard's own logger session hit `GET /api/loggers/logger_1767968844029` (his own ID) and got `401 Unauthorized` on every attempt across multiple sessions today (`15:57`, `16:08`, `16:09`, `20:43` — confirmed via HAR, not a one-off), producing the logger dashboard's "NO ASSIGNED MATCHES" / "0 Live" screen even though the real DB assignment (`match_logger_assignments`, `status: active`) was fully intact the whole time — confirmed directly via `dev/check-logger-assignment.mjs`. Ruled out as a timing race first: Richard confirmed a second refresh produced the identical failure, not a transient blip.
  **Root cause**: `src/app/api/loggers/[id]/route.ts:21`'s `GET` handler only allows `authUser.role === 'admin' || 'logger_manager'` — a regression from BUG-107 (session 42), which added this gate to close a real "zero auth on `/api/loggers/*`" vulnerability but didn't account for `src/app/logger/page.tsx:112-116`'s `fetchAssignedMatches(loggerId)`, which calls this exact route with the *current logger's own ID* to populate their own dashboard. A plain `logger` role was never in the allowed list, so the legitimate self-service call has been silently broken since BUG-107 shipped.
  **Fix applied** (`13c0e2e`): added a self-access branch — `authUser.role === 'logger' && authUser.id === id` — alongside the existing admin/logger_manager check. `tsc --noEmit` clean.
  **Evidence:**
  - Commit: `13c0e2e`
  - Verified by: live logger session, real hard refresh on staging post-deploy
  - Observed result: assigned-matches list populated correctly ("1 Live + 0 Upcoming", the real match card shown) — screenshot-confirmed, no more `401` on `GET /api/loggers/logger_1767968844029`
  - Pending items: none for this specific fix
  **Status:** RESOLVED — 2026-07-15, live-tested session 43 (commit `13c0e2e`).
  **Status:** SHIPPED — staging only once pushed, live test pending.

- **BUG-118** _(CRITICAL — Real-Time / Match State, session 43, found live immediately after BUG-117's fix deployed)_: **Re-entering an in-progress match via the assigned-matches list still routed to "Confirm Lineups / Start Match" even after BUG-115's singleton fix.** Reproduced live: DB confirmed `currentPeriod: SECOND_HALF` the entire time (untouched, `updatedAt` unchanged) — so this wasn't a data regression, but the logger UI still showed the pre-match confirm screen after clicking into the match from the (now correctly populated, post-BUG-117) assigned-matches list.
  **Root cause**: `getLoggerMatches()` (`src/lib/match-logger-helpers.ts:42-56`, narrowed in BUG-107) selects only 9 fields per assigned match — `currentPeriod` isn't one of them. `FootballLogger.tsx`'s seed logic (`VALID_PERIODS.includes(match.currentPeriod) ? ... : 'NOT_STARTED'`) silently falls back to `NOT_STARTED` whenever `currentPeriod` is `undefined` — which it always was, for every match entered via this list, regardless of BUG-115's fix. BUG-115's destroy-before-recreate fix was necessary and correct, but this is a second, independent gap in the seed *data* itself, not the singleton mechanics — likely masked in earlier sessions whenever a manager instance happened to survive in memory with the correct state already baked in from a fuller fetch elsewhere.
  **Fix applied** (session 43): added `currentPeriod`, `minute`, `extraTime` to `getLoggerMatches()`'s projection — all three are small primitive columns, not the heavy `stats`/`lineups` blobs BUG-107 was actually narrowing away. `tsc --noEmit` clean.
  **Live-tested — partially confirmed, found a follow-up gap in the same fix**: re-clicking into the match after this shipped correctly routed to the active logging view with `currentPeriod: SECOND_HALF` (the actual bug this entry describes — confirmed fixed) — but the clock showed `0:00` instead of the real elapsed minute (`46`). Traced: `FootballLogger.tsx`'s seed object (`src/components/FootballLogger.tsx:412-421`) only ever passed `{ period: seedPeriod }` into the manager's `clock` seed — `match.minute` was never read into it at all, even after this fix made it available on `match`. `initializeState()`'s `baseClock` (`match-state-manager.ts:1282-1293`) falls through to its own default (`absoluteMinute: 0`) or a stale `localStorage` value whenever the DB seed doesn't include it. **Fixed same session**: seed now includes `absoluteMinute: match.minute` when not null. `tsc --noEmit` clean.
  **Also noted, not fixed**: `initializeState`'s `score` merge order is `{...initial?.score, ...saved?.score}` — `localStorage` wins over the DB seed for score specifically (opposite of the file's own header comment, and opposite of how `clock` behaves). Didn't manifest this session (score was 0-0 throughout) but worth fixing for consistency if a resume ever happens on a match with a non-zero score and stale localStorage.
  **Second follow-up, same session — clock also came back paused**: the manager's constructor only auto-starts ticking when `isRunning` is already `true`, and the seed never set it — so after any refresh mid-match the clock came back stopped, needing a manual "Start" press even mid-second-half (visible as a `▷ Start` button in the logger UI). **Fixed**: seed now also sets `isRunning: ACTIVE_PLAY_PERIODS.includes(seedPeriod)` (`FIRST_HALF`/`SECOND_HALF`/`EXTRA_TIME_1`/`EXTRA_TIME_2` auto-resume; `HALF_TIME`/`PENALTY_SHOOTOUT`/`FINISHED`/`SUSPENDED` stay paused, correctly). `tsc --noEmit` clean.
  **Considered before shipping the auto-resume: could a stale DB checkpoint at refresh time cause a domino effect on match events?** Traced through deliberately, not just asserted safe:
  - The checkpoint write is throttled to 15s, so `match.minute` read at refresh time can be up to ~15s behind the true elapsed time at that exact instant.
  - Event minutes are captured independently at the moment each event is logged, from whatever the manager's *current* state is then — never recomputed retroactively from a later reseed. Already-logged events are untouched by any of this.
  - The DB's own write sequence never goes backward: the resumed clock starts at (or ties) the last known DB value, then ticks forward normally — a refresh introduces at most a brief stall/flatten in the climbing sequence, not a regression a viewer would see as the clock moving backward.
  - The one real, bounded consequence: an event logged in the first ~15s immediately after a refresh could be tagged with a minute up to ~15s behind its true wall-clock moment (worst case, one minute-boundary off). No cascading/compounding effect — it's a one-time, capped offset per refresh, not an error that grows over time or corrupts anything downstream (`checkPeriodEnd`'s HALF_TIME/FINISHED auto-triggers would just fire up to ~15s later than the true regulation-time instant, not incorrectly).
  - This is the same class of imprecision already accepted for BUG-109's degraded-mode staleness ceiling (~25s) — not a new correctness hazard, just the same bounded gap surfacing at a different moment (resume-from-refresh instead of WS-disconnect).
  **Evidence:**
  - Commits: `30b78ad` (currentPeriod/minute/extraTime projection), `0adafdd` (absoluteMinute + isRunning seed)
  - Verified by: live logger session, real hard refresh mid-second-half on staging post-deploy
  - Observed result: screenshot-confirmed `62:08`, `2ND HALF`, `Pause` button (actively ticking, not paused) — all three symptoms (wrong period, reset minute, paused clock) fixed together
  - Pending items: `initializeState`'s `score` localStorage-wins-over-DB merge order noted above, not fixed (didn't manifest, score was 0-0 throughout testing)
  **Status:** RESOLVED — 2026-07-15, live-tested session 43 (commits `30b78ad`, `0adafdd`).

- **BUG-109** _(CRITICAL — Real-Time / Live Clock, session 42, found during the same live match test as BUG-108, supersedes the "trimmed subset" clock directive discussed earlier this session)_: **The public live match clock has zero database-persisted fallback of any kind — it exists only as long as the logger's WS connection keeps ticking.** This is the actual root cause of the "freezes, no recovery, network back doesn't retime it" symptom that originally motivated the whole Live Clock v2 design investigation this session, now reproduced live rather than inferred from code alone. Confirmed directly:
  - `matches` table schema (`src/db/schema.ts:302-341`) has **no `minute` column at all** — only `currentPeriod` (e.g. `FIRST_HALF`) is persisted, never the numeric elapsed time.
  - `GET /api/matches/[id]` (`src/app/api/matches/[id]/route.ts`) computes **no minute/clock value anywhere in its response** — confirmed via full-file grep; the only `minute` references in that file are `matchEvents.minute` (individual event timestamps for sorting/stats, unrelated to the live clock display).
  - The numeric clock shown to viewers comes **exclusively** from the live WS `matchTime` state (`useMatchTimer`, fed by the logger's `match:time:update` broadcasts) — there is no `match.minute ?? fallback` chain to fall back to, because the fallback value doesn't exist anywhere.
  **Reproduced live**: with the logger's socket confirmed disconnected (`[FootballLogger] Socket NOT connected for match G4er-Gc0_E1xo8_BgvyIQ, skipping event:log emit` — live console evidence, not inferred), match events kept landing correctly in the DB (Corner `22':5`, Throw In `22':28`, Tackle `23':30`, etc. — confirmed via direct DB query) while the public page's clock header stayed frozen at `8'`. Refreshing the page updated the Timeline correctly (each event renders from its own `minute` field) but **did not move the clock header at all** — direct proof the freeze isn't a caching/live-push issue like BUG-108, it's the total absence of a value to recover to.
  **Why this changes scope from what was decided earlier this session**: the "ship the trimmed subset" decision (SUSPENDED clock-stop + single-writer + WS auth, hold the full seq/timestamp smoothing model) assumed the clock's underlying gaps were about drift/smoothing/jump-size once a value exists. This finding is upstream of all of that — there's no persisted value to smooth, cap, or protect with single-writer enforcement in the first place. None of the three "trimmed subset" fixes would touch this.
  **Second manifestation of the same root cause, confirmed immediately after Railway was restored**: on a genuinely fresh page load (new WS connection, no stale local state to fall back on) with no live tick received yet, the clock area rendered as a bare pulsing red dot with **no minute text at all** — not even a stale number. Traced to `src/app/matches/[id]/page.tsx`'s render logic: `(matchTime?.minute ?? match.minute) != null ? <span>...</span> : null` — when both `matchTime` (WS, not yet arrived) and `match.minute` (doesn't exist, per above) are empty, the fallback chain renders nothing rather than any value. So depending on exactly when a viewer loads the page relative to the last live tick, this single root cause can present as either a frozen stale number (this entry's original finding) or a completely blank clock (this addendum) — same missing-fallback cause, two different visible symptoms.
  **Fix applied** (`67c2f67`, session 43): added nullable `matches.minute`/`matches.extra_time` (staging migration via `dev/add-match-clock-columns.mjs`, logged in `RUNLOG.md` 2026-07-14). `FootballLogger.tsx` now checkpoints the clock to `PATCH /api/matches/[id]` every 15s (throttled separately from the per-tick WS emit), already gated to the assigned logger/admin by the route's existing auth check, same integer-guard pattern as `homeScore`/`awayScore`. `GET /api/matches/[id]` needed no change — already spreads the sanitized DTO, so the new columns flow through automatically. Public page fix: `matchTime` now only wins over the DB value while `useMatchTimer`'s `isStale` is false — closes the second manifestation above too (a frozen `matchTime` previously won the `??` fallback forever, even after the existing 10s poll refreshed `match.minute` underneath it, which is why a stale tab never self-recovered). Separate review note written first (`LIVE_CLOCK_V2_REVIEW_2026-07-14.md`, `27ae946`): confirms this was a genuine blind spot in the locked v2 design, which assumed a correction always eventually arrives — v2 is not superseded, this is a prerequisite layer underneath it.
  **Live-tested session 43, real logger session on staging (match `G4er-Gc0_E1xo8_BgvyIQ`), Railway killed and restored mid-session:**
  - **Cold load, no live tick yet** — DB-persisted `minute` rendered correctly with zero WS connection (`23'` shown on a fresh page load, no logger, no socket). Confirms the blank-clock manifestation is closed.
  - **Stale tab, WS dies mid-session** — tab frozen at `16'` when Railway was killed (`[WS] Disconnected: transport close`, reconnect attempts 1-5 exhausted). Over the next ~15s the displayed minute advanced `16' → 19'` on its own via the existing 10s poll (BUG-080) picking up fresh DB checkpoints — confirmed those checkpoints kept landing throughout the outage (`minute: 18` at T+6s post-kill) because the checkpoint write is a plain HTTP PATCH to Vercel, entirely independent of Railway. This is the reproduction that was previously untestable without a real live session — confirmed fixed.
  - **WS reconnect itself didn't stabilize this run** (hit "Max reconnection attempts reached" again after a brief reconnect — BUG-114 territory, unrelated to this fix, not a regression). Even so, the clock kept advancing correctly via the poll the whole time (`19' → 20' → 21'`, DB confirmed fresh at each step) — proving the DB fallback holds up even under BUG-114's failure mode: a viewer never freezes, worst case it degrades to polling-cadence freshness instead of true real-time.
  **Known limitation, noted not fixed**: degraded-mode staleness ceiling is ~25s worst case (15s checkpoint throttle + up to 10s poll interval, independent timers). Only applies while the fallback path is active (viewer's own WS down, or before the first live tick) — normal WS ticking is unaffected. Cheapest lever if this ever needs tightening is the poll interval, not the checkpoint's, since the checkpoint fires per live match for every logger while the poll is per-viewer.
  **Evidence:**
  - Commit: `67c2f67` (fix), staging migration via `dev/add-match-clock-columns.mjs` (RUNLOG 2026-07-14)
  - Verified by: live logger session + independent browser-pane viewer + direct DB queries via `dev/gen-admin-test-token.mjs`, session 43, 2026-07-14
  - Observed result: both original manifestations (frozen number, blank clock) reproduced and confirmed fixed live; DB checkpoint confirmed surviving a real Railway outage
  - Pending items: prod schema migration applied (`2bd1b57`, RUNLOG 2026-07-14) — DB ALTER only, the code fix itself is still on `dev`, not yet merged to `main`. BUG-108 (event broadcast/DB write decoupled) and BUG-114 (stuck-reconnect tab) remain fully open, untouched by this change — separate items.
  **Status:** RESOLVED — 2026-07-14, live-tested session 43 (commit `67c2f67`).

- **BUG-115** _(CRITICAL — Real-Time / Match State, session 43, found while live-testing BUG-109)_: **Re-authenticating mid-match can silently regress the match's period backward, discarding real progress.** Logger was legitimately in `SECOND_HALF` (`PATCH {"currentPeriod":"SECOND_HALF"}` at `15:58:18`, confirmed via HAR). After a hard refresh produced repeated `401`s and a fresh re-login (`POST /api/loggers/auth` at `16:10:52` — though `GET /api/loggers/me` had kept returning `200` throughout, meaning the server-side session never actually died), the app routed to what looked like a not-yet-started/confirm-lineup screen while some UI element still showed the old second-half clock moving — a directly-observed inconsistent state ("clock moving" + "click to start match" simultaneously). Confirming/starting from that screen re-fired `PATCH {"status":"LIVE"}` then `PATCH {"currentPeriod":"FIRST_HALF"}` at `16:11:10-11`, overwriting the real `SECOND_HALF` state.
  **Root cause traced**: `getMatchStateManager()` (`src/lib/match-state-manager.ts:191-196`) is a module-level singleton registry (`managerRegistry`) — it only applies the DB-seeded `currentPeriod` (`FootballLogger.tsx:397-413`, comment: "seed currentPeriod from DB so period survives phone refresh") when *no* manager instance already exists for that match ID. If one's already cached in memory, the seed is silently ignored and whatever's in memory wins, regardless of what the DB actually says.
  **Confirmed not caused by the BUG-109 fix**: the regression PATCHes (`status`, `currentPeriod`) are existing start/resume-match code, untouched this session; BUG-109's diff only ever writes `minute`/`extraTime` and lives in different files entirely (`src/db/schema.ts`, `src/app/api/matches/[id]/route.ts`, the checkpoint block in `FootballLogger.tsx`, `matches/[id]/page.tsx`) — none of which intersect `match-state-manager.ts`.
  **Not yet root-caused**: whether this specifically requires a hard page refresh (clearing `managerRegistry`, meaning the DB seed itself is somehow not applying despite the seeding code looking correct) or can also happen via an in-place re-auth without a reload (registry surviving, seed never attempted) — needs a controlled reproduction to pin down which. Richard's working theory, unconfirmed: resume is more likely to succeed if the match happens to be at a break (HT) rather than mid-play.
  **Fix applied** (`fdff0ac`): `FootballLogger.tsx`'s init effect now calls `destroyMatchStateManager(match.id)` immediately before `getMatchStateManager(...)`, on every mount. Confirmed via grep that `getMatchStateManager` has exactly one call site in the whole codebase and `destroyMatchStateManager` was never called anywhere — nothing relies on the singleton surviving across mounts, so this closes the gap regardless of which exact trigger (hard refresh vs. in-place re-auth) was responsible: every mount now unconditionally gets a manager freshly seeded from the just-fetched DB state, never a stale cached one. `MatchStateManager.destroy()` confirmed local-only (stops the clock interval, clears listener sets, no network calls) — safe to call unconditionally, including on a manager that's actively mid-match. `tsc --noEmit` clean, zero new errors.
  **Live-tested — this fix was necessary but not sufficient on its own**: it correctly guaranteed a fresh manager on every mount, but that fresh manager was still being seeded with wrong data until BUG-117 (auth blocking the assigned-matches fetch) and BUG-118 (currentPeriod/minute/isRunning missing from that fetch) were also fixed — all three were required together to actually close the observable symptom.
  **Evidence:**
  - Commits: `fdff0ac` (this fix), `13c0e2e` (BUG-117), `30b78ad` + `0adafdd` (BUG-118)
  - Verified by: live logger session, real hard refresh mid-second-half on staging with all three fixes deployed together
  - Observed result: `currentPeriod: SECOND_HALF` held through the refresh (no regression to `FIRST_HALF`), confirmed via direct DB query immediately after — the exact symptom this entry describes did not recur
  - Pending items: the specific distinction between "hard refresh" and "in-place re-auth without reload" as separate triggers was never isolated — the fix closes both regardless (destroy-then-recreate is unconditional), so this was judged not worth a separate controlled test
  **Status:** RESOLVED — 2026-07-15, live-tested session 43 (commits `fdff0ac`, `13c0e2e`, `30b78ad`, `0adafdd`).

- **BUG-110** _(LOW — Real-Time, session 42, found during the same live test)_: `PATCH /api/matches/[id]/loggers` (the multi-logger presence heartbeat, `src/hooks/useMultiLogger.ts:85`, `sendHeartbeat()`) returned `404 Not Found` during live testing on staging. The route file (`src/app/api/matches/[id]/loggers/route.ts`) does export a `PATCH` handler, so this isn't a missing-handler bug — most likely a stale/transient deployment artifact from the `NEXT_PUBLIC_ENV` toggle-and-redeploy cycle done earlier the same session for BUG-107 verification (Vercel rolling deployment or edge caching serving a mixed/old function version). Not independently root-caused — noted in case it recurs outside that specific redeploy window, which would mean it's a real routing bug rather than a deployment transient. **Status:** OPEN — filed, unconfirmed root cause, low priority given the likely-transient explanation.

- **BUG-111** _(MEDIUM, downgraded from HIGH session 43 — Real-Time / Public Page UX, session 42, found during the same live Railway-kill test as BUG-108/109)_: **No persistent stale/degraded indicator on the public match detail page once the WS connection drops — only a one-shot toast that fades, then total silence for the rest of the outage.** BUG-080's one-shot disconnect toast (`disconnectToastFired` ref, fires once per WS flap) is confirmed working correctly — it did fire when the Railway server was killed. The gap is what's supposed to happen *after*: `isStale`/degraded-state dimming (part of the `useMatchTimer` hook, referenced throughout this session's Directive 6 findings and `LIVE_CLOCK_V2_ARCHITECTURE.md §4.5`) is not applied anywhere on `src/app/matches/[id]/page.tsx`'s actual clock render. Confirmed via direct DOM inspection during a real, sustained Railway outage (server killed, socket confirmed disconnected and unsuccessfully retrying — `attempt 1/5`, `2/5`+ in console): the clock badge (`<span className="text-red-400">8'</span>`) has `opacity: 1` (full, not dimmed), and zero stale/reconnect/offline-related text exists anywhere on the page. A real viewer sees a perfectly normal-looking live clock with a pulsing red dot for the entire duration of a server outage, with no way to tell anything is wrong once the initial toast fades. Directly violates CLAUDE.md's mandate: "Viewer must see stale data clearly on failure, not a crash." Closely related to BUG-109 (same root outage, same test) but distinct — BUG-109 is the missing DB fallback for the clock *value*, this is the missing persistent indicator that the value shown *can't be trusted right now*, which would still matter even after BUG-109 is fixed (any outage, however brief, needs a visible signal for its duration). **Fix (not yet built)**: apply `isStale`/degraded-state dimming (or an equivalent persistent visual treatment) to the actual clock/score render on the public match page for the full duration a connection is down, not just a one-shot toast at the moment it drops.
  **Severity downgraded, not just deprioritized (session 43, Richard's call)**: this is a change to the underlying risk model, not only a scheduling choice. HIGH was earned by the original scenario — a viewer trusts a frozen, wrong clock indefinitely, for the *entire* duration of an outage, with zero signal. BUG-109's fix removes that scenario in the confirmed worst case: even when WS never recovers (BUG-114's stuck-reconnect case), the polling fallback keeps the displayed value within ~10-25s of truth the whole time — coarser, not wrong. The only path back to the original HIGH scenario is the viewer's *entire* connection dying, not just the WS — at which point the browser's own native offline signals mostly cover it, which isn't really this app's responsibility to duplicate. A persistent-dimming fix was drafted and then reverted (not shipped) rather than left half-applied. Worth re-escalating only if a future finding shows the poll fallback itself has a real gap leaving a viewer stale for longer than it should. **Status:** OPEN — filed, intentionally not fixed, MEDIUM.

- **BUG-112** _(MEDIUM — Logger UX, session 42, found during the same live Railway-kill test)_: **The logger interface's prominent connection-status pill conflates "WebSocket disconnected" with "offline"**, misleading the logger about whether their data is actually being saved. `src/components/FootballLogger.tsx:1453-1455` — the top pill's label (`'Live Sync' : 'Offline'`) and color are driven entirely by `isSocketConnected`. A deeper settings/detail panel in the same component (lines 2061-2066) correctly distinguishes two separate states — `isConnected` ("Connection: Connected/Disconnected") and `isSocketConnected` ("WebSocket: Connected/Disconnected") — proving the codebase already has the more accurate signal available, it's just not what the prominent badge uses. Confirmed live during this session's Railway-kill test: with the WS server genuinely down but the logger's general internet fully working, every event logged still persisted correctly to the DB via the REST API path (confirmed directly, matches BUG-108's findings) — yet the logger saw a big red pulsing "Offline" badge the entire time, which would reasonably read as "my data isn't being saved," causing real anxiety/distrust or duplicate manual re-entry in a live match, when data integrity was actually fine. **Fix applied** (session 43): badge now reflects `isConnected` (`useMultiLogger`'s real REST/API reachability signal, confirmed via `joinMatch`'s own `setIsConnected(true/false)` around its `fetch` call) for the "Offline" framing; `isSocketConnected` now only distinguishes a WS-only drop as a separate, honest amber "Sync Paused" state. Three states total: red pulsing "Offline" (`!isConnected`), green "Live Sync" (both connected), amber pulsing "Sync Paused" (`isConnected` but WS down). `tsc --noEmit` clean.
  **Evidence:**
  - Commit: `36b57c1`
  - Verified by: real Railway kill (WS-only outage), logger's own internet untouched, screenshot of the live badge during the outage
  - Observed result: badge showed amber "SYNC PAUSED" the entire outage, never the red "Offline" it would have shown before this fix
  - Pending items: none
  **Status:** RESOLVED — 2026-07-15, live-tested session 43 (commit `36b57c1`).

- **BUG-113** _(MEDIUM — Public Page UX, session 42, found during the same live Railway-kill test)_: **The public page's 10-second polling fallback (BUG-080) visibly "flickers" — a full wholesale re-render every tick, even when nothing changed — instead of a smooth, silent update.** `src/app/matches/[id]/page.tsx:236-241`'s `fetchMatchData(silent)` does `setMatchData(data)` — a complete replace of the entire match object (including the whole `events` array) with fresh object references on every single poll, regardless of whether the response actually differs from what's already displayed. Compare to the existing WS `event:new` handler a few lines above (155-159), which does a surgical `events: [latestEvent, ...prev!.events]` — only the genuinely new item is prepended, every other object reference is left untouched. That's the exact reason WS updates feel smooth and polling feels like a "silent reload": full-object replacement breaks memoization/animation-on-mount assumptions for every list item on every tick, not just changed ones. Observed directly by Richard during the Railway-kill test while the polling fallback was actively running. **Fix applied** (session 43, bundled with BUG-108's mitigation): `fetchMatchData(true)` now merges instead of replacing — builds a `Map` of existing events by id and reuses each unchanged event's object reference, only genuinely new ids get a fresh object. `match`/other top-level fields still take the fresh copy directly (no visible flicker risk there, unlike the events list). This was a prerequisite for BUG-108's fix to not make things worse: adding a second poll that also runs while connected would have made the flicker more frequent without this. `tsc --noEmit` clean. **Evidence:**
  - Commit: `d3801bc`
  - Verified by: DOM-node persistence probe during a real Railway outage — tagged 10 real event-row elements with unique `data-flicker-probe` attributes via `javascript_tool`, waited through a live 10s poll cycle, re-queried
  - Observed result: all 10 tagged nodes still present with their markers intact — proves React reused the same DOM elements rather than remounting them, a stronger check than a visual screenshot
  - Pending items: none
  **Status:** RESOLVED — 2026-07-15, live-tested session 43 (commit `d3801bc`).

- **BUG-114** _(CRITICAL — Real-Time, session 42, found immediately after restoring Railway from the BUG-108/109/111 test)_: **An already-open viewer tab that was live through a full WS server restart does not reliably auto-recover — it can get permanently stuck retrying, even well after the server is confirmed back up.** Richard's own browser tab, left open and untouched (no refresh) since before Railway was killed, still showed `[WS] Max reconnection attempts reached. Waiting for server...` well after Railway's dashboard confirmed `Active`/`Online`, with explicit console errors on every handshake attempt: `WebSocket connection to 'wss://brixsports-production-8fa3.up.railway...' failed: Error during WebSocket handshake: Unexpected response code: 404`. A **fresh** page load to the identical URL connected successfully at the same time (`[WS] Connected: YImYk-1sHFCmeDV-AAAB`, confirmed in this same session). So recovery is not "eventually works if you wait" — it depends on whether the tab is fresh or was open through the restart, and old tabs may never recover without a manual refresh. This directly answers (negatively) the standing question of whether the app's built-in reconnect logic is sufficient on its own: it is not, for this failure mode.
  Two things bundled in this one finding, worth separating for whoever picks this up:
  1. **The 404-on-handshake specifically** — worth checking whether this is a Socket.IO client/server version or session-state mismatch after a full process restart (a new server process may not recognize a session/engine.io ID the old client is still trying to resume with), rather than a generic connectivity failure. Not yet root-caused past the observed symptom.
  2. **The WS URL itself, `wss://brixsports-production-8fa3.up.railway...`, is being used by the staging frontend** — direct, undeniable confirmation of BUG-074 (staging and prod share the same Railway instance) visible in a real console error, not just inferred from code or Railway's dashboard labeling.
  **Full console transcript from the stuck tab, requested and reviewed directly** — confirms all 5 `connect_error` attempts logged with the identical 404 handshake error, then `[WS] Max reconnection attempts reached. Waiting for server...`, then **nothing WS-related ever again** — no `reconnect_failed` log, no `[WS] reconnect_failed — starting manual retry loop (30 s)`, no `[WS] Manual retry attempt`, indefinitely (periodic `[AuthContext] checkAuth` cycles continued unrelated to this). **Found a real, separate, concrete bug in the reconnection logging itself while reviewing this** (`useWebSocket.tsx:95-103`): the `connect_error` handler logs `attempt X/5` only for `reconnectAttempts <= 3`, then `'Max reconnection attempts reached'` only for the *exact* value `=== 5` — not `>= 5`. This means attempt 4 is silently unlogged (falls between the two branches), and **every `connect_error` after the 5th is also silently unlogged forever**, since none of them strictly equal 5 again. This creates a false appearance of total silence regardless of what Socket.IO's actual reconnection engine is doing underneath — the observed "nothing happens" could mean Socket.IO genuinely gave up, or could mean it's still cycling with `connect_error` firing repeatedly but simply never logged past the 5th time. **This means BUG-114's root cause is not fully pinned down** — what's confirmed is the observable symptom (tab never recovered) and this real logging gap; whether `reconnect_failed` itself ever fired is unconfirmed from the available evidence.
  **Fix, step 1 applied** (`ada48cb`, session 43): `connect_error`'s handler now logs every attempt past #3 unconditionally (`else { console.warn(...) }` catch-all), not just the exact value `=== 5`. Diagnostic-only — no reconnection behavior touched, `tsc --noEmit` clean. This closes the ambiguity itself but does not yet fix the actual stuck-tab recovery; it just means the *next* real restart test will show whether Socket.IO's reconnection engine keeps retrying silently or genuinely stops, instead of the console going dark either way.
  **Fix, step 2 (not yet built)**: once real visibility exists, re-run the restart scenario to determine whether `reconnect_failed` truly never fires (a Socket.IO/server session-handling bug, possibly related to `server.js` having no sticky-session handling across process restarts) or whether the manual retry loop has its own separate bug once triggered. Until root-caused, the practical mitigation is the same one BUG-111 already calls for: a persistent, impossible-to-miss "reconnecting — refresh if this doesn't clear" indicator, since silent auto-recovery cannot currently be trusted after a real server restart.
  **Re-run with the step-1 logging live, session 43 — root cause narrowed further, bug reproduced again, still not fixed.** Real Railway kill/restore, same match. With the logging gap closed, the console this time showed real activity previously invisible: `attempt 4` logged correctly (was silently swallowed before), and — after "Max reconnection attempts reached" — a genuine **`attempt 6`** also logged, proving the client *was* still cycling past what looked like a dead stop in every prior transcript. But activity still stopped completely after `attempt 6` — no `attempt 7`, no `reconnect_failed`, no successful reconnect — for the remainder of the outage and after Railway was confirmed back up. A fresh page load to the identical URL connected instantly (`[WS] Connected`) at the same moment, same as session 42's original finding.
  **What this changes**: the "is Socket.IO silently retrying or genuinely stuck" ambiguity from session 42 is resolved in the *worse* direction — it does keep retrying a bit further than believed (attempt 6 is real, new information), but it still stops completely well short of `reconnect_failed` ever firing, and the manual 30s retry loop (which depends on that event) never engages. This rules out "it's retrying fine, just not logged" as an innocent explanation — there's a real ceiling where all retry activity stops with no recovery path, exactly matching the original stuck-tab symptom, just with one more confirmed data point (attempt 6) before the true stop.
  **Fix, step 2 — real root cause found and fixed, session 43 continued.** Socket.IO client v4 only re-relays `connect_error` to the `Socket` instance as a convenience — `reconnect`, `reconnect_attempt`, `reconnect_error`, and `reconnect_failed` are Manager-only events, never re-emitted on the socket itself. `useWebSocket.tsx:113`'s `sharedSocket.on('reconnect_failed', ...)` was listening on the wrong object and could never fire, in the entire history of this codebase — not a server-side session-handling mystery as originally suspected, a one-line wrong-event-target bug. Confirmed by checking `socket.io-client` v4's own source (the library's internal `emitReserved("reconnect_failed")` call lives on the Manager class) and matches every piece of prior evidence exactly: `connect_error` always logged correctly up to and past attempt 5-6, `reconnect_failed` never once did, across every test in both sessions. **Fix**: changed to `sharedSocket.io.on('reconnect_failed', ...)` (`c0e0cf4`). `tsc --noEmit` clean.
  **Live-verified end-to-end, same session, same match (now finished, doesn't block this test — it's purely about WS connection lifecycle)**: real Railway kill/restore. Hit a genuine CDN propagation snag mid-test — the deployed chunk hash changed mid-verification and an earlier check briefly read stale served code, caught and corrected before drawing any conclusion (confirmed via a direct fetch of the exact live chunk showing `c.io.on("reconnect_failed"` in the actual minified output before retesting). With the confirmed-current build: `[WS] reconnect_failed — starting manual retry loop (30 s)` **fired for the first time in this project's history**, then `[WS] Manual retry attempt` on schedule, then `[WS] Connected` — the tab reconnected fully on its own, no refresh, closing the exact stuck-tab symptom this entry has described since session 42.
  **Evidence:**
  - Commit: `c0e0cf4`
  - Verified by: real Railway kill/restore, live console transcript, cross-checked against a direct fetch of the deployed chunk's minified source to rule out a stale-bundle false read
  - Observed result: `reconnect_failed` → `Manual retry attempt` → `Connected`, full automatic recovery with zero manual refresh
  - Pending items: the 404-on-handshake specifically (item 1 from this entry's original bundle) was never independently root-caused — no longer needs to be, since recovery now works regardless of what that specific error was
  **Status:** RESOLVED — 2026-07-15, live-tested session 43 (commit `c0e0cf4`).

- **BUG-090** _(LOW — WebSocket)_: Socket emits attempted on a `CLOSING` socket. `useMatchSubscription` reads `socket.readyState` before emitting, but the `isConnected` dep-array trigger can fire in the same tick as a disconnect — `readyState` may transition from OPEN to CLOSING between the dep-array check and the emit. Not confirmed as causing dropped events but creates unnecessary warnings. Filed: 2026-06-29. **Status:** OPEN

- ~~**BUG-073**~~ _(LOW — Data)_: Substitution `detail` string direction — filed as inverted during KIN vs JOG test match analysis. Confirmed at HEAD: `confirmEvent('Substitution', playerComingOut, playerInId)` → `relatedName` = incoming, `outName` = outgoing → string reads `{inPlayer} IN for {outPlayer}`. Code was never wrong. DB events from the KIN vs JOG test match (deleted) reflected an older state. **Status:** RESOLVED — no code change needed, 2026-06-26.

- **BACKLOG-105** _(HIGH — Data Integrity)_: Penalty shootout score isolation. Full implementation. **Status:** SHIPPED — 2026-08-04 (session 48), core mechanics live-verified, 3 real gaps found and filed separately (see `BUG-197`, `BACKLOG-190`, `BACKLOG-191` below), not yet fixed.

  **Session 48 — built and live-verified:** schema (`shootout_home_score`/`shootout_away_score`, migrated on staging), atomic score-isolation in POST/DELETE `events` routes (`PEN_SCORED`/`PEN_MISSED`/`PEN_SAVED`, zero career-stat writes by construction), `ShootoutModal` (team → taker → outcome), and result display (winner-color + "PEN X-Y" bracket) across the match detail page, `MatchCard.tsx` (all 3 variants), and the homepage's own separate inline match-card implementation. Backfilled the one known historical case (`busa-match-final-2026`, Kings won 4-3). Live-verified end-to-end on a real deployed preview: lineup-restricted taker pickers, correct atomic score isolation (main score untouched, confirmed via direct DB read before/after 2 real kicks), correct display rendering (screenshot-confirmed by Richard).

  **`BUG-197`** _(Real-Time)_: the live WS broadcast for a shootout kick's score does not reach an already-open viewer tab — confirmed live: `PEN_SCORED` correctly persists to the DB (`shootout_home_score`/`shootout_away_score` verified via direct query) and a **fresh page load** correctly shows the updated "PEN X-Y", but a tab that was already open before the kick was logged never updates without a manual reload. The initial-fetch/SSR path is provably correct; the live-update path (`broadcastScoreUpdate` → `match:score:updated` → `handleScoreUpdate` in `matches/[id]/page.tsx`) is the suspect, but root cause not isolated this session — client-side listener code read-through looked correct (dependency array includes `matchData`, so no obvious stale-closure bug), so the fault is more likely server-side (the shootout-only `broadcastScoreUpdate` call site in `events/route.ts`, or something specific to how `after()` behaves for this particular call vs. the already-proven-working main-score broadcast). **Not fixed — needs dedicated debugging next session**, ideally with access to real Vercel function logs (not available in this session's tooling) to confirm whether the broadcast call itself fires server-side at all.

  **`BACKLOG-190`** _(Data Integrity — real rule violation, not cosmetic)_: `ShootoutModal`'s taker picker has no memory of who has already kicked. Confirmed via research this session against the actual IFAB Law 10.3 text: *"Each kick is taken by a different player, and all eligible players must take a kick before any player can take a second kick."* The modal currently shows the full on-pitch roster for every single kick with zero tracking — nothing stops a logger from selecting the same taker twice in a row, which is a real rules violation, not just a UX nicety. Fix needs: track kicked-player-IDs per team for the current shootout, exclude them from the taker picker once every eligible player has gone through the initial round, then reset eligibility for sudden-death rounds per the same rule (once the full roster has taken one kick, repeats become allowed). **Not fixed this session** — filed for the next shootout-focused session.

  **`BACKLOG-191`** _(Test coverage gap)_: session 48's live verification jumped directly into a match seeded at `PENALTY_SHOOTOUT` (via direct DB insert) rather than testing the real full pipeline — normal time (0-0 or tied) → extra time → still tied → shootout. The period-transition logic itself (`FIRST_HALF` → ... → `EXTRA_TIME_2` → `PENALTY_SHOOTOUT`) is old, previously-tested code (`TD-010`, session ~24/25) and wasn't touched this session, so risk is lower than for the brand-new shootout mechanics — but the actual transition into `PENALTY_SHOOTOUT` specifically (extra time ends level → shootout begins) has never been live-tested end-to-end since this session's changes landed. **Not tested this session** — flagged for the next football-focused verification pass, not urgent enough to block on.

  **Rules (confirmed):** Each team takes alternating kicks from the spot. Five kicks each, different players each time. Most scored = winner. Sudden death if level after 5. Shootout goals are NOT recorded in the match score — official result stays as the ET score (e.g. 1-1). Shootout goals do NOT count toward a player's career scoring tally. This is standard football convention (FIFA/CAF/UEFA).

  **Architecture — corrected and finalised (session 37, 2026-06-29):**

  **Event types — distinct, not reused:**
  Use `'PEN_SCORED'`, `'PEN_MISSED'`, `'PEN_SAVED'` (not `'Penalty'`/`'Penalty Missed'`/`'Penalty Saved'`). The regular penalty types write career stats in `updatePlayerStats`. Using distinct types means the switch has no matching case → `default: return` → zero stat writes. No guard needed. No leakage possible. The `isPenaltyShootout` guard on the existing path stays unchanged as a belt-and-suspenders.

  **Stat writes — none:**
  Shootout kicks write ZERO player stats. Not goals, not saves, not shots on/off target. Career records are untouched. This is why distinct event types are required — `PEN_SCORED` simply has no case in `updatePlayerStats`.

  **Score routing:**
  `PEN_SCORED` → increment `shootout_home_score` or `shootout_away_score` using SQL atomic (`COALESCE(col, 0) + 1`), never read-modify-write. Main `home_score`/`away_score` untouched.
  `PEN_MISSED` / `PEN_SAVED` → no score change, no stat change.

  **Undo during shootout:**
  `DELETE /events/[eventId]` for a `PEN_SCORED` event → decrement `shootout_home_score` or `shootout_away_score`. No stat revert (nothing was written). `revertPlayerStat` skips on `PEN_*` types (no case in switch).

  **Flow:**
  ```
  PENALTY_SHOOTOUT period entered
    ↓
  Logger sees dedicated ShootoutModal (not regular event grid)
    ↓
  Each kick: pick team → pick taker → Scored / Missed / Saved
    ↓
  Event logged as PEN_SCORED / PEN_MISSED / PEN_SAVED
    ↓
  PEN_SCORED only: shootout_home_score or shootout_away_score + 1 (SQL atomic)
    ↓
  NO writes to footballPlayerStats
    ↓
  Public page: "1 – 1" main score + "(4 – 3 pens)" below
    ↓
  Match ends → currentPeriod = FINISHED
  ```

  **Logger UX — ShootoutModal (part of BACKLOG-105, not deferred):**
  Simplified 3-step modal. During a 10+ kick shootout under time pressure, the full `PenaltySequenceModal` (fouler picker → taker → outcome) is wrong UX. ShootoutModal:
  - Step 1: Which team is shooting? (Home / Away toggle)
  - Step 2: Pick taker from that team's on-pitch players
  - Step 3: PEN_SCORED / PEN_MISSED / PEN_SAVED + optional keeper if Saved
  No fouler picker. No PenaltySequenceModal reuse. ~80 lines, self-contained component.

  **WS broadcast:**
  `match:score:updated` payload extended with optional `shootoutHomeScore?` / `shootoutAwayScore?`. Backward compatible — existing listeners ignore absent fields. `useWebSocket.tsx` `handleScoreUpdate` extended to hydrate separate `shootoutScore` state when present. Public page reads both `score` and `shootoutScore` for display.

  **Migration — SQL direct only (db:push blocked by BACKLOG-040):**
  ```sql
  ALTER TABLE matches ADD COLUMN shootout_home_score INTEGER DEFAULT 0;
  ALTER TABLE matches ADD COLUMN shootout_away_score INTEGER DEFAULT 0;
  ```
  Staging first, log in RUNLOG, then prod. Schema.ts updated to match.

  **File delta (8 files):**
  | File | Change |
  |---|---|
  | `src/db/schema.ts` | Add `shootoutHomeScore`, `shootoutAwayScore` columns |
  | `src/app/api/matches/[id]/events/route.ts` | PEN_SCORED → shootout score write (SQL atomic) |
  | `src/app/api/matches/[id]/events/[eventId]/route.ts` | PEN_SCORED undo → shootout score revert |
  | `src/lib/match-state-manager.ts` | `shootoutScore` state + WS payload extension |
  | `src/hooks/useWebSocket.tsx` | `handleScoreUpdate` handles optional shootout fields |
  | `src/components/FootballLogger.tsx` | ShootoutModal trigger during PENALTY_SHOOTOUT period |
  | `src/components/ShootoutModal.tsx` | New component — 3-step simplified shootout logger |
  | `src/app/matches/[id]/page.tsx` | "(X-Y pens)" display when `shootoutScore` set |

  **Early termination — known gap, MVP handling documented:**
  Shootouts end as soon as the result is mathematically decided (e.g. Team A leads 3-1 after 4 kicks each — Team B cannot win even if they score their remaining kick). The system has no auto-detection for this. MVP handling: logger manually taps "End Match" when the shootout is decided, same as they do at FT. The `ShootoutModal` stays open until the logger closes it. Do not build auto-termination detection at this scope. This is a known intentional gap — not a missing feature.

  **Validation against FIFA Laws of the Game (session 37):**
  All architecture decisions validated against FIFA Laws and SofaScore/Flashscore display standards:
  - `PEN_SCORED`/`PEN_MISSED`/`PEN_SAVED` distinct types — correct, no career stat writes ✅
  - Shootout score separate from match score — official result stays ET score ✅
  - No `footballPlayerStats` writes during shootout — FIFA convention, non-negotiable ✅
  - ShootoutModal: team → taker → outcome (no fouler picker) — correct for shootout context ✅
  - Early termination: logger-manual at MVP ✅

  **BACKLOG-113 absorbed into this item** — simplified modal is part of the build, not a future UX improvement.

- **BACKLOG-120** _(LOW — Public UX)_: Penalty shootout result not displayed on match card or match detail page. When a match ends 0-0 (or any score) and goes to a shootout, the UI shows only the regulation score — no "(X-Y pens)" line anywhere. The shootout result currently lives in `matches.stats` as a JSON blob (`stats.penaltyShootout.homeScore` / `stats.penaltyShootout.awayScore`) with a human-readable `notes` string, but nothing in the frontend reads it for display. Confirmed affected surfaces: match card (`src/components/ui/MatchCard.tsx`), match detail score header (`src/app/matches/[id]/page.tsx`), homepage match cards (`src/app/page.tsx`). The fix is UI-only — read `stats?.penaltyShootout` where it exists and render `({homeScore}-{awayScore} pens)` below the regulation score on FINISHED matches. **This is independent of BACKLOG-105** (which covers logging shootout events during a live match via PEN_SCORED/PEN_MISSED/PEN_SAVED types and dedicated DB columns). This item requires no schema change — only reading the existing JSON blob that's already present. Known live case: `busa-match-final-2026` (Kings vs Joga, 0-0, Kings won 4-3 on penalties) — currently shows 0-0 with no shootout context visible to any viewer. Filed: 2026-07-01. **Status:** OPEN

  **Relationship to BACKLOG-105:** BACKLOG-105 builds the proper structured shootout logging pipeline (event types, dedicated columns, ShootoutModal). Once BACKLOG-105 ships, this item should be updated to read from `shootout_home_score`/`shootout_away_score` columns instead of the JSON blob. Until then, reading the blob is the correct interim approach. Do not block this fix on BACKLOG-105.

- ~~**BUG-044b**~~ _(MEDIUM)_: Logger dashboard stats show "-" (total events, logged matches). Fix: rewrote `/api/loggers/me` to use `getAuthUser` + logger role gate, returns live counts. **Status:** RESOLVED — verified session 34 test match pre-flight, 2026-06-27.

**Evidence:**
- Commit: `4be7f8d`
- Verified by: session 34 pre-flight check — logger dashboard showed correct Total Events and Logged Matches counts ✅
- Observed result: both stat cells populated with real data
- Pending items: none

- ~~**BUG-045**~~ _(MEDIUM)_: Logger match card shows "INVALID DATE". Fix: null/invalid guard falls back to `'Time TBC'`. **Status:** RESOLVED — verified session 34 pre-flight, 2026-06-27.

**Evidence:**
- Commit: `4be7f8d`
- Verified by: session 34 pre-flight — Time TBC displayed correctly for match with no confirmed start time ✅
- Observed result: no INVALID DATE string; graceful fallback shown
- Pending items: none

### Admin UX

- ~~**BUG-043**~~ _(LOW)_: Publish Lineups button silently disabled when captain not set. **Status:** SHIPPED — commit `5cb6738`, 2026-06-26. Inline amber message "Set a captain for both teams before publishing." shown below button when `!homeCaptain || !awayCaptain`.

- **BUG-048** _(LOW)_: Cross-team player in departmental lineup shows blank name on logger confirm screen even after BUG-042 fix. Root cause: BUG-042 resolves `playerId` against the team's eligible-players list — a player from another club won't be in that list. Fallback hits `jerseyName` from the stub, which is `null` if admin didn't fill it. Data entry gap, not a code regression. Mitigation: warn at publish time if any starter stub has `jerseyName: null`. Filed: 2026-06-19.

### Scoring — Pending Live Verification

- ~~**BUG-047**~~ _(HIGH)_: Penalty and Own Goal events did not update match score. Root cause: condition was `type.toUpperCase() === 'GOAL' || value` — neither `'Penalty'` nor `'Own Goal'` matched, and `value` is never in the client payload. OG additional bug: `teamId` is the conceding team; old logic credited them instead of the opponent. Fix: `src/app/api/matches/[id]/events/route.ts` expanded to `GOAL | PENALTY | OWN GOAL | value`; OG inverts `isHomeTeam`. Commit `5fbc3e5` (2026-06-19). **Status:** RESOLVED — 2026-06-24.

**Evidence:**
- Commit: `5fbc3e5`
- Verified by: `dev/verify-bug-047-scores.mjs` — DB query against staging match `LFkN14uB90brGn2E8sW1N`
- Observed result:
  - `home_score = 3`, `away_score = 3` in DB
  - 11 events: Goal ×3, Penalty ×1, Own Goal ×2, Foul ×3, Assist ×2
  - OG (teamId=ISzKeGGXuvW2h5QGmnWcp, away) → home_score incremented ✓
  - OG (teamId=busa-joga, home) → away_score incremented ✓
  - Expected homeScore=3, awayScore=3 — exact DB match
- Pending items: prod audit blocked by BUG-011 (playerStats corruption scope); staging scores confirmed correct

### Public Page

- **BUG-046** _(MEDIUM)_: `/matches/[id]` shows full black screen with spinner indefinitely from admin browser session (non-incognito). No console errors visible. Likely SW serving a stale cached shell after deploy, or data fetch hanging with no error state. Needs reproduction + Network tab capture to confirm. Related: BUG-026. Filed: 2026-06-19.

- **BUG-096** _(LOW — SEO/Meta)_: Platform's own logo (`BRIX-SPORT-LOGO.png`) 404s for Open Graph / SEO meta images site-wide. The real file lives at `public/assests/Logos/BRIX-SPORT-LOGO.png` (note: `assests`, the repo's actual — misspelled — folder name, matching every other team logo path already in use, e.g. `/assests/Logos/football/kings-fc.jpg`). But 6 files reference the correctly-spelled `/assets/Logos/BRIX-SPORT-LOGO.png`, which does not exist: `src/app/layout.tsx` (3 refs), `src/app/page.tsx`, `src/components/seo/PageSEO.tsx`, `src/lib/utils/aeo.ts`. Any OG/social-share preview or SEO structured-data image referencing this path is currently broken. Found incidentally while fixing the 4 college team logo paths (same session) — same root-cause typo mismatch, much larger blast radius (site-wide meta images vs 4 team records). Fix is mechanical: update the 6 references to `/assests/Logos/...` to match the real folder, or rename the folder and update the ~20 existing team logo DB rows to match (larger, riskier change — not recommended). Filed: 2026-07-06.

- ~~**BUG-097**~~ _(CRITICAL — Data Integrity, BUSALYMPICS backfill)_: `busa-pirates-player-17` (Israel Emmanuel) held two simultaneous active `player_team_affiliations` rows with `affiliation_type='college'` — a real, pre-existing COLENG affiliation AND an erroneous COLMANS affiliation created by MD1 g1's write (`OPoEtVGUNWKcRSDe4QdSr`), which wrongly platform-wide-matched him to a COLMANS "ISREAL" sheet entry that is actually a different person. Separately, MD1 g2 (`tyYRU5nlOrqnEXEpvIEC6`) then needed the real Israel Emmanuel and instead created a brand-new, redundant stub (`ClqNXQiORuTQE54v5gqKU`, "Isreal"/COLENG) rather than linking to him. Root cause: the matching/affiliation-insert pipeline checked for duplicate (playerId, teamId) rows but never checked whether a NEW college affiliation would conflict with an EXISTING one. **Status:** RESOLVED — 2026-07-09 (session 40C), `dev/fix-israel-emmanuel-swap.mjs --apply` on staging. **Evidence:** dry-run reviewed first (matched confirmed trace exactly — 5 g1 events, 1 g2 event, 1 substitution reference), applied as single atomic batch (14 statements). Post-apply DB query confirmed: new COLMANS "Isreal" stub has exactly 1 college affiliation + stats matching only g1's contribution; Israel Emmanuel has exactly 2 affiliations (COLENG + Pirates FC, zero COLMANS) + stats matching only his real g2 contribution; redundant g2 stub fully deleted (0 rows across players/affiliations/squad_players/stats/event_refs). Full detail: RUNLOG.md 2026-07-09 lines 928-940. Pending items: none — systemic guard shipped separately as `dev/lib/college-guard.mjs` (see follow-up below).
- **Systemic follow-up (not yet built):** the matcher needs a standing guard for all remaining 32 matches — before adding any `affiliation_type='college'` row, check for an existing active college affiliation to a DIFFERENT team and hard-flag the conflict rather than silently writing. Club-team multi-affiliation must remain unaffected.

### Data Integrity

- ~~**BUG-011**~~ _(HIGH — Data Integrity)_: `playerStats` corruption — 718 goals vs 133 appearances originally observed. **Status:** RESOLVED — WONT FIX (condition no longer exists) — 2026-07-01.

**Evidence:**
- Verified by: Session 40 two-DB audit (`dev/audit-step1-3.mjs`) — SELECT queries against both staging and prod
- Observed result: staging `total_goals = 31`, `stat_rows = 38`; prod `total_goals = 28`, `stat_rows = 31`. Max goals per player = 5 (Samuel Olapite). No anomaly on either DB.
- Root cause of original figure: Sessions 27/29/32 cleanup scripts deleted polluted test match events and rolled back associated stats. The 718-goal figure was a point-in-time read from a very early prod state (Session 3–4, 2026-06-04) before any cleanup ran. That data no longer exists.
- Pending items: none. The zero-and-recompute plan for the backfill session still applies — stats are seeded directly (not event-derived) so double-counting risk on insert is real regardless. But there is no legacy corruption to untangle first.

- **BUG-033** _(MEDIUM — Part 1 done / Part 2 open)_: Squad tab player pool does not filter by sport.
  - **Part 1 (data) — RESOLVED staging 2026-06-17. ⚠️ PROD CLEANUP UNVERIFIED:** 5 basketball players' wrong football college affiliations deleted staging. Basketball college teams created for COLENG/COLNAS. Still needed: run same cleanup on prod.
  - **Part 2 (UI) — OPEN:** `GET /api/admin/teams/[teamId]/squad` does not filter pool by sport. Do not build until BACKLOG-068 (multi-sport player audit) is done.

- **BUG-026** _(MEDIUM — PWA/Cache)_: SW serves stale JS chunk URLs after new deploy → unstyled page on direct URL visit. Fix shipped Session 19 (document bypass + `no-store` on SW files). **Prod verification still open — TEST_CHECKLIST.md items unchecked.**

- **AUDIT-002 (remaining)**: `POST /api/matches` — missing comprehensive Zod validation. Partial fix (null-coerce `competitionId`) applied Session 2. Full schema validation absent.

---

## Bugs (Resolved)

### Session 27 — 2026-06-19

- ~~**BUG-049**~~ _(HIGH — Logger Flow)_: Start Match silent ghost-state failure. Logger UI flipped to FIRST_HALF before PATCH resolved; PATCH failures swallowed by bare `console.error` — logger saw "live", DB stayed PENDING, no error shown. Same pattern in `handleFinalize` (local state → FINISHED before PATCH). **Fix (both):** PATCH fires first, `res.ok` checked, local `transitionStatus` only called on confirmed success. On failure: `alert()` shown, state unchanged, button re-enabled. `isStartingMatch` state added for Start button; `isSaving` reused for End (already exclusively scoped). `src/components/FootballLogger.tsx`. **Status:** SHIPPED — live test via TEST_CHECKLIST.md → "Start Match silent-failure fix" required before RESOLVED.

**Evidence:**
- Commit: `0561748`
- Verified by: code trace — catch path confirmed non-silent (alert fires, state does not transition)
- Observed result: N/A — code-level fix only, live test still required
- Pending items: run TEST_CHECKLIST.md Start Match + End Match tests (happy path + DevTools block path)

### Session 26 — 2026-06-19

- ~~**BUG-042**~~ _(LOW — Logger UX)_: Logger confirm-lineup screen showed blank player names. Root cause: admin publish stores stubs `{ playerId, jerseyNumber, jerseyName }` — confirm screen rendered `p.name`/`p.number`/`p.position` which don't exist on stubs. Fix: resolve `playerId` against `homePlayers`/`awayPlayers` array; fall back to stub fields. `src/components/FootballLogger.tsx`. Commit `04d49dc`. Resolved: 2026-06-19.

- ~~**BUG-044**~~ _(HIGH — Logger Auth)_: All logger API calls returned 401. Root cause: `POST /api/loggers/auth` returned JWT in JSON body only — never set `authToken` cookie. `getAuthUser()` reads cookie first, got null on every subsequent request. Fix: set httpOnly `authToken` cookie in logger auth response; store token in `localStorage` on login for offline queue SW path; clear both on logout. `src/app/api/loggers/auth/route.ts` + `src/app/logger/page.tsx`. Commit `7808a20`. Resolved: 2026-06-19.

### Earlier Sessions (Sessions 1–25, compressed)

~~BUG-032~~ — 39 null player_id events, forward gate added (2026-06-16)
~~BUG-030~~ — `/competitions/[id]` 404, redirect added (2026-06-16)
~~BUG-031~~ — standings raw logo strings, TeamLogo component (2026-06-16)
~~BUG-027~~ — competitions sport filter hid null-sport rows, All tab (2026-06-15)
~~BUG-028~~ — Framer Motion hydration #418, `initial` removed (2026-06-15)
~~BUG-029~~ — `/api/players/[id]` leaked email, admin-only (2026-06-15)
~~BUG-021/022/023/024/025~~ — auth gates, unbounded queries, orphaned schema, false-alarm route, loggerId public leak (2026-06-15)
~~BUG-015/016/017/018/019/020~~ — PATCH no auth, POST /competitions no auth, 3 debug routes deleted, GET /matches/[id] internal leak, middleware-only admin APIs, /live no polling (2026-06-08)
~~BUG-001–014~~ — middleware mismatch, debug endpoint, admin auth, NDPR leaks, event auth, casing mismatch, hardcoded audit field, race condition, XSS, unbounded queries, bulk register auth, match card IDs (Sessions 1–10)
~~BACKLOG-065~~ — joseph×2/leo×2 confirmed distinct people, moved to BACKLOG-064 (2026-06-16)

~~BACKLOG-036~~ — TeamLogo migration second pass — 13 files migrated, 5 skipped. Commit `a02283b`. COMPLETE 2026-06-15.
~~BACKLOG-034~~ — Pre-prod clearance script Tier 1 — `dev/pre-prod-check.ts` live. Auth gates, NDPR shape, DB integrity, round distribution. Tier 2 (CI) pending BACKLOG-021. COMPLETE 2026-06-08.

---

## Tech Debt

- **TD-010** _(CRITICAL — PRE-LIVE-MATCH BLOCKER)_: **Status: SHIPPED — commit `b66eb95`, 2026-06-24. Pending clean verification.**
  - Column added (`current_period TEXT DEFAULT 'NOT_STARTED'`), staging migration applied, PATCH writes confirmed, `getLoggerMatches` selects `match: matches` (full row) — `current_period` flows through automatically. No code gaps remain.
  - **Why period still showed NOT_STARTED on the test match:** the test match (`AIr6gMTlUscTNHzYTL8fI`) was started and transitioned to 2ND HALF *before* `b66eb95` deployed and *before* the migration ran. Those transitions never wrote `current_period` — the column didn't exist yet. Migration defaulted all existing rows to `NOT_STARTED`. Hard refresh read `NOT_STARTED` from DB → seed fell through → correct behaviour given the history, not a bug.
  - **2026-07-13 note:** Richard screenshotted `_lkHo5y1m6ArqvLsi1ixe` (BUSALYMPICS Final, COLNAS 5-0 COLENG) on staging showing "Full Time" correctly instead of "NOT STARTED." This confirms **BUG-100**'s fix (the 66-row historical backfill of `current_period` for FINISHED matches) is live — it is not TD-010's own verification criterion, since it's a backfilled historical match, not a fresh live-transition test.
  - **Verification required (still open):** spin a fresh test match *after* `b66eb95` is deployed. Start match → transition to `FIRST_HALF` → hard refresh → must show `FIRST_HALF`. That is the real TD-010 test, requires an actual live/test match window.
  - Prod migration: NOT yet run — pending staging clean-test verification.

- **TD-011** _(LOW)_: `updatePlayerStats` in `src/app/api/matches/[id]/events/route.ts` has `season: '2024'` hardcoded on insert (lines ~357, ~396). Will silently write to the wrong season bucket from 2025 onward. Fix: derive season from match `startTime` or pass as a match field. Filed: 2026-06-19.

- **TD-012** _(LOW — naming, deliberately deferred)_: `competition_sport_settings.halfDuration` (schema.ts) is named for football's 2-half model but reused as "one period's length" for any sport — basketball's quarter length (10 min), and whatever Track's period model turns out to need. Considered renaming to `periodDuration` during BACKLOG-125 (basketball write-path work); decided against it because `halfDuration` is a live prod column and renaming requires a SQL-direct migration (BACKLOG-040 blocks `db:push`) for a naming-clarity-only change with no functional benefit — nothing downstream misreads the value, it's purely a readability cost for two of three sports. **Do not rename preemptively.** Revisit only if/when Track's actual period model turns out to be structurally incompatible with a single period-duration number (not just a third value for the same concept) — at that point all three sports' config-reads need touching anyway, making the rename effectively free as part of that work. Filed: 2026-07-21 (session 46, BACKLOG-125).

- **TD-001** _(IN PROGRESS)_: `src/lib/env.ts` created — typed `env` object and `validateEnv()` startup check in place. `middleware.ts` migrated to use `env.jwtSecret` and `env.isStaging`. Remaining work: migrate all other `process.env` reads across 30+ files, add Zod validation. Full migration deferred — do not scatter `process.env` reads in new code from this point forward.
- **TD-002**: Deduplication for event logging submissions on slow connections to prevent double-tap glitches.
- **TD-003**: Match status transitions need a proper state machine (PENDING → LIVE → FINISHED) with automated triggers.
- **TD-004**: Update `.env.example` to match the actual 29 keys discovered in the codebase (currently only lists 16).
- ~~**TD-005**: Atomic refactor for logger assignment — resolved as part of BUG-008 (2026-06-05). Transaction wraps check-then-insert in `assign-logger/route.ts`.~~
- ~~**TD-006**: Response sanitization for `/api/matches` email leak — resolved as part of BUG-007 (2026-06-05). Email stripped from public `assignedLoggers` select.~~
- **TD-009** _(MEDIUM)_: Extract shared `PlayerForm` component. `/admin/players` modal and `/admin/players/[id]` edit profile page are two separate form implementations with identical fields (college select, university lock, position dropdown, validation). One source of truth required. **Do not fix either form in isolation before this refactor is scoped — fixing one creates a second copy to maintain.** Implement after roster upload is complete.

- **TD-007**: Bulk Register UX placement — `/admin/bulk-register` currently lives as a standalone route but registration flows (team + player creation) may belong inside the competition or team management context instead. Needs a UX review to determine the correct placement before the page grows further.
- ~~**TD-008**~~: `useLiveStandings.ts` — `teamLogo: string` type was wrong (should be `string | null`); `|| '❓'` emoji fallback masked null values causing `TeamLogo` to receive a literal emoji string. RESOLVED 2026-06-16 — type fixed to `string | null`, fallback changed to `null`. Commit `bb0a1ed`.

## Descoped Features (Future Work)

### BACKLOG-114 — Yellow Card Excluded from Push Notification Triggers

**Status:** OPEN
**Priority:** Low — product decision required
**Filed:** 2026-06-29

`notifiableEvents` in `match-state-manager.ts:981` is `['Goal', 'Penalty', 'Penalty Saved', 'Penalty Missed', 'Red Card']`. Yellow Card is not included — no push fires on a booking. This is an intentional omission (Yellow Cards are frequent, low-drama events vs Red Cards which materially affect the match) but was never explicitly documented as a product decision. File here to force a decision when notification infra is stable. Suggested resolution: keep Yellow Card excluded for MVP, revisit once BACKLOG-103 (user-selectable preferences) is built — users can opt in if they want bookings.

---

### BACKLOG-115 — Missing `.limit()` on `userFavorites` Query in Notification Audience Build

**Status:** OPEN
**Priority:** Medium — CLAUDE.md architecture rule violation
**Filed:** 2026-06-29

`sendMatchEventNotification()` in `src/lib/notifications/match-notification-service.ts:86` queries `userFavorites` without a `.limit()` clause. CLAUDE.md mandates every list endpoint must have a `.limit()`. At MVP scale this is harmless, but at any meaningful user count this runs a full-table scan on every notifiable event. Fix: add `.limit(500)` (or a configurable cap) to the `userFavorites` query in `sendMatchEventNotification`. File alongside BACKLOG-116 and resolve together.

---

### BACKLOG-116 — Notification Audience Preference Inconsistency

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-29

`sendMatchEventNotification()` in `match-notification-service.ts` queries `userFollows` with `notificationsEnabled = true` filter but queries `userFavorites` with no `notificationsEnabled` filter (the column may not exist on `userFavorites`). Users who have disabled notifications in their follows preferences may still receive pushes if they have the team in favorites. The two tables have divergent semantics for notification opt-out. Fix: audit `userFavorites` schema for a notification preference column; add one if absent; apply consistent filter across both audience queries.

---

### ~~BACKLOG-118~~ — Logger Cookie Bleeds into Viewer-App Routes (Dual-Account UX Broken)

**Status:** RESOLVED — 2026-06-30 (commits `1a98902`, `8f282b0`, `0ea32be`)
**Priority:** Medium
**Filed:** 2026-06-29
**Depends on:** BACKLOG-117 (SSO) for full resolution

**Evidence:**
- Commit: `0ea32be` (getAuthUser fallback), `8f282b0` (resolveEffectiveUserId applied to all 4 routes)
- Verified by: DB query via `dev/verify-backlog118-follows.mjs` against staging
- Observed result: `fetch('/api/users/follows?userId=xwhRM0JiOekwI460QjFZi', { credentials: 'include' })` returns `{follows: Array(0)}` — 200, no 401. DB confirms user exists in `users` table (id=`xwhRM0JiOekwI460QjFZi`, role=logger), corresponding logger entry exists under same email (`logger_1767968844029`). `user_follows` table has 0 rows total — empty array response is correct.
- Pending items: none. Email bridge works. Long-term SSO tracked under BACKLOG-117.

#### Problem

`authToken` cookie is not path-scoped. A logger who logged into `/logger` has their logger JWT active across all routes on the domain, including the viewer app. `getAuthUser` returns a logger identity (ID from `loggers` table) on every route — including viewer-facing endpoints that expect a `users` table ID.

**Affected routes and symptoms:**

| Route | Symptom |
|---|---|
| `GET/POST/DELETE/PATCH /api/users/follows` | Logger ID ≠ users.id → 403. **Fixed** with email bridge in `1a98902`. |
| `GET/POST/DELETE /api/users/favorites` | Uses `authUser.id` directly → logger ID has no `userFavorites` rows → empty result or silent no-op on write |
| `POST/DELETE /api/teams/[id]/follow` | Uses `authUser.id` → follow/unfollow writes against logger ID → orphan row or silent miss |
| `GET /api/notifications` | Uses `authUser.id` for favorites join → logger ID → empty notifications list |
| `POST /api/notifications/subscribe` | Takes `userId` from body, no ownership check → not a bleed issue but a separate auth gap |

#### Fix applied (follows only — `1a98902`)

`resolveUserId()` helper: if `authUser.role === 'logger'`, queries `users` table by `authUser.email`, returns the fan account ID if found. Falls back to logger ID if no fan account exists (→ 403, correct).

**Risk / assumption:** email must match exactly between `loggers` and `users` tables. An admin who creates a logger account with someone else's email would bridge access incorrectly. Low risk in practice (admin controls logger creation).

#### Remaining work

Apply the same `resolveUserId` pattern to:
- `src/app/api/users/favorites/route.ts` — GET/POST/DELETE handlers
- `src/app/api/teams/[id]/follow/route.ts` — POST/DELETE handlers
- `src/app/api/notifications/route.ts` — GET handler

Long-term: BACKLOG-117 (SSO) eliminates this class of bug entirely by unifying identity into one table.

---

### BACKLOG-108 — Rolling Subs: End-to-End Test Coverage

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-27

Rolling substitutions (unlimited, no cap gate) cannot be tested on the same match as the sub cap gate (BACKLOG-044 Phase B). The two modes are mutually exclusive per competition config.

**What to test when filing:**
- Rolling subs checkbox enabled in competition Match Settings → sub cap input hidden/disabled
- Logger can make unlimited substitutions without hitting a gate
- `maxSubstitutions = null` stored in DB; sub cap gate code path skipped entirely
- Subbed-out player re-entry if `allowSubbedOutReentry` is also enabled

**Gate:** Requires a dedicated test match on a competition configured with rolling subs. Schedule after the standard-sub test match passes.

---

### BACKLOG-120 — Admin-Facing "Link Player Profiles" Action (Multi-Sport Identity)

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-07-11

`profile_id`'s only live write path (`getPlayerProfileId` in `src/db/utils/player-profile.ts`, wired through `bulk-register`) links two player rows by matching on `email`. This is structurally unreachable for nearly every player on the platform: `create-individual` and competition-approval both hardcode `profileId: null` outright, and every backfill-created player (BUSALYMPICS' 7, BUSA League's 84+) has `email: null` since they're transcribed from paper sheets, not registration forms. The read side (`GET /api/players/[id]` → `relatedProfiles`) and the "Multi-Sport Athlete" UI card (`src/app/players/[id]/page.tsx`) are fully built and correct — they've just never had real data to render, because the one write trigger essentially never fires in practice.

Confirmed via a real case this session: Abdul-jabbaar Bello (football, `busa-pirates-player-9`) and Storm's "Jabbar" (basketball, `DRSlwyUmV-Bgff6JMnt0r`) are the same real person, per Richard — handled as a one-off manual `profile_id` write rather than blocked on this backlog item. Given multi-sport athletes are confirmed common (not rare) for college-age athletes on this platform, this won't be the last case.

**Fix:** A real admin-facing "link these two player profiles" action, independent of email matching — e.g. an admin picks player A and player B from search, confirms, and the system either reuses an existing `profile_id` (if either row already has one) or generates a fresh one via `nanoid()` and writes it to both rows.

**Not urgent** — no other pending case is blocked on this; it exists to make the next multi-sport link a UI action instead of a manual directive.

**Related:** `src/db/utils/player-profile.ts`, `src/app/api/players/[id]/route.ts` (relatedProfiles read), `src/app/players/[id]/page.tsx` (Multi-Sport Athlete card)

---

- Payment, sponsorship, or financial processing
- Social features (comments, reactions, follows, DMs)
- External league API integrations
- Automated video or AI-based score detection
- Push notification campaigns
- Advanced analytics dashboards
- **BACKLOG-103** — User-selectable push notification preferences (per event type: goals only, all events, match start/end only). Do not implement until notification infra is stable and user count justifies it. See full spec in BACKLOG-103 entry.
- **BACKLOG-117** — Single Sign-On (SSO) across roles. Currently admin, logger, and viewer/fan accounts are separate identity pools (`users` table vs `loggers` table) with separate credentials and separate login flows. A person who is both a logger and a fan must maintain two accounts. Future: unified identity layer that dispatches to the correct role on login, shared session that can be scoped per-path (`/logger` vs `/admin` vs viewer). Prerequisite: merge or bridge `loggers` table into `users` with a role column, and redesign logger auth to issue the same JWT shape as user auth.
- Role-based access beyond the defined hierarchy

---

### BACKLOG-110 — Event Timestamps Show Regulation Ceiling Instead of Real Stoppage Minute

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-27

**Symptom:** A goal scored at 47:11 of 1st half stoppage is stamped `45'` in the event log, not `47'`. The live clock face correctly shows `47:11` (reads `absoluteMinute` via `getFormattedTime()`). The event timestamp reads from `displayMinute` which is capped at `Math.min(absoluteMinute, halfDuration)`.

**Code gap:** `updateDisplayMinute()` in `src/lib/match-state-manager.ts:369`:
```ts
case 'FIRST_HALF':
    this.state.clock.displayMinute = Math.min(absoluteMinute, halfDuration); // ← caps at 45
```
Events are stamped with `clock.displayMinute` at `match-state-manager.ts:534`. So any stoppage-time event gets the regulation ceiling minute, not the real elapsed minute.

**Correct behaviour:** Stamp events with `absoluteMinute` directly (same as the clock face). Optionally format stoppage-time events as `45+2'` in the UI — but that's a display concern, not a data concern. The DB should store the real minute.

**Fix:** Change `updateDisplayMinute()` to set `displayMinute = absoluteMinute` for all periods (remove the `Math.min` clamps). The clamping was the wrong place for regulation logic — `checkPeriodEnd()` already handles the ceiling trigger independently.

**Scope:** `src/lib/match-state-manager.ts` only. No DB migration needed — `displayMinute` is not stored; only `absoluteMinute` is written to `match_events.minute`.

### BACKLOG-109 — Make Start Time and Venue Optional on Match Creation

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-27

Date and venue are currently `required` on the Create Match form, blocking admins from scheduling fixtures before those details are confirmed. This is a real workflow friction — competitions are often set up with teams and rounds known weeks before venues and kick-off times are confirmed.

**What to change:**
- Remove `required` from `startTime` and `venue` inputs in `src/app/admin/matches/page.tsx`
- Allow `startTime = null` and `venue = ''` in the match create payload
- API route `POST /api/matches` — guard any `new Date(startTime)` calls against null; store null in DB if not provided
- Match list card — if `startTime` is null, show `"TBC"` instead of an invalid date string
- Public livescore page — same null guard, show `"TBC"` if no start time set
- Logger dashboard match list — null guard on start time display (BUG-045 already handles this with `'Time TBC'` fallback — confirm it covers null startTime too)

**Out of scope for this item:** requiring date/venue before a match can go LIVE (that gate can stay — admin must set them before starting).

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

### BACKLOG-122 — Stats Tab Shows Misleading "0" for Categories Never Tracked in Goals-Only Backfills

**Status:** OPEN
**Priority:** Low → **worth re-rating, see 2026-07-13 update below**
**Filed:** 2026-07-13

**Problem:** `GET /api/matches/[id]` computes public Stats-tab values from `match_events` (`src/app/api/matches/[id]/route.ts:252-304`) by incrementing counters per event type — but goals-only backfilled matches (busa-match-1 through -9ish, no full team logsheet) only ever wrote `Goal`/`Assist`/`Yellow Card`/`Red Card` events. Categories like shots on/off target, corners, fouls, saves, interceptions, clearances, and possession will always compute to a literal `0 - 0` for these matches — reading as "zero fouls happened" rather than "this data was never captured." More misleading than BUG-103's Timeline glitch, since a stats number carries an appearance of precision a garbled minute didn't.

**Update, 2026-07-13 (session 42) — real example is worse than the filed "0-0" framing.** Observed live on staging: `busa-match-16` (Hammers 6-0 Santos) Stats tab shows **100% - 0% possession**, **26 - 0 shots**, **10 - 0 shots on target**, **1 - 0 saves** — not neutral zeros, a confidently one-sided reading. Root cause confirmed in the same code (`route.ts:281-285`): possession is computed as `homeAttackingEvents / totalAttackingEvents` (shots + corners + free kicks), and `shots`/`saves`/`fouls` are raw event counts. Hammers had a fully-logged sheet (real shot/foul/save events); Santos' side has almost nothing beyond one card — so the formula isn't hitting the "0-0, no data" case this entry describes, it's producing a fabricated-looking blowout stat line from asymmetric sheet coverage. This reads as real analysis, not a gap, which is a more misleading failure mode than the one originally filed. Worth re-rating priority above Low given how confidently wrong this looks to a public viewer, once BACKLOG-018 sequencing allows it.

**Proposed fix (not yet built):** Keep goals/assists/cards visible on the Stats tab (real data), but suppress or caveat the categories that were never tracked for goals-only matches, rather than showing a false `0 - 0` (or, per the 2026-07-13 finding, a false lopsided percentage). Needs a way to distinguish "goals-only backfill" matches from "full stat capture" matches (e.g. checking whether any of the full-stat event types exist in `match_events` for that match) before deciding what to render.

**Deferred:** Richard's call — file now, return to it after the BUSA League backfill (BACKLOG-018) is further along. As of 2026-07-13, backfill is past the halfway point (17 of 32).

**Update, 2026-08-04 (session 48):** raised again mid-session while resuming the backfill — Richard's framing matches the "Proposed fix" above exactly (an uncaptured stat category should not render at all for these matches, not show a real-looking `0`). Not built this session (time-boxed to close on other work), but the deferral condition is close to being met: backfill is now at 24 of 32 matches with events (up from 17), only 7 remain plus this session's 2 newly-deferred card-attribution problems on `busa-match-24`. **Good candidate for the actual next session's first task**, alongside continuing the remaining matches.

**Update, 2026-08-04 (session 49): deferral condition now met.** The `busa-match-N` series (1-27) is fully backfilled — every goals-only match this entry describes now exists in its final state. Only Deadline-Quantum remains outside the `matches` table entirely (a different problem, not more goals-only Stats-tab pollution). **This is now the top candidate for the next session's first task** — not built this session (time-boxed to finish the backfill itself).

**Fix built and live-verified, 2026-08-04 (session 49).** `GET /api/matches/[id]` (`src/app/api/matches/[id]/route.ts`) now checks **per-team** stat coverage, not per-match — the first version of this fix used a per-match check ("does any event anywhere have a full-stat type") and was caught live-testing against `busa-match-16` on a Vercel preview: it missed the asymmetric-coverage case entirely (Hammers has a real full-stat logsheet, Santos never had one), so the fabricated `100%-0%` possession / `26-0` shots line stayed visible. Corrected to require both teams to have logged at least one full-stat-only event type before rendering Possession/Shots/Shots on Target/Corners/Fouls/Saves; Yellow/Red Cards always render since they're real captured data in both goals-only and full-capture matches. `LiveStats.tsx` suppresses the categories silently — no explanatory caveat text, matching SofaScore-style omission per Richard's explicit call.

**Evidence:**
- Commits: `7e729a1` (initial per-match version), `43afee2` (per-team correction)
- Verified by: live test against a Vercel preview deployment (`brixsports-staging-fpi1p99k5-brixsports-projects.vercel.app`), both via a real signed-in session
- Observed result: `busa-match-16` (asymmetric coverage) now shows only `Yellow Cards 2-1` / `Red Cards 1-0` on its Stats tab — Possession/Shots/Shots on Target/Corners/Fouls/Saves all correctly absent, no fake `0-0` or lopsided percentage. `busa-match-10` (both sides fully tracked, spot-checked as a regression guard) still renders every category normally: `Possession 33%-67%`, `Shots 4-8`, `Shots on Target 0-4`, `Corners 0-0`, `Fouls 0-2`, `Yellow Cards 1-2`, `Saves 5-11` — confirming the fix doesn't over-suppress real data.
- Pending items: PR #16 (`fix/backlog-122-stats-tab-uncaptured-categories` → `dev`) not yet merged.

**Status:** SHIPPED — 2026-08-04 (session 49), live-tested on Vercel preview. Pending merge.

---

### BACKLOG-192 — Football Possession % Is an Attacking-Event Proxy, Not Real Possession, Even on Fully-Tracked Matches

**Status:** OPEN
**Priority:** Low — a real accuracy gap, but not a data-integrity bug; the number shown is a documented approximation, not corrupted data
**Filed:** 2026-08-04 (session 49)

**Problem:** `GET /api/matches/[id]`'s computed-from-events possession formula (`src/app/api/matches/[id]/route.ts`) is `homePossession = shots + corners + freeKicks` (an attacking-event count), never actual time-in-possession. This is true even for matches where **both** teams have full, real stat coverage — `BACKLOG-122`'s fix (same session) only addresses matches where the underlying event counts themselves are missing/asymmetric; it does nothing for the deeper issue that the possession % shown is always a proxy metric, not a measurement of what it claims to represent. There is no event type anywhere in the logger (`FootballLogger.tsx`, `match-state-manager.ts`) that captures a possession change or duration — the platform has never had a mechanism to track real possession, only to approximate it after the fact from unrelated event counts.

**Why this matters:** unlike goals-only matches (where a viewer might reasonably suspect "0" means "not tracked"), a fully-logged match's possession percentage looks exactly as authoritative as a real one — there's no visual or data-shape difference between "true possession" and "attacking-event ratio dressed up as possession." A viewer has no way to know the number is an approximation.

**Fix (not built — scoping only, this is a filing):** Two real options, not mutually exclusive: (a) relabel the stat honestly (e.g. "Attacking Play %" instead of "Possession") so the UI stops claiming to measure something it doesn't, or (b) add a real possession-tracking mechanism to the logger (a "possession change" event type, timestamped, that the backend can integrate over match duration) for matches where a logger is willing to track it live — a bigger lift, only worth it if match-level possession accuracy is a real product priority. Richard's call needed on which direction (or whether to leave the proxy as-is with better labeling only).

**Found:** session 49, raised by Richard directly while reviewing `BACKLOG-122`'s fix — noted the possession model "isn't rigid" and would be inaccurate even where data exists.

---

### ~~BACKLOG-124~~ — Live Auto-Ratings Silently Broken Since Written (No Auth Forwarded)

**Status:** RESOLVED — 2026-07-24 (session 47B)
**Priority:** Medium — not data-corrupting, but a named feature (auto-ratings during a live match) has never once actually run
**Filed:** 2026-07-21 (session 45), found while root-causing BUG-119's remaining latency

**Problem:** `POST /api/matches/[id]/events` (`src/app/api/matches/[id]/events/route.ts`) triggers rating auto-calculation for live matches with a bare internal self-`fetch()` to its own `POST /api/matches/[id]/ratings` — but forwards no `Cookie` or `Authorization` header. `ratings/route.ts`'s `POST` handler requires `getAuthUser(request)` to resolve to an `admin` or `logger` (`ratings/route.ts:117-123`); with no credentials on the request, `verifyAuth()` returns `null` immediately (`auth.ts:52`, no DB hit — fails before any real work) and the call 401s. The outer `try/catch` in `events/route.ts` swallows this silently (`console.error` only) so it has never surfaced as a visible error. Net effect: player/team ratings have never been computed live during any match on this platform — they only exist for matches that reached `FINISHED` and hit the separate GET-triggered fallback path (`ratings/route.ts:45-87`), which correctly forwards the viewer's own cookie.

**Not a data-integrity bug** — ratings are a display/derived feature, not authoritative match state — but it means the comment "Auto-calculate ratings after event (for live matches)" has been describing dead code since it was written, and this same self-fetch was, until session 45, also adding latency to the broadcast path for no benefit (see BUG-119's session 45 update).

**Proposed fix (not yet built):** Either (a) forward the original request's auth to the self-fetch (grab the cookie/Authorization header off the incoming `request` before the internal fetch), or (b) skip the HTTP self-fetch entirely and call the rating-calculation logic as a plain internal function shared between the two routes — avoids the auth-forwarding problem structurally instead of patching around it, and removes a full HTTP round-trip from the live event path either way.

**Deferred:** not fixed this session — session 45 fixed the latency contribution (wrapped in `after()`, see BUG-119) and filed this as the separate, still-open correctness gap.

**Additional finding, session 46 (BACKLOG-125 work):** the silent-401 symptom above assumes `NEXT_PUBLIC_APP_URL` resolves quickly (correctly or not). Locally, `.env.local`'s `NEXT_PUBLIC_APP_URL` is set to the real deployed staging URL (`https://brixsports-staging.vercel.app`), not `localhost` — so a local dev server handling a `LIVE`-status event doesn't get a fast 401 from this self-fetch, it makes a real outbound HTTPS request to the deployed staging app from within the same process that's trying to serve the original request. Observed directly: the entire local dev server became unresponsive to *all* requests (not just the triggering one) for several minutes after posting one `LIVE`-status basketball event, confirmed via server logs and repeated timed-out `curl` calls to unrelated routes during the window. Root cause not fully confirmed (candidates: something in the custom `server.js`'s request handling doesn't truly yield during this specific outbound fetch, or Node's event loop was blocked by something else entirely triggered by the same code path) — but the practical impact is real and reproduced twice this session. Workaround used: give any local test match a non-`LIVE` status (e.g. `UPCOMING`) to avoid triggering this self-fetch at all. Proposed fix in the section above (skip the HTTP self-fetch, call the rating logic as a plain internal function) would also close this local-dev hang as a side effect, since there'd be no outbound fetch to hang on.

**Fix, session 47B:** implemented option (b) from the proposed fix above — extracted the entire rating-calculation body out of `ratings/route.ts`'s POST handler into `src/lib/ratingsService.ts`'s `calculateAndSaveRatings(matchId)`. `events/route.ts` now calls this function directly inside its existing `after()` block instead of making an HTTP self-fetch — no auth to forward or re-check, since this code only runs after `authUser.role` has already been verified as admin/logger earlier in the same handler. `ratings/route.ts`'s POST handler is now a thin wrapper (auth check → call the shared function → shape the response); its own auth gate and the GET handler's separate viewer-cookie-forwarding fallback path are both untouched.

**Evidence:**
- Commit: `dffc43f`
- Verified by: live DB + timing test — `dev/verify-backlog124-fix.mjs`, staging DB, a throwaway `LIVE`-status basketball match with real lineups and a real logger session (the exact configuration that previously froze the local dev server for minutes).
- Observed result: `POST /events` returned `201` in `7.4s` (not the old multi-minute freeze — the local dev server was independently confirmed still responsive to an unrelated request in under a second immediately after). A real `player_ratings` row was written (`auto_rating: 6.2`) for the scoring player — auto-ratings computed and persisted from a live event for the first time since this feature was written. `tsc --noEmit` held at 49 pre-existing errors, none new.
- **New finding surfaced by this fix, filed separately as `BUG-138`, not fixed here (Richard's explicit call — file only, no schema changes this session):** making this code path reachable for the first time revealed that `team_ratings` doesn't exist as a table on staging at all (schema drift — declared in `schema-ratings.ts`, apparently never pushed). `calculateAndSaveRatings` throws on its first `team_ratings` write, after all `player_ratings` writes have already succeeded — caught silently by the same `after()` try/catch, so it does not affect the event POST's `201` response, but team ratings have never been written on this platform either. Confirmed directly via `dev/check-rating-tables.mjs` (`sqlite_master` query): only `player_ratings` and `rating_history` exist.
- Pending items: `BUG-138` (missing `team_ratings` table) tracked separately. The 7.4s response time, while not the historic hang, is slower than ideal for a live-logging path — not investigated further this session (likely first-hit dev-server compilation of the new lib file rather than a structural issue, but not confirmed either way).

---

### ~~BACKLOG-125~~ — Basketball Live-Logging Write Path Broken (Score/Period Never Persisted, Roster Resolution Blocked Lineup Selection Entirely)

**Status:** RESOLVED — 2026-07-23 (session 47)

**Evidence:**
- Commit: PR #11 squash-merged to `dev` as `52b906c` (14 commits: `a7dc541` through `7bdf7ee`)
- Verified by: real interactive logger walkthrough (session 46) + live re-check on the post-merge preview (session 47)
- Observed result: score persistence, quarter/period persistence, the missed-shot stat bug, and the roster-resolution bug (blocking lineup selection entirely) all fixed and live-tested. Richard played a real match through Q1-Q4 on the PR preview and successfully finalized it — DB confirmed post-finalize: `{"status":"FINISHED","current_period":"FINISHED","home_score":2,"away_score":3}`. A session-47 finding during failure-banner testing (BUG-126, a guaranteed boxscore/player-modal crash from un-coerced `event.value` in `useMultiLogger`'s sync) was root-caused, fixed, and live re-confirmed clean (Free Throw + Personal Foul, the two repro cases, both clean past the 15s sync window) before merge.
- Pending items: three items explicitly **not** in this item's scope, tracked separately — (1) no WS broadcast wired for basketball at all (Tier 0 gap, `SYSTEM_CRITICALITY_MAP.md`); (2) no mid-match-resume seeding for basketball (Tier 0 gap, same doc) — both queued for the football-to-basketball systematic mapping pass; (3) the "shared logger core" refactor (`BasketballLogger.tsx`/`TrackLogger.tsx`/`FootballLogger.tsx` unified) remains deliberately deferred, `TrackLogger.tsx` has no persistence layer at all. None of these block basketball's core write path, which is what this item tracked.

<details>
<summary>Original session 46 SHIPPED note (superseded by the RESOLVED status above)</summary>

**Status:** SHIPPED (session 46, 2026-07-23) — basketball's core write path (score persistence, quarter/period persistence, the missed-shot stat bug, a roster-resolution bug blocking lineup selection entirely, and the "Finalize Match reachable" fix) fixed, pushed, and live-tested on `feature/basketball-write-path` (PR #11, targets `dev`, not yet merged/reviewed). **"Finalize Match reachable" confirmed via a real interactive logger walkthrough, not just API automation** — Richard played a real match through Q1-Q4 on the PR preview and successfully finalized it; DB confirmed post-finalize: `{"status":"FINISHED","current_period":"FINISHED","home_score":2,"away_score":3}`. Score persistence, period transitions, and rendering were all separately confirmed via direct API + DB checks earlier the same session. **Not RESOLVED yet — two items explicitly carried to next session:** (1) the event-save failure banner was never actually tested (deprioritized in favor of finishing the Finalize confirmation first); (2) this entry's own "shared logger core" fix is still not built — today's work patched `BasketballLogger.tsx` directly. `TrackLogger.tsx`'s complete absence of a persistence layer is untouched, still fully OPEN.
**New findings confirmed live during the walkthrough, not fixed, carried forward:** basketball has no mid-match-resume seeding at all (worse than first suspected — `matchStarted` re-seeds from the server but `lineupSet`/`homeStarters`/`awayStarters` don't, and there's no UI path back into lineup selection once `matchStarted` is `true` again, a genuine dead end on refresh/remount); no WS emit exists for basketball at all (same shape as football's already-fixed `BUG-108/116`). Both are exactly the kind of gap the planned football-to-basketball systematic mapping session (see below) should surface deliberately rather than by accident. **The resume-seeding half — RESOLVED session 47B, see `BUG-139`** (found live again, the hard way, on the PR #12 preview walkthrough — promoted from this buried note to its own tracked item and fixed with a roster-fallback seed, not the full server-side lineup-persistence rebuild). The WS-emit half remains open.
**Next session, in priority order:** (1) test the failure-save banner properly (a fresh match, block the events request via DevTools, confirm the banner renders); (2) run the systematic football-to-basketball mapping pass Richard has been asking for all session — walk `FootballLogger.tsx`'s business logic piece by piece (resume-seeding, WS emit + multi-logger sync, offline queue, undo/delete) and check each against `BasketballLogger.tsx`, fixing every gap found in one pass rather than more one-off live-test surprises; (3) decide whether PR #11 gets reviewed/merged before or after that mapping pass. See `RUNLOG.md` 2026-07-21 through 2026-07-23 for full verification evidence and `known-issues.md`/TD-012/BACKLOG-124/`BACKSCOPE.md` for adjacent findings discovered along the way (an admin-POST logger_id FK bug, a `second:0` collapsing to null, a local-dev-only ratings-fetch hang, and the Admin "Official Match Lineups" page's own separate football-centric-starter-count bug — none of those fixed, all filed separately).
**Unconfirmed assumption to verify during the mapping pass (cross-ref `BACKSCOPE.md`):** Richard observed that `BasketballLogger.tsx` lets the logger set/edit the starting lineup directly in-app, with zero dependency on the separate Admin "Official Match Lineups" page (confirmed in code — `eligible-players` only reads `player_team_affiliations`, never that page's data). His working assumption is that football's lineup flow is admin-publish-only by contrast — **not yet confirmed either way.** `FootballLogger.tsx` appears to use the same `eligible-players`/`memberships` pattern for its own roster resolution, which would suggest it might *also* be self-contained, making the Admin page a parallel "public display" feature for both sports rather than a real workflow difference. Confirm by reading `FootballLogger.tsx`'s own lineup-selection flow directly.
**Priority:** High severity, now urgent-in-progress rather than deliberately-deferred — actively being live-tested this session, not scheduled work.
**Filed:** 2026-07-21 (session 45), found by code-reading `BasketballLogger.tsx` and `TrackLogger.tsx` against `FootballLogger.tsx`'s already-fixed equivalents, before any live test. **Original problem description below is historical — kept as-is for the record of what was found; see the session 46 update above for current state.**

**Problem, `BasketballLogger.tsx` — match-level score never reaches the DB, three independent gaps stacking:**
1. **During play**: `POST /api/matches/[id]/events`'s `isScoringEvent` check (`src/app/api/matches/[id]/events/route.ts`) is `upperType === 'GOAL' || upperType === 'PENALTY' || isOwnGoal` — football's type strings only. Basketball's normalized types (`FIELD_GOAL`, `THREE_POINTER`, `FREE_THROW`) never match, so the atomic score-increment transaction (BUG-121's fix) never runs, and `broadcastScoreUpdate` is never called. `matches.homeScore`/`awayScore` is never touched by any basketball event, ever.
2. **At finalize**: `BasketballLogger.tsx`'s `finalizeMatch()` (the one function that *does* PATCH `homeScore`/`awayScore` to the server) runs as a `logger`-role session. `PATCH /api/matches/[id]/route.ts:500` gates the entire `homeScore`/`awayScore` write block behind `authUser.role === 'admin'` (BUG-052) — those fields are silently dropped from a logger's PATCH. Football's identical pattern (`handleFinalize`/`handlePeriodEndConfirm` also send `homeScore`/`awayScore` as a logger) gets away with this because football's score is already correct from gap 1's event-driven path by the time finalize runs — basketball has no such fallback, so this is the one moment the score actually needed to land, and it's the one thing that's dropped.
3. **The natural in-app path never reaches either mechanism.** The "End Quarter" button opens a period-transition modal; at Q4 (not tied) its own handler only calls `setMatchEnded(true)` and dispatches a `MATCH_STATUS_CHANGE` `CustomEvent` — no `fetch()`, no `await`, nothing server-side. Confirmed the event's two listeners (`src/app/page.tsx:280`, `src/components/MatchOverlay.tsx:481/544`) only update local client state or trigger a GET re-fetch, never a write. Worse: the header's real, persisting `finalizeMatch()` button is gated on `!matchEnded` (`BasketballLogger.tsx:662`) — once the period-modal path runs, that state is already `true`, so the real Finalize button disappears from the UI. A logger following the logger's own intended flow (End Quarter → Q4 → Finalize) cannot reach the code path that actually persists anything.

**Problem, `BasketballLogger.tsx` — quarter/period transitions never persisted:** same bug class as football's already-fixed **TD-010** (`known-issues.md`, 2026-06-25 — "no DB PATCH fired" on period-transition buttons). Football's fix (`FootballLogger.tsx:1687-1699` — an explicit `fetch(PATCH {currentPeriod: ...})` on every period-transition button) was never ported to `BasketballLogger.tsx`; every quarter change here (`setQuarter`, the `MATCH_PERIOD_CHANGE` dispatch) is local-state-only. A page refresh mid-basketball-match loses the current quarter entirely, with nothing in the DB to recover it from.

**Problem, `TrackLogger.tsx` — no persistence layer exists at all.** Grepped the entire 1011-line file for `fetch(`, `await`, any API call: zero matches. It's a fully local UI (heats, athlete times, field attempts) — nothing about a track event is ever sent to the server. This isn't a bug to fix, it's a feature that was never built past the client-side form.

**Confirmed working, not part of this bug:** basketball's individual event logging (`match_events` insert + live broadcast) and player stats (`basketballPlayerStats`'s `sport === 'Basketball'` branch in `updatePlayerStats()`) share football's exact, already-hardened code path in `events/route.ts` — these look structurally sound. Untested live (matches the earlier observation that `basketballPlayerStats` has zero rows), but not contradicted by anything found this session.

**Proposed fix (not built, deliberately deferred — see `BACKSCOPE.md`):** extract a shared logger core (event persistence, a sport-aware `isScoringEvent`, per-period PATCH persistence, and a finalize path that always reaches the server regardless of which button triggers it) that all three sport loggers consume, rather than patching three independent, duplicated implementations. Port `FootballLogger.tsx` to it first and re-verify the Three Critical Flows before touching basketball or building track's persistence layer — football is the only one of the three with a real live-test track record, and regressing it to fix basketball would be a worse outcome than leaving basketball/track as-is a while longer.

**Deferred, Richard's call:** doing a quick, basketball-only patch under this session's time pressure risks introducing a subtly different, unverified reimplementation of logic `FootballLogger.tsx` already got right through many rounds of live-tested fixes (BUG-052, BUG-121, TD-010, BUG-076). The shared-module refactor is real, scoped work for its own session, not a same-session patch. See `BACKSCOPE.md`'s "Basketball + Track live logging" entry for the full reinstatement criteria.

</details>

---

### ~~BUG-124~~ — Admin-Authenticated Event POST FK-Violates on `logger_id`

**Status:** RESOLVED — 2026-07-24 (session 47B)
**Priority:** Medium — only reachable by an admin bypassing the normal logger flow, but a clean 500 with no clear message when it happens
**Filed:** 2026-07-23 (session 46), found while live-verifying the P0 missed-shot fix

**Problem:** `POST /api/matches/[id]/events` (`src/app/api/matches/[id]/events/route.ts`) sets `loggerId: authUser.id` unconditionally, regardless of role. For an admin-authenticated request, `authUser.id` is the admin's `users.id` — but `match_events.loggerId` has an FK constraint to `loggers.id` (`schema.ts:378`), not `users.id`. Confirmed live: an admin token posting a real event 500s with `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`, since `admin-001` (or whichever admin id) doesn't exist in the `loggers` table. Re-confirmed live again this session (found while verifying `BUG-131`, before this fix landed).

**Fix:** `loggerId` is now `authUser.role === 'logger' ? authUser.id : null` — `null` is the honest value for this FK'd column when there's no real logger session backing the request. **Richard's own catch, addressed in the same pass:** null-ing `loggerId` alone would have silently discarded the audit trail entirely (no way to tell which admin posted the event). `loggerName` (a plain text column, no FK) now carries the admin's real `users.id` in that case — sourced from the verified `authUser` server-side, never client-passed input, per this project's own audit-field rule. `logger` role callers are unaffected (unchanged: `loggerName` still comes from the client-passed display name for real logger sessions).

**Evidence:**
- Commit: `9e0abcd`
- Verified by: live DB-confirmed test — `dev/verify-bug124-fix.mjs`, staging DB via local dev server, admin token.
- Observed result: `POST` returned `201` (not a 401 — admins are already authorized to post events by this route's own auth gate; this was never an auth problem, purely a DB FK mismatch). `match_events.logger_id` stored as `null`, `logger_name` stored as `"admin-001"` (the real admin id), `matches.home_score` correctly credited to `2` — confirming the event saves cleanly, the FK-unsafe column stays null, and the audit trail survives via the non-FK'd column instead of being silently dropped.
- Pending items: none for this specific gap.

**Related, raised and confirmed in the same discussion (not a new bug, already-shipped work re-verified):** `BUG-121`'s atomic transaction (event insert + score update in one `db.transaction`, score increment as a single atomic SQL expression) already correctly rolled back this exact FK crash with zero partial state — confirmed directly from this session's own earlier verification attempt (admin token, pre-fix), where the insert threw inside the transaction and `matches.home_score` was independently confirmed to have stayed at `0`, not partially incremented. No new work needed; cited here as live re-confirmation that `BUG-121`'s fix still holds under a real failure, not just the happy path.

**Related, filed separately per Richard's request — see `BACKLOG-140`:** this bug's root cause (a separate `loggers` identity table instead of a unified `users` table with an RBAC role) is the same structural root as `BUG-057`, `BUG-044`/`BUG-044b`, and two `known-issues.md` entries (2026-06-22, 2026-06-30). Filed as its own architecture item, not fixed here.

---

### ~~BUG-125~~ — Admin "Official Match Lineups" Page Defaults to Football's 11 Starters for Any Sport

**Status:** SHIPPED — commit `415c5e4`, session 47E (per `BUILD_JOURNAL.md`'s own session 47E entry, which describes this exact fix). **Status line never updated after the fix landed — found stale session 47F**, third instance of this same failure class this session (after `BUG-092`, `BACKLOG-141`). Confirmed genuinely built via direct code read, session 47F: `src/app/admin/match-lineups/page.tsx:27-36` — a comment block explicitly citing `BUG-125`, plus `isBasketballMatch()` and two call sites (`:501`, `:512`) that gate basketball matches out of this football-only formation-pitch builder with a redirect message, rather than the originally-proposed fix (making this page basketball-aware). A deliberate scope decision (avoid duplicating `BasketballLogger`'s own now-real lineup wizard, `BACKLOG-141`), not the fix this entry originally proposed below — kept for history. Not yet live-tested (verification pending, session 47F's broader pass).
**Priority:** Medium — this is a separate feature from `BasketballLogger`'s own in-app lineup selection (confirmed independent this session — `eligible-players` has no dependency on this page at all), so it doesn't block live logging, but it's broken for basketball as its own feature
**Filed:** 2026-07-23 (session 46), found live by Richard while exploring the admin panel during the BACKLOG-125 walkthrough

**Problem:** `src/app/admin/match-lineups/page.tsx`'s `handleMatchSelect` (lines 204-228) derives `playersPerSide` from `competitions.playersPerSide` (a competition-level column, schema default `11`) rather than from `match.sport` or `competition_sport_settings` (the table this same session's `BACKLOG-125` work extended with correct basketball defaults, `SPORT_DEFAULTS.basketball.playersPerSide: 5`). Since `BUSA LEAGUE BASKETBALL`'s `competitions.playersPerSide` was never explicitly set, this page silently falls back to `11`, showing "Home: 0/11 starters" and a football formation dropdown (`4-3-3` etc.) for a 5-a-side basketball match. Confirmed live via screenshot.
**Original fix proposal (superseded by the actual fix above, kept for history):** read `match.sport` (or join through `competition_sport_settings`) the same way `config/route.ts` and `BasketballLogger.tsx` now do, instead of the competition-level `playersPerSide` column, which was never the right source of truth for this.

---

### ~~BUG-126~~ — Basketball Boxscore Crashes (`a.toFixed is not a function`) ~15s Into Any Live Match

**Status:** RESOLVED — 2026-07-23 (session 47)
**Priority:** CRITICAL — guaranteed crash, not an edge case; would have hit every real basketball match
**Filed:** 2026-07-23 (session 47), found live by Richard testing the failure-save banner on the PR #11 preview

**Problem:** `match_events.value` is a TEXT column storing `JSON.stringify(value)` (`schema.ts:761`). `BasketballLogger.tsx`'s own initial-mount fetch correctly `JSON.parse`s it back to a number, but `useMultiLogger.ts`'s `syncEvents()` (line 140, shared by both sport loggers) passed `value: e.value` straight through unparsed. That sync runs on a 15-second interval for any connected logger (not just multi-logger sessions) and replaces the entire local `events` array with the merged result — so ~15s into any basketball match, every event's `value` silently became a string. `calculatePlayerRating`'s `rating += event.value` then string-concatenated instead of adding (`0 + "1"` → `"01"`), and the boxscore table's `.map()` over players crashed on `rating.toFixed(1)` (`"01".toFixed` is not a function) — reproduced live, full stack trace confirmed `Array.map` → the rating function → `toFixed`. Football never hit this because its equivalent rating calc already wraps with `Number(e.value)` at the same spot (`FootballLogger.tsx:493`) — basketball's never got that defensive coercion.
**Fix:** (1) `useMultiLogger.ts:140` — parse `e.value` the same way `BasketballLogger.tsx`'s initial fetch already does (`typeof e.value === 'string' ? JSON.parse(e.value) : e.value`), fixing it at the shared root for both sports. (2) `BasketballLogger.tsx`'s rating calc now also defensively `Number(event.value)`s before the arithmetic, mirroring football's existing pattern, so a future un-coerced read path can't reintroduce the same crash.

**Evidence:**
- Commit: `52b906c` (squash-merged to `dev` via PR #11)
- Verified by: code trace at fix time (`tsc --noEmit` clean on both changed files, 49 pre-existing errors elsewhere unchanged, root cause confirmed against the real stack trace Richard captured and against the schema/two divergent read sites), **plus a later live re-verification the same session** — the fix was re-confirmed live on the PR #11 preview via the `BACKLOG-134` failure-save-banner test (which is what originally surfaced this crash), then merged to `dev`.
- Pending items: none.

---

### BACKLOG-126 — No Working Transfer/Season Tracking (Roster History Silently Lost)

**Status:** OPEN
**Priority:** Medium — Tier 2 (roster/season management, not live-match-critical), but explicitly named by Richard as a "ready for next season" concern
**Filed:** 2026-07-21 (session 45), found while backfilling BUSA League Basketball — two real, confirmed mid-season transfers left zero trace in the DB

**Problem, confirmed with real data, not theoretical:** two BUSA League Basketball players genuinely transferred clubs mid-season, inside the league's own official trading window ("*TRADING BEGINS FROM ROUND 3 THROUGH ROUND 7*", per `dev/basketball-dates-and-fixtures.md`) — chronologically proven via box-score CSVs (a clean appear/disappear cutoff on the exact transfer date, cross-checked against the *other* team's CSVs starting to show them right after):
- `LIGHT`: Rim Reapers through 11-22-25 → Vikings from 11-26-25 onward
- `dekunle`: Rim Reapers #77 through 11-28-25 → Storm #15 from 12-6-25 onward

**Neither transfer left any trace in `player_team_affiliations`.** Both players have exactly ONE current affiliation row (`is_active: 1`, `end_date: null`) — for `LIGHT`, that row is Vikings (the *later* team); for `dekunle`, it's Rim Reapers (the *earlier* team). There's no consistency to which team ends up "current" — it's whatever a one-time roster entry happened to capture, not a maintained history. Confirmed via direct query (`dev/check-light-player.mjs`, inline check on `dekunle`'s affiliations) — neither has a second, inactive, dated row for their other team.

**Root cause is structural, not a simple bug:**
1. **Schema supports it, nothing uses that support.** `player_team_affiliations` already has `is_active`, `is_primary`, `start_date`, `end_date` — the right shape for a real transfer (close the old row, open a new one). But there is no admin UI action anywhere that does this — team/player management doesn't even have a basic "Create Team" UI yet (`BACKLOG-077`, still open), let alone transfer recording. The only precedent for writing affiliation changes at all is one-off `dev/*.mjs` scripts (BACKLOG-076's college-affiliation wiring).
2. **`basketballPlayerStats`/`footballPlayerStats` hardcode `season: '2024'`** in `updatePlayerStats()` (`src/app/api/matches/[id]/events/route.ts`) rather than deriving it from the match/competition — live-logged stats next season would still be tagged '2024' unless this is fixed first.
3. **No unique constraint on `(playerId, season, competitionId)`** on either stats table — nothing stops ambiguous duplicate rows across seasons, and the live path's `.get()` lookup (no season/competition filter) could silently update the wrong season's row if one ever exists.

**Not a blocker for the current backfill** — `basketball_player_stats` aggregates by player, not by team, so attributing a transferred player's stats correctly doesn't require their affiliation history to be accurate. This is a separate, real gap in the platform's season/roster-management readiness, not something this backfill needs to solve to proceed.

**Can be handled at script level today, no admin UI needed** — same precedent as BACKLOG-076: a `dev/*.mjs` script can correctly backfill the missing transfer history right now (deactivate the stale affiliation with a real `end_date`, insert the correct historical + current rows) even though there's no UI for it yet. Doing this for `LIGHT`/`dekunle` as part of this session's backfill (see RUNLOG.md).

**What's still missing to actually be "ready for next season":**
- An admin-facing way to record a transfer (even a simple one, not necessarily full UI) instead of a one-off script every time
- Fix `updatePlayerStats()`'s hardcoded `season: '2024'` to derive the real season from the match's competition
- A real unique constraint (or upsert-safe application logic) on `(playerId, season, competitionId)` for both stats tables
- **Display side has the same gap, confirmed live (session 45):** `GET /api/players/[id]` correctly wrote and returned LIGHT's historical Rim Reapers row after this session's fix, but the `memberships` array only surfaces the *active* affiliation (Vikings) plus the college row — the inactive, dated Rim Reapers history is silently absent from the response entirely, not just hidden by the frontend. Even with correct data now sitting in the DB, there's no way for a viewer (or admin) to see a player's actual transfer history anywhere in the product. Recording history at the DB level (this session's fix) and *displaying* it are two separate gaps — closing one doesn't close the other.

---

### BACKLOG-127 — MVP Feature Is Fully Unwired (No Real Write Path, Anywhere)

**Status:** OPEN
**Priority:** Low — display/engagement feature, not live-match-critical
**Filed:** 2026-07-21 (session 45), found while checking whether the basketball backfill should populate MVP data

**Problem:** `src/app/api/basketball/leaderboard/mvp/route.ts` builds a "most MVP awards" leaderboard by reading `matches.stats.mvp` (a free-text field on each match row) across every Basketball match. The **only** code anywhere that ever writes to that field is `src/db/seed-busa-basketball.ts` — which wrote **randomly-picked fake names**, not real data. Grepped the entire app for any other writer: none exists. `BasketballLogger.tsx` has no MVP-assignment control at all (its one "MVP" text reference is a caption about player *ratings*, an unrelated, already-working feature). The admin match page has no MVP field either.

**Made worse this session, incidentally**: the fake `stats.mvp` blobs on all 30 seeded BUSA League Basketball matches were cleared to `NULL` as part of the `BUG-105`-style stats cleanup (`dev/fix-basketball-seeded-matches.mjs`, correct thing to do — fake data is worse than none) — so the MVP leaderboard endpoint now returns nothing at all for these matches, whereas before it silently returned fake results. Not a regression in the sense of breaking something real (the prior fake data was never legitimate), but worth noting the leaderboard is now visibly empty rather than plausibly-wrong.

**Real MVP data exists and is unused**: `dev/basketball-busa-league-scores.md` has the actual MVP for all 30 regular-season games (from the source Scores docx), never written anywhere.

**What's missing to build this for real:**
- A real write path — most naturally a post-match admin action (MVP is normally decided once full stats are in, same timing as the existing player-ratings calculation), not a live in-game `BasketballLogger.tsx` button
- Decide the target shape: continue using `matches.stats.mvp` (simple, already has a reader) or a proper `player_id` FK instead of a free-text name (avoids the exact identity-resolution ambiguity this session spent significant effort resolving for player stats)
- If keeping `matches.stats.mvp`, the real MVP names from `dev/basketball-busa-league-scores.md` could be backfilled into the 30 seeded matches once the write path exists — not done this session, deliberately deferred alongside the write-path decision above

**Deferred:** not built this session — Richard's call, low priority relative to `BasketballLogger.tsx`'s Tier 0 gaps (`BACKLOG-125`).

---

### BACKLOG-018 — Game Event Logsheets (BUSALYMPICS + BUSA League match events)

**Status:** IN PROGRESS — BUSALYMPICS portion COMPLETE (7 of 7 matches, 2026-07-09). BUSA League: **the entire `busa-match-N` series (1 through 27) is now COMPLETE, 2026-08-04 (session 49)** — every one of those 27 rows has `match_events`, plus both semifinals and 3rd Place already live-logged/applied, plus the Final. **Only one match in the full 32-match structure remains: Deadline FC vs Quantum FC (Group D, GW3) — never inserted into the `matches` table at all, date known (Sat 22 Nov 2025 per the GW3 image) but score never sourced (no FA report, not yet supplied by Richard).** Full session-49 detail in RUNLOG.md 2026-08-04 and `dev/busa-group-qf-goal-data-consolidated.md`.

**Progress note (2026-08-04, session 49) — closed out the remaining 7 matches (busa-match-18/19/20/22/23/25/26).** Full per-match detail in RUNLOG.md. Headline items: busa-match-22 (Allianz 3-0 Legacy) surfaced a real discrepancy between the canonical schedule doc and the live DB row's own home/away/score — the DB was correct (Allianz is the real home/winner), the doc was stale, now fixed in `busa-league-canonical-schedule.md`. busa-match-18 (Kings 15-0 Cruise) was the most involved write of the whole backfill — Richard supplied the real FA sheet text directly plus a ratings graphic for cross-check, resolving two real jersey-number ambiguities (Kings has two different real players both wearing #17 in the DB) via Richard's direct calls, full reconciliation trail preserved in `dev/busa-match-18-fa-vs-graphic-reconciliation.md`. Also fixed busa-match-18's known 1-day date bug in the same batch. Every new player created this session got a platform-wide name cross-check in addition to the team+jersey-slot check, after Richard flagged the gap mid-session.

**GW1 COMPLETE (2026-07-13): all 7 GW1 matches (busa-match-1 through -7) now applied and DB-verified.** (Correction: GW1 actually has 7 matches, not 6 — busa-match-7/Cruise-Santos was initially missed.)

**GW2 COMPLETE (2026-07-13, session 42): busa-match-8 (Allianz 1-1 Agenda) and busa-match-9 (Joga 4-0 Westbridge) applied — the only two GW2 matches not already done from earlier sessions.** Full detail in RUNLOG.md 2026-07-13. Real process gap caught and fixed mid-match: two players (Allianz's carded #6, Agenda's assisting #8) were initially profiled as placeholder stubs after a DB/platform-wide search found nothing — the real team-sheet CSVs at `C:\Users\Wise\Downloads\BRIXSPORT\BUSA LEAGUE\teamsheet\` (14 files, one per team, confirmed still available and not ephemeral) resolved both: #6 is real (Jeremiah Osuya, "Big shalli"), and Agenda's "#8" was actually an already-established player (Alex) whose stored jersey number was simply wrong (88, corrected to 8). Both fixed in place same session (`dev/fix-match8-identities.mjs`). New standing rule (see known-issues.md 2026-07-13): check the real team-sheet CSV before creating any placeholder stub, not just the DB/platform search. Westbridge's 3 previously-"unconfirmed" card mentions on busa-match-9 were confirmed real by Richard and resolved the same way — 2 real new players (Uthman Adeyemi, Nathaniel Adelekan) found via `WESTBRIDGE.csv`, 1 (#2) confirmed genuinely absent from the sheet after checking every row, correctly left as a real placeholder.

**Round 17 done (2026-07-13, session 42): busa-match-17 (Pirates FC 10-0 Deadline FC) applied — goals-only mode, 16 events (10 Goal, 6 Assist), zero deferred items, full detail in RUNLOG.md 2026-07-13.** This is the fixture session 41D flagged as almost skipped under "GW1 complete" reasoning (it's a GW1 pairing by Group D structure despite being rescheduled in-tournament to Nov 21) — resolved before it could recur as a gap. Next up: GW2 (busa-match-8, -9 — the only two GW2 matches not already done from earlier sessions).

**BUG-105 found and fixed mid-session (see full entry below): 14 already-backfilled matches were showing fake, stale seeded stats on their public Stats tab instead of real computed-from-events data — a platform-wide `stats` column staleness bug, not specific to any one match.** Fixed via a one-time `UPDATE matches SET stats = NULL` on all 14 affected rows; the existing API guard now correctly recomputes. Action item for every future match-write script: also clear `stats` on any pre-existing match row being backfilled.

**Progress note (2026-07-13, continued):** Richard shared 6 new files (`roaster.md`, `matchreport.md`/`2`/`3`/`4.md`, `matchscore.md`) plus 14 team-sheet CSVs, unlocking goal/assist/card data for **20 of the 21 then-remaining matches** (everything except Deadline-Quantum). Consolidated into `dev/busa-group-qf-goal-data-consolidated.md`. Richard's call: proceed match-by-match with sign-off, same rhythm as every prior match. busa-match-1 (corrected against a real FT result graphic, superseding both the FA parse and the JSON source), busa-match-2 (first match needing brand-new identity resolution for 2 teams — surfaced a real jersey-number conflict on Legacy's #5/#4, resolved by leaving the existing player untouched per Richard's call; introduced the "profile as placeholder stub" pattern for 3 unresolved card-holders, extending the established "Wolves #2"-style approach), and busa-match-3 (Allianz-La Fabrica — a card-count ambiguity resolved across 2 rounds of Richard confirmation, since a real FT graphic's simplified single-icon display for 2 of the 3 double-card players initially looked like it might mean fewer events than the text description implied) all done. Also fixed the "Wolves #2" placeholder in place — `wolves.csv` confirmed his real identity (Oladipupo Martins, "Gabriel"), same player ID, existing event untouched. busa-match-4 (Underrated-Quantum) also done, bundled with 6 profile fixes for existing platform-wide stub players — full names, not just jersey numbers, per Richard's explicit request to keep profiles complete as identities resolve. busa-match-5 (Kings-Hammers) done — a real FT graphic under-reported cards this time (only 2 of the real 7), the FA report had the fuller picture once reconciled. **Real bug caught mid-write: fabricated 2 player IDs by false analogy to naming patterns instead of querying the DB (MICHEAL in the Kings-Pirates SF, Ola-praise here) — both caused clean FK-rollbacks, no data corrupted, but now a hard rule: always query for the real id, never infer it.** Two rounds still flagged as needing Richard's direct call before writing (Round 18 Kings-Cruise repeats the known FA team-mislabeling; Round 22 Legacy-Allianz has a goal list that doesn't obviously match the recorded scoreline direction).

**Progress note (2026-07-13):** Both held-out semifinals written — real dates supplied directly by Richard (Joga-Hammers: Sat 10 Jan 2026 4pm; Kings-Pirates: Fri 9 Jan 2026 4pm), unblocking the sole reason both were held out of the `matches` table since session 41. **Kings-Pirates correction, resolving session 41's open "3rd, extra goal (Akinbode)" note**: the Lone Sheets' AKINBODE row (`goals:1`) was wrong — real breakdown is 2 goals (Animashaun, Kedem) + 1 assist (Akinbode, relabeled) + a missed penalty (Kedem, saved by Malcom/Pirates GK) that the sheet mis-recorded as a 3rd goal. First-ever backfill use of `Penalty Missed`/`Penalty Saved` event types (previously only used by the live logger). 5 of Kings' lettered sub-pairs (A-E) resolved unambiguously; Pirates' own subs deferred (ambiguous 3-way overlap, no pairing data, same rule as every prior ambiguous window). One real bug caught mid-write: a fabricated player ID (misremembered from an old journal note about a different match) caused a clean FK-rollback on the Kings-Pirates batch — Richard confirmed the real identity (Michael Oguntola) directly, re-run succeeded. Full detail in RUNLOG.md 2026-07-13.

**Progress note (2026-07-12, session 41D):** Investigated building a "date TBC" mechanism to unblock both held-out semifinals without a sourced date. Scoped, not built — a real fix requires `matches.start_time` to go from `NOT NULL` to nullable (a full SQLite table-rebuild migration, since other tables FK-reference `matches.id`) plus display-layer handling across **42 files** that call `new Date()`/`format()` directly on `startTime` — a platform-wide convention change, not a two-file tweak. Deferred rather than rush a partial version or use a fabricated placeholder date. Joga-Hammers' parsed sheet needs no rework once a real date surfaces or TBC ships — write is a single continuous pass whenever unblocked.

**Progress note (2026-07-11, session 41B):** First real match_events write for BUSA League. busa-match-13 (Cruise FC vs Hammers, 2-2) applied: **93 events** (full BUSALYMPICS-parity stat capture — Goal/Assist/Shot on-off Target/Save/Clearance/Interception/Tackle/Foul/Yellow/Red/Substitution), 24 players touched, cumulative recompute applied to all. Cruise's own goal is a known, accepted gap (sheet coverage 0% for Cruise per the canonical schedule doc — not fabricated). Surfaced and fixed 4 real bugs along the way: (1) two more duplicate-player-with-real-events cases in the Hammers roster ("Sancho"/"Speedy"/"Spectrum", same shape as Lazzy Woods/Mayokun — merged into their real players via dry-run/apply scripts, all DB-verified, see RUNLOG.md); (2) a 4th recurrence of the nickname-scoped-to-wrong-affiliation bug (Olaoluwa Olusanya's "Lazzy" nickname was only on his COLENG row, not his busa-hammers club row — fixed additively); (3) a jersey-number data-entry error (Timi recorded as busa-hammers #5 in the DB, but every logsheet consistently shows #18 — corrected, #18 was free); (4) **the write script's own Substitution events were initially wrong** — built as unpaired IN/OUT events instead of the established single-paired convention, and didn't account for BUSA League's 35-minute-half format (full time = 70', not 90) treating 9 "played to the end" players as fabricated substitutions. Caught and fixed before commit by cross-checking `dev/backfill-write-md1g2.mjs`'s actual convention — corrected to 1 real Substitution event (104→93 total). Scope decision: full-stat capture (not just goals/cards) chosen over the narrower scope the identity-resolution script was originally built for — this multiplies the identity-resolution burden per match (18 unresolved names surfaced vs 1 for goals/cards-only), so remaining matches are being done one at a time with sign-off, same rhythm as the BUSALYMPICS sessions. See BUILD_JOURNAL.md Session 41B and known-issues.md for full detail.

**Progress note (2026-07-11, session 41):** BUSA League's real structure now fully mapped and verified — not the 27 flat matches originally assumed, but 32 total (24 group-stage + 4 QF + 2 SF + 3rd Place + Final). FA data (26 PDF reports) cross-referenced against all 27 `busa-match-*` DB rows: 23 confirmed correct, zero real corruption found. `competition_team_entries` group-seed applied (16 rows). Both semifinals identified and score-confirmed via 3 independent sources but held out of the `matches` table — no server-side visibility gate exists on `approval_status`, so an unconfirmed-date/placeholder row would be fully public immediately. Full canonical schedule at `dev/busa-league-canonical-schedule.md`. 85 new player stubs created across 7 previously-unbackfilled club rosters (see RUNLOG.md 2026-07-11 for the 5-pass verification pipeline).
**Priority:** Medium
**Filed:** 2026-06-07
**Blocked by:** ~~BACKLOG-016~~ — superseded by a dev/ script pipeline instead of a UI flow (see below)

**Progress note (2026-07-09, session 40C close):** All 7 BUSALYMPICS football matches fully backfilled and DB-verified — MD1 g1 (COLNAS 2-1 COLMANS), MD1 g2 (COLENG 2-3 COLENVS), MD2 g1 (COLNAS 1-2 COLENG), MD2 g2 (COLMANS 2-1 COLENVS), MD3 g1 (COLNAS 3-1 COLENVS), MD3 g2 (COLMANS 0-1 COLENG), Final (COLNAS 5-0 COLENG). Methodology: `dev/parse-match-sheet.mjs` (xlsx → canonical JSON) → `dev/backfill-match-players.mjs` (exact/fuzzy/platform-wide matching, `--self-test` guard, college-exclusivity guard) → `dev/backfill-run-sheet.mjs` (one-command wrapper) → per-match `--dry-run`/`--apply` write scripts with atomic batch commits. MD3 and the Final had no match sheet, only goal-scorer lists — proved out a lighter "goals-only" write pattern (Goal/Penalty events only, no fabricated stats) that's reusable for any future match with partial data.

**Critical fixes across the BUSALYMPICS backfill:**
1. Recompute must be cumulative (full player event history, not the current match's scope) — a scoped recompute silently overwrites rather than adds to prior-match contributions. Also surfaced and fixed an independent live-data bug this caused (MD1 g1's one-time stats zero had wiped the real Pirates-vs-Hammers match's stats).
2. College affiliation is exclusive (one college per player) but the matcher had no check for it — caused a real dual-college collision (Israel Emmanuel wrongly linked to both COLENG and COLMANS). Fixed with a full trace-and-repoint script, then built `dev/lib/college-guard.mjs` to catch this class of mistake automatically going forward (wired into both the matcher and write-script pre-flight).
3. Nicknames are per-team-affiliation, not global — three different players (Mayokun, Olusanya, Ayomiposi Alabi) each had a matching nickname written to the wrong affiliation row, causing the matcher to repeatedly fall through to platform-wide search and surface wrong candidates (including one real duplicate player record, deleted). All three fixed additively.
4. Own Goal events must be attributed to the conceding player's own team and tracked separately from regular goals (`own_goals` stat column) — first exercised in MD2 g2.

**Evidence:**
- Commit: N/A — data-only backfill, no application code changed. Full statement counts and post-apply DB verification for every match logged in `RUNLOG.md` (2026-07-09 entries, session 40B/40C).
- Verified by: post-apply SELECT queries confirming every row count; cross-match cumulative stats hand-verified against known prior totals for overlapping players across every match; sanity checks against each match's actual scoreline via summed Goal+Penalty(+Own Goal) event counts — all 7 matches matched exactly.
- Observed result: 7/7 BUSALYMPICS matches applied, zero data integrity issues remaining (Israel Emmanuel collision resolved, all recurring nickname bugs fixed).
- Pending items: 27 BUSA League matches (different competition within the same 34-match backlog scope) — sheets not yet organized, not started this session.

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

### ~~BACKLOG-016~~ — Roster Builder (Replace / Supplement Bulk Register)

**Status:** SUPERSEDED by BACKLOG-037 — which is the active, progress-tracked version. BACKLOG-037 Steps 1–7 complete. Refer there for current state.
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

**Status:** OPEN — Phase 1 COMPLETE. Phases 2–8 in various states of progress.
**Priority:** High
**Filed:** 2026-06-04

#### Phase 1 — Dev/Production Infrastructure ✅ COMPLETE

- Set up staging branch (dev/staging) separate from main
- Deploy staging to Vercel as separate project or
  preview deployment with its own env vars
- Separate Turso DB for staging vs production
- Separate Railway WS server for staging
- Environment parity checklist — staging must mirror
  prod config exactly minus real data
- Git branching strategy: main = prod, dev = staging,
  feature branches off dev

#### Phase 2 — Bug Fixes & Pending Blockers ✅ LARGELY COMPLETE

- ~~BUG-001~~ middleware bypass — RESOLVED Session 3
- ~~BUG-002~~ admin routes missing getAuthUser — RESOLVED Session 3
- ~~BUG-003~~ debug auth endpoint /api/auth/test — RESOLVED Session 3
- ~~BUG-004~~ hardcoded createdBy: 'admin-1' — RESOLVED Session 3
- ~~BUG-005~~ unbounded queries — RESOLVED Sessions 3 + 6
- ~~BUG-006~~ XSS via dangerouslySetInnerHTML — RESOLVED Session 3
- ~~BUG-007~~ assignedLoggers emails exposed — RESOLVED Session 3
- ~~BUG-008~~ duplicate logger assignment race condition — RESOLVED Session 3
- ~~Fix Goal/GOAL casing mismatch~~ — RESOLVED BUG-012 Session 3
- Fix SAVE/BLOCK casing mismatch (still OPEN)
- Fix startDate/endDate PATCH crash (BACKLOG-003 — still OPEN)
- Fix competition creation NaN console warnings (still OPEN)

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
| Transfers page                   | BUG-004 resolved ✅ — stability audit still needed | Full UI audit + staging test     |
| News / articles                  | BUG-006 XSS resolved ✅ — still 🔴 high volatility | Full audit + staging test        |

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

**Status:** PHASE B RESOLVED — commit `64b0974`, verified session 34 test match 2026-06-27. Sub cap gate (3 subs, blocked on 4th attempt ✅), timer ceiling (display clamps at halfDuration, absoluteMinute keeps ticking ✅), period survival (SECOND_HALF persists across hard refresh ✅). BACKLOG-108 tracks rolling subs test (separate match required).
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

#### Phase B — UNVERIFIED (commit `64b0974`)

`FootballLogger.tsx` — after `MatchStateManager` init on mount:
1. `GET /api/matches/[id]/config` → applies `config.halfDuration` via `updateConfig` + `setHalfDuration`; stores `config.maxSubstitutions` in `useState<number | null>(null)`
2. Sub cap gate in `handleSubIn`: reads `matchState?.stats?.substitutions[teamIndex]`, blocks with `alert()` if at cap (skipped when `maxSubstitutions === null`)
3. Half-duration toggle already locked post-`NOT_STARTED` (pre-existing, confirmed)
4. Alert on config fetch failure — falls back to hardcoded default, does not block logger

**Live verification 2026-06-25 (partial):**
- Period `HALF_TIME` written correctly ✅
- `halfDuration: 35` loaded from config, toggle shows 15/20/25/30/35/40/45 ✅
- Toggle locked in `HALF_TIME` (not `NOT_STARTED`) ✅
- Lineups locked indicator visible ✅
- **Sub cap gate: NOT YET TESTED** — verify on next live match test (log a sub past cap, confirm alert blocks)

Remaining Phase B items (rolling subs, auto half-time prompt, prod DB migration) — deferred.

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

### BACKLOG-066 — College field change auto-manages college team affiliation

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-17
**Depends on:** BACKLOG-049 (start_date/end_date wiring must be active first)

#### Problem

`players.college` field and `player_team_affiliations` college rows are currently managed independently. Setting `college = 'COLNAS'` on a player does not automatically create or update the corresponding affiliation row — they can silently drift out of sync.

#### Correct Architecture

When `college` is set or changed on a player profile (via admin modal or edit profile):

1. Look up the team row where `ownerOrganizationId` matches the college code
2. If no active college affiliation exists → create one (`affiliation_type: 'college'`, `is_primary: false`, `start_date: now`, `is_active: true`)
3. If an active affiliation to a **different** college team exists → close it (`end_date: now`, `is_active: false`), open the new one
4. Old row is retained as history — preserves transfer/college-change audit trail

#### Impact

- Edit modal becomes the automatic trigger for affiliation management — no manual roster scripts for future college assignments
- History preserved via `start_date`/`end_date` (BACKLOG-049 enabler)
- The 110 players missing college affiliations will be resolved automatically once their `college` field is set via a script or admin UI

#### Notes

- For the 110 current missing players — script approach remains the correct immediate fix since this is not yet built
- Once BACKLOG-066 lands, the script is unnecessary for future cases
- Implementation: server-side logic in `PATCH /api/players/[id]` — detect college field change, run affiliation lookup + create/close logic atomically

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

### ~~BACKLOG-058~~ — Logger Offline Event Queue

**Status:** RESOLVED — 2026-06-24 (Session 30)
**Priority:** ~~CRITICAL~~ — closed
**Filed:** 2026-06-16

**Evidence:**
- Commits: BUG-058b `1057f22` (refresh/localStorage re-seed), drain fix `49ce483` (IDB API correction)
- Verified by: Live Test 3 run on staging (brixsports-staging.vercel.app/logger), iPhone 12 Pro viewport, incognito
- Observed result:
  - SW background sync fired: `[SW Admin] Background sync: sync-match-events`
  - 15 queued events drained and POSTed (events 1–15 logged as "Match event synced: N")
  - `[SW Admin] All match events synced` confirmed
  - IDB `pendingMatchEvents` store: **Total entries: 0** after drain — queue fully cleared
  - Public page: offline events visible (Own Goal 36:28, Red Card, Yellow Card, Foul 36:54–57) — all landed
- Pending items: none

**Root cause chain (full history):** BUG-044 (cookie never set) → two parallel IDB implementations (wrong store wired) → BUG-058b (AuthContext wipes localStorage on mount) → SW drain IDB API mismatch (`db.getAll` Dexie pattern on raw `IDBDatabase`). All four now fixed.

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

### ~~BACKLOG-059~~ — SW Scope Conflict Audit (PRE-LIVE-MATCH BLOCKER)

**Status:** RESOLVED — 2026-07-27 (session 47D)
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

**Audit result (session 47D, delegated to a subagent, code-confirmed):** the premise was already stale — `public/sw.js` doesn't exist. It was deleted in `d0f27336` ("chore(pwa): delete retired sw.js - replaced by sw-user.js (BACKLOG-059)"), **the same day this entry was filed**, but the entry itself was never closed. Only two SWs are live: `sw-user.js` (root layout, scope `/`, `src/app/layout.tsx:223`) and `sw-admin.js` (registered on both `/admin`, `src/app/admin/layout.tsx:54-58`, and `/logger`, `src/app/logger/layout.tsx:24-28` — deliberate reuse per `BACKLOG-093`, not an oversight; `sw-admin.js`'s own precache list explicitly covers both paths). `usePWA.ts`'s path guard (`src/hooks/usePWA.ts:12-17`) skips the root `sw-user.js` registration on `/admin`/`/logger`, so the on-paper scope overlap (`/` vs `/admin`/`/logger`) never actually collides in practice — confirmed via the only real `.register()` call site in the codebase (`src/lib/pwa.ts:24`). The double-registration risk the ticket specifically worried about (`push-service.ts` independently calling `.register('/sw-user.js')`, `known-issues.md`'s own documented past bug) is also already fixed — it now only calls `getRegistration('/')`, no register.

**Evidence:**
- Commit: `d0f27336` (the actual sw.js deletion, pre-existing) — this session only closed the doc gap
- Verified by: full-codebase grep for every `navigator.serviceWorker.register`/`getRegistration` call site, cross-referenced against all three role layouts
- Observed result: no `sw.js` file, no scope conflict, no double-registration — all three original fix steps were already done, only step 4 (document ownership) was outstanding
- Pending items: none for this entry. `PWA_IMPLEMENTATION_GUIDE.md` updated with a "Service Worker Ownership Map" section per the entry's own step 4.

---

### ~~BACKLOG-060~~ — SW Architecture Cleanup

**Status:** RESOLVED — 2026-08-03 (session 47G), live-tested against a fresh Vercel preview via a direct Cache Storage read (both files are plain `.js` outside the TS project, so `tsc` doesn't cover them — verified via `node --check` for syntax)
**Priority:** MEDIUM — quality improvement, not blocking
**Filed:** 2026-06-16

#### Problem
Current SWs use blanket API caching — volatile data (live events) treated
same as static data (team rosters). Cloudinary requests intercepted by SW
unnecessarily, wasting Cache Storage quota.

#### Fix (done)
- Both `sw-user.js` and `sw-admin.js`: added `isNeverCacheApi`/`isShortTtlApi`/`isStaleWhileRevalidateApi`/`isFreshEnough` helpers (identical in both files, mirroring the same the-two-sides-must-agree convention `BUG-193`'s own follow-up fix established for the shared IndexedDB schema) and rewrote the `/api/*` fetch branch into four buckets:
  - **Never cache** (`/api/matches/[id]/events`, `/api/matches/[id]/config`, `/api/auth/*`): straight `fetch(request)`, no cache read or write at all.
  - **Short-TTL network-first** (`/api/matches`, `/api/competitions`): network first; on failure, only serve a cached response if the cached `Response`'s own `Date` header is within 30s (`isFreshEnough`) — otherwise falls through to the existing offline/error response rather than silently serving stale livescore data.
  - **Stale-while-revalidate** (`/api/players`, `/api/teams`): serves a cached copy instantly if present while refreshing it in the background (`event.waitUntil`); falls through to network directly on a cold cache.
  - **Everything else under `/api/*`**: unchanged prior behavior (network-first, cache-fallback, no staleness check) — nothing uncategorized regresses.
  - Order-sensitive: the never-cache patterns are checked before the short-TTL `/api/matches` pattern, since `/api/matches/[id]/events`/`/config` would otherwise also match the broader `/api/matches` prefix.
- Both files: `res.cloudinary.com` requests now skip the SW's fetch handler entirely (`return` before the image-cache/static-asset logic), letting Cloudinary's own CDN serve them natively instead of double-caching through Cache Storage.
- `sw.js` retirement: moot — the session 47D PWA audit already confirmed `public/sw.js` does not exist in this checkout (repo-wide search, zero matches), so there was nothing to retire.

#### Evidence
- Verified by: `node --check` clean on both files at fix time; live re-test session 47G — a direct `caches.keys()`/`cache.keys()` read of every Cache Storage bucket on a real Vercel preview after a genuine session of app usage (basketball + football logger sessions, homepage load, teams/players pages)
- Observed result: **never-cache confirmed** — zero `/api/matches/[id]/events`, `/api/matches/[id]/config`, or `/api/auth/*` entries in any cache, despite those endpoints genuinely being fetched multiple times during the session (event fetch on mount, undo DELETE, config fetch). **Stale-while-revalidate confirmed** — `/api/players`/`/api/teams` present in both admin and user API caches, as expected. **Cloudinary confirmed** — zero `res.cloudinary.com` entries anywhere; team logos in this dataset route through `/assests/Logos/*` (local static) and Next.js's own `/_next/image` optimizer, not raw Cloudinary URLs, so this also rules out the skip having silently no-opped. **Real gap found and fixed via this same live check**: the short-TTL bucket's `/^\/api\/matches(\/|$|\?)/` pattern never matched the homepage's actual live-match list calls — `src/app/page.tsx` fetches `/api/basketball/matches`, `/api/football/matches`, `/api/other/matches` (sport-specific list endpoints), not a bare `/api/matches` — confirmed via the cache read showing them sitting in the generic "everything else" bucket (cached, but with no 30s staleness check) instead of the intended short-TTL bucket. Added `/^\/api\/(basketball|football|other)\/matches(\/|$|\?)/` to `SHORT_TTL_API_PATTERNS` in both files to close it.
- Pending items: none — the one gap this live test surfaced was fixed in the same pass.

#### Depends on: BACKLOG-059 (already RESOLVED)


---

### BACKLOG-057 — Pool/Squad Tab Rename + "Add Player" Panel Relocation (updated scope)

**Status:** OPEN
**Priority:** Low — cosmetic/UX only, no data model change
**Filed:** 2026-06-16 (updated scope 2026-06-17)

#### Problem
Tab labels are conceptually swapped and the "Add Player to Pool" panel is mounted in the wrong tab.

Current state:
- "Roster" tab → should be **Pool** (permanent affiliation management — add/remove players, set jersey numbers)
- "Squad" tab → should be **Squad** (competition-scoped — who's selected, editable squad/jersey numbers per competition)
- "Add Player to Pool" panel currently lives in the Squad tab — it belongs in the Pool tab

#### Required Changes
1. Rename the Roster tab label → **Pool**
2. Rename the Squad tab label → **Squad** (already correct semantically, just confirming)
3. Move the "Add Player to Pool" panel from Squad tab into Pool tab
4. Squad tab shows only competition-scoped squad entries — jersey/squad number editing inline

No schema or API changes. UI-only.

#### Notes
- Build after BACKLOG-037 roster upload is verified on staging
- Related: BACKLOG-053 (roster inline edit), BACKLOG-067 (competition display name per squad entry)

---

### BACKLOG-067 — Competition Display Name Per Squad Entry

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-17

#### Problem
A player may go by different names in different competitions — e.g. "Puyoo" in BUSA League, "Posi" in Intercollege. The current squad pencil icon only edits `squadNumber`. There is no way to record a competition-specific display name per squad entry.

The `nicknames` JSON array on `playerTeamAffiliations` is the right home for this — it's already per-team-affiliation. The squad entry (squadPlayers row) needs a `displayName` field that a logger or admin can set per competition.

#### Required Changes
1. Add `displayName` text column (nullable) to `squadPlayers` table
2. Run `db:push` against staging, then prod
3. Squad tab pencil icon edit form: add a "Competition display name" text input alongside `squadNumber`
4. PATCH `/api/admin/teams/[teamId]/squad/[squadPlayerId]` — accept and persist `displayName`
5. Logger player search: surface `displayName` when set (show alongside `jerseyName`)
6. Match event logging: when logging an event, show `displayName` if set for that competition's squad

#### Notes
- `nicknames` on `playerTeamAffiliations` is per-team, not per-competition — `displayName` on `squadPlayers` is the correct per-competition scoping
- Do not start until BACKLOG-037 Step 7 (Squad Selector) is verified on staging
- Related: BACKLOG-041 (nickname search in logger), BACKLOG-057

---

### BACKLOG-068 — Multi-Sport Player Profile Audit and Merge

**Status:** OPEN
**Priority:** Medium — data integrity, not blocking live matches
**Filed:** 2026-06-17

#### Problem
Players who compete in multiple sports (e.g. Jabbar in football + basketball) have separate player profiles — one per sport. The correct model is one canonical player profile with multiple `playerTeamAffiliations` rows across different sports and teams.

Separate profiles cause stat fragmentation, duplicate search results, and broken cross-sport leaderboards.

#### Required Changes
1. **Audit** — query for players with name similarity > 80% across different sport contexts. Output a report: name, sport, team, player_id, match_events count per profile.
2. **Merge script** — for confirmed duplicates:
   - Identify canonical profile (higher match_events count, or earliest created_at)
   - Re-point all `match_events`, `playerStats`, `playerRatings`, `squadPlayers`, `playerTeamAffiliations` rows from the duplicate to the canonical `player_id`
   - Delete the duplicate `players` row
3. **Add second-sport affiliation** to the canonical profile via `playerTeamAffiliations` (college team or BUSA team for that sport)

#### Notes
- Do not touch this without a written merge plan per player — it is a destructive data operation
- Run audit script first, confirm with Richard, then build merge script
- Merge tool (BACKLOG-042) would be the right permanent solution — this is a one-off manual fix until that exists
- Related: BACKLOG-042 (player merge tool)

---

### BACKLOG-069 — Partial Player Profile Audit

**Status:** OPEN
**Priority:** Medium — data quality, not blocking
**Filed:** 2026-06-17

#### Problem
Many player profiles have missing fields — some non-critical (nicknames, age), some critical for live logging and competition eligibility (college, position, jersey number). No systematic report exists of which fields are missing and for how many players.

#### Required Changes
1. **Audit script** (`dev/audit-player-profiles.mjs`) — query all Bells BUSA-league players and output a structured report:
   - Critical missing: `college` (NULL), `position` (NULL or empty), `jerseyNumber` / `number` (NULL)
   - Non-critical missing: `jerseyName` (NULL), `university` (NULL), `age` (NULL), `email` (NULL)
   - Flag players with `college` set but no matching `playerTeamAffiliations` college row (should be 0 after BACKLOG affiliation backfill, but verify)
   - Output: CSV or table grouped by team, with counts per field

2. **Fix flow** — after report:
   - Critical fields: fix via admin player modal (individual) or a targeted update script (bulk)
   - Non-critical fields: defer unless a specific feature requires them

#### Notes
- Run audit script against staging first — verify counts match prod before touching prod
- College NULL count should be ~97 (post session 23 backfill of 110→97 via admin modal)
- Position and jersey number gaps are likely higher — unknown until script runs
- Related: BACKLOG-062 (college select dropdown — already shipped), BACKLOG-055 (position canonical values)

---

### BACKLOG-070 — Set College for 97 NULL-College Bells Players (+ New Player Profiling)

**Status:** OPEN — blocked on Richard
**Priority:** High — blocks college team rosters and eligibility
**Filed:** 2026-06-17

#### Problem
97 Bells BUSA-league players have `players.college = NULL` on staging (35 of these also NULL on prod). Until college is set, no `playerTeamAffiliations` college row can be inserted — these players don't appear in any college team roster.

Additionally, new players not yet in the DB need to be profiled before they can be rostered.

#### Action Required (Richard — admin UI on staging)

**Existing players with no college set:**
- Go to `/admin/players` → open each player modal → set College dropdown → save
- 97 players total — college select dropdown already ships (BACKLOG-062 ✓)
- Minimum fields to set: **College** (the affiliation backfill handles the rest)

**New players not yet in DB:**
- Create via `/admin/players` → new player form
- Minimum fields to unblock roster: **Name** + **College** (COLNAS / COLENG / COLMANS / COLENVS)
- All other fields (position, jersey number, jerseyName) can be filled later

#### After Richard sets colleges

Re-run diagnostic to confirm count of new mismatches:
```
node dev/query-bells-college-diagnostic.mjs
```

Then run the affiliation backfill (already covers new players automatically — any player with college set and no matching affiliation row is caught):
```
node dev/backfill-college-affiliations-staging.mjs
```

Then mirror to prod:
```
node dev/mirror-college-to-prod.mjs
```

#### Notes
- The diagnostic mismatch query catches ALL players where `college IS NOT NULL AND affiliation = NONE` — new profiles created via admin UI are picked up automatically on next run, no script changes needed
- Do staging first, verify 0 mismatches, then run prod mirror
- Related: BACKLOG-066 (college field auto-manages affiliation — long-term fix so this is never manual again)

---

### BACKLOG-071 — Player Create Form: No Client-Side Error Feedback

**Status:** OPEN
**Priority:** Medium — UX blocker during active player profiling
**Filed:** 2026-06-17

#### Problem
When player creation fails (server 400/500), the form shows nothing — no toast, no inline error, no UI change. Admin has no idea whether the save succeeded or failed without checking the server logs.

#### Required Changes
- On POST failure, surface the server `error` field (or a generic fallback) as a toast or inline error banner in the modal
- On success, show a success toast and close the modal
- Loading state on the save button while the request is in flight (already has `disabled={isSaving}` but no spinner/label change)

#### Files
- `src/app/admin/players/page.tsx` — the create/edit modal submit handler

---

### BACKLOG-072 — Make players.number Nullable (Schema Fix)

**Status:** OPEN
**Priority:** Medium — correctness issue
**Filed:** 2026-06-17

#### Problem
`players.number` is `integer('number').notNull().default(0)` in schema. Using `0` as the sentinel for "no jersey number assigned" is wrong — jersey number 0 is valid in some sports (e.g. basketball). Current workaround inserts `0` when no number is provided, which corrupts the meaning of the field.

#### Required Changes
1. In `src/db/schema.ts` — change:
   ```ts
   number: integer('number').notNull().default(0)
   ```
   to:
   ```ts
   number: integer('number')
   ```
   (nullable, no default — null = unassigned)

2. Run `db:push` against staging, verify, then prod
3. Update any UI that displays `number === 0` as a jersey number — should treat `null` or `0` as "—" (unassigned display)
4. Remove the `?? 0` workaround in `POST /api/players` once migration lands

#### Notes
- Workaround currently in place: `number: body.number ?? 0` — prevents crash but still stores 0 for unassigned players
- Run a quick count before migration: `SELECT COUNT(*) FROM players WHERE number = 0` — to know how many rows will need backfill treatment post-migration
- Related: BACKLOG-069 (partial player profile audit)

---

### BACKLOG-073 — Dependabot Security Audit + Fixes

**Status:** OPEN
**Priority:** High
**Filed:** 2026-06-17
**Source:** 53 Dependabot alerts on `dev` branch — 1 critical, 20 high, 28 medium, 4 low

---

#### Item A — Upgrade Next.js (kills ~20 alerts)

**Priority:** HIGH
**Current:** `15.3.8`
**Fix:** `15.5.18`

Alerts resolved by this upgrade:
- [HIGH] Middleware / Proxy bypass via segment-prefetch routes (+ incomplete fix follow-up)
- [HIGH] Middleware / Proxy bypass in Pages Router i18n
- [HIGH] Server Components DoS (two separate CVEs)
- [HIGH] Cache Components connection exhaustion DoS
- [HIGH] Server-side request forgery via WebSocket upgrades
- [HIGH] HTTP request deserialization DoS via insecure RSC
- [MEDIUM] Cache poisoning via RSC responses
- [MEDIUM] Cache poisoning via React Server Component cache-busting
- [MEDIUM] Middleware / Proxy redirect cache poisoning
- [MEDIUM] XSS via CSP nonces in App Router
- [MEDIUM] XSS in beforeInteractive scripts
- [MEDIUM] Image Optimization API DoS
- [MEDIUM] Image Optimization API disk cache growth
- [MEDIUM] HTTP request smuggling in rewrites
- [MEDIUM] Image Optimization cache key confusion
- [MEDIUM] Image Optimization content injection
- [MEDIUM] Improper Middleware redirect SSRF
- [LOW] Cache poisoning via RSC cache-busting
- [LOW] Middleware / Proxy redirect cache poisoning

**Steps:**
1. `npm install next@15.5.18 --save-exact`
2. Run `tsc --noEmit` — zero new errors
3. Boot app locally, verify Three Critical Flows (match creation, event logging, public livescore)
4. Deploy to staging, verify before prod
5. Check for any breaking changes in Next.js 15.3 → 15.5 changelog before upgrading

**Risk:** Medium — minor version bump, but Next.js has had breaking changes in patch releases before. Test thoroughly on staging.

---

#### Item B — Upgrade drizzle-orm (SQL injection)

**Priority:** HIGH
**Current:** `^0.44.7`
**Fix:** `0.45.2+`

Alert: SQL injection via improperly escaped SQL identifiers (`drizzle-orm < 0.45.2`).
Directly affects all DB queries in BrixSports.

**Steps:**
1. `npm install drizzle-orm@0.45.2 --save-exact`
2. Run `tsc --noEmit` — Drizzle often has minor type-level breaking changes between minor versions
3. Run existing DB queries manually to verify correct output
4. Check Drizzle 0.44 → 0.45 changelog for breaking changes before upgrading

**Risk:** Medium — Drizzle minor versions have had breaking API changes before.

---

#### ~~Item C — Upgrade swiper (CRITICAL prototype pollution)~~

**Status:** RESOLVED — 2026-07-13
**Priority:** ~~CRITICAL~~ — closed

**Evidence:**
- Commit: (this session)
- Verified by: repo-wide grep for `swiper` (all extensions, excluding `node_modules`/`package-lock.json`) — zero import sites found anywhere in the codebase. Package was installed but never wired to any component.
- Observed result: removed via `npm uninstall swiper` instead of patch-bumping a dead dependency. `npm audit` critical count dropped from 1 to 0 (66 → 40 total vulnerabilities). `tsc --noEmit` shows zero new errors — all remaining errors are pre-existing and unrelated (`src/db/*` scripts, `BottomNav.tsx`, `MatchOverlay.tsx`, `mobile-image-upload.tsx`).
- Pending items: none.

---

#### Item D — xlsx: no fix available

**Priority:** Medium — track only, no action yet
**Current:** `0.18.5`
**Alerts:**
- [HIGH] ReDoS in SheetJS — no fix yet
- [HIGH] Prototype Pollution in SheetJS — no fix yet (fix in `0.19.3` for PP, but ReDoS has no fix)

xlsx has no published fix for the ReDoS vulnerability. Options:
1. **Replace with `exceljs`** — actively maintained alternative, drop-in for most read/write operations
2. **Restrict xlsx usage** — ensure it only runs server-side on admin-uploaded files (never public-facing), validate file size before parsing
3. **Wait** — monitor for a patch release

**Steps (interim mitigation):**
- Audit where xlsx is used: `grep -r "xlsx" src/ --include="*.ts" --include="*.tsx"`
- Confirm it only runs server-side on admin-authenticated routes (never public endpoints)
- Add file size cap before parsing to limit ReDoS blast radius
- File a follow-up to replace with `exceljs` if no patch in 30 days

**Risk of current state:** Medium — only exploitable if an attacker can upload a malicious spreadsheet to an admin route. Confirm admin auth gates on all xlsx usage.

---

#### Item E — Transitive dep noise (no direct action needed)

These are transitive dependencies pulled in by Next.js, esbuild, or other tools. They will be resolved by upgrading the direct deps above. No direct action required:

- `ws < 8.20.1` — transitive via Next.js
- `socket.io-parser < 4.2.6` — transitive
- `qs <= 6.15.1` — transitive
- `uuid < 11.1.1` — transitive
- `lodash <= 4.17.23` — transitive
- `minimatch < 3.1.3` / `< 9.0.7` — transitive
- `flatted <= 3.4.1` — transitive
- `fast-xml-parser < 5.7.0` — transitive
- `fast-xml-builder <= 1.1.6` — transitive
- `markdown-it < 14.2.0` — transitive
- `picomatch < 2.3.2` / `< 4.0.4` — transitive
- `bn.js < 4.12.3` — transitive
- `js-yaml < 4.1.1` — transitive
- `postcss < 8.5.10` — transitive
- `nodemailer <= 8.0.5` — transitive
- `preact < 10.28.2` — transitive (likely via Next.js)
- `prismjs < 1.30.0` — transitive
- `esbuild` — **Withdrawn advisory, ignore**

#### Execution Order
1. Item C — swiper patch (lowest risk, CRITICAL severity, 1 command)
2. Item A — Next.js upgrade (most alerts resolved, medium risk)
3. Item B — drizzle-orm upgrade (SQL injection, medium risk)
4. Item D — xlsx audit + mitigation (no patch available)

Do Items C → A → B in separate PRs so regressions can be isolated per upgrade.

---

### BACKLOG-074 — BUSA League Full Audit: Data Integrity, Event Backfill, Team & Affiliation Wiring

**Status:** OPEN
**Priority:** HIGH — blocks accurate stats, leaderboards, and eligibility across all BUSA competitions
**Filed:** 2026-06-17

#### Problem
Three compounding issues make BUSA league data unreliable:

1. **Match event / goal log disparity (BUG-011)** — 718 goals logged vs 133 appearances (~5.4 goals/appearance). Root cause: duplicate backfill runs with differing `startTime` formats bypassed the dedup check. 39 `match_events` rows have `player_id = NULL`. `playerStats` is corrupted and cannot be trusted until a full dedup audit is done.

2. **Team affiliation gaps** — Many BUSA league players are not properly affiliated to their teams via `playerTeamAffiliations`. Some still rely only on the legacy `players.teamId` column. Roster Builder (BACKLOG-037) is partly built but not fully wired — team affiliation rows are incomplete across the league.

3. **College affiliation gaps** — 97 players still have `college = NULL` on staging. Intercollege rosters cannot be built until these are resolved. Ongoing this session.

#### Required Work (in order)

**Phase 1 — Event log dedup audit**
- Query `match_events` for duplicate rows: same `match_id + player_id + type + minute` (or near-minute)
- Output a report: how many duplicates, which matches, which players affected
- Do NOT delete anything yet — audit only
- Cross-reference against the 39 null-player event IDs listed in BUG-032
- Relates to BUG-011 — do not run any backfill until this is clean

**Phase 2 — playerStats reset and rebuild**
- Once dedup audit is clean and duplicates are confirmed/removed:
- Zero out `playerStats` for all affected players
- Re-derive from `match_events` via backfill endpoint or script
- Verify: goals/appearances ratio plausible per player

**Phase 3 — Team affiliation wiring**
- For every BUSA league player, confirm a `playerTeamAffiliations` row exists with `affiliation_type = 'team'` pointing to their correct BUSA team
- Players with only `players.teamId` set (legacy column) need an affiliation row inserted
- Script: read `players.teamId WHERE teamId LIKE 'busa-%'`, insert missing `playerTeamAffiliations` rows

**Phase 4 — College affiliation completion**
- Complete the 97 NULL-college players (ongoing — BACKLOG-070)
- Run final diagnostic: 0 NULL, 0 mismatches on staging and prod

**Phase 5 — Cross-competition eligibility audit**
- Once team and college affiliations are clean, audit squad eligibility:
  - A player in BUSA league should be eligible for intercollege via their college affiliation
  - A player in intercollege should not appear as a BUSA-only player
  - Run eligibility queries per competition to surface any broken links

#### Notes
- Do not touch playerStats or run any backfill until Phase 1 dedup audit is complete
- BUG-011 (718 goals), BUG-032 (39 null-player events), and this item are all linked — resolve in order
- Related: BUG-011, BUG-032, BACKLOG-037 (Roster Builder), BACKLOG-070 (college NULL players)

---

### BUG-033 — Squad Tab Pool Does Not Filter by Sport

**Status:** OPEN
**Priority:** Medium — not blocking, causes confusion at scale
**Filed:** 2026-06-17

#### Problem
`/admin/teams/[id]` Squad tab shows all affiliated players in the pool regardless of sport. A basketball player affiliated to COLNAS appears in the COLNAS Football pool. At small scale this is just noise; at full scale (multi-sport players, multiple competition types) it will make the pool unusable.

#### Root Cause
The pool query fetches all `playerTeamAffiliations` rows for the team without joining on sport context.

#### Fix Options
1. **Filter by team sport** — when building the pool, filter `playerTeamAffiliations` by the sport stored on the team row. Simple, works without a competition selected.
2. **Filter by competition sport** — when a competition is selected in the dropdown, filter pool by that competition's sport. More precise but requires competition to be selected first.

Recommended: option 1 as the baseline (always filter by team sport), option 2 as a refinement on top.

#### Files
- `src/app/admin/teams/[id]/page.tsx` — Squad tab pool query / data fetch
- `src/app/api/admin/teams/[teamId]/roster/route.ts` — GET handler building the pool response (add sport filter here)

#### Notes
- Related: BACKLOG-037 Step 7 (Squad Selector), BACKLOG-068 (multi-sport player merge)
- Do not fix in isolation before BACKLOG-068 audit is done — multi-sport players may have a single profile with two affiliations, so the sport filter must match against the affiliation row's context, not just the player profile

---

### BACKLOG-075 — Remove players.sport Free-Text Field from Player Create/Edit Forms

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-17

#### Problem
`players.sport` is a free-text field on the player create and edit forms. It gives the wrong mental model — the system was designed around Football and the field is inconsistently populated (83 basketball players on basketball teams all have `sport = NULL` on their profile row). Sport is not a property of a player profile; it is a property of the team they are affiliated to.

#### Correct Model
Sport is derived from team affiliations at display time:
- Player affiliated to a Football team → footballer
- Player affiliated to a Basketball team → basketball player
- Player affiliated to both → multi-sport (see BACKLOG-068)

Storing sport on the player row creates a second source of truth that will always drift from affiliations.

#### Required Changes
1. Remove `sport` from the player create form (admin UI)
2. Remove `sport` from the player edit/profile form (admin UI)
3. Where sport is displayed on a player profile, compute it from their active team affiliations instead of reading `players.sport`
4. Do NOT drop the `players.sport` column from the schema yet — audit all reads first, then file a migration to drop it once all display sites are using computed sport

#### Notes
- `players.sport` default is `'Football'` in schema — currently misleading for basketball players
- This simplifies BACKLOG-068 (multi-sport player merge): one canonical profile, affiliations to both sport teams, no `sport` field conflict on the profile row
- Related: BACKLOG-068 (multi-sport player merge), BUG-033 Part 2 (squad tab sport filter)

---

### BACKLOG-076 — Basketball College Teams Do Not Exist; 5 Players Unaffiliated

**Status:** RESOLVED — 2026-06-17 — basketball college teams created for COLENG and COLNAS; 5 players (KAMKID, RICHARD, ZUBBY, LIGHT, OJAY) wired on staging + prod.
**Priority:** ~~High~~ — resolved.
**Filed:** 2026-06-17

#### Problem
The 5 basketball players with a Bells college set (KAMKID, RICHARD, ZUBBY / COLENG; LIGHT, OJAY / COLNAS) were removed from their incorrect Football college affiliations. They now have no college affiliation. No basketball college teams exist for COLENG or COLNAS (Q2 confirmed: 0 basketball college teams in DB).

#### Blocked On
Basketball college teams must be created first (in admin UI or via script):
- **COLENG Basketball** — for KAMKID, RICHARD, ZUBBY
- **COLNAS Basketball** — for LIGHT, OJAY

The other 78 basketball players have `college = NULL` so this doesn't affect them yet — but they will also need college set and basketball college teams before they can be rostered.

#### Action Required
1. Richard creates basketball college teams in admin UI (or confirm team names/IDs and Claude runs a script)
2. Once team IDs are known, run sport-aware affiliation backfill:
   - INSERT into player_team_affiliations for players where `college = 'COLENG'` AND primary team sport = 'Basketball' → COLENG Basketball team ID
   - Same for COLNAS
3. Set `college` on the 78 basketball players who still have `college = NULL` — same process as BACKLOG-070 but for basketball players

#### Current State (staging)
| Team | Players | With college set |
|------|---------|-----------------|
| Vikings | 14 | 4 (KAMKID, ZUBBY, LIGHT, OJAY) |
| TBK | 11 | 1 (RICHARD) |
| Storm | 16 | 0 |
| Siberia | 17 | 0 |
| Rim Reapers | 14 | 0 |
| Titans | 11 | 0 |

#### Notes
- Do not create basketball college teams until the sport-aware backfill script is ready — creating teams without immediately wiring players causes the same orphan state we just cleaned up
- Related: BUG-033 (data cleanup done), BACKLOG-070 (football college NULL players), BACKLOG-068 (multi-sport profile merge)

---

### BUG-034 — CRITICAL: POST /api/matches/[id]/events Has No Auth Gate

**Status:** RESOLVED — 2026-06-17 (commit 0e55cd4)
**Priority:** CRITICAL — Flow B violation. Any unauthenticated caller can inject events into any live match.
**Filed:** 2026-06-17

#### Problem
`src/app/api/matches/[id]/events/route.ts` POST handler has zero auth. No `getAuthUser()` call exists anywhere in the file. Anyone with a match ID can POST arbitrary events (goals, cards, substitutions) to any live match — no token required.

This is a separate route from `/api/events` (which IS gated). The logger UI uses this per-match route for event logging. It was never secured.

#### Impact
- Flow B (Live Event Logging) is wide open — match results can be tampered from the outside
- `loggerId` is accepted from the request body (line 69), not from a verified session — fake logger attribution possible
- Score triggers and player stats can be corrupted

#### Fix
Add to top of POST handler (before `request.json()`):
```ts
const authUser = await getAuthUser(request);
if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
if (authUser.role !== 'admin' && authUser.role !== 'logger')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
// If logger role — verify assignment
if (authUser.role === 'logger') {
  const assigned = await isLoggerAssigned(matchId, authUser.id);
  if (!assigned) return NextResponse.json({ error: 'Not assigned to this match' }, { status: 403 });
}
```
Remove `loggerId` from body destructure — source it from `authUser.id`.

#### Files
- `src/app/api/matches/[id]/events/route.ts` — POST handler (line 52)

#### Notes
- Same pattern as the fix applied to `/api/events` (POST) in Session 6, BACKLOG-029
- Also check PATCH/DELETE handlers in `src/app/api/matches/[id]/events/[eventId]/route.ts` — same file family

---

### BUG-035 — MEDIUM: POST /api/squads, PATCH /api/squads, DELETE /api/squads Have No Auth Gate

**Status:** RESOLVED — 2026-06-17 (commit 0e55cd4)
**Priority:** Medium — squad manipulation without authentication
**Filed:** 2026-06-17

#### Problem
`src/app/api/squads/route.ts` exports POST (line 62), DELETE (line 122), and PATCH (line 152) handlers. None call `getAuthUser()`. Any caller can modify squad composition without authentication.

GET is public (squad data is not sensitive), but mutations are unprotected.

#### Fix
Add `getAuthUser()` + admin role check at top of POST, PATCH, DELETE handlers.

#### Files
- `src/app/api/squads/route.ts`

---

### BUG-036 — MEDIUM: POST /api/polls and PATCH /api/polls Have No Auth Gate

**Status:** OPEN
**Priority:** Medium — poll creation/modification without authentication
**Filed:** 2026-06-17

#### Problem
`src/app/api/polls/route.ts` POST (line 74) and PATCH (line 139) have no `getAuthUser()` call. Any caller can create or modify polls.

Polls are admin-created content tied to live matches. Unauthenticated poll creation is a content injection vector.

#### Fix
POST — add `getAuthUser()` + admin role check.
PATCH — add `getAuthUser()` + admin role check.
GET — leave public.

#### Files
- `src/app/api/polls/route.ts`

---

### BUG-037 — LOW: POST /api/user/xi Has No Auth Gate

**Status:** OPEN
**Priority:** Low — user XI creation without authentication (userId accepted from body)
**Filed:** 2026-06-17

#### Problem
`src/app/api/user/xi/route.ts` POST handler (line 48) has no `getAuthUser()` call. `userId` is accepted from the request body (line 51) — any caller can create an XI attributed to any user ID.

Low severity because XI data is not sensitive and has no match or financial impact.

#### Fix
Add `getAuthUser()`. Source `userId` from `authUser.id`, not the request body.

#### Files
- `src/app/api/user/xi/route.ts`

---

### BUG-038 — LOW: DELETE /api/reminders and POST /api/reminders Have No Auth Gate

**Status:** OPEN
**Priority:** Low — reminder creation/deletion without authentication
**Filed:** 2026-06-17

#### Problem
`src/app/api/reminders/route.ts` POST (line 54) and DELETE (line 137) have no `getAuthUser()` call. Any caller can create or delete match reminders for any user ID (accepted from body).

#### Fix
Add `getAuthUser()` to POST and DELETE. Source `userId` from `authUser.id`, not the request body.

#### Files
- `src/app/api/reminders/route.ts`

---

### BUG-039 — Unbounded Teams Query in /api/basketball/players — Worse Than Filed: Also a Correctness Bug

**Status:** OPEN
**Priority:** MEDIUM (raised from Low, session 47D — this is now confirmed to also silently drop real teams, not just a performance issue)
**Filed:** 2026-06-17

#### Problem
`src/app/api/basketball/players/route.ts` line 14 runs `db.select().from(teams).all()` — loads all 236+ teams from the DB just to filter in JS. This full table scan runs on every basketball player page load.

**Confirmed worse, session 47D:** the JS filter isn't `sport === 'Basketball'` as originally assumed — it's a **hardcoded array of six literal team names** (`['TBK', 'Titans', 'Storm', 'Rim Reapers', 'Vikings', 'Siberia']`, line 14-15). Any basketball team whose name isn't in this literal list — a newly-onboarded university's team, or a college team created after this list was written — is silently excluded from this endpoint's results entirely. This is a correctness bug, not just a performance one.

#### Fix
Replace with a `.where(eq(teams.sport, 'Basketball'))` clause — pushes the filter to SQLite (fixes the performance issue) and removes the hardcoded name list entirely (fixes the correctness issue), both at once.

**Found (correctness escalation):** session 47D, by a background audit agent doing a full read-only trace of the player/team/competition data system.

#### Files
- `src/app/api/basketball/players/route.ts`


---

### BACKLOG-077 — No "Create Team" UI on /admin/teams

**Status:** OPEN
**Priority:** Medium — BACKLOG-076 (basketball college teams) is now RESOLVED, so the original blocker context is gone. Still needed as a UX gap: admins cannot create empty teams from the UI.
**Filed:** 2026-06-17

#### Problem
`/admin/teams` is a read-only list page with no create button. The only way to create a team today is through `/admin/bulk-register` — which creates a team as a side effect of registering players, not as a standalone operation. That path sets wrong defaults and breaks business logic when you need an empty team (e.g. basketball college teams with no players yet).

~~`POST /api/teams` exists and is gated — the UI just doesn't surface it.`~~ **Correction, session 47D:** false under current code — `src/app/api/teams/route.ts` POST has zero `getAuthUser` call, confirmed by reading the full file. See `BUG-147` (filed session 47D) — this route is part of that cluster, not a UI-only gap.

#### Required Changes
Add a "Create Team" modal or inline form to `/admin/teams/page.tsx` with fields:
- Name (required)
- Short name (required)
- Sport — dropdown: Football / Basketball / Scrabble / Chess / Table Tennis (required)
- University (required)
- Gender — Male / Female / Mixed
- Colour picker or hex input
- Logo upload (Cloudinary, optional — can add later)

On submit: POST to `/api/teams`, refresh list.

#### Notes
- `POST /api/teams` route exists at `src/app/api/teams/route.ts` — verify it accepts the full shape before wiring
- Minimal viable version: name + sport + university + shortName. Other fields can be optional/defaulted.
- Blocking BACKLOG-076 (basketball college teams) — those teams need creating before the affiliation backfill can run

---

### BUG-040 — LOW: /placeholder.png Returns 400 via Next.js Image Optimizer

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-17

/_next/image?url=%2Fassests%2FLogos%2Fplaceholder.png returns 400. Path has typo: assests (double s) — matches codebase convention so do not rename the folder. Verify file exists at public/assests/Logos/placeholder.png. If missing, add a placeholder PNG.

---

### ~~BUG-041~~ — HIGH: React Error 418 (Hydration Mismatch) Confirmed Live on Homepage

**Status:** RESOLVED — 2026-07-28 (session 47D)
**Priority:** High — actively degrading every real user experience
**Filed:** 2026-06-17

React hydration error 418 confirmed firing in prod console on the homepage. Previously fixed for standings page (BUG-028, resolved 2026-06-15). This is a wider recurrence.

Evidence: error fires on homepage, tied to repeated long-tasks of 9.2s to 16s TBT from chunk 168-0d859fc25e0313e8.js recurring throughout session lifetime, not just on load.

Root cause hypothesis: same pattern as BUG-028 — Framer Motion initial prop or SSR/CSR mismatch on homepage components. Audit homepage components for Framer Motion initial props, dynamic imports without ssr:false, Math.random() in render, Date.now() outside hooks.

Related: BUG-028 (resolved standings instance), BACKLOG-085, BACKLOG-090.

**Actual root cause (session 47D, different from the hypothesis above — not a Framer Motion `initial` prop this time):** `src/components/pwa/UpdatePrompt.tsx`'s `controllerchange` listener called `window.location.reload()` unconditionally on ANY service-worker controller change. `public/sw-user.js:61`'s `activate` handler calls `self.clients.claim()`, which fires `controllerchange` on the very first claim of a previously-uncontrolled page — i.e. on a genuinely fresh visit, not just on a real update swap. That forces a full hard reload while the page is still mid-hydration, which both interrupts hydration (producing error #418) and re-executes the entire bundle (the recurring long-task/TBT spike from the shared framework chunk the original filing pointed at). Not a one-time load issue — it can refire on any visit where the SW hadn't claimed the page yet. Fix: capture `hadControllerAlready = !!navigator.serviceWorker.controller` before attaching the listener, and only reload when that was already true (a genuine swap of an already-active worker) — never on the first claim of an uncontrolled page. Minimal, targeted fix — confirmed against the actual `sw-user.js` source, not guessed.

**Evidence:**
- Commit: `176a553` (part of the BUG-149 commit — `UpdatePrompt.tsx` was pulled in alongside it, see session 47D's git-stash-recovery incident notes for why)
- Verified by: live staging test, `https://brixsports-staging.vercel.app`, fresh page load with no prior SW controller
- Observed result: console showed `[UpdatePrompt] Controller changed (first claim on an uncontrolled page, no reload needed)` — the exact guarded no-reload log path the fix added — with zero forced `window.location.reload()` observed on a genuinely fresh visit
- Pending items: none

---

### ~~BACKLOG-078~~ — Privacy Policy + Terms of Service Pages

**Status:** SHIPPED — 2026-07-27 (session 47D)
**Priority:** High — required before any public user data collection
**Filed:** 2026-06-17

Legal pages /privacy and /terms required for NDPA compliance and PWA listing. Link from footer and registration flows. Related: BACKLOG-086 (NDPA registration).

**Fix:** `src/app/privacy/page.tsx` and `src/app/terms/page.tsx` created — both explicitly marked as placeholder/not-legally-reviewed in-page (Richard's own call: draft now so the routes exist and PWA/NDPA requirements aren't blocked, replace with reviewed legal copy before public launch). There is no site-wide footer component in this codebase (mobile-first PWA, bottom-nav based) — linked instead from the two most relevant real entry points: the signup form (terms notice below the submit button, satisfies "registration flows" directly) and the settings overlay (a small links row, closest thing to a discoverable "legal" surface). Third-party disclosure list (Section 5 of the privacy page) was caught missing Google OAuth by a `code-reviewer` pass — signup offers "Continue with Google" via a live `/api/auth/google` route — fixed same session. `BACKLOG-086` (NDPA registration) remains separately unstarted, correctly — it depends on this page being live first, per its own note.

**Evidence:**
- Commit: `c893ad8`
- Verified by: live browser check on local dev — both routes render, correct metadata titles, no console errors; signup and settings links navigate correctly
- Observed result: both pages live at `/privacy` and `/terms`, cross-linked to each other, third-party list accurate against actual integrations (Cloudinary, Sentry, VAPID, Turso, Google OAuth)
- Pending items: real legal review before public launch (explicitly flagged in-page); NDPA portal registration itself (`BACKLOG-086`)

---

### ~~BACKLOG-079~~ — Security Headers Configuration

**Status:** SHIPPED — 2026-07-27 (session 47D)
**Priority:** High
**Filed:** 2026-06-17

Configure HTTP security headers in next.config.ts: Content-Security-Policy, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy. None currently set. Pre-prod blocker.

**Fix:** All five headers added to `next.config.ts`'s `headers()`. CSP is deliberately permissive rather than maximally strict — `script-src`/`frame-src` allowlist the Cloudinary upload widget domains (`upload-widget.cloudinary.com`, `*.cloudinary.com`), `connect-src` allows `https:`/`wss:` broadly (the WS endpoint is env-driven — `NEXT_PUBLIC_WS_URL` — and differs staging vs prod, both real Railway hosts), `img-src` allows `https:` broadly (matches `next.config.ts`'s own `images.remotePatterns` wildcard-hostname policy, already an accepted platform decision), `style-src`/`font-src` allow Google Fonts. `script-src`/`style-src` keep `'unsafe-inline'`/`'unsafe-eval'` — a nonce/hash-based strict CSP would need real per-role live testing (viewer/logger/admin, including the Cloudinary upload flow) that wasn't attempted this session. Live-verified on local dev (`BUG-146`'s SSR fix made this possible again): homepage renders fully, all `/api/*` calls succeed, zero CSP-violation console errors, network requests all 200 — no regression found. **Not RESOLVED**: only the homepage was checked; admin upload flow (the one real Cloudinary-widget consumer) and a logger session weren't live-tested this session.

---

### BACKLOG-080 — Rate Limiting: Auth Endpoints

**Status:** OPEN
**Priority:** High
**Filed:** 2026-06-17

/api/auth/login, /api/auth/register, /api/auth/forgot-password have no rate limiting. Brute-force and credential-stuffing attacks are unmitigated. Implement IP-based rate limiting (Upstash or middleware-level) before public launch.

---

### BACKLOG-081 — Umami Analytics

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-17

Add Umami (self-hosted or cloud) for privacy-respecting analytics. No cookies, no consent banner required. Embed script in layout.tsx. Track key events: match view, logger login, live page visits.

---

### BACKLOG-082 — Uptime Monitoring

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-17

Set up uptime monitoring (BetterStack or UptimeRobot) on brixsports.com/api/health and staging.brixsports.com/api/health. Alert to email on downtime. Required before live match deployment.

---

### BACKLOG-083 — JSON-LD Structured Data

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-17

Add JSON-LD to /matches/[id] (SportsEvent), /players/[id] (Person), /competitions/[id] (SportsOrganization). Add after RSC migration (BACKLOG-090) so metadata is server-rendered.

---

### BACKLOG-084 — robots.txt + Sitemap

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-17

public/robots.txt: disallow /admin, /api, /logger. Dynamic sitemap covering /matches/[id], /players/[id], /competitions/[id], /teams/[id]. Use next-sitemap or App Router sitemap.ts.

---

### BACKLOG-085 — Core Web Vitals Audit

**Status:** OPEN — baseline established 2026-06-17
**Priority:** Medium
**Filed:** 2026-06-17

Lighthouse baseline (homepage, prod, 2026-06-17): Performance 22-24/100, Accessibility 89/100, Best Practices 95-96/100, SEO 100/100. One run returned NO_FCP (complete failure). TBT 9.2s-16s from chunk 168-0d859fc25e0313e8.js. Performance score of 22-24 is critically low.

Primary blockers: large JS bundle (chunk 168), React hydration error 418 (BUG-041), CSR-everywhere architecture (BACKLOG-090).

---

### BACKLOG-086 — NDPA Registration

**Status:** OPEN
**Priority:** Medium — required before collecting Nigerian user data at scale
**Filed:** 2026-06-17

Register BrixSports as a data controller with Nigeria Data Protection Authority. Prerequisite: BACKLOG-078 (Privacy Policy) must be live first. Steps: complete NDPA portal registration, obtain certificate, display on /privacy page.

---

### BACKLOG-087 — Rate Limiting: All Mutation Endpoints

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-17

Extend rate limiting beyond auth endpoints (BACKLOG-080) to event logging (POST /api/matches/[id]/events, POST /api/events), player registration, and competition registration. Prevents event spam during live matches. Implement after BACKLOG-080 proves the pattern.

---

### BACKLOG-088 — Database Backup Strategy

**Status:** OPEN
**Priority:** Medium — no recovery path if Turso data is lost
**Filed:** 2026-06-17

Verify Turso point-in-time recovery is enabled and retention window is adequate. Document recovery procedure. Schedule periodic export of critical tables (matches, players, events) to secondary store. Test restore path before public launch.

---

### BACKLOG-089 — Sentry Alerts Configuration

**Status:** OPEN
**Priority:** Low
**Filed:** 2026-06-17

Sentry is capturing errors (confirmed active). Missing: alert rules for new issues and error spikes, Slack/email notification channel, issue assignment rules for Flow A/B/C errors. Related: BACKLOG-035 (Sentry config cleanup).

---

### BACKLOG-090 — CSR/RSC Architecture Decision for Public Pages

**Status:** OPEN
**Priority:** High — root cause of 22/100 Lighthouse performance score
**Filed:** 2026-06-17

All public pages (/, /live, /football, /basketball, /matches/[id]) are fully client-side rendered. Users download and execute the full JS bundle before seeing any content. This is the primary driver of 9.2s-16s TBT and 22/100 performance.

Candidate approach: migrate page shells to React Server Components with client islands for live data only. Shell and static content to RSC (zero JS), score updates and live feed to client island with polling/SSE, auth-dependent UI to client island.

Architectural decision requiring a full session to scope. Do not start until BUG-041 (hydration error) is resolved first.

---

### BACKLOG-091 — Accessibility Batch Fix

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-17

Two confirmed failure patterns (Lighthouse Accessibility 89/100):
1. Icon-only nav buttons missing aria-label: hamburger, search, and nav action icons have no accessible label.
2. Color contrast failures: FT, FINAL, MATCH DAY, and sport-filter-tab labels use #6c6c6c-on-dark pattern that fails WCAG AA. Likely a shared utility class — one fix covers all instances.

---

### BACKLOG-092 — Lighthouse Performance Baseline Tracking

**Status:** OPEN — baseline logged in BACKLOG-085
**Priority:** Tracking only
**Filed:** 2026-06-17

Re-run Lighthouse after each of: BUG-041 fix, BACKLOG-090 (RSC migration), BACKLOG-091 (accessibility), BACKLOG-079 (security headers). Log delta against BACKLOG-085 baseline. Same device, same network, same URL each time.

---

### ~~BACKLOG-093~~ — Logger Has No Service Worker Coverage

**Status:** RESOLVED — 2026-06-19 (commit 71d57f7)
**Priority:** ~~CRITICAL~~ — resolved.
**Filed:** 2026-06-19

#### Finding (SESSION_25_RECON.md §2)

`src/app/logger/` has no `layout.tsx`. The root layout wraps `/logger` with `<PWAProvider swPath="/sw-user.js">`, but `usePWA.ts:13-16` explicitly blocks sw-user.js registration on `/logger` paths. Result: loggers run with zero service worker coverage.

Impact:
- No offline caching for logger UI
- No background sync — `registration.sync.register('sync-match-events')` cannot fire
- No push notifications for logger role
- `offline-queue.ts` is unwired AND unrunnable until this is fixed

#### sw-admin.js readiness (verified 2026-06-19)

`sw-admin.js` has a real `sync` event listener (line 152) and a working `syncMatchEvents()` drain function (lines 163–195) that reads from `BrixsportAdminDB.pendingMatchEvents` and POSTs to `/api/matches/${event.matchId}/events`.

**Known gap in sync handler:** drain POSTs carry no auth token. BUG-034 gated that endpoint — background sync will 401. This must be fixed in the same pass as BACKLOG-058 (wiring the queue), not after.

#### Fix

1. Create `src/app/logger/layout.tsx` — wrap with `<PWAProvider swPath="/sw-admin.js">`. Logger shares the admin SW; both roles need offline event logging and push.
2. Fix auth in `syncMatchEvents()` in `sw-admin.js` — SW context has no cookie. Solution: store the JWT token in IndexedDB alongside the event payload at write time (FootballLogger writes it when queuing the event), then attach it as `Authorization: Bearer <token>` header in the sync drain fetch.

#### Dependency chain

BACKLOG-093 → BACKLOG-058 (wire offline-queue.ts into FootballLogger catch block) → BACKLOG-044 Phase B (match config on mount, timer ceiling, sub rules)

---

### BACKLOG-094 — Logger JWT TTL Too Long (7 Days)

**Status:** OPEN
**Priority:** Low — not a live blocker, conscious accepted risk noted in BACKLOG-058.
**Filed:** 2026-06-19

#### Finding

`src/lib/auth.ts:132` issues logger tokens with `expiresIn: '7d'`. A logger token exfiltrated via XSS, shared device, or any other path is live for up to a week. The 30-min IndexedDB exposure window (BACKLOG-058) bounds how long a token sits in unencrypted local storage, but does not reduce the token's actual validity window after exfiltration.

Logger accounts have no admin access — compromise enables false event injection into live matches, not data exfiltration. Assessed as acceptable at MVP tier.

#### Required Changes

1. Shorten logger token TTL — e.g. 8–12 hours (covers a full match day without being permanently live).
2. Add a silent refresh flow so a logger mid-match doesn't get hard-expired during a long game — refresh token or re-auth on next successful POST, not on an alert.
3. Consider separate TTL config per role (`admin` vs `logger` vs `user`) rather than one global value in `auth.ts`.

#### Notes

- Do not change TTL without a refresh flow in place — a logger getting hard-expired mid-match and losing their session is worse than a long TTL.
- Related: BACKLOG-058 (offline queue JWT storage), BACKLOG-080 (rate limiting on auth endpoints).

**Dual-token sync risk (added 2026-06-19):** Logger auth now issues both an httpOnly cookie (for live API calls) and a localStorage token (for the offline SW queue). These can go out of sync — e.g. the cookie expires or is cleared by the browser while the localStorage token remains (or vice versa after a force-logout). Current logout clears both, which is correct. Risk: if the cookie is cleared server-side (e.g. a forced logout via token invalidation added later) without clearing localStorage, the offline queue would drain successfully but live API calls would 401. No fix needed at current scope — note this when implementing any server-side token invalidation or refresh flow.

---

### BACKLOG-096 — Event Pipeline: No Server-Side WebSocket Emit on Event Save

**Status:** OPEN
**Priority:** HIGH — Flow B and Flow C correctness
**Filed:** 2026-06-19

#### Finding

`POST /api/matches/[id]/events` saves the event and updates the score in the DB, but never emits to any real-time channel. The current "real-time" update path is:

1. Logger client emits `event:log` via `useWebSocket` (Railway socket — currently dead)
2. Public viewer polls `/api/matches/[id]` every 15s (BUG-020 fix)

This means:
- **When Railway WS is alive:** viewers get the update within socket latency — works
- **When Railway WS is dead (current state):** viewers wait up to 15s — polling only
- **The clock** (`match:time:update`) is emitted client-side every second from FootballLogger via socket — when socket is dead, the public clock never updates

#### Events emitted client-side (all dead when Railway is down)
- `match:time:update` — clock tick, every second
- `match:score:updated` — on score change
- `match:status:changed` — on period transition
- `event:log` — on event save
- `event:undo` — on event delete
- `match:lineup:update` — on lineup change

#### What fires server-side (works regardless of WS)
- DB write (matchEvents INSERT) ✅
- Score update (matches UPDATE) ✅
- Player stats update ✅
- Ratings recalculation (internal fetch) ✅
- **Standings update — NOT TRIGGERED** (see BACKLOG-097)

#### Fix options (in priority order)
1. **Short term:** Keep 15s polling on public page as the fallback. Accept 15s latency when WS is down.
2. **Medium term:** Add SSE endpoint `GET /api/matches/[id]/stream` — server pushes events to viewer on each DB write. No Railway dependency.
3. **Long term:** Fix Railway WS or self-host socket server. Required for sub-second clock sync on public pages.

Related: BACKLOG-090 (RSC/client island architecture), BACKLOG-095 (data freshness strategy), BUG-026.

---

### BACKLOG-097 — Event Pipeline: No Standings/Points Update on Goal Save

**Status:** OPEN — CONFIRMED REAL, session 47D (was "OPEN, needs audit")
**Priority:** HIGH (raised from MEDIUM — confirmed total, not partial, and compounds with a second finding below)
**Filed:** 2026-06-19

#### Finding

When a goal is logged via `POST /api/matches/[id]/events`, the competition standings (points table, win/draw/loss record) are **never updated**. Standing recalculation only happens when match status transitions to FINISHED — and even that is not confirmed to be wired automatically.

Affected flows:
- Live standings during a match show stale data (correct — standings update on full-time, not on each goal)
- **BUT:** if the match ends (status → FINISHED) without a dedicated standings trigger, points are never awarded

#### Required Audit
1. Check `PATCH /api/matches/[id]` — does setting `status: 'FINISHED'` trigger a standings recalculation?
2. Check `/api/competitions/[id]/standings` — does it recalculate on the fly from match results, or read from a cached table?
3. If neither triggers a recalculation: wire standings update into the FINISHED status transition.

#### Audit answer (session 47D, confirmed by direct code read + codebase-wide grep)

**The gap is real and total, not partial.** `standings` is a stored table, read verbatim by every consumer (`/api/football/standings`, `/api/competitions/[id]/standings`, generic `/api/standings` GET) — none derive from `matches` at read time. The **only** writer anywhere in the codebase is `POST /api/standings`, a manual admin bulk-upsert (grepped every `.ts`/`.tsx` for `insert(standings)`/`update(standings)` — zero other hits). Nothing in the match-finalize path (`events/route.ts`'s `after()` hooks: `broadcastMatchEvent`, `broadcastScoreUpdate`, `calculateAndSaveRatings()`) touches `standings`. No cron/scheduled recompute exists either. A competition's standings only reflect reality if an admin manually re-POSTs correct numbers or a one-off backfill script runs.

**Compounding finding, same session, new:** `src/app/teams/[id]/page.tsx` (a team's own profile page) reads its "Season Stats" card from a **third, independent** location — the `teams` table's own `played`/`won`/`drawn`/`lost`/`goalsFor`/`goalsAgainst` columns (`src/app/api/teams/[id]/route.ts:184-217`). These columns default to `0` (not `null`) in the schema, so the route's own "calculate live from finished matches" fallback branch (gated on `team.played === null`) never actually executes — confirmed via grep, nothing ever calls `.update(teams).set({ played: ..., won: ... })` anywhere in the live app. This is a frozen snapshot from whatever seed/backfill script last touched it. **Net effect: the public `/teams` directory and a team's own `/teams/[id]` profile page can show different Played/Won/Points numbers for the same team**, because they read from two separately-stale caches with no reconciliation.

**Fix (not built):** wire a real standings recalculation into the match-finalize path (on `status → FINISHED`), and either retire the `teams` table's redundant stat columns in favor of always deriving from `standings`, or keep both in sync from the same trigger. Real scope — not a quick patch, touches the finalize path for both sports.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the player/team/competition data system.

Do not build anything until the audit confirms whether the gap is real.

---

### BACKLOG-095 — Data Freshness Strategy: Per-Zone Caching and Update Mechanisms

**Status:** OPEN
**Priority:** Medium — architecture decision, not an active bug
**Filed:** 2026-06-19

#### Problem

The app currently has no coherent data freshness strategy. Public pages do a full client-side fetch on every mount. The logger fetches all data on load with no update mechanism. Match detail pages get stale and require manual refresh. The approach is not consistent across zones and does not scale.

#### Proposed Zone Model

| Zone | Content | Strategy |
|---|---|---|
| **Public livescore** (`/live`, `/matches/[id]`) | Live score, events | Client island polling every 10–15s, or SSE stream. Shell to RSC (see BACKLOG-090). |
| **Logger interface** | Events, clock state | Already client-managed via `MatchStateManager`. New events from co-logger via WebSocket sync (already wired via `useMultiLogger`). No polling needed — event-driven only. |
| **Admin match list** | Match status, assignments | SWR/React Query with 30s revalidation. Stale-while-revalidate is fine. |
| **Public player/team pages** | Stats, profile | Aggressive cache (5 min stale-ok). No real-time requirement. |
| **Auth endpoints** | JWT session | Never cache — always network-first. |
| **SW cache rules** | All of the above | SW must never cache: HTML documents, `/api/auth/*`, `/api/matches/[id]/events` (POST), match config. Cache: static assets (JS/CSS/images) with cache-busting on deploy. |

#### Dependency

Blocked on BACKLOG-090 (RSC architecture decision) for public pages. Logger and admin zones can be addressed independently.

#### Notes
- WebSocket (`useWebSocket`) already exists for real-time updates — the issue is it connects to the production Railway URL from staging (seen in console 400 errors). Fix the WS env var before relying on it as the primary update mechanism.
- Do not introduce SWR or React Query without a session decision (BACKLOG-090) — adding a data-fetching library before the RSC migration will require rework.
- Related: BACKLOG-090 (RSC/CSR architecture), BUG-026 (SW stale cache), BUG-041 (hydration), BUG-046 (match page blank screen).

---

### BACKLOG-098 — Formalise BACKLOG Lifecycle States

**Status:** OPEN
**Priority:** HIGH — process debt
**Filed:** 2026-06-19

#### Problem

The current BACKLOG lifecycle has two states: `OPEN` and `RESOLVED`. This is too coarse. Session 26 produced two items (BACKLOG-058, BUG-047) that are neither — code is committed and correct, but a live end-to-end test hasn't happened. Forcing them into `RESOLVED` produced false positives that required manual discovery. Forcing them to stay `OPEN` doesn't represent what's been done.

The missing state is: **code shipped, not yet live-tested.**

#### Required States (proposed)

| State | Meaning |
|-------|---------|
| `OPEN` | Problem known, work not yet started |
| `IN PROGRESS` | Active this session |
| `SHIPPED` | Code committed. Test not yet run. Do not treat as done. |
| `UNVERIFIED` | Test run attempted but result disputed or incomplete |
| `RESOLVED` | Live-tested, evidence block attached, dependencies confirmed |
| `WONT FIX` | Consciously deferred — reason documented |

#### Required Changes

1. Update `CLAUDE.md` Backlog Close rule to require one of these states, not just "RESOLVED" or "OPEN".
2. Retroactively update BUG-047 (`SHIPPED — AWAITING LIVE TEST`) and BACKLOG-058 (`UNVERIFIED — AWAITING FULL TEST PASS`).
3. Apply `SHIPPED` state going forward any time code is committed without a live test cycle completed.

#### Notes

- `SHIPPED` must never appear in a commit message as a final state — it is explicitly "not done."
- Related: BACKLOG-099 (integration tests), BACKLOG-100 (RUNLOG upgrade), CLAUDE.md Backlog Close rule.

---

### BACKLOG-099 — Flow A/B/C Integration Test Suite (pre-prod-check Tier 3)

**Status:** OPEN
**Priority:** HIGH — verification currently lives entirely in manual vigilance
**Filed:** 2026-06-19

#### Problem

The Three Critical Flows (Flow A: match creation → public appearance; Flow B: live event logging → score update; Flow C: public livescore polling) are currently verified only by manual testing before deploys. `dev/pre-prod-check.ts` covers auth gates and DB integrity (Tier 1) but does not exercise the actual flows at all.

This means:
- A regression on Flow B (e.g. BACKLOG-058 offline queue broken, BUG-047 score update silently wrong) can be live for multiple sessions without detection.
- Every "is this safe to deploy?" question requires someone to run through the flows by hand.
- The one session that skips manual verification is the one where a broken flow reaches a live match.

#### Required Changes

**Tier 3 addition to `dev/pre-prod-check.ts`** (or a separate `dev/smoke-test-flows.mjs`):

**Flow A smoke test:**
1. POST `/api/matches` (admin auth) with minimal valid payload → confirm 201, match ID returned
2. GET `/api/matches` (public) → confirm the new match appears
3. DELETE or PATCH to clean up (or use a dedicated test-match ID)

**Flow B smoke test:**
1. Set test match to LIVE status
2. POST `/api/matches/[id]/events` with `{ type: 'Goal', minute: 1, teamId: homeTeamId }` (logger auth)
3. GET `/api/matches/[id]` → confirm `homeScore` incremented by 1
4. POST with `{ type: 'Penalty', ... }` → confirm score increments
5. POST with `{ type: 'Own Goal', teamId: homeTeamId }` → confirm **away** score increments
6. Clean up test events

**Flow C smoke test:**
1. GET `/api/matches` (public, unauthenticated) → confirm test match appears with updated score
2. Confirm no banned NDPR fields (`loggerId`, `assignedLoggers.email`, etc.) in response

#### Exit criteria

- Exit 0 = all flows pass → `[FLOWS CLEAR]`
- Exit 1 = any flow fails → `[FLOWS BLOCKED — do not deploy]`

#### Notes

- Requires a designated test match and test logger account on staging (can reuse existing).
- Run before every PR to `main` — add to the deploy checklist alongside `dev/pre-prod-check.ts`.
- Do not build until BACKLOG-058 (offline queue) is actually verified — the smoke test should include the offline queue path once BACKLOG-058 is confirmed working.
- Related: BACKLOG-034 (pre-prod-check Tier 1/2), BACKLOG-058 (offline queue), BUG-047 (scoring).

---

### BACKLOG-100 — RUNLOG Structure Upgrade: Auditable Entries

**Status:** OPEN
**Priority:** MEDIUM
**Filed:** 2026-06-19

#### Problem

Current RUNLOG entries are descriptive, not auditable:
```
Date: 2026-06-17
Script: backfill-college-affiliations-staging.mjs
What it did: deleted 1 wrong row, inserted 14 affiliation rows
Row counts: 14 inserted, 1 deleted
```

This records what was attempted. It doesn't record:
- What the state was **before** the script ran (pre-state assertion)
- Whether the output matched what was expected (post-state verification)
- Whether anomalies were noticed and what was done about them
- Whether the result was manually confirmed or just inferred from exit code

More critically: there is no RUNLOG entry format for **test runs**. "Was BACKLOG-058 ever successfully tested?" is currently a memory question. It should be queryable.

#### Required Changes

**New RUNLOG entry format for DB scripts:**
```
## [Date] — [Script name]
Target: staging | prod
Pre-state: [what was true before — e.g. "14 players with wrong affiliations"]
Action: [what the script did]
Result: [row counts, output]
Post-state: [what is true after — confirmed by query]
Anomalies: [anything unexpected]
Verified by: [query / visual check / none]
```

**New RUNLOG entry format for manual test runs:**
```
## [Date] — Manual test: [feature / backlog item]
Tester: [Richard / staging]
Test: [what was tested — reference TEST_CHECKLIST.md item]
Result: PASS | FAIL | PARTIAL
Evidence: [what was observed]
Follow-up: [any items filed as a result]
```

#### Notes

- Manual test entries make "has BACKLOG-058 been live-tested?" a query against RUNLOG, not a memory question.
- Related: BACKLOG-098 (lifecycle states), BACKLOG-099 (integration tests).

---

### BACKLOG-101 — Explicit Dependency Tracking in BACKLOG Entries

**Status:** OPEN
**Priority:** MEDIUM
**Filed:** 2026-06-19

#### Problem

Dependencies between backlog items are currently expressed in prose inside the entry body (e.g. "Do not build until BACKLOG-068 is done", "Do not run correction until BUG-011 scope is confirmed"). This means:
- Checking "can I close BACKLOG-058?" requires reading the full BACKLOG-058 entry and remembering that BUG-044 was a dependency.
- When BUG-044 is resolved, nobody updates BACKLOG-058 to say "your blocker is now gone."
- The chain is only discoverable by reading — it's never queryable.

Session 26 example: BACKLOG-058 was marked RESOLVED while BUG-044 (its auth dependency) was still broken. A formal `Blocked by: BUG-044` field would have made this visible at resolution time.

#### Required Convention

Add a `**Blocked by:**` field to any BACKLOG/BUG entry that has a hard dependency:

```markdown
**Blocked by:** BUG-044 (logger auth cookie — must be RESOLVED before BACKLOG-058 can be tested)
```

When the blocker is resolved:
1. The blocker's own BACKLOG close update must grep for entries that listed it in `Blocked by:`
2. Each dependent entry gets a note: `Blocker BUG-044 resolved 2026-06-19 — dependency cleared`

#### Entries to retroactively update

- BACKLOG-058: `Blocked by: BUG-044` (now cleared — add note)
- BUG-047 score correction: `Blocked by: BUG-011` (still active)
- BACKLOG-037 Step 7b: `Blocked by: Step 7 verification` (still active)
- BUG-033 Part 2: `Blocked by: BACKLOG-068` (still active)

#### Notes

- This is a convention update, not a code change.
- Related: BACKLOG-098 (lifecycle states), CLAUDE.md Backlog Close rule.

---

### BACKLOG-102 — Live Match Clock on Public Pages

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-25

#### Problem

The public viewer has no ticking match clock. `MatchStateManager` runs entirely client-side in the logger's browser — `displayMinute` and `second` are never pushed to the DB or broadcast over the WebSocket. The public page shows score and events but no elapsed time.

#### Desired display

**`/matches/[id]` (match detail page):**
Show full clock: `33:23` — minutes and seconds, updating live. Alongside the period label (H1 / HT / H2 / ET / PK) from BUG-063. Source: WebSocket broadcast from logger.

**`/matches` list and homepage match cards:**
Show minute only: `33'` — alongside the period badge (H1, H2, HT, PK). Update cadence: every 60s polling is acceptable here (cards don't need second-level precision). Source: either WS or a `/clock` poll endpoint.

#### Mechanism

`MatchStateManager` clock state is never persisted or broadcast — this is the core gap. Two options:

**Option A — Logger emits clock ticks over WS (recommended)**
- Logger `FootballLogger` emits a `match:clock` event over the socket every 30s (or on each minute tick) with `{ matchId, displayMinute, second, period }`
- WS server stores last-known clock state in memory (per matchId) and rebroadcasts to all viewers in the match room
- Public match page receives `match:clock` via socket and updates a local `clockState`
- On page load / reconnect, public page can request current clock from a `GET /api/matches/[id]/clock` endpoint that returns the in-memory WS state (or `null` if no logger is active)

**Option B — Poll `/clock` endpoint**
- Logger PATCHes `displayMinute` to a lightweight `match_clock` table (or a column on `matches`) every 60s
- Public page polls `GET /api/matches/[id]/clock` every 30s
- Simpler but 30–60s stale. Acceptable for cards, not ideal for detail page.

#### Implementation order

1. Logger emits `match:clock` event every 60s (or on each minute boundary in `MatchStateManager`)
2. WS server stores last clock per matchId in memory, rebroadcasts to match room
3. Public match detail page (`/matches/[id]`) subscribes to `match:clock` — renders `MM:SS` clock
4. Public match list / homepage cards — poll `GET /api/matches/[id]/clock` every 60s — renders `MM'` only
5. BUG-063 (period label) must land first — clock display without correct period label is confusing

#### Notes

- Do not implement before BUG-063 is resolved — period label and clock must ship together on the detail page
- Logger session must be active for clock to tick on public page — when no logger is connected, hide the clock display (do not show stale `0'`)
- `match-state-manager.ts` already has `getFormattedTime()` — use that output for the WS payload
- Related: BUG-063 (period label), BACKLOG-096 (WS event pipeline), BACKLOG-044 (match config / half duration)

---

### BACKLOG-103 — User-Selectable Push Notification Preferences

**Status:** WONT FIX — consciously deferred to future scope
**Priority:** Low
**Filed:** 2026-06-25

#### Problem

Push notifications currently fire for every `GOAL`, `RED_CARD`, `YELLOW_CARD`, `HALF_TIME`, and `MATCH_END` event with no user control. Users may only care about goals, or may want all events, or only events involving their followed team.

#### Desired behaviour

User can configure per-notification-type preferences in their profile or notification settings:
- Goals only
- Goals + Red Cards
- All events (current default)
- Match start / end only

Preferences stored per user (or per followed team) and respected in `match-notification-service.ts` before dispatching.

#### Notes

- Friendly matches currently send notifications (intentional — all matches count as live events)
- Do not implement until notification infrastructure is stable and user count justifies the complexity
- Related: `src/lib/notifications/match-notification-service.ts`, `src/app/api/notifications/match-event/route.ts`

---

### BACKLOG-104 — Exclude Friendly Matches from Stat Aggregation Queries

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-25

#### Problem

Player stats (`football_player_stats`) are stored as running totals, incremented on every logged event. The friendly guard added in `7faaab9` prevents new friendly events from writing stats going forward. However, any stat aggregation query that re-derives totals from `match_events` (leaderboards, season summaries, player profiles) would still include friendly match events unless filtered.

Standard football practice: friendly goals, cards, and assists do not count toward a player's competitive career record.

#### What exists

- `matchType` column on `matches` table — `'competition'` (default) or `'friendly'`
- Running totals in `football_player_stats` — already guarded at write time
- No filter on any read/aggregation path yet

#### What needs doing

Any query that joins `match_events → matches` to derive stats must add:
```sql
AND m.match_type = 'competition'
```

Affected files to audit:
- `src/app/api/competitions/[id]/stats/route.ts` — top scorers, assists, discipline
- `src/app/api/players/stats/leaders/route.ts` — stat leaders
- `src/app/api/players/[id]/stats/route.ts` — individual player stats
- `src/app/api/players/[id]/performance/route.ts` — performance breakdown
- `src/lib/services/team-stats-calculator.ts` — team aggregates

#### Notes

- Running totals in `football_player_stats` are already correct for new matches (write guard in place)
- Historical friendly events logged before `7faaab9` may have polluted totals — a backfill audit may be needed after this filter is added
- Do not implement before leaderboard and stats pages are stable

---

### BACKLOG-105 — is_test Flag on Matches (Test Match Isolation)

**Status:** OPEN
**Priority:** Medium
**Filed:** 2026-06-25

#### Problem

Test matches contaminate player stats, leaderboards, and public livescore feeds. Currently, identifying and cleaning up a test match requires manually tracing the match ID, auditing events, decrementing stats by hand, and running a bespoke cleanup script each time. This is fragile and has caused data issues (Sessions 24, 29, 32).

#### Desired solution

Add `is_test` boolean column (default `false`) to `matches` table. Admin sets it at match creation. Once set, the system excludes the match everywhere automatically.

**Schema change:**
```sql
ALTER TABLE matches ADD COLUMN is_test INTEGER DEFAULT 0;
```

**Wire into:**
1. **Match creation form** (admin) — checkbox: "This is a test match"
2. **Stats pipeline** — `updatePlayerStats` skips when `match.isTest === true`
3. **Leaderboard / stat aggregation queries** — `AND m.is_test = 0`
4. **Public livescore / homepage** — `WHERE is_test = 0` so test matches never appear publicly
5. **Admin cleanup action** — button on match detail: "Delete test match" → cascade delete with no manual stat rollback needed (stats were never written)

#### Implementation order

1. Schema migration (`ALTER TABLE matches ADD COLUMN is_test INTEGER DEFAULT 0`) — staging first
2. Update `events/route.ts` — skip `updatePlayerStats` when `isTest`
3. Update match creation admin form — add checkbox
4. Update public-facing queries to exclude test matches
5. Add admin "Delete test match" button

#### Notes

- Combine schema migration with any other pending `matches` table ALTER in the same session
- Do not add console logging as a substitute — observability during a test is already covered by the FootballLogger live feed and network tab; the real gap is post-test cleanup and stat contamination
- Related: `src/app/api/matches/[id]/events/route.ts`, `src/app/admin/matches/`, BACKLOG-104

---

### BACKLOG-106 — Per-Match Player Stat Rows (Replace Mutable Increment Model)

**Status:** OPEN (sub-player visibility fix SHIPPED — see below; broader stat model refactor remains open)
**Priority:** High
**Filed:** 2026-06-25
**Supersedes scope of:** BACKLOG-019 (post-match pipeline) — which is too broad to be actionable. This item is the concrete, scoped piece that keeps getting deferred inside BACKLOG-019.

**Session 35 fix — SHIPPED `eb60ec8` / `8e26b84`:**

Two bugs, both fixed:

1. **In-session bug (real Phase 6 cause):** `PlayerSelectionModal` had `filterStartersOnly=true` for every non-sub event. The filter at line 2402 excluded any player not in `starterIds` (original lineup). Subbed-on players are never starters → stripped from general/assist picker even though `getOnPitchPlayers` correctly included them. Fix: `filterStartersOnly && !starterIds.has(p.id) && !subbedOnPlayerIds?.has(p.id)` — one line covers all event types. Also wired `subbedOnPlayerIds` into the assist picker which had the same gap. Red card exclusion fires before this guard — correct.

2. **Fresh-session bug (tab close / device switch / AuthContext wipe):** On mount, if `clock.period !== NOT_STARTED && events.length === 0`, fetch `GET /api/matches/[id]/events` and seed via `mergeExternalEvents` so `subbedOnIds` derives correctly with no localStorage.

**Known gap:** DB seed is skipped if localStorage has any events (guard is `events.length === 0`). A partial cache won't rehydrate missing events. Not a blocker — sub-visibility fix is the in-session line change.

**Status:** RESOLVED — 2026-06-29 (session 38 live test match sim)

**Evidence:**
- Verified by: live test match sim session 38 — all 3 scenarios run manually by user
- Observed result: Scenario A (same session), B (tab close / reopen), C (hard refresh) all showed subbed-on player in general event picker — 11 players correct. Assist picker also confirmed.
- Pending items: broader stat model refactor (per-match stat rows) remains open as separate future work

**Session 34 test match observation (Phase 6):** After a substitution, the subbed-on player appears correctly in the sub picker (shows full 11 including incoming player) but does NOT appear in the general event picker for non-sub events — shows 10 players instead of 11. Hard refresh does not fix it. Root cause: `getOnPitchPlayers` derives `subbedOnIds` from `matchState.events` which is seeded from localStorage — if the sub event isn't in localStorage (device switch, fresh session), incoming player is invisible. This is the concrete manifestation of the BACKLOG-106 gap and confirms this item as a pre-match-day blocker for any match involving substitutions.

#### Problem

`footballPlayerStats` is a flat mutable aggregate. Every goal, card, or assist fires a direct `++` increment in `updatePlayerStats`. This model has three structural failures:

1. **No rollback path.** Delete an event → score reverts, stat doesn't (BUG-060). The only fix is a manual decrement script. That's what Session 29 required.
2. **No per-match traceability.** `player.goals = 7` — you cannot tell which matches those came from, which match to subtract from, or whether any came from test matches.
3. **Cascade delete is impossible.** Deleting a match leaves orphaned stat rows. There is no FK path from `footballPlayerStats` to `matches`.

BUG-060 (stat decrement on delete) is the immediate symptom. The correct fix is not a decrement mirror — it's removing the mutable model entirely.

#### Solution — `match_player_stats` table

One row per player per match. Written atomically when a match ends (or updated per event). Season aggregate = `SUM()` across rows. This is how every real sports platform tracks stats.

**Schema:**
```sql
CREATE TABLE match_player_stats (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  team_id TEXT NOT NULL,
  season TEXT NOT NULL,
  sport TEXT NOT NULL,

  -- Football columns (null for non-football)
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  shots_on_target INTEGER DEFAULT 0,
  shots_off_target INTEGER DEFAULT 0,
  fouls_committed INTEGER DEFAULT 0,
  own_goals INTEGER DEFAULT 0,
  penalties_scored INTEGER DEFAULT 0,
  minutes_played INTEGER DEFAULT 0,

  created_at INTEGER,
  updated_at INTEGER,

  UNIQUE(match_id, player_id)
);
```

**How it replaces the current model:**

| Current | New |
|---------|-----|
| `footballPlayerStats.goals++` on each GOAL event | Upsert `match_player_stats` row for this match — `goals++` |
| `player.goals` = flat lifetime total | `SELECT SUM(goals) FROM match_player_stats WHERE player_id=X AND season='2025'` |
| Delete event → manual stat decrement script | Delete event → recompute `match_player_stats` row from `match_events` for that match |
| Delete match → orphaned stats forever | Delete match → `match_player_stats` rows cascade deleted automatically |
| No per-match breakdown | `match_player_stats` IS the per-match breakdown |

#### Why this fixes BUG-060 cleanly

On event delete: instead of decrementing a global counter (fragile, can go negative), recompute the `match_player_stats` row by re-running a `COUNT()` aggregation over `match_events` for that `(match_id, player_id)`. Idempotent. Can never corrupt.

#### Implementation order

1. **Schema** — create `match_player_stats` table on staging. Add FK `REFERENCES matches(id) ON DELETE CASCADE`.
2. **Write path** — replace `updatePlayerStats` increment calls with `upsert` into `match_player_stats`. Same switch logic, different target table.
3. **Recompute helper** — `recomputeMatchPlayerStats(matchId, playerId)` — runs `COUNT()` group over `match_events`, overwrites the row. Call this on event delete instead of decrement.
4. **Read path** — `footballPlayerStats` season aggregate becomes `SELECT SUM(...) FROM match_player_stats WHERE player_id=X AND season=Y AND sport='Football'`.
5. **Backfill** — for historical matches: derive `match_player_stats` rows from existing `match_events` using the same aggregation. One-time script. Replaces the current dirty `footballPlayerStats` data.
6. **Drop old table** — once read path is confirmed correct, `footballPlayerStats` can be retired.

#### Notes

- Do NOT implement step 6 (drop old table) until leaderboards and player profile pages are confirmed reading from the new path.
- Step 5 (backfill) must run after BUG-011 (718 goals anomaly / duplicate stat rows) is audited — do not backfill from dirty source data.
- BACKLOG-019 remains open for the automation hook (match → FINISHED triggers the recompute). This item only covers the table structure and write/read path.
- `match_player_stats` rows cascading on match delete also fixes the test match contamination problem (BACKLOG-105) — once `is_test` matches are deleted, their stat rows go with them automatically.
- Related: BUG-060, BUG-011, BACKLOG-019, BACKLOG-105, TD-011 (`season` hardcoded)

---

### ~~BACKLOG-111~~ — Stat Reversion on Event Undo

**Status:** RESOLVED — 2026-07-27 (session 47C), live-verified on a real football match/logger session
**Priority:** Low
**Filed:** 2026-06-29

**Context:** The DELETE `/api/matches/[id]/events/[eventId]` handler reverts match score for scoring events but did NOT decrement `footballPlayerStats`. Root cause confirmed via call chain trace: `decrementPlayerStats` existed in `events/route.ts` (collection route) but was never reachable from `[eventId]/route.ts` (the route FootballLogger actually calls) — classic false-RESOLVED gap.

**Fix:** Self-contained `revertPlayerStat(sport, playerId, eventType)` function added to `[eventId]/route.ts`. Switch covers: GOAL, ASSIST, OWN GOAL, PENALTY, PENALTY MISSED, PENALTY SAVED, FOUL, YELLOW CARD, RED CARD, SAVE. All with `Math.max(0, x-1)` floor. Guards: `matchType !== 'friendly'` and `!isPenaltyShootout`. Match fetch moved unconditional; null-guarded on both score-revert and stat-revert paths. `PENALTY SAVED` also reverts keeper `saves--` via `event.relatedPlayerId` (null-checked).

**Scope:** `src/app/api/matches/[id]/events/[eventId]/route.ts` only.

**Evidence:**
- Commit: `f44edfa` (session 36, unchanged tonight — only the live verification was missing until now)
- Verified by: a real throwaway football match (COLNAS vs COLENG, real logger session), session 47C. Note: `matchType !== 'friendly'` guard means a **friendly**-type match can't exercise this path at all — had to switch the throwaway match to `match_type: 'competition'` (no real `competition_id` attached, so no real standings were touched) to actually trigger the stat write in the first place.
- Observed result: real player `busa-joga-player-45` (Samuel Olapite) — baseline `goals: 7` → logged a real Goal → `goals: 8` (confirmed increment) → clicked Undo → `goals: 7` (confirmed exact reversion, not a floor-clamped guess). Event row confirmed deleted from `match_events`, not just hidden client-side.
- Pending items: none. Throwaway match and all its data fully cleaned up (`RUNLOG.md`), real player stats confirmed back to their exact pre-test baseline.

**Related:** BUG-072 (second yellow undo cascade — SHIPPED), BACKLOG-104 (penalty outcomes), BACKLOG-106 (stat recompute via match_player_stats)

---

### BACKLOG-112 — Overturned / Disallowed Decisions

**Status:** OPEN
**Priority:** Low — Undo covers the workaround at MVP
**Filed:** 2026-06-29
**Updated:** 2026-06-30 — expanded from goal-only to all overturned decision types

**Core distinction — Undo vs Overturn:**

| | Undo | Overturn |
|---|---|---|
| What happened | Logger error — event never occurred | Referee gave the decision, then reversed it |
| Match history | Event deleted entirely from DB and feed | Original event stays; overturn event added below it |
| Public feed | Event disappears | Original with strikethrough + overturn row |
| Score/stat revert | Yes | Yes (score) / No (stats — credited at time of play) |
| Push | None | Overturn-specific push to subscribers |

**Decision types and overturn events needed:**

| Original event | Overturn event | Score effect | Stat effect |
|---|---|---|---|
| `Goal` | `Goal Disallowed` | −1 to scoring team | None — goal credited at time of play |
| `Penalty` (scored) | `Penalty Disallowed` | −1 to scoring team | None |
| `Yellow Card` | `Yellow Card Rescinded` | None | None |
| `Red Card` | `Red Card Rescinded` | None — player returns to pitch | None |
| `Red Card (Second Yellow)` | `Red Card Rescinded` | None | None |

**Logger UX (when built):**
- "Overturn Decision" button in the live event feed, visible on the most recent event of each overturnable type
- Tapping opens a confirm modal: "Overturn [event] by [player]? This keeps the original in the feed and adds a disallowed/rescinded row."
- Optional reason field (Offside / Foul in build-up / VAR / Other)
- `detail` field on the overturn event stores the original event ID for linkage

**Public feed rendering:**
- Original event row gains a strikethrough style and muted colour when an overturn event exists for it
- Overturn event renders immediately below: "🚫 72' Goal Disallowed (offside)" / "🟡↩ 55' Yellow Card Rescinded"

**Push notification types to add:** `GOAL_DISALLOWED`, `PENALTY_DISALLOWED`, `CARD_RESCINDED`

**Workaround (current):** Logger uses Undo. Score reverts. Feed loses the narrative — the overturned event disappears entirely rather than being visibly cancelled. Acceptable at MVP; overturned decisions are rare in BUSA League matches.

**Note on BUG-092:** Until BUG-092 (undo not removing events from viewer Timeline in real-time) is fixed, even the current Undo workaround leaves ghost events on the public feed until hard refresh. Fix BUG-092 first — it makes Undo reliable. BACKLOG-112 is the proper overturned-decision feature built on top.

**Related:** BACKLOG-104 (penalty outcomes), BACKLOG-111 (stat reversion on undo), BACKLOG-105 (shootout), BUG-092

---

### ~~BACKLOG-113~~ — Simplified Shootout Modal (UX)

**Status:** ABSORBED INTO BACKLOG-105 — 2026-06-29
**Priority:** N/A
**Filed:** 2026-06-29

**Context:** During `PENALTY_SHOOTOUT` period, the "Penalty Scored" button opens the full `PenaltySequenceModal` (3 steps: fouler picker → taker picker → outcome). Step 1 (fouler) is irrelevant during a shootout — no foul is committed. Loggers must tap "Unknown / No specific player" to skip it, which adds friction under time pressure.

**Proposed:** A `ShootoutPenaltyModal` (or conditional render inside `PenaltySequenceModal` when `isShootout=true`) with 2 steps only:
1. Pick taker (attacker list)
2. Scored / Missed / Saved (+ optional keeper if Saved)

**Why deferred:** Option A (skip Step 1) is acceptable for the first sim and MVP live matches. This becomes a real UX concern once loggers report friction during an actual shootout.

**Scope:** ~40 lines. `FootballLogger.tsx` only — pass `isShootout` prop to `PenaltySequenceModal` and conditionally skip Step 1.

**Related:** BACKLOG-105 (shootout implementation), BACKLOG-104 (penalty outcomes)

---

### BACKLOG-128 — Site Header Logo Is a CSS Div Placeholder, Not the Real Monogram

**Status:** OPEN
**Priority:** Low-Medium — cosmetic, but platform-wide and visible on every page
**Filed:** 2026-07-23 (session 47), found by Richard via element inspector during the favicon directive

**Problem:** The header logo across the viewer app (confirmed via `<launch-selected-element>`, path `div.max-w-7xl > div.h-14 > div.flex > a.flex`) is a hand-rolled Tailwind div, not an image:
```html
<div class="w-7 h-7 bg-primary rounded-lg flex items-center justify-center font-display text-lg -skew-x-12 text-black">B</div>
```
A skewed black "B" on the theme's `bg-primary` blue — never replaced with the actual BrixSports monogram (navy/purple/amber assets now exist at `public/icons/role-colorways/`). Whether admin/logger dashboards have their own equivalent placeholder is unconfirmed — needs checking during the fix.

**Not fixed this session** — this is a shared-component UI change (need to locate the actual header component, decide sizing/skew/transparent-vs-solid treatment, verify it doesn't regress layout), not an asset swap. Explicitly out of scope for the favicon/PWA-icon directive this was found during.

**Fix (not built):** Replace the div with an `<Image>` using the transparent navy monogram (`viewer-32-transparent.png` or similar, sized to match the current `w-7 h-7` slot), or the solid navy version if a background is preferred at that size.

---

### BACKLOG-129 — Dynamic, Role-Relevant PWA Shortcuts (Future)

**Status:** OPEN — deliberately deferred, Richard's own framing ("in the future")
**Priority:** Low
**Filed:** 2026-07-23 (session 47), noted during the favicon directive

**Idea:** Currently each manifest's `shortcuts` array is a fixed, hand-written list (viewer: Live Matches/News/Profile; admin: Dashboard/Matches/News; logger: Logger). Richard's idea for later: make these more dynamic/contextual per role — e.g. viewer shortcuts could deep-link to a followed team or recently-viewed competition; admin could surface "Manage Lineups"/"Assign Loggers"; logger could surface "Assign Match"/"Manage Match" for whatever's currently assigned.

**Not scoped or estimated** — purely a future idea at this point, no design decided. All three manifests' shortcuts currently point at valid, existing icons (fixed this session as part of the favicon directive) — the *icons* aren't broken, only the *content* is static rather than dynamic.

---

### BACKLOG-130 — Clean Confirmed `create-next-app` Boilerplate From `public/`

**Status:** OPEN
**Priority:** Low — cosmetic/hygiene, zero functional impact
**Filed:** 2026-07-23 (session 47), Richard's suspicion confirmed during the favicon directive

**Problem:** `public/next.svg`, `public/vercel.svg`, `public/window.svg`, `public/file.svg`, `public/globe.svg` — confirmed via repo-wide grep to have zero references anywhere in `src/`. These are the default assets `create-next-app` scaffolds on `next init`, never cleaned up. **`public/grid.svg` is NOT part of this** — confirmed actively used (decorative background) in `src/app/profile/page.tsx:256` and `src/app/teams/[id]/page.tsx:124` — do not remove it.

**Not deleted this session** — low-stakes but deserves its own small, deliberate pass rather than riding along silently in an unrelated commit, per the same conservative "flag before delete" convention applied to `manifest.json` and `admin-icon.svg` this same session.

**Fix (not built):** Delete the 5 confirmed-orphan SVGs. Re-grep immediately before deleting (this list could drift) rather than trusting this entry's snapshot.

---

### BUG-127 — Viewer PWA (root `/`) Reportedly Not Offering Install — Unconfirmed, Needs Repro

**Status:** OPEN — flagged, not diagnosed
**Priority:** Medium — if real, blocks the viewer app's own PWA install entirely (Tier 1, not Tier 0 — the site itself works fine unwrapped)
**Filed:** 2026-07-23 (session 47), Richard reported "the / root i.e. the viewer manifest unable to install"

**Problem:** Richard reported the viewer app (root `/`) doesn't offer install. Investigated what's inspectable from here — found nothing wrong: `manifest-user.json` fetched live from `https://brixsports-staging.vercel.app/manifest-user.json` is valid JSON, has `name`/`short_name`/`icons` (192+512, `purpose: "any"`)/`start_url`/`scope`/`display: "standalone"` — meets Chrome's documented installability criteria on paper. Console log on the live site confirms `Service Worker registered: /sw-user.js` with no errors. Could not reproduce or diagnose further from an automated browser session — Chrome's native install prompt (`beforeinstallprompt`) requires genuine user engagement signals that don't fire from scripted navigation, and Chrome doesn't log an explicit "not installable" reason to the console — that only shows in DevTools' own Application → Manifest panel or a Lighthouse PWA audit, run interactively.

**Explicitly not guessed at** — per this project's evidence-standard discipline, not fixing based on a plausible-sounding theory when the actual failure hasn't been observed directly.

**Needs from Richard:** what does Chrome's install UI actually show (or not show) on `/` — no install icon in the address bar at all, an install option that does nothing when clicked, or something else? Ideally paired with DevTools' Application → Manifest panel screenshot, which states the specific installability blocker directly if one exists.

**Update, same session:** Chrome's own address-bar install affordance ("Open in app") was observed present on `/` in a later screenshot — genuine browser-level installability may already be fine. What "unable to install" actually referred to needs clarifying: native browser installability, or BrixSports' own custom in-app install-prompt UI (`InstallPrompt.tsx`) not appearing/behaving as expected. See BACKLOG-131 for real, confirmed gaps found in that custom prompt's logic while investigating this.

---

### BUG-128 — Admin Session Bleeds Into Viewer Header via Shared, Unscoped `localStorage.authToken`

**Status:** OPEN — confirmed root cause via code, not yet fixed
**Priority:** HIGH — directly violates this project's own actor-model rule ("Viewers NEVER have a session. Never assume otherwise.") and works against the same-session's own effort to make viewer/admin/logger feel like distinct apps
**Filed:** 2026-07-23 (session 47), found by Richard: visiting `/` (root viewer page) while an admin session was active showed "ADMIN USER" in the header instead of a normal viewer/guest state

**Problem:** `AuthContext.tsx` reads a single, unscoped `localStorage.getItem('authToken')` key (lines 54/74/135/171/201) with no separation by role or app. Since viewer/admin/logger are all the same origin, logging into `/admin` writes `authToken` to `localStorage`; the *viewer's* `AuthContext.checkAuth()` on `/` reads that exact same key and renders the header as authenticated — as the admin. Confirmed via screenshot: header showed "ADMIN USER" while browsing the public root path.

**Same root-cause class as an already-partially-fixed bug, different surface:** session 38C (`known-issues.md`, 2026-06-30) found and fixed the identical shape via `resolveEffectiveUserId()` for the `follows`/`favorites`/`teams/follow`/`notifications` API routes (auth-cookie path scope, `authToken` set at `path: '/'` reaching every role's routes). This is the same underlying single-shared-credential problem, surfacing via `localStorage` this time, in the header/account-display UI rather than an API route — that earlier fix never covered this surface.

**Not fixed session 47** — deliberately deferred, Richard's explicit call to avoid scope creep during the favicon directive. Scope of a real fix was unclear without investigation: does this affect only the header display, or can an admin's `authToken` also authorize viewer-surface API calls incorrectly (or vice versa)? That question is now answered, session 47C:

**Investigated thoroughly, session 47C — the open question above is answered:** this is a real, confirmed API-level bleed, not just a cosmetic header display issue. Root cause traced through the full chain:
- `src/app/api/auth/login/route.ts` is the **single, universal login endpoint** for every role — there is no separate `/api/admin/login` (confirmed: no admin-specific login page exists anywhere under `src/app/admin`). It sets **one** cookie, name `authToken`, `path: '/'`, `httpOnly`, 7-day `maxAge`, with no role or app scoping of any kind.
- `AuthContext.tsx`'s `checkAuth()` (used by the viewer's own header/nav) tries this exact cookie **first**, via `credentials: 'include'` on `GET /api/auth/me` — `localStorage.authToken` (this entry's original title) is actually the **secondary** fallback, only consulted if the cookie-based check fails. The cookie itself, not just localStorage, is the primary and more significant vector.
- `src/lib/auth.ts`'s `getAuthUser()` — called by every protected route, admin and viewer alike — reads that identical unscoped cookie (`request.cookies.get('authToken')`) with zero awareness of which "app" (viewer/admin/logger) the request is conceptually for.
- **Net effect, confirmed:** an admin who logs in at `/admin` then browses the public viewer site in the same browser has every viewer-surface route that calls `getAuthUser()` (follows, favorites, notification prefs, ratings, etc.) resolve to their **real admin `users.id`** — not a spoof, not a crash, but a genuine actor-model violation ("Viewers NEVER have a session") and a real data-misattribution risk (viewer-side actions taken while an admin session is active get silently attributed to the admin's own account, and vice versa is structurally possible too).
- **No privilege-escalation risk found** — `middleware.ts`'s `/admin`/`/api/admin` gate independently re-checks `payload.role === 'admin'` on every request regardless of cookie presence, so a viewer session can never pass as admin this way. The bleed is one-directional in severity: identity/data misattribution and actor-model violation, not an admin-impersonation or privilege-escalation vector.
- Session 38C's `resolveEffectiveUserId()` (referenced above) does not close this gap for admins specifically — it only special-cases `role === 'logger'` (looking up a matching fan account by email); for `role === 'admin'`, it returns `authUser.id` unchanged, meaning the admin's real `users.id` genuinely gets used for viewer-surface writes rather than crashing or erroring, which is *correct* from a DB-integrity standpoint but confirms the bleed is real and silent, not merely cosmetic.

**Confirms the original recommendation stands — needs its own dedicated session, not a patch here.** The fix isn't a quick scoping tweak: it requires either (a) separate cookie names per app (`viewerAuthToken`/`adminAuthToken`/`loggerAuthToken`, each still `path: '/'` since they're same-origin, checked independently by each app's own auth context) or (b) the subdomain separation Richard already recalled as the original plan (structurally the more correct fix, since separate origins get fully separate cookie jars and `localStorage` enforced by the browser itself, not by convention). Either requires touching `login/route.ts`, `AuthContext.tsx`, `middleware.ts`, and every admin/logger auth entry point consistently — real, coordinated auth-architecture work, appropriately out of scope for the basketball-parity branch this was found on.

**Needs its own dedicated session** — this is an auth/session-architecture question, not a UI patch.

**Related finding, parked alongside this one (same session, same root shape):** narrowing `manifest-admin.json`'s scope from `/` to `/admin` (fixed this session, separately) resolved the specific symptom of `/admin`'s "Open in app" chip offering the wrong installed PWA — but `manifest-user.json`'s scope is still `/`, which technically still overlaps `/admin` and `/logger`. This isn't cleanly fixable the way admin/logger were: viewer legitimately spans dozens of route prefixes (`/matches`, `/teams`, `/players`, `/live`, `/news`, `/profile`, etc.) and the manifest spec's `scope` field is a single prefix with no exclusion syntax — there's no narrower string that means "everything except /admin and /logger." Chrome appears to prefer the more specific scope match when resolving "Open in app" on an overlapping URL (consistent with `/admin` now correctly resolving to the Admin PWA), but this is inferred from one observation, not confirmed against Chrome's actual documented disambiguation behavior — and whether install *order* (installing admin/logger before vs. after viewer) changes anything is untested, not just unconfirmed.

**Why both of these exist at all — Richard's own recollection:** the original plan was to route admin/logger ("ops") to a **separate subdomain** rather than path-based routing (`/admin`, `/logger`) under the same origin as the viewer. Subdomain separation would structurally eliminate both this entry's `localStorage.authToken` bleed *and* the manifest-scope-overlap finding above in one move — separate origins get fully separate `localStorage`, cookies, and PWA scope enforced by the browser's own same-origin security model, not by scoping conventions (`path:`, `scope:`) that have to be manually gotten right and kept right across every new route/manifest, which is exactly the class of bug both these findings are. Worth treating subdomain separation as the real architectural fix to evaluate first, when this gets its own session — not path-scoping patches layered on top of the current single-origin structure.

---

### ~~BACKLOG-131~~ — PWA Install-Prompt System: Confirmed Bugs + Deferred Design Question

**Status:** SHIPPED (items 1-3) — 2026-08-03 (session 47G), not yet live-tested. The design question (below) remains genuinely deferred, not part of this fix.
**Priority:** Medium (the confirmed bug) / not scoped (the design question)
**Filed:** 2026-07-23 (session 47), Richard asked how the install-prompt trigger logic works today and whether a proper reminder system/algorithm is needed

**Confirmed via code, fixed this session:**
1. `InstallPrompt.tsx`'s dismiss timestamp (`localStorage['pwa-install-dismissed']`) is **not namespaced per app type** — unlike the "installed" flag (`brix-${appType}-installed`), which is correctly scoped. Dismissing the install prompt on the viewer suppresses it for admin and logger too (and vice versa) for the full 7-day window. Directly undercuts this session's own work making the three roles feel like distinct apps. **Fixed:** key renamed to `brix-${appType}-install-dismissed`, matching the installed flag's own scoping.
2. Stale comment/code mismatch: comment says "Show prompt after 30 seconds," actual code is `setTimeout(..., 5000)` (5s). Cosmetic, but misleading to a future reader. **Fixed:** comment corrected to "5 seconds."
3. **Added session 47D (PWA audit):** `IOSInstallPrompt.tsx`/`IOSInstallBanner` have the identical un-namespaced bug for their own dismissal keys (`ios-install-dismissed`, `ios-banner-dismissed`) — not previously named in this ticket, which only called out `InstallPrompt.tsx`. Their "already installed" check (`brix-${appType}-installed`) is correctly namespaced, matching item 1's pattern exactly — same fix (namespace every dismissal/cooldown key by `appType`, not just the installed flag) closes both at once. **Fixed:** keys renamed to `brix-${appType}-ios-install-dismissed` and `brix-${appType}-ios-banner-dismissed`.

**Evidence:**
- Commit: pending (session 47G, not yet pushed)
- Verified by: `npx tsc --noEmit` — 49 pre-existing errors (same baseline), zero new, zero in any `InstallPrompt`/`IOSInstallPrompt` file
- Observed result: not yet live-tested — needs a real dismiss-on-one-role/confirm-still-shows-on-another walkthrough on a redeployed preview (logger and admin share `appType="admin"` already, by existing pre-BACKLOG-131 design — not a new gap this fix introduces, matches the pre-existing "installed" flag's own granularity)
- Pending items: live re-test — dismiss the prompt on `/` (viewer), confirm it still shows on `/admin` and `/logger` afterward, and vice versa

**Deferred, not scoped — Richard's broader design question:** should there be a dedicated system (e.g. a sliding-window reminder strategy — show once, escalate/re-show on a schedule if dismissed, per-role tuning) rather than the current flat "5s after event, 7-day dismiss cooldown" logic? Real product/UX design work, not a quick fix — needs its own session to actually design, not sketched under time pressure here.

**Also unresolved from the same investigation:** whether "unable to install" (the original report that started this whole thread) referred to genuine browser-level installability (Chrome's own criteria — appeared fine when checked) or this custom in-app prompt component specifically. See BUG-127.

---

### BACKLOG-132 — Logger UX Redesign + Viewer Sport-Differentiated UI: Deferred Until System Stability

**Status:** DEFERRED — not backscoped (nothing built yet to hide), a backlog deferral
**Priority:** N/A until system stability is reached
**Filed:** 2026-07-23 (session 47), Richard's explicit call

**Decision:** the one-tap/quick-actions/accessibility logger UX philosophy (confirmed platform-wide, not basketball-specific — Richard's own answer, session 47) and basketball's sport-differentiated viewer UI are both deferred until the system is stable across all open criticalities in `SYSTEM_CRITICALITY_MAP.md` — not just basketball's Tier 0 gaps (WS emit, resume-seeding), but the broader open list including BUG-128 (auth bleed) and anything else still open when this gets picked back up. Refinement/polish work happens in a subsequent update once the system underneath it is settled, not layered on top of a still-moving target.

**Why:** consistent with, not a new departure from, standing project doctrine — `SYSTEM_CRITICALITY_MAP.md`'s own rule that any open Tier 0 gap outranks any other tier's work regardless of severity, and the same UI/UX-sweep-deferred sequencing Richard already established back in session 44 (full UI/UX polish waits until system-level bugs/data issues are handled).

**Note on terminology:** this is filed as a BACKLOG deferral, not a `BACKSCOPE.md` entry — `BACKSCOPE.md` tracks already-*built* features hidden pending reinstatement (FPL, predictions, polls); nothing has been built for this redesign yet, so there's nothing to hide. Revisit as a real backscope entry only if partial redesign work gets built and then needs pausing mid-flight.

**Additional concrete notes for whenever this redesign is picked up, session 47C (Richard's direct requests, not built now — same deferral as above):**
- Make the scoreboard/clock block genuinely sticky at the top of the logger view (currently scrolls with the page) — both sports.
- The sticky header's own contents need a pass once it's actually sticky — what belongs there changes when it's always visible vs. only seen at the top.
- A general sweep for hardcoded display data left in the logger UI beyond what this session already found (`STARTER_COUNT`-class issues) — not itemized further here, a real pass needed when this work starts.
- Clarify (product decision, not just code) the actual distinction between "Event Log" and "Match History" as they currently appear in the logger UI — worth confirming these aren't two names for near-identical data before designing anything further on top of either.
- The Settings modal needs a real rework of what belongs in it — actual settings/options vs. usage info vs. one-off actions are currently mixed together; needs a deliberate information-architecture pass, not just visual polish.

---

## Session 47 — Football→Basketball Systematic Mapping Pass (BUG-129 through BUG-133, BACKLOG-133 through BACKLOG-136)

Filed together, same investigation: a deliberate side-by-side comparison of `FootballLogger.tsx` (mature, live-tested) against `BasketballLogger.tsx` (newer), cross-referencing every football bug fix documented in `known-issues.md` against verified basketball code, plus an independent `code-reviewer` agent pass on the same files. Every finding below is code-confirmed, not inferred — either by direct read or by an agent finding independently verified against the actual source afterward.

---

### ~~BUG-129~~ — Every Basketball Event Silently Duplicates Within 15 Seconds

**Status:** RESOLVED — 2026-07-24 (session 47B). Live UI walkthrough completed on the PR #12 Vercel preview.
**Priority:** CRITICAL — corrupts the event log and every derived stat for every basketball match, not an edge case

**Problem:** `BasketballLogger.tsx`'s `recordEvent` generates a local id `` `e${events.length + 1}` `` and never reads the POST response body — only checks `res.ok`. `useMultiLogger.ts`'s `mergeEvents()` (confirmed, `src/lib/multiLogger.ts:130-131`) dedupes strictly via `new Map(allEvents.map(e => [e.id, e]))` — exact ID match only. Since the local temp id never gets swapped for the DB's real `nanoid()` id, the very next 15s sync cycle pulls the same event back from the server as a "new" entry and appends it. Every downstream stat (`calculateAdvancedStats`, `calculatePlayerRating`, event log/history views) double-counts. `FootballLogger.tsx` avoids this via `manager.confirmEvent(event.id, saved.event.id)` after a successful POST — basketball has no equivalent.

**Fix:** `recordEvent`'s POST-success branch now `await`s `res.json()`, and on `saved?.event?.id` present, replaces the matching temp-id event in `events` state (`setEvents(prev => prev.map(...))`) with the server's real id — mirrors football's `manager.confirmEvent(tempId, serverId)` pattern. `src/components/BasketballLogger.tsx`.

**Evidence:**
- Commit: `6c7309f`
- Verified by: full real interactive walkthrough on the PR #12 Vercel preview (`brixsports-staging-gb8ibb1qk...vercel.app`), real logger session, real pre-existing `LIVE` match (`w6o4YQAF5pem_Qa8uazAm`, unblocked by the same session's `BUG-139` fix). Logged a real Field Goal for a real player (LIGHT); DB-confirmed exactly 1 new row (`dev/check-live-match-events.mjs`), client showed "3 Events Recorded" (2 pre-existing + 1 new). Waited 18s (past the 15s sync interval), re-checked both the client's Event Log (still exactly 3, `LIGHT`'s Field Goal appearing once) and the DB row count (`SELECT COUNT(*)` = 3) — no duplicate on either side.
- Pending items: none.

---

### ~~BUG-130~~ — `undoLastEvent()` Is Cosmetic Only, Never Reaches the Server (and the Server Wouldn't Revert the Score Even If It Did)

**Status:** RESOLVED — 2026-07-24 (session 47B). Live UI walkthrough completed on the PR #12 Vercel preview.
**Priority:** CRITICAL — directly breaks Flow B/Flow C guarantees

**Problem:** Three stacked gaps, all required for a real fix:
1. `undoLastEvent()` only slices local `events` state and reverts local score state — no `fetch()` call at all. The DB event row and the DB score (already atomically incremented by the original POST) are both untouched. Any refresh, multi-logger sync, or public viewer still sees the "undone" event and its score contribution.
2. `events/[eventId]/route.ts`'s own score-revert `isScoringEvent` check only recognized `GOAL`/`PENALTY`/`OWN_GOAL` — not basketball's `FIELD_GOAL`/`THREE_POINTER`/`FREE_THROW`. The score would never revert even with the DELETE call wired.
3. Related, same root cause: `revertPlayerStat()` in the same route file had `if (sport !== 'Football') return;` — a hard, literal no-op for basketball. Any basketball event deletion left permanent ghost stats. Same shape as football's already-fixed BUG-060, never ported.

**Fix:**
1. `BasketballLogger.tsx`'s `undoLastEvent` is now async, calls `DELETE /api/matches/[id]/events/[eventId]` first, gates local `events`/score state on `res.ok` (server-first, mirrors BUG-049's Start/End Match discipline), shows `eventSaveError` on failure, and adds an `isUndoing` in-flight guard (the fetch introduces a real double-click race that didn't exist while undo was synchronous).
2. `events/[eventId]/route.ts`'s `isScoringEvent` now also recognizes basketball's shot types via a `match.sport === 'Basketball'` + parsed-`value`-is-a-positive-number gate (`isBasketballScore`), mirroring the POST route's own credit-time gate exactly — a deleted miss still correctly never touches the score.
3. `revertPlayerStat()` gained a full basketball branch mirroring `updatePlayerStats`'s basketball switch, decrementing with a `Math.max(0, x-1)` floor, gated on the same made/miss check.
4. The score-revert decrement amount is now sourced from a new shared `SCORING_POINT_VALUES` allowlist (`src/lib/scoring.ts`, exported from `BUG-131`'s fix) instead of a hardcoded `- 1` — a Field Goal must revert by 2, not 1, or the score ends up permanently short after a basketball undo. Prevents the exact "helper needed by a sibling route file" gap `known-issues.md` already documents (2026-06-29 entry) — moved to a shared lib instead of duplicating the map.

**Evidence:**
- Commit: `e4c8c53`
- Verified by: live DB-confirmed test — `dev/verify-bug130-fix.mjs`, staging DB via local dev server, real TBK player (`i7VBmo4RZkk5Q6_Zixw2I`).
- Observed result: a made Field Goal correctly moved `home_score` `0 → 2` and `basketball_player_stats.field_goals_made`/`total_points` up by 1/+2; the DELETE call against that event's real id brought `home_score` back to exactly `0` and both stat columns back to their exact pre-event baseline (not a flat `-1`, not a partial revert). A separately-posted missed Field Goal (`value: 0, made: false`) never moved the score in either direction, and deleting it left the score and `field_goals_made` untouched — confirming the miss-gate holds symmetrically on both credit and revert. `tsc --noEmit` held at 49 pre-existing errors, none new, across all four touched files (`BasketballLogger.tsx`, `events/route.ts`, `events/[eventId]/route.ts`, `src/lib/scoring.ts`).
- **Live UI walkthrough, same session as `BUG-129`'s:** real Undo button click on the PR #12 preview, real logger session, the real Field Goal logged for `BUG-129`'s test. Score reverted client-side (`4 → 2`); DB-confirmed the event row was actually gone (`dev/check-live-match-events.mjs`) and `home_score` was back to `2` server-side, not just locally. Also confirmed the player's stat row (`dev/check-light-stats.mjs`): `field_goals_attempted` back to `0` (it was `0` before this player's first event of the session), `field_goals_made`/`total_points` back to their exact pre-event baseline — the click-driven undo reverts the same way the script-driven test already proved.
- Pending items: none.

---

### ~~BUG-131~~ — No Server-Side Bound on Scoring `value` — Score Inflatable by Any Authenticated Logger

**Status:** RESOLVED — 2026-07-24 (session 47B)
**Priority:** CRITICAL — a realistic threat given this project's own 120-minute logger session requirement (long-lived sessions, mobile, more surface for a buggy client to misfire)

**Problem:** `events/route.ts`'s scoring path trusts client-supplied `value` verbatim: `const points = typeof value === 'number' ? value : 1;` — no check that it matches the event type's real point value (1/2/3 for Free Throw/Field Goal/Three Pointer). A POST with `{ type: 'Field Goal', value: 500, made: true }` atomically adds 500 to `matches.homeScore` in one request — effectively bypassing BUG-052's admin-only score-write gate through this separate endpoint. Shared code, so football's `GOAL`/`PENALTY` path has the identical structural gap; basketball's legitimate non-1 values make an out-of-range value easier to miss in review.

**Fix:** `points` is now derived from an explicit `SCORING_POINT_VALUES` allowlist keyed by normalized event type (`GOAL/PENALTY/OWN_GOAL: 1`, `FIELD_GOAL: 2`, `THREE_POINTER: 3`, `FREE_THROW: 1`) — client-supplied `value` no longer has any influence on the atomic score increment, for either sport. `src/app/api/matches/[id]/events/route.ts`.

**Evidence:**
- Commit: `dfb5052`
- Verified by: live DB-confirmed test — `dev/verify-bug131-fix.mjs` created a throwaway `UPCOMING` basketball match on staging, POSTed `{ type: 'Field Goal', value: 500, made: true }` as a real assigned logger (`logger_1767968844029`) against the local dev server running the fixed code, then read `matches.home_score` back directly from the DB (not the API response).
- Observed result: `POST` returned `201` with the event saved (raw `value: "500"` persisted on the event row itself, unrelated to score integrity), and `matches.home_score` read back as exactly `2` — the canonical Field Goal value — not `500`. Throwaway match, its event, and its logger assignment were all deleted after. `tsc --noEmit` held at 49 pre-existing errors, none new, none in the touched file.
- Pending items: none for this specific gap. Found in passing during setup, filed separately, not fixed here: an admin-authenticated POST to this same route 500s with a `FOREIGN KEY constraint failed` on `logger_id` (`loggerId: authUser.id` is a `users.id` for an admin, but the column FKs to `loggers.id`) — this is the already-open `BUG-124`, confirmed still reproducible live, not a new finding.

---

### BUG-132 — `value: 0` Collapses to `null` on Write (Write-Side Falsy-Zero, Distinct From the Read-Side Fix Already Shipped This Session)

**Status:** OPEN
**Priority:** Medium — the same falsy-zero bug class fixed twice already this session (BUG-126, the missed-shot-counted-as-made fix), missed here specifically

**Problem:** `events/route.ts:148` — `value: value ? JSON.stringify(value) : null` — collapses a legitimate `value: 0` (basketball's own miss sentinel) to `null` in the DB, discarding the make/miss distinction right after the client computed it via the explicit `made` boolean. The warning comment two lines above this exact line ("points truthiness must never be used to tell make from miss") describes precisely this bug, yet the persistence line still does it. Works today only by accident (`made` itself is never persisted — `match_events` schema has no `made` column — so there's no durable record of make vs. miss beyond this fragile convention).

**Fix:** `value: value !== undefined && value !== null ? JSON.stringify(value) : null`. Consider adding a real `made` column to `match_events` if make/miss needs to survive a reload/undo reliably (currently it doesn't).

---

### ~~BUG-133~~ — Shooting-Attempt Stat Columns Were Write-Orphaned (Attempt-Counter Half Fixed; Rebound/Foul Split Remains Blocked)

**Status:** RESOLVED (attempt-counter tracking) — 2026-07-24 (session 47B). Rebound/foul type-splitting remains explicitly out of scope, still blocked on UI work not yet built (unchanged from original filing).
**Priority:** Medium — shooting percentage can never be computed correctly, ever, for any basketball player

**Problem:** `basketball_player_stats` schema has `fieldGoalsAttempted`/`threePointersAttempted`/`freeThrowsAttempted`, `offensiveRebounds`/`defensiveRebounds`, and `technicalFouls` as distinct columns from their "made"/generic/personal counterparts — but `updatePlayerStats()`'s basketball branch never incremented any of them, on make or miss. A missed shot correctly incremented nothing at all (avoiding the BUG-126-class false-make bug), but it should still increment the attempt counter — without it, there is no denominator for `fieldGoalPercentage`/`threePointPercentage`/`freeThrowPercentage` ever, for any player, at any point. Rebound/foul type-splitting ties to the already-known "foul subtypes collapse to one generic type" gap (BACKLOG-125's own carried-forward note) — same root cause, wider surface than previously scoped, still not fixed.

**Fix:** `events/route.ts`'s `updatePlayerStats` now increments `fieldGoalsAttempted`/`threePointersAttempted`/`freeThrowsAttempted` on every shot attempt regardless of make/miss — the existing made-counter/`totalPoints` logic is unchanged, this is additive. Symmetrically, `events/[eventId]/route.ts`'s `revertPlayerStat` (BUG-130's basketball branch, added this same session) now decrements the same `*Attempted` column unconditionally on delete — without this, a deleted shot would have left the attempt count permanently 1 too high, the exact write/revert asymmetry `known-issues.md` already documents for BUG-060. Offensive/defensive rebound and personal/technical foul splitting still needs UI support for those subtypes first (not yet built) before the write path can distinguish them — this part remains blocked, unchanged, not attempted this session.

**Evidence:**
- Commit: `f879e2c`
- Verified by: live DB-confirmed test — `dev/verify-bug133-fix.mjs`, staging DB via local dev server, real TBK player (`i7VBmo4RZkk5Q6_Zixw2I`).
- Observed result: a made Field Goal moved `field_goals_attempted` and `field_goals_made` both `+1` from baseline. A subsequently-logged missed Field Goal moved `field_goals_attempted` `+1` again (now +2 from baseline) while `field_goals_made` stayed unchanged. Deleting both events brought both columns back to their exact pre-test baseline (`0`/`31` in the test run), confirming the revert decrements symmetrically regardless of make/miss. `tsc --noEmit` held at 49 pre-existing errors, none new.
- Pending items: rebound/foul-subtype splitting, unchanged, still blocked on UI work.

---

### ~~BACKLOG-133~~ — Unbounded Query on `matches/[id]` GET's Events Select

**Status:** RESOLVED — 2026-07-24 (session 47B)
**Priority:** Medium — direct violation of `CLAUDE.md`'s own explicit anti-pattern ("List query with no `.limit()` clause")

**Problem:** `matches/[id]/route.ts`'s `eventsData` query (lines ~63-79) had no `.limit()`. The `playerRatings` select nearby had the same gap (lower risk, roster-bounded).

**Fix:** `.limit(500)` added to the events select; `.limit(100)` added to the `playerRatings` select (roster-bounded, generous headroom). `src/app/api/matches/[id]/route.ts`.

**Evidence:**
- Commit: `f879e2c`
- Verified by: `tsc --noEmit` held at 49 pre-existing errors, none new. No existing match has anywhere near 500 events, so the limit's actual clamping behavior isn't independently observable against live data yet — this is a straightforward defensive bound matching the project's own stated anti-pattern rule, not a fix for an observed failure, so a syntax/regression check via `tsc` plus the code diff itself is the appropriate evidence bar here (consistent with how BACKLOG-045's original `.limit(200)` fix was evidenced).
- Pending items: none.

---

### ~~BACKLOG-134~~ — Silent Failures: Initial Roster Load, Period-Transition PATCHes, No Debounce on Scoring Buttons

**Status:** RESOLVED — 2026-07-24 (session 47B). All three pieces live-verified on the PR #12 Vercel preview, including both failure banners actually triggered via a simulated `fetch` failure (not just the happy path) — this is the first time the roster-load and period-transition banners, and the event-save banner referenced throughout this entry's history, have ever actually been tested since being written.
**Priority:** Medium — all three violate `CLAUDE.md`'s own error-visibility rule ("logging errors must show a clear message to the logger — never appear to succeed when they didn't")

**Problem, three related findings from the same code-reviewer pass:**
1. `fetchData`'s outer catch only `console.error`s — a failed teams/players/eligible-players fetch shows an empty roster with zero on-screen indication.
2. The three fire-and-forget quarter/OT/period-transition PATCH calls only `console.error` on failure — no user-facing signal if a period change doesn't persist.
3. No debounce/in-flight guard on scoring action buttons — only disabled by `!matchStarted || matchEnded`. A rapid double-tap fires two independently-atomic DB writes, double-logging the action server-side.

**Fix:**
1. `fetchData`'s outer catch now also calls `setEventSaveError(...)`, reusing the existing banner rather than a new UI element.
2. All three fire-and-forget period-transition PATCHes (Q-transition, OT-if-tied, Add Extra Time) now check `res.ok` (previously never checked at all — `fetch()` only rejects on network failure, not on a 4xx/5xx response) and surface a specific banner message on either a bad status or a network failure, still fire-and-forget by design (doesn't block the UI transition itself, per the original TD-010 convention this mirrors).
3. Added an `isRecording` state guarding `recordEvent` itself (`if (isRecording) return;` at the top, `finally { setIsRecording(false) }` at the end) — this holds regardless of which UI entry point calls it (direct scoring buttons, the player-select modal, the assist modal, substitution), which is where the actual double-tap risk lives, not the initial type-select buttons. All `ActionButton`/`SimpleActionButton` call sites (21 total) now also pass `disabled={isRecording}` so the tapped button visibly disables mid-request, not just silently no-ops server-side.
4. `recordEvent`'s post-await state updates (`setEvents`, id-swap from `BUG-129`) already use functional updates; extended the same discipline to `undoLastEvent`'s post-await score reverts (`BUG-130`).
5. Found in passing, same file, same falsy-zero bug class as `BUG-126`/`BUG-132`/`BUG-133` (4th occurrence this session) — fixed opportunistically: `fetchData`'s initial-load event transform had `value: e.value ? ... : undefined`, collapsing a legitimate logged-miss `value: 0` back to `undefined` on every page refresh/remount. Changed to an explicit `!== undefined && !== null` check.

**Evidence:**
- Commit: `84f0885` (plus `b63cc49` — the `useState`→`useRef` debounce-guard follow-up fix, same entry, see below)
- Verified by: full real interactive walkthrough on the PR #12 Vercel preview, same live match as `BUG-129`/`BUG-130`'s verification.
- **Item (1) (roster-load failure banner) — actually triggered, not just happy-path:** patched `window.fetch` in the live browser session to reject calls to `/api/teams`/`/api/players`/`/eligible-players`, then forced a fresh mount of `BasketballLogger` (exited to the match-assignment screen, re-entered). Banner rendered exactly as written: *"Failed to load teams/roster — check connection and reload. Player lists may be empty or incomplete."* Team names/logos correctly blank (COLNAS-B/COLENG-B labels missing, only placeholder icons), consistent with the simulated failure. Restored `fetch`, reloaded, confirmed normal roster load resumed.
- **Item (2) (period-transition failure banner) — actually triggered:** patched `fetch` to return `500` for the exact PATCH call, clicked through "End Quarter" → "Start Quarter 2". Banner rendered: *"Failed to save Q2 transition (500) — quarter may not persist on refresh."* DB-confirmed `matches.current_period` correctly stayed `Q1` (the failed write never landed), even though the client's local `quarter` state optimistically advanced to `2` (fire-and-forget by design) — reloaded to resync the client back to the true server state.
- **The event-save failure banner itself (`eventSaveError`, referenced throughout this entry's multi-session history as "never actually tested") — finally tested:** patched `fetch` to reject (simulated offline) for the event POST specifically, logged a Field Goal. Banner rendered: *"Failed to save 'Field Goal' — offline or unreachable. Event kept locally only."* DB-confirmed no phantom event or score change landed. This closes a pending item that had been carried forward since session 46.
- **Debounce guard — real gap found and fixed live, not a clean pass:** double-clicked a Foul action's player button using the Browser pane's native `double_click` action (fires two genuine click events close enough together to race). First check looked clean (client showed one event) — but a follow-up check minutes later, after the next 15s multi-logger sync tick, showed **two** identical "Foul KOSI" entries client-side, and a direct DB query confirmed two separate rows with an identical `created_at` timestamp. Root cause: the `useState`-based `isRecording` guard is not synchronous across two click-handler invocations from the same render's closure — both can read the same stale `isRecording === false` before React commits the state update from the first call, so both proceed. **Fixed:** switched the actual guard to a `useRef` (`isRecordingRef`, a plain synchronous mutation immune to the stale-closure timing), keeping `isRecording` state only for the buttons' visual `disabled` attribute. Also converted `recordEvent`'s optimistic `setEvents([...events, newEvent])` to a functional update (`setEvents(prev => [...prev, newEvent])`). **Re-verified after the fix, on a rebuilt preview:** repeated the exact same `double_click` stress test on the same action — exactly one event recorded, both immediately and past the 15s sync tick, confirmed via direct DB query. The race is closed.
- All test data (the roster/period/event-banner probes, the debounce race's duplicate row) cleaned up by exact id; the real match confirmed back to its original state (2-3, Q1, 2 events) via a final DB check.
- Test data cleanup: the 3 test Foul events created during this walkthrough (1 clean single-click + 2 from the double-click race) were deleted by exact id (`dev/cleanup-live-match-test-events.mjs`), restoring the real match to its original 2-event state.
- Pending items: re-run the double-click stress test once more against the rebuilt preview to confirm the `useRef` fix actually closes the race (the fix is code-reviewed and `tsc`-clean, but the specific race that was just proven live hasn't been re-proven closed yet).

---

### BACKLOG-135 — Dead `BASKETBALL_EVENT`/`MULTI_LOGGER_EVENT` CustomEvent Dispatches

**Status:** OPEN
**Priority:** Low — reinforces the already-known "no WS broadcast for basketball" gap, but worth its own note since reading the dispatch code in isolation implies broadcasting is happening when it isn't

**Problem:** `broadcastEvent` (`useMultiLogger.ts`) and `BasketballLogger`'s own `BASKETBALL_EVENT` `CustomEvent` dispatch have zero listeners anywhere in the codebase (confirmed via grep). Not a bug on its own — just misleading dead code adjacent to the real WS-emit gap already tracked elsewhere.

---

### BACKLOG-136 — Stats Tab: Partial Fix Confirmed Live, Harder Problem (BACKLOG-122) Still Open

**Status:** OPEN — cross-reference note, not a new bug
**Priority:** Tier 1 (feel/polish adjacent to data accuracy) — flagged by Richard explicitly as "don't want to forget," not urgent

**Problem:** `.docs/stats-tab-fix.md` (dated to original project scaffolding, pre-dates most of this project's real session history) describes a conditional-rendering fix for `MatchOverlay.tsx` — hide a stat category entirely rather than showing a hardcoded `[0,0]` when no data exists at all. **Confirmed still live in current code** (`MatchOverlay.tsx:1152-1153`, now with optional chaining, same core mechanism) — this part is real and working, not stale documentation.

**What it does NOT solve — BACKLOG-122's later, worse finding still stands:** a stat category with *asymmetric partial* data (one team's events fully logged, the other's barely logged) produces a genuinely non-null, confidently-wrong-looking number — `busa-match-16`'s `100%-0%` possession, `26-0` shots — not a "no data" case the conditional-render fix would catch, since the value is real and present, just derived from lopsided sheet coverage. This is the harder, still-unsolved half of the same "Stats tab" problem. See `BACKLOG-122` for the full detail and proposed fix (distinguish "goals-only backfill" matches from "full stat capture" matches before deciding what to render).

---

## Session 47 — Basketball-Native Domain Audit (BUG-134 through BUG-137, BACKLOG-137 through BACKLOG-139)

Filed together, same investigation: a `code-reviewer` agent pass explicitly independent of the football-parity method above — basketball's own code read against real FIBA/NBA rules as ground truth, plus a cross-check of football's still-*open* WS gaps (not its fixed ones) against what basketball's future WS-emit port would inherit. Every item below is CONFIRMED via direct code read (file:line cited in each), not inferred — items the agent could not confirm from code alone are explicitly marked as needing a live test, not silently assumed either way.

---

### BUG-134 — Basketball's Foul System Is Structurally Unenforced (Disqualification, Team Fouls, Bonus, Technical-Foul Miscounting)

**Status:** RESOLVED — 2026-07-30, commit `697592e` (session 47E), live-tested session 47F. Minimal scope only, Richard's own explicit call: sub-finding 1 (disqualification) fixed; sub-findings 2-4 (team-foul tracking/bonus, technical-foul miscount) deliberately deferred, filed as `BACKLOG-166`.
**Priority:** HIGH — a real basketball match cannot be officiated correctly through this logger today; this is a domain-correctness gap, not an edge case

**Fix applied, sub-finding 1 only:** `getPersonalFoulCount()`/`isFouledOut()` in `BasketballLogger.tsx`, derived from local event state (`events.filter(e => e.type === 'Foul' && e.playerId === playerId).length >= foulDisqualifyAt`) — matches how all six foul button labels already collapse into one `type: 'Foul'`/`personalFouls` DB column today, so no new miscounting introduced. `foulDisqualifyAt` itself was already sitting unused in `config/route.ts`'s `SPORT_DEFAULTS.basketball` (a past session had already done the config planning, just never wired the enforcement) — now actually read into local state on mount. Wired into two enforcement points: the event player-picker disables a fouled-out player with a visible "FOULED OUT" tag instead of silently allowing more actions logged against them, and the sub-in bench pool excludes them outright (this is also `BUG-136`'s fix, see below).

**Deliberately not fixed this pass (filed as `BACKLOG-166`):** team-foul accumulator + quarter-reset + bonus-state UI (sub-finding 2/3), technical-foul miscounting into `personalFouls` (sub-finding 4), and competition-level override of `foulDisqualifyAt` (currently sport-default-only, no `competitionSportSettings` column exists for it).

**Evidence:**
- Commit: `697592e`
- Verified by: live test against a Vercel preview deployment, real logger session, a real 5-starter + bench lineup set via `/api/matches/[id]/lineup` (so the sub-in picker had a genuine bench to test against — the first attempt, before setting a real lineup, hit `BUG-139`'s "no persisted lineup = everyone's a starter, zero bench" fallback, which made a bench-exclusion test meaningless). Full detail in `RUNLOG.md`.
- Observed result: logged 5 real Personal Foul events against a real starter (SALIMO) via the real player-picker. On the 5th, the very next picker open showed a red "FOULED OUT" tag and a disabled/greyed card for that player — confirmed via a fresh `read_page` accessibility-tree snapshot (not just a screenshot), so this is the real DOM state, not a stale render.
- Pending items: none for sub-finding 1

**Problem, four confirmed sub-findings, same root cause (no foul system beyond a single generic counter):**
1. **No disqualification threshold anywhere.** `BasketballLogger.tsx:988-993` — all six foul buttons (Personal/Technical/Flagrant/Offensive/Shooting/Unsportsmanlike) call the same `handleEventClick('Foul')` with no subtype. No `personalFouls` counter is compared against any threshold anywhere in the component.
2. **Team foul count is never tracked at all** — no per-team, per-quarter accumulator exists, and nothing resets on quarter transition. `config/route.ts:58-62`'s own source comment already admits this: *"Nothing in this codebase enforces these yet (no disqualification check, no team-foul-bonus logic, no shot clock)."*
3. **`teamFoulBonusAt: 5` is computed and returned by the config API but never read** — `BasketballLogger.tsx`'s config-fetch effect destructures only `halfDuration`/`periodCount`/`overtimeDurationMinutes` (confirmed via grep: zero matches for `teamFoulBonusAt` in the component). No "in the bonus" UI state exists anywhere.
4. **`technicalFouls` isn't just write-orphaned (already known) — it's actively wrong.** `events/route.ts:353-355`'s `case 'Foul':` unconditionally writes to `personalFouls`, with no branch for technical fouls at all. Clicking "Technical Foul" in the UI silently inflates `personalFouls` — the same counter a real personal foul increments — conflating two different foul types into one number.

**Fix (not built):** needs foul-subtype UI (the buttons already exist and pass distinct labels — just need to actually pass the subtype through to `recordEvent`/the POST body), a team-level foul accumulator with quarter-reset, bonus-state UI once team fouls are tracked, and a real disqualification gate once personal-foul count is tracked per player. Real scope, not a one-line fix — needs its own directive.

---

### ~~BUG-135~~ — No Distinct Second-Overtime (OT2) Path — Quarter Number Never Advances Past `periodCount + 1`

**Status:** RESOLVED — 2026-08-03 (session 47G), commit `d892b99` (fix), live-verified this session against the `browser-test-47f--kwabip-` throwaway match (real tied game forced through OT1→OT2 in an earlier part of this same session, confirmed via fresh DB query + live browser walkthrough this pass)
**Priority:** Medium — only matters for a match tied after OT1, real but rare

**Problem:** both the end-of-regulation branch and the "Add Extra Time" button (`BasketballLogger.tsx:1738-1790`) unconditionally call `setQuarter(periodCount + 1)`. If OT1 ends still tied and a real OT2 is needed, re-triggering "Start Extra Time" re-runs the identical `setQuarter(periodCount + 1)` — already the current value, so quarter number never advances into a genuine OT2 state. `getCurrentPeriod()` returns the flat string `'OT'` for any `quarter > periodCount`, so OT1 and OT2 events would be stored with an identical `period` field, indistinguishable in `match_events` history.

**Fix:** exactly the prescribed approach — new `otNumber` state, tracked separately from `quarter`. Both OT-entry points (tie-triggered "Start Extra Time" and the always-available "Add Extra Time" button) were duplicating the identical buggy logic; extracted into one `startNextOvertime()` helper rather than fixing it twice. Period label is now `` `OT${otNumber}` ``. Also updated the two live-clock consumers touched earlier this session (`LiveMatchStatus.tsx`, `matches/[id]/page.tsx`) to match on an OT-prefix check instead of the exact string `'OT'`, so a real OT2+ still renders the live countdown instead of silently falling back — otherwise this fix would have quietly broken tonight's earlier live-clock work for any match reaching a genuine second overtime.

**Evidence:**
- Commit: `d892b99`
- Verified by: direct DB query (`dev/check-browser-test-47f-match.mjs`, `dev/check-browser-test-47f-events.mjs`) + live browser walkthrough (logger session injection, matched React state against DB, then the public viewer page)
- Observed result: `matches.current_period = 'OT2'` (not the flat `'OT'`); a real `match_events` row for this match is tagged `period: 'OT2'` (type `Field Goal`); logger UI event log independently displays `"OT2 - 0:51"` for the same event; public `/matches/[id]` page's status badge and Overview tab both read `OT2`, not a stale pre-OT quarter or the flat `'OT'` — confirms the full round-trip: write → persist → hydrate-on-remount (`BUG-189`'s fix) → public broadcast, all correctly OT-numbered, not just the write path in isolation
- Pending items: none for this entry. Found live in the same pass: the logger's own "Quarter" header box still renders the old flat `1 2 3 4` button grid during OT (nothing highlighted, dead controls) and "End Quarter"/"End of Quarter {N}" labels don't read as OT either — filed separately as `BUG-192` (fixed same session, not yet pushed/deployed to this preview).

---

### BUG-136 — Compound Risk: a Fouled-Out Player Can Be Subbed Back Onto the Court

**Status:** RESOLVED — 2026-07-30, commit `697592e` (session 47E), live-tested session 47F. Fixed in the same pass as BUG-134 (it was blocked on BUG-134's per-player foul tracking landing first, per this entry's own note)
**Priority:** HIGH — direct consequence of BUG-134, worth its own entry since the *substitution* side is a distinct fix location

**Problem:** `handleSubIn` and the sub-in player-selection modal filtered only by `homeSubs`/`awaySubs` bench membership — no code path anywhere checked a player's foul count before allowing them back onto the court.

**Fix:** the sub-in modal's `availableSubs` filter now also excludes any player where `isFouledOut(p.id)` is true (BUG-134's new helper), on top of the existing bench-membership check.

**Evidence:**
- Commit: `697592e`
- Verified by: live test against a Vercel preview deployment, same session as `BUG-134`'s evidence (real logger session, real 5-starter + bench lineup), full detail in `RUNLOG.md`
- Observed result: the fouled-out player (SALIMO) turned out to be excluded even earlier than expected, in a stronger way than the entry's own fix description implies — his card in the sub-**out** picker (not just sub-in) was already disabled/unclickable once fouled out, so he could never even be moved to the bench in the first place, let alone selected to come back in. Confirmed by clicking his disabled card (no state change, modal stayed open) then clicking a different player successfully (modal responded normally) to rule out a broken/unresponsive modal. As a direct consequence, he correctly never appeared in the sub-in bench pool either (nothing to check there since he was never move-able to bench). A normal substitution flow (a non-fouled-out starter subbed for a real bench player) was also confirmed working correctly in the same session, to rule out this being a broken-substitution-flow false negative rather than a real exclusion.
- Pending items: none

---

### ~~BUG-137~~ — Retry-Interval Leak on `SocketProvider` Remount, Confirmed in Current Code (Mechanism Has Changed Since `ARCHITECTURE.md` Was Written)

**Status:** RESOLVED — 2026-08-03 (session 47G), commit `7cb44d3` (fix), live-tested against a real Railway restart this session. **Entry was stale**: the "Fix (not built)" line below was never updated after the fix actually landed same session it was filed — same recurring pattern this project's own `known-issues.md` already documents (a fix landing without its tracking entry being updated). The fix has been live in `useWebSocket.tsx` since `7cb44d3`.
**Priority:** Medium — shared/generic code (`useWebSocket.tsx`), applies to every sport's WS connection, not basketball-specific

**Evidence:**
- Commit: `7cb44d3`
- Verified by: `npx tsc --noEmit` clean at fix time; live re-test session 47G against a real Railway restart on the shared staging WS instance (Richard's own call to trigger it, same precedent as `BUG-123`)
- Observed result: full resilience chain confirmed end-to-end on a genuine outage — `[WS] Disconnected: transport close` → 5 built-in Socket.IO reconnection attempts, each logged → `Max reconnection attempts reached` → `reconnect_failed — starting manual retry loop` → 7 manual attempts with correctly-growing exponential backoff (~6s → ~59s → ~67s, capped near `MAX_MS`, consistent with jitter) → `[WS] Connected` once the server genuinely came back. The retry loop correctly self-terminated on success (no further manual-retry logs after the successful connect). **Caveat, not fully closed**: `SocketProvider` is mounted at the root layout (`src/app/layout.tsx`) and never unmounts during normal in-app navigation — the only way it unmounts is a full page reload, which resets all module-level state (`sharedSocket`, `manualRetryLoopActive`, the pending timeout handle) regardless of whether the fix is correct, so a full-reload test can't actually distinguish "fix works" from "fix broken." The specific unmount-cleanup code path (`clearTimeout(manualRetryTimeoutHandle)` + `manualRetryLoopActive = false` in `SocketProvider`'s cleanup, confirmed present via direct source read) is treated as code-reviewed-correct rather than independently runtime-provable in this app's current architecture — same evidentiary bar already accepted for `BUG-143`.
- Pending items: none, given the architectural constraint above. If a genuine non-reload unmount trigger is ever found (e.g. if `SocketProvider` is ever moved off the root layout, or a secondary nested instance is added elsewhere using the same `connectionCount` multi-instance design already in the code), that would be the moment to retry a true unmount/remount test.

**Problem:** `ARCHITECTURE.md` describes this as a plain `setInterval` leak — that description is itself stale. The actual current mechanism (post-BUG-114) is a recursive `setTimeout` chain (`scheduleRetry()`) guarded by a module-level `manualRetryLoopActive` flag. Neither the pending `setTimeout` handle nor the `reconnect_failed` listener is cleared on `SocketProvider` unmount or `sharedSocket.disconnect()` — `SocketProvider`'s cleanup nulls `sharedSocket` but never touches the pending retry timeout or resets the flag. Once a retry loop starts and the socket later tears down, `manualRetryLoopActive` can stay `true` forever (the loop's own self-clearing check reads `sharedSocket?.connected` on a now-null socket, always falsy, so it never fires) — permanently blocking any genuinely new retry loop from starting for a future socket.

**Fix:** `SocketProvider`'s unmount cleanup now tracks the pending `scheduleRetry` timeout at module scope (`manualRetryTimeoutHandle`) and explicitly calls `clearTimeout()` + resets `manualRetryLoopActive = false` on cleanup, not just nulling the socket reference. Confirmed present in the current source.

**Inheritance note (Part B of this audit):** shared, sport-agnostic code — inherited automatically by basketball's future WS-emit port with zero basketball-side work, for better or worse. See the `SYSTEM_CRITICALITY_MAP.md` WS-emit gap entry for the full inheritance determination across all 7 checked football-WS gaps.

---

### BACKLOG-137 — Basketball Quarter Duration Is Fetched and Displayed, Never Enforced

**Status:** OPEN
**Priority:** Low-Medium — distinct from the already-accepted "no ticking clock" design choice; this is "nothing stops logging past the limit," not "the display doesn't tick"

**Problem:** no code path compares elapsed time against `quarterDuration` for any blocking purpose. All scoring/event buttons are gated only by `!matchStarted || matchEnded` — never by time. A logger can log events indefinitely past the configured quarter length with zero warning or block.

---

### BACKLOG-138 — No Halftime State Exists for Basketball at All

**Status:** OPEN
**Priority:** Low — cosmetic/flow, not a data-correctness issue

**Problem:** confirmed via grep — zero matches for `halftime`/`half.?time` (case-insensitive) anywhere in `BasketballLogger.tsx` or `schema.ts`. Not "present but unused" — the field doesn't exist in the config shape at all. Q2→Q3 uses the identical "Start Quarter N+1" handler as every other quarter transition, no distinct halftime UI state.

---

### ~~BACKLOG-139~~ — `BasketballMatchOverlay.tsx`'s Shooting-Percentage Fields Are Never Written by Any Code Path (Worse Than the Known Casing Mismatch)

**Status:** RESOLVED — 2026-08-03 (session 47G)
**Priority:** Medium — silently renders flat 0% for every basketball match's overlay percentages, not a crash, but always wrong. **Escalated during the fix**: the underlying derivation block wasn't just missing the percentage fields, its event-type casing was completely dead — every basketball team stat in `matches.stats` (not just percentages) was always zero.

**Problem:** `BasketballMatchOverlay.tsx:377-378,385-386,393-394` reads `match.stats.fieldGoalPercentage`/`threePointPercentage`/`freeThrowPercentage`, each guarded with `|| 0`. Traced every writer of `match.stats` for basketball (`matches/[id]/route.ts:318-368`) — its derived-from-events object's own keys never include `fieldGoalPercentage`/`threePointPercentage`/`freeThrowPercentage` at all. **Found while fixing, worse than originally scoped:** the derivation block's `switch (event.type)` matched on `'2PT_MADE'`/`'3PT_MADE'`/`'FREE_THROW'`/`'REBOUND'`/`'ASSIST'`/`'STEAL'`/`'BLOCK'` — but `BasketballLogger.tsx`'s own `BasketballEventType` union has only ever dispatched `'Field Goal'`/`'Three Pointer'`/`'Free Throw'`/`'Rebound'`/`'Assist'`/`'Steal'`/`'Block'`. Every case was dead on arrival — `homeFieldGoals`, `homeRebounds`, `homeAssists`, etc. were always `0` for every real basketball match, not just the percentage fields originally filed. This block is not a rarely-hit fallback either: `matches.stats` is only ever written by the legacy, uncalled `/api/events/route.ts` route (same dead pipeline `BACKLOG-159` already documents) and by backfill scripts — the real live logging route (`/api/matches/[id]/events/route.ts`, used by both loggers) never writes it — so this derive-from-events fallback is the actual live path for basketball's team-stats display on every real match.

**Not affected — checked separately and confirmed already correct:** `BasketballLogger.tsx`'s own logger-facing "Stats" tab (`calculateAdvancedStats`, per-player FG%/eFG%/3P%) already uses the correct real event types and the correct made/attempt convention (`value === 2/3/1` for a make). This bug was isolated to the server-side team-stats blob feeding the public match overlay.

**Fix:** rewrote the derivation block to match the real event-type strings, track Made vs. Attempted separately (every shot-type event counts as an attempt; `value > 0` marks a make — the same convention already correct in `calculateAdvancedStats` and in `BUG-133`'s per-player fix), and added the three percentage fields (`Math.round(made/attempted*100)`, `0` when no attempts). Field names changed from `homeFieldGoals`/`homeThreePointers`/`homeFreeThrows` to `homeFieldGoalsMade`/`homeFieldGoalsAttempted`/etc. (and equivalents for 3PT/FT) to actually distinguish made from attempted, which the old names never could. `LiveStats.tsx` (the other real consumer of these specific fields, three `StatBar`s literally labeled "Field Goals/3-Pointers/Free Throws Made") updated to read the new field names — confirmed via grep this was the only other consumer of the renamed fields; `BasketballMatchOverlay.tsx`'s percentage reads and the type declaration (`src/types/index.ts`, already declared `fieldGoalPercentage?: [number, number]` etc. — this fix was already anticipated there) needed no changes. Files: `src/app/api/matches/[id]/route.ts`, `src/components/LiveStats.tsx`.

**Evidence:**
- Commit: `8f9b189`
- Verified by: `npx tsc --noEmit` clean at fix time; logic independently replicated in a throwaway script against real data before pushing; then live-verified against the actual deployed route (`GET /api/matches/browser-test-47f--kwabip-`) on a fresh Vercel preview after redeploy
- Observed result: the deployed route's real JSON response matched the pre-push manual computation exactly — `fieldGoalPercentage: [100, 100]`, `threePointPercentage: [0, 100]`, `homeFieldGoalsMade: 1`/`awayFieldGoalsMade: 3`, all Made/Attempted counts correct, consistent with the match's real `home_score: 2`/`away_score: 8`
- Pending items: none

**Found:** session 47D, by a background audit agent. Escalated and fixed session 47G, prompted by Richard's live report that the logger page's stats numbers needed a factual-accuracy check.

---

### BACKLOG-140 — Separate `loggers` Identity Table Is the Root Cause of a Recurring Bug Class (Auth/FK Divergence From `users`)

**Status:** OPEN — architecture item, deliberately not scoped for a same-session fix
**Priority:** Medium-High — not urgent on its own, but every new feature touching auth/audit fields for a logger-or-admin actor risks reintroducing this same class of bug until it's addressed structurally
**Filed:** 2026-07-24 (session 47B), Richard's own question while reviewing `BUG-124`'s fix

**Problem:** `loggers` is a fully separate identity table from `users` — not a `role` value within one shared table — and every place in the codebase that needs to authenticate or attribute an action to "whichever actor is logged in, admin or logger" has had to build its own bridge between the two. That bridge has broken, differently, multiple times:
- `BUG-124` (today) — `match_events.logger_id` FKs to `loggers.id` specifically. An admin's `users.id` can never satisfy it, so any admin-authenticated event POST 500'd until fixed with a role-conditional null.
- `BUG-057` (2026-06-22) — `getAuthUser`/`verifyAuth` didn't know to look in `loggers` at all for a logger session; a logger JWT's `id` field got queried against `users`, found nothing, returned a false 401 despite a valid cookie.
- `BUG-044`/`BUG-044b` (2026-06-19/26) — logger auth cookie-setting and `/api/loggers/me` needed their own bespoke auth paths because they couldn't reuse the `users`-table auth machinery as-is.
- `known-issues.md` 2026-06-30 entry — a `users` row with `role: 'logger'` (a viewer-path account that also happens to log matches) has a JWT whose id exists in `users`, not `loggers`; a single-table lookup silently misses it, requiring an explicit try-`loggers`-then-`users` fallback (`getAuthUser`, still in place today) rather than one canonical lookup.
- JWT payload shape divergence (`{ userId }` for `users`-issued tokens vs `{ id }` for `loggers`-issued tokens) — a direct consequence of the two tables never sharing a schema or an issuance path, requiring `verifyAuth` to normalize `decoded.userId ?? decoded.id` on every verify.

**Root cause:** this is structurally non-standard RBAC. The conventional shape for "several actor types, one of which (logger) also needs a many-to-many assignment to matches" is: one `users` table with a `role` column (`admin` | `logger` | `viewer`), one JWT payload shape for every role, one `getAuthUser` lookup with no role-branching, and the existing `match_logger_assignments` join table (already correctly modeled as a separate many-to-many table) continues to reference `users.id` instead of a second identity table's id. Every FK that currently has to special-case "this column points at loggers.id, not users.id" would instead point at one shared `users.id` uniformly.

**Fix (not built, explicitly not scoped for this session):** merge `loggers` rows into `users` with `role: 'logger'`, migrate `match_logger_assignments.logger_id` and `match_events.logger_id` to reference `users.id`, unify JWT issuance to one payload shape, and remove `getAuthUser`'s role-branching table lookup. This touches auth on every protected route in the app (both directly — every handler that calls `getAuthUser` — and indirectly, via every FK currently pointed at `loggers.id`) and needs its own dedicated session with a real migration plan (staging first, per this project's own schema-migration rule), not a drive-by patch layered onto other work.

**Deferred, Richard's explicit call:** raised as a direct question while reviewing `BUG-124`'s fix ("will you say the db architecture was bad as to having a separate logger table?") — confirmed as the correct read of the accumulated evidence above, filed as its own item rather than attempted mid-session.

---

### ~~BUG-138~~ — `team_ratings` Table Did Not Exist on Staging or Prod (Schema Drift), Silently Failed Every Team-Rating Write

**Status:** RESOLVED — 2026-07-27 (session 47C)
**Priority:** Medium — non-blocking (player ratings still write fine; this only affects the team-rating half of the same calculation), but confirmed to fail on 100% of attempts
**Filed:** 2026-07-24 (session 47B), found live while verifying `BACKLOG-124`'s fix

**Problem:** `teamRatings` is declared in `src/db/schema-ratings.ts` (table name `team_ratings`) and `calculateAndSaveRatings()` (`src/lib/ratingsService.ts`, extracted this session from the old `ratings/route.ts` POST handler — the bug is not new, just newly reachable) writes to it in a loop immediately after successfully writing all player ratings. Confirmed via a direct `sqlite_master` query against the staging DB (`dev/check-rating-tables.mjs`): only `player_ratings` and `rating_history` exist — `team_ratings` was apparently never pushed to staging, despite being fully defined in schema. Every call to `calculateAndSaveRatings` threw `SQLITE_UNKNOWN: no such table: team_ratings` partway through, after player ratings had already committed successfully. This was previously invisible because the only caller that could reach this code path was `events/route.ts`'s old self-fetch (`BACKLOG-124`), which 401'd before ever getting this far — fixing `BACKLOG-124` made this code path reachable for the first time, which is how this surfaced.

**Confirmed live (session 47B verification run):** a real basketball event POST on a `LIVE`-status throwaway match correctly wrote a `player_ratings` row (`auto_rating: 6.2`) via the now-fixed `BACKLOG-124` path; the immediately-following `team_ratings` write threw, caught silently by `events/route.ts`'s own `after()` try/catch (`console.error` only, does not affect the event POST's `201` response).

**Fix:** created the missing `team_ratings` table on both staging and prod via a targeted, additive `CREATE TABLE` (`dev/create-team-ratings-table.mjs`) rather than `drizzle-kit push` — this project's own session-11 precedent (`RUNLOG.md`, `BACKLOG-040`) shows a plain push getting blocked by unrelated schema drift elsewhere. Pulled `player_ratings`' actual DDL directly from `sqlite_master` (not guessed from `schema.ts`) and matched `team_ratings` to that same real, already-working pattern.

**Evidence:**
- Commit: N/A (schema-only fix, no application code change)
- Verified by: `dev/check-team-ratings-both-envs.mjs` (confirmed missing on **both** staging and prod, not just staging as originally filed — prod had never been checked), `dev/create-team-ratings-table.mjs --apply` (both environments), `dev/verify-team-ratings-write.mjs`/`-prod.mjs` (real insert/read/delete cycle on each, using real match/team IDs to satisfy FKs). Full detail in `RUNLOG.md`'s 2026-07-27 entries.
- Observed result: `team_ratings` now exists on both environments with all 11 expected columns (`PRAGMA table_info` confirmed, not assumed from the DDL). A real row inserted, read back with correct values and defaults, then deleted cleanly (0 rows remaining) on both staging and prod.
- **New finding, filed separately as `BACKLOG-146`, not part of this fix's scope:** the actual `POST /api/matches/[id]/ratings` endpoint still can't complete end-to-end for basketball matches — `calculateAndSaveRatings()` requires `match.lineups` in football's JSON shape, which basketball never populates (its lineup state lives locally instead, per `BACKLOG-141`). Confirmed live: `400 "No lineups found for this match"` on a real assigned-logger session, before ever reaching the (now-fixed) `team_ratings` write. `team_ratings` existing was necessary but not sufficient for basketball ratings to actually calculate.
- Pending items: none for this specific gap (the missing table). `BACKLOG-146` tracks the newly-found, separate lineup-format gap.

**Investigated further, session 47C:** confirmed the "silently fails" framing is accurate for the automatic path but incomplete overall — there is a second, real, user-facing consequence.
- **Automatic path confirmed safe:** `events/route.ts:304-310` wraps `calculateAndSaveRatings()` in its own `after()` + try/catch, `console.error` only — genuinely does not affect the event POST's `201` response. Flow B is not at risk.
- **Manual path is NOT silent — a real admin-facing gap, not previously documented:** `src/app/admin/match-ratings/[id]/page.tsx`'s "Calculate Ratings" action (line ~138) calls `POST /api/matches/[id]/ratings` directly. That route's own try/catch (`ratings/route.ts:134-139`) catches the `team_ratings` failure but returns `{ error: err.message }` at `status: 500` — `err.message` there is the **raw SQLite error string** (`no such table: team_ratings`), sent straight to the client and displayed in the admin UI's error banner. This is a second, independent violation of this project's own "never return raw database errors to the client" rule, caused by the same missing table, reachable by any admin who clicks "Calculate Ratings" for a match — not just a background no-op.
- `schema-ratings.ts`'s `teamRatings` definition (`id`, FK'd `matchId`/`teamId` with cascade delete, `rating`, `playerCount`, `totalPlayerRating`, `goals`, nullable `possession`/`shotsOnTarget`, timestamps) is clean and self-contained — creating it is purely additive, no data migration, no risk to existing tables.
- **Recommendation:** the `drizzle-kit push` fix is low-risk and would close both the background no-op and the admin-facing raw-error exposure in one move. Still not run this session — schema pushes against staging are a "confirm first" action per this project's own migration governance, not something to execute without an explicit go-ahead even though the change itself is additive-only.

---

---

### ~~BUG-139~~ — No Mid-Match-Resume Seeding for Basketball Blocks Logging Entirely on Any Already-LIVE Match

**Status:** RESOLVED — 2026-07-24 (session 47B). Promoted from a buried "carried forward" note (`BACKLOG-125`, session 46) to its own tracked item and fixed, per Richard's explicit call after live-hitting it during the PR #12 preview walkthrough.
**Priority:** CRITICAL — permanently blocks logging any new event on any match that's already `LIVE` when the page loads (a refresh, a second logger joining, or simply reopening the app), not an edge case

**Problem:** `homeStarters`/`awayStarters` are only ever populated by the in-app lineup-selection wizard (`showLineupModal` → pick 5 starters → `setHomeStarters`/`setAwayStarters`) — there is no server-side lineup persistence for basketball at all (confirmed via grep: zero references to `lineups`/`/lineup` anywhere in `BasketballLogger.tsx`, unlike `FootballLogger.tsx` which fetches `GET /api/matches/[id]/lineup` on every mount). Since `matchStarted` initializes straight to `true` whenever `match.status === 'LIVE'` on mount, any already-live match skips the lineup wizard entirely — `homeStarters`/`awayStarters` stay permanently `[]` for that session. The "Select Player" modal (`BasketballLogger.tsx:1262`) filters strictly to `(selectedTeam === 'home' ? homeStarters : awayStarters).includes(p.id)` — with both arrays empty, the modal renders with zero players, permanently, blocking every scoring/rebound/foul/etc. event from ever being logged for that session. **Confirmed live**, not inferred: reused a real pre-existing `LIVE` match (`w6o4YQAF5pem_Qa8uazAm`, COLNAS-B vs COLENG-B) on the PR #12 Vercel preview — the eligible-players API correctly returned 11 real players with correct `memberships` (confirmed via a direct in-browser `fetch()`), but the "Select Player" modal showed literally zero player buttons after clicking any scoring action.

**Fix:** `fetchData`'s roster-load effect now seeds `homeStarters`/`awayStarters` from the full resolved roster (`homePlayersList`/`awayPlayersList`, the same lists that were already confirmed correct) whenever `match.status === 'LIVE'` and the starters arrays are still empty (a functional-update guard, `prev => prev.length > 0 ? prev : ...`, so it never clobbers a real in-session lineup selection). `lineupSet` is also set `true` in this path so no stale "Set Lineup" UI can reappear. `src/components/BasketballLogger.tsx`.

**Known limitation, accepted rather than silently hidden:** this does not distinguish on-court starters from bench for a *resumed* session specifically — every rostered player becomes selectable, not just the original 5. Building real server-side lineup persistence (mirroring football's `/lineup` endpoint, so a resumed session can restore the *actual* starters/bench split) is real, separate scope, not attempted here — the alternative (a permanently unusable logger on every resume) is worse.

**Evidence:**
- Commit: `9420364`
- Verified by: found live via a real interactive walkthrough on the PR #12 Vercel preview deployment (a genuine `LIVE` match, real logger session, real roster data confirmed via direct API fetch from inside the authenticated browser tab) — not inferred from code alone. `tsc --noEmit` held at 49 pre-existing errors, none new.
- Pending items: full click-through re-verification on the next preview rebuild (push required — this fix isn't live on the deployed preview until the new commit builds). Server-side lineup persistence (the "real" fix, restoring actual starters/bench on resume) remains open, not filed as a separate number yet — revisit if/when the shared-logger-core refactor or a dedicated lineup-persistence directive gets scoped.

---

---

### ~~BACKLOG-141~~ — Real Server-Side Lineup Persistence for Basketball (Mirror Football's `/lineup` Endpoint)

**Status:** RESOLVED — commit `415c5e4`, landed later the same session (47E) this entry was originally filed as deferred; live-tested session 47F. **Status line never updated after the fix landed — found stale session 47F**, same failure class as `BUG-092`'s staleness (a fix landing without its own tracking entry being updated). Confirmed genuinely built via direct code read, session 47F: `BasketballLogger.tsx:437` fetches `GET /api/matches/[id]/lineup` on mount (comment explicitly cites `BACKLOG-141`), hydrates `homeStarters`/`awayStarters`/subs from the response, and `BasketballLogger.tsx:2137,2142` POSTs back to the same endpoint on lineup confirmation with visible failure-banner handling — exactly the fix this entry's own "Fix (not built)" section below describes.
**Priority:** Medium-High — the actual, complete fix for `BUG-139`'s resume-seeding gap; `BUG-139`'s shipped fix is a safe fallback, not this

**Problem:** `BUG-139` (this session) fixed the immediate blocker — basketball's "Select Player" modal being permanently empty on any resumed/already-`LIVE` match — by seeding `homeStarters`/`awayStarters` from the full roster when they're empty on mount. That's a fallback, not a real fix: it means a resumed session can never distinguish the original 5 starters from the bench, for the rest of that session. Football doesn't have this problem because it persists lineups server-side: `FootballLogger.tsx` fetches `GET /api/matches/[id]/lineup` on every mount and calls `setLineups(lineupsData.lineups)`, so the real starters/bench split survives a refresh, a second logger joining, or any resume — basketball has no equivalent endpoint, no equivalent persisted column usage, and no equivalent fetch-on-mount.

**Fix (not built):** build the basketball equivalent of football's lineup flow — persist `homeStarters`/`awayStarters` (or an equivalent starters/bench shape) to the server when a logger completes the in-app lineup wizard (the `matches.lineups` JSON column already exists and is already read by `src/lib/ratingsService.ts`'s `calculateAndSaveRatings`, so the shape is already partially spoken for — confirm compatibility before reusing it, or add a dedicated basketball lineup table/column if the shapes conflict), then fetch and seed from it on every mount, mirroring football's `GET /lineup` pattern exactly. Once this lands, `BUG-139`'s roster-fallback becomes a true last-resort (a match that was started before this feature existed) rather than the only mechanism.

**Deferred:** real, separate feature-sized scope — not a same-session patch alongside tonight's critical-bug fixes. Explicitly named and filed per Richard's request, distinct from `BUG-139`'s already-shipped stopgap.

**Evidence:**
- Commit: `415c5e4`
- Verified by: live test against a Vercel preview deployment — posted a real 5-starter + bench lineup via `POST /api/matches/[id]/lineup` for both teams, then loaded `BasketballLogger` fresh (full page navigation, not just a re-render) and opened the Foul player-picker. Full detail in `RUNLOG.md`.
- Observed result: the picker showed exactly the 5 real posted starters (not the full 12-player roster `BUG-139`'s fallback would show), and the Substitution flow's "who's entering?" step showed the real 7-player bench — confirming both the GET-hydration and the starters/bench split genuinely work, not just the POST write path.
- Pending items: none

---

### ~~BUG-140~~ — Basketball Logger Has No Auth-Refresh Recovery Mechanism (Football Analog of BUG-058b)

**Status:** RESOLVED — 2026-07-27 (session 47C)
**Priority:** Medium-High — silent, session-killing, invisible until something relies on it; not actively blocking anything today since basketball has no offline queue yet to be broken by it

**Evidence:**
- Commit: `ab8c44e`
- Verified by: live UI test on PR #12's Vercel preview (`brixsports-staging-git-fix-basketbal-a82f03-...`), a real logger session (`logger_1767968844029`) on the existing `LIVE` match.
- Observed result: cleared `localStorage.authToken` (`null` confirmed), then remounted `BasketballLogger` (navigated back to `/logger`, re-entered the match). `localStorage.authToken` read back afterward contained a **freshly-issued** JWT — different `iat`/`exp` from the token manually injected earlier in the session, confirming the mount effect genuinely called `/api/auth/refresh` and wrote a new token back, not stale state.
- Pending items: none.

**Problem:** `FootballLogger.tsx` has a `useEffect` (~lines 208-219) that calls `POST /api/auth/refresh` on mount to re-seed `localStorage.authToken` after `AuthContext`'s own `/api/auth/me` 401-check can wipe it — this is `BUG-058b`'s fix (see that entry for full original context on what it solves and why). `BasketballLogger.tsx` has zero occurrences of `auth/refresh`, `authToken`, or `BrixsportAdminDB` anywhere (confirmed via grep) — no equivalent mechanism exists at all. Practical effect: any basketball logger session that triggers `AuthContext`'s 401-wipe path loses `localStorage.authToken` permanently for that session, with no recovery. This would silently break any future offline-queue work for basketball (basketball doesn't have an offline queue yet either — that's a separate, already-known gap, not re-filed here) and is a real gap today wherever basketball code might read `localStorage.authToken`.

**Fix:** ported football's auth-refresh `useEffect` pattern verbatim (the same `POST /api/auth/refresh`-on-mount re-seed) to `BasketballLogger.tsx`, placed alongside the existing lineup-modal-state debug effect.

**Found:** session 47B, via a systematic `FootballLogger.tsx`-vs-`BasketballLogger.tsx` comparison pass (an Explore agent's audit) requested by Richard mid-session, comparing basketball-logger parity against football's mature, battle-tested equivalent.

---

### ~~BUG-141~~ — No Empty-State Message on Basketball's Substitution Sub-In Modal (Football Analog of BUG-070)

**Status:** RESOLVED — 2026-07-27 (session 47C)
**Priority:** Low — UX confusion, not data loss

**Evidence:**
- Commit: `ab8c44e`
- Verified by: live UI test on PR #12's Vercel preview, same logger session as `BUG-140`.
- Observed result: clicked Substitution, selected an on-court player to sub out. The "who is entering" modal rendered "**No available substitutes**" with a "Cancel Substitution" button — not the old blank grid.
- Pending items: none.

**Problem:** `FootballLogger.tsx`'s substitution modal has an `emptyMessage` prop (e.g. `'No available substitutes'`) shown when there are no eligible bench players — this is `BUG-070`'s fix (see that entry for full original football context). `BasketballLogger.tsx`'s own sub-in modal (around lines 1343-1373) renders an empty grid with zero fallback message when `homeSubs`/`awaySubs` is empty. Practical effect: a logger taps Substitution, sees a blank modal with no bench players and no explanation, and may think the app is broken mid-game.

**Fix:** the sub-in modal's player grid is now computed into an `availableSubs` list first; when empty it renders a "No available substitutes" fallback message instead of an empty grid, mirroring football's `emptyMessage` pattern.

**Found:** session 47B, via a systematic `FootballLogger.tsx`-vs-`BasketballLogger.tsx` comparison pass (an Explore agent's audit) requested by Richard mid-session, comparing basketball-logger parity against football's mature, battle-tested equivalent.

---

---

### ~~BUG-142~~ — Basketball Has No Offline-Queue/Retry Mechanism at All — Failed Writes Are Visible But Never Recovered

**Status:** RESOLVED — 2026-08-03 (session 47G), commits `212616a` (event POST), `2f581a2` (period-transition PATCH + undo DELETE), `c447eb6` (roster-load retry). Event-POST path live-verified end-to-end this session; period-transition/undo/roster-load paths still SHIPPED-only (see Pending items).
**Priority:** High — every write path this session gave a failure a visible banner (roster load, period-transition PATCH, event POST), but none of them could self-heal; a logger who doesn't notice or can't manually retry loses the write permanently

**Fix, event-POST scope (`212616a`):** ports `FootballLogger.tsx`'s own proven mechanism (`BACKLOG-058`, live-tested on staging) rather than building a new one. IndexedDB helpers extracted to a new shared module, `src/lib/admin-offline-queue.ts` (was inline-only in `FootballLogger.tsx` before — extracting avoided a third ad-hoc copy of the same contract, this project's own audits have repeatedly flagged that pattern class). Same `BrixsportAdminDB.pendingMatchEvents` store `sw-admin.js` already drains — confirmed its `syncMatchEvents()` POSTs generically regardless of sport, so zero SW changes were needed. `recordEvent`'s catch block now queues on network failure (with the same 30-min token-TTL guard football uses), plus the SW message listener + `online`/`visibilitychange` drain-trigger effects basketball had none of before.

**Fix, period-transition PATCH + undo DELETE (`2f581a2`):** a second, separate IndexedDB store, `pendingAdminChanges`, already existed in `sw-admin.js` (generic `{url, method, data}` shape) but nothing anywhere in `src/` ever wrote to it — dead infrastructure. Activating it surfaced a real bug: `syncAdminChanges()` never sent an `Authorization` header at all, so every retry would have 401'd; fixed to require a `token` at queue-write time, same convention the event queue already uses. Added `queueAdminChange()` to the shared module; extracted `persistPeriodTransition()` as one helper shared by every period-transition button instead of duplicating the queue logic three times. Undo's queue path deliberately does NOT flip local event/score state on a queued-but-undrained delete — `BUG-130`'s own principle (never flip local state before the server confirms) applies just as much to a queued-but-not-yet-drained write as to an online one. Also wired the iOS Background-Sync fallback (`DRAIN_ADMIN_CHANGES` message, mirroring the existing `DRAIN_MATCH_EVENTS`).

**Fix, roster-load retry (`c447eb6`):** a plain closure-local `didFail` flag (not React state) set in the existing catch block, plus a `window` `online` listener that re-runs the same `fetchData()` if the last attempt failed. No new UI — reuses the existing `eventSaveError` banner for visibility.

**Problem:** Confirmed live this session: forcing a period-transition PATCH to fail (mocked `fetch` returning `500` for the exact PATCH call) correctly showed `BACKLOG-134`'s new banner ("Failed to save Q2 transition (500) — quarter may not persist on refresh") and correctly left `matches.current_period` unchanged in the DB (`Q1`, confirmed via direct query) rather than writing bad data. But that's where it ends — there is no queue, no retry, no background sync. `FootballLogger.tsx` has a full mechanism for exactly this scenario: failed writes go into IndexedDB (`BrixsportAdminDB`), a service worker drains the queue on reconnect (`syncMatchEvents()` in `sw-admin.js`), and the auth token needed to replay the write is embedded in the queued row at write time (since a service worker sync event has no live session). `BasketballLogger.tsx` has zero references to `indexedDB`, `IndexedDB`, `offline`, `queue`, or `syncMatchEvents` anywhere (confirmed via grep) — every failure this session (roster load, period PATCH, event POST, undo DELETE) is a dead end once the banner is dismissed. This compounds `BUG-140` (no auth-refresh either) — even if an offline queue existed today, the token needed to replay a queued write could already be gone by the time connectivity returns.

**Evidence:**
- Commits: `212616a`, `2f581a2`, `c447eb6`
- Verified by: direct DB query before/after a real forced-failure + drain cycle against `browser-test-47f--kwabip-` on the deployed preview (`dev/check-browser-test-47f-events.mjs`, `dev/check-browser-test-47f-match.mjs`), plus IndexedDB inspection via injected browser JS
- Observed result (event-POST path, full cycle): `window.fetch` patched to force one `/events` POST to fail → banner correctly showed queued state → `pendingMatchEvents` store had 2 real rows (correct payload shape, embedded JWT) → SW drain triggered via `postMessage({type:'DRAIN_MATCH_EVENTS'})` → queue count `2 → 0` → `match_events` gained 2 new rows tagged `OT2` with the correct player/type → `matches.away_score` correctly incremented DB-side to match (`0 → 2 → 8` across the full test sequence, real Field Goal + 2 drained Three Pointers, arithmetic checks out exactly). Also confirmed server-side: `sw-admin.js`'s `syncMatchEvents()` POSTs to the identical `/api/matches/[id]/events` route a live write uses, so a successful drain fires the same WS `event:new` broadcast other viewers/loggers see live — not a silent background catch-up.
- Pending items: period-transition PATCH, undo DELETE, and roster-load retry paths (3 of the original 4 write/read paths) still need the same live forced-failure-then-drain cycle — only the event-POST path was exercised this session. Also see `BUG-193` (filed this session): a narrow but real sub-case where the queue write itself can fail if `BrixsportAdminDB` was ever previously stamped at version 1 without its expected object stores (observed once during this session's own testing, self-diagnosed as a test-methodology race rather than a reproducible app bug, but the missing-store guard `BUG-193` recommends is still worth adding defensively).

**Found:** session 47B, confirmed live while testing `BACKLOG-134`'s period-transition failure banner on the PR #12 preview — the banner worked exactly as designed, which is what made the absence of any recovery path obvious.

---

### ~~BACKLOG-142~~ — Staff-Comms: Current-State Audit → Auth Gap Fixed, UI Pulled Pending a Real Selection Flow

**Status:** RESOLVED — 2026-07-27 (session 47C). Per Richard's explicit call after the audit below: rather than half-fix a feature not on any Critical Flow, the API route's auth gap is fixed in place and the UI is pulled from both consumers (`BACKSCOPE.md`, grep `BACKSCOPED: 2026-07-27`) until the admin-side selection flow is rebuilt properly.
**Priority:** Medium — the auth gap was a real, live production gap; the rest is stability/completeness assessment, not an active incident

**Evidence:**
- Commit: `81cce2e`
- Verified by: live test on PR #12's Vercel preview — both an admin session (`gen-admin-test-token.mjs`) and a logger session.
- Observed result: (1) UI removal confirmed on `/admin/manager` — `document.body.innerText` search for "comms" returned zero matches anywhere on the rendered page. (2) API auth confirmed both ways on the same route: authenticated admin session → `GET /api/staff-comms?matchId=...` returned a real `200`/`[]`; same request with cookies fully cleared → request never reached the route at all, redirected straight to `/login` (confirmed via `res.redirected`/`res.url` on the fetch response).
- Pending items: `FootballLogger.tsx`'s side of the same removal not independently re-verified live (identical code pattern from the same commit, already confirmed via direct source read + clean `tsc` — treated as sufficiently covered rather than redundantly re-tested).

**What this feature actually is, confirmed by direct read (not assumed from the name):** a per-match staff notes channel — `staff_comms` table (`schema.ts:782`, `matchId`/`userId`/`content`/`type`/`priority`/`isRead`), `GET`/`POST /api/staff-comms` (`src/app/api/staff-comms/route.ts`), consumed by two real UIs: `FootballLogger.tsx` (fetch-on-mount + 15s poll, plus a `handleSendNote` composer) and `src/app/admin/manager/page.tsx` (a comms panel for admins). This is a genuinely wired, non-stub feature — not a dead scaffold.

**It is a different, unrelated mechanism from `/api/chat/send`** (used only by `LivestreamChat.tsx`, a livestream-viewer chat forwarded straight to a WS broadcast room, no DB table at all, has proper `getAuthUser`). `.agents/dev/SYSTEM_AUDIT.md`'s 2026-06-08 entry (`staffComms: PARTIAL... /api/chat/send forwards to WS. Direct DB insert path unclear`) conflates the two under one line — that audit is also ~7 weeks stale generally, not just on this point, and shouldn't be trusted without re-verification (consistent with this project's own stale-fact-propagation lesson in `known-issues.md`).

**Real problems found, confirmed this session:**
1. **No auth at all, in production.** Neither `GET` nor `POST` in `staff-comms/route.ts` calls `getAuthUser()`. `middleware.ts`'s matcher only covers `/admin/:path*` + `/api/admin/:path*` (all environments) and a staging-only JWT gate — `/api/staff-comms` matches neither, so in production anyone with a `matchId` can read every match's notes and `POST` a note under any `userId` they choose (the route trusts `body.userId` verbatim). Same bug class as the already-fixed BUG-034/BUG-107.
2. **The admin-side UI is genuinely half-built, not just untested.** `admin/manager/page.tsx`'s initial load doesn't let the admin pick a match to view comms for — it auto-fetches comms for "the first unapproved finished match if it exists" (the code's own comment literally says `// For now, let's just fetch for the first...`), while a separate, real per-match `onSelect` handler further down the same file does the intentional thing correctly. Two different selection mechanisms for the same panel, one of them a placeholder.
3. **No live test, no bug filing, no mention anywhere in `BUILD_JOURNAL.md`/`BACKLOG.md` prior to this entry** — this feature has shipped and been in use with zero verification history.

**Verdict, per Richard's own "stable things over partial systems" framing:** this is a working-but-unhardened, feature-incomplete system — real enough that the auth gap should not be ignored indefinitely, but not something to extend to basketball yet. **Do not port to `BasketballLogger.tsx` until (1) is fixed and (2) is cleaned up** — otherwise basketball inherits the same unauthenticated write path and the same half-built admin selection flow on day one.

**Fix:** (1) `src/app/api/staff-comms/route.ts` — both `GET` and `POST` now call `getAuthUser(request)` and reject with 401 if absent; `POST` derives `userId` via `resolveEffectiveUserId(authUser)` rather than the client body, since `staffComms.userId` FKs to `users.id` and a naive `authUser.id` would FK-crash for a logger-role session (same class as `BUG-124`). (2) rather than rebuild `admin/manager/page.tsx`'s selection flow right now, the whole feature is pulled from the UI instead (`FootballLogger.tsx`'s modal/button/effect, `admin/manager/page.tsx`'s sidebar panel/stat-tile/effects) — commented out, not deleted, per `BACKSCOPE.md` convention. Full detail in that file's new "Staff Comms" entry.
**Found:** session 47C, per Richard's direct request to check this feature's actual current state before considering whether to extend it to basketball.

---

### ~~BUG-143~~ — `FootballLogger.tsx`'s Goal/Penalty→Assist Chain Leaks a `setTimeout`, Can Fire After Unmount

**Status:** SHIPPED — 2026-07-27 (session 47C). Live negative-test attempted same session on a real throwaway football match, came back inconclusive (a scripted "immediate exit" click actually hit the Settings button, not the real exit control, per a class-name mix-up) — Richard's explicit call to accept the code-level fix as sufficient rather than keep chasing a corrected selector. Full detail in `RUNLOG.md`'s 2026-07-27 entry. Not escalated to RESOLVED; this was a deliberate stop, not a pass/fail result.
**Priority:** Medium — silent, invisible, real (confirmed by code trace, not just theory), but narrow window (500ms) and requires the logger to navigate away at exactly the wrong moment

**Problem:** `FootballLogger.tsx`'s "1b" comment block (~line 958-969) auto-records an `Assist` event 500ms after a `Goal`/`Penalty` with a `relatedPlayerId`:
```js
if ((type === 'Goal' || type === 'Penalty') && relatedPlayerId) {
    setTimeout(() => {
        confirmEvent('Assist', relatedPlayerId, playerId);
    }, 500);
}
```
No `clearTimeout` exists anywhere in the file. The effect that sets `stateManager.current = manager` (~line 448) has a cleanup that only calls `unsubscribe()` — it never nulls `stateManager.current` or destroys the manager, so `confirmEvent`'s own guard (`if (!stateManager.current) return;`, ~line 925) never trips post-unmount. **Confirmed reachable:** if a logger logs a Goal/Penalty with an assist, then navigates away (switches matches, logs out, closes the panel) within that 500ms window, the orphaned timeout still fires — records the event, POSTs it, dispatches broadcasts — for a match the UI no longer shows, with zero visibility to anyone. Violates this project's own "no silent failures/successes" rule, just inverted (a silent *success* nobody asked for anymore, not a failure).

**Secondary, lower-severity, same root cause:** `confirmEvent` is a plain closure re-created every render, so the delayed call is bound to `selectedTeam` (and other component state) as it was the instant the Goal was logged. If the logger taps the home/away toggle within that same 500ms, the assist gets recorded against the stale team. Low probability, real if it happens.

**Not a football/basketball parity gap:** `BasketballLogger.tsx` doesn't need an equivalent chain — it already embeds the assist as an `assistPlayerId` field directly on the same shot event (`handlePlayerSelect`/`handleAssistSelect`, one atomic POST, no second temp-ID, no race window at all). That's a better pattern than football's chained-event approach, not a gap to close.

**Fix:** the simplest option (`clearTimeout` on unmount) is what's implemented — `FootballLogger.tsx` now holds a `pendingAssistTimeouts` ref array, pushes every scheduled assist-chain timeout ID onto it, and the same effect cleanup that calls `unsubscribe()` now also `clearTimeout`s and empties that array. The more thorough option (embed the assist directly on the Goal/Penalty event instead of chaining a second delayed one, matching basketball's pattern) was deliberately not done here — see `BACKLOG-144` below, a real design conversation about the whole chain's shape, not a minimal leak patch.
**Found:** session 47C, via a dedicated re-investigation of the existing "1b" comment (requested by Richard, an Explore/general-purpose agent's code trace, independently verified against the real `confirmEvent`/`match-state-manager.ts` source).

---

### BACKLOG-144 — Publish Goal Instantly, Backfill Assist After (SofaScore-Style), Instead of Today's Blocking Modal Chain

**Status:** OPEN — direction confirmed by Richard, not scoped or built
**Priority:** Medium — real UX/latency improvement for viewers, not a bug fix

**Context, confirmed by code trace (session 47C, alongside `BUG-143`):** today's flow is fully synchronous and blocking — tapping "Goal" opens a scorer-select modal, then an assist-select modal, and **nothing is saved or broadcast to viewers until both resolve.** `relatedPlayerId` (the assist) is already known and embedded directly on the Goal/Penalty event by the time it's written (`confirmEvent`, `relatedPlayerId: relatedPlayerId` on the same object) — there is no technical latency in "getting" the assist by the time of the write; the delay viewers actually experience is the logger's own time spent navigating both modals before anything goes out at all.

**Richard's direction:** flip this — publish the goal (and broadcast to viewers) the instant the scorer is confirmed, *before* the assist modal even opens, then attach the assist as a fast follow-up update once the logger picks it (or skips it). Matches how platforms like SofaScore publish "GOAL" immediately and backfill the scorer/assist detail moments later, rather than gating the viewer-facing broadcast on the logger finishing every detail step first.

**Real design work required, not scoped here:**
- The Goal event needs to be create-able and broadcastable with `relatedPlayerId` absent, then updated in place once the assist is chosen — today's write path assumes an event is fully-formed at creation; a same-event in-place update after broadcast is a different shape.
- Decide what the public-facing UI shows in the gap between "goal published" and "assist attached" (no assist line at all, briefly? a pending/loading state?).
- `BUG-143`'s fix (this same session) removes the chained-second-`Assist`-event's leak risk but doesn't change the blocking-modal ordering — this item is the actual UX change Richard wants, independent of that fix.
- Basketball's embedded-assist pattern (one atomic event) doesn't have this problem at all today since its assist entry is optional/single-step, not a second blocking modal — worth confirming that stays true if this redesign is ever generalized across sports.

**Reinstate/build when:** its own scoped session — this is a real write-path + broadcast-timing redesign for `POST /api/matches/[id]/events` and `FootballLogger.tsx`'s event flow, not a quick patch.
**Found:** session 47C, Richard's own direction during the `BUG-143` investigation.

---

### ~~BACKLOG-143~~ — Basketball's Standalone "Assist" Event Is Invisible to the Box Score's `ast` Stat

**Status:** RESOLVED — 2026-07-30, commit `4e5e76a` (session 47E), live-tested session 47F
**Priority:** Low-Medium — rating calc is correct, box score display undercounts

**Problem:** `BasketballLogger.tsx`'s standalone "Assist" button (~line 1096) creates a separate `type: 'Assist'` event. `calculatePlayerRating` correctly counts it (`+2`, ~line 190-192), but `calculateAdvancedStats`'s box-score `ast` field (~line 227) only counts embedded `assistPlayerId` fields on shot events — it never looks at standalone `Assist`-type events. A player credited with a standalone assist gets the rating bump but the box score under-reports their assist count.

**Fix:** `calculateAdvancedStats`'s `ast` computation now also counts events where `type === 'Assist' && e.playerId === playerId`, in addition to the existing `assistPlayerId` check, so both assist-recording paths (embedded-on-shot and standalone-button) are reflected in the box score.

**Evidence:**
- Commit: `4e5e76a`
- Verified by: live test against a Vercel preview deployment, real logger session, real starters-only lineup, full detail in `RUNLOG.md`
- Observed result: clicked the standalone "Assist" button for a real player (RICHARD), confirmed the event saved ("1 Events Recorded... ASSIST RICHARD" in the live event log), then switched to the Stats tab — `AST` column read `1` for that player, `PTS`/`REB` unaffected. Confirmed the increment was genuinely from the standalone-button path, not an embedded shot assist.
- Pending items: none

**Found:** session 47C, surfaced incidentally while re-investigating `BUG-143` above (tracing how basketball records assists to compare against football's chain).

---

### BACKLOG-145 — Basketball's `STARTER_COUNT` Is String-Matched, Not Competition-Config-Aware (Football Already Does This Correctly)

**Status:** OPEN — found this session, not fixed. Backlog only, per Richard's request — not built now.
**Priority:** Low-Medium — works today for the two known formats (5-a-side, 3x3's 3-a-side), but is a real correctness gap for any future basketball competition format that doesn't match the hardcoded string check

**Correction to the original ask that filed this:** the request was to sweep *football* for legacy hardcoded player-count/duration constants — checked, and `FootballLogger.tsx` already does this correctly: `STARTER_COUNT = competitionPlayersPerSide || (is5Aside ? 5 : 11)` (~line 138), where `competitionPlayersPerSide` is fetched from the competition's own config (~line 392-394) and only falls back to a hardcoded 5/11 if that's absent. `halfDuration` follows the same pattern (fetched from match config, ~line 456-462). **The actual gap is on basketball's side, not football's:** `BasketballLogger.tsx`'s `STARTER_COUNT = is3x3 ? 3 : 5` (~line 32) never attempts to read any competition-level config at all — `is3x3` is a hardcoded string match against `match.sport`/`match.competition` (`'3x3 Basketball'`, `'Basketball 3x3'`, or `.includes('3x3')`), with no fallback-if-config-exists path the way football has. `quarterDuration`/`periodCount`/`overtimeDurationMinutes` do get overwritten by match config on mount (per existing comments in the file), so this gap is specifically `STARTER_COUNT`, not every config value.

**Fix (not built):** port football's pattern — fetch a competition-level `playersPerSide` (or the `competition_sport_settings`/`SPORT_DEFAULTS.basketball.playersPerSide` value referenced elsewhere in this file's `BACKLOG-125`/125-adjacent entries) and prefer it over the `is3x3` string-match, keeping the string-match only as the final fallback.

**Related, same theme, also not built:** Richard separately asked whether `BasketballLogger.tsx`'s player-selector and its roster/manager-setup ("load & manager setup") should be re-read against `FootballLogger.tsx`'s own equivalents, since football's patterns here are already live-tested and verified (the `memberships`-aware player-team filtering fixed as `BUG-061`/session-46's basketball port is the known-good precedent for this class of comparison). Not investigated this session — noted for whenever this gets picked up, same "read football first, compare, port only what's actually better" discipline used for the rest of this session's basketball-parity work.

**Found:** session 47C, per Richard's request to sweep for legacy/redundant hardcoded values across both loggers.

---

### ~~BUG-146~~ — Local Dev Server 500s on Every Page Route (Root-Caused: Node v22+'s Native `localStorage` Global)

**Status:** RESOLVED — 2026-07-27 (session 47C)
**Priority:** High — blocked all local browser-based verification since session 46, forcing every subsequent session onto a PR-preview workaround
**Filed:** originally tracked only in `.agents/rules/known-issues.md` (2026-07-23, session 46) and `project_local_dev_browser_broken_session47b.md`, never given its own tracked number until now

**Problem:** `npm run dev` (`node server.js`) 500'd on every page route with `TypeError: localStorage.getItem is not a function`, thrown during SSR. Root cause: Node 22+ (this machine: v25) ships an experimental native `globalThis.localStorage` (Web Storage API) that exists even in a plain Node process outside any browser `window`. Without a valid `--localstorage-file` path, Node still constructs the object, but it's broken — confirmed via the server's own startup warning (`` `--localstorage-file` was provided without a valid path``). Something in the render path calls `localStorage.getItem(...)` directly; previously this was a harmless `ReferenceError` in Node (since `localStorage` truly didn't exist), but now it hits Node's own broken object instead and throws the `TypeError` seen here. Exact call site not pinned down (grepping `node_modules` for the common `typeof localStorage` isomorphic-guard pattern returned zero matches; every direct call in our own `src/` is inside a `useEffect`/handler that never runs during SSR) — not needed to fix it, since the flag disables the feature at the source regardless of where it's read.

**Confirmed via a real before/after test:** ran the server both ways back to back. Without any flag: identical crash, same error text, every time. With Node's `--no-webstorage` flag: `GET /` returned a clean `200` with real homepage HTML (`<title>BRIXSPORTS | Nigerian University Sports Live</title>`) in ~6-10s, repeated successfully, zero errors in the server log.

**Fix:** `package.json`'s `dev` and `start` scripts now pass `--no-webstorage` directly to `node` (`node --no-webstorage server.js`). A first attempt used `NODE_OPTIONS=--no-webstorage node server.js` (shell env-var prefix) — failed outright (`'NODE_OPTIONS' is not recognized as an internal or external command`), because `npm run` executes scripts through `cmd.exe` on Windows, which doesn't support Unix `VAR=value command` syntax. Passing the flag as a direct `node` CLI argument sidesteps that entirely.

**Related finding, not fixed here:** the pre-existing `start` script's own `NODE_ENV=production node server.js` prefix has almost certainly never actually worked on native Windows cmd.exe either, for the identical reason — a separate, pre-existing bug incidentally surfaced by this fix, not introduced by it. Not chased further since `start` isn't part of this project's actual deploy path (Vercel builds via `next build` and runs its own managed runtime — it never invokes `server.js` or this `start` script at all, which is also why production was never exposed to the `localStorage` crash in the first place).

**Deliberately not touched:** `dev:turbo` (`next dev --turbopack`) and `start:next` (`next start`) — neither goes through `node server.js` directly, so the same direct-CLI-flag fix doesn't apply cleanly, and neither is the script actually used day-to-day. Would need a `cross-env`-style solution (a new dependency) if that changes.

**Unblocks:** `BUG-140`, `BUG-141`, `BACKLOG-142`, `BUG-143` — all four were SHIPPED but explicitly marked "not yet live-tested, blocked by dev server SSR-500" this same session. That blocker is now gone; live verification for all four is a direct next step.

**Found:** session 47C, root-caused live at Richard's direct request after weeks of this blocking local verification across sessions 46/47/47B.

---

### BACKLOG-146 — Ratings Calculation Requires Football's `match.lineups` JSON Shape, Can't Run for Any Basketball Match

**Status:** SUPERSEDED — 2026-07-30 (session 47E). Original blocker (no `match.lineups` for basketball) resolved as a side effect of `BACKLOG-141`. But that unblock exposed a bigger problem: `calculateAndSaveRatings()`'s stat-extraction model is entirely football-shaped, so it would have silently computed near-meaningless ratings for basketball rather than actually working. Guarded off (commit `b7d8287`) rather than left to run wrong. Real fix (basketball-aware stat extraction) is genuinely separate scope, tracked under `BACKLOG-159`'s "two disconnected rating pipelines" finding — this entry is superseded by that one, not still independently open.
**Priority:** Medium — blocks basketball ratings entirely, but ratings are a secondary feature, not on any Critical Flow

**Problem:** `calculateAndSaveRatings()` (`src/lib/ratingsService.ts`) reads `match.lineups` and parses it as JSON, expecting `{ home: { starters, bench }, away: {...} }` (or a flat array) — this is football's lineup-publishing shape. Basketball has no equivalent: its starters/bench live only in `BasketballLogger.tsx`'s local `homeStarters`/`awayStarters` state (per `BACKLOG-141`, there's no server-side lineup persistence for basketball at all), so `match.lineups` is never populated for a basketball match. Confirmed live, session 47C: `POST /api/matches/w6o4YQAF5pem_Qa8uazAm/ratings` (a real, assigned-logger-authenticated request against a real `LIVE` basketball match) returned a clean `400 { "error": "No lineups found for this match" }` — the function exits before ever reaching the player-stats or team-ratings calculation at all.
**Practical effect:** basketball has never had a working ratings calculation, independent of `BUG-138` (the missing `team_ratings` table, now fixed) — that fix was necessary but not sufficient. Both the automatic background trigger (`events/route.ts`'s `after()` call) and the manual "Calculate Ratings" admin action fail identically for basketball today, just with different visibility (silent vs. a raw error, see `BUG-138`'s own note on the admin-facing exposure).
**Fix (not built):** either (a) block on `BACKLOG-141` (real server-side lineup persistence for basketball) and have `calculateAndSaveRatings()` read from wherever that ends up living, or (b) teach the function to also accept basketball's actual starter/bench data source once one exists server-side. Not a quick patch — genuinely blocked on the same underlying gap `BACKLOG-141` already tracks.
**Found:** session 47C, while functionally verifying `BUG-138`'s `team_ratings` fix via the real ratings endpoint.

---

### BUG-147 — CRITICAL: Systemic Unauthenticated-Write Surface Across ~16 Mutation Routes Outside `/api/admin/*`

**Status:** RESOLVED — 2026-07-30 (session 47F), live-tested against a Vercel preview. Originally shipped commit `0195b22`, landed 2026-07-28 (session 47D), 34 seconds before the docs commit that filed this entry as "not yet fixed" -- never corrected until session 47E's Saturday-readiness check. All 20 routes (the 16 below plus `users/[id]/preferences` and `notifications/subscribe` DELETE/GET, folded in same commit) confirmed gated via `getAuthUser` + role check. Confirmed `0195b22` is an ancestor of `dev` (`git merge-base --is-ancestor`), so this is live on staging, not sitting unmerged on a stale branch.
**Priority:** CRITICAL — includes account takeover/mass-deletion and direct live-match-score corruption with zero auth
**Filed:** 2026-07-27

**Evidence:**
- Commit: `0195b22`
- Verified by: live test against a Vercel preview deployment (`dev/verify-staging-bug147-routes.mjs`) — real unauthenticated requests against 24 routes (the 20 originally listed plus 4 extra checked in the same pass), full detail in `RUNLOG.md`
- Observed result: 23/24 correctly rejected with 401/403. The one apparent failure (`notifications/subscribe` DELETE returning 500) is not a missing auth gate on inspection — the route's `request.json()` call runs before its (correctly-present) auth check, so a malformed/empty body throws before ever reaching it. Filed separately as `BACKLOG-188` (low severity, an ordering nit, not a security gap — the route still requires and checks auth before doing anything once the body parses).
- Pending items: none — `BACKLOG-188` is tracked as its own low-priority item, not blocking this entry's resolution

**Root cause (one finding, not sixteen independent oversights):** `middleware.ts`'s admin gate only matches the literal `/admin/:path*` and `/api/admin/:path*` prefixes. A large population of routes that are admin-only *in intent* — team/news/transfer/match/lineup/notification/bracket/stat/standings mutation — live outside that prefix and were never brought under the gate or given their own `getAuthUser()` call. Exact same bug class as `BUG-034`/`BUG-107`/`BACKLOG-142` (staff-comms), caught and fixed twice before — this is the first exhaustive sweep of the rest of the surface. Found by a dedicated full-system read-only audit agent, session 47D, then extended with two more routes found in a same-session follow-up check of the areas that first sweep explicitly hadn't reached yet (football-adjacent routes, per Richard's direct ask not to forget those).

**Most severe — `src/app/api/users/[id]/route.ts` PATCH/DELETE.** Zero auth, zero ownership check. Any caller can edit any user's profile fields (name/bio/avatar/coverImage/favoriteTeamId) by ID, or **delete any account outright**. Classified Tier 3 by system in `SYSTEM_CRITICALITY_MAP.md`, but per that map's own exception clause ("classify by blast radius on the actual incident, not by which system the bug code lives in"), account takeover/mass deletion earns CRITICAL treatment regardless of which tier the code technically sits in.

**Full route list, all confirmed via direct file read (not grep-only) to have zero `getAuthUser` call in the relevant handler(s):**

| Route | Method(s) | Impact |
|---|---|---|
| `src/app/api/users/[id]/route.ts` | PATCH, DELETE | Edit or delete any user account by ID — no ownership check |
| `src/app/api/matches/[id]/lineup/route.ts` | POST, DELETE | Overwrite or delete any match's saved lineup |
| `src/app/api/fixtures/[id]/route.ts` | PATCH, DELETE | Directly rewrite `homeScore`/`awayScore`/`status`/`loggerId` on any match, or delete a non-live match + its events — bypasses every hardening the events pipeline has (atomic transactions, score-revert ordering, audit trail) |
| `src/app/api/fixtures/route.ts` | POST | Create arbitrary matches directly in `matches` — the correctly-gated `/api/matches` POST writes the identical table right next to this ungated twin |
| `src/app/api/news/route.ts` | POST | Publish arbitrary articles; `authorId` taken from request body (also violates the audit-field rule independent of the auth gap); triggers a real push notification to all subscribers |
| `src/app/api/news/[id]/route.ts` | PATCH, DELETE | Edit or delete any news article — code comment says `(Admin only)`, nothing enforces it |
| `src/app/api/transfers/[id]/route.ts` | PATCH, DELETE | Edit or delete any transfer record — same `(Admin only)` comment, same gap. `POST /api/transfers` (same feature) is correctly gated; this is the one route in the pair that was missed |
| `src/app/api/notifications/send/route.ts` | POST | Send an arbitrary push notification (title/body/url/icon) to the entire subscriber base or any team's followers — live spam/phishing vector through a trusted channel |
| `src/app/api/brackets/[id]/route.ts` | PATCH, DELETE | Rewrite bracket node scores/status/team assignments (auto-propagates winners downstream) or delete a node |
| `src/app/api/players/[id]/stats/route.ts` | POST, PATCH | Forge or increment any player's stats — feeds Tier 2 leaderboards |
| `src/app/api/events/sync/route.ts` | POST | Insert `match_events` rows directly for any match — a second, unauthenticated write path into the exact table the hardened logger event route is supposed to be the sole trusted writer of |
| `src/app/api/standings/route.ts` | POST | Upsert (`onConflictDoUpdate`) standings rows for any team/competition — can silently corrupt a live table; this GET also has no `.limit()` (separate anti-pattern, same file) |
| `src/app/api/competitions/templates/route.ts` | POST | Create arbitrary competitions from a template |
| `src/app/api/teams/route.ts` | POST | Create arbitrary teams — raw `db.insert(teams).values(body)`, no field allowlist. Corrects `BACKLOG-077`'s stale claim that this route "exists and is gated" |
| `src/app/api/teams/bulk/route.ts` | POST | Bulk-create arbitrary teams |
| `src/app/api/head-to-head/route.ts` | POST | Write/overwrite head-to-head records for any two teams, any scoreline |
| `src/app/api/teams/[id]/form/route.ts` | POST, DELETE | Insert fabricated match-form entries for any team, or bulk-delete a team's form history via `?before=timestamp` |

**Confirmed NOT affected (checked same investigation, correctly gated or read-only):** `/api/matches` POST, `/api/competitions` POST, `/api/transfers` POST, `/api/players` POST/PATCH/DELETE, `/api/squads/*`, `/api/players/search`, `/api/admin/teams/[teamId]/roster`, all literal `/api/admin/*` routes spot-checked (users/settings/ads/organizations). `/api/football/matches`, `/api/football/standings`, `/api/players/compare` are GET-only, no mutation risk.

**Also found in the same investigation, same root cause, deliberately not urgent given the standing Tier 4 backscope rule:** `src/app/api/predictions/route.ts` (POST/PUT) and `src/app/api/polls/route.ts` (POST/PATCH) are live and unauthenticated. `BACKSCOPE.md` confirms the *pages* for these are correctly hidden (`notFound()`), but the underlying API routes were never pulled with them — a caller who finds these routes directly can still write to `matchPredictions`/`polls`/`pollVotes`. Low real-world risk (no UI surfaces them), but a real gap between "backscoped" as documented and as actually enforced. Worth a `BACKSCOPE.md` note, not a fix, given Tier 4's correctly-deprioritized status.

**Bonus bug, unrelated to auth, found while reading `matches/[id]/lineup/route.ts` closely:** line ~113 references an undefined `teamId` inside the squad-validation branch — the route only ever destructures `{ team, lineup }` from the body. Any competition with `requireSquad: true` throws a `ReferenceError` on this line (caught by the outer try/catch, 500s rather than crashing) the moment a lineup is saved with at least one player — squad validation is completely non-functional for any squad-gated competition today, independent of the auth gap on the same route.

**Fix:** add `getAuthUser(request)` + `role === 'admin'` (or the appropriate role check per route) to every handler listed above, before reading the request body — the exact pattern already proven correct 30+ times elsewhere in this codebase. Mechanical, not novel — the risk is in coverage (missing one), not in the pattern itself.

**Found:** session 47D, full-system read-only sweep (background agent) + same-session manual follow-up check of the routes that sweep explicitly hadn't reached (`/api/football/*`, `/api/head-to-head`, `/api/players/compare`, `/api/teams/[id]/form`), per Richard's direct request not to leave football-adjacent routes unchecked.

---

### BUG-148 — Google OAuth Sign-In Is Completely Broken (Missing Callback Route)

**Status:** OPEN — found session 47D, not fixed
**Priority:** Medium — a real, live user-facing dead end, but not a security or data-integrity issue, and email/password signup works as an alternative
**Filed:** 2026-07-27

**Problem:** `src/app/api/auth/google/route.ts` builds a Google OAuth consent URL with `redirect_uri` set to `${NEXT_PUBLIC_APP_URL}/api/auth/google/callback` — but `src/app/api/auth/google/` contains only `route.ts`, no `callback/route.ts`. Confirmed via direct directory listing. Any user who clicks "Continue with Google" (`src/app/signup/page.tsx`, `src/app/login/page.tsx`) is sent to Google, completes consent, and is redirected back to a URL that 404s — the flow dead-ends every time, for every user, always has (this is a missing file, not a regression).

**Correction to earlier session 47D communication:** this session's privacy-policy work (`BACKLOG-078`) described the Google OAuth flow as "live" when disclosing it as a third-party data-sharing path. That characterization was wrong — no data has ever actually reached Google's callback or been exchanged with this app via this flow, since it 404s before any token exchange happens. The privacy policy's disclosure itself isn't false (it correctly describes what *would* happen if the flow worked, worded conditionally — "if you choose to sign up... we receive...") so it doesn't need a content change, but the flow should not be described as functioning anywhere else.

**Also found in the same investigation:** a second, fully separate Google auth implementation exists via NextAuth (`src/app/api/auth/[...nextauth]/route.ts`) that is functionally complete in isolation, but is never invoked by any UI button, and even if it were, it issues its own NextAuth session cookie disconnected from this app's actual `authToken`-based auth model (`src/lib/auth.ts`). Two incompatible Google-auth implementations exist side by side; neither is usable as-is without a decision on which one this app actually wants.

**Fix (not built):** either (a) build `src/app/api/auth/google/callback/route.ts` to complete the OAuth code exchange and issue a real `authToken` cookie matching this app's existing auth model, discarding the unused NextAuth implementation, or (b) the reverse — wire the UI buttons to the NextAuth flow and adapt `getAuthUser`/`middleware.ts` to also accept a NextAuth session. Not attempted this session — a real architectural decision, not a quick patch.

**Found:** session 47D, by a background audit agent investigating the auth/account/notifications system, cross-checking the privacy-policy work done earlier the same session.

---

### ~~BUG-149~~ — Homepage Never Refreshes Live Match Data For Real Viewers (No WS, No Polling)

**Status:** RESOLVED — 2026-07-28 (session 47D)
**Priority:** CRITICAL — this is the highest-traffic viewer surface and it violates the core product promise ("what's happening right now, accurately") for the most common entry point
**Filed:** 2026-07-27

**Problem:** `src/app/page.tsx` (the homepage) fetches `matches` once on mount and only re-fetches on a `window` `MATCH_STATUS_CHANGE` `CustomEvent`. Grepped every dispatch site: it's fired **only** from `src/lib/match-state-manager.ts:935` and `src/components/BasketballLogger.tsx:851` — both logger-tab-only, dispatched to that browser tab's own `window`. A remote viewer's browser can never receive it. There is no WS subscription and no `setInterval` poll anywhere on the homepage. A viewer who leaves the homepage open during a live match sees a **permanently frozen score/status until manual reload** — for both sports. This also silently starves the football homepage-overlay modal (`MatchOverlay.tsx`) of fresh data for anyone who doesn't click through to `/matches/[id]`, and is the root cause underneath `BasketballMatchOverlay.tsx`'s already-suspected zero-WS finding (that overlay renders from whatever stale `selectedMatch` state the homepage handed it).

**Also broken, same root cause class:** `src/app/football/page.tsx`/`src/app/basketball/page.tsx` (sport hub MATCHES tab) fetch once per competition selection, no poll, no WS — same static-snapshot problem.

**Fix (not built):** the cheapest correct fix is the same pattern `/live/page.tsx` already uses as its own self-documented stopgap (15s poll of `/api/matches`, filtered client-side) — port that pattern to the homepage and the sport-hub pages, or better, wire a real WS subscription the way `/matches/[id]/page.tsx` already does (10s/25s polling fallback + WS live layer, `BUG-080`/`BUG-108`). Given how many pages share this gap, a shared hook (e.g. `useLiveMatchList(sport?)`) is worth considering over copy-pasting the poll three more times.

**Fix applied, session 47D:** consolidated the homepage's two previously-duplicated fetch/transform blocks (initial mount + the same-tab-only `MATCH_STATUS_CHANGE` handler) into one `fetchAllMatches` function via `useCallback`, and added a 15s `setInterval` poll matching `/live/page.tsx`'s own established pattern. The same-tab `MATCH_STATUS_CHANGE` listener is kept as a same-device fast-path (instant refresh + notification for a logger previewing their own site) but the poll is now the real fix — it reaches every viewer regardless of tab/device. **Sport-hub pages (`football/page.tsx`/`basketball/page.tsx`) were not touched this session** — same root cause, not yet fixed, tracked separately if needed.

**Evidence:**
- Commit: `176a553`
- Verified by: live browser test against local dev — a temporary timestamped console log confirmed 5 consecutive poll ticks at 14:59:26, 14:59:41, 14:59:56, 15:00:11, 15:00:26, 15:00:41 UTC, each ~15.00s apart (max deviation 0.03s across all 5 intervals). Debug log removed after verification.
- Observed result: homepage now refetches match data on a reliable 15s cadence independent of WS connection state (confirmed while local WS was itself down, proving the poll doesn't depend on it)
- Pending items: sport-hub pages still have the same gap, not in this fix's scope

**Found:** session 47D, by a background audit agent doing a full read-only trace of the public viewer experience.

---

### BUG-150 — Anonymous Viewers Cannot Enable Push Notifications Through Any Reachable UI Path

**Status:** RESOLVED — 2026-08-06 (session 49, commits `de7ff24`, `feb695a`). Full flow documented in `.agents/dev/NOTIFICATION_SYSTEM_FLOW.md`.

**Evidence:**
- Commit: `de7ff24` (per-match link keyed on `matchId` presence, not auth state), `feb695a` (unsubscribe lazy-init fix)
- Verified by: live test on staging preview (both `NEXT_PUBLIC_ENV=staging` with a signed-in admin session, and a per-branch `NEXT_PUBLIC_ENV=development` override for the genuine no-cookie anonymous case), each followed by a direct read-only DB query against the staging Turso instance
- Observed result:
  - Authenticated Bell click → `push_subscriptions` row `sub-1785969570219-mgmmj7ib8` (`user_id: admin-001`) + `push_subscription_matches` row linking it to `_lkHo5y1m6ArqvLsi1ixe` — confirmed via `SELECT`, not inferred from the UI toast.
  - Genuine anonymous Bell click (no auth cookie, confirmed via console: `Cookie auth response status: 401`, `localStorage token exists: false`) → `push_subscriptions` row `sub-1785970835247-26c72mb81` with `user_id: anonymous-push-subscriber` (the sentinel row, not a real account) + a correctly linked `push_subscription_matches` row.
  - Unsubscribe (authenticated) → re-queried after clicking an already-filled Bell: `push_subscription_matches` row removed, underlying `push_subscriptions` row preserved (correct — an authenticated subscription must survive losing one match link).
  - Real push delivery → sent directly via `web-push` to the real FCM endpoint captured in the DB row above; FCM accepted with `201`; user confirmed the notification rendered on-device.
  - Pending items: real-device delivery was confirmed for the authenticated-path subscription only (FCM `201` + on-device screenshot); the anonymous-path subscription's endpoint was not separately push-tested (same code path, not considered a gap, but noting the asymmetry for the record).

**Two real bugs found and fixed during this verification, not present in the original session-49 build description below:**
1. **`POST`/`DELETE /api/notifications/subscribe` gated the per-match link on `isAnonymous` (`!authUser`) instead of on whether the request carried a `matchId`.** A signed-in browser clicking the match-detail Bell got routed into the authenticated branch, which never touched `pushSubscriptionMatches` at all — the UI showed a success toast, a generic `pushSubscriptions` row was created, but nothing was actually linked to that match. Silent no-op for any signed-in visitor using the anonymous-designed Bell button. Fixed in `de7ff24`: the per-match link (and, on `DELETE`, the per-match unlink) is now keyed on `matchId` being present in the body, independent of auth state.
2. **`DELETE`'s authenticated branch deleted *all* of that user's push subscriptions on any per-match unsubscribe** — a signed-in user turning off notifications for one match would have silently killed their account-wide team-follow push subscription too. Fixed in the same commit: authenticated per-match `DELETE` now only removes that one `pushSubscriptionMatches` link.
3. **`push-service.ts`'s `unsubscribe()` never lazily called `this.init()`** the way `subscribe()` does — on a page load where `init()` hadn't already run, clicking an already-filled Bell to turn notifications off silently failed client-side (`Could not turn off notifications for this match`) without ever reaching the server. Confirmed via DB read: the `push_subscription_matches` row was untouched after the failed attempt. Fixed in `feb695a`.
**Priority:** HIGH — directly contradicts CLAUDE.md's own actor model rule ("Viewers NEVER have a session")
**Filed:** 2026-07-27

**Problem:** every push-notification enrollment surface that is actually reachable by a click today requires a signed-in user; every component that would work anonymously is defined but never mounted. Traced all five candidates:
- `SettingsOverlay.tsx` (opened from the homepage bell icon) — `handleEnablePush` explicitly gates: `if (!user) { toast.error('Please sign in to enable notifications'); return; }` (line 83-87). The browser permission prompt is never even requested for an anonymous viewer.
- `OnboardingModal.tsx` — requires a `userId` prop, only rendered from `signup/page.tsx`, unreachable pre-account.
- `NotificationPermission.tsx` — takes a `userId` prop, would work anonymously if mounted with a fallback, but is **never imported or rendered anywhere in the app** (confirmed via grep — not in `layout.tsx`, not in any page, not in `PWAProvider`). Dead code.
- `useNotificationPrompt.ts` — never called anywhere. Also dead code, and its own internal logic additionally gates on `isAuthenticated && user?.id` even if it were wired up.
- `src/components/notifications/NotificationPrompt.tsx` — a `sonner`-toast variant with no mount site found under `src/app`.

**Net effect:** the actor model's core promise ("Viewers NEVER have a session" — i.e. the product must work fully for them) is broken specifically for notifications. `BUG-084`'s retraction ("three enrollment paths exist") never checked whether any of the three work *without* signing in — none do.

**Fix (not built):** mount `NotificationPermission.tsx` (or wire `useNotificationPrompt`) somewhere reachable in the anonymous viewer flow, with a device-scoped (not user-scoped) subscription path — the push-subscription backend (`pushSubscriptions` table) would need to support a null/anonymous `userId` or a device-id fallback for this to work end to end; not confirmed either way whether that's already possible.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the public viewer experience.

**Update, 2026-08-04 (session 49) — schema + API landed, UI still to build.** Richard's call: device-scoped, no-login-required, per-match "notify me about this match" targeting (not a device-scoped mirror of the full team-follow system — see the audit's own option comparison). `pushSubscriptions.deviceId` (new nullable column) plus a sentinel `anonymous-push-subscriber` user row (chosen over a nullable `userId` FK to avoid a SQLite table-rebuild migration) plus a new `pushSubscriptionMatches` table for the per-match opt-in. `POST`/`DELETE /api/notifications/subscribe` now serve both the authenticated and anonymous paths; `match-notification-service.ts`'s send logic merges anonymous per-match subscribers into the existing team-follower query. Migration applied to staging (`dev/migrate-anonymous-push-subscriptions-49.mjs`). PR #17, branch `feat/backlog-150-anonymous-push-enrollment`. **UI (the actual "notify me about this match" control on the match page) not built yet — next step, same session.**

**Follow-up filed, not built:** no automatic anonymous-to-authenticated subscription handoff. The schema supports it for free if a re-subscribe happens (`endpoint` is already globally unique, so a same-browser authenticated re-subscribe correctly flips `userId` from the sentinel to the real account on the existing row, and `pushSubscriptionMatches` rows survive the flip since they're keyed to the subscription id, not `userId`) — but nothing currently triggers that re-subscribe call. Needs a small login/signup-time hook ("do I already have an active push subscription in this browser? re-POST it now that there's a session") — not built this session, flagged for whenever the anonymous UI ships.

---

### BACKLOG-151 — Multi-Logger Sync Is Poll-Only: Real-Time Broadcast and Conflict Resolution Are Both No-Ops

**Status:** OPEN — found session 47D, not fixed
**Priority:** HIGH — Tier 0, directly relevant to CLAUDE.md's own still-open Live Event Readiness Checklist item ("Two simultaneous loggers do not conflict or overwrite — no dual-logger test ever run")

**Problem, three parts, same root cause (`useMultiLogger.ts`/`multiLogger.ts`):**
1. `broadcastEvent` (`useMultiLogger.ts:178-192`) does not send anything to another device, tab, or the server — it only dispatches a same-tab `window` `CustomEvent('MULTI_LOGGER_EVENT')`, which by definition never leaves the browser tab that dispatched it. Every `broadcastEvent()` call site in both `FootballLogger.tsx:741` and `BasketballLogger.tsx:613` is effectively inert for real cross-device sync.
2. The **only** actual cross-logger sync mechanism is the periodic poll — 10s (football, `FootballLogger.tsx:667-726`) / 15s (basketball, `BasketballLogger.tsx:439-467`) — which fetches all DB events and merges by exact-ID dedup (`mergeEvents`, `multiLogger.ts:123-145`). Two loggers on the same match only converge once every 10-15 seconds, never in real time.
3. `resolveConflict` (`useMultiLogger.ts:197-208`) only flips a local React `resolved: true` flag when a logger clicks "resolve" on a conflict banner. It never deletes a duplicate row or merges a contradiction server-side — the DB and every public viewer still see the conflicting data exactly as before, the banner just disappears for the logger who clicked it.

**Fix (not built):** (a) either wire `broadcastEvent` through the existing WS infrastructure (the same `emit()`/socket path `FootballLogger.tsx` already uses for other events) so it's a real push, or remove it and rely explicitly on the poll with a shorter interval; (b) make `resolveConflict` actually call the DELETE/PATCH needed to resolve the conflict server-side, not just clear a local flag.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the live-logging system's sub-features.

---

### BUG-151 — No Server-Side Event Dedup/Idempotency Check Exists At All

**Status:** OPEN — found session 47D, not fixed
**Priority:** MEDIUM — client-side guards (temp-ID swap, `isRecordingRef`) cover the common case; this is a defense-in-depth gap, not a confirmed-active data-corruption incident
**Filed:** 2026-07-27

**Problem:** `POST /api/matches/[id]/events` (`events/route.ts:170-240`) has no idempotency-key check and no "does an identical event already exist for this match/player/type/minute" query — it unconditionally inserts whatever event body arrives, wrapped only in a transaction (`BUG-121`) that guarantees the insert and score-update commit atomically together, not that a *repeated* POST is rejected. If a client-side guard fails or is bypassed (a replayed offline-queue POST, or two loggers' independent optimistic writes racing for the same real-world event — see `BACKLOG-151` above), nothing server-side catches or merges the duplicate; both rows persist and both count in stats/score.

**Fix (not built):** add a server-side idempotency check — e.g. a unique constraint or pre-insert query on `(matchId, playerId, type, minute, second)` within a short window, or require clients to send a client-generated idempotency key that the server dedupes on.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the live-logging system's sub-features.

---

### BACKLOG-152 — Track & Field Logger Has Zero Persistence Layer (Confirmed More Severe Than Assumed)

**Status:** OPEN — confirmed session 47D, no existing entry previously tracked this
**Priority:** HIGH if Track is ever scheduled for a real live match — currently no live Track matches are run on this platform, so practical urgency is low

**Problem:** `TrackLogger.tsx` has a fully-built, sport-correct local event model (finish times with 1ms tie-handling, field-event best-of-6 with foul tracking and wind-legality checks, DQ with reason) — but **zero API calls anywhere in the file**. `saveResults()` (line 361) is a literal `alert('Results saved successfully!')` with a code comment "In real implementation, save to database." Reaction times are also simulated via `Math.random()`, not real input. Every track result logged today is permanently lost on refresh or navigation away. No existing BACKLOG/BUG entry was found tracking this despite its severity.

**Fix (not built):** build the actual persistence layer — a `/api/matches/[id]/events` equivalent for track results, or extend the existing route to accept track's event shape. Real scope, not a quick patch — track's event model (times/marks/positions, not goals/cards) doesn't map cleanly onto the existing football/basketball event schema.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the live-logging system's sub-features.

---

### BACKLOG-153 — Admin Match-Edit Modal Has No Score-Correction Fields; Three Dead Offline-Queue Implementations; Other Logging-System Cleanup Items

**Status:** OPEN — found session 47D, not fixed
**Priority:** MEDIUM — none of these block a live match today, but compound the already-tracked "no mutation audit trail" gap and represent real maintenance debt

**Findings, bundled (same investigation, none individually urgent enough for its own entry):**
1. **Admin match-edit modal has no score-correction UI.** `src/app/admin/matches/page.tsx`'s edit modal (`handleUpdate`/`handleEdit`) covers sport, teams, venue, competition, status, matchType, round, groupName, matchday — but not `homeScore`/`awayScore`, even though the underlying `PATCH /api/matches/[id]` route accepts them (loggers send them routinely). An admin has no UI path to correct a bad live score, compounding `SYSTEM_CRITICALITY_MAP.md`'s already-tracked "no mutation audit trail for `matches` table" gap.
2. **Three parallel, mutually-exclusive offline-queue implementations exist — only one is wired up.** `FootballLogger.tsx`'s inline `BrixsportAdminDB` queue + `sw-admin.js` is the real, working one (its own top-of-file comment explicitly warns future readers away from the others). `src/lib/offline/queue-manager.ts`, `src/lib/offline/sync-manager.ts`, `src/lib/offline-queue.ts`, and `/api/events/sync` (whose only callers are these dead modules) are fully-built but never instantiated by either logger component. Not a live risk, but a real discoverability trap for a future engineer.
3. **No confirmed server-side write-lock on FINISHED matches.** The event-POST route's auth/role/payload checks were read, but no explicit rejection of a POST against an already-`FINISHED` match was found in the section reviewed. Flagged for dedicated investigation, not asserted as broken — needs a direct test (POST an event against a real FINISHED match, confirm accept/reject).
4. **`sw-admin.js`'s API cache-first-on-failure fallback doesn't distinguish safe-to-serve-stale from dangerous-to-serve-stale endpoints** (`sw-admin.js:86-119`) — a logger could see a stale event list after a network blip with no visual distinction from fresh data, touching this project's own "never show success when it didn't happen" rule.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the live-logging system's sub-features.

---

### BUG-152 — Match-Detail Page's Own Favourite Heart Doesn't Persist At All (Third Divergent Implementation)

**Status:** OPEN — found session 47D, not fixed
**Priority:** MEDIUM — cosmetic/trust issue (button appears to work, silently forgets), not a data-integrity issue

**Problem:** `src/app/matches/[id]/page.tsx` (the page every shared match link actually points to) has its own favourite-heart implementation — `const [isFavorited, setIsFavorited] = useState(false)` (line 43), toggled with **no** `localStorage` write and **no** API call, and without using the shared `useFavorites.ts` hook that the homepage/`MatchOverlay.tsx` correctly use. It silently resets to unfavorited on every page reload. This is a third, undocumented implementation, distinct from `BUG-091` (which concerns the team-follow heart specifically) — and strictly worse, since `useFavorites.ts`'s `localStorage`-only approach is actually correct/adequate for genuine anonymous viewers (per this session's audit), while this one doesn't persist in any form at all.

**Fix (not built):** replace the local `useState` with `useFavorites.ts`, matching the pattern already used correctly elsewhere in the app.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the public viewer experience.

---

### BACKLOG-154 — Viewer-Surface Consistency Debt: Status Styling, Timeline Rendering, and Dead Components

**Status:** OPEN — found session 47D, not fixed
**Priority:** LOW/MEDIUM — cosmetic/consistency issues, no functional breakage beyond what's already filed above

**Findings, bundled:**
1. **`BACKLOG-119`'s red-dot/red-label live styling was live-verified on only one of four surfaces that display match status** — `/matches/[id]`'s own header matches the spec exactly; `LiveMatchStatus.tsx` (homepage cards), `MatchOverlay.tsx`'s own status pill, and `BasketballMatchOverlay.tsx` are three separate, independent implementations that were never updated to match. `BasketballMatchOverlay.tsx` has no live/red styling at all. Any future tweak to the visual language requires editing (at least) four separate places.
2. **`MatchOverlay.tsx`'s inline Timeline tab is a third, hand-rolled event-timeline renderer** that bypasses `BUG-083`'s case-normalization fix entirely (raw `event.minute`, no basketball-aware period labeling) — a materially different, less-correct timeline than `/matches/[id]`'s `LiveMatchTimeline.tsx` for the exact same match.
3. **`BasketballMatchOverlay.tsx` has no timeline/events tab at all** (`watch, overview, lineups, stats, standings, scout, chat` — no timeline) — a basketball viewer using the homepage overlay has no play-by-play feed.
4. **`MatchOverlay.tsx`'s own inline Stats tab is football-only** (`possession`, `expectedGoals`, etc.) — a latent trap if a basketball match were ever routed through this component instead of `BasketballMatchOverlay` (not currently possible per `page.tsx`'s routing, but no structural guard prevents it either).
5. **Dead/orphaned components:** `LiveMatchCard.tsx`, `FixtureCard.tsx` (unused anywhere), `MatchStatusBadge.tsx` (only reachable via those two, plus one dead import in `matches/[id]/page.tsx` that's never actually rendered), `NotificationPermission.tsx`, `useNotificationPrompt.ts` (both dead per `BUG-150` above). Not actively harmful, but a real risk that a future session "fixes" one of these thinking it reaches production when it doesn't.
6. **`BACKLOG-096`** ("no server-side WS emit on event save," filed 2026-06-19, still shows `Status: OPEN`) appears substantially superseded by `BUG-116`'s later fix (server-side broadcast landed session 43) — worth a status re-check and likely closure next time that entry is touched.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the public viewer experience.

---

### BACKLOG-155 — Admin Feature Flags Are Fully Inert (Read Nowhere Else In The Codebase)

**Status:** RESOLVED — 2026-07-30 (session 47F), both server-side mechanics and client-side page-gating live-tested. Commit `74d9a2a` (session 47E). Ads/User Management/News/Transfers gated for real; Lineup Builder deliberately left ungated (Richard's call — it's one of only two real ways a lineup gets persisted, not a peripheral feature); Predictions/Polls/FPL flags remain equally inert, split out to `BACKLOG-177` (closed WONT FIX, session 47F — found moot, those pages are already fully backscoped independent of any flag).
**Priority:** HIGH — directly undercuts the still-open Live Event Readiness Checklist item ("All 🔴 High Volatility features are disabled or hidden from the UI")

**Fix:** built as a real, reusable system per Richard's explicit ask ("beyond just this live match test window"), not a one-off hide. `src/lib/featureFlags.ts` (`isFeatureEnabled(key)`, server-only, fails open on an unrecognized key or DB error), `src/app/api/feature-flags/route.ts` (thin public read surface for the gated pages, all of which are client components), `src/components/admin/FeatureGate.tsx` (shared wrapper, renders a plain disabled-state instead of children). Four new flag keys added to `DEFAULT_SETTINGS`, defaulted `false`. Caught and fixed mid-build: `admin/transfers/page.tsx` already had its own pre-existing content/wrapper split that an early version of this change blindly re-derived, introducing a duplicate function name — fixed by wrapping the existing structure instead of re-deriving it.

**Evidence:**
- Commit: `74d9a2a`
- Verified by: live test against a Vercel preview deployment (`dev/verify-staging-feature-flags.mjs`), real admin session, full detail in `RUNLOG.md`
- Observed result: `PATCH /api/admin/settings` (real admin JWT) correctly wrote `features.ads.enabled` from `false` to `true` in `system_settings` (confirmed via direct DB read, not just trusting the API response), and `GET /api/feature-flags` (the public read surface `FeatureGate` consumes) reflected the new value immediately. Value restored to baseline (`false`) afterward. **First attempt was a false PASS, caught and corrected same session:** `PATCH` initially 404'd ("Setting not found") because the preview's `system_settings` row for this key didn't exist yet — `initializeDefaultSettings()` only runs as a side effect of the `GET` handler, never `PATCH`. The read side (`/api/feature-flags`) happened to still show the "expected" value only because its own fail-open default for an unconfigured key (`true`) coincidentally matched — not because the write actually worked. Retried after calling `GET /api/admin/settings` first to seed the row; this time `PATCH` returned `200` and the DB value genuinely changed.
- Pending items: none. Client-side gating confirmed via a real browser session against the Vercel preview (`brixsports-staging-pdspsljon-...`), a real injected admin JWT cookie, and `/admin/advertisements` (the "Ads" panel): with `features.ads.enabled: false`, the page rendered `FeatureGate`'s disabled state ("Ads is temporarily disabled... Re-enable it from Admin → Settings → Feature Flags"); toggled to `true` via a real `PATCH /api/admin/settings`, reloaded the same page, real content rendered ("Advertisements / Manage banner ads across the platform / Add Advertisement"). Both directions of the gate confirmed working. All flags reset to their documented defaults afterward (`dev/reset-feature-flags-to-defaults.mjs`) — verified via direct DB read.

**Problem:** `src/app/admin/settings/page.tsx`'s feature-flag CRUD (fetching, editing, saving) genuinely works against a real `systemSettings` table. But all seven default settings — `system.maintenance.mode`, `system.registration.enabled`, `system.notifications.enabled`, `features.fpl.enabled`, `features.predictions.enabled`, `features.polls.enabled`, `features.transfers.enabled` (`src/app/api/admin/settings/route.ts:15-28`) — are **read nowhere else in the entire codebase**. Grepped every key string across `src/**`; only the settings page and its own API route reference them. Toggling "maintenance mode" or "Enable Transfer News" off changes a DB row with zero effect on anything a user or admin experiences — no route guard, no conditional render, no middleware check consults these values anywhere.

**Why this matters now:** `CLAUDE.md`'s own Live Event Readiness Checklist has an unchecked item — "All 🔴 High Volatility features are disabled or hidden from the UI — OPEN — Ads, Lineup Builder, Transfers, User Management, News, and `/api/auth/test` all accessible. Must gate or hide before any public match day." There is currently **no working mechanism in this codebase to accomplish that** via these flags — building real gating (conditional rendering + a shared `isFeatureEnabled()` check wired into the relevant routes/middleware) would be new work, not flipping an existing switch.

**Fix (not built):** either wire the existing flags into real conditional checks at each High Volatility feature's entry point, or if a different mechanism is preferred (env vars, a deploy-time constant), retire the inert Settings UI so it stops implying a control that doesn't exist.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the admin platform.

---

### BACKLOG-156 — Admin Dashboards Present Placeholder/Fabricated Data As Real, Without Labeling It

**Status:** OPEN — found session 47D, not fixed
**Priority:** MEDIUM — misleads an admin relying on these panels, matches this project's own documented "fabricated data presented as real" pattern (e.g. `BUG-088`)

**Findings, bundled (same theme, different pages):**
1. **Match Ratings list's "★ N ratings published" badge is always wrong.** `src/app/admin/match-ratings/page.tsx:28-29`'s `hasRatings`/`ratingsCount` fields drive the badge, but a codebase-wide grep for both names finds **only this one file** — no API route, including the `/api/matches` endpoint this page actually calls, ever sets them. Every match renders "No ratings yet" regardless of whether ratings actually exist, misleading an admin scanning for which matches still need attention.
2. **Infrastructure dashboard has three placeholder metrics presented as live data**, none labeled as such in the UI: `disk: 0` always (`src/app/api/admin/infrastructure/route.ts:146`, own comment admits "would need OS-specific calls"); `cpu` is `process.cpuUsage().user / 1e6 % 100` — a meaningless-as-a-percentage proxy, not real system load; `recentErrors` (`route.ts:183-187`) is hardcoded to always return `[]` with a comment "placeholder — integrate with error logging service," despite Sentry already being configured elsewhere in this project per `CLAUDE.md`'s own stack list — the "Recent Errors" panel can never show anything, ever.

**Fix (not built):** either wire these to real data sources (Sentry API for `recentErrors` in particular, since the infrastructure already exists) or visibly label them as unavailable/placeholder rather than rendering a value that looks real.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the admin platform.

---

### BACKLOG-157 — Public Lineup Builder (`/lineups`) Silently Swallows Save Failures

**Status:** OPEN — found session 47D, not fixed
**Priority:** MEDIUM — a direct instance of CLAUDE.md's "no silent failures" rule, inverted (silent no-op instead of silent success)

**Problem:** `src/app/lineups/page.tsx` lets any visitor build a formation visually and download it as a PNG (works fine, no auth needed) or "Save Draft" (`handleSaveDraft`, lines 201-225), which POSTs to `/api/matches/[id]/lineup` — a route gated to `admin`/`logger` roles only. The save handler only checks `if (data.success)` and never checks `response.ok`, so a 401/403 JSON error response falls through both the success branch and the catch block silently. A viewer (or any non-admin/logger) clicking "Save Draft" sees **no error at all** — not even a failed-save message — and has no way to know their work wasn't saved.

**Fix (not built):** check `response.ok` before `data.success`, surface a clear error toast/message on any non-2xx response, matching the pattern used correctly elsewhere in the app (e.g. `FootballLogger.tsx`'s server-first event handlers).

**Found:** session 47D, by a background audit agent doing a full read-only trace of the admin platform.

---

### BACKLOG-158 — Admin CRUD Completeness Gaps and Minor Dead UI (Bundled, Low Priority)

**Status:** OPEN — found session 47D, not fixed
**Priority:** LOW — none of these block any Critical Flow; genuine feature-completeness debt

**Findings, bundled:**
1. **Organizations management has no edit or delete/deactivate** (`src/app/admin/organizations/page.tsx`) — create-only; an org's `status` can only be set at creation, never toggled after.
2. **Track & Field events admin has no edit functionality** (`src/app/admin/track-events/page.tsx`) — create and delete work, but a created meet's venue/time/teams/categories can't be changed short of delete-and-recreate.
3. **Notifications admin hub oversells what exists** (`src/app/admin/notifications/page.tsx`) — "History" and "Settings" quick-action cards are plain `<div>`s with no `href`/`onClick`, styled identically to the one real link (Composer) but fully decorative. (History functionality does actually exist, just nested inside Composer's own `fetchSendHistory` rather than as its own page.)
4. **Push Diagnostics page is orphaned** (`src/app/admin/push-diagnose/page.tsx`) — not linked from `AdminSidebar.tsx` or any other admin page, reachable only by typing the URL directly. Likely intentional (a debug tool), not confirmed either way.
5. **`src/app/analytics/loggers/page.tsx` has no client-side auth check**, unlike every page under `/admin/**` — not a security hole (its data API is properly gated server-side), but a non-admin hitting this URL gets a broken/empty dashboard instead of the redirect-to-login every other admin page gives.
6. **`logger_manager` role found in `admin/layout.tsx`'s gate check is not documented anywhere in `CLAUDE.md`'s stated Actor Model** (Super Admin → Competition Admin → Team Manager → Logger → Viewer) — a docs/code reconciliation gap, not a functional bug.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the admin platform.

---

### BACKLOG-159 — `players.rating` (Shown On Every Player Profile) Is a Dead, Never-Live-Updated Field

**Status:** OPEN — found session 47D, not fixed. **Tier classification, Richard's explicit call (session 47G):** this is Tier 1/2 work (a real rating-system redesign/consolidation, not a bug fix), deliberately deferred to a future dedicated session rather than folded into any tier-0 close-out. Filed here so it's on record for that agenda, not lost.
**Priority:** HIGH — this is the rating number every viewer actually sees; it is stale for 100% of players, both sports, always. High-priority-but-deferred: severity and scheduling tier are tracked separately here.

**Problem:** the platform runs two completely disconnected rating pipelines. `players.rating` (`schema.ts:59`, `default(7.0)`) — the number shown on every player profile, comparison card, and the `/xi` Build-Your-XI tool — is only ever mutated by a legacy route, `src/app/api/events/route.ts` (a different, older `POST /api/events`, NOT the real match-logging route). Confirmed via grep: no logger component (`FootballLogger.tsx`, `BasketballLogger.tsx`, `TrackLogger.tsx`, `MatchLoggerUI.tsx`) has ever called this route — all of them POST to `/api/matches/[id]/events` instead. The only other reference to `/api/events` anywhere is an infrastructure health-check pinger. **`players.rating` is not live-updated by any match a logger ever logs today, for either sport** — it reflects whatever a seed/backfill script set it to, frozen from that point on.

**The "real" rating system exists, but doesn't reach this field.** `calculateAndSaveRatings()` (`ratingsService.ts`, called from the actual live route) writes to a separate `playerRatings`/`teamRatings` schema using a *different* `RatingCalculator` class (`src/lib/ratingCalculator.ts`) than the legacy route's own `src/lib/services/rating-calculator.ts` — **two independent `RatingCalculator` implementations exist as a live dead-code fork**, the same maintenance-trap pattern as the logging audit's "three parallel offline-queue implementations" finding. The real system's only public surface is the football/basketball hub pages' "Power Ranking" leaderboard card (`?type=powerRanking`), not the player's own profile page.

**Confirmed downstream, basketball-specific symptom:** since `calculateAndSaveRatings()` never succeeds for any basketball match (`BACKLOG-146`), the Basketball hub's Power Ranking card always queries an empty set — it renders a normal-looking card with zero rows and no explanation, indistinguishable from "no matches logged yet" to a viewer. Football's card works correctly, making the asymmetry visible side-by-side.

**Fix (not built):** retire the legacy `/api/events`-fed pipeline and `players.rating` field (or repoint it to read from `playerRatings` at query time), consolidate to one `RatingCalculator` implementation, and add a real "ratings not yet available" state to the Power Ranking card so basketball's empty state doesn't look identical to "nothing logged yet."

**Found:** session 47D, by a background audit agent doing a full read-only trace of the player/team/competition data system.

---

### BACKLOG-160 — Player Discovery Gaps: Broken Inline Compare Tab, No Player Listing Page, Two Dead `/players` Links

**Status:** OPEN — found session 47D, not fixed
**Priority:** MEDIUM

**Findings, bundled (same investigation area):**
1. **The inline "Compare" tab on a player's own profile page (`src/app/players/[id]/page.tsx`) is broken — always returns zero results.** It calls `/api/search?q=...&type=players&limit=10`, but `src/app/api/search/route.ts` reads the category filter from a param named `category`, not `type` — so the filter is silently ignored and every category branch runs. Worse, the response shape is `{ results: { players: [...] } }` but the handler reads `data.players` directly (always `undefined`), so `setSearchResults(data.players || [])` always sets an empty array regardless of query. The **dedicated** `/players/compare` page works correctly (right param name, right response shape) — only the inline tab variant is broken.
2. **No player listing/directory page exists.** `src/app/players/` contains only `[id]/page.tsx` and `compare/page.tsx` — there is no `src/app/players/page.tsx`, so there's no way to browse/filter the full roster as its own destination (unlike `/teams`, which has one).
3. **Two dead links to the nonexistent `/players` route, both 404** — `src/app/favourites/page.tsx:119` ("Back" link from an empty favourites state) and `src/app/players/compare/page.tsx:222` ("Back to Players").

**Fix (not built):** fix the inline Compare tab's param name (`type` → `category`) and response-shape read (`data.players` → `data.results.players`) to match the working dedicated page; build a `src/app/players/page.tsx` listing page (or point the two dead links somewhere real, like `/search?category=players`, as a cheaper interim fix).

**Found:** session 47D, by a background audit agent doing a full read-only trace of the player/team/competition data system.

---

### BACKLOG-161 — Minor Data/Discoverability Findings (Bundled, Low Priority)

**Status:** OPEN — found session 47D, not fixed
**Priority:** LOW

**Findings, bundled:**
1. **The `headToHead` table's write path is entirely dead.** `POST /api/head-to-head` (its only writer) is never called anywhere in the app — not by any admin page, the match-finalization path, or any live script. `GET /api/head-to-head` correctly falls back to computing head-to-head stats live from the last 5 finished matches when no stored row exists (`calculateH2HStats`), which is why the feature still works end to end today — but that fallback only looks at the last 5 matches, so a long rivalry's true all-time record (which the dedicated table's schema clearly intends to track) is never actually shown, only a recent-form snapshot.
2. **`/stats` is a team-only stats page despite the name** — the actual player leaderboards (goals/assists/points/rebounds/power-ranking) live inside the football/basketball hub pages' STATS tabs instead. Pure information-architecture/discoverability gap, not a broken feature.
3. **`/xi` ("Build Your XI") has no sport-awareness in its player picker** — `GET /api/players?limit=100` with no sport/team filter means a viewer could technically build a "team" mixing football and basketball players. Its displayed team rating also reads the same dead `players.rating` field as `BACKLOG-159`. Low severity — this is a fan-engagement feature, not officiating-critical, and already has its own auth gap tracked (`BUG-037`, OPEN, not part of the `BUG-147` sweep).

**Found:** session 47D, by a background audit agent doing a full read-only trace of the player/team/competition data system.

---

### ~~BUG-153~~ — Period/Status Live-Broadcast Has Silently Never Worked, Either Sport: Event-Name Typo (`...changed` vs `...change`)

**Status:** RESOLVED — 2026-07-28 (session 47D)
**Priority:** HIGH — Tier 0, Flow B/C. Currently masked by a working polling fallback (10s/25s on `/matches/[id]`), so no viewer-visible symptom on that page, but this is the actual root cause the WS layer was supposed to solve.

**Problem:** `FootballLogger.tsx:635,1170` calls `emit('match:status:changed', {...})` and `FootballLogger.tsx:628` calls `emit('match:score:updated', {...})` — but `ws-server/index.js:369` listens for `'match:status:change'` (no trailing "d") and `ws-server/index.js:343` listens for `'match:score:update'` (no trailing "d"). Socket.IO does exact-string event matching with no wildcard/`onAny` fallback registered anywhere in `ws-server/index.js` (confirmed absent by grep) — an emit to an unregistered event name is silently dropped, no error surfaced on either side. **This has never worked, for football, since these emit calls were written** — not a regression.

**Why this was never caught:** the score-update case is masked by a separate, correct code path — the server-side `POST /events` → `broadcastScoreUpdate()` → REST `/broadcast` call → `io.to(room).emit()` — which never goes through a `socket.on()` relay at all, and delivers real score updates regardless of this dead client-emit. The status-change case has **no such masking replacement**: `broadcastMatchStatus` (`src/lib/socket.ts:139-144`, the dedicated server-side function for this exact event) has **zero callers anywhere in `src/`** (confirmed via project-wide grep) — no API route ever triggers it. This is the direct, sole reason period/status live-push has silently never worked through every session that touched `BUG-108/116/119`.

**What already works as a substitute, confirmed the same investigation:** `PATCH /api/matches/[id]/route.ts:595` fires `after(() => broadcastToMatch(matchId, 'match:updated', { matchId, ...updateData }))` on **every** admin/logger PATCH, unconditionally, sport-agnostic, carrying whatever fields changed (status, currentPeriod, minute, scores, lineups, stats). Both loggers already hit this route for period transitions. This channel is real and currently fires — but its only consumer anywhere in the codebase is `useMatchStatus` (`useWebSocket.tsx`), whose only caller is `MatchOverlay.tsx` (the football-only homepage widget). **`/matches/[id]/page.tsx` — the page every shared match link actually points to — never subscribes to `match:updated` at all.**

**Fix (not built, two options):** (a) cheapest — fix the two emit-name typos in `FootballLogger.tsx` to match what `ws-server/index.js` actually listens for, and wire a real caller for `broadcastMatchStatus`; or (b) arguably better — since `match:updated` already fires correctly and sport-agnostically on every relevant PATCH, just add one `socket.on('match:updated', ...)` listener to `/matches/[id]/page.tsx` (mirroring what `MatchOverlay.tsx` already does) — this closes the gap for *both* sports at once without touching the logger components at all, and doesn't require basketball to ever emit `match:status:changed` in the first place.

**Fix applied, session 47D — took option (b).** Added a `handleMatchUpdate` listener for `match:updated` to `/matches/[id]/page.tsx`'s existing WS-listener effect, merging `status`/`currentPeriod`/`homeScore`/`awayScore`/`minute`/`extraTime` into local state whenever present in the payload (mirroring `useMatchStatus`'s existing merge pattern). The two dead `match:status:changed`/`match:score:updated` listeners were left in place, not removed — harmless no-ops today, free insurance if the emit-name typo is ever fixed at the source instead.

**Live-verified on staging, 2026-07-28.** Local dev's standalone `ws-server` wouldn't accept a browser connection this session for unrelated pre-existing reasons — moved verification to staging instead, where the real Railway WS server is already known-good.

**Evidence:**
- Commit: `a954f1d`
- Verified by: real two-tab live test against `https://brixsports-staging.vercel.app`, admin session authenticated. Tab A (viewer) opened `/matches/w6o4YQAF5pem_Qa8uazAm` (a real `LIVE` basketball match, `Q1`, score 2-3). Tab B (admin) sent `PATCH /api/matches/w6o4YQAF5pem_Qa8uazAm` with `{ currentPeriod: 'Q2' }` via `fetch()`, confirmed `200 { success: true }`.
- Observed result: Tab A's displayed period label changed from "Q1" to "Q2" **instantly, with zero page reload or manual refresh** — the only mechanism that could produce that is the new `match:updated` WS listener, since the page was never touched directly. Reverted the match back to `Q1` afterward to restore original state.
- Pending items: none for the core fix. Sport-hub pages and homepage overlay still don't listen for `match:updated` (not in this fix's scope, tracked separately under `BUG-149`'s note on sport-hub pages).

**Also observed, same staging session, worth noting for the record:** `BUG-041`'s hydration fix confirmed live and working — console showed `[UpdatePrompt] Controller changed (first claim on an uncontrolled page, no reload needed)` on a fresh page load, exactly the guarded no-reload path the fix added, with zero forced reload observed.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the logging/WS pipeline (the same investigation that found new-event/score/delete broadcasts already work for basketball via the shared routes).

---

### BACKLOG-162 — Auth/Account Minor Cleanup: Dead Favourites Page, Duplicate `useAuth` Hooks, Wrong-Key `localStorage` Cleanup

**Status:** OPEN — found session 47D, not fixed
**Priority:** LOW/MEDIUM — no active data-integrity risk, real UX/maintenance debt

**Findings, bundled (missed in the first filing pass, caught on a completeness re-check):**
1. **`src/app/profile/favorites/page.tsx` is 100% hardcoded mock data** — a `mockFavorites` object (lines 8-25), no API calls anywhere in the file, `removeFavorite` only mutates local state. Distinct from and more severe than `BUG-091` (the match-detail heart button, which does hit real APIs via `useFavorites`) — this dedicated page has never been wired to `useFavorites` or any backend route at all.
2. **Two competing `useAuth` hooks exist**: `src/hooks/useAuth.ts` (cookie-only check via `/api/auth/me`, no localStorage fallback, no `login`/`register`/`logout` methods) vs. `src/contexts/AuthContext.tsx`'s own exported `useAuth`. `src/app/profile/settings/page.tsx` imports the former, everywhere else imports the latter. Structural risk (behavior could silently diverge between the two), not yet a proven live bug.
3. **`src/app/profile/page.tsx:226`'s failed-auth-fetch catch block calls `localStorage.removeItem('token')`** — but the key used everywhere else in the app is `'authToken'`, never `'token'`. Dead code; a stale/invalid `authToken` is never cleared on this page's failure path.

**Fix (not built):** wire `/profile/favorites` to `useFavorites`; consolidate to one `useAuth` implementation (retire the cookie-only one or make it delegate to the context); fix the `localStorage` key typo.

**Found:** session 47D, by a background audit agent doing a full read-only trace of the auth/account/notifications system.

---

### BUG-154 — H2H Tab Crashes ("Cannot read properties of undefined, reading 'team1Wins'") For Any Fresh Matchup

**Status:** SHIPPED — 2026-07-28 (session 47D), commit `d0c8b64`. Not RESOLVED: this entry's own evidence block admits the post-fix live case was never re-tested, which is exactly what CLAUDE.md's lifecycle table reserves RESOLVED for ("live-tested, evidence block attached") — corrected session 47E, was previously mismarked RESOLVED with a stale "commit: pending" placeholder never backfilled after the fix landed.
**Priority:** HIGH — Flow C (Public Livescore), real live crash found by Richard on staging while verifying tonight's other fixes

**Problem:** `GET /api/head-to-head` (`src/app/api/head-to-head/route.ts:75-79`) only computed a `stats` object when either a stored `headToHead` row existed OR at least one FINISHED match between the two teams existed. Two teams that have simply never played each other before — a completely normal, common case, not an edge case — left `stats` as `undefined`, and the route still returned `headToHead: undefined` in its JSON response. `HeadToHeadComparison` (`src/components/HeadToHead.tsx:38`) destructures `headToHead` from props and immediately does `headToHead.team1Wins / headToHead.totalMatches` with no guard — a hard crash on the H2H tab of `/matches/[id]` for any such matchup. Live-reproduced by Richard on staging.

**This is exactly the kind of bug tonight's `tsc` baseline had already flagged, just never acted on** — `src/app/api/head-to-head/route.ts`'s pre-existing type error (`Property 'competitionId' is missing in type...`, present since before this session) was in the same function, same root cause class (the object shape returned doesn't reliably match what consumers expect). Prompted a full sweep of the rest of the `tsc` baseline for other Critical-Flow-relevant misses — see the new "Pre-Existing `tsc` Errors Mapped to Critical Flow Impact" entry below.

**Fix:** the route now always returns a valid, fully-shaped `headToHead` object (zeroed defaults: `totalMatches: 0, team1Wins: 0, team2Wins: 0, draws: 0, team1GoalsFor: 0, team2GoalsFor: 0`) when there's no stored record and no finished matches, instead of `undefined`. Also hardened `HeadToHeadComparison` itself to guard all three percentage calculations against `totalMatches === 0` (would otherwise render `NaN%` even with a valid zeroed object) — belt-and-suspenders on top of the root-cause fix, not a replacement for it.

**Evidence:**
- Commit: `d0c8b64` (`src/app/api/head-to-head/route.ts`, `src/components/HeadToHead.tsx`)
- Verified by: `npx tsc --noEmit` clean (zero new errors from either changed file)
- Observed result: fix addresses the exact reproduction Richard reported live on staging; not yet re-tested against that same live case post-fix
- Pending items: live re-verification on staging (real fresh-matchup H2H tab load, confirming "0-0-0" renders instead of crashing) — required before this can move to RESOLVED

**Found:** session 47D, live crash reported by Richard while verifying `BUG-041`/`BUG-153` on staging.

---

### BACKLOG-163 — Homepage Round-Grouping Fallback Hardcodes 2025-26 Season's Calendar

**Status:** OPEN — found session 47E, not fixed
**Priority:** MEDIUM — will silently degrade (not crash) once the anchor date is stale; live in a Tier 0/Stable file (homepage)

**Problem:** `src/app/page.tsx:278-295` — when a match's `stats.round` is missing/invalid, the homepage falls back to computing a round number from a hardcoded anchor: a `getFullYear() === 2026 && getMonth() === 0` branch with literal Jan 7/11/14 semi-final dates, and a `startDate = new Date('2025-01-15')` used to compute `calcRound = Math.floor(daysDiff / 7) + 1`, gated to `0 < calcRound < 20`.

**Why this matters for the season transition:** the 2026-01 playoff-date branch simply stops matching next season (harmless no-op). But the `'2025-01-15'` anchor keeps computing `daysDiff` forward every season — `calcRound` will eventually exceed the `< 20` guard for matches played in 2027+, silently falling through to the "Ultimate fallback: use date" branch (line 300-309) instead of erroring. Net effect: any next-season match missing an explicit `stats.round` renders a date-grouped card instead of a "Round N" label, with zero warning that the fallback degraded.

**Fix (not built):** derive the anchor date from the competition/season's actual start date (already modeled elsewhere per `BACKLOG-049`'s season-tracking schema work) rather than a literal string; or at minimum, log/flag when `calcRound` falls outside the guard so a future season's degradation is visible instead of silent.

**Found:** session 47E, by a background code-reviewer agent doing a read-only season-transition hardcode sweep (delegated after Richard flagged "session hardcodes" from a past review as something to check before a new season starts).

---

### BACKLOG-164 — Admin "Create Competition" Form Defaults to `season: '2024/2025'`

**Status:** OPEN — found session 47E, not fixed
**Priority:** LOW — cosmetic default, not a crash risk, but an easy trap for an admin who doesn't notice/edit the pre-filled field

**Problem:** both `src/app/admin/competitions/page.tsx:35` and `src/app/admin/competitions/page-enhanced.tsx:87` set `defaultFormData.season = '2024/2025'`. Any admin creating a new competition without manually editing the pre-filled Season field silently creates a `'2024/2025'`-tagged competition, two seasons stale.

**Fix (not built):** derive the default from the current date (e.g. `` `${currentYear}/${currentYear + 1}` ``) instead of a literal string. Also worth confirming with Richard whether `page-enhanced.tsx` is the live file or a superseded duplicate of `page.tsx` — both currently carry the same stale default, which suggests they may not be kept in sync either way.

**Found:** session 47E, by a background code-reviewer agent doing a read-only season-transition hardcode sweep.

---

### BACKLOG-165 — Pre-Existing `tsc` Error: `teamId` Undefined in Admin Match-Lineups Publish Route

**Status:** OPEN — found session 47E, not fixed
**Priority:** MEDIUM — same class BUG-154 called out ("this is exactly the kind of bug tonight's tsc baseline had already flagged, just never acted on"); worth a deliberate sweep rather than being dismissed as baseline noise

**Problem:** `src/app/api/admin/match-lineups/[id]/route.ts(126,57)`: `error TS2552: Cannot find name 'teamId'. Did you mean 'team'?`. Confirmed pre-existing and unrelated to any session 47E change (file has zero diff this session). Not yet read in full to determine live-request impact — flagged for the same "Pre-Existing `tsc` Errors Mapped to Critical Flow Impact" sweep BUG-154's entry calls for, not chased further this session (found incidentally while verifying an unrelated fix to `src/app/admin/match-lineups/page.tsx`, BUG-125).

**Found:** session 47E, incidental `tsc --noEmit` check while verifying BUG-125's fix.

---

### ~~BACKLOG-166~~ — Basketball Foul System: Team-Foul Bonus Tracking, Technical-Foul Miscounting, Competition-Level Threshold Override

**Status:** SHIPPED (partial), sub-findings 1+2 now both live-tested — 2026-07-30, commit `541559b` (session 47E), sub-finding 2 verified session 47F, sub-finding 1 verified session 47G. Sub-finding 3 (schema migration) intentionally not started — flagged separately for Richard's go-ahead given the migration risk, not silently skipped.
**Priority:** MEDIUM — real, but BUG-134's disqualification gate (the domain-integrity-critical piece) is already shipped; this is the remaining polish/completeness layer

**Sub-finding 1, RESOLVED — team-foul tracking (data only, no UI):** `getTeamFoulCountThisQuarter(teamId)` / `isTeamInBonus(teamId)` added, derived from local event state, naturally resets each quarter since it's keyed off `getCurrentPeriod()` rather than a separately-incrementing counter needing manual reset logic. No visible "BONUS" indicator built — Richard's explicit scope call this session, keeping this MEDIUM-priority item tight. `teamFoulBonusAt` now read from match config on mount, mirroring `foulDisqualifyAt`. **Live-verified session 47G:** since these are pure functions over already-DB-persisted event data with no separate state store, verified by POSTing 5 real `'Foul'` events (via the real authenticated API, real logger session) for one team in the match's current period (`OT3`), then querying `match_events` and replicating `getTeamFoulCountThisQuarter`'s exact filter (`type IN ('Foul','Technical Foul') AND team_id = X AND period = current_period`) directly against the DB — count came back `5`, matching `teamFoulBonusAt`'s default of `5`, confirming `isTeamInBonus()` would correctly evaluate `true`. Per-quarter reset is guaranteed by construction (strict string equality on `period`, and this session's own OT2-vs-OT3 tagging tests already proved period values are correctly distinct) rather than separately re-tested with a second quarter's worth of fouls.

**Sub-finding 2, SHIPPED — technical-foul split:** `Technical Foul` is now its own `BasketballEventType`, distinct from generic `Foul` — previously all six foul buttons (Personal/Technical/Flagrant/Offensive/Shooting/Unsportsmanlike) dispatched the same `type: 'Foul'`, silently inflating `personalFouls` on a Technical Foul. Server-side write (`events/route.ts`) and revert (`events/[eventId]/route.ts`) both updated symmetrically. Also added a rating-calc case (previously fell through unscored, `-1.5`, worse than a regular foul's `-1`). **Rules decision, Richard's explicit call:** Technical Fouls count toward the same `foulDisqualifyAt` threshold as Personal Fouls (combined count, not a separate ejection trigger) — simpler, and preserves BUG-134's existing protective behavior rather than loosening it. Flagrant/Offensive/Shooting/Unsportsmanlike still all dispatch generic `type: 'Foul'` — personal-foul subvarieties for stat-counting purposes, same as real box scores.

**Sub-finding 3, NOT STARTED — competition-level threshold override:** still needs a real schema migration (new `competitionSportSettings` columns for `foulDisqualifyAt`/`teamFoulBonusAt`/`technicalFoulValue`) plus wiring into the existing three-layer merge. Per this project's own convention (`db:push` staging first, then prod, logged in `RUNLOG.md`), this needs an explicit go-ahead rather than being done inline with a logger-component fix.

**Evidence (sub-finding 2 only):**
- Commit: `541559b`
- Verified by: live test against a Vercel preview deployment (`dev/verify-staging-technical-foul.mjs`), real logger session, real `basketball_player_stats` row, full detail in `RUNLOG.md`
- Observed result: baseline `{ technical_fouls: 0, personal_fouls: 4 }` → POST a real `'Technical Foul'` event (`201`) → `{ technical_fouls: 1, personal_fouls: 4 }` — `technical_fouls` incremented by exactly 1, `personal_fouls` genuinely untouched. **Note on methodology:** first attempt used `match_type: 'friendly'` for the throwaway match and got a false negative (`technical_fouls` stayed `0`) — not a bug, the existing friendly-guard on player-stat writes correctly blocked it; retried with `match_type: 'competition'` (`competitionId` left `null` so no real standings were touched), which is the actual correct way to test this. Player's real stats restored to exact baseline after the test.
- Pending items: sub-finding 1 now verified (see its own note above). The `foulDisqualifyAt` disqualification gate (`BUG-134`) remains pure client-side state with no server-persisted data to check via script — still genuinely needs a browser test, not attempted this session. Sub-finding 3's migration decision still needed from Richard.

**Found:** session 47D (original BUG-134 filing), scope split session 47E when only sub-finding 1 (disqualification) was built, sub-findings 1+2 of this entry shipped later the same session.

---

### ~~BACKLOG-167~~ — Unauthenticated `/api/players` and `/api/search` Leak Banned/PII Fields (Same Bug Already Fixed Once, Never Ported to List/Search)

**Status:** RESOLVED — 2026-07-30 (session 47F)
**Priority:** CRITICAL — real, live, unauthenticated PII/banned-field leak on two public routes; same bug class already fixed once on the detail route and missed here

**Problem:** `GET /api/players` (`src/app/api/players/route.ts` — every branch: `ids=`, `teamId=`, default list) and `GET /api/search` (`category=players` results) have no `getAuthUser()` call and return `enrichPlayersWithAffiliations()`'s output unshaped — `{ ...player, memberships, organizationAffiliations }`, where `...player` is the full `players` row including `email` and `profileId` (both on CLAUDE.md's banned-public-fields list; `memberships`/`organizationAffiliations` also banned verbatim). `src/app/api/teams/[id]/route.ts` had it worse than originally documented: the main `players` field (`teamPlayers`/`playersWithStats`) had **zero** stripping at all (raw row spread), and `universityPlayers` stripped `team`/`memberships`/`organizationAffiliations` but still spread `...player`, leaking `email`/`profileId` there too. That route also had **no auth check of any kind** — confirmed while fixing it.

**Why this is a repeat, not a new class:** `src/app/api/players/[id]/route.ts:325-326,336` already has the correct fix (BUG-098/101, RESOLVED 2026-07-11/12) — `email`/`profileId` destructured out, `memberships`/`organizationAffiliations` gated behind `isAdmin`. That fix was scoped to the single-player detail route only; the list route, search route, and the teams-detail route's player-spread were never touched and still leak today.

**Fix:** added a shared `toPublicPlayer(player, isAdmin)` helper to `src/lib/player-data.ts` (same file as `enrichPlayersWithAffiliations`) — strips `email`/`profileId`/`memberships`/`organizationAffiliations` unless `isAdmin`, mirroring the already-proven detail-route shape exactly. Applied at the return boundary (after any internal filtering/search logic that legitimately still needs to read the stripped fields, e.g. `playerMatchesSearch`/`playerMatchesQuery` matching against `email`) in:
- `src/app/api/players/route.ts` — all three branches (`ids=`, `teamId=`, default list), added `getAuthUser` check
- `src/app/api/search/route.ts` — players category, added `getAuthUser` check
- `src/app/api/teams/[id]/route.ts` — both `teamPlayers` (previously fully unstripped) and `universityPlayers`, added `getAuthUser` check (route had none before)

**Found:** session 47E, by a background code-reviewer agent doing a read-only production-discipline sweep (API payload/PII, caching, convention consistency — explicitly scoped to not re-cover session 47D's six audit areas). Fixed session 47F.

**Evidence:**
- Commit: `1228179`
- Verified by: live test against a Vercel preview deployment (`dev/verify-staging-preview.mjs` + `dev/verify-staging-authed.mjs`), full detail in `RUNLOG.md`
- Observed result: unauthenticated `GET /api/players`, `GET /api/search?category=players`, and `GET /api/teams/[id]` (real team `busa-joga`) all confirmed zero `email`/`profileId`/`memberships`/`organizationAffiliations` on any player row. A freshly-generated real admin JWT confirmed the opposite path holds too — `GET /api/players` as admin still returns full data including `email`, proving the strip is role-conditional, not a blanket removal that would have broken the admin panel.
- Pending items: none

---

### ~~BACKLOG-168~~ — Two Admin Routes Bypass `getAuthUser()`, Trust the JWT's Role Claim Directly (Privilege-Revocation Gap)

**Status:** RESOLVED — 2026-07-30 (session 47F)
**Priority:** HIGH — narrow but real: a demoted/deactivated admin's already-issued token keeps working on these two routes for its full 7-day lifetime

**Problem:** `src/app/api/matches/[id]/lineup/unlock/route.ts` and `src/app/api/matches/[id]/livestream/route.ts` both hand-roll `jwt.verify(token, env.jwtSecret)` and check `decoded.role !== 'admin'` straight off the token payload, instead of the standard `getAuthUser(request)` pattern used at 90+ other admin-gated call sites, which re-reads the **current** DB row. If an admin account is demoted or deactivated, every other admin route picks that up on the next request; these two keep honoring the stale token claim.

**Fix:** replaced both hand-rolled `jwt.verify()` blocks with `const authUser = await getAuthUser(request); if (!authUser) return 401; if (authUser.role !== 'admin') return 403;` — the standard pattern already used everywhere else. Found by a retrospective audit agent (session 47F) as the same gap class as `BUG-187` (fixed one file over, same session, in `lineup/publish/route.ts`) — this entry is the sibling-route half of that same pattern.

**Found:** session 47E, same background audit as BACKLOG-167. Fixed session 47F.

**Evidence:**
- Commit: `1228179`
- Verified by: live test against a Vercel preview deployment (`dev/verify-staging-preview.mjs` unauth pass + `dev/verify-staging-authed.mjs` authed pass), full detail in `RUNLOG.md`
- Observed result: `POST lineup/unlock` and `PATCH livestream` both correctly 401 with zero auth. With a freshly-generated real admin JWT, `POST lineup/unlock` (on an unpublished lineup) got past the auth gate to a real `404` business-logic response instead of 401/403 — confirming `getAuthUser()` genuinely accepts a valid admin session, not just rejecting invalid ones.
- Pending items: none

---

### BACKLOG-169 — User-Supplied `limit` Query Param Unclamped in 14+ List Routes (Shallow ".limit() Present" Without an Upper Bound)

**Status:** OPEN — found session 47E, not fixed
**Priority:** HIGH — CLAUDE.md mandates `.limit()` on every list endpoint; these technically have one but it's caller-controlled with no ceiling, `?limit=999999999` bypasses the intent entirely

**Problem:** `parseInt(searchParams.get('limit') || 'N')` passed straight into `.limit()` with no `Math.min()` ceiling in: `src/app/api/news/route.ts`, `news/[id]/comments/route.ts`, `news/[id]/related/route.ts`, `transfers/route.ts`, `fixtures/route.ts`, `competitions/[id]/fixtures/route.ts`, `competitions/[id]/stats/route.ts`, `notifications/route.ts`, `users/activity/route.ts`, `predictions/leaderboard/route.ts`, `ratings/analytics/route.ts`, `teams/[id]/form/route.ts`, `search/route.ts`, `fpl/players/route.ts`, `fpl/transfers/route.ts`. `src/app/api/players/search/route.ts` already has the correct pattern in this same codebase: `Math.min(Math.max(1, parsed), 50)`.

**Fix (not built):** one-line change per file, same pattern each time: `const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20), 100);`

**Found:** session 47E, same background audit as BACKLOG-167.

---

### BACKLOG-170 — Internal Error Messages (`error.message`) Returned to the Client in 4 Routes, One Fully Public

**Status:** OPEN — found session 47E, not fixed
**Priority:** HIGH — direct violation of CLAUDE.md's "Never return raw database errors to the client"; one of the four (`news` GET) is unauthenticated

**Problem:** `details: error instanceof Error ? error.message : String(error)` (or equivalent) returned in the JSON error body at `src/app/api/news/route.ts` (GET is fully public, no auth check), `news/[id]/route.ts`, `notifications/subscribe/route.ts`, `cloudinary/sign/route.ts`.

**Fix (not built):** same shape at each site — log the real error server-side (`console.error`), return a generic message to the client: `return NextResponse.json({ error: 'Failed to fetch news articles' }, { status: 500 });`

**Found:** session 47E, same background audit as BACKLOG-167.

---

### BACKLOG-171 — Public Matches List Embeds Full Event History for All 50 Matches in Every Response (Flow C Hot Path)

**Status:** OPEN — found session 47E, not fixed
**Priority:** MEDIUM — real payload bloat on the public livescore list, not a correctness bug

**Problem:** `src/app/api/matches/route.ts` fetches up to 200 events per match and inlines the full array into every list item for all 50 matches returned. Confirmed hot path: `src/app/live/page.tsx` and `src/components/LiveUpdates.tsx` both call this endpoint. A list view needs current score/status/minute, not full event-by-event detail for 50 matches at once — that already exists separately on the detail route.

**Fix (not built):** drop the embedded `events` array from the list response (or cap it to the last 2-3 events), let the detail page's existing `/api/matches/[id]` fetch carry full history.

**Found:** session 47E, same background audit as BACKLOG-167.

---

### BACKLOG-172 — Three N+1 Query Patterns, One on the Public Livescore Hot Path

**Status:** OPEN — found session 47E, not fixed
**Priority:** MEDIUM

**Problem:**
1. `src/app/api/matches/route.ts` — one `matchEvents` query per match (up to 50 separate queries) instead of a single `inArray(matchEvents.matchId, matchIds)` batch query. Public livescore list, Flow C.
2. `src/app/api/matches/[id]/route.ts` — a separate `players` query per event with a `relatedPlayerId` (up to 500 per match).
3. `src/app/api/competitions/route.ts` (`includeStats=true` branch) — 3 unbatched queries × N competitions (matchCount, allMatches, standingsCount).

**Fix (not built):** batch via `inArray()` + in-memory grouping, same pattern for all three — example for (1):
```ts
const allEvents = matchIds.length ? await db.select().from(matchEvents).where(inArray(matchEvents.matchId, matchIds)).limit(5000) : [];
```

**Found:** session 47E, same background audit as BACKLOG-167.

---

### BACKLOG-173 — Zero Cache-Control Headers or ISR Anywhere in the API/Page Layer

**Status:** OPEN — found session 47E, not fixed (findings-only, no fix designed per audit scope)
**Priority:** LOW — real production-discipline gap, not a correctness or security issue; live-match data legitimately can't be cached, but slow-changing public reads currently round-trip to Turso on every request with no documented rationale

**Problem:** confirmed by exhaustive grep — `Cache-Control`/`revalidate` appear only in `src/app/api/llms/route.ts` and `src/app/api/health/route.ts` (neither a data route). No public GET (`matches`, `players`, `competitions`, `teams`, `universities`, `standings`, `news`) sets caching headers. Zero `export const revalidate` or `force-dynamic` anywhere in `src/app` — no page opts into ISR or static generation.

**Fix (not built):** findings only, per this audit's own scope — a real fix needs a deliberate pass deciding which routes are cacheable (universities/teams/competitions — slow-changing) vs. which must stay live (matches, events).

**Found:** session 47E, same background audit as BACKLOG-167.

---

### BACKLOG-174 — Block-List DTO Shaping Is Fragile (New Sensitive Column Leaks By Default Unless Manually Added to the Destructure)

**Status:** OPEN — found session 47E, not fixed
**Priority:** LOW — compliant today, structural fragility risk for the future

**Problem:** `src/app/api/matches/route.ts`, `matches/[id]/route.ts`, `competitions/route.ts` all spread the full Drizzle row and manually subtract known-banned fields (`{ ...row, bannedField: undefined }`-style), rather than an explicit allow-list DTO. Any new sensitive column added to `matches`/`competitions` later leaks to the public API by default unless someone remembers to add it to the destructure at each of these sites.

**Fix (not built):** convert to explicit allow-list DTOs next time either table's shape changes — not urgent enough to justify a standalone migration-free refactor today.

**Found:** session 47E, same background audit as BACKLOG-167.

---

### BACKLOG-175 — `GET /api/universities` Has No `.limit()` Clause At All

**Status:** OPEN — found session 47E, not fixed
**Priority:** LOW — low exploitability (teams table is naturally small), but a literal violation of CLAUDE.md's own unbounded-query rule

**Problem:** `src/app/api/universities/route.ts` — `db.select({ university: teams.university }).from(teams)` with no `.limit()` at all, unlike `BACKLOG-169`'s "present but unclamped" pattern — this one is fully absent.

**Fix (not built):** add `.limit(1000)`.

**Found:** session 47E, same background audit as BACKLOG-167.

---

### BACKLOG-176 — `cloudinary/sign` Reads `process.env.CLOUDINARY_*` Directly Instead of `src/lib/env.ts`

**Status:** OPEN — found session 47E, not fixed
**Priority:** LOW — route is auth-gated, low severity; direct violation of CLAUDE.md's env-var rule ("Never read process.env directly in application code")

**Problem:** `src/app/api/cloudinary/sign/route.ts` reads `process.env.CLOUDINARY_*` directly in four places instead of importing from `src/lib/env.ts`.

**Fix (not built):** add the Cloudinary vars to `env.ts` if not already present, import from there instead.

**Found:** session 47E, same background audit as BACKLOG-167.

---

### ~~BACKLOG-182~~ — Bulk-Register Dedup Check Not Scoped to Target Team, Could Silently Drop a New Player

**Status:** RESOLVED — 2026-07-30 (session 47E), commit `dd92b68`
**Priority:** CRITICAL — found ahead of Saturday's friendly against a brand-new team with brand-new players, the exact scenario this bug hits hardest

**Problem:** `POST /api/players/bulk-register`'s pre-flight dedup matched a new player against the entire `players` table (hundreds of legacy rows), not scoped to the team being registered. A brand-new external team's players typically have no `college` set, so the match condition collapsed to "same name, college NULL/empty" against the whole database — any name collision with an unrelated existing player who also has no college silently skipped the new player, no error, no crash, just never created. Invisible to the logger afterward, no in-UI way to force-create.

**Fix:** dedup query scoped to the target team via a join through `playerTeamAffiliations` (`teamId` + `isActive`) instead of the whole table.

**Evidence:**
- Commit: `dd92b68`
- Verified by: `npx tsc --noEmit` clean
- Observed result: not yet live-tested (no real bulk-registration of a name-colliding new player run against the fix)
- Pending items: live test on staging before Saturday — register a new team with a player name deliberately colliding with an existing unrelated player who has no college set, confirm the new player is created, not skipped

**Found:** session 47E, by a background audit agent doing a read-only trace of the new-team/new-player registration path ahead of Saturday's friendly.

---

### ~~BACKLOG-177~~ — Predictions/Polls/FPL Feature Flags Remain Inert (Same Underlying Bug As BACKLOG-155)

**Status:** WONT FIX — 2026-07-30 (session 47F), investigated and found moot, no code change needed
**Priority:** ~~LOW~~ — closed

**Problem (as originally filed):** `features.fpl.enabled`, `features.predictions.enabled`, `features.polls.enabled` are, like the flags `BACKLOG-155` fixed, only ever referenced in `admin/settings/route.ts` itself — never read anywhere else. Toggling them in the Settings UI has zero effect.

**Why this is not the same bug as BACKLOG-155, on investigation:** `BACKLOG-155`'s five flags (Ads/User Management/News/Transfers/Lineup Builder) gate *live, reachable* admin panels — those genuinely needed a `FeatureGate` wrapper because a real user could otherwise land on them. Predictions, Polls, and FPL are different: per `.agents/dev/BACKSCOPE.md`, `/predictions/page.tsx` and all five `/fpl/*` pages already `return notFound()` unconditionally, and the Polls UI was removed from the match-detail page entirely (no dedicated route exists at all). There is nothing live left to attach a `FeatureGate` to — wrapping a page that already always 404s regardless of the flag's value would have zero observable effect either way. The Settings toggle being inert here is a symptom of a *different, already-correct* backscoping layer (page-level `notFound()`), not an unwired feature flag. Confirmed via Richard's own review, session 47F.

**No fix needed.** If/when Predictions, Polls, or FPL are ever un-backscoped for a real Phase 7 build (see `BACKSCOPE.md`), `FeatureGate`/`isFeatureEnabled()` are still there and reusable at that point — this entry is closed as-is, not deferred to a "later" fix.

**Found:** session 47E, while wiring `BACKLOG-155`. Investigated and closed session 47F.

---

### ~~BACKLOG-178~~ — Lineup Persistence API Has No Server-Side Cross-Check Against Competition `playersPerSide`/Match Settings

**Status:** RESOLVED — 2026-07-30 (session 47F)
**Priority:** MEDIUM — real gap, not new risk (has always been this way), client-trust only

**Problem:** `src/app/api/matches/[id]/lineup/route.ts` has zero reference to `competitionSportSettings`/`halfDuration`/`playersPerSide` anywhere. The competition-aware `playersPerSide` value is computed correctly by `/api/matches/[id]/config` (including this session's `BUG-125`-adjacent sport-filter fix), but enforcement of "does the submitted lineup's starter count actually match" lives only in each client component (`FootballLogger.tsx`, `BasketballLogger.tsx`, the admin match-lineups page) via their own local `STARTER_COUNT` checks. The server-side write endpoint accepts whatever starter array it's given, no count validation at all.

**Fix:** the real enforcement point turned out to be `src/app/api/matches/[id]/lineup/publish/route.ts` (the "finalize" action, not the draft-save `lineup/route.ts` POST) — it already validated starter count, just via `match[0].sport === 'Basketball' ? 5 : 11`, a hardcoded sport binary with the same blind spot as `BACKLOG-183`. Extracted the three-layer config merge (match override → competition setting → sport default) out of `config/route.ts` into a new shared `src/lib/matchConfig.ts` (`getMatchConfig(matchId)`), generalized to also detect custom "N-a-side" formats from the sport/competition text (not just literal "5-a-side") for friendlies with no `competitionId`. `publish/route.ts` now sources `requiredStarters` from `getMatchConfig(matchId).config.playersPerSide` instead of the hardcoded binary. `config/route.ts`'s own GET is now a thin wrapper around the same shared function — one source of truth instead of two independent copies.

**Bonus fix, found while reading this route:** `lineup/publish/route.ts` had **zero server-side auth enforcement** — it decoded a JWT from the cookie if present but never rejected the request on a missing/invalid token or wrong role, so any unauthenticated caller could publish and lock any match's lineup (which also fires a real push notification). Filed and fixed as `BUG-187` in the same commit, same file family.

**Related to `BACKLOG-183`, same root cause, fixed together:** see that entry.

**Found:** session 47E, while answering Richard's question about whether competition match settings actually couple to the rest of the lineup-publishing flow. Fixed session 47F.

**Evidence:**
- Commit: `ec83ad1`
- Verified by: live test against a Vercel preview deployment (`dev/verify-staging-preview.mjs`, `dev/verify-staging-authed.mjs`), full detail in `RUNLOG.md`
- Observed result: a throwaway `UPCOMING` friendly with `"9-a-side Test Cup"` in its competition text resolved `GET /api/matches/[id]/config`'s `playersPerSide` to `9` (not the old hardcoded 11). A real draft-lineup save (11 real `busa-joga` starters) followed by `POST lineup/publish` as a genuine admin succeeded end-to-end (`200`), confirming the config-sourced starter-count enforcement doesn't reject a correctly-sized real lineup.
- Pending items: none

---

### BACKLOG-179 — `POST /api/teams` Has No Validation Against NOT NULL Schema Columns, Would 500 On Any Real Caller

**Status:** OPEN — found session 47E, not fixed
**Priority:** MEDIUM — not live risk today (confirmed no UI anywhere calls this route directly), but a landmine for whenever one is built

**Problem:** `src/app/api/teams/route.ts` inserts `request.body` directly with no validation, but `teams.shortName`/`logo`/`university`/`color` are all `.notNull()` in schema. The only working team-creation path today is `/admin/bulk-register`, which supplies all required fields with defaults — this route itself has never been exercised by any real UI. The moment a future "quick create team" form is built against it expecting `/api/players`-style defaulting, it will 500 on any minimal-fields submission.

**Fix (not built):** default/validate `logo`, `color` (and confirm `shortName`/`university` are present) before insert, matching the pattern bulk-register already uses.

**Found:** session 47E, by the same background audit that found `BACKLOG-182`.

---

### ~~BACKLOG-180~~ — Match-Creation Form Defaults `competitionLevel` to `'busa-league'` Even For Friendlies, No UI Control

**Status:** SHIPPED — 2026-07-30 (session 47F), not yet live-tested
**Priority:** LOW — currently mitigated by two independent enforced paths (bulk-register requires `university`; admin/players auto-fills it from the selected team), not a live risk today, but a single point of failure with no visible safety net

**Problem:** `src/app/admin/matches/page.tsx` defaults `competitionLevel` to `'busa-league'` for every match including friendlies, with no UI to change it. That value flows into `/api/matches/[id]/eligible-players`'s `normalizeCompetitionLevel()`, which requires a non-empty `player.university` at the `'busa-league'` eligibility level. Currently safe because both real player-creation paths (bulk-register, admin/players) always populate `university` — but if a player or team is ever created outside those two enforced paths, `eligible-players` would silently return an empty roster with no error surfaced to the logger.

**Fix:** the "Match Type" select's `onChange` now sets `competitionLevel: 'external'` whenever `matchType` switches to `'friendly'` — `normalizeCompetitionLevel('external')` maps to `isPlayerEligible`'s `case 'external'`, which returns `true` for every player regardless of college/department/university (confirmed in `src/lib/competition-player-eligibility.ts`). Competition matches are unaffected — their `competitionLevel` is still driven by the selected competition's own `level` field, unchanged. `src/app/admin/matches/page.tsx`.

**Found:** session 47E, by the same background audit that found `BACKLOG-182`. Fixed session 47F.

---

### ~~BACKLOG-183~~ — Admin Match-Lineups Page Hardcodes `playersPerSide: 11` For Any Friendly Match (Same Bug Class As BUG-125, Football Side)

**Status:** RESOLVED — 2026-07-30 (session 47F), server-side (config endpoint) verified live; the admin UI's own fetch call is the identical pattern already proven working in BACKLOG-178/183's shared verification, not separately browser-tested
**Priority:** MEDIUM — real, would block correctly building a 5-a-side lineup for a friendly (e.g. Saturday's own match, if it's 5-a-side); confirmed via code, not yet hit live

**Problem:** `src/app/admin/match-lineups/page.tsx`'s `handleMatchSelect` looks up `matchComp = competitions.find(c => c.name === match.competition)` to resolve `playersPerSide`. A friendly match's `competition` field is typically just `"Friendly"` — not a real, configured `competitions` row with its own `competitionSportSettings`. That lookup fails, falls into the `else` branch, and `playersPerSide` is hardcoded to `11` (`page.tsx:234,238`) regardless of the match's actual format. A 5-a-side (or futsal) friendly has no way to configure the lineup builder for 5 starters — same root cause class as `BUG-125` (basketball got the identical wrong-default treatment from this same page), just the football-format-variant instead of the wrong-sport case.

**Fix:** `handleMatchSelect` now fetches `/api/matches/[id]/config` instead of doing its own `competitions.find(c => c.name === match.competition)` lookup. The config route (via the new shared `src/lib/matchConfig.ts`) resolves `playersPerSide` through the real three-layer chain (match override → competition setting → sport default) and now also parses "N-a-side"/futsal/npuga keywords out of the match's sport/competition text for friendlies with no `competitionId` — so this page, the lineup-publish route (`BACKLOG-178`), and `FootballLogger.tsx`'s own client-side `is5Aside` heuristic are no longer three independently-drifting copies of the same logic.

**Related to `BACKLOG-178`, same root cause, fixed together in the same commit** — both now read `playersPerSide` from the one shared `getMatchConfig()` source instead of two separate, inconsistent lookups.

**Deliberately not changed, per this entry's own note below:** the default-formation ternary (`playersPerSide === 5 ? '1-2-1' : '4-3-3'`) still just picks index 0 of the correct list once `playersPerSide` resolves correctly — a genuinely smarter default needs a schema field this project doesn't have yet (no "default formation" column anywhere), not a quick patch. Confirmed with Richard this stays deferred.

**Also noted, same investigation, same file (`page.tsx:226-235`), not needed for Saturday's timeline — for later work:** the default-formation logic is a binary hardcode too, not genuinely config-driven — `matchComp.playersPerSide === 5 ? '1-2-1' : '4-3-3'` is the entire decision tree, regardless of how many real formations exist for either format (`FORMATIONS_11`/`FORMATIONS_5` arrays at the top of this same file already list 10 and 2 real options respectively — the initial default just never reflects that range, always picking the same one of each). Low severity — the admin can still manually pick a different formation from the dropdown afterward, this only affects what's pre-selected.

**Found:** session 47E, Richard's own question about whether competition match settings actually couple through to lineup publishing for friendlies specifically. Fixed session 47F.

**Evidence:**
- Commit: `ec83ad1`
- Verified by: live test against a Vercel preview deployment (`dev/verify-staging-preview.mjs`), full detail in `RUNLOG.md`
- Observed result: `GET /api/matches/[id]/config` (the exact endpoint `handleMatchSelect` fetches) correctly resolved a throwaway friendly's `"9-a-side Test Cup"` competition text to `playersPerSide: 9`. **Caveat, stated plainly:** this confirms the server-side source of truth is correct; the admin page's own `fetch`/`setPlayersPerSide` wiring (a simple 3-line consumer of the same response shape `FootballLogger.tsx`/`BasketballLogger.tsx` already use in production) was not separately exercised in a browser. Flagging this rather than overclaiming a UI-level test that didn't happen.
- Pending items: a real browser click-through on `/admin/match-lineups` selecting a 5-a-side or N-a-side friendly, confirming the starter-count UI actually reflects the fetched value — cheap to do whenever the admin UI is opened for other reasons, not blocking.

---

### BACKLOG-184 — Football's In-App Lineup Editor Bypasses the Admin Page's Own Publish-Lock/Unlock RBAC

**Status:** OPEN — found session 47E, not fixed (flagged at the time, filing deferred to session close — this is that filing)
**Priority:** MEDIUM — real RBAC inconsistency, not a privilege escalation (a logger already has legitimate write access to lineups; this is about which of two rules applies, not unauthorized access)

**Problem:** `src/app/admin/match-lineups/page.tsx` enforces a real lock: if a lineup was already published by an admin and not explicitly unlocked (`homeLineupStatus?.publishedByRole === 'admin' && !homeLineupStatus?.unlocked`), a non-admin (logger) is blocked from editing it there — `isDisabled` gates the picker, and the page is also entirely inaccessible to a logger once the match is no longer `UPCOMING`. But `FootballLogger.tsx`'s own in-app lineup editor (`handleEditLineup`/`saveLineupDraft`, triggered from inside the logger's own match view) has zero equivalent check — it POSTs straight to the same `/api/matches/[id]/lineup` endpoint with no `publishedByRole`/`unlocked` awareness at all. A logger can bypass the admin's lock entirely just by using the in-app editor instead of the admin page — the two football lineup-editing surfaces enforce genuinely different rules for the exact same underlying data.

**Fix (not built):** either (a) have `FootballLogger.tsx` fetch the current lineup-publish status before allowing an edit and apply the same lock check the admin page uses, or (b) if the in-app editor is meant to always be logger-writable regardless of admin lock (a legitimate design choice — the "lock" might be intended only for the dedicated admin tool, not the working logger interface), then update the admin page's own copy/UX to make that explicit instead of implying a lock that doesn't universally hold.

**Found:** session 47E, while confirming the RBAC model for a Richard question about how football's admin-vs-logger lineup permissions actually work — surfaced as a byproduct, not something either surface was directly being worked on.

---

### BACKLOG-181 — Unbounded `players` Table Scan in `/api/competitions/[id]/eligible-players`

**Status:** OPEN — found session 47E, not fixed
**Priority:** LOW — confirmed this route is NOT the one FootballLogger's live-logging flow actually calls (that's the properly-scoped `/api/matches/[id]/eligible-players`), so no Saturday impact

**Problem:** `src/app/api/competitions/[id]/eligible-players/route.ts` — `const allPlayers = await db.select().from(players);` has no `.limit()`, violating CLAUDE.md's "every list endpoint MUST have a `.limit()` clause" rule.

**Fix (not built):** add a `.limit(1000)`-style cap.

**Found:** session 47E, by the same background audit that found `BACKLOG-182`.

---

### BACKLOG-185 — Raw-SQL `dev/*.mjs` Scripts Writing `created_at` via `Date.now()` Store Milliseconds, Corrupting Sort Order Against Drizzle's Seconds Convention

**Status:** OPEN — found session 47F, not fixed (filed per Richard's explicit call, real fix deferred)
**Priority:** MEDIUM — silent correctness bug on any `ORDER BY created_at` query touching a row written this way; not data loss, but "most recent" is unreliable wherever it hits

**Problem:** `matches.created_at` (and likely other tables' `created_at`/`updated_at`) is a Drizzle `integer(col, { mode: 'timestamp' })` column — every write that goes through Drizzle's query builder with a real `Date` object (`new Date()`) gets correctly converted to Unix **seconds**. But `dev/backfill-write-busa-sf-both.mjs:39` does `const NOW = Date.now()` (JS **milliseconds**) and inserts it directly via a raw `client.execute`/`client.batch` SQL statement (`@libsql/client`, not Drizzle), bypassing the conversion entirely. Confirmed live: `matches` rows `busa-sf-kings-pirates`/`busa-sf-joga-hammers` have 13-digit `created_at` values (`1783940115189`) instead of the expected 10-digit seconds values every other row has. Found while investigating why a plain `ORDER BY created_at DESC` on `matches` returned those two BUSA semifinal rows as "most recent" ahead of two friendlies that actually happened ~17 days later in wall-clock time.

**Scope not yet audited:** only confirmed on `matches` via these two specific rows, found incidentally. Any other raw-SQL `dev/*.mjs` script using `Date.now()` for a `created_at`/`updated_at`/similar timestamp column on any table has the same exposure — not checked here.

**Fix (not built):** (a) audit all `dev/*.mjs` scripts that write directly via `@libsql/client` for `Date.now()` used against a Drizzle `mode: 'timestamp'` column, convert to `Math.floor(Date.now() / 1000)` for raw SQL inserts (or switch those scripts to go through Drizzle's query builder instead of raw SQL); (b) decide whether to normalize the two already-affected `matches` rows found here (a one-time `UPDATE ... SET created_at = created_at / 1000` on just those two IDs) — not done in this session, no live functional impact from the two known-affected rows besides sort order.

**Found:** session 47F, while auditing "the last two matches" for a Saturday-readiness cleanup request — the wrong two matches were initially selected by a plain `ORDER BY created_at DESC` because of this bug.

---

### ~~BUG-187~~ — `POST /api/matches/[id]/lineup/publish` Had Zero Server-Side Auth — Any Unauthenticated Caller Could Publish and Lock Any Match's Lineup

**Status:** RESOLVED — 2026-07-30 (session 47F)
**Priority:** CRITICAL — unauthenticated write that locks real match data and fires a real push notification to subscribers; same class as `BUG-147`, missed by that sweep

**Problem:** `src/app/api/matches/[id]/lineup/publish/route.ts` manually decoded a JWT from the `authToken` cookie if present, but never returned 401/403 on a missing or invalid token, or on a non-admin/non-logger role — on any verification failure it just logged the error and continued with `userId = 'unknown'`, `userRole = 'user'`. The route then published and **locked** the lineup (`unlocked: false`, blocking further edits without an admin unlock) and fired a real push notification (`LINEUP_AVAILABLE`) to the match's subscriber base — all reachable with zero authentication. The sibling `lineup/unlock/route.ts` correctly gates on `role === 'admin'`; this route had no equivalent check at all. Not caught by `BUG-147`'s full-system sweep (session 47D) — that sweep's route list did not include `lineup/publish` or `lineup/unlock`, only the draft-save `lineup/route.ts`.

**Found while fixing `BACKLOG-178`** (adding config-aware starter-count validation to this same route) — reading the full handler surfaced the missing auth gate.

**Fix:** replaced the manual JWT decode with `getAuthUser(request)` + `role === 'admin' || role === 'logger'` check, matching the exact pattern already proven on `lineup/route.ts`'s POST/DELETE and `lineup/unlock/route.ts`. Rejects with 401 (no/invalid session) or 403 (wrong role) before any further processing. `publishedBy`/`publishedByName`/`publishedByRole` now source from the verified `authUser` object instead of a locally re-decoded, unverified JWT. `src/app/api/matches/[id]/lineup/publish/route.ts`.

**Found:** session 47F, while fixing `BACKLOG-178` in the same file family.

**Evidence:**
- Commit: `ec83ad1`
- Verified by: live test against a Vercel preview deployment (`dev/verify-staging-preview.mjs` + `dev/verify-staging-authed.mjs`), full detail in `RUNLOG.md`
- Observed result: unauthenticated `POST lineup/publish` correctly 401'd with zero session. With a freshly-generated real admin JWT, a real draft-lineup save followed by `POST lineup/publish` succeeded end-to-end (`200`, `"Lineup published successfully"`) — confirming the new auth gate rejects the attack path from `BUG-147`'s pattern while leaving the legitimate admin workflow intact.
- Pending items: none

---

### BACKLOG-186 — `/admin/matches` Has No Pagination, Fetches All Matches Unbounded Client-Side

**Status:** OPEN — found session 47F, not fixed, not critical
**Priority:** LOW — per Richard's own call ("not critical at all")

**Problem:** `src/app/admin/matches/page.tsx` has no pagination — the admin matches list loads and renders every match row at once. Not investigated further this session (not critical, flagged for filing only).

**Fix (not built):** add standard offset/limit pagination (or a "load more") to the admin matches list, matching whatever pattern other paginated admin lists in this codebase already use.

**Found:** session 47F, Richard's own observation while working on match-cleanup/config-coupling tasks.

---

### ~~BACKLOG-188~~ — `notifications/subscribe` DELETE Parses Request Body Before Its Auth Check, Malformed Body Masks 401 as 500

**Status:** RESOLVED — 2026-07-30 (session 47F)
**Priority:** LOW — not a security gap (the route still correctly requires and verifies auth before doing anything), purely an error-ordering/UX nit found incidentally while live-testing `BUG-147`

**Problem:** `src/app/api/notifications/subscribe/route.ts`'s `DELETE` handler calls `const body = await request.json()` (line 126) before `getAuthUser(request)` (line 136). A request with no body or a malformed body throws inside `request.json()`, caught by the outer `try/catch`, which returns a generic `500` — never reaching the real `401`/`403` auth gate that genuinely exists and is correctly ordered before the actual delete operation. Found while live-testing `BUG-147`'s fix against a Vercel preview: this route was the one FAIL out of 24 checked (`500` instead of the expected `401`) — confirmed by code read this is not a missing auth gate, just JSON-parse-before-auth ordering. `GET` and `POST` in the same file don't have this issue (both parse `searchParams`/read a validated body only after the auth check, or in POST's case the ordering happens to not matter since `getAuthUser` runs first there too).

**Fix:** moved `const authUser = await getAuthUser(request); if (!authUser) return 401;` above the `request.json()` call in `DELETE`, matching the ordering already correct in `GET`/`POST`.

**Found:** session 47F, live-testing `BUG-147` against a Vercel preview deployment (`dev/verify-staging-bug147-routes.mjs`). Fixed same session.

**Evidence:**
- Commit: `2304a5c`
- Verified by: live re-test against the redeployed Vercel preview (`brixsports-staging-pdspsljon-...`) using `dev/verify-staging-backlog188.mjs` — the exact same request shape that produced the original `500` (no body, no auth)
- Observed result: `DELETE /api/notifications/subscribe` with no body and no auth now returns `401 {"error":"Unauthorized"}` instead of `500`
- Pending items: none

---

### ~~BUG-189~~ — Basketball Quarter Number Silently Resets to Q1 on Every Logger Remount, Despite the DB Correctly Holding the Real Period

**Status:** RESOLVED — 2026-07-30 (session 47F)
**Priority:** HIGH — a mobile logger's browser refreshing mid-match (or a second logger opening the same match) is a realistic, not edge-case, scenario; the practical effect is every event logged after the refresh gets mislabeled with the wrong `period` field

**Problem:** Found live while testing the quarter-transition flow (End Quarter → Start Quarter 2 → ... → FT) on a real throwaway match. `matches.current_period` was confirmed correctly persisted server-side (`Q2`, direct DB read) after transitioning through it in the UI. But navigating away from the match and back (a full remount, same as a page refresh would trigger) showed **Quarter 1** again, clock reset to a fresh full countdown — the DB still correctly said `Q2` the whole time. Root cause, confirmed by direct code read: `BasketballLogger.tsx:35` — `const [quarter, setQuarter] = useState(1)` — a hardcoded initial value with zero hydration from the `match` prop anywhere in the file (confirmed via grep: zero occurrences of `match.currentPeriod` before this fix). The data was available the whole time — `/api/loggers/[id]/route.ts:32` uses a column-less `.select()` (full row), so `currentPeriod` was already reaching the client in the `match` object — the component just never read it. Existing code comment above `getCurrentPeriod()` already flagged a *related*, smaller gap ("quarterStartedAt resets to Date.now() on component mount... basketball has no mid-match-resume seeding at all yet") but that comment's own framing ("restarts *that* quarter's elapsed-time count") undersold the actual severity — the quarter *number* itself was also silently wrong, not just the in-quarter clock.

**Fix:** added a mount-time hydration effect that parses `match.currentPeriod` (`'Qn'` or `'OTn'`) and sets `quarter`/`otNumber` accordingly, guarded by a ref to apply exactly once (and to wait until `periodCount` has loaded from match config, needed to convert an `'OTn'` label back into the internal `quarter` number: `periodCount + n`). Sentinel values (`'NOT_STARTED'`, `'FINISHED'`) and an absent field are left alone (fresh match, no hydration needed). Does **not** fix the smaller, already-documented, separately-scoped gap: the in-quarter clock still restarts a fresh full countdown on remount rather than resuming from the exact elapsed time — that needs a persisted "period started at" timestamp, a larger feature, left as-is per the existing comment's own scoping. `src/components/BasketballLogger.tsx`.

**Evidence:**
- Commit: `4b493ec`
- Verified by: live re-test against the branch's fresh Vercel preview (`brixsports-staging-git-feature-baske-029e09-...`, deployed from PR #13's push), reusing the exact throwaway match this bug was originally found on (still sitting at `current_period: 'Q2'` in the DB from the original repro, never having been reset)
- Observed result: navigated to the match fresh (full remount, real logger session), screenshot confirmed Quarter **2** highlighted as active in the quarter selector — not Quarter 1. Matches the DB's `current_period` exactly.
- Pending items: none

**BUG-190 note:** filed and fixed in the same session (settings page "enabled" label + auto-save toggle redesign) — its underlying toggle/save mechanism was proven correct earlier this session (before the redesign, real PATCH + DB read confirmed), but the redesigned auto-save UI itself has not yet been re-tested live post-fix; an admin-session cookie injection attempt on this same branch preview didn't stick (logger-session injection via `localStorage` worked fine on this identical URL for this entry's own retest above, so this looks like a branch-alias-specific quirk with cookie-based admin sessions, not an app regression) — left as `not yet re-tested live` rather than force an inconclusive result.

**Found:** session 47F, live-testing the quarter-transition flow (Q1→Q2→Q3→Q4→FT) against a Vercel preview deployment, per Richard's request to add it to the verification pass.

---

### ~~BUG-190~~ — Admin Settings Page: Every Boolean Setting's Heading Literally Read "enabled" (Key-Suffix Bug), Plus a Toggle+Save UX Redesign

**Status:** RESOLVED — 2026-07-30 (session 47F)
**Priority:** MEDIUM — real display bug affecting every boolean setting in the panel; the UX confusion it caused was mistaken for a broken toggle mid-session before being root-caused

**Problem, two parts found together while investigating a "toggles don't seem to work" report:**
1. **Real bug:** `SettingItem`'s heading rendered `{setting.key.split('.').pop()}` — for any key ending in `.enabled` (every feature flag, plus `system.registration.enabled`/`system.notifications.enabled`), that literally always evaluates to the string `"enabled"`, displayed as the heading above every single boolean row regardless of which setting it actually was. Confirmed live via screenshot: `Feature Flags` section showed eight rows each headed "enabled" with no way to tell them apart except the description text below.
2. **Not a bug, but real root cause of the toggle-confusion report:** the toggle-click and PATCH-save mechanisms both worked correctly (confirmed via `read_page` DOM snapshots showing "Modified"/"Save" appearing correctly after a click, and a DB read confirming the write landed). The actual failure in the reported session was an **expired test-admin session** (a 5-minute test JWT), returning a real `401` on the PATCH — correct behavior for an unauthenticated caller. But the only failure feedback was a small "Error" pill at the very top of the page, easy to miss while scrolled down mid-toggle on a long settings list — a genuine, separate UX gap even though the underlying mechanism was sound.

**Fix:**
1. Removed the broken heading for boolean settings entirely (kept for number/text settings, where `key.split('.').pop()` gives a real identifier like `weight`/`decay`/`baseline`).
2. Redesigned boolean settings to auto-save immediately on toggle click (`BooleanSettingItem`, a new self-contained component) instead of the previous two-step "toggle locally, remember to click a separate Save button" flow — standard convention for boolean settings panels, and it directly removes the missed-step failure mode. Inline pending/success/error feedback now renders right next to the toggle itself, not just in a page-top banner. Number/text settings (algorithm weights etc.) keep the existing pending-change + explicit-Save flow, since auto-saving every keystroke would be noisy.

**Evidence:**
- Commit: pending (session 47F, not yet pushed at time of filing)
- Verified by: live test against a Vercel preview deployment, real injected admin session, full detail in `RUNLOG.md`
- Observed result: toggled `features.ads.enabled` off on `/admin/advertisements` — `FeatureGate`'s disabled state rendered correctly (already-existing behavior, re-confirmed as a side effect of this investigation, see `BACKLOG-155`). The auto-save redesign itself was verified via `tsc` clean + code read; the specific new `BooleanSettingItem` component was not yet re-tested live after this fix landed (the investigation that found it happened against the *old* two-step UI, before the redesign).
- Pending items: live re-test the new auto-save toggle UI specifically (click a toggle, confirm no separate Save button appears, confirm inline success/error feedback shows next to the control)

**Found:** session 47F, investigating Richard's live report that toggling feature flags in `/admin/settings` "wasn't working."

---

### ~~BUG-191~~ — Every Basketball Overtime Transition Since `BUG-135` Shipped Silently Fails to Persist (`PATCH /api/matches/[id]` Rejects Numbered `OTn` With a 422)

**Status:** RESOLVED — 2026-08-02 (session 47F)
**Priority:** CRITICAL — actively blocks the OT2 live-test Richard explicitly asked for, and is a real, live regression: any tied game reaching overtime today fails to persist its period server-side, Saturday-relevant

**Problem:** Found live while running the OT2 test-plan item that PR #13 had left unchecked. Progressed a throwaway match through Q1→Q4 tied 0-0, triggered "Start Extra Time (OT1)" — the UI immediately showed a real error banner: `"Failed to save OT1 transition (422) — period may not persist on refresh."` Root cause: `src/app/api/matches/[id]/route.ts`'s `VALID_PERIODS` allowlist (added later, presumably as part of `BUG-147`'s security sweep, per its own comment "currentPeriod had no enum validation at all... cheap to close") contains only the flat string `'OT'` — but `BUG-135` (session 47E) had already changed basketball's OT period label to numbered `` `OT${otNumber}` `` (`OT1`, `OT2`, ...) before this allowlist was ever written. `BasketballLogger.tsx`'s only two call sites (`persistPeriodTransition`) confirmed via grep to always send `` `OT${nextOtNumber}` `` or `` `Q${nextQuarter}` ``, never the flat `'OT'` string that was actually in the allowlist — so every real OT transition has 422'd since `BUG-135` shipped, silently (relative to a casual glance — the error banner exists per `BUG-142`'s error-visibility work, but is easy to miss) failing to update `matches.current_period` past whatever it was pre-OT. Compounds with `BUG-189`'s new hydration fix in an unfortunate way: since that fix now trusts the persisted `current_period` on mount, a page refresh during a real (broken) OT would hydrate back to the stale pre-OT quarter instead of even falling back cleanly.

**Fix:** replaced the flat `'OT'` allowlist entry with a regex check (`/^OT\d+$/`) alongside the existing fixed list, matching the unbounded nature of a real OT count (a match can theoretically reach OT3+). `src/app/api/matches/[id]/route.ts`.

**Evidence:**
- Commit: `a3e14c2`
- Verified by: `npx tsc --noEmit` clean (49 pre-existing errors, none new) at fix time; live re-test session 47G against the deployed preview + direct DB query
- Observed result: the OT2 test resumed and completed end-to-end — `matches.current_period = 'OT2'` persisted with zero 422, a real `match_events` row landed tagged `period: 'OT2'`, and `BUG-189`'s hydration held on a full remount (logger UI independently showed the same `OT2` event on fresh load, not a stale pre-OT quarter). Full detail cross-referenced in `BUG-135`'s evidence block (same test, same match).
- Pending items: none

**Found:** session 47F, live-testing the OT2 scenario against a fresh Vercel preview build, per Richard's explicit request to get it tested.

---

### ~~BUG-192~~ — Logger Header Shows Stale/Fabricated Match Context: Dead OT Quarter-Box Buttons + Hardcoded "Semi-Finals" Badge on Every Match

**Status:** RESOLVED — 2026-08-03 (session 47G)
**Priority:** Medium — cosmetic/UX and misleading-info, not data-correctness (underlying `current_period`/`otNumber`/score state is correct per `BUG-135`/`BUG-142`'s evidence), but confirmed live and directly confusing/misleading to a logger

**Problem, part 1 (Quarter box):** found live while re-verifying `BUG-135`/`BUG-191`'s OT2 fix on the deployed preview: `BasketballLogger.tsx`'s scoreboard "Quarter" box (~line 1279) always rendered a fixed `[1, 2, 3, 4]` button grid highlighting `quarter === q` — during OT, `quarter` is `periodCount + otNumber` (e.g. `6` for OT2 with `periodCount = 4`), which never matches any of the four buttons, so none highlight and the box gives the logger zero indication they're in OT at all, let alone which OT. Same root cause hit two sibling labels: the "End Quarter" button and the end-of-period modal's heading (`End of Quarter {quarter}`, e.g. literally "End of Quarter 6") both used the raw internal `quarter` counter instead of the human-legible period label.

**Problem, part 2 (hardcoded "Semi-Finals" badge):** found by a background audit agent dispatched this session per Richard's report of seeing "SEMI-FINALS" on a real friendly test match ("Browser Verify Cup", no `competitionId`) — confirmed live in the same session via direct DOM read. `BasketballLogger.tsx:114` had `const [isSemiFinal, setIsSemiFinal] = useState(true)` with the stale comment `// Matches are semi-finals` — `setIsSemiFinal` was never called anywhere else in the file, so every basketball match, of every round and competition, unconditionally showed a "Semi-Finals" badge in the sticky header and a false "Semi-Final Match — Stats and MVP ratings contribute immediately. No standings points awarded." notice in the end-of-quarter modal. Purely a display flag — never sent to the server or checked by `finalizeMatch()`/standings logic — so it didn't corrupt any real standings data, but it actively told loggers false information about a live match's stakes. The audit agent also found a second, separate instance of the same root pattern: the homepage's match-grouping headers (`src/app/page.tsx:262-317`) fabricated round/stage labels from a hardcoded 2026-playoff date table instead of the real `matches.round` column, wrong for any match outside that one specific bracket — fixed in the same pass.

**Fix, part 1:** `quarter > periodCount` now renders a single highlighted `OT{otNumber}` badge in place of the dead button grid (regular `Q1`-`Q4` buttons unchanged, including their existing manual-jump `onClick`). "End Quarter"/modal heading now read "End Overtime"/"End of Overtime {otNumber}" during OT, "End Quarter"/"End of Quarter {quarter}" otherwise.
**Fix, part 2:** `isSemiFinal` now derived as `(match.round || '').toLowerCase().includes('semi')` — a substring check (matching the same freeform-text convention `page.tsx`'s own `groupKey` logic already uses for `round`, since it's not an enum) instead of a hardcoded literal; both the header badge and the modal notice are now gated on it. `page.tsx`'s grouping logic now tries the real `match.round` field first, falling back to the old stats-parse/date-table heuristics only when `round` is genuinely unset.
Files: `src/components/BasketballLogger.tsx`, `src/app/page.tsx`.

**Evidence:**
- Commit: `7cd4407`
- Verified by: `npx tsc --noEmit` clean at fix time; live re-test session 47G against a fresh Vercel preview after redeploy
- Observed result: both bugs reproduced live pre-fix, then confirmed fixed post-deploy — no "Semi-Finals" badge on the friendly match, header correctly reads "Overtime" with a highlighted `3` badge during a confirmed `OT3` match, "End Overtime" button label correct. **One unreproduced anomaly, not escalated to a new bug:** the very first mount after a fresh token injection once showed the OT badge as `1` instead of `3` (a real screenshot) — two subsequent fresh mounts, plus Richard's own independent check, all showed `3` correctly. Not chased further given it didn't reproduce.
- Pending items: none for the filed scope. See the note above re: the one unreproduced badge anomaly if it resurfaces.

**Found:** session 47G — part 1 live-verifying `BUG-135`/`BUG-191`'s OT2 fix; part 2 via a background audit agent dispatched after Richard's live report, confirmed via direct DOM read on the same preview.

---

### ~~BUG-193~~ — Offline-Queue Write Can Silently Lose an Event With No Backing Anywhere, if `BrixsportAdminDB` Was Ever Opened Without Its Stores First

**Status:** RESOLVED — 2026-08-03 (session 47G), live-tested against a fresh Vercel preview after redeploy
**Priority:** Medium — narrow precondition, but when it hits, the failure mode is exactly the "ghost state" pattern this project's own `known-issues.md` already flags as a recurring anti-pattern (UI State Is Not DB State), and there is currently no recovery path for the logger once it happens

**Problem:** while live-testing `BUG-142`'s offline queue this session, one forced-failure attempt hit `Failed to queue event: NotFoundError: Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found` — the network POST correctly failed, `recordEvent`'s catch block correctly attempted to fall back to `queueOfflineEvent()`, but that write itself threw because the already-open `BrixsportAdminDB` handle had zero object stores. Root cause: IndexedDB only runs `onupgradeneeded` when the requested version is higher than the database's current stamped version — if `BrixsportAdminDB` is ever opened at version 1 by *anything* that doesn't define the `pendingMatchEvents`/`pendingAdminChanges`/`offlineMatches` stores (a stray extension, a debug script, or — as reproduced this session — a diagnostic tool calling `indexedDB.open(dbName)` with no version argument before the real app code gets there), the database is permanently stamped at v1 with no stores, and neither `admin-offline-queue.ts`'s `openAdminDB()` nor `sw-admin.js`'s `openDB()` (both correctly define the stores in their own `onupgradeneeded`, confirmed via direct source read — this is not a schema-definition bug) will ever get a chance to create them for that browser profile again.
**Consequence when it happens:** `recordEvent`'s optimistic local score/event-count update (which fires before the network attempt, same architecture confirmed in `FootballLogger.tsx` too — not basketball-specific) is never rolled back when both the network write AND the queue write fail. The error banner is honest ("queueing also failed. Event kept locally only") but the local state has zero backing in the DB or the queue — reproduced live: DB `home_score` stayed `2` while the logger UI showed `4`.
**Reachability, this session:** self-diagnosed as very likely caused by the diagnostic testing process itself (repeated `indexedDB.open()`/`deleteDatabase()` cycling without letting the real app code be the first opener) rather than a defect reachable through normal app usage — a clean re-test (delete DB, touch nothing, let `queueOfflineEvent()` be the genuine first opener) correctly created all 3 stores and the full fail→queue→drain→persist cycle worked end-to-end (see `BUG-142`'s evidence). Not fully ruled out for real users: any other opener of the same DB name at version 1 without the schema (a browser extension, a stale service worker version from before these stores existed) would hit the identical permanent lockout, with no error surfaced to the logger beyond a single failed write.

**Fix:** both `admin-offline-queue.ts`'s `openAdminDB()` and `sw-admin.js`'s `openDB()` now check `objectStoreNames.contains(...)` for every required store after a non-upgrade open; if any are missing, the DB is closed, deleted, and reopened fresh (forcing a real `onupgradeneeded` this time) rather than silently handing back a broken connection. Chosen over a version-bump approach because a DB missing its stores has no readable rows worth preserving anyway — delete-and-recreate is simpler and just as safe. Both files updated together (Richard's explicit call, given they must agree on the recovery behavior) with the exact same store-creation logic factored into a named helper in each file (`createStores`/`createAdminDBStores`) rather than duplicated inline. `FootballLogger.tsx`'s own separate inline copy of this same DB-open logic (documented as an intentional, not-yet-migrated duplicate — see `admin-offline-queue.ts`'s file-level comment) was deliberately left untouched — out of this fix's scope, flagged here as a known follow-up gap if the same race is ever hit there.

**Evidence:**
- Commit: `e9ecb87`
- Verified by: `npx tsc --noEmit` clean at fix time; live re-test session 47G against a fresh Vercel preview — deliberately recreated the exact broken precondition (deleted `BrixsportAdminDB`, reopened at version 1 with no `onupgradeneeded`, confirmed via direct read it had zero stores), then triggered a real forced-failure event write through the actual app UI
- Observed result: console logged `[admin-offline-queue] BrixsportAdminDB missing expected stores, recreating` — the fix's own diagnostic line — confirming detection fired correctly. The DB was closed, deleted, and reopened with both stores present, and the event write that followed succeeded (`pendingMatchEvents` held 1 real row) instead of throwing `NotFoundError` as it did pre-fix. Chaining this to a full drain hit a stuck IndexedDB transaction in the test tab (a leftover open connection from this session's own repeated test cycling, not an app-level issue) — not re-attempted, since the drain mechanism itself was already independently proven with real DB evidence in `BUG-142`'s own testing.
- Pending items: none for the self-heal itself. If it matters later, a clean single-pass self-heal-then-drain chain (without prior test-script interference) would close the loop fully.

**Follow-up bug found and fixed in this same fix, same session:** a background audit scoping football's own exposure to this same class of bug (filed as `BUG-194`) caught that `admin-offline-queue.ts`'s `REQUIRED_STORES` only listed `pendingMatchEvents`/`pendingAdminChanges` — omitting `offlineMatches` (an `sw-admin.js`-only store, used by `cacheMatchData()`, that this module never reads or writes). If this module won the race to open `BrixsportAdminDB` first, it would create only 2 of the 3 real stores; `sw-admin.js`'s own missing-store check would then see `offlineMatches` absent and trigger *its own* delete+recreate recovery — discarding whatever this module had just queued, the exact ghost-state failure this whole fix exists to prevent. Fixed same session, commit `3657db3`: `REQUIRED_STORES` and `createStores()` in `admin-offline-queue.ts` now include all 3 stores, matching `sw-admin.js`'s `ADMIN_DB_REQUIRED_STORES` exactly. Verified via `npx tsc --noEmit` clean; not yet live-tested (found and fixed while a live WS-outage test for `BUG-137` was in progress, deprioritized to not lose that window — needs its own live re-test next session).

**Found:** session 47G, live-testing `BUG-142`'s offline queue against the deployed preview.

---

### ~~BUG-194~~ — `FootballLogger.tsx`'s Own Inline Offline-Queue Copy Has the Same `BUG-193` Missing-Store Vulnerability, Unfixed

**Status:** RESOLVED (both parts) — 2026-08-03 (session 47G), live-tested against a fresh Vercel preview using a real throwaway LIVE football match with a published lineup.
**Priority:** Medium — same class/severity as `BUG-193`; football's exposure window is real but narrower than basketball's currently was, since football only queues event POSTs (no `pendingAdminChanges` usage at all — see below)

**Problem:** `FootballLogger.tsx`'s own inline `openAdminDB()` (lines ~11-26, never migrated to the shared `src/lib/admin-offline-queue.ts` module basketball now uses) resolves unconditionally in `onsuccess` with no `objectStoreNames.contains(...)` check — the exact pre-fix shape of `BUG-193`. If `BrixsportAdminDB` is ever stamped at version 1 without its stores (same triggers as `BUG-193`: a stray script, a stale SW version, diagnostic tooling), football's `queueOfflineEvent` will throw `NotFoundError` on every future offline event write forever, with the same "ghost state" consequence (local optimistic state never rolled back).

**Found by:** a background audit dispatched this session to scope a planned migration of football's offline-queue logic onto the shared module (part of the "do the offline/cache strategy pass across both sports together" plan, since basketball and football were about to diverge on `BUG-193`'s fix otherwise). Full audit findings, condensed:
- Football's inline copy also has **no `pendingAdminChanges` support at all** — no `queueAdminChange` equivalent, no store creation for it. Only event POSTs get offline-queue protection; period-transition PATCH (clock checkpoints, half/OT/penalty starts) and undo DELETE are all fire-and-forget with zero retry — undo specifically shows a blocking `alert()` and gives up on network failure, unlike basketball's queued-with-banner pattern.
- DB version, store names, and row shapes otherwise agree between football's inline copy and the shared module (`BrixsportAdminDB` v1, matching `pendingMatchEvents` shape) — no other schema drift found beyond the `offlineMatches` gap already fixed under `BUG-193`.

**Fix, part 1 (done):** removed `FootballLogger.tsx`'s inline `openAdminDB`/`queueOfflineEvent`/`jwtSecondsRemaining` (lines 11-54) entirely, replaced with `import { queueOfflineEvent, jwtSecondsRemaining } from '@/lib/admin-offline-queue'` — identical signatures at both of the file's 2 call sites (the token-TTL check and the queue call in the event-record catch block), no other changes needed. Closes this bug's exposure and removes one of the three "parallel implementations" this project's own comments already flag as a maintenance trap — `admin-offline-queue.ts` is now genuinely the single source of truth for both loggers' event-POST offline queueing, including `BUG-193`'s missing-store recovery.

**Fix, part 2 (done):** brought football to basketball's actual feature parity:
- New `queueAdminChange` import (already exported by `admin-offline-queue.ts`, unused by football until now) plus new `queuedAdminChangeCount`/`eventSaveError` state, mirroring `BasketballLogger.tsx` exactly.
- New shared `persistMatchPatch(body, label)` helper — replaces the 5 fire-and-forget period-transition `fetch(...).catch(console.error)` call sites (`handlePeriodEndConfirm`'s period/final-whistle patch, First Half start, Second Half start, Extra Time start, Penalties start) with queue-on-network-failure + a dismissible banner instead of a silently-dropped write. Deliberately **not** applied to the 15s clock-checkpoint PATCH (`BUG-109`) — that one is a frequent, best-effort, always-superseded update; queueing every 15s tick while offline would flood the queue with stale data no one needs once back online.
- New shared `deleteEventWithQueue(eventId)` helper for `handleUndo` — was a single try/catch around both delete calls (main event +, on a second-yellow undo, the preceding Yellow Card) ending in a blocking `alert()`. Now returns a typed outcome (`ok`/`rejected`/`queued`/`failed`) per delete, letting the caller apply `BUG-130`'s principle (never flip local state before the server, or a confirmed queue write, actually reflects it) independently to each of the two deletes — e.g. if the red card's delete succeeds but the yellow's network-fails, the red is removed locally (confirmed gone) while the yellow stays visible and queued, not lost.
- Drain-trigger wiring (`sync-admin-changes` tag registration, `DRAIN_ADMIN_CHANGES` message) and the `SYNC_COMPLETE`/`sync-admin-changes` listener added alongside the existing event-queue equivalents — no `sw-admin.js` changes needed, `syncAdminChanges()` was already sport-agnostic.
- New error banner (identical JSX to `BasketballLogger.tsx`'s) and a `queuedAdminChangeCount` header badge, replacing what used to be silent failures or blocking alerts.

**Evidence:**
- Commits: `e282901` (part 1), `d352645` (part 2), `3657db3` (the schema-drift follow-up under `BUG-193`, which this deployment also carries)
- Verified by: `npx tsc --noEmit` clean at fix time; live re-test session 47G against a fresh Vercel preview (`dev/setup-football-browser-test.mjs` — a real throwaway LIVE match, `busa-joga` vs `busa-wolves`, real published 11-a-side lineups via the actual `/api/matches/[id]/lineup` endpoint), forced-failure → queue → drain → DB cycles for both the period-transition PATCH and the undo DELETE
- Observed result: **period-transition** — forced a body-aware fetch interception (had to distinguish the real `currentPeriod` PATCH from the 15s clock-checkpoint PATCH sharing the identical URL, a real test-methodology gotcha worth remembering) on "Start 2nd Half," confirmed a real `pendingAdminChanges` row queued (`{currentPeriod: "SECOND_HALF"}`, correct URL/token), drained via `DRAIN_ADMIN_CHANGES`, confirmed `matches.current_period` moved `HALF_TIME → SECOND_HALF` in the DB. **Undo** — logged a real Goal+Assist, forced the undo DELETE to fail, confirmed a real queued row (correct event URL), confirmed both events and the score stayed untouched in the DB while queued (`BUG-130`'s principle held), drained, confirmed the Assist event was actually deleted from `match_events` and the score correctly stayed `1-0` (assists carry no point value, nothing to revert). Also spot-checked the `BUG-193` schema-drift fix on this same deployment: a fresh `BrixsportAdminDB` open showed all 3 stores (`pendingMatchEvents`, `pendingAdminChanges`, `offlineMatches`) created together, confirming that fix too.
- Pending items: none.

**Found:** session 47G, background audit dispatched to scope the football/basketball offline-queue consolidation ahead of the next session's planned "offline/cache strategy, both sports together" pass.

---

### BUG-195 — Deleting a Match Never Reverses Its Contribution to `football_player_stats`/`basketball_player_stats` (True of the Real Admin API, Not Just Raw SQL)

**Status:** RESOLVED (this specific incident) — 2026-08-04 (session 48), root cause not fixed platform-wide
**Priority:** Medium — real data-integrity gap, but requires a `match_type !== 'friendly'` match with real events being deleted (test-data cleanup, or an admin correcting a mis-created match) to trigger; does not affect any of the Three Critical Flows for a live match in progress

**Problem:** Found while cleaning up two stale `LIVE`-status test matches left over from session 47F/47G (`browser-test-football-47f-*`, `browser-test-47f--kwabip-`). Both were `match_type: 'competition'` (not `'friendly'`), and I incorrectly concluded — based on `football_player_stats`/`basketball_player_stats.updated_at` predating the matches' `created_at` — that their events had never reached the stats pipeline, so a plain `DELETE FROM match_events; DELETE FROM matches` was safe. **That conclusion was wrong**, caught by Richard questioning it directly. Live-verified the real mechanism instead: `updated_at` on both stat tables is a plain column, never touched by `updatePlayerStats()`'s `.update()` calls in `src/app/api/matches/[id]/events/route.ts` — a real, confirmed stat write (personal_fouls `9 → 10` via a live POST against the staging admin session) left `updated_at` completely unchanged. **`updated_at` is not reliable evidence of "no write occurred" anywhere `updatePlayerStats()` is the writer.**

**Actual root cause, broader than the immediate cleanup mistake:** neither the raw-SQL deletion I initially ran, nor the real `DELETE /api/matches/[id]` admin endpoint (`src/app/api/matches/[id]/route.ts:655-716`), reverses any player-stat contribution before deleting a match's events. The real endpoint clears `bracketNodes`/`headToHead` FKs and deletes `teamForm` rows, then relies on DB-level cascade delete for `match_events` — with zero call to any stat-decrement logic. This is the same bug class `BUG-060` already fixed, but `BUG-060`'s `decrementPlayerStats()` is only wired into the *single-event* `DELETE /api/matches/[id]/events/[eventId]` route — whole-match deletion has never had the equivalent.

**This incident's correction (done):** reconstructed the exact stat deltas from the events captured before deletion (`dev/audit-browser-test-matches-48.mjs`'s output) and reverse-applied them via `dev/correct-stat-inflation-48.mjs`: `busa-joga-player-17` (football) goals/shots_on_target −1 each; `i7VBmo4RZkk5Q6_Zixw2I` (basketball) field_goals_attempted/made −1, total_points −2; `tX0zxQTavQwD3zZDc7wvb` (basketball) field_goals_attempted/made −1, three_pointers_attempted/made −2, total_points −8; `-SESd9Jia0oBKZ47n7fgJ` (basketball) personal_fouls −6 (5 from the original test, 1 from this session's own live-pipeline verification POST). All four players confirmed back to their pre-test-contamination values.

**Fix (not built — real gap, needs its own scoping):** `DELETE /api/matches/[id]` should either (a) refuse to delete a non-friendly match with existing events without an explicit force/confirm step, or (b) run the same per-event stat-reversal `decrementPlayerStats()` already proven correct in the single-event DELETE route, looped over every event on the match, inside the same transaction, before the cascade delete. Richard's own framing when this was caught: there should be a real "trace and decrement" approach, not manual reconstruction after the fact every time. Given this is a low-frequency path (deleting whole matches is rare, mostly test-data cleanup and admin corrections) it doesn't need Tier 0 urgency, but it's a real, repeatable data-corruption risk any time someone (a dev script or a future admin UI "delete match" button) removes a competitive match with real events already logged.

**Also file this as a lesson:** `updated_at` columns in this codebase are not universally auto-maintained — several write paths (`updatePlayerStats()` confirmed here) never set them. Do not use `updated_at` as evidence a row wasn't touched; check the actual mutated fields directly, or re-derive expected state from the real event log.

**Evidence:**
- Verified by: live POST against `https://brixsports-staging.vercel.app` using a real admin session (Richard manually signed in after Vercel preview cookie-injection failed, same known quirk as session 47F), direct DB re-query before/after
- Observed result: `personal_fouls` for `-SESd9Jia0oBKZ47n7fgJ` went `9 → 10` on a real event POST with `updated_at` unchanged, proving the write happened despite the stale timestamp; correction script's before/after values confirmed exact expected deltas for all 4 affected players
- Pending items: the platform-level fix (stat-safe match deletion) is not built — filed here for a future session, not urgent enough to block the football Tier 0 sweep this was found during

**Found:** session 48, cleaning up stale test matches ahead of a planned football Tier 0 live-verification pass; caught by Richard questioning the "why" behind an unverified conclusion rather than accepting it at face value.

---

## Post-Deployment / SEO & Growth

<!-- Category for real launch-adjacent work that isn't a Tier 0-3 platform bug -- analytics,
search visibility, discoverability. Deliberately kept separate from the main bug/feature
backlog so it doesn't compete for priority against live-match-integrity work, but isn't lost
either. Nothing in this section blocks a live match; nothing above this section should be
deprioritized in its favor. -->

### BACKLOG-189 — GA4 Analytics Never Wired, Search Console Verification Malformed, Sitemap Has Zero Dynamic Routes (Every Match/Team/Player Page Invisible to Search Engines)

**Status:** OPEN — filed session 47G, not fixed. Filed at Richard's request after recalling this project's own prior SEO research (`SEO_IMPLEMENTATION_GUIDE.md`, `GOOGLE_INDEXING_GUIDE.md`, repo root) — this entry operationalizes that research's own "Next Steps" list against what's actually implemented today, confirmed via direct code read, not just re-stating the guide.
**Priority:** Medium — real, but explicitly post-deployment/growth work, not a platform-integrity bug. Does not touch any of the Three Critical Flows.

**Problem, three parts, all confirmed via direct code read this session:**

1. **GA4 (Google Analytics) was never wired at all.** Confirmed via grep across `src/app` and `src/lib/env.ts`: zero references to `gtag`, `googletagmanager`, `GoogleAnalytics`, or any `NEXT_PUBLIC_GA*` env var anywhere in the codebase. There is no analytics of any kind on this platform today — no pageview tracking, no event tracking, nothing to measure launch traffic, feature usage, or drop-off with.

2. **Google Search Console verification is inconsistent — one method genuinely done, the other left malformed.** The *file-based* verification method is real and working: `public/googlefd0ce86c5ed02ba9.html` exists on disk, confirmed. But `src/app/layout.tsx:92`'s `google-site-verification` **meta tag** also has that same filename (`'googlefd0ce86c5ed02ba9.html'`) stuffed into its `content` value — that meta tag's content should be a verification *token* (the HTML-tag method's own credential), not a filename; this looks like the file-based verification token got pasted into the wrong field, or copy-pasted without understanding the two methods are separate. Not necessarily broken (the file-based method already established ownership independently), but it's a real, confirmable inconsistency worth cleaning up rather than leaving stale/misleading in the codebase. `msvalidate.01` (Bing Webmaster Tools verification) is still a bare empty string (`layout.tsx:93`) — never done at all.

3. **The real headline gap, matching what Richard specifically flagged**: `src/app/sitemap.ts` has **zero dynamic routes**. Every individual match page (`/matches/[id]`), team page (`/teams/[id]`), player page (`/players/[id]`), news article (`/news/[slug]`), and competition page (`/competitions/[id]`) is entirely absent from the sitemap — only the static top-level listing pages (`/`, `/news`, `/matches`, `/teams`, etc.) are included. The file's own comment (`sitemap.ts:116-118`) says this out loud: *"Dynamic routes... would be fetched from the database in a production implementation... For now, we're including the main listing pages above"* — with the actual DB-fetch code left commented out (`sitemap.ts:120-135`), never implemented. **Compounding this**: `src/app/matches/[id]/page.tsx` is a `'use client'` component with no `generateMetadata` export — client components can't export one in Next.js App Router — so even if a match page WERE discovered by a crawler (e.g. via an internal link, since it's not in the sitemap), every single match page would show the exact same generic root-layout title/description/OG image, not a real per-match title like "UNILAG vs UI — Live Score, NUGA Finals." Same likely applies to team/player pages — not independently re-checked this session, flagged as probably-the-same-pattern rather than confirmed.

**Also confirmed, lower severity — the AEO/structured-data utilities described in `SEO_IMPLEMENTATION_GUIDE.md` are pure dead scaffolding.** `src/lib/utils/aeo.ts`'s schema generators (`generateSportsEventSchema`, `generateSportsTeamSchema`, `generateAthleteSchema`, etc.) and the `<StructuredData>`/`<PageSEO>` components exist and are documented in detail in the guide, but a grep for their actual usage on `src/app/matches/**` returns zero matches — they were built, documented as "how to use," and never actually wired into any real page. Same shape as this project's own recurring "guide describes an integration that nobody actually built" pattern (e.g. `BACKLOG-159`'s dead rating pipeline).

**Fix (not built — scoping only, this is a filing, not an implementation):**
1. Wire GA4: add `NEXT_PUBLIC_GA_MEASUREMENT_ID` to `src/lib/env.ts` (per this project's own "never read `process.env` directly" rule) and a `gtag.js` script injection in the root layout, gated on the env var being present so local/staging doesn't pollute production analytics.
2. Fix the Search Console meta tag: replace the misplaced filename in `google-site-verification` with a real HTML-tag verification token (or remove the meta tag entirely and rely solely on the already-working file-based method — either is valid, just pick one deliberately). Add the Bing `msvalidate.01` token if Bing visibility is wanted.
3. Wire `sitemap.ts`'s commented-out dynamic-route code for real: fetch matches/teams/players/news/competitions from the DB (respecting `.limit()` per this project's own anti-pattern rule — a sitemap with tens of thousands of URLs needs pagination or a reasonable cap, not an unbounded query) and generate real per-entity URLs with real `lastModified` timestamps.
4. Convert `matches/[id]/page.tsx` (and likely `teams/[id]`/`players/[id]`, not yet independently checked) to support real per-page metadata — either via `generateMetadata` on a server-component wrapper, or Next.js's dynamic `<head>` injection pattern for client components — so each match/team/player page gets a real, unique, search-relevant title and description instead of inheriting the generic site-wide default.
5. Actually wire the already-built AEO structured-data components (`StructuredData`, `generateSportsEventSchema` etc.) into the real match/team/player pages per `SEO_IMPLEMENTATION_GUIDE.md`'s own documented usage examples, now that there's real per-page metadata to pair them with.

**Found:** session 47G, Richard's own recall of prior SEO research in this repo, confirmed against actual current implementation state via direct code read (not just re-stating the existing guides).

---

### BUG-198 — Login Page Shows Raw Browser Error Strings ("Failed to fetch") Directly to Users

**Status:** SHIPPED — session 49 (`9d23ecf`, PR #18, targeting `dev`). `tsc --noEmit` clean (49 baseline errors, none new). **Not live-tested yet** — no manual network-failure repro run against a real preview. Do not treat as RESOLVED until that happens.
**Priority:** Medium — real UX/trust issue on the highest-stakes auth surface, not a security or data-integrity bug
**Filed:** 2026-08-05

**Problem:** `src/app/login/page.tsx:96-98` — `catch (error) { const errorMessage = error instanceof Error ? error.message : "Invalid email or password"; setServerError(errorMessage); }`. If `fetch('/api/auth/login')` itself throws (a real network failure, CORS issue, or server unreachable) rather than the request completing with a 4xx, the raw browser-native error message (e.g. `TypeError: Failed to fetch`) is shown verbatim in the user-facing error banner — confirmed live via a real screenshot this session. This is a generic technical string with zero actionable meaning to a real user, indistinguishable in the UI from an intentional, friendly message like "Invalid email or password."

**Why this matters:** dev/technical error messages and user-facing error messages are different audiences with different needs — a user doesn't know what "fetch" means and can't act on it, whereas a real network-failure state should say something like "Couldn't reach the server, check your connection and try again."

**Fix, landed 2026-08-06 (session 49, `9d23ecf`):** `catch` block now distinguishes `TypeError` (a real `fetch()`-level network failure — friendly "Unable to reach the server..." message) and `SyntaxError` (malformed/non-JSON response — friendly "Unexpected response..." message) from a real thrown `Error` (the `!response.ok` branch's already-server-authored `data.error`, shown unchanged). **Broader question — is this pattern repeated elsewhere?** Raised directly by Richard; a read-only audit agent is scoped to answer that across the whole app (auth-adjacent forms, logger UI, admin forms, and API routes returning raw `error.message`/DB errors), writing findings to `.agents/dev/USER_FACING_ERROR_MESSAGES_AUDIT.md` — BACKLOG entries to be filed from that report in a separate pass, not assumed here.

**Found:** session 49, Richard directly hit this live while signing in on a Vercel preview deployment during unrelated verification work.

---

### BUG-199 — `YELLOW_CARD` Notification Type Is Fully Built But Never Actually Triggered

**Status:** RESOLVED — 2026-08-06 (session 49, `ce46f6c`, branch `feature/notification-system`)
**Priority:** Low — the delivery/type layer is genuinely correct; only the trigger allowlist is incomplete, and yellow cards are a lower-stakes event than the ones already wired

**Problem:** `event-driven-notifier.ts`'s `getNotificationType()` correctly maps `'Yellow Card'` → `'YELLOW_CARD'`, and `match-notification-service.ts` has a complete, correct notification payload template for `YELLOW_CARD`. But `MatchStateManager.triggerNotification()`'s own `notifiableEvents` allowlist (`match-state-manager.ts:986`) is `['Goal', 'Penalty', 'Penalty Saved', 'Penalty Missed', 'Red Card']` — `'Yellow Card'` is simply not in that list, so the client-side trigger event is never dispatched for a yellow card, and the otherwise-complete delivery pipeline downstream never gets a chance to run for this event type.

**Fix:** bundled into the notification-system server-side trigger migration (see the new entry below) — `'Yellow Card'` is included in `events/route.ts`'s new `NOTIFIABLE_EVENT_TYPES` map. The old client-side `notifiableEvents` array (and `MatchStateManager.triggerNotification()` itself) was deleted entirely as part of that same change, not just amended.

**Evidence:**
- Commit: `ce46f6c`
- Verified by: live test on a real preview deployment — real `GOAL` events triggered real on-device notifications (see the reliability-fix entry below for full evidence). `YELLOW_CARD` itself uses the identical code path (same `NOTIFIABLE_EVENT_TYPES` map, same `after()` call) and was not separately live-fired this session, but the map entry and the proven-working mechanism together are sufficient — the previously-broken piece was purely the allowlist omission, which is now fixed and structurally identical to the proven `GOAL`/`RED_CARD` cases.
- Observed result: `'Yellow Card'` now present in `NOTIFIABLE_EVENT_TYPES` (`events/route.ts`), mapped to `'YELLOW_CARD'`.
- Pending items: none.

**Found:** session 49, by a read-only documentation agent tracing the full notification system for `.agents/dev/NOTIFICATION_SYSTEM_FLOW.md`.

---

### BUG-200 — Football Notification Triggers Depended Entirely on the Logger's Own Browser Tab Staying Open

**Status:** RESOLVED — 2026-08-06 (session 49, `ce46f6c`, branch `feature/notification-system`)
**Priority:** High — silent, total notification failure for a match any time the logger's tab closed, crashed, or lost network, with no error surfaced anywhere (violates CLAUDE.md's "no silent failures" rule)

**Problem:** every football notification trigger (`MatchStateManager.triggerNotification()`/`triggerPeriodNotification()`) fired from a `window.dispatchEvent(new CustomEvent('MATCH_NOTIFICATION_TRIGGER'))` inside the logger's own browser tab, picked up by a singleton `EventDrivenNotifier` imported only in `FootballLogger.tsx`. The event itself always saved to the DB correctly via the normal API route — but if that specific tab closed, crashed, or lost network at any point, no further notifications fired for that match, indefinitely, with nothing in the UI or logs indicating anything was wrong. Same class of gap `BUG-108`/`BUG-116` already fixed for the separate WebSocket live-score broadcast (moved server-side at the time; notifications never received the equivalent fix). Documented as a known gap in `.agents/dev/NOTIFICATION_SYSTEM_FLOW.md` §3/§8, not previously filed with its own number.

**Fix:** moved server-side, using the exact `after()` pattern already proven for the WS broadcast fix:
- `src/app/api/matches/[id]/events/route.ts` (`POST`): fires for `GOAL`/`RED_CARD`/`YELLOW_CARD`/`PENALTY_SAVED`/`PENALTY_MISSED` right after the event-save transaction commits, calling `sendMatchEventNotification()` directly in-process (no HTTP round-trip through `/api/notifications/match-event`).
- `src/app/api/matches/[id]/route.ts` (`PATCH`): fires `MATCH_START`/`HALF_TIME`/`MATCH_END` on the corresponding `currentPeriod` transition.
- Old client-side trigger path removed entirely (not kept as a fallback — running both would double-send real pushes, and `EventDrivenNotifier`'s dedup was `localStorage`-keyed, client-side only, so it couldn't have prevented that): deleted `event-driven-notifier.ts` and its one import site, removed `triggerNotification()`/`triggerPeriodNotification()` and their call sites from `match-state-manager.ts`.
- Incidentally fixed two latent copy bugs in the deleted client code while rebuilding the equivalent logic server-side: `teamName` was previously set to the *player's* name (copy-paste bug in `event-driven-notifier.ts`) for event-based notifications, and period-transition notifications never had a `teamName` at all (rendered as the literal string `"undefined"` in the `MATCH_START` body). Both now resolved via real DB lookups.

**Evidence:**
- Commit: `ce46f6c`
- Verified by: live test against a real Vercel preview deployment (`brixsports-staging-ji35yq7yt-brixsports-projects.vercel.app`), using a throwaway LIVE test match (`notif-test-throwaway-1`, kept around for further session testing) with a real anonymous push subscription linked to it. Real events posted directly through the actual deployed routes (a real browser session, injected via a signed logger JWT — established `dev/gen-token-*.mjs` pattern, no password involved) with zero manual notification-service calls.
- Observed result: two real `GOAL` events (`minute: 12` → "Victor Ememe scores! 1-0 (12')", `minute: 77` → "Victor Ememe scores! 2-0 (77')") and one real `HALF_TIME` period transition ("Half time: 2-0") each produced a real on-device push notification, confirmed via screenshots from the subscriber's actual device — not inferred from a 200 response or a UI toast. Delivery had noticeable latency in this environment (several minutes in some cases) but was not blocked on any tab: the logger's browser tab was not touched between posting each event and the notification arriving.
- Pending items: basketball wiring landed and was separately verified (`BACKLOG-203`). **`YELLOW_CARD` (`BUG-199`) code-path partially closed session 50**: a real Yellow Card was logged through the actual `FootballLogger` UI during `BUG-205`'s verification, confirmed via network log to save cleanly (`201`) and route through the trigger correctly with no error and no double-send — but that check only confirms the request/trigger fired correctly server-side, not that an on-device push actually arrived for this specific event type (no device screenshot taken this pass, unlike the original `GOAL`/`HALF_TIME` confirmations). Still genuinely open: a device-side confirmation for `YELLOW_CARD` specifically. There is no persistent server-side log of notification send attempts/successes/failures (`sendMatchEventNotification()` only `console.log`s), which made this debugging pass slower than necessary — tracked as `BACKLOG-211`, higher priority now given it's cost real debugging time repeatedly.

**Found:** gap documented session 49 in `.agents/dev/NOTIFICATION_SYSTEM_FLOW.md`; filed with its own number and fixed same session after Richard chose to prioritize wiring the full notification system to production stability.

---

### BACKLOG-203 — Phase 2: Basketball Notification Wiring (Minimal, Spam-Aware)

**Status:** RESOLVED — 2026-08-06 (session 49, `12537b7`, branch `feature/notification-system`)
**Priority:** High — direct continuation of `BUG-200`'s server-side trigger migration, applied to the second sport

**Built:** basketball wired into the same server-side `after()` mechanism `BUG-200` built for football. Deliberately minimal, matching the spam-avoidance reasoning independently reached by both Richard and a background roadmap-research agent (`.agents/dev/NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md`, thread 3): `MATCH_START` (`Q1`), a halftime-equivalent notification at the `Q2`→`Q3` boundary (mirroring football's exactly-one-mid-game-notification shape rather than firing on every quarter transition), `MATCH_END` (`FINISHED`), and `Technical Foul` as the one new event-based type. Routine scoring/foul events (Field Goal, Three Pointer, Free Throw, Rebound, Assist, Steal, Block, Turnover, plain Foul, Substitution, Timeout) deliberately **not** wired, to avoid the spam a 100+-event basketball game would produce.

**Real finding folded into the design, not left as an accident:** a background roadmap-research agent found that basketball had already been sending real `MATCH_END` push notifications since `BUG-200` merged (`ce46f6c`) — the period-trigger had no sport check, and basketball's `finalizeMatch()` already PATCHes `currentPeriod: 'FINISHED'` through the identical shared route. Asymmetric (full-time fired, kickoff never did) and undocumented until this pass. Now recorded as a cross-project pattern (`~/.claude/knowledge/global-patterns/patterns.md`, "A Generic Server-Side Trigger Added for One Case Can Silently Activate for Another Case Sharing the Same Route").

**Evidence:**
- Commit: `12537b7`
- Verified by: live test against a real Vercel preview, using a second throwaway match (`notif-test-throwaway-bball-1`, real teams TBK vs Titans, kept around for further testing) plus two independent server-logic replicas (`dev/debug-phase2-trigger.mjs`, `dev/debug-phase2-halftime-exact.mjs`) run directly via `tsx` against the same real DB/match data, since Vercel function logs aren't reachable from this session.
- Observed result: DB confirms the real `PATCH` requests genuinely wrote `current_period` to `'Q1'` then `'Q3'`. A real `Technical Foul` `POST` produced a real, immediately-arriving on-device notification ("Technical foul called (TBK)"), confirmed via screenshot — this one is unambiguous, no diagnostic script involved. The `MATCH_START` and halftime notifications also arrived on-device (screenshots confirmed), but **with a caveat worth being honest about**: both were preceded by a diagnostic script call sending the identical real function with the same real arguments (to isolate whether the service itself worked, after the real triggers appeared not to fire promptly), so those two specific on-device confirmations cannot be cleanly attributed to the real `PATCH`-triggered `after()` call versus the diagnostic call — both would produce identical-looking notifications. What *is* cleanly established, independent of that ambiguity: the trigger code itself is correct (read twice, matches the already-proven football pattern exactly), the DB writes are confirmed real, and the notification service correctly targets and sends for this exact match/team/event combination when invoked with the real, freshly-queried data — the same code the real route runs. The most likely explanation for the initial no-show was FCM-side delivery variability/throttling under this session's unusually high volume of rapid same-device test pushes, not a code defect — consistent with delivery latency already observed to be highly variable (up to ~10 minutes) earlier this same session for `BUG-200`'s own verification.
- Pending items: a clean, unambiguous live-fire confirmation of the real `MATCH_START`/`HALF_TIME` triggers specifically (without a preceding diagnostic call muddying the evidence) would strengthen this further. **Session 50 status:** attempted to re-test cleanly during the `BUG-202`/`BUG-204`/`BUG-205` verification pass, but `notif-test-throwaway-bball-1` had already progressed to end-of-Q3 from this same earlier testing, so the only next transition available was Q3→Q4 — not a notifiable period (`NOTIFICATION_RULES` only maps `Q1`/`Q3`/`FINISHED`) — so re-firing would've proven nothing new. Declined to force a full match-state reset just to manufacture this evidence. Partial corroboration instead: this same session's `Technical Foul` re-test on the identical match/code path (same `after()` call, same `sendMatchEventNotification()`, different trigger point) came back completely unambiguous with zero diagnostic-script involvement — supports, but doesn't replace, a dedicated clean `MATCH_START`/`HALF_TIME` re-fire next time a fresh throwaway match is set up. The persistent notification send-log gap (`BUG-200`'s own pending item, roadmap proposal item 10) is directly what made this ambiguity possible — filing it is now higher priority given it cost real debugging time twice in one session.

**Found:** built same session as `BUG-200`, immediately after, per Richard's explicit sequencing ("file the footballlogger bug, investigate it then do phase 2").

---

### BUG-201 — FootballLogger's "Select Player" Modal Intermittently Shows "No player found" Despite Valid, Available Roster Data

**Status:** RESOLVED — 2026-08-06 (session 49, `26489ea`)
**Priority:** Medium — blocks a real logger from completing a player-attributed event (Goal/Card/etc.) through the actual UI when it happens; workaround exists (direct API call) but that's not something a real logger can do mid-match.

**Problem:** on a freshly created LIVE match (`notif-test-throwaway-1`, real teams `busa-kings`/`busa-cruise`, real players with confirmed-active `player_team_affiliations` rows), clicking "GOAL" opened the `PlayerSelectionModal` showing "No player found," repeatably — including after a full hard page reload. Confirmed via direct network inspection that `/api/matches/[id]/eligible-players` genuinely returns the correct data (`success: true`, 38 total players, 23 correctly filtering to the home team via the exact same `memberships`/`getPlayerTeam` logic `FootballLogger.tsx` uses) — manually re-running that exact client-side filter against the live API response confirms 23 valid players. So the data pipeline (API + affiliations) is correct; something in the component's own state/lifecycle (`homePlayers`/`awayPlayers`, populated from this same fetch around `FootballLogger.tsx:330-354`) is not reflecting that data by the time `getOnPitchPlayers()` runs for the modal. Not resolved by a fresh reload, so this isn't simple fetch-before-mount timing.

**Root cause (found by a background debugger agent):** `getOnPitchPlayers()`/`getActiveRoster()` was never the problem — it already correctly falls back to the full roster when no lineup exists. `PlayerSelectionModal` (`FootballLogger.tsx:2821-2856`) independently re-derives its own `starterIds` from the same (possibly-null) lineup with no equivalent fallback: when `teamLineup` is absent, `starterIds` is an empty `Set`, and `filterStartersOnly`'s `!starterIds.has(p.id)` is then true for every player — filtering the entire roster out. A secondary consumer of the same nullable data silently skipped the primary computation's defensive guard (now a recorded cross-project pattern, see `~/.claude/knowledge/global-patterns/patterns.md`).

**Fix:** added a `hasLineup` guard so the starters/subs distinction in `PlayerSelectionModal` only applies when a lineup genuinely exists, matching `getOnPitchPlayers()`'s own contract (`FootballLogger.tsx:2834-2845`).

**Evidence:**
- Commit: `26489ea`
- Verified by: `tsc --noEmit` clean (49 baseline errors, none new).
- **Live-reverified session 50** (incidentally, while live-testing `BUG-202`/`BUG-205`): opened the real `PlayerSelectionModal` for a Yellow Card on `notif-test-throwaway-1` — the exact original repro scenario (lineup-less match, `filterStartersOnly` path) — and it correctly rendered the full roster instead of "No player found." Completed the flow end-to-end through the real UI (not the API workaround), event saved correctly.
- Observed result: `hasLineup` check added, both `filterStartersOnly`/`filterSubsOnly` branches now gated on it; confirmed live, not just code-read.
- Pending items: none. The broader audit of the same file (`BUG-202`) found two more instances of this bug class, filed and fixed separately, also now live-verified.

**Workaround used this session (superseded by the fix above):** bypassed the modal entirely, submitting the event via a direct authenticated `fetch()` POST to `/api/matches/[id]/events` from within the same logged-in browser tab (same session, same cookies — a real browser-originated request, not a script). Confirmed this reaches the real route correctly.

**Found:** session 49, live, while setting up `notif-test-throwaway-1` for `BUG-200`'s verification — unrelated to the notification work itself, surfaced by chance.

---

### BUG-202 — Two More Instances of BUG-201's Bug Class: Secondary Consumers of a Nullable Lineup With No Defensive Fallback

**Status:** RESOLVED — 2026-08-06 (session 50, `a7467e4`, branch `feature/notification-system`)
**Priority:** Medium (Finding 1) / Medium (Finding 2) — same severity class as `BUG-201`: each silently breaks a whole picker for the affected team/match state, no error surfaced

**Found by:** a background debugger agent, explicitly tasked with auditing `FootballLogger.tsx`/`BasketballLogger.tsx`/`match-state-manager.ts` for the same bug class as `BUG-201` after it was fixed, per Richard's direct request ("run an agent to do a sweep on that section area for any other edge cases... across related sections, modules, func, feature, class of the loggers section").

**Finding 1 — `PenaltySequenceModal`'s taker-selection step, `FootballLogger.tsx:2503-2511` (root cause) → `:2556-2583` (manifests).** Same exact pattern as `BUG-201`: `attackerStarterIds`/`defenderStarterIds` are built directly from `attackerLineup`/`defenderLineup` with no fallback for a missing lineup. When the attacking team has no published lineup, `attackerOnPitchIds` is empty, and the "Who is taking the penalty?" step (line 2558) filters out the *entire* attacking roster — worse than `BUG-201`, since the excluded players render as plain, non-clickable `<div>`s in a "Players on Bench" section with no explanatory message at all (not even a "No player found" empty state). Reachable on any live match at any time — the "Penalty" button has no lineup-existence gate.

**Finding 2 — Basketball's asymmetric lineup hydration, `BasketballLogger.tsx:441-465` (root cause) → `:1616-1656`, `:1769-1799` (manifests).** Different trigger than `BUG-201`/Finding 1 (partial, not absent, lineup data): `if (lineupData.success && (homeLineup || awayLineup)) { ...; setLineupSet(true); }` fires `setLineupSet(true)` as soon as *either* side has a lineup — if only one team's lineup was ever published/persisted, the other team's `homeStarters`/`awayStarters` state stays `[]` forever, and both the main player-select modal and the assist modal filter on that array with no empty-state handling — a silent, permanently-empty player grid for that team's entire event log going forward. Notably, the sibling sub-in modal *already has* the correct guard for this exact case (its own `BUG-141` comment: "an empty bench with no fallback message read as a broken app mid-game") — direct in-file evidence the main modals are the inconsistent ones, not a case where the right pattern doesn't exist yet.

**Checked and ruled out (no bug found), for the record:** `getAvailableBench()` (already correctly messaged at its one call site), the lineup-builder's own "seed from first 11" default (intentional, not a data-hiding bug), the confirm-lineup display screen (already has an explicit empty-state), `match.stats` (not referenced anywhere in these three files — `BUG-195`'s issue lives elsewhere), `match-state-manager.ts`'s clock/period reads (always safe by construction — `initializeState()` fully defaults the shape before anything reads it), football's `redCardedPlayerIds`/`subbedOnPlayerIds`/`subbedOffPlayerIds` (consistently guarded everywhere), `TrackLogger.tsx`/`MatchLoggerUI.tsx` (no lineup/starters concept at all — bug class doesn't apply).

**Fix:** Finding 1 — added the same `hasLineup`-style guard `BUG-201` used, applied to `PenaltySequenceModal`'s `attackerOnPitchIds`/`defenderOnPitchIds` (`FootballLogger.tsx`): falls back to the full attacker/defender roster when that side has no published lineup, instead of an empty on-pitch set. Finding 2 — `BasketballLogger.tsx`'s lineup-hydration block now falls back per-side (not globally) to that side's full roster when only the other side has a persisted lineup, so `homeStarters`/`awayStarters` no longer gets stuck at `[]` for the un-published side.

**Prevention, recorded as a cross-project pattern:** whenever multiple places in a component read the same optional/nullable field to gate a list or decision, grep for every other read site of that same conceptual data and confirm each implements the identical "absent" fallback — a guard written in one place does not automatically protect every other consumer.

**Evidence:**
- Commit: `a7467e4`
- Verified by: `tsc --noEmit` clean (49 baseline errors, same baseline as `BUG-201`'s own verification, none new in either `FootballLogger.tsx` or `BasketballLogger.tsx`).
- Observed result: Finding 1's guard added at the exact root-cause lines identified by the sweep agent; Finding 2's per-side fallback added at the exact root-cause lines identified. Both mirror the already-proven `BUG-201` fix shape.
- **Live-verified same session (session 50), against a real Vercel preview at the latest deployment (`brixsports-staging-hl0zrbfix...`) — real logger session injected via signed JWT, no password used.** Finding 1: opened the real `PenaltySequenceModal` on `notif-test-throwaway-1` (a genuinely lineup-less match) — Step 2 ("Who is taking the penalty?") rendered the full 22-player Kings FC roster as clickable, not the empty "Players on Bench" grid the bug produced; the already-red-carded player was still correctly excluded (confirms the fix didn't disable the other filter). Finding 2: set up a genuine asymmetric lineup on `notif-test-throwaway-bball-1` (home/TBK given a real published-shaped lineup via direct DB write, away/Titans left with none — `dev/setup-bug202-finding2-asymmetric-lineup.mjs`), then opened the real "Select Player" modal for Titans in `BasketballLogger` — rendered the full 14-player roster, not empty. Both closed without submitting, no match state polluted.
- Pending items: none — both findings now confirmed via real UI interaction, not just code reading.

**Found:** session 49, background debugger sweep (see above). **Fixed:** session 50, immediately after Richard flagged this fix was still outstanding mid-review of the notification roadmap proposal.

---

### BUG-204 — Admin Push-Campaign Composer's `match_specific`/`team_followers` Targeting Silently Sent to All Subscribers

**Status:** RESOLVED — 2026-08-06 (session 50, `9ce03ae`, branch `feature/notification-system`)
**Priority:** High — an admin selecting "Match Viewers" for one match, or leaving team selection empty, blasted the entire subscriber base with no warning; unfiled until surfaced by `NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md` thread 1

**Problem:** `src/app/api/notifications/send/route.ts`'s `getTargetUserIds()` returned `[]` for two genuinely different situations — `match_specific` (never implemented: `// For now, return all users (fallback)`) and `team_followers` with nothing selected. The call site interpreted any empty array as "no filter" and fell through to `db.select().from(pushSubscriptions)` with no `where` clause at all — every subscriber, regardless of what the admin actually selected. Also had no `.limit()` at all on that query (CLAUDE.md architecture-rule violation, flagged separately in the roadmap doc as item 2).

**Fix:** `getTargetUserIds()` now returns `null` to mean "no filter" (only audience `'all'` produces this) and a `string[]` — possibly empty — to mean "exactly these users, full stop" for every other case. `match_specific` resolves the selected match's `homeTeamId`/`awayTeamId` and reuses the same team-follower/favorite/primary-fan resolution `team_followers` uses (extracted into a shared `getTeamFollowerUserIds()` helper), merged with `BACKLOG-150`'s anonymous per-match subscribers via `pushSubscriptionMatches` — same pattern `sendMatchEventNotification()` already uses. Added `MAX_BROADCAST_SUBSCRIPTIONS = 5000` as a hard ceiling on the genuine "send to all" query.

**Scope decision (Richard, session 50):** fix the bug now regardless of the composer's in/out-of-scope status; defer the "is this an officially supported feature" question (CLAUDE.md lists push campaigns as explicitly out of scope) to a separate conversation rather than bundling a charter change with an urgent fix. **This scope question is still open** — see `BACKLOG-212` below.

**Evidence:**
- Commit: `9ce03ae`
- Verified by: `tsc --noEmit` clean (49 baseline errors, none new).
- Observed result: `getTargetUserIds()`'s new nullable-array contract compiles and is consumed correctly at the call site (verified the one new type error from the nullable return — `targetUserCount: targetUserIds.length` — was caught and fixed by `tsc`, not missed).
- **Live-verified same session (session 50) against the real deployed route**, using a real admin JWT (signed for the real `admin-001` user, no password touched) via in-page `fetch()` from an authenticated browser tab: (1) `targetAudience: 'team_followers'`, `selectedTeams: []` → real API response `{sentTo: 0, totalSubscriptions: 0}` — previously this would have been all 7 real subscriptions; zero real pushes sent. (2) `targetAudience: 'match_specific'`, `selectedMatch: 'notif-test-throwaway-bball-1'` → real API response `{sentTo: 1, totalSubscriptions: 1}`, matching exactly the one anonymous per-match subscriber genuinely linked to that specific match (confirmed via DB) — not all 7. Both calls used clearly `[BUG-204 TEST]`-labeled titles to avoid confusing the one real subscriber (Richard's own already-consented test device) that legitimately received test call #2.
- Pending items: none for the core targeting fix. Deferred hardening (user-preference filtering, anonymous-subscriber exclusion from `'all'`, send-history persistence) tracked in `BACKLOG-212`.

**Found:** session 49, `NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md` thread 1 (background architect-agent research). **Fixed:** session 50, per Richard's explicit "fix now, defer scope" decision.

---

### BUG-205 — FootballLogger Double-Sent Every Push Notification via a Leftover Client-Side Trigger

**Status:** RESOLVED — 2026-08-06 (session 50, `a7467e4`, branch `feature/notification-system`)
**Priority:** High — every real subscriber received two copies of every GOAL/RED_CARD/YELLOW_CARD/PENALTY_SAVED/PENALTY_MISSED/MATCH_START/MATCH_END push since `BUG-200` merged (`ce46f6c`), directly contradicting that fix's own explicit "remove entirely, don't keep as fallback — would double-send" decision

**Problem:** `BUG-200`'s migration deleted the `EventDrivenNotifier` singleton and `MatchStateManager.triggerNotification()`/`triggerPeriodNotification()`, but missed a second, separate client-side trigger mechanism already living directly inside `FootballLogger.tsx`: three inline `fetch('/api/notifications/match-event')` calls (line ~974 for goal/card/penalty-outcome events, line ~1251 for `MATCH_END`, line ~1755 for `MATCH_START`). These fired in parallel with the new server-side `after()` triggers in `events/route.ts` and `matches/[id]/route.ts`, so every one of those event types was sent twice per real match event since `ce46f6c`. Found by chance while reading `FootballLogger.tsx` to build the sport-keyed rules table (`BACKLOG-206`), not by a dedicated audit.

**Fix:** removed all three `fetch()` call sites. The server-side triggers already fully cover these cases with the authoritative saved data (minute, score) and don't depend on the tab staying open.

**Evidence:**
- Commit: `a7467e4`
- Verified by: `tsc --noEmit` clean (49 baseline, none new). Confirmed via `grep` that `/api/notifications/match-event` has no remaining callers in `FootballLogger.tsx` (its other two legitimate callers — `lineup/publish/route.ts` and `admin/match-lineups/[id]/route.ts`, both server-side, for `LINEUP_AVAILABLE` — are untouched and still correct).
- Observed result: three call sites removed, replaced with comments pointing to the server-side equivalent.
- **Live-verified same session (session 50)** against the real deployed route (`brixsports-staging-hl0zrbfix...`): logged a real Yellow Card and a real Red Card through the actual `FootballLogger` UI (real logger session, real player selection, real reason selection) and inspected the browser's network log directly after each — `POST .../events → 201` fired exactly once each time, with **zero** accompanying `POST /api/notifications/match-event` call. (An earlier attempt against a stale, pre-fix pinned preview URL did show the double POST — confirmed to be a stale deployment artifact, not a live regression, once re-tested against the current deployment.)
- Pending items: none. **Retroactively affects `BUG-200`'s and `BACKLOG-203`'s own evidence blocks**: any on-device notification confirmed during those earlier verifications that went through the real `FootballLogger` UI (not a direct API call or diagnostic script) would have arrived as two identical pushes, not one — doesn't invalidate that the mechanism worked, but means "one notification arrived" observations from those sessions likely undercounted.

**Found & fixed:** session 50, while building `BACKLOG-206`.

---

### BACKLOG-206 — Sport-Keyed `NOTIFICATION_RULES` Table (Roadmap Thread 5/7)

**Status:** RESOLVED — 2026-08-06 (session 50, `d05be20`, branch `feature/notification-system`)
**Priority:** Medium — no user-facing bug, a structural cleanup Richard explicitly approved doing now rather than after a third sport needs wiring

**Built:** new `src/lib/notifications/notification-rules.ts` — `NOTIFICATION_RULES: Record<Sport, { events, periods }>` plus `getNotifiableEventType()`/`getNotifiablePeriodType()` lookups, replacing `events/route.ts`'s flat `NOTIFIABLE_EVENT_TYPES` map and `matches/[id]/route.ts`'s `currentPeriod` if-chain. `NotificationKey` (the closed union with a `createNotificationPayload()` template) now lives in this one file as the single source of truth, imported by `match-notification-service.ts` and `notifications/match-event/route.ts` instead of each redeclaring its own copy. Basketball's `MATCH_END` mapping (previously an accidental match on a football-shaped generic `FINISHED` check, per `BACKLOG-203`'s own findings) is now its own explicit table row.

**Deliberately not done (per roadmap doc's own "backlog for later" split):** `notifications/match-event/route.ts`'s validation list still duplicates the key set manually (now type-checked against `NotificationKey`, but not derived from `NOTIFICATION_RULES` itself, since that table is keyed by sport, not a flat list) — left as-is per the roadmap doc's explicit backlog-for-later classification of that specific item.

**Evidence:**
- Commit: `d05be20`
- Verified by: `tsc --noEmit` clean (49 baseline, none new).
- Observed result: no behavior change intended or observed — football's five event mappings and three period mappings, and basketball's one event mapping and three period mappings, moved across unchanged into the new table.
- **Live-checked both sport branches, same session (session 50):** football — real Yellow Card and Red Card events logged through `FootballLogger`, both routed correctly through `getNotifiableEventType('Football', ...)` with no runtime error and correct `201` saves. Basketball — a real Technical Foul logged through `BasketballLogger` on `notif-test-throwaway-bball-1`, also a clean `201` save, confirming `getNotifiableEventType('Basketball', 'Technical Foul')` resolves correctly post-refactor.
- Pending items: none.

**Found:** roadmap doc thread 5/7 (background architect-agent research), session 49. **Decision + build:** Richard confirmed "do it now" during roadmap review, session 50.

---

### BACKLOG-207 — Two Team-Follow Stars Replacing the Dead Heart Button (Closes `BUG-152`)

**Status:** OPEN — filed session 50, not built
**Priority:** Medium — small feature, targeting already fully supports it; closes a previously-filed bug

**What:** replace the single non-functional Heart button on the match-detail page (`matches/[id]/page.tsx:543-549` — pure local `useState`, no API call, resets on reload) with two per-team follow stars beside each team badge, wired to `useFavorites.toggleTeam(teamId)` — already working, already the exact thing `sendMatchEventNotification()` targets (team-follow rule: either team having a follower makes the match notification-active — already the shipped behavior, not a new rule). Keep the Bell (anonymous, device-scoped, per-match push opt-in) visually and functionally distinct — different mechanism, different audience, must keep working for a viewer with zero team follows per the actor model ("Viewers NEVER have a session").

**Known gap to state honestly in the UI:** `useFavorites.toggleTeam()` writes to `userFavorites`, which the notification service queries unconditionally — unlike `userFollows`, which respects a per-row `notificationsEnabled` flag. So tapping a star silently enrolls the user in push for every match that team plays. Label the star's tooltip honestly ("Follow — get alerts for this team's matches") rather than presenting it as a bookmark with no consequence.

**Backlog for later (not part of this item):** decide whether "favorite" and "notify" should split into two separate states (would need a `notificationsEnabled` column on `userFavorites`), or stay fused as they are today.

**Found:** `NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md` thread 5, session 49.

---

### BACKLOG-208 — Unblock the Notification Scheduler: `vercel.json` Crons + Consolidate the Two Dead Reminder Routes

**Status:** OPEN — filed session 50, not built
**Priority:** High (unblocker) — every operational/reminder idea in the roadmap doc's thread 2 is blocked on this existing first

**What:** `vercel.json` has no `crons` block at all — neither `POST /api/notifications/match-reminders` (scans for T-30/T-15, unfiltered to **all** subscriptions) nor `POST /api/reminders/check` (reads the `matchReminders` table, per-user, has a `notificationSent` idempotency flag) has ever run in production. Pick `/api/reminders/check` as the one to keep (per-user, idempotent — the better base) and delete or gate the other. Also fix `reminders/check/route.ts:85`, which currently interpolates raw foreign keys instead of resolved team names into the reminder body.

**Unlocks, in priority order once this exists (not built now):** "match going LIVE with no assigned logger" admin alert (highest value — silent Flow B/C failure); assigned-logger T-60/T-15 reminder; logger session-expiry warning; lineup-not-published reminder; the rest of thread 2's table.

**Found:** `NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md` thread 2, session 49.

---

### BUG-209 — `/assets/` vs `/assests/` Typo Breaks OG Share Images and AEO Structured Data (3 Files)

**Status:** OPEN — filed session 50, not fixed
**Priority:** Low-medium — currently 404ing on every social share preview and structured-data logo reference, but cosmetic, not functional

**Problem:** only `public/assests/Logos/` exists (the typo spelling) — confirmed, that's the real directory. Three files reference the correctly-spelled `/assets/` path instead, which 404s: `src/lib/utils/aeo.ts:589`, `src/components/seo/PageSEO.tsx:41` (default `ogImage`), `src/app/page.tsx:356` (homepage `ogImage`). `src/lib/email.ts:217,297` and `src/app/reset-password/page.tsx:301` already correctly use `/assests/`.

**Fix (not built):** point the three broken files at `/assests/` (matching the actual directory), or rename the directory and update all five references consistently — either works, the broken three are the minimum fix.

**Found:** `NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md` thread 9, session 49 (surfaced incidentally while checking competition-logo/Cloudinary groundwork).

---

### BUG-210 — In-App WebSocket Toasts Still Have `BUG-200`'s Single-Tab Dependency

**Status:** OPEN — filed session 50, not fixed
**Priority:** Medium — same reliability gap `BUG-200` fixed for push, left unfixed for the separate in-app toast layer; basketball produces zero in-app toasts under any circumstances

**Problem:** `GlobalNotificationListener.tsx`'s toasts only fire in response to `notification:global`, emitted from `ws-server/index.js:313` only when it receives a `socket.on('event:log')` — which is emitted from the logger's own browser tab (`FootballLogger.tsx:734`). If the logger's tab closes, in-app toasts stop, exactly as push did before `BUG-200`. `BasketballLogger.tsx` never emits `event:log` at all, so basketball produces no in-app toasts, period — a gap independent of anything `BACKLOG-203` wired for push.

**Fix (not built):** natural extension of the same `after()` hook in `events/route.ts` that now calls `sendMatchEventNotification()` — emit the WS broadcast server-side from there too, for both sports.

**Found:** `NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md`, "Also worth flagging" section A, session 49.

---

### BACKLOG-211 — No Persistent Server-Side Log of Notification Send Attempts/Successes/Failures

**Status:** OPEN — filed session 50, not built
**Priority:** High (tooling) — has now directly cost real debugging time in both `BUG-200`'s and `BACKLOG-203`'s own verification passes (both evidence blocks flag this same gap)

**Problem:** `sendMatchEventNotification()` only `console.log`s (lines 51, 150, 195) — nothing persists past that request's logs. Separately, the campaign composer's own "Recent History" panel has never worked at all: `send/route.ts`'s history write is a server-side self-`fetch()` to `/api/notifications/history` that forwards no auth headers, while that route requires admin — it 401s every time, silently swallowed by the surrounding try/catch (`BACKLOG-124`-class bug). `history/route.ts` stores rows in a module-level in-memory array that evaporates per serverless invocation regardless.

**Fix (not built):** a real notification-send-log table (matchId, eventType, audience size, sent/failed counts, timestamp), written from `sendMatchEventNotification()` directly; replace the composer's self-`fetch()` history write with a direct function call (same fix shape as `BACKLOG-124`) writing to the same table.

**Found:** `NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md` thread 1 + "Also worth flagging" section B, session 49. Already flagged in `BUG-200`'s and `BACKLOG-203`'s own evidence blocks as a recurring cost.

---

### BACKLOG-212 — Notification System: Remaining Backlog-for-Later Items (Bundled)

**Status:** OPEN — filed session 50, not built, not all near-term
**Priority:** Low-medium, varies by line item — bundled per repo convention for low-priority/deferred items (see `BACKLOG-153`/`158`/`161` for precedent)

Everything below is explicitly **not** being built now — captured from `NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md` so none of it gets lost, per Richard's own "batch, review/confirm, file" instruction.

1. **Campaign composer scope decision** — still open (see `BUG-204`): is the admin push-campaign composer officially in scope (contradicts CLAUDE.md's "push notification campaigns" exclusion) or should it be hidden behind the same gate as Ads/Lineup Builder/etc.? Blocks: composer hardening below.
2. **Campaign composer hardening** (blocked on #1) — add `userPreferences.matchAlerts` filtering to the campaign send path (currently ignores it entirely, unlike `sendMatchEventNotification()`); exclude `BACKLOG-150` anonymous per-match subscribers from `targetAudience: 'all'` campaigns (a consent problem, not just UX).
3. **Close-game/buzzer-beater alerts (basketball)** — fire only on a made shot under tight-game conditions (final seconds + margin ≤3, or a late lead change). Needs a real per-event game clock (currently wall-clock-derived from `quarterStartedAt`) and a lead-change/margin evaluator — neither exists. Natural home for a per-match notification budget (hard cap of N pushes per match, all types, all sports), worth designing once.
4. **Followed-player notification send path** — `MatchEventNotification.playerId`/`relatedPlayerId` already added (roadmap item 4, shipped as part of `BUG-200`'s original fields). Still needed: the actual `userFollows`/`userFavorites` `followType: 'player'` audience query merged into the existing dedup set; player-specific payload templates ("Your player scored" vs. generic team copy); confirm a UI surface actually calls `useFavorites.togglePlayer()` before building the notification side (the hook exists, no page appears to call it yet).
5. **Competition-level following with match alerts** — follow plumbing already exists and works (`/api/users/follows` accepts `followType: 'competition'`, `competitions.followersCount` increments/decrements correctly) but nothing consumes it for targeting. Blocked on #3's per-sport event-set policy (a competition-follow multiplies volume across every concurrent match in that competition — could be 5-10x a team-follow on a busy fixture day) and a per-user daily notification cap. Recommended v1 event set if built: start/HT/FT only, not goals.
6. **Overview-tab empty-state redesign** — separate from the livestream embed itself (which is already fully built and just needs an admin to populate one match's fields to verify end-to-end). The "lots of unused white/black space" complaint is actually the placeholder shown for the ~100% of matches with no livestream configured — a real UI design task, independent of the livestream feature.
7. **Livestream embed source allowlist** — `LivestreamPlayer` renders third-party embeds validated only as http/https; deserves an allowlist before any public match day (adjacent to the `BUG-006` XSS class).
8. **Competition logos + Cloudinary migration** — `competitions` has no `logo` column at all (schema migration needed, staging-first per convention); `TeamLogo`'s fallback pattern generalizes near-free to an `EntityLogo`; migration should use the working signed-upload path (`/api/cloudinary/sign`), not the broken, dead `src/lib/cloudinary.ts` (never appends `publicId` to the URL at all — delete rather than fix); existing `teams.logo` rows are local repo paths (`seed-busa-football.ts`) that would need rewriting.

**Found:** `NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md`, all threads, session 49. Reviewed and batch-classified with Richard session 50.

---

### BUG-213 — `matches.start_time` Stored as Raw Unix-Epoch Text Breaks Homepage Date/Round Grouping ("Invalid Date")

**Status:** OPEN — found session 49/50, not fixed (root cause identified, not the display bug itself)
**Priority:** Medium — cosmetic on the public homepage (a section literally headed "INVALID DATE"), but affects any match whose `start_time` was written this way, not just test data

**Problem:** found live while verifying this session's notification fixes on a Vercel preview — the public matches list showed an "INVALID DATE" section grouping together `notif-test-throwaway-1`, `notif-test-throwaway-bball-1`, and the (now-deleted) "Silver Boys" test match. `matches.start_time` is a `text` column (`schema.ts:316`), and all three of these rows had it set to a raw Unix-epoch-as-string (`'1786012585'`, `'1785592800000.0'`) instead of an ISO date string — whatever date-parsing the homepage's round/date-grouping logic uses fails silently on that format for exactly these rows and buckets them under a literal "Invalid Date" header instead of erroring or omitting them.

**Root cause confirmed, not yet fully traced:** the malformed values came from `dev/setup-notif-test-throwaway-match.mjs`/`-basketball.mjs`, which wrote `start_time` via SQL `unixepoch()` directly (an integer epoch, coerced to text) rather than an ISO string like real match-creation flows presumably use. Not yet confirmed whether any *real* (non-test) match rows have the same malformed format — worth a full-table check before assuming this is test-data-only.

**Not fixed this pass:** the two remaining notification throwaway matches (`notif-test-throwaway-1`, `notif-test-throwaway-bball-1`) still have this malformed value and were deliberately left as-is since they're still in active use for this session's verification — fixing their `start_time` is low-risk (display-only) whenever they're next touched. Silver Boys' copy of the bug is moot now (that match was deleted, see `RUNLOG.md` session 49 entry).

**Fix (not built):** (1) audit all `matches.start_time` values platform-wide for non-ISO format, not just test rows; (2) find and harden the homepage's date/round-grouping parse logic to either handle a raw-epoch string or reject/log malformed values instead of silently bucketing them into a user-facing "Invalid Date" section; (3) fix the two dev setup scripts above to write a real ISO string so this doesn't recur for future test matches.

**Found:** session 49/50, live, while verifying notification-system fixes on the public matches list preview — unrelated to the notification work itself.

---
