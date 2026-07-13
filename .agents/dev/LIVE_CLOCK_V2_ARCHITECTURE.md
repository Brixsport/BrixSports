# BrixSports — Live Clock v2 Architecture
**Status:** DESIGN LOCKED — pending build directive
**Owner:** Richard
**Drafted:** 2026-06-30, planning chat
**Supersedes:** the mm:ss patch from Directive 5 (receipt-only, no timestamp anchoring, no extrapolation) — that patch should NOT ship as-is; this design replaces its underlying model while keeping its visible output (mm:ss display, isStale dimming concept).

---

## 1. Problem Statement

The live match clock is the single most-watched piece of data on the platform — more than the score itself, because the score only changes a handful of times per match while the clock is the constant signal that tells a viewer "this is still live, still trustworthy."

**Scope note:** this design is intentionally sport-agnostic. BrixSports is a multi-sport, multi-campus platform (BUSA League at Bells University is the first pilot, not the full scope). The clock architecture must hold for football (45-minute halves, injury time, extra time, penalty shootout), basketball (game clock counting down, shot clock, quarters), and any future sport added. Where sport-specific clock behavior diverges (e.g. basketball's countdown vs. football's count-up, shot clock as a parallel timer), those are handled at the `MatchStateManager` level per sport — this document covers the shared transport and reconciliation model that sits underneath both.

The current implementation has five independently confirmed structural risks (Directive 6 trace, 2026-06-30):

1. No pause mechanism — `SUSPENDED` period exists in the type system but the clock keeps running through it.
2. No cap on the delta-correction math — a backgrounded/locked logger phone resuming after minutes of suspension applies the full elapsed gap in one jump, visible to every connected viewer instantly.
3. No distinction between a normal 1-second tick and a post-resume correction — the viewer applies whatever arrives with no smoothing, and the existing `isStale` indicator clears the instant the (possibly wrong-looking) jump lands, making the jump look like a normal update.
4. No single-writer enforcement — two logger sessions on the same match can both run independent clocks and both broadcast, producing flicker/jitter with no resolution mechanism.
5. `isStale` is a binary flag with no duration awareness — a 2-second hiccup and a 5-minute outage render identically.

This document is the locked design replacing all five gaps with one coherent model, informed by NTP/Cristian's-algorithm-style timestamp offset correction, game-netcode client-extrapolation/server-reconciliation patterns, and PWA-specific background execution research (Android timer throttling vs. iOS full suspension).

---

## 2. Design Principles (non-negotiable, established in this design session)

- **The logger device remains the sole time authority.** No true server clock is being introduced — the WS server (Railway) stays a passthrough. This is a deliberate scope limit: building a server-side authoritative clock is a much larger change (would require the WS server to track match state, not just relay it) and isn't justified by the problem.
- **90/10 authority split:** the logger's pushed value is always what the viewer converges toward (90 — never negotiated, never overridden by client guesswork). The viewer's local interpolation is purely presentational (10 — it supplies the moment-to-moment motion between corrections and absorbs the correction gracefully). The client never decides what time it is; it only decides how to *move toward* what the logger says it is.
- **All correction is passive.** No flags, no "time corrected" banners, no visual interruption. A correction should look like the clock naturally running slightly faster or slower for a few seconds, not like an event happened.
- **Single-writer enforcement is a prerequisite, not a parallel workstream.** Shipping the smoothing model without it makes a dual-logger scenario actively worse than today's behavior (two competing convergence targets instead of simple jitter). It must land first or in the same release.
- **iOS and Android are different failure modes, not different magnitudes of the same one.** Android throttles background timers; iOS Safari/WebKit (which is what the installed PWA actually runs on) suspends the JS context near-fully. Any fix relying on a timer "running slowly in the background" is an Android-only fix and will silently fail to help iOS users.

---

## 3. Data Shape Changes

### Logger emit payload (`match:time:update`)
```ts
{
  matchId: string,
  minute: number,
  second: number,
  half: string,
  period: string,
  extraTime: boolean,
  emittedAt: number,  // logger's Date.now() at the moment this value was true
  seq: number         // NEW — monotonically incrementing integer, resets to 0 on period transition
}
```
`emittedAt` is the field that makes timestamp-offset correction possible. Without it, the payload is an instruction ("show this"); with it, the payload is a fact ("this was true at this instant") — and facts can be projected forward to account for transit time.

`seq` solves a separate problem: network reordering. On 3G/intermittent connections, two payloads sent 5 seconds apart can arrive out of order. Without a sequence number the viewer has no way to know whether an arriving correction is newer or older than the last one applied. The backwards-clock guard in §4.4 partially handles this, but `seq` makes it airtight — the viewer discards any payload where `seq <= lastAppliedSeq`. Monotonic within a period; reset to 0 on every period transition so the viewer's guard doesn't reject the new-period first correction as stale.

### Emit cadence change
Current: every 1 second, unconditionally, for the duration of the match.
New: every 5 seconds during normal play. This is a deliberate, large reduction in fan-out volume — justified both by the bandwidth-tax concern for the realistic Nigerian mobile-data access pattern, and because once the viewer extrapolates locally, sub-5-second server confirmation adds no perceptible value (commercial sports-data backbones converge on 15-30s polling intervals for the same reason — see research notes, §7).

### Client-side stored state (`useMatchTimer`)
```ts
{
  minute: number,
  second: number,
  emittedAt: number,
  receivedAt: number,        // local Date.now() at the moment this payload was received
  displaySeconds: number,    // locally-ticked, what's actually rendered
  catchUpMultiplier: number, // 1 normally; >1 while converging after a large gap
  lastCorrectionAt: number,  // for staleness duration check
  isDegraded: boolean        // replaces binary isStale
}
```

---

## 4. Core Algorithm

### 4.1 Logger-side: timestamp-anchored, carry-forward delta cap

In `tick()`, replace the uncapped delta application with a capped-but-not-discarded version:

```ts
const deltaMs = now - this.state.clock.lastTickTimestamp;
const deltaSeconds = Math.floor(deltaMs / 1000);
if (deltaSeconds <= 0) return;

const CAP_SECONDS = 60; // never apply more than 60s in a single tick
const applied = Math.min(deltaSeconds, CAP_SECONDS);

this.state.clock.lastTickTimestamp += applied * 1000; // NOT `now` — advances by only what was applied
// remainder (deltaSeconds - applied) stays "owed" and gets picked up on the next tick(s)

const totalSeconds = clock.second + applied;
const minutesElapsed = Math.floor(totalSeconds / 60);
clock.absoluteMinute += minutesElapsed;
clock.second = totalSeconds % 60;
```

This is the fix to the bug in the originally-proposed one-liner cap: advancing `lastTickTimestamp` to `now` after applying a capped delta silently discards the uncapped remainder forever. Advancing it by only the applied amount means the next `tick()` call sees the same large gap minus what was already paid off, and pays off another 60s chunk, repeating until caught up. A 3-minute gap resolves itself over roughly 3 ticks instead of either jumping instantly or being permanently lost.

Apply the same logic in `initializeState()` rehydration (tab reload / crash recovery case).

### 4.2 Logger-side: resume trigger, not just natural tick

Don't wait for the next scheduled tick to discover a gap. Add an immediate forced `tick()` call on:
- The existing `online` event listener (already exists for offline-queue drain — reuse it)
- A new `visibilitychange` listener, firing only when `document.visibilityState === 'visible'`

**iOS-specific sequencing requirement (flagged in research, §7.3):** on iOS, when the app backgrounds, the WebSocket connection itself is very likely also suspended/dead, not just the clock timer — Safari pauses nearly all background activity, unlike the selective throttling on other browsers. This means `visibilitychange→visible` and the socket's own `reconnect`/`connect` event will likely fire close together describing the *same* underlying interruption. Do not let both independently trigger a correction — that risks a double-correction race (two resyncs landing in quick succession against potentially different snapshots). Sequence it: `visibilitychange→visible` should trigger a *check*, not an immediate correction — wait for (or actively trigger) the WS reconnect first, then resync the clock off that confirmed-connected state.

### 4.3 Viewer-side: receipt and timestamp projection

```ts
const handleTimeUpdate = (data) => {
  const receivedAt = Date.now();
  const transitSeconds = Math.round((receivedAt - data.emittedAt) / 1000);
  const correctedTotalSeconds = (data.minute * 60 + data.second) + Math.max(0, transitSeconds);
  // ... feed correctedTotalSeconds into the reconciliation step (4.4)
};
```

`Math.max(0, transitSeconds)` guards against negative values from clock skew between devices (logger's `Date.now()` and viewer's `Date.now()` are not synchronized with each other — this is an estimate, not exact NTP-grade sync, and that's an accepted limitation given the scope; see §6).

### 4.4 Viewer-side: local ticking + passive catch-up reconciliation

The viewer runs its own `setInterval(1000)` incrementing `displaySeconds` independently of WS receipt — this is what keeps the clock visibly moving during the new 5-second gaps between corrections, and during any WS interruption.

On each correction landing (4.3's `correctedTotalSeconds`):
```ts
const gap = correctedTotalSeconds - displaySeconds;

if (Math.abs(gap) <= SMALL_GAP_THRESHOLD) {       // e.g. 3 seconds
  // normal jitter — absorb silently, no visible change in tick rate
  displaySeconds = correctedTotalSeconds; // or nudge fractionally, implementation's choice
} else {
  // large gap — phone-lock/suspend scenario
  catchUpMultiplier = Math.min(3, 1 + Math.floor(Math.abs(gap) / 20)); // capped at 3x
  catchUpTarget = correctedTotalSeconds;
  // local interval now increments by `catchUpMultiplier` seconds per real second
  // until displaySeconds reaches catchUpTarget, then multiplier resets to 1
}
```

No flag, no label, no color change tied to this event specifically — the clock simply appears to run faster for a few seconds and settles. A 3-minute gap at 3x catch-up converges in roughly 60-90 seconds of accelerated ticking; tune `SMALL_GAP_THRESHOLD` and the multiplier cap based on how that actually feels once built (this is a UX-feel parameter, not a correctness one — fine to adjust post-ship without re-architecting).

**Edge case — backwards correction (guard required):**
If the incoming `correctedTotalSeconds` is *less than* the viewer's current `displaySeconds`, do not apply it. A backwards jump in the displayed clock — even a few seconds — is significantly more disorienting to a viewer than a forward jump of the same magnitude, because it visually contradicts the fundamental expectation that time moves forward. This can happen legitimately (logger's clock was slightly ahead due to its own delta accumulation, viewer's local ticking is "ahead" of the corrected value after a reconnect) but the UX cost of displaying it outweighs the cost of holding position and waiting for the next correction to re-align naturally.

```ts
// Add at the top of the reconciliation block, before gap calculation:
if (correctedTotalSeconds < displaySeconds) {
  // Correction is behind viewer's local clock — hold position.
  // Next correction will re-align naturally as the logger's clock advances.
  return;
}
```

This guard means the displayed clock can only ever move forward or hold — never visibly backwards — regardless of what the correction payload contains. In the rare case where the logger's actual clock genuinely needs to go back (admin correction, period reset), that is handled via a dedicated match admin event, not via the time-sync channel.

### 4.5 Degraded/staleness state (replaces binary `isStale`)

```ts
isDegraded = (Date.now() - lastCorrectionAt) > DEGRADED_THRESHOLD_MS; // e.g. 20000 (20s)
```//
Checked on a render-tick basis (or recomputed whenever the local 1s interval fires). With the new 5-second emit cadence, a 20-second threshold means roughly 4 missed corrections in a row before the UI shows anything — short enough to catch a real outage, long enough not to flicker on normal jitter. `LiveMatchStatus` keeps the existing dimming treatment, now driven by this duration check instead of a raw disconnect boolean — local ticking keeps the number moving even while degraded, only the visual treatment (opacity) changes.

---

## 5. Single-Writer Enforcement (prerequisite, separate concern)

Not a clock-algorithm problem — a locking/authorization problem. Fix at the WS server boundary:

Before relaying a `match:time:update` emit, the WS server validates the emitting session against the `active` row in `match_logger_assignments` for that `matchId`. Only the currently-active assignment's session may emit time updates; emits from any other session for that match are dropped (and ideally trigger a one-time signal back to that logger's own client — "another session is logging this match" — so the offending logger isn't left guessing why their clock isn't propagating).

This requires the WS server to know about `match_logger_assignments` state, which it currently doesn't (pure passthrough). Smallest viable approach: the assignment-status check can happen at subscribe/connect time (validate once per session, cache the verdict for that socket's lifetime) rather than per-emit, to avoid a DB read on every 5-second tick.

**WS authentication at handshake (security note, same session):** currently the Railway WS server has no authentication on the socket connection itself — any client can connect and join any match room. This is acceptable for viewer sockets (live scores are public). For logger sockets specifically — which are the only sessions that should be emitting `match:time:update` and `event:log` — authentication should happen at connection time: the logger passes its JWT as a query param or via the Socket.IO `auth` handshake option, and the server validates it before allowing the connection to be established. This is a prerequisite for the single-writer check above (you can't validate an assignment if you don't know who the connecting socket is). Implementation: `io.use((socket, next) => { verifyLoggerToken(socket.handshake.auth.token) ? next() : next(new Error('unauthorized')) })` on the server; `io(url, { auth: { token: localStorage.authToken } })` on the logger client only.

---

## 6. Known Limitations (accepted, not fixed by this design)

- **No true clock synchronization between logger and viewer devices.** `emittedAt`/`receivedAt` comparison assumes both devices' system clocks are reasonably close to correct (NTP-synced at the OS level, which is the default on virtually all modern phones) — this is good enough for the seconds-level precision this product needs, but it is not cryptographically or formally synchronized the way a real NTP exchange would be. Acceptable: per the gamedev research, drift at this scale (seconds, not milliseconds) is far below the threshold where formal RTT-based offset calculation would meaningfully improve accuracy.
- **5-second emit cadence means a goal logged at second 3 of a 5-second window won't move the clock until the next scheduled tick** — this is fine, because score/event changes go over a *separate* channel (`event:new`, already real-time per existing architecture) and are not gated by the clock emit cadence at all. The clock and the event feed are independent data streams; this design only touches the former.
- **iOS PWA users on iOS 17.4+ in the EU lose standalone PWA mode entirely** (per current Apple/DMA policy) and fall back to a Safari tab experience with no push support — out of scope for this design, noted for awareness since it affects how reliably any background-resume logic can be expected to fire for that user segment specifically. Not a Nigeria-relevant constraint today but worth remembering if multi-region expansion ever includes EU.

---

## 7. Research Basis (sources consulted, 2026-06-30 and 2026-07-01)

- Sportmonks ("How to Build a Live Score App: Architecture for Sub-Second Updates") — confirms 15-30s polling/correction intervals are the industry-standard tradeoff point for live score clocks; sub-second server-confirmed precision is not perceptible value past local extrapolation.
- GameDev.net / Gabriel Gambetta entity-interpolation series — confirms client local-tick + periodic server snapshot correction is standard netcode practice; confirms drift tolerances in the tens-of-milliseconds range are imperceptible; directly validates the `displaySeconds` local-tick model in §4.4.
- Cristian's algorithm / NTP offset literature (Rutgers, Princeton COS418, Wikipedia) — basis for the `emittedAt`/`receivedAt` timestamp-projection approach (§4.3), simplified from full bidirectional RTT measurement since this system doesn't need NTP-grade precision.
- Polymarket Sports WebSocket docs — real-world confirmation that production live-sports WS payloads carry `elapsed` (mm:ss string), `period`, `status`, and `live` — not raw second counters — validating the display-layer mm:ss approach.
- firt.dev ("Understanding JavaScript in the Background") and MDN Page Visibility API docs — confirmed the Android-throttle vs. iOS-Safari-full-suspension distinction; confirmed WebSocket connections are nominally exempt from throttling on most browsers but Safari's background pause is near-total regardless, informing the iOS WS+timer co-suspension flag in §4.2.
- MagicBell PWA iOS Limitations guide (2026) — confirmed the `online` + `visibilitychange` resync pattern already in use elsewhere in this codebase (offline-queue drain) as the correct standard approach, reused here for clock resume.
- websocket.org reconnection guide (2026) — confirms exponential backoff with jitter as the production standard for WS reconnection; confirms cellular NAT gateways drop idle mappings in as little as 30 seconds; confirms state-sync on reconnect (sequence number or last-seen ID) as required for event-ordering correctness on unreliable mobile connections.

---

## 8. Build Sequencing (for the eventual directive — not yet issued)

1. **Pause state fix** (§ Directive 6 finding #1) — independent, trivial, can ship alone.
2. **Single-writer enforcement + WS auth at handshake** (§5) — must land before or together with #3, not after. WS auth is a prerequisite for the assignment check.
3. **Carry-forward delta cap + resume triggers** (§4.1, §4.2) — logger-side only, no viewer-side dependency, can be tested independently.
4. **Timestamp-anchored payload + `seq` field + viewer local ticking + catch-up reconciliation** (§4.3, §4.4, §3) — the largest coordinated piece, touches logger emit payload shape, WS server passthrough, and the viewer hook together. Should ship as one release, not split.
5. **Degraded-state duration check** (§4.5) — depends on #4 being live (needs the new cadence and correction-landing events to measure against).
6. **WS reconnection: exponential backoff with jitter** — independent of the clock work but should ship in the same window. Replace the current flat 30-second retry loop with `delay = Math.min(maxDelay, base * 2^attempt) * (0.5 + Math.random() * 0.5)`. Prevents thundering herd on Railway restart (all clients reconnecting simultaneously). Base: 500ms, cap: 30s, jitter: ±50%.

This document is the locked reference for that directive sequence. Build directives should cite section numbers from this doc rather than re-deriving the design inline.
