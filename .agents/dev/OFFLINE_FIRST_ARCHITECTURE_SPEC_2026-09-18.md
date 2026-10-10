# Spec — Read-Path Resilience for Viewer-Facing Pages (extends `BACKLOG-394` P1)

**Date:** 2026-09-18
**Tier:** MVP → PRODUCTION, solo developer, "ship over perfect" execution bias (`CLAUDE.md`)
**Status:** scoping only — no implementation.
**Relationship to `BACKLOG-394-SPEC-offline-first-caching.md`:** that spec (still only a draft, uncommitted, in worktree `.claude/worktrees/match-detail-tabs`) covers `/matches/[id]` specifically and left its P1 (shared hook + cross-page survey) and P2 (Service Worker cache layer) open and unscoped. This document **is** that P1, now that the survey is done and a proven pattern exists to extract from. P2 is untouched and stays deferred — not addressed here.
**Origin:** a full-team reassessment session ("hands on deck") triggered by `BACKLOG-403` (Server Component crash-on-DB-hiccup, RESOLVED) and `BACKLOG-394` (P0 done, P1/P2 open) both tracing to the same root gap: no shared answer for "how does a viewer-facing page behave when its data source is unavailable."

---

## Problem Statement

Three viewer-facing pages each independently reinvent "what happens when a fetch fails," with no shared logic, and two of them get it wrong in the exact way `CLAUDE.md`'s own Real-time rule prohibits ("Viewer must see stale data clearly on failure, not a crash"):

| Page | Fetch pattern | Behavior on fetch failure | Bug? |
|---|---|---|---|
| `/matches/[id]` (`MatchDetailClient.tsx`) | plain `fetch` + `useState` | Distinguishes real 404 (`loadError: 'not-found'`) from a network/fetch error (`loadError: 'load-failed'`); reuses an existing "Live updates paused — refreshing automatically" toast for the adjacent WS-disconnect case | **Fixed** — `BACKLOG-394` P0, 2026-09-18 |
| `/teams/[id]` (`TeamDetailClient.tsx`) | plain `fetch` + `useState` | `catch` block only logs; `data` stays `null`; render falls through to a hard "Team not found" page — indistinguishable from a real nonexistent team | **Confirmed bug, undocumented until this session** |
| `/competitions/[id]` (`page.tsx`) | plain `fetch` + `useState` | `catch` block explicitly calls `setNotFound(true)` on the initial-mount fetch — same false-not-found, more directly | **Confirmed bug, undocumented until this session** |
| `/live` (`page.tsx`) | plain `fetch` + `useState`, 15s poll | `catch` is a no-op — `liveMatches` state is untouched. On a **later poll** that keeps stale data on screen (correct, but no "may be stale" signal). On the **first load** it stays `[]`, so the page asserts "**0 matches live now**" / "**No Live Matches**" — a false statement during a real live match. If the API returns a 500 error body instead of throwing, `setLiveMatches(<object>)` runs with no `Array.isArray`/`response.ok` check (header would render `undefined matches live now`) — source-read, not reproduced | **Worse than first written:** first-load failure is a false-empty, not just a missing indicator |

**How this interacts with the existing Service Worker (added after checking `public/sw-user.js`):** the SW caps live-score API data at 30s freshness and deliberately returns nothing for older cached scores. That is correct behavior for the SW, but it means the page layer *will* see a failed fetch for `/api/matches?status=LIVE` on any reload while offline for more than 30s — and today `/live` reads that as "nothing is live." Likewise `TeamDetailClient` does `setData(await response.json())` with no `response.ok` check, and `/api/teams/[id]` returns a 500 error body on failure, so a server error likely sets `data` to an error object rather than reaching the not-found branch (source-read, not reproduced). Frequency caveat for `/teams` and `/competitions`: their API responses are stale-while-revalidate cached by the SW, so the false-not-found mainly bites on a **cold cache** (first visit while offline/flaky, or after cache eviction), not on every drop. Still real; narrower than "any fetch failure."

**Important correction to the existing `BACKLOG-394-SPEC`'s own assumption:** that spec frames this as an "SWR-backed pages" problem needing a `useResilientMatchData` hook built on SWR. None of the four pages above use SWR — all four are hand-rolled `fetch` + `useState`. The fix needs to be a plain-React hook, not an SWR wrapper.

This is the same shape of problem `ENGINEERING_AUDIT_2026-09-17.md`'s finding C2 already named for a *different* layer of the stack: "a pattern that recurs three times ... is a missing primitive, not three independent bugs" (there: FPL/predictions/polls API routes staying live under `notFound()` pages). This session found the read-path version of the same lesson, independently, in different files.

---

## Goals

1. Close the two confirmed live bugs (`/teams/[id]`, `/competitions/[id]`) so a network blip on first load never renders as "this doesn't exist."
2. Give `/live` a visible staleness indicator on a failed poll, matching the standard already set by `/matches/[id]`.
3. Extract one small, reusable pattern so the next viewer-facing page built on `fetch` + `useState` gets this behavior by default, instead of the bug being rediscovered a fourth time.
4. Ship a single, consistent copy/visual language for "data source unavailable" across all instances of it, instead of three different implicit conventions.

## Non-Goals

- **Migrating to SWR or React Query.** The existing `BACKLOG-394-SPEC` considered and correctly rejected building a custom caching layer to replace a fetch library — the same reasoning applies to introducing one now. Not needed to solve this; would be a much larger, riskier change for a solo dev to absorb mid-redesign-branch.
- **Building a Service Worker read-cache layer.** **Correction, same day:** this was originally written assuming `BACKLOG-394` P2 was undesigned/deferred work. It is not — `public/sw-user.js`, registered on every viewer route via `<PWAProvider swPath="/sw-user.js">` (`src/app/layout.tsx`), already implements exactly this: cache-then-serve for any previously-visited page, a per-route API TTL policy (never-cache for auth/live-event data, 30s-capped network-first for live match/score data, stale-while-revalidate for near-static teams/players/competitions/news/standings), image caching, and a build-SHA-stamped cache version so deploys can't serve stale chunks. Shipped and live-verified session 55 (2026-08-25), tracked under `BACKLOG-226` (status: "Core ask SHIPPED and live-verified"). Richard also already reviewed and explicitly rejected a generic offline-architecture rewrite (SWR/TanStack Query + IndexedDB persistors, RxDB/PouchDB, swapping in `@ducanh2912/next-pwa`) in favor of this hand-rolled, already-hardened SW — see `BACKLOG-226`'s "External offline architecture blueprint reviewed and rejected" note. **This spec's P0–P1 (the in-memory `loadError`/resilience-hook layer) is a different, complementary layer** — component-level state for the "page is open, a fetch just failed" case — and doesn't need to touch or duplicate `sw-user.js`'s network-level caching. Don't conflate with the Logger's separate write-path offline queueing (`PWA_LIMITATIONS.md`, `admin-offline-queue.ts`) either — three genuinely distinct layers, not one problem.
- **Merging this with `BACKSCOPE_API_GUARD_SPEC.md`.** That spec (peer session, 2026-09-18, code not yet written) is a *different* primitive for a *different* problem: gating dead-feature API write routes, deliberately **fail-closed** (an unrecognized/erroring state must default to blocked). This spec's primitive is deliberately **fail-open** in the opposite sense — a data-fetch error must default to *showing what we have*, never to hiding real content. Reusing one name ("resilience primitive") for both would invert a safety property on one side or the other. Keep them separate; cross-reference only.
- **A full survey of every page in the app.** Scope is the four pages above (the ones sharing this exact plain-`fetch`+`useState` pattern on genuinely live/real-time-adjacent content). Static content pages (news articles, static team rosters) are lower-risk and out of scope here.
- **A generic global error-boundary rewrite.** `BACKLOG-403` already solved the Server-Component-level version of "don't crash the whole page" for the 4 SEO-wrapper pages. This spec is scoped to client-side fetch state, not React error boundaries.

---

## User Stories

- As a Viewer on a flaky campus connection opening a team or competition page for the first time, I want an honest "couldn't load this — retry" message when the fetch fails, not a page telling me the team or competition doesn't exist.
- As a Viewer already looking at a team/competition/live page whose background refresh fails, I want the data I can already see to stay on screen with a visible "may be out of date" signal, not to have it silently vanish or silently go stale with no signal at all.
- As a Viewer, I want the same visual language for "this is stale" and the same language for "this failed to load" everywhere in the app, so I only have to learn what it means once.
- As the developer, I want the next viewer-facing page I build on `fetch` + `useState` to get this behavior by importing one hook, not by remembering to re-implement three states correctly from scratch.

---

## Requirements

### Must-Have (P0)

1. **Extract `MatchDetailClient.tsx`'s proven `loadError: 'not-found' | 'load-failed'` pattern into a shared hook** (e.g. `src/hooks/useResilientFetch.ts` — exact name TBD at implementation time). Shape, not full code:
   - Takes a URL (or fetcher function) and a way to identify a "real not-found" response (e.g. HTTP 404, or a caller-supplied predicate on the parsed body) vs. any other failure.
   - Exposes: `data`, `isLoading`, `isStale` (true when showing previously-successful data after a later failure), `loadError: 'not-found' | 'load-failed' | null`.
   - On any fetch failure: if there is no previously-successful `data`, set `loadError: 'load-failed'`. If there is previously-successful `data`, keep serving it and set `isStale: true` — never overwrite good data with an error state.
   - On a caller-identified real not-found response: set `loadError: 'not-found'`, regardless of whether stale data exists (a confirmed 404 is a confirmed 404 — don't keep showing stale data for a resource that's actually gone).
   - No SW, no IndexedDB, no persistence beyond the component's own lifetime — in-memory only, same ceiling SWR's default behavior would have.
   - Acceptance: given `/teams/[id]` uses this hook, when the initial fetch fails with a network error, then `loadError === 'load-failed'` and the page renders a retry state, never "Team not found."

2. **Apply the hook to `/teams/[id]` and `/competitions/[id]`**, replacing their current ad hoc `catch` handling. Acceptance: a simulated network failure on first load renders the new retry state, not the existing not-found page; a real 404 (nonexistent team/competition ID) still renders the not-found page unchanged.

3. **Fix `/live`'s first-load false-empty and add a staleness indicator.** A first-load failure must render the retry state (b), never "0 matches live now" / "No Live Matches"; guard `setLiveMatches` with `response.ok` + `Array.isArray`. Then add the indicator, reusing the same toast/visual pattern as `/matches/[id]`'s "Live updates paused — refreshing automatically," shown when a poll fails while previously-loaded matches are still on screen. Acceptance: a simulated failed poll on `/live` with matches already loaded shows the indicator; matches remain visible, not blanked.

4. **Ship the 3-state copy pattern** (see Copy section below) consistently across all four pages.

### Should-Have (P1)

5. **Survey any other `fetch`+`useState` viewer-facing pages not covered by this pass** (e.g. `/players/[id]` if it follows the same pattern — not yet checked this session) and apply the same hook. Not blocking P0; a short follow-up sweep once the hook exists and is proven on the four pages above.
6. **A lightweight process note** (not a new backlog item, not a new primitive): this project has now independently hit "recurring per-instance patch instead of a shared primitive" twice — once for API write-route backscoping (`ENGINEERING_AUDIT_2026-09-17.md` C2), once here for read-path resilience. Worth a one-line callout in `BUILD_JOURNAL.md` or `.agents/rules/` the next time a third instance of this shape appears, so it's recognized on sight rather than re-discovered as a "new" pattern each time.

### Future Considerations (P2 — unchanged from `BACKLOG-394-SPEC`)

7. A genuine Service Worker read-cache layer for full offline browsing — still explicitly deferred, needs its own spec when actually scoped.
8. A "data as of [timestamp]" label with real staleness age instead of a binary flag — nice-to-have precision, not required now.

---

## UX Copy — the 3-state pattern

Reasoned from the existing, already-shipped toast on `/matches/[id]` plus this session's product-side pass. Three states, deliberately kept visually and textually distinct so a viewer never confuses "stale but real" with "gone":

| State | When | Copy | Component |
|---|---|---|---|
| **(a) Stale-but-showing-cached-data** | Data loaded successfully once, a later background refresh/poll fails | Reuse the existing pattern verbatim on `/matches/[id]` ("Live updates paused — refreshing automatically"); on non-live-score pages (team/competition) adapt to **"Showing saved data — reconnecting automatically"** since "live updates" implies a live score, which isn't always what's on screen | Non-blocking toast/banner overlaid on real content — same component already built, reused, not reinvented |
| **(b) Never-loaded, fetch failed** | No prior successful data exists and the first fetch fails | **"Couldn't load this right now. Check your connection and try again."** + a Retry action. Must never say "not found." | Full-page empty state, distinct icon from (c), has a Retry button |
| **(c) Genuinely doesn't exist** | Confirmed 404 | Keep existing copy ("Team not found" / "Competition not found" / "Match not found") | Full-page empty state, no Retry action (nothing to retry) — keep or add a "browse teams/competitions" link instead |

**Reconcile with what already exists — don't add a third indicator.** The app already mounts a global `OfflineIndicator` banner (`src/components/pwa/OfflineIndicator.tsx`, via `PWAProvider` in the root layout) driven by the browser's `online`/`offline` events, plus the transient `warning('Live updates paused — refreshing automatically')` toast on `/matches/[id]` (`MatchDetailClient.tsx:356`, verified). `navigator.onLine` reports `true` on a campus WiFi connection with no upstream internet, which is the case this audience most often hits, so the per-page fetch-failure states above are still needed — but they must reuse these two components' visual language, and state (a)'s copy for non-live pages ("Showing saved data — reconnecting automatically") is a new string proposed here, not existing copy. Add a fourth row to the table when implementing: **(d) `/live` first-load failure must render (b)'s retry state, never "No Live Matches."**

(b) and (c) must remain visually distinguishable at a glance (different icon and/or action) even though both are full-page empty states — the whole point of this spec is that a viewer (and a developer skimming a screenshot) can tell them apart.

---

## Open Questions

- **[Engineering]** Should the hook be typed generically (`useResilientFetch<T>`) for reuse beyond these four pages, or kept narrowly typed to match-shaped data until the P1 survey (item 5) finds a second real consumer? Recommend narrow-then-generalize — don't design the generic version speculatively.
- **[Engineering]** Does `/live`'s 15s polling interval need backoff on repeated failures (avoid hammering a downed endpoint every 15s indefinitely), or is that over-engineering for current traffic levels? No strong opinion — flag for whoever implements this to make a call, not blocking.
- **[Product]** Confirmed no ceiling on how long "possibly stale" data is shown before switching to a harder failure state (carried over unchanged from `BACKLOG-394-SPEC`'s own open question) — still recommend "no ceiling for P0," revisit if it proves confusing in practice.

---

## Phasing — Now / Next / Later

**Now** (this wave, small enough for one session):
- P0 items 1–4: extract the hook from the proven `MatchDetailClient.tsx` pattern, apply to `/teams/[id]` and `/competitions/[id]`, add the `/live` staleness indicator, ship the 3-state copy. All four build on a pattern that's already shipped and live-verified once — this is "extract and reuse," not "design from scratch," which is why it's sized for Now rather than Next despite touching four files.

**Now, step 0 (before the hook work):** run one real network-severed test of the already-shipped `sw-user.js` (visit `/`, `/live`, a team, a competition, then go offline and reload each). `BACKLOG-226` never exercised a truly severed connection, so this sets how deep the hook work below needs to go. Do `/live`'s false-empty fix first regardless — it is the worst of the four and adjacent to Flow C.

**Next**:
- `BACKLOG-409` decision (delete the dead `sync-favorites`/`sync-profile` handlers, or build a viewer favourites/profile queue) — Richard's call.
- P1 item 5: survey any remaining `fetch`+`useState` viewer pages and extend the hook. Do this once the hook has a second and third proven consumer (teams, competitions) rather than before.
- P1 item 6: the process note about the recurring "patch vs. primitive" shape — a documentation task, not a build task, do whenever convenient.

**Later** (explicitly deferred, unchanged):
- Item 8 (staleness-age timestamp label) — nice-to-have precision, not required now.
- Item 7 (Service Worker read-cache layer) is **struck** — already shipped, see the corrected Non-Goals section above. `BACKLOG-226`'s own remaining "future hardening" sub-items (admin skeleton-loader race, general admin-write queue beyond period-transitions, admin+logger SW manifest merge) are that system's own backlog, not this spec's.
- **Explicitly not planned at all:** unifying this primitive with `BACKSCOPE_API_GUARD_SPEC.md`'s write-path guard. Different failure polarity, different problem. Flagging so it isn't accidentally proposed later as a "nice generalization."

---

## Timeline Considerations

Not a merge blocker for the current `feature/ui-redesign` → `dev` promotion — consistent with `BACKLOG-394-SPEC`'s own placement (`BACKLOG-397`/`398`'s security fixes are the actual blockers). Recommend picking up the Now wave in the same session/wave as other small `BACKLOG-400`-adjacent follow-ups, since it's similar size and shape to that work.

---

*Produced 2026-09-18 as part of a full-team (engineering + product) offline-first/error-resilience reassessment, triggered by `BACKLOG-403` and `BACKLOG-394`. Extends `BACKLOG-394-SPEC-offline-first-caching.md`'s P1 section rather than replacing it — that document's P0 (shipped) and P2 (deferred) sections are unaffected.*
