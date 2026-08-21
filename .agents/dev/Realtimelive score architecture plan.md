The Full Real-Time Discipline Map for BrixSports
Transport Layer — What Exists and What's Beyond
You're using WebSocket (Socket.IO). That's correct for BrixSports because the logger sends events upstream AND the server pushes downstream — genuinely bidirectional. Server-Sent Events are designed exclusively for one-way communication from server to client, making them ideal for scenarios like live news feeds, sports scores, or any situation where the client needs to be updated in real time without sending data to the server. SSE would be wrong for the logger. WebSocket is the right call. You're not over-engineered here. RxDB
The full transport spectrum for context:
TransportDirectionUse case fit for BrixSportsShort pollingClient → Server (repeated)Your 10s fallback — correct as fallback onlyLong pollingClient holds request openSocket.IO falls back to this automaticallySSEServer → Client onlyRight for public viewer only, wrong for loggerWebSocketBidirectionalCurrent — correct for logger + viewerWebTransportBidirectional, UDP-likeEmerging, overkill, not production-ready broadlyWebRTCPeer-to-peerWrong entirely — no P2P use case hereWebhooksServer → ServerUseful for future integrations (Altivex partnership)
The honest answer: you have the right transport. The bugs are in the reconnection discipline, not the protocol choice.

Beyond WS — The Five Disciplines You Actually Need
1. Reconnection Discipline (what you're missing)
The real problem is state synchronization. Track message sequence numbers, reconcile missed messages, and decide whether state lives on the server or gets restored by the client. Design your application so disconnection is a normal, recoverable event rather than an error condition. WebSocket
Production systems treat every connection as temporary. The architecture should be: WS is primary, snapshot-on-reconnect is the recovery, polling is the floor. You have polling as fallback but not the snapshot-on-reconnect — that's the gap.
2. Optimistic UI — what you're partially doing and could formalise
Optimistic UI updates mean you update the user interface immediately when the user takes an action, before waiting for the server's response. You're being "optimistic" that the server will accept the change. Instead of waiting for the round-trip, the UI just updates instantly. freeCodeCamp
The FootballLogger already does this — events appear in the local feed before the DB confirms. This is correct and good. What's missing is the rollback path — if the POST /events returns a 401 or 500, the local event stays in the feed with no indication it failed (BUG-056 partially fixed this with an alert, but the event isn't removed from the local feed). The clean production pattern is: add event optimistically → on POST success do nothing → on POST failure remove from local feed and show error. Avoid optimistic updates for actions with serious consequences. Always have a plan for when things go wrong. Unwiredlearning
3. Offline-First Architecture — what you've built and what's unverified
A resilient PWA architecture separates concerns: a service worker manages offline-first caching and background sync, the app shell renders instantly from cache, and a sync engine reconciles changes with the server using conflict rules. Real-time events feed the same reducer pipeline as fetches. Wild
BrixSports has IDB queueing, drain on reconnect, and the auth fix for the offline queue. What's unverified is BACKLOG-107 (iOS drain) and end-to-end conflict detection — if a logger queues 3 events offline and the network comes back, are they drained in order? Is there a dedup check on the server so a retry doesn't create duplicate events? Last-write-wins strategy based on timestamps is simple and works for 95% of cases. For the remaining edge cases, the server returns a 409 Conflict and the client shows both versions. For match events specifically, the right strategy is: events are append-only (never overwritten), so duplicate detection by eventId on the server side is the only conflict to handle. If the same eventId is drained twice, the server should return 200 (idempotent) not 500 (error). Check whether the POST /events handler is idempotent for duplicate eventId submissions — if it isn't, a network retry creates a duplicate goal in the DB. Rohit Raj
4. State Synchronisation — the gap that explains most of your viewer issues
State loss on reconnection: when a WebSocket drops, in-flight messages are lost. The fix: implement resume yourself. Track the last event ID the client processed, send it on reconnect, and have the server replay missed events. GetStream
Full sequence replay (cursor-based) is the gold standard but overkill at your scale. The MVP version is snapshot-on-reconnect: every connect event triggers fetchMatchData() which returns the full current DB state. That single API call restores everything — score, period, events — without any sequence tracking infrastructure. This is the fix for issues 4 and 6 from your test session. It's one line in the socket.on('connect') handler.
5. Data Integrity Discipline — idempotency and deduplication
Handle corrections: Real-time event feeds may have corrections or delays. Ensure that you don't show duplicate information. Sportmonks
Two surfaces need deduplication:
On the client (public page): before appending a WS event to the display array, check existingEvents.some(e => e.id === newEvent.id). Prevents duplicate display when WS push and polling return the same event.
On the server (POST /events): before inserting, check if eventId already exists. Return 200 if it does (idempotent). This prevents the offline drain retry from creating duplicate DB rows.

Beyond Real-Time — The Broader Disciplines
Performance and perceived speed
Every live score system has five hops: Event at stadium → Data provider confirms → Your backend processes → Client receives → renders. Every 15 seconds of polling interval adds up to 14 seconds of potential delay at the detection hop. Sportmonks
For BrixSports the chain is: logger taps button → POST /events → WS broadcast → viewer sees. That's sub-second when everything works. The performance discipline is making sure it feels that fast even when things degrade — which is exactly what optimistic UI on the logger side and snapshot-on-reconnect on the viewer side achieve.
Caching strategy by content type
Pick strategies by content type: cache-first for static assets, network-first for dynamic data. MagicBell
BrixSports's sw-user.js should be serving the app shell from cache (cache-first) and live match data from network (network-first with fallback to cache). If the service worker is caching API responses aggressively, that's why the public page shows stale data even on hard refresh — the SW serves a cached 200 from the previous match state. Worth auditing the sw-user.js caching rules for /api/matches/* routes.
Conflict resolution for the logger
When two devices edit the same data offline and both sync when they come back online, you have a conflict. Last-write-wins strategy based on timestamps is simple and works for 95% of cases. Rohit Raj
For match events, last-write-wins is wrong — goals are append-only, not editable. The correct resolution for BrixSports is: events are immutable once written. The only "conflict" is a duplicate drain. Idempotent POST endpoint handles it. No CRDT needed, no manual resolution needed.
Observability — what's missing
Production livescore systems instrument: WS connection duration, reconnection frequency, event delivery latency, drain success rate. BrixSports has Sentry for errors. What's missing is metrics — you don't know how often Railway drops connections in practice, how long drains take, or whether the 10s polling is actually firing. Before the first real match, add at minimum: console.log('[WS] Reconnect attempt N') on each reconnect so you can see the pattern in Vercel function logs during a real match.

The Honest Assessment of Where You Are
BrixSports is architecturally sound. The transport choice, offline queue, PWA split, and optimistic logger UI are all correct decisions. What the test session exposed is a cluster of reconnection discipline gaps — not architecture gaps. These are fixable in 1-2 sessions:
-----------

## The Full Livescore Architecture Picture

### Layer 1 — Real-Time Transport: What You Have vs What's Standard

WebSocket supports bidirectional communication. SSE sends data from the server to the client. SSE is a good fit for server-to-client feeds such as score updates. The one case where WebSocket is the right choice: if your live score app also handles client-to-server events on the same connection.



BrixSports uses WebSocket (Socket.IO) bidirectionally — the logger sends events upstream, the server broadcasts downstream to viewers. That's the correct choice. You're not overengineered here. SSE would be wrong for you because the logger IS sending data upstream continuously. This isn't a clone of a read-only livescore app — it's a logging platform with a public viewer. WebSocket is justified.



\*\*What's broken is not the choice of protocol — it's the reconnection discipline around it.\*\*



Reconnecting the transport is the easy part. The hard problem is what happens after the transport reconnects: there is state on both sides of the connection, and it has diverged.



The current system treats reconnection as exceptional. Production standard treats it as normal. Every connection will drop. The question is how gracefully you recover.



\---



\### Layer 2 — The Room Re-Subscription Problem (Your Issue 6)



This is the most documented Socket.IO production gotcha in existence. The GitHub issue confirms it directly: After server restart the client does successfully reconnect but does not rejoin the room. Without this workaround the system does not work but is not robust. This issue was very tricky to solve. Socket.IO should be able to maintain the room or at least there should be some kind of a guide on how to properly manage reconnects in real world programs.



Socket.IO rooms are server-side only. On reconnect, the client gets a new socket ID. The server has no record of which rooms this new socket should be in. The client must re-emit `join-match` on every `connect` event, not just on mount. This is a one-line fix in `useWebSocket` but it's the root cause of why match state stops pushing after WS failure.



\*\*Standard pattern:\*\*

```javascript

socket.on('connect', () => {

&#x20; socket.emit('join-match', matchId)  // every connect, not just first

&#x20; fetchMatchData()                     // sync missed events immediately

})

```



\---



\### Layer 3 — Missed Event Recovery (Your Issue 4)



After reconnect, re-sync server state: send last seen message ID or cursor so the server replays missed events or sends a snapshot. Treat WebSockets as best-effort streams: backoff reconnects, heartbeats for middlebox survival, and explicit resync after every new connection.



The industry standard has two approaches:



\*\*Approach A — Snapshot on reconnect (what you should do now):\*\* On every `connect` event, call `fetchMatchData()` immediately. This pulls the current DB state including all events logged during downtime. Zero new infrastructure. Viewer sees everything that happened during the gap within one API call. This is the correct MVP approach.



\*\*Approach B — Event sequence replay (what SofaScore/Flashscore do at scale):\*\* Every event gets a monotonic sequence number. On reconnect, client sends `lastSeenEventId`. Server replays only the delta. Requires event buffering on the server. Overkill for your scale — you have one match at a time, not 10,000. Don't build this now.



\---



\### Layer 4 — Reconnection Strategy (Your Issue 5)



Exponential backoff increases delay between attempts, giving the server time to recover while reducing load. Start at 1s, double each time, cap at 30 seconds.



Socket.IO already does exponential backoff by default — `reconnectionDelay: 1000`, `reconnectionDelayMax: 5000`, `reconnectionAttempts: 5`. The problem is that after 5 attempts it emits `reconnect\_failed` and stops entirely. After giving up on automatic retries, let the user trigger a reconnect manually. Surface a "connection lost" indicator after the first failed retry.



The correct production pattern after `reconnect\_failed`:

\- Show a persistent "Connection lost — tap to reconnect" button (not a toast — it needs to stay visible)

\- Button calls `socket.connect()` manually

\- The 10s polling continues to keep data fresh in the background

\- On successful manual reconnect, rejoin the room, fetch snapshot, clear the button



The amber toast you have is correct for the initial disconnect signal. But it auto-dismisses — which means after 5s the viewer has no persistent indicator that they're degraded. That's the gap.



\---



\### Layer 5 — The Polling Refresh Problem (Your Issue 5/12)



The 10s polling calling `fetchMatchData()` and doing a full page refresh instead of a silent state update is wrong. Update only changed parts of the UI (score, event list) to keep the experience smooth and fast.



The polling effect should call `fetchMatchData()` which updates React state in place — the page should not navigate or reload. If it's causing a visible refresh, the problem is either `fetchMatchData()` is triggering a router navigation, or it's resetting state in a way that causes a full remount. This needs a trace — read what `fetchMatchData()` actually does when called from the interval, specifically whether it resets any state that causes the component tree to remount.



\---



\### Layer 6 — WS Payload Enrichment (Your Issue 1)



For a live score app, focus on the score, the minute, and major events. Only fetch full statistics when a user specifically asks for them.



The standard for production livescore WS broadcasts is: the payload carries enough data to render the event without a secondary fetch. SofaScore's WS messages include player name, team name, minute, event type, and score in a single payload. The client never needs to cross-reference a local cache for display.



Your current broadcast carries IDs, not names. The fix is server-side enrichment — before calling `broadcastMatchEvent`, join the player and team rows, add `playerName` and `teamName` to the payload. One DB read per event. At your scale (1 match, handful of viewers) this is negligible.



\---



\### Layer 7 — Timeline UX Conventions



During the match, prioritise score, match clock, events and match state. At this point, the page is a scoreboard — everything else is secondary.



The period label in the timeline — you're asking whether "1ST HALF" should move below the score header and become "H1/H2/ET/FT". Here's what the industry standard actually does:



\*\*Score header area:\*\* Period label is inline with the clock — `● 1ST HALF 23'` or `HT` or `● 2ND HALF 67'`. It sits below the score on the same card.



\*\*Timeline section divider:\*\* Industry standard (SofaScore, Flashscore) uses a pill or chip divider between periods in the event feed — `FIRST HALF` as a divider, not a header. Events from that period fall below it. When the second half starts, a new `SECOND HALF` divider appears above those events.



Your image 3 shows "Status: 1ST HALF" in the Overview card — this is the problem. The status field on the Overview tab should reflect the actual current period correctly, not show a stale or wrong value. The score header shows "1ST HALF 2'" correctly. The Overview card showing "1ST HALF" as the status when the match has ended is a stale state display issue — the Overview card is reading from DB status, not from the live WS state.



\*\*The compact label question:\*\* "H1/H2/ET/FT" vs "1ST HALF/2ND HALF" — SofaScore uses the full words. Flashscore uses abbreviations on card views. For the timeline divider, full words are fine. For the score header where space is tight on mobile, abbreviated is standard: `1H`, `HT`, `2H`, `ET`, `FT`, `P`. Pick one convention and apply it everywhere.



\---



\### Layer 8 — Event Deduplication (Your Issue 2)



Handle corrections: Real-time event feeds may have corrections or delays. Ensure that you don't show duplicate information.



Every production livescore system deduplicates by event ID before appending to the display array. The pattern is universal — check `existingEvents.some(e => e.id === newEvent.id)` before push. This covers the case where a WS event arrives AND the 10s poll returns the same event from DB. Without it you get the duplicate Foul entries you're seeing.



\---



\### Layer 9 — The Second Yellow Regression (Your Issue BUG-015)



This is separate from all WS issues. The regression in second yellow display is most likely caused by the BACKLOG-104 work touching the card event rendering logic in `LiveMatchTimeline.tsx` or `MatchTimeline.tsx`. The icon/color switch cases were modified for `PENALTY SAVED` and `PENALTY MISSED` — if there was a structural change to the switch statement, it may have dropped the `SECOND YELLOW` or `RED CARD (SECOND YELLOW)` cases. DB query first — if the event is in the DB, it's a display regression. If it's not in the DB, it's a logic regression in the cascade undo write path.



\---



\### Priority Fix Order — Production Standard Justified



| # | Fix | Why first |

|---|---|---|

| 1 | Room rejoin on every `connect` + `fetchMatchData()` on reconnect | Root cause of issues 4 and 6 — one block of code |

| 2 | WS payload enrichment (player/team names) | Fixes issue 1 — every event display |

| 3 | Event deduplication by ID | Fixes issue 2 — duplicate timeline entries |

| 4 | `reconnect\_failed` persistent CTA button | Fixes issue 5 — viewer has no recovery path |

| 5 | Trace `fetchMatchData()` refresh behavior | Fixes issue 12 — polling causing page reload |

| 6 | Second yellow regression trace + fix | Fixes BUG-015 |

| 7 | Period label cleanup (H1/H2/ET/FT, Overview stale state) | UX polish |



Items 1-3 are one short Claude Code session. Items 4-5 are the same session or the next. Item 6 needs a DB query first before any code. Item 7 is cosmetic and can wait.



\*\*The fundamental principle:\*\* Handling poor connections: Show the last known data, a "stale data" indicator, and have a system that tries to reconnect. Latency matters: if your data feed is too slow, users will see the app as unreliable.



You're 80% there. The core flow works. What's missing is the reconnection discipline that turns a demo into a production system. Items 1 and 2 above close that gap significantly.

