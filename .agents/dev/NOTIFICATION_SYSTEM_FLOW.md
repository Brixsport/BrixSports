# BrixSports Live-Match Push Notifications — How It Actually Works

**Written:** session 49, 2026-08-05. **Method:** read-only trace of the current codebase, cross-checked against two prior read-only audits (`AUDITS/audit_notifications_tier1_48.md`, session 48, and `AUDITS/audit_auth_account_notifications_47D.md`, session 47D). Where this session's code differs from what those audits found, it's called out explicitly below.

This document explains the system as built, for a reader who wants to understand it — not a bug list. Real gaps are still noted, briefly, with a BACKLOG/BUG pointer.

---

## 1. What the system does today, in plain terms

BrixSports can push a real browser/phone notification ("GOAL! Yanko scores, 1-0") to people watching football matches. There are two completely separate ways someone ends up on the receiving list. If you have an account and you've favorited or followed a team, you get notified about *every* match that team plays, forever, until you turn it off. If you're just a visitor with no account, you can tap a bell icon on one specific match's page and get notified about *that one match only* — the moment you leave, there's no lasting relationship between you and that team.

Both paths lead to the same delivery pipeline: a real Web Push notification sent via VAPID/service worker, which shows up as a native OS notification even if the browser tab is closed (as long as the browser itself is running, with platform caveats — see section 6).

The trigger side only works for football right now, and only while the match's logger has their browser tab open — there is no server-side fallback trigger. Basketball produces no notifications at all, for any event type.

---

## 2. Event types

The authoritative list — validated server-side in `src/app/api/notifications/match-event/route.ts:33-43` — is exactly nine types:

| Event type | What it means | Dispatched from |
|---|---|---|
| `MATCH_START` | First half kicks off | `MatchStateManager.triggerPeriodNotification()`, `src/lib/match-state-manager.ts:964-983`, when period transitions to `FIRST_HALF` |
| `HALF_TIME` | Half time reached | Same method, period → `HALF_TIME` |
| `MATCH_END` | Full time | Same method, period → `FINISHED` |
| `GOAL` | A goal or converted penalty | `MatchStateManager.triggerNotification()`, `src/lib/match-state-manager.ts:985-1000`, for event types `'Goal'` or `'Penalty'` |
| `RED_CARD` | Player sent off | Same method, event type `'Red Card'` |
| `PENALTY_SAVED` | Penalty kick saved | Same method, event type `'Penalty Saved'` |
| `PENALTY_MISSED` | Penalty kick missed | Same method, event type `'Penalty Missed'` |
| `LINEUP_AVAILABLE` | Starting lineup published | **Not** the football trigger path at all — dispatched server-side, directly from `src/app/api/matches/[id]/lineup/publish/route.ts:110-130`, which POSTs straight to `/api/notifications/match-event` when a lineup is published |
| `YELLOW_CARD` | Player booked | **Defined but never actually fired** — see note below |

**Sport coverage: football only, and even football is incomplete.** `MatchStateManager` is explicitly typed to `FootballEventType[]` — basketball has no equivalent state manager wired to notifications at all (confirmed by grep: `BasketballLogger.tsx` has zero references to `notification`, `event-driven-notifier`, or `MATCH_NOTIFICATION_TRIGGER`). A basketball goal, foul, or quarter-end never notifies anyone, regardless of who's enrolled.

**`YELLOW_CARD` is a real gap worth calling out precisely, because it's subtle.** The *delivery* layer fully supports it — `event-driven-notifier.ts:182-198`'s `getNotificationType()` maps `'Yellow Card'` → `'YELLOW_CARD'`, and `match-notification-service.ts:271-279` has a complete notification template for it. But `MatchStateManager.triggerNotification()`'s own `notifiableEvents` allowlist (`match-state-manager.ts:986`) is `['Goal', 'Penalty', 'Penalty Saved', 'Penalty Missed', 'Red Card']` — `'Yellow Card'` is not in that list, so the trigger event is never dispatched for a yellow card in the first place. The type system and send logic are ready for it; the trigger just doesn't ask for it. No BACKLOG/BUG entry currently tracks this specific gap.

`LINEUP_AVAILABLE` is architecturally different from the other eight: it's the only event type triggered directly from a server-side API route rather than from a client-side `MATCH_NOTIFICATION_TRIGGER` browser event. That makes it immune to the single-tab problem described in section 3 — but it's also its own independent pipeline, not part of `EventDrivenNotifier` at all (no dedup, no retry queue — it's a fire-and-forget `fetch()` inside the publish handler, wrapped in try/catch so a notification failure doesn't fail the publish itself).

---

## 3. Trigger side — how an event becomes a "fire a notification" moment

For the eight football-event types (everything except `LINEUP_AVAILABLE`), the trigger chain is entirely client-side, in one browser tab:

1. The logger taps an event button in `FootballLogger.tsx`. That updates `MatchStateManager`'s in-memory state and saves the event to the database.
2. `MatchStateManager.triggerNotification(event)` (or `triggerPeriodNotification(period)` for start/half-time/end) checks whether the event type is on the notifiable list, then does `window.dispatchEvent(new CustomEvent('MATCH_NOTIFICATION_TRIGGER', { detail: {...} }))` — a same-tab browser event, not a network call.
3. `EventDrivenNotifier` (`src/lib/notifications/event-driven-notifier.ts`) is a singleton that self-starts the moment it's imported (`if (typeof window !== 'undefined') getNotifier();` at the bottom of the file) and has been listening on `window` for that exact event since the tab loaded. It picks up the detail payload, runs it through a localStorage-persisted dedup check (keyed `${matchId}_${event.id}` or `${matchId}_${periodEventType}` — no timestamp in the key, so retries and page-reloads don't cause duplicate sends), queues it, and POSTs it to `/api/notifications/match-event`.
4. That route calls `sendMatchEventNotification()` (section 4), which does the actual `webpush.sendNotification()` calls to every enrolled subscriber.

**The critical architectural fact:** steps 1-3 all happen inside the same browser tab — the logger's own tab, running `FootballLogger.tsx`. `EventDrivenNotifier` is imported in exactly one place in the entire `src/components` tree (confirmed by grep): `FootballLogger.tsx:25`. There is no server-side equivalent that fires when an event is saved to the database through any other path (an admin manual correction, a future API-only ingestion, an offline-queue replay). If the logger's tab closes, crashes, loses network, or the match is being run without that specific tab open, **no further notifications fire for that match, period**, independent of whether enrollment and delivery are both working perfectly. This is the same class of gap that `BUG-108`/`BUG-116` fixed for the separate WebSocket live-score broadcast pipeline (which now runs from the server on event save) — notifications never received the equivalent fix.

`LINEUP_AVAILABLE` is the one exception — triggered directly from the server-side publish route, so it doesn't depend on any tab staying open.

---

## 4. Targeting: who actually receives it

This is the part that caused real confusion this session, so it's worth stating plainly: **these are two genuinely different mechanisms, not two ways of doing the same thing.**

### 4a. Authenticated users — team-level following

If you have an account and you follow or favorite a **team**, you're notified about **every match that team plays** — this is standing, long-term targeting, not tied to any one match. `sendMatchEventNotification()` (`src/lib/notifications/match-notification-service.ts:44-212`) builds its audience for a given match by querying three separate sources and merging the results:

- `userFollows` where `followType = 'team'` and `followId` matches either team in the match, `notificationsEnabled = true` (`schema.ts:490-497`)
- `userFavorites` where `favoriteType = 'team'` and `favoriteId` matches either team (`schema.ts:481-487`)
- `users.favoriteTeamId` — a user's single "primary" team set directly on their user row (`schema.ts:447`)

These three lists are deduplicated into one set of user IDs, then filtered against `userPreferences.matchAlerts` (a user who's explicitly turned off match alerts is dropped even if they follow the team), and finally resolved to that user's `pushSubscriptions` rows.

### 4b. Anonymous (device-scoped) users — per-match opt-in only

An anonymous viewer has no account, so there's no row to attach a team-follow to — there's nothing that would persist "this person" across sessions except the device itself. So the mechanism is intentionally narrower: a device that taps "notify me about this match" gets notified about **that one specific match only**, with no concept of following a team over time. This is the new `pushSubscriptionMatches` join table (`schema.ts:819-832`), which links a `pushSubscriptions` row to one `matches` row. `sendMatchEventNotification()` queries it directly for the current match (`match-notification-service.ts:138-142`) and merges those subscriptions into the same send list as the team-followers, deduplicated by subscription id (`match-notification-service.ts:144-147`).

The anonymous subscription's `pushSubscriptions.userId` doesn't point at a real person — it points at a single sentinel row, `ANONYMOUS_PUSH_USER_ID = 'anonymous-push-subscriber'` (`src/lib/notifications/anonymous-subscriber.ts`), created on first use if it doesn't already exist. This exists because `pushSubscriptions.userId` is a `NOT NULL` foreign key to `users.id` (`schema.ts:807-817`) — making it nullable would require a SQLite table-rebuild migration (SQLite can't `ALTER COLUMN DROP NOT NULL`), so the sentinel row is a functionally-equivalent, lower-risk workaround. The device's actual identity for anonymous rows is the separate `deviceId` column, not `userId`.

**Why not build the anonymous path as a device-scoped mirror of team-following?** Because there's no device-level "favorite team" concept to attach it to that would survive the way an account does, and Richard's call this session was explicitly to scope it as a lightweight per-match opt-in rather than trying to replicate the full team-follow system for devices (`BACKLOG.md` line 6407).

### 4c. The Heart button is not part of either mechanism

Worth stating plainly since it sits right next to the Bell button on the same page header and looks like it should matter here: it doesn't. `src/app/matches/[id]/page.tsx:60` declares `const [isFavorited, setIsFavorited] = useState(false)`, and the button's only behavior is `onClick={() => setIsFavorited(!isFavorited)}` (`page.tsx:544`). No `localStorage` write, no API call, no read from `useFavorites.ts` (the hook that correctly does persist favorites elsewhere in the app). It resets to unfavorited on every page reload and has no effect on notification targeting or anything else. This is a known, already-filed issue — `BUG-152` in `BACKLOG.md`, OPEN, distinct from `BUG-091` (which covers a different heart button, the team-follow one elsewhere in the app that does hit real APIs).

---

## 5. Enrollment: how someone gets into the targeting system

### Authenticated flow (existing, pre-dates this session)

Two live, reachable paths:
- **`SettingsOverlay.tsx`**, opened from the homepage bell icon. `handleEnablePush()` calls `pushService.requestPermission()` then `pushService.subscribe(user.id)`. Requires a signed-in user — an anonymous visitor clicking this specific bell gets an error toast, not the anonymous flow described below (this is a different bell icon from the one on the match detail page).
- **`OnboardingModal.tsx`**, shown as a dedicated "Get Match Alerts" step immediately after signup, also calling `pushService.subscribe(user.id)`.

Both POST to `/api/notifications/subscribe` with a real `userId`, which the route now cross-checks against the authenticated session (`subscribe/route.ts:56-66`) rather than trusting the body — a caller can't subscribe a different user's account unless they're an admin.

Two other components exist in the codebase (`NotificationPermission.tsx`, `useNotificationPrompt.ts` and its sibling `NotificationPrompt.tsx`) that were built for an auto-prompt anonymous-capable flow but are never imported or mounted anywhere — dead code, unchanged from both prior audits' findings.

### Anonymous flow (new this session, BACKLOG-150)

This is the "notify me about this match" Bell button on the match detail page header (`src/app/matches/[id]/page.tsx`, around lines 531-541), the first and only anonymous-reachable enrollment surface in the app. Flow:

1. On page load, a `useEffect` (`page.tsx:111-113`) checks `localStorage` (key `brixsports_notify_matches`, a JSON array of match IDs) to see if this device already has an active subscription for this match, and sets the Bell's visual state accordingly.
2. Tapping the Bell calls `handleNotifyToggle()` (`page.tsx:115-165`). It gets or creates a persistent per-browser `deviceId` via `getDeviceId()` (`src/lib/notifications/device-id.ts`) — a `crypto.randomUUID()` generated once and stored in `localStorage` under `brixsports_device_id`, reused across visits.
3. It requests browser notification permission (the real OS-level prompt), and if granted, calls `pushService.subscribe(null, { deviceId, matchId })` — the `userId` argument is explicitly `null`; only `deviceId` and `matchId` go to the server.
4. `push-service.ts`'s `subscribe()` (now takes an optional `anon` param) creates the actual `PushSubscription` via the service worker's `pushManager.subscribe()`, then POSTs `{ deviceId, matchId, subscription }` (no `userId`, no auth header) to `/api/notifications/subscribe`.
5. The route (`src/app/api/notifications/subscribe/route.ts:25-139`) checks auth with `.catch(() => null)` rather than a hard 401 — this lets one route serve both callers. If there's no session, it requires `deviceId` and `matchId` in the body, verifies the match exists, calls `ensureAnonymousPushUser()` to make sure the sentinel row exists, and stores the subscription under `ANONYMOUS_PUSH_USER_ID`. It then inserts a `pushSubscriptionMatches` row linking that subscription to that match, unless one already exists.
6. On success, the match ID is added to the device's local `brixsports_notify_matches` list, and the Bell fills in.

Turning the Bell off calls `pushService.unsubscribe(null, { deviceId, matchId })`, which `DELETE`s only that match's link (not the whole subscription — a device can be watching several matches at once). If that was the device's last linked match, the now-orphaned `pushSubscriptions` row is deleted too (`subscribe/route.ts:149-213`).

**Known follow-up, filed not built:** no automatic handoff exists yet if an anonymously-subscribed device later logs in — the schema supports it for free (re-subscribing on the same `endpoint`, which is globally unique, flips `userId` from the sentinel to the real account on the existing row, and the match links survive since they're keyed to subscription id), but nothing currently triggers that re-subscribe. `BACKLOG.md`'s `BUG-150` entry.

---

## 6. Delivery side, briefly

Already thoroughly covered by the session 48 audit and unchanged since — summarizing rather than re-deriving:

- Real Web Push via the `web-push` npm package, VAPID-signed, from `match-notification-service.ts`. Each subscriber's stored `endpoint`/`p256dh`/`auth` is used to build a native push message; a 410/404 response marks that subscription for deletion (stale/revoked subscriptions self-clean over time).
- `public/sw-user.js`'s `push` event handler (lines 275-352) parses the payload, builds notification options with event-specific behavior — `GOAL` and `RED_CARD` get `requireInteraction: true` plus a distinct vibration pattern so they don't auto-dismiss.
- The `notificationclick` handler (355-384) focuses an already-open tab on that match if one exists, or opens a new one, when the user taps the notification.
- VAPID keys are read via raw `process.env` in three separate files rather than through this project's own `src/lib/env.ts`/`validateEnv()` pattern — a process-compliance gap, not a currently observed functional failure (keys are confirmed correctly set in prod). Unchanged since the session 48 audit.
- Real-world proof of delivery exists (a live goal notification reached a real prod subscriber's iPad, staging test match, 2026-07-01) but is dated and narrow — one event type, one platform, over a month old as of this write-up.
- **iOS platform ceiling, unrelated to any BrixSports code:** push from a browser tab does not work at all on iOS Safari, on any iOS version. Only an installed Home Screen PWA on iOS 16.4+ can receive push. This caps the achievable reach of both enrollment paths on iOS regardless of how well either is built — see `PWA_LIMITATIONS.md`.

---

## 7. Worked examples, end to end

### Example A — anonymous viewer, upcoming match, goal scored 40 minutes later

1. A visitor with no account opens `/matches/{matchId}` for an upcoming match. No session, no cookie — the app has never seen this browser before.
2. `device-id.ts` generates a UUID the first time anything needs it and stores it in `localStorage` as `brixsports_device_id`. It doesn't fire yet — nothing has asked for it.
3. The visitor taps the Bell. The browser's native permission prompt appears; they allow it. `handleNotifyToggle()` fetches `deviceId`, calls `pushService.subscribe(null, { deviceId, matchId })`.
4. The service worker creates a real `PushSubscription` (endpoint + keys) and POSTs it with `deviceId`/`matchId` to `/api/notifications/subscribe`. The server sees no auth cookie, treats this as the anonymous path, confirms the match exists, ensures the `anonymous-push-subscriber` sentinel user row exists, writes a `pushSubscriptions` row (`userId = ANONYMOUS_PUSH_USER_ID`, this device's real identity carried in `deviceId`), and writes a `pushSubscriptionMatches` row linking that subscription to this exact match.
5. The visitor closes the tab and goes about their day. Nothing about them is remembered by any account — only this specific browser, via `localStorage` + the subscription row, remembers they wanted this match.
6. 40 minutes later, the assigned logger (in a different browser, a different tab, running `FootballLogger.tsx` for this match) taps "Goal." `MatchStateManager` saves the event to the database and dispatches `MATCH_NOTIFICATION_TRIGGER` inside that logger's own tab.
7. `EventDrivenNotifier`, running in that same logger tab, catches the event, checks its dedup map (new event, not seen before), and POSTs the goal payload to `/api/notifications/match-event`.
8. `sendMatchEventNotification()` runs its team-follower query (finds nobody relevant unless someone happens to follow one of these two teams) and, separately, its `pushSubscriptionMatches` query for this exact `matchId` — which finds our visitor's subscription. Both lists merge; the visitor's subscription is in the final send list.
9. `webpush.sendNotification()` sends the real push to that subscription's `endpoint`. Assuming the visitor's device/browser combination supports background push (see the iOS caveat above), their OS shows a native "GOAL! ..." notification, even though they don't have the site open at all.
10. Tapping the notification opens or focuses a tab at `/matches/{matchId}` via the service worker's `notificationclick` handler.

If the logger's browser tab had crashed or been closed at any point between steps 6 and 7, none of this would have fired — enrollment and delivery would both still be intact and correct, but nothing would have triggered them.

### Example B — authenticated user who favorited a team, for contrast

1. A signed-in user, at some earlier point, favorited "Team A" — either via the homepage `SettingsOverlay` flow, onboarding, or a team page's follow button. This wrote a row to `userFavorites` (or `userFollows`, or set `users.favoriteTeamId`, depending on which UI path they used) tied permanently to their account, not to any one match.
2. Separately, at signup or via `SettingsOverlay`, they enabled push notifications — `pushService.subscribe(user.id)` created a `pushSubscriptions` row with their real `userId`.
3. Weeks later, Team A plays a completely different match than any they've previously viewed — they never visited this specific match's page at all.
4. That match's logger logs a goal. Same trigger chain as Example A: `MatchStateManager` → `MATCH_NOTIFICATION_TRIGGER` → `EventDrivenNotifier` → POST to `/api/notifications/match-event`.
5. `sendMatchEventNotification()`'s team-follower query finds this user (their `userFavorites` row references Team A, which is one of the two teams in this match), checks their `userPreferences.matchAlerts` isn't disabled, and includes their `pushSubscriptions` row in the send list — with no per-match opt-in step required, because they never had to visit this match's page at all.
6. They get the same real push notification, for a match they took no match-specific action on. This is the structural difference from Example A: the authenticated path is triggered by team identity, permanently, until they unfollow; the anonymous path is triggered by a one-time, one-match action that expires in relevance the moment that match ends (nothing currently prunes old `pushSubscriptionMatches` rows for finished matches, but they simply stop being useful).

---

## 8. Known gaps, briefly

- **No server-side fallback trigger for football — single browser tab is the whole pipeline.** No BACKLOG/BUG number filed specifically for this; documented in `AUDITS/audit_notifications_tier1_48.md` §1/§5 item 3.
- **Basketball has zero notification-trigger wiring, any event type.** New finding in the session 48 audit, no BACKLOG/BUG number filed yet.
- **`YELLOW_CARD` is fully supported by the type system and send logic but never actually triggered** — not in `MatchStateManager`'s notifiable-events list. Not previously documented anywhere; no BACKLOG/BUG number.
- **`BUG-152`** — the match-detail-page Heart button doesn't persist at all (see section 4c). OPEN.
- **`BUG-150`** — the anonymous enrollment gap this session's work (sections 4b/5) addressed. Schema + API + UI now built per this document; entry's own status line (`BACKLOG.md` ~line 6407) should be checked/updated to reflect the UI landing, and its own follow-up note (no anon-to-auth handoff trigger) remains unbuilt.
- **`BUG-085`** (dedup key) — BACKLOG.md still shows this as OPEN, but the code confirmed in this session (`event-driven-notifier.ts:150-151`) already has the fix (no `Date.now()` suffix in the dedup key). Both this session's read and the two prior audits agree the fix is present and correct — this is a stale backlog entry, not a live bug.
- **`BUG-086`** — `EventDrivenNotifier` logs success on any `response.ok`, without checking whether `sentCount` was actually greater than zero. OPEN.
- **`BUG-087`** — potential race between viewer auth initialization and the in-app notification-history favorites query. OPEN.
- **`BUG-088`** — `GET /api/notifications` (in-app notification history/read-state UI, separate from the push pipeline) hardcodes `unreadCount: 0`, mark-as-read is a no-op, and a casing bug (`'GOAL'` vs `'Goal'`) means the goal-event filter always returns zero rows. OPEN.
- **`BUG-089`** — WebSocket subscribe storm (3-5x `match:subscribe` emitted per connect); adjacent to but distinct from the notification pipeline itself. OPEN.
- **`/api/reminders/check` (the 30/15-minute-before-kickoff push) has no scheduler invoking it** — `vercel.json` has no `crons` block, confirmed still absent this session. New finding in the session 48 audit, no BACKLOG/BUG number filed yet.
- **`sendMatchReminderNotification()` sends to every push subscription in the table unconditionally**, including anonymous sentinel-backed rows and every authenticated user regardless of team preference — by design per its own doc comment ("not just team followers"), but worth knowing it is not filtered by relevance at all.
- **VAPID keys bypass `src/lib/env.ts`/`validateEnv()`**, read via raw `process.env` in three files; a missing/misconfigured key degrades silently per-subscription rather than failing the deploy loudly. Low current severity. Documented in `AUDITS/audit_notifications_tier1_48.md` §3/§5 item 5.
- **`pushSubscriptions` has no `platform`/`isActive`/`lastUsedAt`/`deviceLabel` columns** — stale-subscription pruning beyond the reactive 410/404 cleanup, and per-platform delivery debugging, are both structurally unsupported today. Tracked in `SYSTEM_CRITICALITY_MAP.md` line 141.
- **iOS platform ceiling** — not a BrixSports defect, but push from a browser tab never works on iOS Safari at any version; only an installed Home Screen PWA (iOS 16.4+) can receive push. Documented in `PWA_LIMITATIONS.md`.
