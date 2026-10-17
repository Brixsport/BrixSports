# BrixSports failure-mode checks (manual, staging only)

Manual checks to run alongside the k6 scenarios in this folder (see `README.md`). Each one lists the behaviour the code is
meant to have, how to inject the fault, what to watch and what counts as a pass or fail. Behaviour listed under "Expected" comes
from the source at the time of writing and should be re-checked against the current code before relying on it.

## Safety (applies to every check)

* **Staging only.** Vercel project `brixsports-staging` and the staging database. Never the production project, never
  `brixsports.com` / `www.brixsports.com`, never the production database. Confirm the URL before every injection.
* **The WebSocket server is one instance shared by staging and production.** Do not stop, restart, firewall, flood or
  reconnect-storm it. To test WebSocket loss, block it from the client side (DevTools, OS firewall or a hosts entry on the test
  device), or use a separate staging WebSocket instance behind a throwaway preview deployment. k6 never opens sockets.
* **Do not break the shared staging deployment's environment** to inject database faults. Use a throwaway preview deployment
  (a scratch branch) with its own environment overrides, then delete it.
* **Use the disposable match**: friendly, TEAM A vs TEAM B, no real followers (goal and card events send push notifications).
* **Load ceilings**: viewer tests at most 250 VUs per shard; writers at most 4 loggers and about 0.4 events/s; freshness probe 1
  VU. Abort on more than 5% 5xx for a minute, a database quota alert, a Vercel usage alert or a Sentry error flood.
* **Clean-up** afterwards: remove the disposable match, check for leftover `k6_` event ids, notifications, push subscriptions and
  player-stat rows, delete any throwaway preview and rotate any bypass secret that was pasted anywhere.

## General behaviour these checks rely on

* Event POST: auth, assigned-logger check, match lookup, client-id replay (returns 200), FINISHED lock (409), atomic
  insert-if-not-duplicate plus score increment in one transaction, then WebSocket broadcast and notifications after the
  response, then player stats, then 201. There is no rate limit on this route.
* A failed WebSocket broadcast never fails a write (the broadcast has a short timeout and errors are swallowed).
* Match page: WebSocket connected means a reconcile poll every 25 s; disconnected means a poll every 10 s. Home and `/live`
  poll `/api/live-matches` every 3 s and the sport lists every 15 s.
* Public list and live routes are edge-cached for a few seconds with stale-while-revalidate; errors and 429 responses are not cached.
* The rate limiter is per warm instance and in memory, keyed by method, path, client IP and limit.
* Logger JWTs live 7 days.

---

## 1. WebSocket server down

* **Expected:** writes are unaffected (the broadcast aborts after about 3 s in the background). Viewers lose the socket, retry a
  few times with backoff, then rely on polling every 10 s. Home and `/live` are poll-only anyway.
* **Inject:** not by stopping the shared server. Block the WebSocket host on the viewer and logger test devices, or use a
  separate staging WebSocket instance and stop that.
* **Observe:** event POST latency (`write_ack_ms`) must not grow by about 3 s; Vercel logs a broadcast failure warning; the
  viewer network tab shows `/api/matches/{id}/public` about every 10 s; time to visible (run `03-freshness.js` while blocked).
* **Pass:** no failed or slow writes attributable to the socket; the viewer sees a new event within one poll interval plus server
  lag; the logger still shows saved.
* **Fail:** write latency up by 3 s or any 5xx on POST; the viewer page stuck for two poll cycles; an unhandled promise rejection.
* **To verify:** whether the match page shows any "live updates degraded" indicator.

## 2. WebSocket reconnect storm

* **Expected:** client backoff of 2 s up to 10 s with a limited number of attempts; on reconnect the match page re-syncs once, so
  many viewers fetch the match and head-to-head data in the same second.
* **Inject:** never on shared infrastructure. Only against an isolated staging WebSocket: restart it while 100-250 real browser
  viewers (not k6) are connected, or drop and restore the network on many tabs at once.
* **Observe:** request spike on `/api/matches/{id}/public`, 429 share (same-NAT limiter), database read latency, WebSocket CPU and memory.
* **Pass:** all viewers reconnect or fall back to polling within 60 s; origin 5xx below 1%; no 429s for legitimate viewers on one IP.
* **Fail:** sustained 5xx, 429s to viewers behind one IP, or memory growth across repeated storms.

## 3. Database latency +2 s per round trip

* **Expected:** queries are sequential HTTP round trips, so latency multiplies by the number of queries per request (an event
  POST has about 8-10 statements). Edge-cached lists keep serving HIT or STALE for a few seconds. Silent viewer polls that fail
  keep the last good data; `/live` marks data as stale.
* **Inject:** on a throwaway preview, point the database URL at a latency proxy (for example Toxiproxy with 2000 ms latency in
  front of the staging database). Never degrade the shared staging deployment or the production database.
* **Observe:** `http_req_duration{endpoint:detail}`, POST ack p95/p99, Vercel function timeouts, the logger's saving / saved /
  failed state, queue growth, the viewer stale banner.
* **Pass:** the logger shows saving, then saved or queued (never success without a server acknowledgement, never silent loss); no
  duplicate rows after retries (`dup_rows_found == 0`); `/live` shows the stale banner; the match page keeps its last good data.
* **Fail:** the logger shows success before the acknowledgement; a timed-out POST that did commit produces a duplicate on retry;
  the match page shows nothing at all.
* **To verify:** the match page has no visible stale indicator for failed silent polls (only for the match clock).

## 4. Database unavailable

* **Expected:** handlers catch errors and return a generic 500 without database text. The logger treats 5xx, 408 and 429 as
  "queue" (IndexedDB plus a background sync registration). Viewers see STALE list data for a few seconds, then a 500.
* **Inject:** throwaway preview with an invalid or unreachable database URL (or a proxy that refuses). Not the shared staging
  environment, never production.
* **Observe:** the logger banner text, the pending-events count in IndexedDB, service-worker logs, viewer behaviour on `/`, `/live`
  and the match page, Sentry events (captured, not swallowed).
* **Pass:** every logged event is saved or visibly queued; after the database returns, all queued events appear exactly once;
  viewers see a clear error or stale state, no blank crash.
* **Fail:** an event that is neither saved nor shown as queued or failed; raw database text in a response; permanent `failed`
  rows for events that only hit a 5xx.

## 5. Vercel cold start

* **Expected:** the database client is stateless HTTP (no pool to warm). A cold instance starts with an empty in-memory limiter
  and pays module initialisation on the first request.
* **Inject:** leave staging idle for 20 minutes or more, then fire one request per route; compare with warm numbers; repeat after
  a fresh deploy.
* **Observe:** `x-vercel-id`, time to first byte of the first versus the tenth request on `POST /events`, `/api/matches/{id}/public` and `/`.
* **Pass (estimates):** first-request TTFB below 3 s for reads and 5 s for writes; a cold write still returns 201.
* **Fail:** a cold POST timing out and being queued repeatedly at kickoff (mitigation: hit the routes a couple of minutes before kickoff).

## 6. Edge cache serving stale data during an outage

* **Expected:** list and live routes serve cached data for a few seconds and stale data for a few more while revalidation fails;
  after that the 500 passes through (not cached). The user service worker is network-first with a short staleness cap for match lists.
* **Inject:** on the throwaway preview, break the database after warming the cache; or set DevTools to Offline to exercise the
  service-worker fallback.
* **Observe:** the `x-vercel-cache` HIT / STALE / MISS timeline (k6 `xvc_*` counters), the `Age` header, what the home page shows
  after 15 s and 30 s, whether the UI labels data as stale.
* **Pass:** scores shown are at most about 30 s old without a false "live" claim after that; a clear failure or stale UI
  afterwards; no cached error bodies.
* **Fail:** stale scores shown indefinitely as live; an error body cached at the edge.

## 7. Logger offline for 10 minutes, then reconnect with 40 queued events

* **Expected:** each failed POST is stored in IndexedDB with the logger's JWT (refused if the token has under 30 minutes left).
  On `online`, `visibilitychange` or mount the page asks the service worker to drain the queue: single-flight, sequential, a row
  is deleted only after a 2xx, and the saved client id makes replays idempotent. A 4xx other than 408/429 marks the row `failed`
  permanently. iOS has no Background Sync, so the drain relies on the page being open.
* **Inject:** on the logger device (Android Chrome and iOS Safari PWA), enable airplane mode, log about 40 events (scoring and
  player-less), wait 10 minutes, restore the network. DevTools Offline works as an alternative.
* **Observe:** banner counts (queued to synced), sync-complete versus sync-partial messages, database row count for the queued
  ids, score equals the number of goals, viewer timeline order, push notifications fired.
* **Pass:** 40 of 40 events saved exactly once, score correct, drain finishes in under 90 s, banner reaches "synced", and a
  second forced drain creates no duplicates.
* **Fail:** any event lost or duplicated; banner says synced while rows remain; the drain stops after the first retryable error
  and nothing retries it.
* **Known side effects to confirm:** a replayed goal or card sends its push notification at replay time (a burst of up to 40
  notifications to followers); a queued event whose match has since gone FINISHED gets 409 and is marked failed; the server's
  `createdAt` is replay time while minute and second come from the client, so confirm viewers order by minute and second.

## 8. Service-worker update mid-match

* **Expected:** the user service worker clears old caches and claims clients on activation; the logger service worker only skips
  waiting when the page sends a message, so a new logger worker waits until tabs close. The queue lives in IndexedDB, rows are
  deleted only after a 2xx, the drain is re-entrant and the server is idempotent, so a worker stopped mid-drain re-sends at most
  the in-flight row.
* **Inject:** deploy a new build (or bump the cache version on a preview) while a logger tab is live with queued events and
  viewers have the match open; also trigger "Update" in DevTools > Application > Service Workers during a drain.
* **Observe:** service-worker state (waiting or activated), pending events in IndexedDB before and after, console lines from the
  worker, any forced page reload (the logger must not reload mid-logging).
* **Pass:** no event lost or duplicated, no logger reload, viewers keep updating, no stale HTML requesting removed chunks.
* **Fail:** the logger tab white-screens after the deploy, queue rows are orphaned, or the old worker keeps serving a cached list as current.

## 9. Token expiry mid-match

* **Expected:** an expired or invalid JWT returns 401 (never 500). The logger client calls the refresh endpoint once and retries,
  otherwise queues with a "session expired" message. The queue refuses to store events when under 30 minutes of token life remain
  (judged with the device clock). A queued row whose token expires before the drain gets 401 in the worker and is marked `failed`
  permanently (the worker has no refresh path).
* **Inject:** `06-auth-failure.js` (expired token gives 401); manually, a logger session with a token minted to expire in 35
  minutes, go offline across the expiry and come back; second case, clear the cookie so the refresh fails and log.
* **Observe:** the HTTP status, the banner text ("Session expired - NOT saved" versus "queued"), whether events remain in IndexedDB after re-login.
* **Pass:** 401 not 500; the logger sees an explicit, actionable message; events logged after re-login save; queued events either
  drain with a fresh token or are shown as failed (never silently dropped).
* **Fail:** any 5xx on an expired token; the banner says saved or queued while the row is dead.
* **Edge:** a row queued with 31 minutes left and replayed after 40 minutes fails permanently by design; decide whether the worker should refresh the token.

## 10. Two loggers on one match

* **Expected:** both can POST (the check is assignment only). The same event (same player, type, minute and value) submitted
  twice within 10 s is collapsed server-side atomically; two genuine identical events by one player inside 10 s also collapse.
  Different players, minutes or types are not collapsed, so a double count of one real-world event is possible. Score increments
  are atomic SQL, so no lost update.
* **Inject:** `02-write-path.js` `race_sig` (needs two tokens) plus a manual two-phone session logging the same foul or goal
  within seconds.
* **Observe:** event rows, score, logger names on events, the "local score ahead of saved" notice, duplicates on the viewer timeline.
* **Pass:** exactly one row and +1 for identical concurrent submissions; the score never decreases or skips; both phones converge on server state within one poll.
* **Fail:** score +2, or divergent lineups or clock between the phones that persists after a refresh.

## 11. Clock skew on the logger device

* **Expected:** event minute and second come from the client; `createdAt`, the dedup window and JWT checks use the server clock;
  the client-side "token has under 30 minutes left" guard uses the device clock. Viewers order detail events by minute and
  second, not by `createdAt`.
* **Inject:** set the test phone's time +10 minutes and -10 minutes (automatic time off) before kickoff and during the half.
* **Observe:** the minute written on events, ordering on the public timeline, queue acceptance near token expiry, the minute in push notifications.
* **Pass:** the minute shown to viewers derives from the match clock, not the wall clock; events stay in sensible order; no auth failures from skew.
* **Fail:** events with absurd minutes or ordering; a skewed phone refuses to queue, or queues a token that is already dead.

## 12. Duplicate tab (same logger, same match, two tabs or devices)

* **Expected:** both tabs share IndexedDB and the service worker; the drain is single-flight. Two tabs logging the "same" event
  produce different client ids; player-attributed duplicates inside 10 s are collapsed by signature, player-less events (corner,
  offside) are not and will double. Each tab keeps its own match state; divergence is reconciled only through the server.
* **Inject:** open the logger page twice in one browser profile; log in tab A and watch tab B; then take both offline, log, and bring them online.
* **Observe:** duplicate rows, queue counts per tab, state divergence (clock, lineups), console errors.
* **Pass:** no duplicated row for player events; player-less events are either deduped by id (same tab) or clearly one per tap; no crash or endless drain loop.
* **Fail:** a doubled score from one tap, a queue drained twice producing duplicates, tab B overwriting tab A's period or clock.

---

## Roll-up

| Gate | Evidence |
|---|---|
| No lost logger event under offline / 5xx / 401 | checks 3, 4, 7, 9 and the `02` replay and race scenarios (0 duplicate rows, 0 unexpected status) |
| Event save to public display within 5 s at p95 | `03` `freshness_detail_ms` (server side); the real client cadence adds up to 10 / 15 / 25 s unless WebSocket push works |
| Viewer sees stale data clearly on failure | checks 3, 4, 6 (the match-page gap) |
| Shared-NAT viewers not blocked | `05` NAT scenarios (the `/api/live-matches` poll at 3 s is the weak point) |
| Validation hygiene | `06` findings: goal without team or player accepted, malformed JSON gives 500, unbounded `detail` |
