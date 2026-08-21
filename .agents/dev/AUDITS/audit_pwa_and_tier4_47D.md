# Audit — PWA/Offline Infrastructure + Tier 4 Backscope Inventory (Session 47D)

**Date:** 2026-07-28
**Scope:** Read-only code investigation. Two parts: (1) PWA/offline infrastructure (cross-cutting, Tier 1 per `SYSTEM_CRITICALITY_MAP.md`), (2) confirmation that Tier 4 backscoped features (FPL, Predictions, Polls, Scouts, NESA registration) remain correctly inert.
**HEAD at time of audit:** `67d5f8c`
**Builds on, does not re-investigate:** `BACKLOG-059` (SW scope conflict audit — RESOLVED this session, see below) and `BUG-146` (dev-server SSR localStorage crash — fixed).
**Does not duplicate:** `audit_admin_platform_47D.md`, `audit_auth_account_notifications_47D.md`, `audit_logging_system_47D.md` (also in this directory). The logging-system audit's own §13 ("Logger-Role PWA Install + Service Worker Coverage") covers the same SW file from the logger's narrow point of view — this document is the full cross-role reference; where the two overlap, this document is more complete and should be treated as authoritative for PWA-specific claims.

---

## Part 1 — PWA / Offline Infrastructure

### 1. Service Worker Registration/Scope Per Role

**Verdict: WORKS. Matches `BACKLOG-059`'s just-closed finding — confirmed independently by reading the actual registration call sites, not just citing the ticket.**

There is exactly one function that ever calls `navigator.serviceWorker.register()`: `registerServiceWorker()` in `src/lib/pwa.ts:14-40`, invoked only from `usePWA()` in `src/hooks/usePWA.ts:6-40`. Every role goes through this one path via `<PWAProvider>`:

| Layout | SW file | `scope` | Manifest | File:line |
|---|---|---|---|---|
| `src/app/layout.tsx:223` (root, every route by default) | `/sw-user.js` | not passed → defaults to `/` | `/manifest-user.json` (`layout.tsx:78`) | — |
| `src/app/admin/layout.tsx:54-59` | `/sw-admin.js` | `/admin` | `/manifest-admin.json` (`admin/layout.tsx:12`) | — |
| `src/app/logger/layout.tsx:24-29` | `/sw-admin.js` (same file reused, not a fourth SW) | `/logger` | `/manifest-logger.json` (`logger/layout.tsx:7`) | — |

`src/hooks/usePWA.ts:12-17` explicitly guards against a competing registration: if `swPath` contains `'sw-user'` and the current path starts with `/admin` or `/logger`, the registration call is skipped entirely. Combined with the browser's own longest-prefix-match scope resolution, there is no real scope fight — `sw-admin.js` always wins on `/admin/*` and `/logger/*` regardless of `sw-user.js`'s nominal root scope.

`public/sw.js` (the third SW the original `BACKLOG-059` ticket worried about) does not exist in this checkout — confirmed via repo-wide search. This matches the ticket's own resolution text.

**One real finding not previously called out anywhere:** `PWA_IMPLEMENTATION_GUIDE.md` — the document `BACKLOG-059`'s evidence block says was "updated with a Service Worker Ownership Map section" — **lives at the repo root** (`C:\Users\Wise\Desktop\brixsports-v2\PWA_IMPLEMENTATION_GUIDE.md`), not under `.agents/dev/` where this session's brief (and the ticket's own "Document final SW ownership in PWA_IMPLEMENTATION_GUIDE.md" instruction) implied it should be. The content itself checked out — the Ownership Map (lines 44-81 of that file) is accurate and matches what independent code-reading confirms above — but the file location is inconsistent with every other architecture doc in this project, which all live under `.agents/dev/`. Low-severity doc-hygiene note, not a functional gap. Also worth knowing: `SESSION_25_RECON.md:41,101,110` previously flagged this same file as containing forward-looking/aspirational claims that didn't match implementation at the time it was written (2026-06-??) — the newly-added Ownership Map section is independently code-verified as accurate by this audit, but the rest of the file (e.g. the "Best Practices," "Future Enhancements," and some Manifest Configuration examples) still reads as an intended-architecture document in places, not strictly ground truth. Treat the Ownership Map section as trustworthy; treat the rest with the same skepticism `SESSION_25_RECON.md` already recommended.

**No new backlog entry needed** — `BACKLOG-059` is legitimately closed.

---

### 2. Caching Strategy

**Verdict: Still the blanket approach `BACKLOG-060` describes. Nothing has changed. `BACKLOG-060` remains accurately OPEN.**

`public/sw-user.js:66-165` and `public/sw-admin.js:68-149`:

- HTML documents (`request.destination === 'document'`): always network-first, never cached (`sw-user.js:82-87`, `sw-admin.js:79-84`) — this is deliberate, per the code's own `BUG-026` comment, to avoid serving stale HTML that references JS chunks no longer on the server after a deploy.
- API GET requests (`/api/*`): network-first with a cache fallback, no per-route differentiation at all — `sw-user.js:90-113` and `sw-admin.js:87-119` both treat every `/api/*` GET identically, whether it's `/api/matches/[id]/events` (volatile, live data) or `/api/teams` (near-static). `BACKLOG-060`'s specific complaint — no per-route TTL strategy, no distinction between "never cache" vs "network-first 30s stale" vs "stale-while-revalidate" — is still exactly the current state.
- Images (`sw-user.js` only, `116-135`): cache-first, uncapped by URL pattern — `res.cloudinary.com` requests are not skipped, so `BACKLOG-060`'s "Cloudinary requests intercepted unnecessarily, wasting Cache Storage quota" complaint also still applies verbatim. Confirmed by absence of any `cloudinary` string anywhere in either service worker file.
- Static assets (both files): cache-first against a hardcoded `STATIC_ASSETS` array.
- Cache size limiting exists (`limitCacheSize()`, both files) — a real LRU-style eviction by insertion order (`cache.keys()[0]` deleted first) once `MAX_*_CACHE_SIZE` is exceeded, so this isn't fully unbounded, but it's a blunt global cap, not the per-route strategy the ticket asks for.

**Matches:** `BACKLOG-060` (OPEN, MEDIUM priority, "quality improvement, not blocking") — this audit found nothing that changes that priority or status. No new entry needed.

---

### 3. Background Sync for Offline Logger Events

**Verdict: WORKS end-to-end, including the iOS fallback path. This is the most solid piece of the whole PWA layer — genuinely hardened through multiple real bug fixes, not a stub.**

Full write → queue → drain chain, traced through actual code (not inferred):

**Write side** (`src/components/FootballLogger.tsx:823-853`): on a `POST /api/matches/{id}/events` network failure (caught in the `catch` block, distinct from a server-rejected 4xx/5xx which is correctly *not* queued — `FootballLogger.tsx:810-822` — a real distinction that avoids masking genuine server errors as connectivity issues):
1. Reads `localStorage.getItem('authToken')` (line 825). If absent, refuses to queue and alerts the logger to re-login and manually re-log the event (826-830) — a deliberate no-silent-loss decision.
2. Checks JWT remaining TTL via `jwtSecondsRemaining()` (`FootballLogger.tsx:43-53`); refuses to queue if under 30 minutes remaining (`832-838`) — prevents a drained sync later failing with an unrecoverable 401.
3. Writes to IndexedDB `BrixsportAdminDB.pendingMatchEvents` via `queueOfflineEvent()` (`FootballLogger.tsx:28-39`), storing `{ matchId, data, token, timestamp }` — the same shape `sw-admin.js` reads back.
4. Registers the `sync-match-events` Background Sync tag if available (`840-848`).
5. Increments a `queuedOfflineCount` state var, surfaced to the logger as an actual "N Queued" badge in the UI (`FootballLogger.tsx:1525-1529`) — real user-facing feedback, not silent.

**iOS fallback** (`FootballLogger.tsx:184-209`, addressing `BACKLOG-107`): since Background Sync is unsupported on iOS Safari, a separate `useEffect` listens for `window`'s `online` event and `document`'s `visibilitychange` event. On either, `triggerDrain()` re-registers the sync tag if `'sync' in registration` (Android/desktop, idempotent), or — if no `SyncManager` (iOS) — posts `{ type: 'DRAIN_MATCH_EVENTS' }` directly to `navigator.serviceWorker.controller`.

**Drain side** (`public/sw-admin.js`):
- `sync` event listener (`152-160`) → `syncMatchEvents()` (`163-210`) for the `sync-match-events` tag.
- `message` event listener (`355-369`) handles `DRAIN_MATCH_EVENTS` by calling the identical `syncMatchEvents()` directly (`363-368`) — the iOS path and the native Background Sync path converge on the same drain function, so there's no second, divergent implementation to maintain.
- `syncMatchEvents()` reads all `pendingMatchEvents` via raw IDB (`idbGetAll`, `sw-admin.js:248-255` — the code has an explicit comment at `247` noting `IDBDatabase` has no `.getAll()`/`.delete()` and must go through a transaction, a real gotcha the code already accounts for). For each queued event: **skips and warns if `event.token` is missing** (`170-177`, explicit comment explaining this prevents an infinite retry storm from tokenless requests that would 401 forever), otherwise POSTs with `Authorization: Bearer {event.token}`, then deletes the entry from IDB on success and notifies all clients via `postMessage({ type: 'SYNC_COMPLETE', tag: 'sync-match-events' })`.
- `FootballLogger.tsx:173-182` listens for that `SYNC_COMPLETE` message and resets `queuedOfflineCount` to 0 — closing the UI feedback loop.

**Token persistence** (`FootballLogger.tsx:211-227`): a separate mount-time effect calls `POST /api/auth/refresh` and re-writes `localStorage.authToken`, because `AuthContext` wipes `localStorage` on a 401 from `/api/auth/me` for logger roles — without this, the offline-queue write path (which reads `localStorage.authToken` directly, not the httpOnly cookie) would have nothing to queue with after any 401 blip.

**Matches:** `BACKLOG-058` (Logger Offline Event Queue) — `.agents/dev/BACKLOG.md:3869-3910`, **RESOLVED 2026-06-24, session 30**, with a real evidence block (live staging test, iPhone 12 Pro viewport, 15 queued events drained and confirmed via IDB count = 0 post-drain, public page showing all offline-logged events landed). `BACKLOG-107` (iOS drain fallback) — `.agents/dev/BACKLOG.md:37,276` — **SHIPPED `dfad1f6`**, with the specific caveat "pending iOS device verify." This audit's code read confirms the iOS-specific code path exists exactly as `BACKLOG-107` describes and is wired correctly into the same drain function the (live-tested) Android path uses — but this audit did not run a live iOS device test, so `BACKLOG-107`'s own "SHIPPED, not yet RESOLVED" status is accurate and should not be upgraded on the strength of a code read alone, consistent with this project's own evidence standard.

**No new backlog entry needed** for the mechanism itself. One thing worth flagging for whoever eventually revisits `BACKLOG-107`: the iOS fallback depends on `document.visibilitychange` firing and the SW controller still being alive at that moment — `.agents/dev/PWA_LIMITATIONS.md:60-69` already documents that iOS aggressively kills service workers after ~30s of backgrounding, and that the `SYNC_COMPLETE` postMessage (hence the UI badge reset) may never arrive if the SW died between queue-write and drain. This is a known, already-documented limitation, not a new finding — flagging only so it isn't lost when `BACKLOG-107` is finally live-tested on a real iPhone.

---

### 4. Install Prompts (Android `beforeinstallprompt` + iOS Manual Instructions)

**Verdict: Built and reasonably complete, but with one real, already-filed bug (`BACKLOG-131`) confirmed still present in the current code, plus context from `BUG-127`/`BUG-128` that affects how "installability" should be interpreted.**

- **Android/Desktop** (`src/components/pwa/InstallPrompt.tsx`): listens for `beforeinstallprompt` via `setupInstallPrompt()` (`src/lib/pwa.ts:334-351`), shows a custom bottom-sheet prompt. Checks `isAppInstalled()` and a persisted `localStorage['brix-${appType}-installed']` flag (correctly namespaced per role) before showing anything.
- **iOS** (`src/components/pwa/IOSInstallPrompt.tsx`): no `beforeinstallprompt` equivalent exists on iOS (confirmed against `.agents/dev/PWA_LIMITATIONS.md:34-38`), so this component detects iOS via UA sniffing (`/iphone|ipad|ipod/`) and shows a static 3-step "Share → Add to Home Screen → Add" walkthrough instead. A second, more compact `IOSInstallBanner` exists for the same purpose, shown at the top of the screen.

**Confirmed bug, matches `BACKLOG-131` exactly (`.agents/dev/BACKLOG.md:5605-5619`, OPEN, Medium priority):**
1. `InstallPrompt.tsx:28` — `localStorage.getItem('pwa-install-dismissed')` is a single, un-namespaced key. Unlike the "installed" flag (`brix-${appType}-installed`, correctly scoped per role), dismissing the install prompt on the viewer app suppresses it for admin and logger too, and vice versa, for the full 7-day cooldown. Verified directly in the code this audit read — the ticket's claim is accurate as of `67d5f8c`.
2. `InstallPrompt.tsx:42-45` — the comment says "Show prompt after 30 seconds" but the actual `setTimeout` delay is `5000` (5 seconds). Cosmetic but confirmed present, matching the ticket.

`IOSInstallPrompt.tsx` and `IOSInstallBanner`, by contrast, correctly use `localStorage['brix-${appType}-installed']` (namespaced) for the "already installed" check, but their own *dismissal* keys (`ios-install-dismissed`, `ios-banner-dismissed`) are **also** un-namespaced by `appType` — the same bug class as `BACKLOG-131` item 1, just not called out in that ticket's text, which only names `InstallPrompt.tsx`. Worth folding into `BACKLOG-131`'s scope when it's picked up, since fixing one without the other leaves the identical cross-role bleed on the iOS-specific components.

**Context that affects interpretation, not a new bug:** `BUG-127` (`.agents/dev/BACKLOG.md:5559-5572`, OPEN) investigated a report that the viewer root `/` "can't install." That investigation found the manifest and SW registration both look correct on paper, and a later screenshot showed Chrome's native "Open in app" affordance present — the ticket's own conclusion is that native browser installability may already be fine, and what Richard actually meant needs clarifying (could be this custom `InstallPrompt.tsx` UI not behaving as expected, which is exactly what `BACKLOG-131` found). This audit did not attempt to re-diagnose `BUG-127` (no live browser available in this read-only pass) — noting only that `BACKLOG-131`'s confirmed bugs are a plausible, and now doubly-confirmed, explanation for at least part of what was originally reported as "unable to install."

**Matches:** `BACKLOG-131` (existing, confirmed accurate). **New, smaller finding to fold in:** the iOS components' dismissal keys have the identical un-namespaced bleed as item 1 of `BACKLOG-131` — recommend amending that ticket's scope rather than filing a new one, since the fix (namespace every dismissal/cooldown key by `appType`, not just the "installed" flag) is identical for both.

---

### 5. Update Flow (New Deploy → Reload Prompt)

**Verdict: WORKS, and the `BUG-041` hydration fix (verified tonight per the brief, not re-investigated here) looks sound on independent read.**

`src/components/pwa/UpdatePrompt.tsx`:
- On mount, checks `reg.waiting` for an already-waiting worker, and listens for `updatefound` → `statechange` to `'installed'` while a controller already exists (`12-35`) — both are the standard, correct detection patterns for "a new SW version is ready."
- `handleUpdate()` (`90-126`) posts `{ type: 'SKIP_WAITING' }` to the waiting worker, with fallback paths if `registration` is stale or the worker is still `installing` rather than `waiting`. Both service workers' `message` handlers (`sw-user.js:357-358`, `sw-admin.js:358-359`) call `self.skipWaiting()` on that message, as expected.
- The `controllerchange` handler (`UpdatePrompt.tsx:74-81`) is where `BUG-041` lived and was fixed this session. The fix (captured in an extensive in-code comment at `UpdatePrompt.tsx:49-81`) is: record `hadControllerAlready = !!navigator.serviceWorker.controller` **before** attaching the listener, and only call `window.location.reload()` if that was already `true` — i.e., only on a genuine swap of an already-active worker, never on the very first claim of a previously-uncontrolled page. This directly addresses the documented root cause: `sw-user.js:61`'s `activate` handler calls `self.clients.claim()` unconditionally, which fires `controllerchange` even on a brand-new visit with no prior controller, and the old code reloaded on *any* `controllerchange` — forcing a hard reload mid-hydration on every fresh visit, which is what produced React error #418.

**Independent verification note:** this audit confirms the fix's logic is internally consistent with the stated root cause (traced `sw-user.js:61`'s `self.clients.claim()` call directly, matches the comment's citation) and confirms `npx tsc --noEmit` was reported clean for this file per the ticket's own evidence block. This audit did **not** run a live browser test — per `BUG-041`'s own evidence block (`.agents/dev/BACKLOG.md:4648-4652`), that live verification (a genuinely fresh visit, confirm zero forced reload / zero #418) is still an open pending item, and `BUG-041`'s status is correctly `SHIPPED`, not `RESOLVED`, as of this audit. Do not treat this section as closing that pending item.

**Matches:** `BUG-041` (`.agents/dev/BACKLOG.md:4632-4653`), status **SHIPPED — 2026-07-27**, commit pending at time of that entry. No new finding beyond confirming the fix reads correctly.

---

### 6. Offline Fallback Page

**Verdict: WORKS, correctly wired, content is accurate to what's actually cached.**

`src/app/offline/page.tsx` — a static client component (no data fetching, so it can never itself fail while offline). Both service workers fall back to `caches.match('/offline')` when a network-first HTML fetch fails (`sw-user.js:84`, `sw-admin.js:81`) and when a dynamic/API request has no cached response either (`sw-user.js:161`, `sw-admin.js:145`). `/offline` is itself in both `STATIC_ASSETS` precache lists (`sw-user.js:17`, `sw-admin.js:18`), so it's guaranteed available even on a first-ever offline visit before anything else was cached.

Content claims ("View previously loaded matches and scores," "Browse cached news articles," "Access your favorite teams and players") are consistent with what the caching strategy in §2 actually supports (network-first-with-cache-fallback on API GETs, cache-first on images/static assets) — no false promises found here.

**Matches:** nothing outstanding. No backlog entry needed.

---

### 7. Manifest Correctness Per Role

**Verdict: Mostly correct and consistent with the SW Ownership Map (§1). One pre-existing, already-tracked scope-overlap caveat remains (not a bug, a documented structural limitation).**

| Manifest | `start_url` | `scope` | `start_url` within `scope`? | Icons |
|---|---|---|---|---|
| `manifest-user.json` | `/?source=pwa` | `/` | Yes | 192/512, `purpose: "any"` |
| `manifest-admin.json` | `/admin?source=pwa` | `/admin` | Yes | 192/512, `purpose: "any"` |
| `manifest-logger.json` | `/logger?source=pwa` | `/logger` | Yes | 192/512, `purpose: "any"` |

All three pass the specific check `.agents/dev/PWA_LIMITATIONS.md:81-91` (`BUG-075`) originally flagged — that document's own text confirms `manifest-logger.json` was created specifically to fix that scope mismatch, and this audit confirms the fix held: no manifest currently has a `start_url` outside its own `scope`.

There's also a legacy root `public/manifest.json` (no role suffix) still present — a generic, single manifest with no `scope`/`id` field, containing shortcuts to `/live` and `/fixtures`. It is not referenced by any layout's `metadata.manifest` (confirmed: only `manifest-user.json`, `manifest-admin.json`, `manifest-logger.json` are linked from `layout.tsx` files). This file appears to be a pre-role-split leftover — harmless (nothing links to it), but dead weight worth a mention. Not filing a new backlog entry for a zero-risk unreferenced file, but flagging it here since it wasn't mentioned in any existing doc.

**Known, already-tracked overlap (not new):** `BUG-128`'s "related finding" (`.agents/dev/BACKLOG.md:5599`) notes `manifest-user.json`'s scope is `/`, which still technically overlaps `/admin` and `/logger` — narrowing `manifest-admin.json` to `/admin` fixed the specific "Open in app" mis-resolution symptom for admin, but the viewer manifest can't be narrowed the same way since it legitimately spans dozens of route prefixes and the manifest spec has no exclusion syntax. `BUG-128` itself documents this as inherited from a deferred architectural choice (path-based role routing under one origin, vs. the originally-planned subdomain separation) and recommends evaluating subdomain separation as the real fix, not further scope patches. This audit's own manifest read is consistent with that description — no new information to add, just confirming the current state matches what's already documented.

**Matches:** `BUG-075` (implicitly resolved, per `PWA_LIMITATIONS.md`'s own text — not a formally tracked ticket status but the fix is verifiably in place). `BUG-128`'s manifest-overlap side note (context only, not this audit's subject). No new entry needed.

---

## Part 1 Summary Table — PWA / Offline

| # | Sub-feature | Verdict | Backlog cross-ref | New finding? |
|---|---|---|---|---|
| 1 | SW registration/scope per role | WORKS | `BACKLOG-059` RESOLVED | Doc-location note only (`PWA_IMPLEMENTATION_GUIDE.md` at repo root, not `.agents/dev/`) |
| 2 | Caching strategy | Still blanket, unchanged | `BACKLOG-060` OPEN (accurate) | None — confirms ticket still applies verbatim |
| 3 | Background sync / offline queue | WORKS end-to-end incl. iOS fallback | `BACKLOG-058` RESOLVED, `BACKLOG-107` SHIPPED (pending iOS device verify) | None |
| 4 | Install prompts (Android + iOS) | Built, one confirmed bug | `BACKLOG-131` OPEN (confirmed accurate) | iOS components (`IOSInstallPrompt`/`IOSInstallBanner`) have the same un-namespaced-dismissal-key bug as item 1 of `BACKLOG-131`, not currently named in that ticket |
| 5 | Update flow / reload prompt | WORKS, `BUG-041` fix reads sound | `BUG-041` SHIPPED (pending live verify) | None — confirms fix logic, does not promote to RESOLVED |
| 6 | Offline fallback page | WORKS | none outstanding | None |
| 7 | Manifest correctness per role | Correct, one legacy dead file | `BUG-075` (implicitly fixed), `BUG-128` (context) | Unreferenced legacy `public/manifest.json` noted, zero risk |

---

## Part 2 — Tier 4 Backscope Inventory

Per `SYSTEM_CRITICALITY_MAP.md:110-120`, Tier 4 ("Engagement / growth layer") is FPL/Fantasy, Match Predictions, Polls, Scout reports, and NESA registration — explicitly and correctly backscoped under the standing rule: "nothing in Tier 4 gets session time while any Tier 0 item is open, full stop." `ARCHITECTURE.md`'s own "Known Structural Gaps" table (§12) confirms multiple Tier 0/1 items remain OPEN as of this session (WS reconnect backoff/jitter, subscribe storm, notification dedup, etc.), so the standing rule's precondition for keeping Tier 4 dark still holds — this section is a functionality-inertness check only, not a case for reinstatement.

### 8. FPL / Fantasy League

**Verdict: Correctly inert at the page layer, matching `BACKSCOPE.md`. New finding: the API layer has the same unauthenticated-write gap already documented for Predictions and Polls, but `BACKSCOPE.md` does not currently mention it for FPL.**

- All five FPL pages return `notFound()` immediately, with the entire original implementation preserved as a trailing comment block for future reinstatement: `src/app/fpl/page.tsx:1-4`, `create-team/page.tsx:1-3`, `leagues/page.tsx:1-3`, `team/page.tsx:1-3`, `transfers/page.tsx:1-3`. All five carry a `BACKSCOPED: 2026-06-08` comment referencing `BACKLOG-028`. Confirmed correctly inert.
- **New finding, same shape as the already-documented predictions/polls gap:** `src/app/api/fpl/teams/route.ts` `GET`/`POST`/`PATCH` (lines 8, 65, 188), `src/app/api/fpl/leagues/route.ts` `GET`/`POST`/`PATCH` (lines 7, 97, 152), `src/app/api/fpl/leagues/join/route.ts` `POST` (line 7), `src/app/api/fpl/players/route.ts` `GET`/`POST` (lines 7, 82), and `src/app/api/fpl/transfers/route.ts` `GET`/`POST` (lines 7, 38) — none of these call `getAuthUser()`. Read `fpl/teams/route.ts` in full: `POST` (line 65) takes `userId` directly from the request body with no verification it belongs to the caller (`teams/route.ts:68`), writes an `fplTeams` row keyed to whatever `userId` was supplied. Same class of issue `BACKSCOPE.md:71` and `:171` already call out for `/api/predictions` and `/api/polls` ("the page is correctly `notFound()`'d, but the API route is live and has zero auth"). **`BACKSCOPE.md`'s FPL section (lines 11-37) does not currently mention this** — its "What exists in code" list names the routes but its narrative focuses on "NOT BUILT... no real data" rather than the auth gap.
- Real-world risk assessment, consistent with the existing predictions/polls notes: low — no UI surfaces these routes, all FPL DB tables are reported empty (`BACKSCOPE.md:15`), so there's no real data to corrupt and no organic discovery path. Per the Tier 4 standing rule, not fixing this now — noting it so it's not silently rediscovered as new when Phase 7 picks FPL back up, exactly the pattern `BACKSCOPE.md` already uses for predictions/polls.

**Recommendation:** add a paragraph to `BACKSCOPE.md`'s `/fpl/*` section mirroring the existing predictions/polls "Gap found session 47D" notes, so the FPL entry has the same completeness as its siblings. Not done here — this is a read-only audit and `BACKSCOPE.md` is out of my write scope for this pass (only the foreground session or a future session should add to it; a prior foreground session already added the predictions/polls version of this exact note tonight, per the coordinator's update).

---

### 9. Match Predictions

**Verdict: Correctly inert at the page and UI level. API-layer auth gap already documented — not re-discovered here, cited from `BACKSCOPE.md:71`.**

- `src/app/predictions/page.tsx:1-6` — `notFound()`, `BACKSCOPED: 2026-06-08` / `BACKLOG-028`.
- All UI surfaces `BACKSCOPE.md:54-60` claims were removed are confirmed still removed/commented, checked directly in this audit (not just trusted from the doc):
  - `src/app/profile/page.tsx:481` — "My Predictions" `QuickActionButton` is commented out.
  - `src/app/matches/[id]/page.tsx:511-529` (tab button) and `:765-776` (tab content, includes `<MatchPredictionCard>`/`<MatchVotePoll>`) — both commented out.
  - `src/components/MatchOverlay.tsx:1334-1348` — predict/poll tab content block commented out (includes both components).
  - `src/components/matches/UpcomingMatchView.tsx:150-163,205-209` — prediction/poll tab block and the sidebar "Quick Vote" block both commented out.
  - `src/components/BasketballMatchOverlay.tsx:770-784` — same pattern, commented out.
  - `src/app/sitemap.ts:67` — `/predictions` entry commented out.
- **API auth gap (already documented, cited not re-found):** `BACKSCOPE.md:71` — `src/app/api/predictions/route.ts` `POST`/`PUT` is live with no auth, found during this session's `BUG-147` investigation by a different (foreground) pass. Per the coordinator's update, this audit references that finding rather than re-verifying it independently.

**Matches:** `BACKSCOPE.md` `/predictions` entry, fully accurate as written.

---

### 10. Polls

**Verdict: Correctly inert at the page and UI level (no dedicated `/polls` page exists — polls are match-detail-embedded components only). API-layer auth gap already documented — cited, not re-discovered.**

- No standalone `/polls` route exists; polls only ever appeared embedded in match detail/overlay tabs, all confirmed commented out in the same locations checked for §9 above (`matches/[id]/page.tsx:602-618,765-770`; `MatchOverlay.tsx:1342-1348`; `UpcomingMatchView.tsx:205-209`; `BasketballMatchOverlay.tsx:778-784`).
- `src/components/MatchPoll.tsx`, `MatchPollEnhanced.tsx`, `CreatePoll.tsx`, `PollComments.tsx` all exist as files but have zero live import sites outside their own definitions and the commented-out blocks above — confirmed via a repo-wide grep for each component name.
- **API auth gap (already documented, cited not re-found):** `BACKSCOPE.md:171` — `src/app/api/polls/route.ts` `POST`/`PATCH` live with no auth, `createdBy` optional and taken from request body. Independently spot-checked this audit's own grep of `polls/route.ts:77,121` confirms the same: `createdBy` is destructured straight from the request body with `|| null` fallback, no `getAuthUser()` call anywhere in the file.

**Matches:** `BACKSCOPE.md` "Polls UI" entry, fully accurate as written.

---

### 11. Scout Reports

**Verdict: Correctly inert, and simpler than the rest — genuinely dead code, not backscoped-from-a-working-state.**

- `src/app/scouts/page.tsx:1-4` returns `notFound()`.
- **Minor doc drift, not a functional problem:** `BACKSCOPE.md:79` describes the current state as "page component exists but already contained a redirect to `/`" — the actual code at `67d5f8c` is `notFound()`, not a redirect. Functionally equivalent in effect (neither shows the user a scouts page), but the mechanism described no longer matches the mechanism in place — likely the page was changed to match the `notFound()` convention used by the other Tier 4 pages sometime after `BACKSCOPE.md`'s entry was last edited, without the entry being updated. No API routes or DB tables exist for scouts (confirmed: no `src/app/api/scouts/**` matches).

**Matches:** `BACKSCOPE.md` `/scouts` entry — functionally accurate, mechanism description stale.

---

### 12. NESA Registration

**Verdict: Correctly inert.**

- `src/app/nesa-registration/page.tsx:1-6` returns `notFound()`, `BACKSCOPED: 2026-06-08` / `BACKLOG-028`.
- No `src/app/api/nesa-registration/**` routes exist (confirmed via glob — zero matches), consistent with `BACKSCOPE.md:100-103`'s claim that this feature "has no API handler, no DB writes." The schema files (`src/db/schema-nesa-registrations.ts`, `src/db/add-nesa-inter-school-festival.ts`) exist but are inert without any route calling into them.
- Unlike FPL/Predictions/Polls, there is no live-but-unauthenticated API surface here to flag — the backscope for NESA is the cleanest of the five (page hidden, and literally nothing behind it to misuse).

**Matches:** `BACKSCOPE.md` `/nesa-registration` entry, fully accurate as written.

---

## Part 2 Summary Table — Tier 4 Inventory

| # | Feature | Page state | API state | Matches `BACKSCOPE.md`? | New finding |
|---|---|---|---|---|---|
| 8 | FPL / Fantasy | `notFound()`, all 5 pages | Live, zero auth, `userId` from body | Mostly — API gap not yet in doc | FPL has same unauthenticated-write pattern as predictions/polls; not yet noted in `BACKSCOPE.md`'s FPL section |
| 9 | Match Predictions | `notFound()` + all UI surfaces commented | Live, zero auth (already documented) | Yes, fully | None — confirms existing doc |
| 10 | Polls | No dedicated page; all embedded UI commented | Live, zero auth, `createdBy` from body (already documented) | Yes, fully | None — confirms existing doc |
| 11 | Scout Reports | `notFound()` | None exist | Mostly — mechanism description stale (says "redirect," is actually `notFound()`) | Minor doc drift, zero functional impact |
| 12 | NESA Registration | `notFound()` | None exist | Yes, fully | None — cleanest of the five, nothing live behind the hidden page |

---

## Overall Assessment

**PWA/offline layer:** structurally sound where it matters most — the logger's offline event queue (§3) is genuinely hardened and end-to-end verified on Android/desktop, with a real (if not yet device-verified) iOS fallback. The weakest points are (a) the still-blanket caching strategy (`BACKLOG-060`, known, low urgency) and (b) a small, now-doubly-confirmed cross-role bug in the install-prompt dismissal logic (`BACKLOG-131`, known, and this audit found it also affects the iOS-specific components which the ticket doesn't currently name). Nothing found in this audit rises to Tier 0 severity — consistent with `SYSTEM_CRITICALITY_MAP.md:62`'s own classification of PWA/offline resilience as Tier 1 ("closely coupled to Tier 0" but not the core data itself).

**Tier 4 backscope:** holding correctly across all five features at the page and UI level — every claim in `BACKSCOPE.md` was independently re-checked against current code (not just trusted), and all checked out except one stale mechanism description (scouts) with zero functional impact. The one substantive new finding is that FPL's API routes have the identical unauthenticated-write exposure already documented for predictions and polls, but `BACKSCOPE.md` doesn't yet say so for FPL specifically — worth a follow-up doc edit (not performed here, out of this audit's write scope) so the three entries are consistently complete.
