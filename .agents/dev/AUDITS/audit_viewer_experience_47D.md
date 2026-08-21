# Audit: Public Viewer Experience (session 47D)

**Scope:** every sub-feature an anonymous, unauthenticated viewer (per `CLAUDE.md`'s actor model — "Viewers NEVER have a session") actually experiences on the public site. This is the Tier 0-1 product per `SYSTEM_CRITICALITY_MAP.md`. Read-only investigation; no code changed.

**Method:** direct code read of every file in the brief, plus follow-on greps to confirm where components/hooks are actually mounted (not just defined) and where BACKLOG entries this touches currently stand. Three other audits exist in this directory (`audit_logging_system_47D.md`, `audit_auth_account_notifications_47D.md`, `audit_admin_platform_47D.md`) — this one does not duplicate their content; cross-references are called out explicitly where relevant.

**Headline finding:** the product's own stated rule ("Viewers NEVER have a session") is violated by the only two real push-notification enrollment surfaces in the app — both require a signed-in user. A genuine anonymous viewer cannot opt into match notifications through any UI path that exists today. See §7.

---

## 1. Live score display and update mechanism

Behavior is genuinely different per surface — this is the most fragmented sub-feature in the audit.

- **`src/app/matches/[id]/page.tsx` (the full match detail page, both sports):** WORKS. Real layered design:
  - WS live via `useMatchEvents`/`useMatchTimer` (`src/hooks/useWebSocket.tsx:286-331,383-415`).
  - `match:score:updated` / `match:status:changed` listeners (`page.tsx:217-250`).
  - BUG-080 fallback: 10s poll of `/api/matches/[id]` only while WS is disconnected and match is live (`page.tsx:164-172`).
  - BUG-108 reconciliation poll: 25s poll while WS **is** connected, to catch events whose broadcast never fired (`page.tsx:174-188`).
  - BUG-109 staleness gate: `isMatchTimeStale` prevents a frozen WS clock from permanently winning over a fresher DB value once polling refreshes it (`page.tsx:325-333`).
  - Confirmed exact polling cadence matches what was traced earlier tonight: 10s (disconnected) / 25s (connected, defense-in-depth), never simultaneous.

- **Homepage `src/app/page.tsx` match cards:** BROKEN as a live surface. `matches` state is fetched once on mount (`page.tsx:63-173`) and only re-fetched on a `window` `MATCH_STATUS_CHANGE` CustomEvent (`page.tsx:176-285`). Grepped every dispatch site of that event: it is fired **only** from `src/lib/match-state-manager.ts:935` and `src/components/BasketballLogger.tsx:851` — both logger-only components dispatching to their own tab's `window`. A remote viewer's browser can never receive this event; it only "works" if a logger and a viewer happen to share the same tab, which never happens in production. **There is no WS subscription and no polling interval anywhere on the homepage.** A viewer who leaves the homepage open during a live match sees a permanently frozen score/status until they manually reload. This is a materially bigger gap than BACKLOG-096/BUG-020 (which only concerned the dedicated `/live` page's poll) — not currently filed as its own item anywhere I found.

- **`src/app/live/page.tsx` (Live Center):** PARTIALLY WORKS. 15s poll of `/api/matches`, filtered client-side to `status === 'LIVE'` (`live/page.tsx:44-49`), with an explicit code comment: "stopgap until WebSocket subscription is wired to the public viewer (BUG-020)". No WS at all on this page. Functional but coarse-grained (15s lag) and, per that comment, self-identified as unfinished.

- **`src/app/football/page.tsx` / `src/app/basketball/page.tsx` (sport hub, MATCHES tab):** BROKEN as a live surface. Matches are fetched once when `selectedCompetition` changes (`football/page.tsx:156-226`, `basketball/page.tsx:167-213`) — no poll, no WS. A live match's score inside these tabs is a static snapshot until the viewer switches competitions or reloads.

- **`src/components/MatchOverlay.tsx` (football match modal, opened from homepage):** WORKS. Full WS wiring — `useMatchStatus`, `useMatchEvents`, `useMatchTimer`, `useLineupUpdates`, plus a re-fetch of `/api/matches/[id]` on every WS reconnect to correct any state missed while disconnected (`MatchOverlay.tsx:44-74`).

- **`src/components/BasketballMatchOverlay.tsx` (basketball match modal):** BROKEN, confirmed as flagged. **Zero WebSocket wiring** — no import of `@/hooks/useWebSocket`, no `useMatchEvents`/`useMatchStatus`/`useMatchTimer`/`useLineupUpdates` call anywhere in the file. Score/status render directly from the `match` prop (`BasketballMatchOverlay.tsx:216-228`), which is whatever was in the homepage's `selectedMatch` state at the moment the viewer clicked the match card. Since the homepage itself never refreshes that state live (see above), a basketball match opened in this overlay shows a **permanently static score and status for the lifetime of the overlay** — it will not update even if the viewer leaves the modal open for the rest of the match. The only own-initiative fetches are `fetchMatchDetails()` when the Lineups/Stats tab is opened (`BasketballMatchOverlay.tsx:46-57`), which pulls fresh data once per tab-open, not continuously.

**Verdict:** football has a genuinely real-time detail page and overlay; basketball's homepage-overlay path and every hub-page match list (both sports) are static snapshots. This is a bigger practical gap than the single "basketball overlay has no WS" symptom in the brief — the root cause (homepage never refreshes `matches` state) also silently starves the football overlay of freshness for anyone who doesn't click into `/matches/[id]`.

---

## 2. Match event timeline rendering

Three independent implementations exist, with uneven parity:

- **`LiveMatchTimeline.tsx`** (used by `/matches/[id]`'s Timeline tab): BUG-083 case-normalization fix present (`.replace(/\s+/g, '_')`, confirmed at the type-switch call sites). Basketball period labels (Q1-Q4, OT) are explicitly handled with their own comment block (`LiveMatchTimeline.tsx:338-349`) noting `BasketballLogger` now sends `period` on every event, so basketball events no longer fall through to the football-only minute-based fallback. Basketball-specific minute display (quarter + countdown clock instead of a football-style `'`) is also implemented (`LiveMatchTimeline.tsx:416-458`). **However**, per BACKLOG's own note on BUG-083, this file has no `RED_CARD_(SECOND_YELLOW)` case (unlike `MatchTimeline.tsx`, which does) — a real, still-open parity gap between the two shared timeline components.
- **`MatchTimeline.tsx`** (a second, more full-featured shared component with filters): not actually wired into any of the pages read for this audit (`/matches/[id]` uses `LiveMatchTimeline`, `MatchOverlay`/`BasketballMatchOverlay` use their own inline renderers — see below). Appears to be either legacy or reserved for a surface not covered here; worth confirming it isn't dead code.
- **`MatchOverlay.tsx`'s own inline Timeline tab** (`MatchOverlay.tsx:1174-1233`): a **third, hand-rolled** rendering — bespoke goal/sub/card icon logic, no BUG-083 case-normalization, no basketball-aware period/quarter labeling, raw `event.minute'` only. This is a previously-undocumented parity gap: the homepage's own match-detail modal shows a materially different (and less-correct) timeline than the full `/matches/[id]` page for the exact same match.
- **`BasketballMatchOverlay.tsx`:** DOESN'T EXIST. Its tab list is `watch, overview, lineups, stats, standings, scout, chat` (`BasketballMatchOverlay.tsx:104-120`) — there is no timeline/events tab at all. A viewer who opens a basketball match from the homepage has no way to see the play-by-play event feed; they only get score, per-quarter point totals, and box-score-style stat bars.

**Verdict football (`/matches/[id]`):** WORKS, with one known open gap (BUG-083's second-yellow case, `LiveMatchTimeline.tsx` only).
**Verdict football (homepage overlay):** PARTIALLY WORKS — renders but bypasses the BUG-083 fix entirely (new finding, not in BACKLOG).
**Verdict basketball:** DOESN'T EXIST on the homepage-overlay surface; WORKS (via `LiveMatchTimeline`) on `/matches/[id]`.

---

## 3. Match status/period label display

BACKLOG-119 (red dot removed, red clock/period label during active play, neutral chip otherwise) is RESOLVED and live-verified — but only on **one** of the surfaces that show a status:

- **`/matches/[id]/page.tsx` header** (`page.tsx:448-465`): matches the BACKLOG-119 spec exactly — pulsing red dot + red minute during `ACTIVE_PLAY_PERIODS`, red HT/PK label with no dot/clock otherwise. This is the surface BACKLOG-119's evidence block DOM-inspected.
- **`src/components/LiveMatchStatus.tsx`** (used on **homepage match cards**, `page.tsx:736`): a different, older design. The `!matchTime` fallback path (used for every basketball match, since basketball never gets a WS time tick — see below) always renders a red pulsing dot regardless of period (`LiveMatchStatus.tsx:41-47`), and even once `matchTime` exists, `HALF_TIME`/`FINISHED`/`Q1-Q4`/`OT` labels never suppress the dot the way BACKLOG-119 specified for `/matches/[id]`. **The homepage cards were never updated to match BACKLOG-119's visual language.**
- **`src/components/MatchStatusBadge.tsx`:** a third, visually distinct design (emoji icons, colored pill backgrounds) that predates BACKLOG-119 entirely. Traced its usage: imported into `matches/[id]/page.tsx:13` but **never actually rendered** in that file's JSX (dead import — the page uses its own inline logic instead). Its only real consumers, `src/components/LiveMatchCard.tsx` and `src/components/FixtureCard.tsx`, are themselves not imported anywhere under `src/app` or elsewhere in `src/components` — both are orphaned/unused components. Not a live-facing risk today, but dead code worth a cleanup pass.
- **`MatchOverlay.tsx`'s own status pill** (`MatchOverlay.tsx:878-891`): a fourth, independently hand-coded implementation that happens to also apply "red dot only during active play" logic — but as its own duplicate, not shared code, so any future tweak to the BACKLOG-119 visual language requires editing 3 separate places (`matches/[id]/page.tsx`, `MatchOverlay.tsx`, `LiveMatchStatus.tsx`) to stay consistent, with no shared component enforcing it.
- **`BasketballMatchOverlay.tsx`:** no red/live styling logic at all — status renders as plain text in a neutral `bg-white/10` pill regardless of live state (`BasketballMatchOverlay.tsx:225-227`). BACKLOG-119 never reached this surface.

**Verdict:** WORKS on the one page BACKLOG-119 was tested against (`/matches/[id]`); PARTIALLY WORKS/inconsistent everywhere else a status is shown. This directly answers the brief's question — no, it is not consistently applied everywhere a status shows. New finding, not currently filed.

---

## 4. Homepage match cards — live indicator, score, auto-update

Covered in depth in §1/§3. Summary: live indicator dot renders correctly at load time (`page.tsx:735-736` routes to `LiveMatchStatus`), and the score digits are correct at load time — but **nothing on the homepage ever refreshes `matches` state for a real, remote viewer**. No WS subscription, no `setInterval` poll. The only refresh path (`MATCH_STATUS_CHANGE` window event) is same-tab-logger-only and unreachable by a viewer's browser. **BROKEN** as a "without manual refresh" live surface — this is the most consequential single finding in this audit given the product's core promise ("people who can't be there want to know what's happening as it happens").

---

## 5. Stats tab / live stats display

- **`/matches/[id]/page.tsx` → `LiveStats.tsx`:** WORKS for data that exists — `match.stats` refreshes via the same WS/poll layers as the rest of the page (§1), and `LiveStats.tsx` renders sport-specific bars for football (`renderFootballStats`, tolerant of both array- and flat-key stat shapes) and basketball (`renderBasketballStats`). Falls back to a friendly "coming soon" message for any other sport (`LiveStats.tsx:235-239`).
- **`MatchOverlay.tsx`'s own inline Stats tab:** a separate hand-rolled `StatRow` renderer (`MatchOverlay.tsx:1390-1451`), football-only (no basketball branch at all — `match.stats?.possession`, `expectedGoals`, etc. are all football-shaped keys). If a basketball match were ever opened through `MatchOverlay` (it shouldn't be, since the homepage explicitly routes basketball to `BasketballMatchOverlay` — `page.tsx:772-786` — but worth flagging as a latent trap if that routing logic ever regresses) its stats tab would render nothing useful.
- **`BasketballMatchOverlay.tsx`'s Stats tab:** WORKS for the data it has — `StatBar` component showing points/FG%/3P%/FT% (`BasketballMatchOverlay.tsx:352-407`) — but this data comes from a one-time `fetchMatchDetails()` call when the tab is opened (`BasketballMatchOverlay.tsx:41-57`), not a live subscription, consistent with §1's finding that this overlay has no live update mechanism at all.

**Verdict:** WORKS on `/matches/[id]` for both sports; PARTIALLY WORKS on the homepage overlays (correct rendering, but static/one-shot data for basketball, football-only field support in the football overlay's own duplicate implementation).

---

## 6. Lineup/squad display for a live match (viewer-facing)

- **`/matches/[id]/page.tsx` → `MatchLineups.tsx`:** WORKS for initial display, but **not live**. `match.lineups` is only refreshed as part of the same `fetchMatchData` cycle used for scores/events (10s/25s polling, §1) — there is no dedicated WS lineup subscription wired into this page at all (no `useLineupUpdates` call in `page.tsx`). A published lineup change (e.g., a late team-sheet swap) would take up to 25s to reach a viewer on this page, longer if WS happens to be down (10s poll only fires when the match is in a `LIVE_STATES` status).
- **`MatchOverlay.tsx`:** WORKS and is the one surface with an actual live lineup subscription — `useLineupUpdates(match.id)` (`MatchOverlay.tsx:53,190-203`) pushes lineup changes in real time via `match:lineup:updated`.
- **`BasketballMatchOverlay.tsx`:** PARTIALLY WORKS — lineup data is fetched once when the Lineups tab is opened (`fetchMatchDetails`, `BasketballMatchOverlay.tsx:41-57`) and never refreshed again while the tab stays open, consistent with the overlay's total lack of live wiring.

**Verdict:** the *best* lineup experience (true live push) exists only on the football homepage overlay — the full match detail page that a shared link actually points viewers to has no live lineup push at all, only the general polling cadence.

---

## 7. Push notification opt-in flow and delivery experience

This is the most significant finding in the audit and directly contradicts the actor model in `CLAUDE.md`.

Traced every real enrollment surface in the codebase (not just the ones named in the brief):

- **`src/components/SettingsOverlay.tsx`** (opened from the homepage bell icon, `page.tsx:457-468` → `setIsSettingsOpen(true)`): `handleEnablePush` explicitly gates on a signed-in user — `if (!user) { toast.error('Please sign in to enable notifications'); return; }` (`SettingsOverlay.tsx:83-87`). An anonymous viewer clicking "Enable Notifications" gets an error toast telling them to sign in; the browser permission prompt is never even requested.
- **`src/components/OnboardingModal.tsx`:** requires a `userId` prop and is only ever rendered from `src/app/signup/page.tsx` — i.e., only reachable after account creation, never for anonymous browsing.
- **`src/components/NotificationPermission.tsx`** (the component the audit brief specifically named): takes a `userId: string` prop and would, on its face, work for any visitor if mounted with one. Grepped every usage across `src/` — it is **never imported or rendered anywhere in the app** (not in `layout.tsx`, not in any page, not in `PWAProvider`). It is orphaned/dead code today.
- **`src/hooks/useNotificationPrompt.ts`** (also named in the brief): defined, exports `useNotificationPrompt`, but grepped and confirmed it is **never called anywhere in the codebase**. Also dead code. (Its own internal logic additionally only proceeds `if (isAuthenticated && user?.id)` — `useNotificationPrompt.ts:26-29` — so even if it were wired up, it would gate on auth exactly like `SettingsOverlay`.)
- **`src/components/notifications/NotificationPrompt.tsx`:** a `sonner`-toast-based variant, takes `isOpen`/`onClose` props; grepped for a mount site and found none under `src/app`. Also appears unwired for the viewer surface (may be intended for a different flow not covered here — flagging for confirmation, not asserting dead with full certainty since it wasn't traced past `src/components`).

**Net effect:** every enrollment path that is actually reachable by a click today (`SettingsOverlay`) requires authentication; every path that would work anonymously (`NotificationPermission.tsx`) is not mounted. **A genuine anonymous viewer — the only kind the actor model says should exist — cannot enable push notifications through any UI in the app.** This is a new finding; BUG-084 (retracted, "three enrollment paths exist") did not check whether any of those three paths are reachable *without* signing in, and none of them are.

**Cross-reference to already-tracked delivery bugs** (not re-investigated in depth, per the brief): BUG-085 (dedup key includes `Date.now()`, defeating dedup) — the git log for this session shows a commit "fix(notifications): stop dedup key from including Date.now() (BUG-085)" has landed, but `BACKLOG.md` line 330 still shows `**Status:** OPEN` as of this read — the backlog entry has not yet been updated to reflect tonight's fix (a different, currently-active foreground session owns that file, so this is reported rather than corrected here). BUG-086/087/088/089 remain OPEN per `BACKLOG.md` and were not independently re-verified; no new viewer-facing symptoms beyond what's already filed were observed for those four.

---

## 8. PWA install experience for a viewer

Traced the actual mount path, since the brief's target files aren't the whole story:

- `src/app/layout.tsx` (root, viewer-facing) wraps everything in `<PWAProvider swPath="/sw-user.js">` with no `appType` override, so it defaults to `appType: 'user'` (`PWAProvider.tsx:18-26`).
- `PWAProvider.tsx` only suppresses `InstallPrompt`/`IOSInstallPrompt`/`IOSInstallBanner` when the current path starts with `/admin` or `/logger` **and** the SW path includes `'user'` (`PWAProvider.tsx:32-38`) — so on every genuine public route, `InstallPrompt` (Android/Chrome `beforeinstallprompt`) and `IOSInstallPrompt`/`IOSInstallBanner` (manual Safari instructions) are all mounted and active. This part is correctly wired for viewers — contrary to what a shallow read of `layout.tsx` alone would suggest (it doesn't reference these components directly at all; they only appear via `PWAProvider`).
- `InstallPrompt.tsx`: listens for the native `beforeinstallprompt` event via `setupInstallPrompt` (`src/lib/pwa.ts`, not read in full this pass), shows 5s after the event fires, respects a 7-day dismissal cooldown and a persisted "already installed" flag per `appType`. Standard, reasonable implementation — no code-level defect found.
- `IOSInstallPrompt.tsx`/`IOSInstallBanner`: pure UA-sniffing (`/iphone|ipad|ipod/`) plus `navigator.standalone` check; shows manual "Share → Add to Home Screen" instructions since iOS Safari has no `beforeinstallprompt`. Also no code-level defect found; this is the expected iOS pattern given the documented `PWA_LIMITATIONS.md` constraint that `beforeinstallprompt` doesn't exist on iOS.

**On BUG-127** ("viewer PWA reportedly not offering install — unconfirmed, needs Richard's repro"): from code alone, the install prompt machinery for the root `/` viewer app is present, correctly mounted, and not obviously suppressed. Nothing found in this pass explains a genuine "no install offered" symptom for Android/Chrome — that would point to something outside this code path (manifest validity, HTTPS/SW-registration failure, or Chrome's own installability heuristics not being met, e.g. missing icons/screenshots in `manifest-user.json`, which was not opened this pass). Cannot resolve BUG-127 from this audit; confirms it's still genuinely unconfirmed rather than a case of "the code obviously suppresses it," which is useful negative information for whoever reproduces it next.

**Verdict:** WORKS as designed (Android/Chrome path, iOS manual-instructions path); BUG-127 remains open and unexplained by anything found here.

---

## 9. Offline experience

- **`src/app/offline/page.tsx`:** a static, well-built fallback page — clear "You're Offline" messaging, a bullet list of what's still available (cached matches/news/favorites), "Try Again" (reload) and "Go Home" actions. No code defects found; this is a simple presentational page with no live-data dependency, so there isn't much that can break here beyond the service worker actually serving it, which is outside this file.
- Cross-reference: brief states BUG-080 (the general SW/offline-related fallback bug family) is confirmed RESOLVED tonight by a prior trace — not re-verified independently here, but nothing in `offline/page.tsx` itself contradicts that.

**Verdict:** WORKS (as a static fallback). No live-data claims are made by this page, so it can't itself be "wrong" the way a stats/score display could be.

---

## 10. Favourite/follow team or player as a viewer

Two entirely separate, inconsistent implementations exist:

- **`src/hooks/useFavorites.ts`** (used by `MatchOverlay.tsx`'s team-follow heart, and by the homepage's `FAVORITES` filter tab): for a genuinely unauthenticated viewer (`localStorage.getItem('authToken')` is `null`, which is the expected state per the actor model), `toggleTeam`/`togglePlayer` write **only** to `localStorage` (`useFavorites.ts:61-97`, `99-134`) — no API call is even attempted. This actually **works correctly** for the real viewer population: it persists per-device across reloads with no server round-trip to fail. BUG-091's premise (a silent 401/403 with no rollback) would only manifest for a user who somehow has a stale/invalid `authToken` while still being treated as a "viewer" — a narrower edge case than BUG-091's write-up implies, worth a quick re-scope next time it's touched, but not something this pass can fully resolve without knowing whether "viewer with a token" is a real reachable state elsewhere in the app (e.g. a viewer who logged in once, then the token expired but wasn't cleared).
- **`src/app/matches/[id]/page.tsx`'s own heart button** (`page.tsx:43,400-405`): a **third, undocumented implementation** — `const [isFavorited, setIsFavorited] = useState(false)`, toggled with no `localStorage` write, no API call, and no use of `useFavorites` at all. This is strictly worse than BUG-091's described state: it doesn't even attempt to persist, optimistically or otherwise — it silently resets to unfavorited on every page reload. **This is a new finding**, not covered by BUG-091 (which describes the team-follow heart specifically), and affects the actual match-detail page every shared link points to.

**Verdict:** homepage/overlay team-follow (`useFavorites`) WORKS for genuine anonymous viewers (localStorage-only, which is fine for that population); BUG-091 as filed is OPEN but may be narrower in practice than written. The match-detail page's own favorite heart is BROKEN (new finding — doesn't persist at all, in any form).

---

## 11. Search functionality

`src/app/search/page.tsx`: fully viewer-facing, no auth guard anywhere in the file. Straightforward `GET /api/search` call with category/sport filters, renders teams/players/competitions/matches results. `PlayerProfileOverlay` opens on player click. No code-level defects found in this pass — this is a simple, self-contained request/render page with no live-data or WS dependency, so there's little to break beyond the API route itself (not in scope for this audit).

**Verdict:** WORKS.

---

## 12. Other viewer-facing findings worth flagging

- **Dead/orphaned components discovered incidentally:** `src/components/LiveMatchCard.tsx`, `src/components/FixtureCard.tsx` (both unused anywhere), `src/components/MatchStatusBadge.tsx` (only reachable via those two, plus one dead import in `matches/[id]/page.tsx`), `src/components/NotificationPermission.tsx`, `src/hooks/useNotificationPrompt.ts` (both unused — see §7). None of these are actively harmful, but they're maintenance debt that could mislead a future session into thinking a fix to one of them reaches production when it doesn't (exactly the class of mistake the "BACKLOG-119 only fixed one surface" finding in §3 warns about).
- **`BACKLOG-096`** ("Event Pipeline: No Server-Side WebSocket Emit on Event Save", filed 2026-06-19, still shows `Status: OPEN`) appears to be substantially superseded by the BUG-116 fix (server-side `broadcastMatchEvent`/etc. wired into the write routes, landed session 43) — worth a status re-check next time that entry is touched, since its "Fix (not yet built)" framing no longer matches what BUG-116/108's entries describe as shipped. Not corrected here since it's outside this audit's one-file write permission.

---

## Inventory Table

| # | Sub-feature | Football | Basketball | Backlog cross-ref | New finding? |
|---|---|---|---|---|---|
| 1 | Live score — `/matches/[id]` | WORKS | WORKS (same page/code path) | BUG-080, BUG-108, BUG-109 | No |
| 1 | Live score — homepage cards | BROKEN (no refresh mechanism reaches viewers) | BROKEN (same) | Adjacent to BACKLOG-096/BUG-020 but not filed as its own item | **Yes** |
| 1 | Live score — `/live` page | PARTIALLY WORKS (15s poll) | PARTIALLY WORKS (same) | BUG-020 (self-documented stopgap) | No |
| 1 | Live score — sport hub MATCHES tab | BROKEN (static per competition) | BROKEN (same) | Not filed | **Yes** |
| 1 | Live score — homepage overlay modal | WORKS (full WS) | **BROKEN** (zero WS, confirmed) | Matches brief's own suspicion | Confirmed |
| 2 | Event timeline — `/matches/[id]` | WORKS (BUG-083 fixed, one open sub-gap) | WORKS | BUG-083 | No |
| 2 | Event timeline — homepage overlay | PARTIALLY WORKS (3rd hand-rolled impl, bypasses BUG-083) | **DOESN'T EXIST** (no tab at all) | Not filed | **Yes** |
| 3 | Status/period label consistency | PARTIALLY WORKS (correct only on `/matches/[id]`) | PARTIALLY WORKS (never reached by BACKLOG-119) | BACKLOG-119 (resolved on 1 of 4 surfaces) | **Yes** |
| 4 | Homepage match cards auto-update | **BROKEN** | **BROKEN** | New | **Yes** |
| 5 | Stats tab | WORKS (`/matches/[id]`), PARTIALLY WORKS (overlay, football-only fields) | WORKS (`/matches/[id]`), PARTIALLY WORKS (overlay, one-shot fetch) | None | Partial |
| 6 | Lineup display | PARTIALLY WORKS (`/matches/[id]`, poll-only) / WORKS (homepage overlay, true live) | PARTIALLY WORKS (one-shot fetch) | None | **Yes** |
| 7 | Push notification opt-in | **BROKEN for true viewers** (all reachable paths require auth; anonymous-capable component exists but unmounted) | same | BUG-084 (retracted), 085/086/087/088/089 (open, not re-verified) | **Yes** |
| 8 | PWA install prompt | WORKS (code-level) | n/a | BUG-127 (still unconfirmed, not explained by this pass) | No |
| 9 | Offline fallback page | WORKS | n/a | BUG-080 (resolved, not re-verified) | No |
| 10 | Favourite/follow — team (overlay) | WORKS (localStorage-only, adequate for real viewers) | same | BUG-091 (may be narrower than filed) | Partial |
| 10 | Favourite/follow — match-detail heart | **BROKEN** (no persistence at all) | same | Not filed | **Yes** |
| 11 | Search | WORKS | WORKS | None | No |
| 12 | Dead/orphaned viewer-adjacent components | — | — | None | **Yes** |

**Priority read for whoever picks this up next:** §4 (homepage never refreshes live data for real viewers) and §7 (anonymous viewers cannot enable notifications at all) are the two findings most at odds with the product's stated purpose and are not currently tracked anywhere in `BACKLOG.md` under their own entries.
