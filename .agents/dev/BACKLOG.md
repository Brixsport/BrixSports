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
- Pending items: live test via End Match flow on staging

- ~~**BUG-052**~~ _(CRITICAL — Data Integrity)_: Logger could directly write `homeScore`/`awayScore` via PATCH, bypassing event-driven scoring. Fix: score writes gated to `admin` role only; non-negative integer guard added. Event-driven score path (`POST /events` → direct `db.update`) is a separate code path, unaffected. `src/app/api/matches/[id]/route.ts`. **Status:** SHIPPED — Session 28.

**Evidence:**
- Commit: `1824256`
- Verified by: tsc clean; confirmed `/events` route updates scores via `db.update` directly (not through PATCH handler)
- Observed result: Logger PATCH with homeScore/awayScore → silently ignored (field skipped, not error)
- Pending items: live test on staging

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

- ~~**BUG-058b**~~ _(CRITICAL — Logger Offline Queue)_: `AuthContext.checkAuth()` runs on every logger page mount. It calls `GET /api/auth/me` with the `authToken` cookie → 401 for logger role → falls back to localStorage token → calls `/api/auth/me` again with `Authorization: Bearer` → still 401 → **calls `localStorage.removeItem('authToken')`** at line 74 of `AuthContext.tsx`. By the time FootballLogger's offline catch block runs `localStorage.getItem('authToken')`, the value is null → hits the `!token` branch → shows "Network error: could not save this event and no session found" alert → **no queue write, event silently lost**. Discovered during BACKLOG-058 Test 2 on staging (Session 28). Fix: (a) `POST /api/auth/refresh` updated to handle logger token payload (`id` not `userId`, `loggers` table not `users`), returns token in response body; (b) FootballLogger `useEffect` on mount calls refresh and re-stores token in localStorage. Files: `src/app/api/auth/refresh/route.ts`, `src/components/FootballLogger.tsx`. **Status:** SHIPPED — commit `1057f22`, 2026-06-24. Pending: BACKLOG-058 Test 2 re-run to confirm queue write now succeeds.

- **BACKLOG-095** _(LOW — Admin UX)_: `/admin/match-lineups` has no discoverable entry point. The only way to reach it is via a small `ClipboardList` icon button in the action column of each match row on `/admin/matches` (line 461) — no label, no sidebar link, no breadcrumb from anywhere else. The link also goes to the page root (`/admin/match-lineups`) rather than a specific match, so the admin still has to re-select the match inside the page. Options: (a) add a "Lineups" link to the admin sidebar under Matches — low-traffic enough that it does not need top-level placement, could be a sub-item; (b) make the icon button link directly to `/admin/match-lineups?matchId=[id]` so the page can pre-select the match on load; (c) both. Not blocking anything — lineup management still works, it's just hard to find. Filed: 2026-06-24.

- **BACKLOG-094** _(MEDIUM — Eye Point Awards panel never renders)_: `LiveMatchTimeline` expects an `eyePoints: any[]` prop — a pre-computed list of per-match Eye Point award objects. `GET /api/matches/[id]` never queries `eyePointAwards` (schema-enhanced.ts:247) and never returns this key. The page destructures `eyePoints` from `matchData` (page.tsx:234), gets `undefined`, passes it to the component. The crash was fixed (BUG-059, `?? []` guard) but the Eye Point Awards summary section at the bottom of the Timeline tab now silently never renders even when Eye Point events exist. Fix: either (a) in `GET /api/matches/[id]`, query `eyePointAwards` where `matchId = id` and include in response, or (b) derive the award list client-side from `events.filter(e => e.isEyePoint)` in the page and pass that. Option (b) is simpler and avoids an extra DB query since events are already fetched. Note: `isEyePoint` boolean already exists on every event row in the response. Filed: 2026-06-24.

- ~~**BUG-059**~~ _(HIGH — Match Detail Page)_: Timeline tab crashes on render with `TypeError: Cannot read properties of undefined (reading 'length')`. Root cause: `LiveMatchTimeline` receives `eyePoints` prop from the page, which destructures it from `matchData` (line 234 of `matches/[id]/page.tsx`). The GET handler at `src/app/api/matches/[id]/route.ts` returns `{ match, events }` — no `eyePoints` key. So `eyePoints` is `undefined`. `LiveMatchTimeline.tsx` line 437 calls `eyePoints.length` unconditionally → TypeError → component crash. The network "500" observed during the Session 28 smoke test was this render error surfacing. Fix: `(eyePoints ?? []).length` and `(eyePoints ?? []).map(...)` in `LiveMatchTimeline.tsx`. **Status:** RESOLVED — 2026-06-24.

**Evidence:**
- Commit: (pending)
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
  - `JWT_SECRET` shared across envs — staging-issued JWTs are valid on prod API routes (not fixed yet)

  **Recommended fix (not a patch — proper fix):** Spin a second Railway service scoped to staging. Set `NEXT_PUBLIC_WS_URL` in the staging Vercel project to the staging Railway URL. Both services are independent — staging events stay on staging sockets, prod events stay on prod sockets.

  **Not recommended:** Prefixing room names with env tag (`match:staging:${matchId}`) would isolate room broadcasts but would NOT fix `io.emit()` (notification:global still hits all sockets) and would not fix the shared `matchTimes` Map or VAPID/JWT key sharing. It is a workaround, not a fix.

  Filed: 2026-06-25. Updated: 2026-07-01. **Status:** OPEN

- **BUG-080** _(HIGH — Public Page / CLAUDE.md violation)_: No HTTP polling fallback when WebSocket is disconnected. Public match page (`/matches/[id]`) uses `useWebSocket` exclusively for real-time updates — clock, score, events. When WS fails (max 5 reconnect attempts), the page freezes on stale data indefinitely. CLAUDE.md mandates: *"Live update mechanism must have a fallback if the channel drops. Viewer must see stale data clearly on failure, not a crash."* This is confirmed violated — page shows no stale indicator and no recovery. Fix: when `isConnected === false && isLive`, poll `GET /api/matches/[id]` every 10s and merge response into display state. Show a "live updates paused — reconnecting" banner when WS is down. Confirmed via session 34 test match — public clock and score were frozen throughout because Railway was down. Filed: 2026-06-27. **Status:** SHIPPED — session 38D. Two root causes fixed: (1) `isLiveStatus` check in polling effect (line 163) and toast effect (line 181) used `=== 'LIVE' || === 'HALF_TIME'` — now uses module-level `LIVE_STATES.has()` covering all 7 live-ish period values; (2) `sharedSocket?.disconnect()` called at `connect_error` attempt 5, permanently killing Socket.IO reconnect loop — removed; added `reconnect_failed` listener with 30 s manual retry loop (`socket.connect()`). `LIVE_STATES` moved to module scope so effects and render share the same constant. Pending: Railway-down staging verify (amber toast, polling active, reconnect recovery). **NOTIF-12 (accepted risk):** offline notification queuing — notifications fired during a WS/server outage are lost; no retry queue exists. Accepted at MVP with a handful of viewers. Production-level concern to revisit at scale.

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

- **BACKLOG-119** _(UX — Match Detail Page)_: Remove green "Live" dot from header; colour clock and period label red during live match. Active play (H1/H2/ET/PK): pulsing red dot + red period label + red minute. Half Time: red "HT" label only, no dot, no clock. FT/Pending: neutral. Commit `f9c6764`. **Status:** SHIPPED `f9c6764` — pending visual verify alongside BUG-083 and BUG-080.

- **BUG-092** _(HIGH — Real-time / Viewer UX)_: Undone events stay visible on the public Timeline tab until hard refresh. Root cause: `handleUndo` in `FootballLogger.tsx` sends `DELETE /api/matches/[id]/events/[eventId]` which removes the event from DB, but the WS server only broadcasts `match:event:new` — there is no `match:event:deleted` broadcast. The viewer page's `useMatchEvents` hook accumulates events via WS and has no mechanism to receive deletions. Fix: (a) in the event DELETE handler (`src/app/api/matches/[id]/events/[eventId]/route.ts`), after confirmed DB delete, emit `match:event:deleted` with `{ matchId, eventId }` via the WS server; (b) `useMatchEvents` in `useWebSocket.tsx` listens for `match:event:deleted` and filters the deleted event out of local state. Observed live: double-yellow undo removed the Red Card from DB correctly but Red Card and original Yellow both remained on viewer Timeline until page reload. Filed: 2026-06-30. **Status:** OPEN

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

- **BUG-090** _(LOW — WebSocket)_: Socket emits attempted on a `CLOSING` socket. `useMatchSubscription` reads `socket.readyState` before emitting, but the `isConnected` dep-array trigger can fire in the same tick as a disconnect — `readyState` may transition from OPEN to CLOSING between the dep-array check and the emit. Not confirmed as causing dropped events but creates unnecessary warnings. Filed: 2026-06-29. **Status:** OPEN

- ~~**BUG-073**~~ _(LOW — Data)_: Substitution `detail` string direction — filed as inverted during KIN vs JOG test match analysis. Confirmed at HEAD: `confirmEvent('Substitution', playerComingOut, playerInId)` → `relatedName` = incoming, `outName` = outgoing → string reads `{inPlayer} IN for {outPlayer}`. Code was never wrong. DB events from the KIN vs JOG test match (deleted) reflected an older state. **Status:** RESOLVED — no code change needed, 2026-06-26.

- **BACKLOG-105** _(HIGH — Data Integrity)_: Penalty shootout score isolation. Full implementation. **Status:** SHIPPED (interim guard `da8d9ce`) — full implementation OPEN, build next session after Railway up.

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
  - **Verification required:** spin a fresh test match *after* `b66eb95` is deployed. Start match → transition to `FIRST_HALF` → hard refresh → must show `FIRST_HALF`. That is the real TD-010 test. The existing test match is a write-off for this purpose.
  - Prod migration: NOT yet run — pending staging clean-test verification.

- **TD-011** _(LOW)_: `updatePlayerStats` in `src/app/api/matches/[id]/events/route.ts` has `season: '2024'` hardcoded on insert (lines ~357, ~396). Will silently write to the wrong season bucket from 2025 onward. Fix: derive season from match `startTime` or pass as a match field. Filed: 2026-06-19.

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

### BACKLOG-018 — Game Event Logsheets (BUSALYMPICS + BUSA League match events)

**Status:** IN PROGRESS — BUSALYMPICS portion COMPLETE (7 of 7 matches, 2026-07-09). BUSA League: 8 matches now APPLIED, DB-verified, and fully reconciled against FA reports + real result graphics (2026-07-11, session 41B) — busa-match-13, -16, -15, -10, -12, -14, -final-2026, -11. 758 total match_events written. Zero deferred items remain across all 8. A full platform-wide collision audit of all 84 session-41 stub players (2026-07-11) closed clean — 1 real merge found and applied (Abdulazeez Jolaoye ↔ his own unlinked COLNAS identity), 2 false alarms investigated and closed (Charles, Peter — both ruled out by active-club-affiliation-to-different-clubs). **23 matches remain in the full 32-match structure: 17 group-stage (including busa-match-1, still fully untouched), 4 QF (QF1-3 bracket-confirmed, QF4 pending FA verification), 2 SF (both blocked — no `matches` row exists for either, no sourced date; Joga-Hammers has parsed sheets ready, Kings-Pirates only has unassessed "Lone Sheets" files).** 3rd Place excluded from remaining count — already live-logged.

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

#### Item C — Upgrade swiper (CRITICAL prototype pollution)

**Priority:** CRITICAL
**Current:** `^12.0.3`
**Fix:** `12.1.2`

Alert: Prototype pollution in swiper `>= 6.5.1, < 12.1.2`.
Already on `^12.x` — just needs a patch bump.

**Steps:**
1. `npm update swiper`
2. Verify swiper still renders correctly in any page using it (search for `swiper` usage in src/)
3. Commit and deploy

**Risk:** Low — patch bump within same major version.

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

### BUG-039 — LOW: Unbounded Teams Query in /api/basketball/players

**Status:** OPEN
**Priority:** Low — performance issue, not a security issue
**Filed:** 2026-06-17

#### Problem
`src/app/api/basketball/players/route.ts` line 14 runs `db.select().from(teams).all()` — loads all 236+ teams from the DB just to filter in JS to the ~6 basketball teams by name. This full table scan runs on every basketball player page load.

#### Fix
Replace with a `.where(eq(teams.sport, 'Basketball'))` clause to push the filter to SQLite.

#### Files
- `src/app/api/basketball/players/route.ts`


---

### BACKLOG-077 — No "Create Team" UI on /admin/teams

**Status:** OPEN
**Priority:** Medium — BACKLOG-076 (basketball college teams) is now RESOLVED, so the original blocker context is gone. Still needed as a UX gap: admins cannot create empty teams from the UI.
**Filed:** 2026-06-17

#### Problem
`/admin/teams` is a read-only list page with no create button. The only way to create a team today is through `/admin/bulk-register` — which creates a team as a side effect of registering players, not as a standalone operation. That path sets wrong defaults and breaks business logic when you need an empty team (e.g. basketball college teams with no players yet).

`POST /api/teams` exists and is gated — the UI just doesn't surface it.

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

### BUG-041 — HIGH: React Error 418 (Hydration Mismatch) Confirmed Live on Homepage

**Status:** OPEN
**Priority:** High — actively degrading every real user experience
**Filed:** 2026-06-17

React hydration error 418 confirmed firing in prod console on the homepage. Previously fixed for standings page (BUG-028, resolved 2026-06-15). This is a wider recurrence.

Evidence: error fires on homepage, tied to repeated long-tasks of 9.2s to 16s TBT from chunk 168-0d859fc25e0313e8.js recurring throughout session lifetime, not just on load.

Root cause hypothesis: same pattern as BUG-028 — Framer Motion initial prop or SSR/CSR mismatch on homepage components. Audit homepage components for Framer Motion initial props, dynamic imports without ssr:false, Math.random() in render, Date.now() outside hooks.

Related: BUG-028 (resolved standings instance), BACKLOG-085, BACKLOG-090.

---

### BACKLOG-078 — Privacy Policy + Terms of Service Pages

**Status:** OPEN
**Priority:** High — required before any public user data collection
**Filed:** 2026-06-17

Legal pages /privacy and /terms required for NDPA compliance and PWA listing. Link from footer and registration flows. Related: BACKLOG-086 (NDPA registration).

---

### BACKLOG-079 — Security Headers Configuration

**Status:** OPEN
**Priority:** High
**Filed:** 2026-06-17

Configure HTTP security headers in next.config.ts: Content-Security-Policy, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy. None currently set. Pre-prod blocker.

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

**Status:** OPEN
**Priority:** MEDIUM
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

### BACKLOG-111 — Stat Reversion on Event Undo

**Status:** SHIPPED — `f44edfa`, Session 36. Pending live verification.
**Priority:** Low
**Filed:** 2026-06-29

**Context:** The DELETE `/api/matches/[id]/events/[eventId]` handler reverts match score for scoring events but did NOT decrement `footballPlayerStats`. Root cause confirmed via call chain trace: `decrementPlayerStats` existed in `events/route.ts` (collection route) but was never reachable from `[eventId]/route.ts` (the route FootballLogger actually calls) — classic false-RESOLVED gap.

**Fix:** Self-contained `revertPlayerStat(sport, playerId, eventType)` function added to `[eventId]/route.ts`. Switch covers: GOAL, ASSIST, OWN GOAL, PENALTY, PENALTY MISSED, PENALTY SAVED, FOUL, YELLOW CARD, RED CARD, SAVE. All with `Math.max(0, x-1)` floor. Guards: `matchType !== 'friendly'` and `!isPenaltyShootout`. Match fetch moved unconditional; null-guarded on both score-revert and stat-revert paths. `PENALTY SAVED` also reverts keeper `saves--` via `event.relatedPlayerId` (null-checked).

**Scope:** `src/app/api/matches/[id]/events/[eventId]/route.ts` only.

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
