# Audit: Live Match Logging System — Sub-Feature Inventory (Session 47D)

**Scope:** This audit enumerates every sub-feature of the live match logging pipeline itself — the actual functional pieces a logger, admin, or the server touches during a live match — for football, basketball, and track. It maps each sub-feature to its current implementation, cites file:line, gives a health verdict per sport, and cross-references existing `BACKLOG.md` entries.

**Explicitly excluded:** the WS-broadcast layer (event/score/delete broadcasting, socket connection resilience, `useWebSocket.tsx`, the Railway WS server). Two other agents traced that specifically tonight and found: new events/scores/deletes already broadcast correctly for both sports via shared routes; basketball's live clock and lineup-update broadcasts are genuinely missing; a real event-name-mismatch bug makes period-transition broadcasts dead for both sports. Nothing in that layer is re-verified here except where a sub-feature's *non-WS* mechanics (e.g. what data a logger actually produces, not how it's pushed to viewers) are directly relevant.

**Method:** every finding below is from direct code read of the files named in the brief, cross-checked against `.agents/dev/BACKLOG.md` (grepped, not fully read — file is 6000+ lines) and `.agents/dev/SYSTEM_CRITICALITY_MAP.md`. Where a finding duplicates an existing BACKLOG/BUG entry, that entry is cited and NOT re-filed. Where a finding is new, it's marked **NEW FINDING**.

Files read in full: `src/components/FootballLogger.tsx` (2721 lines), `src/components/BasketballLogger.tsx` (1993 lines), `src/components/TrackLogger.tsx` (1012 lines), `src/hooks/useMultiLogger.ts`, `src/lib/multiLogger.ts`, `src/lib/match-state-manager.ts`, `src/lib/ratingsService.ts`, `src/lib/offline/queue-manager.ts`, `src/lib/offline/sync-manager.ts`, `src/lib/offline-queue.ts`, `public/sw-admin.js`, `src/app/logger/page.tsx`, `src/app/logger/layout.tsx`. Partial reads: `src/app/api/matches/[id]/events/route.ts`, `src/app/admin/matches/page.tsx`, `src/components/MatchLoggerUI.tsx`, `.agents/dev/SYSTEM_CRITICALITY_MAP.md`.

---

## 1. Starting Lineup / Squad Selection Before Kickoff

**Football — WORKS.** Full server-persisted flow: `FootballLogger.tsx:338-546` fetches `GET /api/matches/[id]/lineup` on mount, drives a three-state view machine (`check_lineup` → `confirm_lineup` → `active`, lines 163, 516-528). Admin or logger can edit via `handleEditLineup`/`saveLineupDraft` (lines 1223-1306), which POSTs to `/api/matches/[id]/lineup` and persists starters/substitutes/formation. Survives refresh, second logger, device switch — this is the mature reference implementation football's own history (BUG-115/117/118) was built to fix.

**Basketball — PARTIALLY WORKS / BROKEN for resume.** In-app wizard exists (`showLineupModal`, lines 92-98, 1623-1814) — pick exactly `STARTER_COUNT` (5, or 3 for 3x3) players per team, confirmed via `homeStarters`/`awayStarters` state. But there is **no server-side persistence at all** — no equivalent of football's `/lineup` endpoint is ever called. `BasketballLogger.tsx:339-360` seeds `homeStarters`/`awayStarters` from the *full roster* (not the real starters) whenever `match.status === 'LIVE'` and the arrays are empty — this is `BUG-139`'s shipped fallback, not a real fix. Tracked as `BACKLOG-141` (OPEN, "deliberately deferred") for the real fix, and `BUG-139` (RESOLVED, stopgap only) for the immediate unblock. Matches `SYSTEM_CRITICALITY_MAP.md`'s Tier 0 structural gap note verbatim.

**Track — DOESN'T EXIST.** `TrackLogger.tsx` has no lineup/squad-selection concept — athletes are added ad hoc per-race via `addAthlete()` (line 190), not selected as a pre-match squad. Not a gap relative to the sport's own domain (track doesn't have a "starting XI" concept the way team sports do), but worth noting there is no admin-published "who's competing" surface analogous to football/basketball's lineup.

---

## 2. Live Event Recording

**Football — WORKS.** Comprehensive event set defined in `match-state-manager.ts:31-43` (Goal, Penalty, Own Goal, Assist, Yellow/Red Card, Foul, Push, Handball, Save, Catch, Block, Interception, Clearance, Tackle, Corner, Free Kick, Throw In, Goal Kick, Shot/Shot on Target/Shot off Target, Offside, Substitution, Penalty Saved/Missed). UI buttons at `FootballLogger.tsx:1780-1829`. Player-selection flow branches correctly per event type (goalkeeper-only for Save/Catch, no-player for set pieces, assist chain for Goal/Penalty, reason modal for cards, foul-outcome modal for fouls). `recordEvent`/`confirmEvent` (line 935) writes to the local `MatchStateManager` first (optimistic), then POSTs to `/api/matches/[id]/events` (line 799).

**Basketball — WORKS but structurally incomplete for real officiating.** Event set: Field Goal, Three Pointer, Free Throw (each with a "Missed" variant), Rebound (offensive/defensive — but both call the same generic `'Rebound'` type, no distinction persisted), Steal, Block (also reused for "Deflection" — no distinct type), Assist, Turnover, Foul (6 UI subtypes — Personal/Technical/Flagrant/Offensive/Shooting/Unsportsmanlike — but all six call `handleEventClick('Foul')` with **no subtype passed through**, `BasketballLogger.tsx:1108-1113`), Substitution, Timeout. This last point is `BUG-134` (OPEN, HIGH) — confirmed still accurate: technical fouls silently inflate the same `personalFouls` counter as a real personal foul (`events/route.ts:353-355`), no per-player disqualification threshold exists anywhere, no team-foul/bonus tracking exists despite the config API returning `teamFoulBonusAt: 5` (never read client-side).

**Track — WORKS locally, DOESN'T EXIST server-side.** Full event model for both track (`recordFinish`, position-by-time with tie handling within 0.001s, `TrackLogger.tsx:233-268`) and field events (`recordFieldAttempt`, best-of-6 with foul tracking and wind-speed capture, lines 283-346). All correctly modeled in local React state. But confirmed **zero API calls anywhere in the file** — no `fetch()` to any endpoint. `saveResults()` (line 361) is literally: `alert('Results saved successfully!')` with a code comment "In real implementation, save to database." Reaction times are also simulated (`Math.random()`, line 224), not real timing input. This confirms the brief's stated assumption — Track has zero persistence layer — and extends it: even the "finish" timer relies on `setInterval` wall-clock ticking (10ms resolution, line 165-167), not any external timing hardware integration, which is fine for the stated scope but worth being explicit about. **No existing BACKLOG/BUG entry found for Track's total lack of persistence** — this is surprising given how severe it is (every track result logged today is lost on refresh/navigation) and is flagged as a gap in tracking, not just a gap in the product.

---

## 3. Event Undo / Delete

**Football — WORKS, most sophisticated of the three.** `handleUndo` (`FootballLogger.tsx:1062-1146`) is server-first: DELETEs `/api/matches/[id]/events/[eventId]` and only mutates local state after `res.ok`. Correctly special-cases the second-yellow-card chain — undoing an auto-generated "Red Card (Second Yellow)" also finds and deletes the preceding Yellow Card that triggered it (lines 1069-1080, 1096-1115), with a partial-failure fallback (red already deleted server-side, yellow delete failed) that still updates local state to match reality rather than silently diverging.

**Basketball — WORKS.** `undoLastEvent` (`BasketballLogger.tsx:693-734`) was cosmetic-only until `BUG-130` (RESOLVED) made it server-first: DELETE first, gated on `res.ok`, functional-update score revert only after confirmation. Server's own DELETE handler (`events/[eventId]/route.ts`, per BUG-130) reverts score and player stats correctly for basketball's event types. No second-yellow-equivalent chain to worry about in basketball's rule set.

**Track — DOESN'T EXIST.** No delete/undo UI or handler anywhere in `TrackLogger.tsx`. Consistent with zero persistence overall (item 2) — there is nothing server-side to undo.

---

## 4. Event Dedup / Duplicate-Prevention

**Write-side temp-ID-swap pattern:**
- **Football — WORKS.** `manager.recordEvent()` generates a `temp_${Date.now()}_${random}` id (`match-state-manager.ts:528`); after the server POST succeeds, `manager.confirmEvent(tempId, serverId)` (`FootballLogger.tsx:808`) swaps it in place so the next multi-logger sync tick's exact-ID dedup (`mergeEvents`, `multiLogger.ts:130-132`) recognizes it as already-known rather than a new remote event.
- **Basketball — WORKS**, same pattern, fixed later (`BUG-129`, RESOLVED): local temp id `e${events.length+1}` is swapped for the server's real id on success (`BasketballLogger.tsx:656-659`).

**Rapid-double-tap prevention (client-side):**
- **Football** relies on button `disabled` state during modals but has no explicit re-entrancy ref guard on `confirmEvent` itself.
- **Basketball — WORKS**, and unusually well-documented: `isRecordingRef` (line 72) is a synchronous ref guard, deliberately not `useState` alone, because a true simultaneous double-click can fire two handlers against the same render's stale closure before React commits `setIsRecording(true)` (`BACKLOG-134`'s own comment, lines 58-71, confirmed live not hypothetical). This is a genuinely more defensive pattern than football's for this specific class of bug.

**Server-side dedup — DOESN'T EXIST for either sport.** Confirmed via read of `events/route.ts:170-240`: the POST handler has no idempotency-key check, no "does an identical event already exist for this match/player/type/minute" query — it unconditionally inserts whatever event body arrives, wrapped only in a transaction (`BUG-121`, RESOLVED) that guarantees the insert and score-update commit atomically, not that a *repeated* POST is rejected. **NEW FINDING (not previously filed as its own item):** if a client-side guard fails or is bypassed (e.g. a replayed offline-queue POST, or two loggers' independent optimistic writes for the same real-world event racing each other), nothing server-side would catch or merge the duplicate — both rows persist, both count in stats/score. The existing conflict-detection code in `multiLogger.ts:44-118` (`detectConflicts`, time-window + same-type+player heuristic) only runs client-side against the periodic 10s/15s sync fetch — it flags conflicts for a UI badge but `resolveConflict` (`useMultiLogger.ts:197-208`) only ever marks local state `resolved: true`, it never actually deletes or merges the duplicate row server-side (see item 11 below).

**Track — N/A**, no persistence to dedup against.

---

## 5. Score Calculation and Persistence

**Football — WORKS.** `MatchStateManager.updateScoreFromEvent` (`match-state-manager.ts:587-604`) increments home/away atomically in local state for Goal/Penalty/Own Goal (own-goal correctly credits the opposing team). Server-side, `events/route.ts`'s atomic SQL increment (`BUG-121`) plus a documented allowlist of point values (`BUG-131`, preventing a client from sending an arbitrary `value`) keeps DB score authoritative and race-safe.

**Basketball — WORKS**, fixed this project's own history (`BACKLOG-125`, RESOLVED session 46): `isBasketballScore` gate in `events/route.ts:196-201` requires `made === true` and a positive numeric `value` on Field Goal/Three Pointer/Free Throw before crediting score — a missed shot (points=0) correctly never touches score, matching the `made` vs `value`-truthiness distinction the code comments call out explicitly (both this route and `BasketballLogger.tsx:561-565`). Client-side `recordEvent` also updates `homeScore`/`awayScore` state directly (lines 598-609) for optimistic UI, in parallel with the server write.

**Track — DOESN'T EXIST** in the "score" sense — track has no running score, only per-athlete finish times/positions and field-event best-marks, both computed correctly in local state (see item 2) but never persisted.

---

## 6. Match Clock / Period / Quarter Management

**Football — WORKS, most mature.** `MatchStateManager`'s clock is timestamp-based (`tick()`, lines 290-318) specifically to avoid `setInterval` drift — deltas are computed from `Date.now()` diffs, not tick counts. State machine (`isValidTransition`, lines 485-500) enforces legal period transitions (NOT_STARTED→FIRST_HALF→HALF_TIME→SECOND_HALF→[EXTRA_TIME_1→EXTRA_TIME_2]→[PENALTY_SHOOTOUT]→FINISHED, plus SUSPENDED/ABANDONED branches). Automatic period-end detection (`checkPeriodEnd`, lines 323-361) respects announced stoppage time. Mid-match resume seeding from DB (`FootballLogger.tsx:407-449`) restores period, absolute minute, and running state correctly (BUG-115/117/118, all RESOLVED).

Two known **open** gaps, already tracked at Tier 0 in `SYSTEM_CRITICALITY_MAP.md`, confirmed still present by this read: **no delta cap in `tick()`** (a device that sleeps for an hour and wakes would jump the clock forward by the full elapsed real time, `match-state-manager.ts:292-293` has no clamp), and **`SUSPENDED` doesn't stop the clock** — `transitionStatus`'s switch statement (lines 423-464) has explicit clock-stop handling for `HALF_TIME`/`FINISHED`/`ABANDONED` but no `case 'SUSPENDED'` at all, meaning a suspended match's clock keeps running in the background if it was running when suspended.

**Basketball — PARTIALLY WORKS, by deliberate design with a real residual gap.** There is **no ticking clock at all** — `time` (`BasketballLogger.tsx:34`) is a static string, manually set on quarter transitions, never auto-decrementing. This is explicitly called out as an intentional minimal-scope decision in the code's own comment (lines 35-42): "deliberately out of scope — minimal fix, not football-parity live clock." `quarterStartedAt` (a wall-clock timestamp) is used only to derive distinct, monotonically-increasing `(minute, second)` values per event for sort-order purposes, not for a live display. Quarter transitions (`showPeriodModal`, lines 1816-1962) are entirely manual — the logger taps "End Quarter" and picks the next action; `currentPeriod` is persisted via fire-and-forget PATCH (not the stricter PATCH-first pattern football's Start/End Match uses, by the code's own comment, lines 1853-1860, judged lower-risk since a failed period-label PATCH doesn't lose data the way a failed status transition would).

Confirmed-open, tracked gaps: `BACKLOG-137` (quarter duration fetched/displayed but never enforced — no blocking check compares elapsed time to `quarterDuration` anywhere) and `BACKLOG-138` (no halftime state exists at all — Q2→Q3 uses the identical generic "next quarter" handler). `BUG-135` (OT numbering never advances past a flat `'OT'` string for both OT1 and OT2, indistinguishable in event history) also confirmed still open by this read (`BasketballLogger.tsx:1738,1925` both call `setQuarter(periodCount + 1)` unconditionally).

**Track — WORKS for its own narrow purpose, isolated per-race.** `isTimerRunning`/`currentTime` (lines 99-174) is a real `setInterval`-driven stopwatch, resettable, with pause/resume. No period/quarter concept — each race/attempt is independent, `resetRace()` (line 373) clears state for the next heat. Since results are never persisted (item 2), this clock's output is also lost once the component unmounts.

---

## 7. Substitutions Mid-Match

**Football — WORKS.** Two-phase modal (`handlePlayerSelect` routes to `setShowSubInModal`, `FootballLogger.tsx:889-892`; `handleSubIn`, lines 918-933): pick player going out from on-pitch players, then pick incoming player from bench (`getAvailableBench`, lines 317-336, correctly excludes already-subbed-on players and the player mid-swap). Enforces `maxSubstitutions` cap per team when configured (lines 920-928). Bench empty-state has a fallback message (`BUG-070`'s fix, football's original).

**Basketball — WORKS, with an important gap flagged elsewhere.** Same two-phase pattern (`handleSubIn`, lines 500-518), with `BUG-141`'s fix (RESOLVED) adding the same bench-empty fallback message football has. **Gap confirmed still open:** `BUG-136` — nothing checks a player's foul count before allowing them back onto the court via substitution, a direct consequence of `BUG-134`'s missing foul-out enforcement (no threshold exists to check against yet). Code-confirmed by direct read of `handleSubIn`/the sub-in modal filter (only checks bench membership, `homeSubs`/`awaySubs`), live occurrence itself not yet tested.

**Track — DOESN'T EXIST**, not applicable to the sport's format as modeled here (athletes are per-race entries, not a persistent on-court roster with a bench).

---

## 8. Match Finalization (End-of-Match Flow, Locking Further Edits)

**Football — WORKS.** `handleFinalize` (`FootballLogger.tsx:1148-1201`) is PATCH-first: only calls `stateManager.current.transitionStatus('FINISHED')` locally after the server PATCH (`status: 'FINISHED', currentPeriod: 'FINISHED'`) returns `res.ok`. Also fires a `MATCH_END` push notification and can be reached from the `FINISHED` period's "End" button regardless of score parity (line 1723-1728). `handlePeriodEndConfirm` (lines 1024-1051) additionally auto-finalizes in the same PATCH when regulation ends with a score difference, so the "End Match" button being hidden post-FINISHED doesn't strand the match (`BUG-076`, referenced in the code's own comment).

**Basketball — WORKS.** `finalizeMatch` (`BasketballLogger.tsx:736-765`) similarly PATCHes `status: 'FINISHED', currentPeriod: 'FINISHED', homeScore, awayScore` and only sets `matchEnded` locally on `response.ok`. The quarter-end modal's "Finalize Match" button (line 1917, when scores are unequal at end of regulation) now correctly calls the real `finalizeMatch()` rather than a dead local-only `setMatchEnded(true)` — this was itself a bug fixed in the same code (the comment at lines 1902-1910 documents the fix, same class as football's already-fixed `BUG-076`).

**Track — DOESN'T EXIST** as a persisted concept — `resetRace()` clears local state for the next heat, there is no match-level "finish and lock" flow, consistent with zero persistence overall.

**Locking further edits after finalize (all sports):** confirmed there is no explicit server-side guard rejecting further event POSTs/PATCHes against a `FINISHED` match in the code paths read here — finalization is a status flag other UI reads (`canLogEvents`, `matchEnded`) to disable buttons, not an enforced write-lock. **NEW FINDING:** a maliciously or accidentally replayed POST to `/api/matches/[id]/events` for an already-FINISHED match was not confirmed to be rejected by the route logic reviewed (only auth/role and payload-shape checks were visible in the section read); this would need a dedicated route-level check to confirm one way or the other and is flagged for further investigation rather than asserted as broken.

---

## 9. Auto-Calculated Player/Team Ratings Triggered From Logging

**Football — WORKS.** `calculateAndSaveRatings()` (`ratingsService.ts:21-236`) is called directly from `events/route.ts` (per its own header comment, `BACKLOG-124` RESOLVED — this removed a prior self-fetch that 401'd on every call, meaning ratings had never actually run live before that fix). Reads `match.lineups` (football's JSON shape: `{home: {starters, bench}, away: {...}}` or array fallback, lines 43-58), derives per-player stats from `match_events` via type/detail-keyword matching, runs `RatingCalculator.calculateAutoRating()`, upserts into `player_ratings` and `team_ratings`.

**Basketball — BROKEN end-to-end.** Confirmed via `BACKLOG-146` (OPEN): `calculateAndSaveRatings()` unconditionally requires `match.lineups` in football's shape (`ratingsService.ts:37-41`, throws `'No lineups found for this match'` if absent) — basketball never populates that DB column (its lineup state lives only in local React state per item 1's finding), so both the automatic trigger (`events/route.ts`'s `after()` call, silently caught) and the manual admin "Calculate Ratings" action (`admin/match-ratings/[id]/page.tsx`, returns the failure as a raw error to the admin UI per `BUG-138`'s note) fail on every basketball match. `team_ratings` table itself now exists (`BUG-138`, RESOLVED session 47C) but that was necessary, not sufficient — blocked on `BACKLOG-141` (basketball lineup persistence, item 1 above) before this can ever succeed. Separately, `BasketballLogger.tsx` has its own **client-only, ephemeral** rating calc (`calculatePlayerRating`, lines 163-218) shown in the Stats tab and player-select modals — this is never persisted anywhere, purely a live-session display convenience, and is lost on refresh (recalculated fresh from whatever `events` happen to be in state at that moment).

**Track — DOESN'T EXIST.** No rating concept in `TrackLogger.tsx` at all — consistent with track being a position/time sport, not a per-player-rating sport, and also consistent with zero persistence overall.

---

## 10. Offline Queue — Event Queued When Network Drops, Retry/Drain on Reconnect

**Football — WORKS, and is the only genuinely wired implementation.** `FootballLogger.tsx`'s inline `openAdminDB()`/`queueOfflineEvent()` (lines 11-39) writes directly to `IndexedDB` database `BrixsportAdminDB`, object store `pendingMatchEvents` — deliberately matching `sw-admin.js`'s schema (the file's own top-of-file comment at lines 7-9 explicitly warns: *"Do NOT use offline-queue.ts / brixsport-offline.events — that DB has no reader"*). On a network failure during event POST (lines 823-853), the logger checks the JWT has ≥30 min remaining life before queueing (refusing to queue and surfacing an alert otherwise, since a drained sync with an expired token would 401 with no recovery path) then queues the event with its auth token embedded (a service-worker sync event has no live session/cookie to draw from). `sw-admin.js`'s `syncMatchEvents()` (lines 163-210) drains the queue on the `sync-match-events` background-sync tag, replaying each queued POST with a `Bearer` header built from the stored token, skipping (not failing) any row with no token to avoid a retry storm. An iOS fallback exists (`BACKLOG-107`, SHIPPED, pending device verify) since Background Sync is a no-op on iOS — `online`/`visibilitychange` listeners (`FootballLogger.tsx:188-209`) `postMessage` a `DRAIN_MATCH_EVENTS` command directly to the SW.

**Basketball — DOESN'T EXIST.** Confirmed by direct grep and read: zero references to `indexedDB`, `offline`, `queue`, or `sw-admin` anywhere in `BasketballLogger.tsx`. Every failure path (roster load, period-transition PATCH, event POST, undo DELETE) surfaces a visible error banner (`eventSaveError` state) but the write is never recovered — dismissing the banner loses the data permanently. This is already tracked as `BUG-142` (OPEN, HIGH — "every write path this session gave a failure a visible banner... but none of them can ever self-heal"), filed the same session this audit's brief was written against. This audit's independent code read confirms `BUG-142`'s finding exactly.

**Track — DOESN'T EXIST**, consistent with zero persistence overall — there's nothing to queue since nothing is ever sent to the server in the first place.

**Dead code, NEW FINDING (scoped clarification, not a functional bug):** `src/lib/offline/queue-manager.ts`, `src/lib/offline/sync-manager.ts`, and `src/lib/offline-queue.ts` (three separate files, two different IndexedDB schemas — `brixsport-offline`/`eventQueue` and `brixsport-offline`/`events`) are fully-built, fully-functional-looking offline queue implementations with retry counts, conflict resolution stubs, and stats — but **nothing in either logger component ever instantiates or calls them** (confirmed via grep: only cross-references are in comments in `FootballLogger.tsx` explicitly telling future readers not to use them, plus unrelated code-comment mentions in `events/route.ts` and `matches/[id]/page.tsx`). A corresponding `/api/events/sync` route does exist server-side (`src/app/api/events/sync/route.ts`) but its only callers are these same dead client modules. This is pure dead weight in the codebase, not a live risk, but worth flagging for cleanup — a future engineer grepping for "offline queue" will find three candidate implementations and could easily wire up the wrong one.

---

## 11. Multi-Logger Sync (Two Loggers on the Same Match Not Conflicting)

**Both sports — PARTIALLY WORKS, with a mechanism gap not previously documented this precisely.**

`useMultiLogger.ts` provides `joinMatch`/`leaveMatch` (session registration via `/api/matches/[id]/loggers`), a 30s heartbeat, 10s polling for other active loggers, and `syncEvents`/`broadcastEvent`. **NEW FINDING:** `broadcastEvent` (`useMultiLogger.ts:178-192`) does **not** send anything to other loggers or the server at all — it only dispatches a same-tab `CustomEvent('MULTI_LOGGER_EVENT')`, which is useless for cross-device/cross-tab sync (a `CustomEvent` on `window` never leaves the browser tab that dispatched it). The actual cross-logger sync mechanism is entirely the periodic `syncEvents()` poll (football: every 10s, `FootballLogger.tsx:667-726`; basketball: every 15s, `BasketballLogger.tsx:439-467`), which fetches all DB events and merges via `mergeEvents()` (`multiLogger.ts:123-145` — dedup by exact ID, sort by minute/second/timestamp). This means two loggers on the same match are never pushed each other's events in real time; they only converge once every 10-15 seconds via poll, and the component-level `broadcastEvent` calls sprinkled through both loggers (`FootballLogger.tsx:741`, `BasketballLogger.tsx:613`) are effectively no-ops for anything beyond same-tab bookkeeping.

`detectConflicts`/`resolveConflict` are similarly incomplete: conflicts are correctly *detected* (time-window + same-type+player heuristic for duplicates, a contradiction table for e.g. simultaneous Goal+Save, `multiLogger.ts:44-118`) and surfaced via `MultiLoggerStatus` UI (both loggers render it), but `resolveConflict` (`useMultiLogger.ts:197-208`) only flips a local `resolved: true` flag in React state — it never actually deletes a duplicate row server-side or merges a contradiction. A logger clicking "resolve" on a conflict banner makes the banner disappear; it does not change what's in the database or what a public viewer sees.

Server-side "single-writer enforcement" (mentioned in `SYSTEM_CRITICALITY_MAP.md` as `BUG-122`, RESOLVED) is a WS-layer concern (excluded from this audit's scope) and is a genuinely separate, real mitigation for concurrent *live-clock* writers — it does not address the event-dedup gap described here, which is REST-side, not socket-side.

**No existing BACKLOG entry found specifically calling out `broadcastEvent`'s no-op cross-device behavior or `resolveConflict`'s local-only resolution** — both are **NEW FINDINGS**, filed here rather than re-filed as duplicates. The Live Event Readiness Checklist in `CLAUDE.md` already flags "Two simultaneous loggers do not conflict or overwrite" as **OPEN — no dual-logger test ever run. Clock collision risk confirmed** — this audit adds that even the REST-level event-merge path has a real, code-confirmed gap (real-time push does nothing; resolution UI does nothing to the DB) beyond the already-known clock-collision risk.

**Track — N/A**, no multi-logger hook is used in `TrackLogger.tsx` at all (confirmed, no `useMultiLogger` import).

---

## 12. Logger Session Persistence (120-Minute Requirement)

Not a component-level concern for any of the three loggers directly — this lives in the auth layer (`src/lib/auth.ts`, JWT issuance) which was out of this audit's assigned file list, but two directly relevant mechanisms were observed in the loggers themselves:

- **Football — has an active mitigation.** `FootballLogger.tsx:211-227` explicitly re-seeds `localStorage.authToken` on mount via `POST /api/auth/refresh`, because `AuthContext` wipes `localStorage` when `/api/auth/me` returns 401 for logger roles — the code comment names this exact interaction. This is `BUG-058b`'s fix.
- **Basketball — has the same mitigation, added later.** `BasketballLogger.tsx:147-160`, ported verbatim per `BUG-140` (RESOLVED session 47C) — confirmed by this read to be present and matching football's pattern exactly.
- **Track — has no equivalent.** No `auth/refresh` call anywhere in `TrackLogger.tsx`. Given Track has no server writes at all (item 2), a token wipe mid-session wouldn't lose any data today, but if persistence is ever built for Track this gap would need the same fix.

Per `CLAUDE.md`'s own Live Event Readiness Checklist, the underlying claim ("Logger session persists 120+ minutes") is itself still **UNVERIFIED** — "no sustained 120min logger session test run" — this audit's code read confirms the *mechanism* exists (JWT re-seed on mount) for football and basketball but cannot itself confirm the mechanism holds up over a full 120-minute live session; that requires a live test, not a code read, and is correctly left as unverified rather than asserted either way here.

---

## 13. Logger-Role PWA Install + Service Worker Coverage

**All sports (shared, since this is route-level not component-level) — WORKS for the core mechanism, with one caching risk worth flagging.** `src/app/logger/layout.tsx` wires `PWAProvider` with `swPath="/sw-admin.js"`, `scope="/logger"`, `showInstallPrompt={true}` — install-prompt UI is active for the logger route specifically (distinct amber favicon/manifest, `manifest-logger.json`, to visually distinguish from viewer/admin tabs per the layout's own comment). `sw-admin.js` implements install/activate/fetch/sync/push/notificationclick/message handlers — a genuinely complete service worker, not a stub. HTML documents are explicitly network-first-only (never cached) per the code's own `BUG-026` comment, avoiding stale-JS-chunk errors after a deploy. API GETs are network-first with a capped (`MAX_API_CACHE_SIZE = 50`) fallback cache for offline reads.

**NEW FINDING (minor, not filed elsewhere):** the API cache-first-fallback path (`sw-admin.js:86-119`) will serve a **stale cached GET response** for any API endpoint if the network fetch fails, with no distinction between "safe to serve stale" (e.g. `/api/teams`) and "dangerous to serve stale" (e.g. `/api/matches/[id]/events` — a logger seeing a stale event list after a network blip could believe an event wasn't saved when it was, or vice versa). This is a generic SW caching strategy, not logger-specific, and may be an accepted tradeoff, but is worth flagging since it directly touches the "never show success when it didn't happen" rule in this project's own `CLAUDE.md`.

The PWA reliability contract itself (per `SYSTEM_CRITICALITY_MAP.md`'s Locked Decisions) already accepts iOS screen-lock clock correctness as out of scope — consistent with what's implemented here.

---

## 14. Sport-Specific Rules Enforcement

**Basketball — CONFIRMED still accurate, matches `BUG-134`/`135`/`136` exactly as filed** (see item 2 and item 7 above for the detail): no foul subtype persisted, no team-foul/bonus tracking despite the config API computing it, no disqualification threshold, no OT2 distinction, fouled-out players not blocked from re-subbing (blocked on the same missing foul-count data). This audit's independent read of `BasketballLogger.tsx` corroborates every specific line-citation in those three BACKLOG entries — no discrepancy found, no need to re-investigate depth per the brief's own instruction.

**Football — no offside or comparable position-based rule enforcement exists in this codebase, confirmed by this read.** `FootballEventType` includes `'Offside'` as a loggable *event* (a human referee/observer calls it, the logger just records it happened) — there is no automated offside detection or enforcement logic anywhere in `match-state-manager.ts` or `FootballLogger.tsx`, which is expected and correct: this is a human-officiated logger, not a video/positional tracking system, and automated offside detection is explicitly out of this project's scope per `CLAUDE.md` ("Automated video or AI-based score detection" is listed under Explicit Out of Scope). The one piece of enforced football-specific logic that does exist is the second-yellow-equals-red rule (`match-state-manager.ts:545-568`), which is correctly automatic.

**Track — has its own domain-correct rules already built:** tie-handling thresholds (1ms for track times, 0.01m for field marks, `TrackLogger.tsx:255,338`), wind-legality threshold for jumps (±2.0 m/s, line 534-538), DQ with a reason field. These are real, working, sport-correct logic — just entirely client-side and never persisted (see item 2).

---

## 15. Admin-Side Oversight/Correction Tools for Live Matches

**PARTIALLY WORKS, and this is the weakest-documented area of the three sports combined.** `src/app/admin/matches/page.tsx` has a match-edit modal (`handleUpdate`, lines 309-355) that PATCHes `/api/matches/[id]` — but the `formData` populated by `handleEdit` (lines ~270-289, read in this audit) covers sport, teams, venue, competition, status, matchType, competitionLevel, friendlyType/description, round, groupName, matchday, and override flags — **it does not include `homeScore`/`awayScore` fields**, meaning the standard admin match-edit UI has no visible path to correct a bad live score once logged, even though the underlying `PATCH /api/matches/[id]` route does accept those fields (loggers themselves send them routinely). A determined admin could presumably craft a raw PATCH request with score fields to correct one, but there's no UI surface for it.

Separately, `src/app/admin/match-ratings/[id]/page.tsx` provides a "Calculate Ratings"/"Adjust Ratings" surface (linked from `logger/page.tsx:393-401` for FINISHED matches) — this is a post-match ratings-correction tool, not a live-match event/score correction tool.

This directly compounds the structural gap already on record in `SYSTEM_CRITICALITY_MAP.md`: **"No mutation audit trail for `matches` table"** — even if an admin *could* correct a live score (via the API directly or a future UI), there is no record of the previous value, the actor, or the timestamp of that correction. Combined with this audit's finding that the admin UI doesn't even expose a score-correction field, live-match correction today is effectively "an admin with API access and no audit trail," not a real supported workflow. **No existing BACKLOG entry was found specifically calling out the admin edit modal's missing score fields** — flagged here as a **NEW FINDING**, adjacent to (not a duplicate of) the already-tracked audit-trail gap.

---

## 16. Penalty Shootout Handling

**Football only (basketball/track have no shootout concept). CONFIRMED still accurate per `BACKLOG-105`: "interim guard only," full implementation OPEN.** `match-state-manager.ts` already models `PENALTY_SHOOTOUT` as a valid period (`FINISHED` → `PENALTY_SHOOTOUT` → `FINISHED` transitions are legal per `isValidTransition`, lines 492-494) and `FootballLogger.tsx:1766-1778` renders dedicated Scored/Missed/Saved buttons during that period using the *regular* `Penalty`/`Penalty Missed`/`Penalty Saved` event types — this is exactly the "interim guard" `BACKLOG-105` describes: it works for basic logging today but does not yet implement the distinct `PEN_SCORED`/`PEN_MISSED`/`PEN_SAVED` event types, the separate `shootout_home_score`/`shootout_away_score` columns, or the dedicated `ShootoutModal` (team→taker→outcome, no fouler picker) that `BACKLOG-105`'s architecture section specifies. Practical risk already documented in that entry: shootout kicks logged today via the regular Penalty event types would incorrectly write to career player stats and the main match score if the `isPenaltyShootout` guard (`events/route.ts:181`) weren't already in place — that guard is confirmed present in the code read for this audit (skips score/stat writes when `match.currentPeriod === 'PENALTY_SHOOTOUT'`), so the interim state is safe, just incomplete (shootout score itself isn't tracked in dedicated columns yet — likely still living in the `matches.stats` JSON blob per `BACKLOG-120`, which covers display of that blob, a distinct but related open item).

---

## 17. Additional Sub-Features Found (Not in the Original Enumeration)

- **Match config fetch (halfDuration/quarterDuration, maxSubstitutions/periodCount/overtimeDuration).** Both football (`FootballLogger.tsx:456-469`) and basketball (`BasketballLogger.tsx:411-433`) fetch `/api/matches/[id]/config` on mount and lock duration editing once the match has started. WORKS for both; failure shows an `alert()` rather than a persistent banner (minor UX inconsistency with the rest of the error-handling pattern used elsewhere in both files, not filed as a bug here — low severity).
- **Generic/fallback logger for other sports (Volleyball etc.).** `src/app/logger/page.tsx:227-230` routes any sport that isn't Basketball/Football-family/Track to `MatchLoggerUI.tsx`, a fourth, less-audited logger component with its own `SPORT_EVENTS` table (Football, Basketball, and Volleyball event sets defined, `MatchLoggerUI.tsx:21-60+`). This audit did not deep-dive this file per the brief's file list, but flags its existence: it appears to be an earlier/parallel implementation (imports `useWebSocket` directly rather than going through `useMultiLogger`) and its health relative to the two purpose-built loggers is unknown — worth a dedicated pass if Volleyball or another "other" sport is ever actually scheduled for a live match.
- **Match-time broadcast to overlay/remote clients** (`FootballLogger.tsx:567-621`) includes a **BUG-109 DB checkpoint**: every 15 real seconds (throttled independently of the WS emit), the current minute is PATCHed to `/api/matches/[id]` as a durable fallback for a page load with a dead socket. This is explicitly *not* gated on `isSocketConnected` — the comment notes the DB write matters most exactly when the live channel isn't reaching viewers. Confirmed present, working as described, football-only (basketball has no equivalent periodic clock checkpoint, consistent with basketball having no ticking clock to checkpoint in the first place).
- **Comms/staff-notes panel** — present in `FootballLogger.tsx` but fully commented out (lines 231-275, 1533-1539), per `BACKLOG-142` (RESOLVED session 47C: `/api/staff-comms` had zero auth gate, the feature was pulled entirely rather than half-fixed). Confirmed correctly disabled, not a live gap — noted for completeness since it's a real sub-feature that exists in the code but is intentionally dark.

---

## Sub-Feature Inventory Table

| # | Sub-Feature | Football | Basketball | Track |
|---|---|---|---|---|
| 1 | Starting lineup / squad selection | WORKS | PARTIALLY WORKS (no server persistence, `BACKLOG-141` OPEN) | DOESN'T EXIST (no squad concept) |
| 2 | Live event recording | WORKS | WORKS (foul subtypes not enforced, `BUG-134` OPEN) | WORKS locally / DOESN'T EXIST server-side |
| 3 | Event undo / delete | WORKS | WORKS | DOESN'T EXIST |
| 4 | Event dedup (client temp-ID swap) | WORKS | WORKS | N/A |
| 4b | Event dedup (server-side) | DOESN'T EXIST | DOESN'T EXIST | N/A |
| 5 | Score calculation & persistence | WORKS | WORKS | DOESN'T EXIST (no score concept) |
| 6 | Match clock / period management | WORKS (2 open Tier-0 gaps: no delta cap, SUSPENDED doesn't stop clock) | PARTIALLY WORKS (no ticking clock by design; quarter cap/halftime not enforced, `BACKLOG-137`/`138` OPEN) | WORKS (isolated per-race, never persisted) |
| 7 | Substitutions mid-match | WORKS | WORKS (fouled-out players not blocked from re-entry, `BUG-136` OPEN) | DOESN'T EXIST |
| 8 | Match finalization | WORKS | WORKS | DOESN'T EXIST |
| 9 | Auto-calculated ratings | WORKS | BROKEN (`BACKLOG-146` OPEN, blocked on #1) | DOESN'T EXIST |
| 10 | Offline queue / retry-on-reconnect | WORKS | DOESN'T EXIST (`BUG-142` OPEN) | DOESN'T EXIST |
| 11 | Multi-logger sync | PARTIALLY WORKS (poll-only; real-time broadcast + conflict resolution are no-ops, NEW FINDING) | PARTIALLY WORKS (same gap) | N/A (hook not used) |
| 12 | Logger session persistence (120min) | Mechanism present (`BUG-058b`), live duration UNVERIFIED | Mechanism present (`BUG-140` RESOLVED), live duration UNVERIFIED | No mechanism (not needed — no writes) |
| 13 | PWA install + SW coverage | WORKS (shared across sports) | WORKS (shared) | WORKS (shared) |
| 14 | Sport-specific rules enforcement | WORKS (2nd-yellow=red only; no offside logic, correctly out of scope) | BROKEN (confirmed, `BUG-134`/`135`/`136` all still accurate) | WORKS (ties, wind-legality, DQ — all correct, none persisted) |
| 15 | Admin oversight/correction tools | PARTIALLY WORKS (no score-edit field in admin UI, NEW FINDING; no audit trail, tracked) | Same (shared admin UI) | Same (shared admin UI, though nothing to correct since nothing persists) |
| 16 | Penalty shootout handling | PARTIALLY WORKS (interim guard confirmed accurate, `BACKLOG-105` OPEN) | N/A | N/A |

---

## Summary of New Findings (Not Previously in BACKLOG.md)

1. **Track & Field logger has zero persistence layer** — confirmed still true, and more completely characterized than the brief's assumption: not just "no DB write," but `saveResults()` is a literal no-op `alert()`, reaction times are simulated with `Math.random()`, and there is no existing BACKLOG/BUG entry tracking this at all despite its severity (every track result logged today is unrecoverable on refresh).
2. **`useMultiLogger`'s `broadcastEvent` is a same-tab-only no-op** — it dispatches a `window` CustomEvent that never reaches another device or tab; the only real cross-logger sync mechanism is the 10-15s periodic poll. Every `broadcastEvent()` call site in both loggers is effectively inert for actual multi-device sync.
3. **`resolveConflict` never touches the database** — clicking "resolve" on a multi-logger conflict banner only flips local React state; the duplicate/contradictory event rows remain in the DB and remain visible to public viewers exactly as before.
4. **No server-side event dedup/idempotency check exists at all** — the events POST route only guarantees atomic insert+score-update (`BUG-121`), not duplicate rejection. Client-side guards (temp-ID swap, `isRecordingRef`) are the only protection, and both are per-tab, not cross-device.
5. **Admin match-edit modal has no score-correction fields** — the underlying API accepts `homeScore`/`awayScore` in a PATCH, but the standard admin UI (`admin/matches/page.tsx`) does not expose them, compounding the already-tracked "no mutation audit trail" gap.
6. **Three parallel, mutually-exclusive offline-queue implementations exist in the codebase** — only one (`FootballLogger.tsx`'s inline `BrixsportAdminDB` queue + `sw-admin.js`) is actually wired up and used; `src/lib/offline/queue-manager.ts`, `src/lib/offline/sync-manager.ts`, and `src/lib/offline-queue.ts` (plus `/api/events/sync`) are fully-built but entirely dead code. Not a functional risk today, but a real maintenance/discoverability trap.
7. **No server-side write-lock confirmed on FINISHED matches** for the event-POST path reviewed — flagged as needing dedicated investigation, not asserted as broken.
8. **`sw-admin.js`'s API cache-first-on-failure fallback doesn't distinguish safe-to-serve-stale from dangerous-to-serve-stale endpoints** — a logger could see a stale event list after a network blip with no visual distinction from a fresh one.

None of these eight are re-filings of existing BACKLOG/BUG entries (checked by targeted grep before inclusion); all other findings in this document cite and defer to the existing entry rather than duplicating it.
