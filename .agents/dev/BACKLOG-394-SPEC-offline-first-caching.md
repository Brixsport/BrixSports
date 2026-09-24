# Spec — Offline-First Read Caching for Viewer-Facing Pages (`BACKLOG-394`)

**Date:** 2026-09-18
**Tier:** MVP → PRODUCTION
**Status:** scoping only — no implementation. This spec exists so `BACKLOG-394` stops being "deferred with no shape" and becomes a real, phaseable piece of work someone can pick up.

---

## Problem Statement

`/matches/[id]` (and likely other SWR-backed viewer pages — not yet surveyed) fetches match data via SWR. When the network drops after an initial successful load, the page does not fall back to the data it already has — it reverts to a "no match found" state, actively misrepresenting a real, previously-confirmed match as not existing. This happens on Flow C, the public livescore path `CLAUDE.md` explicitly protects as one of the Three Critical Flows that must never break, and on the single highest-traffic page class in the app. A viewer on a flaky connection (this app's stated audience is Nigerian university campus networks, explicitly called out as unreliable in `CLAUDE.md`'s PWA/Mobile Rules) sees the worst possible failure mode — not "can't reach the server," but "this doesn't exist" — for a match that is, in fact, real and possibly still live.

---

## Goals

1. A dropped connection on a viewer-facing page with previously-loaded data shows that stale data with a visible "may be out of date" indicator — never a false "not found."
2. A dropped connection on first load (no cached data yet) shows a clear, honest offline/loading-failed state — not an infinite spinner, not a false "not found."
3. Reconnection automatically refreshes to live data with no user action required (SWR already does this natively — the fix must not regress it).
4. The fix generalizes: solve this once, at the fetch-hook level, not per-page — so it doesn't need rediscovering on every other SWR-backed viewer page this session hasn't surveyed yet.

## Non-Goals

- **Full offline-first architecture (Service Worker caching of API responses, background sync for reads).** This is a read-path staleness/labeling fix, not a PWA offline-mode rebuild — that's a much larger initiative and `PWA_LIMITATIONS.md` already documents the Service Worker/Background Sync gaps for the Logger's *write* path separately. Out of scope here; don't conflate the two.
- **Fixing every SWR-backed page in one pass.** `/matches/[id]` is the confirmed, reported instance. A full survey of which other pages share this pattern is Phase 1 below, not done as part of writing this spec.
- **Changing how long data is considered "fresh" for non-live content** (team profiles, competition standings, historical match data). Those are lower-risk by nature (they don't change every few seconds) and don't need the same urgency — solve the LIVE-score case first.
- **A custom caching layer to replace SWR.** SWR already does the right thing by default (serve stale data on error) — the bug is almost certainly that `MatchDetailClient.tsx`'s own error-handling branches past SWR's cached data instead of using it. Fix the consumer, don't replace the tool, unless investigation in Phase 1 proves otherwise.

---

## User Stories

- As a Viewer watching a live match on a flaky campus connection, I want the score I already saw to stay on screen (clearly marked as possibly stale) when my connection drops, so that I don't think the match disappeared.
- As a Viewer who opens a match page with no connection at all, I want an honest "can't load this right now" message, not an infinite spinner or a false "not found," so that I understand what's actually happening and know to retry.
- As a Viewer whose connection comes back, I want the page to silently refresh to the real live state with no action from me, so that the recovery is invisible when it works.
- As the developer, I want this fix to live in one shared place (a hook or a fetch wrapper), so that the next SWR-backed page doesn't reintroduce the exact same bug independently.

---

## Requirements

### Must-Have (P0)
1. **`MatchDetailClient.tsx`'s error/not-found branch must check for existing cached SWR data before rendering "not found."** If SWR has *any* previously-successful data for this key, render it (with a stale-data indicator) instead of the not-found state. Acceptance: given a match page has loaded successfully once, when the network is cut and a background revalidation fails, then the page continues showing the last-known match data with a visible "may be out of date" badge, not a "not found" state.
2. **A visible stale-data indicator** — reuse the existing "Live updates paused — refreshing automatically" toast pattern already built for the WebSocket-disconnect case (`MatchDetailClient.tsx`, per `flow-checker`'s trace this session) rather than inventing a new UI pattern. Acceptance: the same visual language already used for "WS disconnected, polling" is shown for "fetch failed, showing cached data" — one consistent "things are stale" signal, not two different ones.
3. **True first-load failure (no cache yet) shows an honest error/retry state**, never an infinite spinner and never "not found." Acceptance: given a match page is opened with zero network connectivity from the start, when the initial fetch fails, then a "couldn't load this match — retry" state renders, distinct from both the loading spinner and the not-found state.

### Should-Have (P1)
4. **Extract the fix into a shared hook** (e.g. `useResilientMatchData` or similar) rather than fixing `MatchDetailClient.tsx` in isolation, so the next page built on SWR gets this behavior by default rather than needing the same bug found and fixed again.
5. **Survey which other viewer-facing pages use SWR and share this exact pattern** (`/live`, `/teams/[id]`, `/competitions/[id]` are the most likely candidates given they're also real-time-adjacent) — produces a short list, not a fix for all of them in this phase.

### Future Considerations (P2)
6. A genuine Service Worker read-cache layer for full offline browsing of previously-viewed pages — explicitly deferred, would need its own spec, not designed against here but noting it so P0/P1 don't accidentally make this harder later (e.g., don't hardcode an assumption that only SWR's in-memory cache exists).
7. A "data as of [timestamp]" label with actual staleness age, rather than a binary "may be stale" flag — nice-to-have precision, not required for the core fix.

---

## Open Questions

- **[Engineering]** Is the root cause confirmed to be `MatchDetailClient.tsx`'s own error-handling branching past SWR's cache, or is SWR itself configured with a cache policy that discards data on error (e.g. a short `dedupingInterval` or no `keepPreviousData`)? Needs a direct read of the SWR config before Phase 0 implementation starts — this spec assumes the former based on SWR's documented default behavior, but hasn't verified it against this specific call site.
- **[Product]** How long should cached live-score data be shown as "possibly stale" before the page should instead say "we've lost track of this match, please refresh" — is there a reasonable time ceiling, or does "as long as we have it" hold indefinitely for a page like this? No strong opinion yet — recommend defaulting to "no ceiling, just always label it as possibly-stale" for P0, revisit if it proves confusing in practice.
- **[Engineering]** Does the same bug reproduce on `/live` (the list page) or is it specific to the detail page's particular error-handling code? Blocks Phase 1's survey scope.

---

## Timeline / Phasing

- **Phase 0 (this fix, P0 items above):** scoped small enough for a single session — one file's error-handling logic, reusing an existing UI pattern. No hard deadline, but recommend picking this up in the same wave as the rest of `BACKLOG-400`'s Next-bucket work (it's a similar size/shape to those items) rather than treating it as a separate large initiative.
- **Phase 1 (P1 items):** the shared-hook extraction and page survey — do once Phase 0's specific fix is proven correct on the one confirmed page, so the hook is built from a working example rather than designed in the abstract.
- **Phase 2 (P2 items):** no timeline — explicitly future, revisit only if/when a real offline-browsing initiative is scoped separately.

**Not a merge blocker for the current `feature/ui-redesign` → `dev` promotion** — this is real but lower-urgency than `BACKLOG-397`/`398`'s security fixes, consistent with its placement in the Next/Later roadmap already sent to the peer session.
