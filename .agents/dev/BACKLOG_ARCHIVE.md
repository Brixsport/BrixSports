# BrixSports — Backlog Archive

This file holds **closed** (`RESOLVED` / `SHIPPED` / `DONE` / `COMPLETE` / `WONT FIX` / etc.)
`BUG-XXX` and `BACKLOG-XXX` entries that were closed **before Session 50 (2026-08-07)**,
moved out of `.agents/dev/BACKLOG.md` in a one-time archival pass on 2026-09-18
(see `ENGINEERING_AUDIT_2026-09-17.md`, finding H3).

**Why this split, and why this cutoff:** `BACKLOG.md` had grown to ~13,700 lines with no
separation between "open, needs attention" and "closed, historical record" — every
session's mandatory read-the-backlog-first pass was paying the full cost of the file with
zero benefit from old closed entries. Session 50 (2026-08-07) is also the date of the
`STAKEHOLDER_STATUS_REPORT_2026-08-07.md` snapshot, giving it a natural, independently-
recognizable boundary rather than an arbitrary one. The audit's own suggested cutoff
("before session 40") was tested first and only archived ~59 entries / ~450 lines — most
of the project's closed history is concentrated in the six weeks after session 40, so that
cutoff was extended to session 50 to make the pass actually meaningful. Everything closed
from session 50 onward, and every entry that is still OPEN regardless of age, stays in the
live `BACKLOG.md`.

**Content below is moved verbatim** — no entry was edited, summarized, or paraphrased in
the move; only its location changed. Original in-file order is preserved. If you are
looking for the newest history on a topic, check `BACKLOG.md` first — an ID appearing here
means it was already closed and untouched for at least ~6 weeks as of the archival date.

---

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

- ~~**BUG-053**~~ _(MEDIUM — PRODUCTION gate)_: `POST /api/loggers/auth` has no rate limiting or brute-force protection. Fix: in-memory `loginAttempts` Map keyed by `x-forwarded-for` IP. 5 failures in 15 min → 429. Clears on success. Resets on Vercel cold start — documented as MVP gate. **Status:** RESOLVED — `7d90e05`, 2026-06-27.

**Evidence:**
- Commit: `7d90e05`
- Verified by: manual test — 5 bad login attempts → 429 on 6th attempt confirmed in session 34 test match pre-flight
- Observed result: 429 fires correctly; clears on successful login
- Pending items: none

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

- **BUG-057** _(CRITICAL — Auth)_: `getAuthUser()` in `src/lib/auth.ts` does not support logger sessions. Logger JWTs carry `{ id, email, role }` but `verifyAuth` casts to `AuthUser` which expects `{ userId, email, role }` — so `authData.userId` is `undefined`. `getAuthUser` then queries the `users` table with `undefined`, returns no row, returns `null`. Every handler that calls `getAuthUser` (PATCH `/api/matches/[id]`, POST `/api/matches/[id]/events`, etc.) returns 401 for ALL logger requests despite a valid `authToken` cookie. Root cause discovered during Session 28 smoke test — logger could log in successfully (`POST /api/loggers/auth` returned 200, cookie set) but every subsequent authenticated call returned 401. Fix: (a) `verifyAuth` normalises `decoded.userId ?? decoded.id` so logger tokens resolve correctly; (b) `getAuthUser` branches on `role === 'logger'` and queries the `loggers` table instead of `users`. `src/lib/auth.ts`. **Status:** RESOLVED — 2026-06-22.

**Evidence:**
- Commit: `1401ee2`
- Verified by: live logger session on staging — login → Start Match (PATCH 200) → 9 events posted (all 201) → no 401s after login
- Observed result: logger auth now resolves correctly via loggers table; all authenticated logger requests succeed
- Pending items: none

- ~~**BUG-056**~~ _(LOW)_: 401/403 on event POST silently dropped event. **Status:** SHIPPED — commit `5cb6738`, 2026-06-26. Alert added for 401 (session expired), 403 (not authorised), and generic 4xx. `console.error` retained alongside for debugging.

- ~~**BUG-058b**~~ _(CRITICAL — Logger Offline Queue)_: `AuthContext.checkAuth()` runs on every logger page mount. It calls `GET /api/auth/me` with the `authToken` cookie → 401 for logger role → falls back to localStorage token → calls `/api/auth/me` again with `Authorization: Bearer` → still 401 → **calls `localStorage.removeItem('authToken')`** at line 74 of `AuthContext.tsx`. By the time FootballLogger's offline catch block runs `localStorage.getItem('authToken')`, the value is null → hits the `!token` branch → shows "Network error: could not save this event and no session found" alert → **no queue write, event silently lost**. Discovered during BACKLOG-058 Test 2 on staging (Session 28). Fix: (a) `POST /api/auth/refresh` updated to handle logger token payload (`id` not `userId`, `loggers` table not `users`), returns token in response body; (b) FootballLogger `useEffect` on mount calls refresh and re-stores token in localStorage. Files: `src/app/api/auth/refresh/route.ts`, `src/components/FootballLogger.tsx`. **Status:** RESOLVED — commit `1057f22`, 2026-06-24. Corrected session 47E: this entry sat SHIPPED with a stale "pending BACKLOG-058 Test 2 re-run" note, but that re-run already happened and already has a full evidence block — see `BACKLOG-058`'s own entry ("Logger Offline Event Queue"), Live Test 3 on staging same day (2026-06-24, Session 30): 15 queued events drained and POSTed, IDB store confirmed empty after drain, all events landed on the public page. That test is specifically what exercises this fix (the offline queue write never happens at all without this token-refresh fix, per this entry's own root-cause chain) — never cross-referenced back into this entry until now.

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

- ~~**BUG-084**~~ _(HIGH — Notifications)_: Originally filed as "no push enrollment UI — pushSubscriptions always empty." **INCORRECT — retracted 2026-07-01.** Full code audit confirmed three active enrollment paths:
  - `src/components/SettingsOverlay.tsx` — subscribe/unsubscribe toggle, calls `pushService.subscribe(user.id)` / `pushService.unsubscribe(user.id)`
  - `src/components/OnboardingModal.tsx` — enrollment step during first-time onboarding flow
  - `src/components/NotificationPermission.tsx` — auto-show banner if `Notification.permission === 'default'` and user hasn't dismissed
  - `src/hooks/useNotificationPrompt.ts` — hook backing the above components

  The `pushSubscriptions` table on prod is NOT empty — confirmed by a real push notification being delivered to a prod subscriber during a staging test match (2026-07-01). The full VAPID pipeline is functional end-to-end on prod.

  The original "always empty" claim was based on the diagnose endpoint output during early sessions when no user had yet completed onboarding. That is no longer the case.

  BUG-085 (dedup key broken) remains open and is the actual notification quality issue. **Status:** RESOLVED — no fix needed, enrollment UI already existed.

- ~~**BACKLOG-119**~~ _(UX — Match Detail Page)_: Remove green "Live" dot from header; colour clock and period label red during live match. Active play (H1/H2/ET/PK): pulsing red dot + red period label + red minute. Half Time: red "HT" label only, no dot, no clock. FT/Pending: neutral. Commit `f9c6764`. **Status:** RESOLVED — 2026-07-27 (session 47C), live-verified on PR #12's Vercel preview (`/matches/w6o4YQAF5pem_Qa8uazAm`, a real `LIVE` basketball match — confirms the styling is sport-agnostic, not football-only despite the original H1/H2/ET/PK example). **Evidence:** DOM-inspected directly rather than eyeballed — found `<span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse">` (the pulsing dot) and the period label (`Q1`) rendered with `className: "text-red-400"`, computed color `oklch(0.704 0.191 22.216)` (genuinely red, not just visually similar). Verified by: session 47C.

- ~~**BUG-092**~~ _(HIGH — Real-time / Viewer UX)_: Undone events stay visible on the public Timeline tab until hard refresh. Root cause: `handleUndo` in `FootballLogger.tsx` sends `DELETE /api/matches/[id]/events/[eventId]` which removes the event from DB, but the WS server only broadcasts `match:event:new` — there is no `match:event:deleted` broadcast. The viewer page's `useMatchEvents` hook accumulates events via WS and has no mechanism to receive deletions. Fix: (a) in the event DELETE handler (`src/app/api/matches/[id]/events/[eventId]/route.ts`), after confirmed DB delete, emit `match:event:deleted` with `{ matchId, eventId }` via the WS server; (b) `useMatchEvents` in `useWebSocket.tsx` listens for `match:event:deleted` and filters the deleted event out of local state. Observed live: double-yellow undo removed the Red Card from DB correctly but Red Card and original Yellow both remained on viewer Timeline until page reload. Filed: 2026-06-30. **Status:** SHIPPED — found already fixed, session 47D. **Real fix landed silently as a side effect of `BUG-119` (`b2ffcde`, "stop firing broadcast calls unawaited on serverless"), which added `after(() => broadcastEventDeleted(matchId, eventId))` to the DELETE handler — never cross-referenced back to this entry.** `useWebSocket.tsx`'s `handleEventDeleted` (filters `setEvents(prev => prev.filter(e => e.id !== data.eventId))` on the `event:deleted` socket event) has existed since the original WS setup commit, so the listener side was never actually the gap — only the emit side was missing until BUG-119 added it. `MatchOverlay.tsx` has its own separate `event:deleted` listener too, also already wired. **Live-tested on staging, 2026-07-28 — status refined, not a clean RESOLVED.** Posted a real test event (`Timeout`) to the live match `w6o4YQAF5pem_Qa8uazAm`, confirmed it appeared, then DELETEd it and watched the same viewer tab without reloading. Console confirmed the broadcast is genuinely received: `[WS] Event deleted for Match w6o4YQAF5pem_Qa8uazAm: [object Object]`. But the event did **not** disappear from the Timeline instantly — it took roughly the length of one `BUG-108` reconciliation-poll cycle (~25s) to vanish. Root cause, confirmed by code read: `useWebSocket.tsx`'s `handleEventDeleted` correctly filters `useMatchEvents`' own internal `events` state (aliased `liveEvents` in `matches/[id]/page.tsx:50`) — but **nothing wires that deletion into `matchData.events`**, which is the state the Timeline tab actually renders from (`page.tsx:144-162` only has a one-way `useEffect` that *adds* `latestEvent` into `matchData.events` on `event:new`; there is no equivalent removal path for a deleted event id). The event only disappeared once the unrelated 25s reconciliation poll (`BUG-108`) did a full silent refetch of `matchData` from the DB, which naturally excluded the deleted row.

**Status:** SHIPPED — the "fix needed for true RESOLVED" described immediately below was itself found already built, session 47F, by a retrospective audit agent. This entry's own status line had gone stale after the fix landed. `src/app/matches/[id]/page.tsx:266-283` has a `handleEventDeleted` listener — filters `matchData.events` on the `event:deleted` socket event, wired via `on('event:deleted', handleEventDeleted)` in the same `useEffect` as `match:score:updated`/`match:status:changed`/`match:updated` — with a comment literally citing `BUG-092`. Confirmed by direct file read, session 47F (not just the audit agent's claim). **Not yet live-tested against this specific code path** (the prior evidence block below tested the pre-fix ~25s-lag behavior, before this listener existed) — needs a fresh live two-tab test to actually confirm instant removal now, then this can move to RESOLVED with a real evidence block.

**Original problem this entry describes (kept for history):** add a small `useEffect` in `matches/[id]/page.tsx` that filters `matchData.events` on the same `event:deleted` socket event (either via a new `deletedEventId` piece of state exposed from `useMatchEvents`, or a second direct `on('event:deleted', ...)` listener on the page itself, matching the pattern the page already uses for `match:score:updated`/`match:status:changed`/`match:updated`). **This is exactly what now exists in code — see above.**

**Evidence (from before the fix above existed — superseded, kept for history):**
- Verified by: live two-tab test against staging, real event POST + DELETE via admin session, observed via the public match page without reload
- Observed result: broadcast received immediately (console-confirmed); UI update lagged ~25s, driven by the reconciliation poll, not the WS listener
- Pending items: a fresh live test against the now-existing `handleEventDeleted` listener, to confirm instant removal and move this to RESOLVED

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

- ~~**BUG-073**~~ _(LOW — Data)_: Substitution `detail` string direction — filed as inverted during KIN vs JOG test match analysis. Confirmed at HEAD: `confirmEvent('Substitution', playerComingOut, playerInId)` → `relatedName` = incoming, `outName` = outgoing → string reads `{inPlayer} IN for {outPlayer}`. Code was never wrong. DB events from the KIN vs JOG test match (deleted) reflected an older state. **Status:** RESOLVED — no code change needed, 2026-06-26.

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

- ~~**BUG-043**~~ _(LOW)_: Publish Lineups button silently disabled when captain not set. **Status:** SHIPPED — commit `5cb6738`, 2026-06-26. Inline amber message "Set a captain for both teams before publishing." shown below button when `!homeCaptain || !awayCaptain`.

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

- ~~**BUG-097**~~ _(CRITICAL — Data Integrity, BUSALYMPICS backfill)_: `busa-pirates-player-17` (Israel Emmanuel) held two simultaneous active `player_team_affiliations` rows with `affiliation_type='college'` — a real, pre-existing COLENG affiliation AND an erroneous COLMANS affiliation created by MD1 g1's write (`OPoEtVGUNWKcRSDe4QdSr`), which wrongly platform-wide-matched him to a COLMANS "ISREAL" sheet entry that is actually a different person. Separately, MD1 g2 (`tyYRU5nlOrqnEXEpvIEC6`) then needed the real Israel Emmanuel and instead created a brand-new, redundant stub (`ClqNXQiORuTQE54v5gqKU`, "Isreal"/COLENG) rather than linking to him. Root cause: the matching/affiliation-insert pipeline checked for duplicate (playerId, teamId) rows but never checked whether a NEW college affiliation would conflict with an EXISTING one. **Status:** RESOLVED — 2026-07-09 (session 40C), `dev/fix-israel-emmanuel-swap.mjs --apply` on staging. **Evidence:** dry-run reviewed first (matched confirmed trace exactly — 5 g1 events, 1 g2 event, 1 substitution reference), applied as single atomic batch (14 statements). Post-apply DB query confirmed: new COLMANS "Isreal" stub has exactly 1 college affiliation + stats matching only g1's contribution; Israel Emmanuel has exactly 2 affiliations (COLENG + Pirates FC, zero COLMANS) + stats matching only his real g2 contribution; redundant g2 stub fully deleted (0 rows across players/affiliations/squad_players/stats/event_refs). Full detail: RUNLOG.md 2026-07-09 lines 928-940. Pending items: none — systemic guard shipped separately as `dev/lib/college-guard.mjs` (see follow-up below).
- **Systemic follow-up (not yet built):** the matcher needs a standing guard for all remaining 32 matches — before adding any `affiliation_type='college'` row, check for an existing active college affiliation to a DIFFERENT team and hard-flag the conflict rather than silently writing. Club-team multi-affiliation must remain unaffected.

- ~~**BUG-011**~~ _(HIGH — Data Integrity)_: `playerStats` corruption — 718 goals vs 133 appearances originally observed. **Status:** RESOLVED — WONT FIX (condition no longer exists) — 2026-07-01.

**Evidence:**
- Verified by: Session 40 two-DB audit (`dev/audit-step1-3.mjs`) — SELECT queries against both staging and prod
- Observed result: staging `total_goals = 31`, `stat_rows = 38`; prod `total_goals = 28`, `stat_rows = 31`. Max goals per player = 5 (Samuel Olapite). No anomaly on either DB.
- Root cause of original figure: Sessions 27/29/32 cleanup scripts deleted polluted test match events and rolled back associated stats. The 718-goal figure was a point-in-time read from a very early prod state (Session 3–4, 2026-06-04) before any cleanup ran. That data no longer exists.
- Pending items: none. The zero-and-recompute plan for the backfill session still applies — stats are seeded directly (not event-derived) so double-counting risk on insert is real regardless. But there is no legacy corruption to untangle first.

- ~~**BUG-049**~~ _(HIGH — Logger Flow)_: Start Match silent ghost-state failure. Logger UI flipped to FIRST_HALF before PATCH resolved; PATCH failures swallowed by bare `console.error` — logger saw "live", DB stayed PENDING, no error shown. Same pattern in `handleFinalize` (local state → FINISHED before PATCH). **Fix (both):** PATCH fires first, `res.ok` checked, local `transitionStatus` only called on confirmed success. On failure: `alert()` shown, state unchanged, button re-enabled. `isStartingMatch` state added for Start button; `isSaving` reused for End (already exclusively scoped). `src/components/FootballLogger.tsx`. **Status:** SHIPPED — live test via TEST_CHECKLIST.md → "Start Match silent-failure fix" required before RESOLVED.

**Evidence:**
- Commit: `0561748`
- Verified by: code trace — catch path confirmed non-silent (alert fires, state does not transition)
- Observed result: N/A — code-level fix only, live test still required
- Pending items: run TEST_CHECKLIST.md Start Match + End Match tests (happy path + DevTools block path)

- ~~**BUG-042**~~ _(LOW — Logger UX)_: Logger confirm-lineup screen showed blank player names. Root cause: admin publish stores stubs `{ playerId, jerseyNumber, jerseyName }` — confirm screen rendered `p.name`/`p.number`/`p.position` which don't exist on stubs. Fix: resolve `playerId` against `homePlayers`/`awayPlayers` array; fall back to stub fields. `src/components/FootballLogger.tsx`. Commit `04d49dc`. Resolved: 2026-06-19.

- ~~**BUG-044**~~ _(HIGH — Logger Auth)_: All logger API calls returned 401. Root cause: `POST /api/loggers/auth` returned JWT in JSON body only — never set `authToken` cookie. `getAuthUser()` reads cookie first, got null on every subsequent request. Fix: set httpOnly `authToken` cookie in logger auth response; store token in `localStorage` on login for offline queue SW path; clear both on logout. `src/app/api/loggers/auth/route.ts` + `src/app/logger/page.tsx`. Commit `7808a20`. Resolved: 2026-06-19.

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

### ~~BACKLOG-017 — Missing BUSALYMPICS Match Scores~~

**Status:** RESOLVED — 2026-06-14. All 3 scores confirmed and patched (staging + prod). MD3 G1: COLNAS 3–1 COLENVS. MD3 G2: COLMANS 0–1 COLENG. All 7 fixtures FINISHED.
**Priority:** HIGH — standings still blocked until all scores confirmed
**Filed:** 2026-06-07
**Updated:** 2026-06-14

### ~~BACKLOG-062 — Player Modal: College Select + University Lock~~

**Status:** COMPLETE — 2026-06-16. Commit `f0070e0`.
**Priority:** Medium
**Filed:** 2026-06-16

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

### ~~BACKLOG-028 — Backscope Dead/Partial Features from Public Nav~~

**Status:** RESOLVED — 2026-06-11
**Priority:** High
**Filed:** 2026-06-08
**Source:** SYSTEM_AUDIT.md §11

### ~~BACKLOG-029 — Auth Audit Sweep (Unknown Endpoints)~~

**Status:** RESOLVED — 2026-06-08
**Priority:** High
**Filed:** 2026-06-08
**Source:** SYSTEM_AUDIT.md §5

### ~~BACKLOG-032 — Display Round/Matchday Label on Match Cards~~

**Status:** RESOLVED — 2026-06-08
**Priority:** Medium
**Filed:** 2026-06-08

### ~~BACKLOG-033 — BUSALYMPICS Standings Recalculation~~

**Status:** RESOLVED — 2026-06-14. All scores patched, standings written to both staging and prod. 4 rows upserted. Final excluded correctly. COLENG top (6pts).
**Was:** OPEN — blocked on BACKLOG-017 (2 of 3 missing scores still unconfirmed)
**Priority:** High
**Filed:** 2026-06-08

### ~~BACKLOG-046 — Player Profile Edit Page~~

**Status:** COMPLETE — 2026-06-15
**Priority:** Medium
**Filed:** 2026-06-14

### ~~BACKLOG-053 — Inline Roster Editing (Affiliation-Level Fields)~~

**Status:** COMPLETE — 2026-06-15 (Session 17)
**Priority:** Medium
**Filed:** 2026-06-15

Both parts implemented and committed (dcd464c, 2e83f6d):
- Part 1: `affiliationId` in roster GET, PATCH handler at `roster/[affiliationId]`, inline jersey/position/nicknames edit on Squad tab.
- Part 2: Roster tab re-architected to show `squadPlayers` for selected competition. Dual panel (pool left / squad right). `squadNumber` inline edit → PATCH `squad/[squadPlayerId]`. Squad tab now holds `playerTeamAffiliations` pool + Add Players panel.

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

### ~~BACKLOG-059~~ — SW Scope Conflict Audit (PRE-LIVE-MATCH BLOCKER)

**Status:** RESOLVED — 2026-07-27 (session 47D)
**Priority:** HIGH — potential SW scope conflict in production
**Filed:** 2026-06-16

### ~~BACKLOG-060~~ — SW Architecture Cleanup

**Status:** RESOLVED — 2026-08-03 (session 47G), live-tested against a fresh Vercel preview via a direct Cache Storage read (both files are plain `.js` outside the TS project, so `tsc` doesn't cover them — verified via `node --check` for syntax)
**Priority:** MEDIUM — quality improvement, not blocking
**Filed:** 2026-06-16

### BACKLOG-076 — Basketball College Teams Do Not Exist; 5 Players Unaffiliated

**Status:** RESOLVED — 2026-06-17 — basketball college teams created for COLENG and COLNAS; 5 players (KAMKID, RICHARD, ZUBBY, LIGHT, OJAY) wired on staging + prod.
**Priority:** ~~High~~ — resolved.
**Filed:** 2026-06-17

### BUG-034 — CRITICAL: POST /api/matches/[id]/events Has No Auth Gate

**Status:** RESOLVED — 2026-06-17 (commit 0e55cd4)
**Priority:** CRITICAL — Flow B violation. Any unauthenticated caller can inject events into any live match.
**Filed:** 2026-06-17

### BUG-035 — MEDIUM: POST /api/squads, PATCH /api/squads, DELETE /api/squads Have No Auth Gate

**Status:** RESOLVED — 2026-06-17 (commit 0e55cd4)
**Priority:** Medium — squad manipulation without authentication
**Filed:** 2026-06-17

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

### ~~BACKLOG-093~~ — Logger Has No Service Worker Coverage

**Status:** RESOLVED — 2026-06-19 (commit 71d57f7)
**Priority:** ~~CRITICAL~~ — resolved.
**Filed:** 2026-06-19

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

**Scope decision (Richard, session 50):** fix the bug now regardless of the composer's in/out-of-scope status; defer the "is this an officially supported feature" question to a separate conversation rather than bundling a charter change with an urgent fix. **Resolved later the same session** — see `BACKLOG-212` items 1/2: brought in scope, `CLAUDE.md` updated, hardening built.

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
- **Device-confirmed, strongest evidence tier:** Richard's own device received exactly **one** "Red Card! Osemudiamen Amromawhe has been s[ent off]" notification for the Red Card event above — not two — screenshot-confirmed directly from the notification tray. This is the highest-confidence evidence this bug could produce: a genuine on-device count, not a network-log inference.
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
- **Device-confirmed, basketball branch:** Richard's device received a real "Technical Foul — Hines called for a technical foul" notification for the Technical Foul event above, screenshot-confirmed — the sport-keyed lookup produces a correctly-formed, correctly-delivered notification end to end for basketball, not just a clean DB write.
- Pending items: none.

**Found:** roadmap doc thread 5/7 (background architect-agent research), session 49. **Decision + build:** Richard confirmed "do it now" during roadmap review, session 50.

---

### BACKLOG-208 — Reminder Pipeline: Route Bugs Fixed, Railway Scheduler Existed But Had NEVER Actually Succeeded (middleware Redirect Gap)

**Status:** RESOLVED — 2026-08-06 (session 50, branch `feature/notification-system`)
**Priority:** High — restored from the earlier "downgraded to Medium" pass in this same entry once the real severity became clear: this wasn't just "unverified," it was a confirmed-silent 100% failure rate since the feature shipped

**Premise, corrected twice in the same session:**
1. *First correction:* the roadmap doc (`NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md` thread 2, session 49) claimed "neither reminder route has ever run in production" because `vercel.json` has no `crons` block. That was wrong in one sense — `ws-server/index.js:584-625` (Railway, `BACKLOG-150`'s merge, commit `b767416`, an earlier session) already runs `checkAllMatchReminders()` on a real 5-minute `setInterval`, calling `POST /api/reminders/check` for both staging and prod with their correct per-env `CRON_SECRET_STAGING`/`CRON_SECRET_PROD`. The roadmap doc's research agent never looked in `ws-server/`, a sibling directory for the separately-deployed Railway service.
2. *Second correction, the real one:* having a scheduler that *runs* is not the same as one that *works*. Richard spotted a live Railway log line (`[Reminders] staging check failed: Unexpected end of JSON input`) repeating on every single 5-minute cycle, not a one-off. Investigated and confirmed the actual root cause: **`src/middleware.ts`'s staging-wide auth gate (`env.isStaging` block, lines 32-49) requires an `authToken` session cookie on every route except a short exemption list — `/api/reminders/check` was never in it.** Railway's Bearer-token-authenticated POST carries no cookie, so on staging it was silently redirected to `/login` instead of ever reaching the route handler. Confirmed with hard evidence, not inference: `SELECT * FROM match_reminders WHERE notification_sent = 1` returned **zero rows, across the entire database's history** — this has been failing on every single invocation since the feature shipped, not intermittently.

**Net picture:** the roadmap doc's original claim ("never run in production") was accidentally closer to the truth than the first correction gave it credit for — the scheduler *executed* on schedule, but it had a 100% silent failure rate on staging for its entire existence. Prod is unaffected by this specific gate (`env.isStaging` is false there), separately confirmed via a direct read of prod's own `match_reminders` history (see evidence).

**Fix:** added `pathname === '/api/reminders/check'` to `middleware.ts`'s `isStagingExempt` check, matching the existing pattern used for `/api/loggers/auth`. Any future `CRON_SECRET`-authenticated route will need the same exemption — noted inline in the middleware comment so this doesn't recur.

**What actually needed fixing, and got fixed:** `reminders/check/route.ts`'s reminder body interpolated raw team-ID foreign keys (`${match.homeTeamId} vs ${match.awayTeamId}`) instead of resolved names — now joins `teams` twice (aliased home/away) and uses `homeTeamName`/`awayTeamName`. Added `.limit(500)` to all three previously-unbounded `matchReminders` queries in this file (CLAUDE.md architecture rule). Deleted the superseded `src/app/api/notifications/match-reminders/route.ts` (unfiltered to **all** subscriptions, no idempotency, confirmed via grep that nothing else in `src/` referenced it). Made `GET` run the same real logic as `POST` (both share one `isAuthorized()` check) as defense-in-depth, since **the original `GET` handler had zero auth check at all** and leaked operational counts (`pendingNow`/`upcomingNext24h`) to anyone — a real, if minor, bonus bug fix, live-confirmed before the fix shipped (see evidence).

**Reverted — do not re-add:** a `vercel.json` crons block pointing at this route. Added one initially (`*/5 * * * *`), which **broke both staging and prod deployments outright** — Vercel Hobby plan hard-rejects any cron expression more frequent than once-daily at build time (confirmed via Vercel's own docs, screenshot-verified: "Hobby accounts are limited to cron jobs that run once per day. Cron expressions that would run more frequently will fail during deployment."). Downgrading to a daily schedule was considered and rejected — Railway already provides real 5-minute-granularity scheduling for free, so a Vercel cron would be pure redundant complexity with a real deploy-breaking footgun on this plan tier. **`vercel.json` has no `crons` block after this fix, matching its state before this item started** (net: this item removes dead code and fixes real bugs, adds zero new infra).

**Evidence:**
- `tsc --noEmit` clean (49 baseline, none new).
- Confirmed via `grep` that no other file in `src/` references the deleted `match-reminders` route.
- **Live-confirmed the "GET has zero auth" bug was real**: before this fix shipped, an unauthenticated `GET /api/reminders/check` against the still-deployed old code returned `200` with real operational data (`{"status":"operational","pendingNow":2,"upcomingNext24h":2,...}`) — no auth required at all.
- **Live-confirmed the crons-block deploy failure**: pushing the `*/5 * * * *` cron produced two real GitHub commit-status failures ("Vercel – brixs2 - Deployment failed", "Vercel – brixsports-staging - Deployment failed"), screenshot-confirmed by Richard, directly matching Vercel's documented Hobby-plan rejection behavior — not inferred, observed.
- **Live-confirmed the middleware root cause with hard data, not inference**: `SELECT * FROM match_reminders WHERE notification_sent = 1` against staging returned zero rows across the table's *entire history* (including a test reminder created ~30 minutes earlier this session, still unsent after 6 Railway poll cycles). Cross-checked prod separately: `match_reminders` has zero rows total on prod (feature never exercised there by a real user yet — not evidence of the same bug, just unverified, since `env.isStaging` is false on prod and this specific gate doesn't apply there).
- `tsc --noEmit` clean after the middleware fix (49 baseline, none new).
- **Deployed and live-confirmed end to end.** The middleware fix was cherry-picked (commit `7bef8c7` → `03b5e41`) onto `fix/reminder-scheduler-middleware-gate`, branched off `dev`, PR'd (`#19`), squash-merged to `dev` — the minimal targeted path, ahead of this full feature branch, since the fix only takes effect on whatever `brixsports-staging.vercel.app` actually deploys (which tracks `dev`, not this branch). After that deploy went live, Railway's own log produced `"[Reminders] staging: sent 1/1 reminders"` — the first-ever success line, replacing six-plus consecutive `"failed: Unexpected end of JSON input"` cycles. Cross-checked directly against the DB, not taken on the log line alone: `reminder-live-208-1786036294827` (the test reminder created earlier this session) now has `notification_sent = 1` and a real `notification_sent_at` timestamp — and it is the **first row ever marked sent across the table's entire history**.
- Pending items: none. Fully closed, root cause fixed, deployed, and confirmed via both Railway's own log and a direct DB read.

**Found:** `NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md` thread 2, session 49 (premise later found incomplete). **Fixed & premise corrected:** session 50, after Richard recalled the Railway hand-off decision mid-work and prompted a re-check of `ws-server/index.js`.

---

### BUG-209 — `/assets/` vs `/assests/` Typo Breaks OG Share Images and AEO Structured Data (3 Files)

**Status:** RESOLVED — 2026-08-06 (session 50, branch `feature/notification-system`)
**Priority:** Low-medium — was 404ing on every social share preview and structured-data logo reference, cosmetic, not functional

**Problem:** only `public/assests/Logos/` exists (the typo spelling) — confirmed, that's the real directory. Three files referenced the correctly-spelled `/assets/` path instead, which 404s: `src/lib/utils/aeo.ts:589`, `src/components/seo/PageSEO.tsx:41` (default `ogImage`), `src/app/page.tsx` (homepage `ogImage`). `src/lib/email.ts:217,297` and `src/app/reset-password/page.tsx:301` already correctly used `/assests/`.

**Fix:** pointed all three at `/assests/`, matching the actual directory and the other five already-correct references — minimum fix, directory rename not pursued (bigger blast radius for the same outcome).

**Evidence:** `tsc --noEmit` clean (49 baseline, none new). Not live-verified via an actual social share preview tool this pass — the path now matches the real directory, same shape as the already-working references.

**Found:** `NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md` thread 9, session 49 (surfaced incidentally while checking competition-logo/Cloudinary groundwork). **Fixed:** session 50.

---

