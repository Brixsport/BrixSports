# Audit: Player / Team / Competition / Stats / Ratings Data (Tier 2, Session 47D)

**Scope:** every sub-feature of player/team/competition/stats/ratings data management — both public-facing display and admin-facing management — per `SYSTEM_CRITICALITY_MAP.md`'s Tier 2 ("match-derived, persists after the match ends... a viewer can use these features with zero live matches happening"). Question asked for each: does it work end to end, beyond the pure auth-gate question already covered elsewhere.

**Method:** static code read only (no live/DB/browser testing). Every verdict is code-confirmed via direct file read and/or grep, not live-tested — treat as SHIPPED-level evidence at best, not RESOLVED-level per this project's lifecycle-state definitions.

**Out of scope, not re-investigated:** the auth-gate findings for the routes fixed under `BUG-147`/`BUG-148` (teams, transfers/[id], standings, brackets/[id], players/[id]/stats, head-to-head, competitions/templates, teams/[id]/form, etc.) — confirmed landed where checked in passing (e.g. `head-to-head` POST and `standings` POST both now call `getAuthUser` + admin check), not re-flagged. Three other audits already exist in this directory and are not duplicated here: `audit_admin_platform_47D.md` (admin UI completeness — covers `/admin/teams`, `/admin/players`, `/admin/match-lineups`, `/admin/match-ratings`, `/admin/transfers` in detail, cited rather than repeated below), `audit_logging_system_47D.md` (live logging pipeline, including the auto-ratings trigger mechanics from the *logger's* side), `audit_viewer_experience_47D.md` (live match viewing, notifications, favorites — does not touch player/team/competition data pages at all, so no overlap with this audit's scope).

**Correction to the brief:** "BACKLOG-081 (basketball players full-table scan)" does not exist — `BACKLOG-081` is "Umami Analytics," unrelated. The actual full-table-scan finding is **`BUG-039`** (`src/app/api/basketball/players/route.ts`), confirmed still OPEN below with a compounding detail not in the original filing.

**Headline finding:** the platform has **three independent, disconnected systems for the same conceptual data** in two places — team season records and player ratings — and in both cases the one shown on the primary public page is the stale/dead one, while the "real" live-fed system surfaces somewhere else (or nowhere). See §7 and §9.

---

## 1. Player profile display

**File:** `src/app/players/[id]/page.tsx` (694 lines), consuming `GET /api/players/[id]`.

**Verdict: WORKS**, with one broken sub-feature inside it (see §2). Handles both sports correctly — `playerSport` detection (`player.team?.sport || 'Football'`, line 128) branches the Quick Stats grid, Season Stats sidebar, and Stats tab between football (goals/assists/cards) and basketball (points/rebounds/assists/steals/blocks) shapes. Multi-sport athlete display (`player.relatedProfiles`, lines 189-219, the `BUG-098`-era feature) renders correctly and links between a player's football/basketball profiles.

**Minor new finding:** `getEventIcon` (line 82) and the History tab's label (line 588, `event.type.replace('_', ' ')`) both use non-global `.replace()` — only the *first* underscore in a multi-word event type is turned into a space. A type like `RED_CARD_SECOND_YELLOW` (if it ever reaches this display, per `BUG-083`'s known normalization gap tracked elsewhere) would render as "RED CARD_SECOND_YELLOW", not "RED CARD SECOND YELLOW". Small, cosmetic, same root family as the already-tracked `BUG-083` taxonomy issue — not re-filed as its own item, noted as a consumer symptom per the brief's ask.

**Backlog cross-reference:** `BUG-098`'s `relatedProfiles` feature confirmed present and working. No entry found for the icon/label `.replace()` non-global bug — flagged as new, low severity.

---

## 2. Player comparison tool — two implementations, only one works

Two genuinely separate comparison UIs exist:

- **`src/app/players/compare/page.tsx`** (525 lines, the dedicated page, reachable via search/nav): **WORKS.** Calls `/api/search?q=...&category=players&limit=10` (correct param name) and reads `data.results?.players` (correct response shape per `src/app/api/search/route.ts`). Full search-both-slots, swap, share (Web Share API + clipboard fallback), and a real comparison summary (better scorer/playmaker/more experienced/higher rated) via `GET /api/players/compare`.

- **`src/app/players/[id]/page.tsx`'s inline "Compare" tab** (lines 52-80, 605-690): **BROKEN.** `searchPlayers` calls `/api/search?q=${query}&type=players&limit=10` — but `src/app/api/search/route.ts:49` reads the category filter from a param literally named `category`, not `type`. Since `type` is not a recognized param, the route falls through to `!category` → true → runs **every** category branch (teams, players, matches, competitions) rather than just players. Worse, the response shape is `{ results: { players: [...] }, total, query, category }` (confirmed by reading the route in full) — but the handler here reads `data.players` directly (line 62), which is always `undefined` on this response shape. `setSearchResults(data.players || [])` therefore **always sets an empty array**, regardless of query or how many real matches exist. A viewer using the "Compare" tab from a player's own profile page (as opposed to navigating to the dedicated `/players/compare` page) can never find a second player to compare against — the search box always returns zero results, with the UI's own "no players found" message displayed for every valid query. Confirmed via direct comparison of the two implementations' fetch calls and response-shape handling; not previously filed anywhere in `BACKLOG.md` (grepped for "type=players", "compare.*search", no hits).

**Backlog cross-reference:** none found. **New finding.**

---

## 3. Player search / filter — no listing page exists

Confirmed via directory listing: `src/app/players/` contains only `[id]/page.tsx` and `compare/page.tsx` — **there is no `src/app/players/page.tsx`.** There is no page anywhere that lets a viewer browse or filter the full player roster as its own destination.

**Consequence, confirmed via grep:** two files link to `/players` expecting a listing page — `src/app/favourites/page.tsx:119` ("Back" link from an empty favourites state) and `src/app/players/compare/page.tsx:222` ("Back to Players" in the compare page's header). Both routes 404 in Next.js App Router (no `page.tsx` at that segment, and no `notFound()`/redirect elsewhere in the tree that would intercept it). A viewer clicking either link lands on the framework's default 404 page.

The only ways a viewer can currently reach a specific player are: search (`/search` or the inline search boxes above), a team's roster tab (`/teams/[id]`), or a direct link from a match/leaderboard. There is no "all players" directory, filterable by sport/position/team, comparable to what `/teams` provides for teams.

**Backlog cross-reference:** none found for either the missing listing page or the two dead `/players` links. **New finding.**

---

## 4. Team profile display

**File:** `src/app/teams/[id]/page.tsx` (779 lines), consuming `GET /api/teams/[id]`.

**Verdict: WORKS for roster/fixtures/activity; season stats are frozen/stale by construction — new, significant finding.** Overview, Players (active squad + "university talent pool" for players not yet on the competition roster), Fixtures, and Stats tabs all render real data with sensible football/basketball branching (PTS vs Goals labels, etc.).

**The "Season Stats" numbers shown on every team profile page (Played/Won/Drawn/Lost/Goals For/Against/Win Rate) can never update once seeded.** Traced `src/app/api/teams/[id]/route.ts:184-217`:
```
const useStoredStats = team.played !== null && team.played !== undefined;
stats.played = useStoredStats ? (team.played ?? 0) : finishedMatches.length;
... (won/drawn/lost/goalsFor/goalsAgainst follow the same pattern)
```
`teams.played`/`won`/`drawn`/`lost`/`goalsFor`/`goalsAgainst`/`points` are real columns on the `teams` table (`src/db/schema.ts:41-47`) with **`default(0)`, not `default(null)`**. Since Drizzle applies that default on every insert, `team.played` is `0`, never `null`, for essentially every real row — meaning `useStoredStats` evaluates `true` in practice for the entire dataset, and the "calculate live from `finishedMatches`" fallback branch is dead code that never actually executes.

**Confirmed via grep across the entire `src/app` tree: nothing ever calls `.update(teams).set({ played: ..., won: ..., goalsFor: ... })` or equivalent.** These seven columns are written only by whatever seed/backfill script populated them once (outside the live app, not in scope to trace further) and then **never updated again by any live code path** — not on match finish, not anywhere. A team's "Season Stats" card on its own profile page is a frozen snapshot from the last time a script touched it, silently drifting further from reality with every match played and finished afterward.

**This is a third, independent storage location for the same conceptual "team record" data**, alongside the `standings` table (§7) and whatever a competition's own bracket/group state tracks — see §7 for why this specific team-profile-page finding is distinct from, and compounds, the already-open `BACKLOG-097`.

**Backlog cross-reference:** none found specifically for the `teams` table columns never being live-updated. Directly relevant to, but a different table than, `BACKLOG-097` (which is about the `standings` table). **New finding.**

---

## 5. Team creation / management (admin)

Already covered in full by `audit_admin_platform_47D.md` §5 — not re-investigated. Summary for cross-reference only: **No Create Team UI** (`BACKLOG-077`, OPEN, confirmed by that audit's read of `admin/teams/page.tsx`), **No Edit Team UI** ("Coming Soon" disabled button, new finding filed there), roster management itself genuinely works. `BACKLOG-077`'s own text was corrected this session to note `POST /api/teams` previously had zero auth check — that specific gap is `BUG-147` territory, and per this session's later commit, has since been fixed (confirmed the route now requires admin, not re-verified in full detail here since it's outside this audit's assigned angle).

---

## 6. Competition structure — brackets, group stages, fixtures display

**File:** `src/app/competitions/page.tsx` (513 lines).

**Verdict: WORKS for display.** Sport-scoped competition selector (BUSA-preferred default), three views (Standings/Matches/Brackets) all wired to real endpoints (`/api/{sport}/standings`, `/api/{sport}/matches`, `/api/brackets`). Matches view includes a calendar/date-filter (`MatchCalendar`) and correctly separates upcoming vs. finished styling. Brackets view renders rounds/matches with team logos, scores, and live-status pulsing — genuinely functional for a fully-populated bracket.

**Admin-side bracket creation has no UI at all** — already found and filed by `audit_admin_platform_47D.md` §4 (new finding there, not re-flagged here): `POST /api/brackets` and `PATCH/DELETE /api/brackets/[id]` exist server-side, but no admin page anywhere calls them. The public bracket viewer above is real and works, but only for brackets seeded/created via direct API or script.

**Backlog cross-reference:** bracket-creation gap already filed by the admin-platform audit; not duplicated here.

---

## 7. Standings / league tables — the biggest finding in this audit

**This audit directly answers `BACKLOG-097`'s own open "Required Audit" — the gap it asked someone to confirm is real, and it is.**

`BACKLOG-097` ("Event Pipeline: No Standings/Points Update on Goal Save," OPEN, filed 2026-06-19) explicitly asks:
1. *"Check `PATCH /api/matches/[id]` — does setting `status: 'FINISHED'` trigger a standings recalculation?"*
2. *"Check `/api/competitions/[id]/standings` — does it recalculate on the fly from match results, or read from a cached table?"*
3. *"Do not build anything until the audit confirms whether the gap is real."*

**Confirmed, definitively, by direct code read and codebase-wide grep:**

- **`standings` is a stored table, never computed live.** `src/app/api/football/standings/route.ts`, `src/app/api/competitions/[id]/standings/route.ts`, and the generic `src/app/api/standings/route.ts` (GET) all do a plain `SELECT ... FROM standings` — none of them derive win/loss/points from the `matches` table at read time.
- **The only writer to the `standings` table anywhere in the entire codebase is `POST /api/standings`** (`src/app/api/standings/route.ts:41-102`), a manual bulk-upsert that accepts whatever numbers are POSTed (no validation against actual match results) and is admin-gated. Grepped every `.ts`/`.tsx` file under `src/app` and `src/lib` for `insert(standings)`/`update(standings)`/`.set(standings` — **zero results outside this one route.**
- **Nothing in the match-finalization path calls it.** Confirmed via the logging-system audit's own read of `src/app/api/matches/[id]/events/route.ts` (the real live event/finalize route) — it calls `broadcastMatchEvent`, `broadcastScoreUpdate`, and `calculateAndSaveRatings()` on finalize-adjacent paths, but never touches `standings`. No cron job or scheduled task found either (checked `.agents/dev/` for any recompute script reference — none).

**Answer to `BACKLOG-097`: the gap is real and total.** A competition's standings table only reflects reality if an admin manually re-POSTs the correct numbers (via `admin/competitions/[id]/page.tsx`'s own POST call, confirmed as one of only two real callers of this endpoint) or a one-off `dev/*.mjs` backfill script runs. There is no automatic recalculation anywhere in the live system when a match finishes. `BACKLOG-097` can be updated from "OPEN, needs audit" to "OPEN, confirmed real, needs a fix" on the strength of this read.

**Compounding this: three parallel, independently-stale sources for what should be one number.** The public `/teams` directory list page pulls its Played/Won/Points figures from `/api/{sport}/standings` (the `standings` table, §above). The public `/teams/[id]` detail page pulls the *same conceptual numbers* from the `teams` table's own `played`/`won`/etc. columns (§4, also frozen, updated by a *different*, unrelated backfill history). **These two pages can show different numbers for the same team**, because they read from two separately-maintained, separately-stale caches with no reconciliation between them. Neither is ever kept in sync with live match results after initial seeding.

**Backlog cross-reference:** `BACKLOG-097` (OPEN) — this audit supplies the confirmation it explicitly asked for. The `teams`-table half of this finding (§4) is not covered by `BACKLOG-097` at all and is new.

---

## 8. Transfer records — display and the write/history gap

**File:** `src/app/transfers/page.tsx` (400 lines), consuming `GET /api/transfers`.

**Verdict: WORKS as a display for what the `transfers` table actually contains** — search, type/status filtering, reliability meter for rumors, from/to team cards with logos, push-notification-triggering on create (admin side). No code defects found in the public page itself.

**Confirms `BACKLOG-126`'s structural finding from the read side, not just the admin/write side already covered by `audit_admin_platform_47D.md` §15.** The `transfers` table this page displays is a standalone announcement log — `POST /api/transfers` (`src/app/api/transfers/route.ts:142-275`) only ever inserts into `transfers`, never touches `player_team_affiliations`. This page can show "Player X: Team A → Team B, Completed" as an announcement while the player's actual roster affiliation (what every other feature — roster display, eligibility, stats attribution — reads) remains unchanged. `BACKLOG-126`'s own text already documents two real BUSA basketball transfers that left zero trace in `player_team_affiliations` despite (presumably) being announced through channels like this one. Confirmed via this session's own read of the same file the admin-platform audit cites — not a new finding, corroboration from the display side.

**`updatePlayerStats()`'s hardcoded `season: '2024'`** (cited in `BACKLOG-126`) was not independently re-verified this session (out of this audit's file list) but is directly relevant: even once a real transfer *is* recorded, next season's stats would still misfile under the wrong season key.

**Backlog cross-reference:** `BACKLOG-126` (OPEN) — corroborated, not duplicated.

---

## 9. Player / team ratings — auto-calculation, MOTM, display, the basketball gap

This sub-feature has the second-largest finding in this audit: **the platform runs two completely disconnected rating pipelines, and the one shown on every player's own profile page is dead.**

**Pipeline A — `players.rating` (the number shown on every player profile, comparison card, and the fan-facing `/xi` Build-Your-XI tool):**
- Schema: `players.rating`, `real('rating').default(7.0)` (`src/db/schema.ts:59`).
- The only code that ever mutates it live is `src/app/api/events/route.ts:236-264`, using a *second*, different `RatingCalculator` class (`src/lib/services/rating-calculator.ts`, exports `calculateRating`/`calculateStatsFromEvents`) than the one used by the real match pipeline.
- **Confirmed via grep: no logger component calls this route.** `FootballLogger.tsx`, `BasketballLogger.tsx`, `TrackLogger.tsx`, and `MatchLoggerUI.tsx` all POST events to `/api/matches/[id]/events` (per `audit_logging_system_47D.md`'s own file list), never to the top-level `/api/events`. The only reference to `/api/events` anywhere outside its own route file is `src/app/api/admin/infrastructure/route.ts`'s endpoint health-check pinger.
- **Conclusion: `players.rating` — the number every viewer actually sees — is not live-updated by any match a logger ever logs today.** It reflects whatever a seed/backfill script set it to, frozen from that point on. This applies identically to football and basketball; the field's staleness is not itself a basketball-specific problem.

**Pipeline B — `playerRatings`/`teamRatings` (match-level, the "real" system):**
- Written by `calculateAndSaveRatings()` (`src/lib/ratingsService.ts`), called from the actual live event route (`src/app/api/matches/[id]/events/route.ts`'s `after()` hook, confirmed via the logging audit) using `RatingCalculator.calculateAutoRating()` (the *first*, different `src/lib/ratingCalculator.ts`).
- **Requires `match.lineups` in football's JSON shape** (`ratingsService.ts:37-41`) — throws `'No lineups found for this match'` otherwise. Basketball never populates this field (its lineup state is local-only per `BACKLOG-141`), so this call **fails on every basketball match, silently swallowed by the `after()` wrapper.** This is `BACKLOG-146`, already filed and confirmed unchanged by the logging-system audit — not re-investigated here except for its downstream, public-facing consequence below.
- **Consumers, confirmed via grep for `playerRatings`/`teamRatings` across `src/app`:** (1) `src/app/admin/match-ratings/[id]/page.tsx` (the admin adjustment tool, already covered by the admin-platform audit), and (2) **`src/app/api/players/stats/leaders/route.ts`'s `type=powerRanking` branch** (lines 19-104) — a genuine public consumer, averaging `COALESCE(finalRating, autoRating)` per player, joined against `matches` for sport/competition filtering, including MOTM-award counting (`SUM(CASE WHEN isMotM = 1 ...)`).

**Where `type=powerRanking` actually surfaces to a viewer, and the basketball-gap symptom the brief asked about:** both `src/app/football/page.tsx` and `src/app/basketball/page.tsx` fetch `?sport={Football|Basketball}&type=powerRanking` for their STATS tab's "Power Ranking" leaderboard card (`football/page.tsx:119`, `basketball/page.tsx:130`). **Confirmed: because `calculateAndSaveRatings()` never succeeds for a single basketball match (per `BACKLOG-146`), zero `playerRatings` rows are ever created for any basketball player — the Basketball hub page's "Power Ranking" card queries a `sport=Basketball`-filtered set that is always empty.** The card itself degrades gracefully in the crash-avoidance sense (`renderLeaderboardCard` just `.map()`s an empty array — no error, no broken layout) but **poorly in the communication sense**: it renders as a normal-looking card with a title and icon and simply zero rows underneath, with no "ratings unavailable for this sport yet" message distinguishing "no data because nothing's been logged this competition" from "no data because this feature is structurally broken for this sport." A viewer has no way to tell those two states apart. Football's own Power Ranking card works correctly (real `playerRatings` rows exist), so this asymmetry is visible side-by-side to anyone comparing the two hub pages.

**Net assessment against the brief's specific question:** the basketball gap does have a real, previously-unverified public-facing symptom (empty Power Ranking card, silent not crashed) — but it is a smaller problem than Pipeline A's finding above, because even *football's* correctly-calculated match ratings never reach the one place most viewers would look for a "rating" (the player's own profile page, `player.rating`) — that number comes from the dead Pipeline A regardless of sport.

**MOTM:** the `isMotM` field is computed/stored (`playerRatings.isMotM`, read in the `powerRanking` aggregation above and adjustable via the admin match-ratings tool) but grepped for any other public rendering of "Man of the Match" anywhere in `src/app`/`src/components` — the only other hit is the unrelated, already-tracked `BACKLOG-127` (`matches.stats.mvp`, a completely different free-text field with no real writer, used by a basketball-specific "MVP leaderboard" API route that nothing currently populates with real data). **MOTM as calculated by the real rating pipeline has no dedicated public display anywhere** beyond its silent contribution to the Power Ranking sort order — no match page badge, no "Man of the Match" callout on a finished match, confirmed via grep for `isMotM`/`MOTM`/`manOfTheMatch` outside the admin tool and this one leaderboard route.

**Backlog cross-reference:** `BACKLOG-146` (OPEN) — confirmed, and this audit adds its concrete public-facing symptom (empty Basketball Power Ranking card) which had not been traced to a viewer-visible effect before. The dead `players.rating` / Pipeline A finding is **new**, not filed anywhere. The two duplicate `RatingCalculator` classes (`src/lib/ratingCalculator.ts` vs `src/lib/services/rating-calculator.ts`) being a live dead-code fork is **new**, in the same family as the logging audit's "three parallel offline-queue implementations" finding — worth a cleanup pass for the same reason (a future engineer could easily wire up the dead one).

---

## 10. Stats leaderboards — correctness and historical data-integrity carryover

**Files:** `src/app/stats/page.tsx` (team stats only, despite the page name — see below), `src/app/football/page.tsx` / `src/app/basketball/page.tsx` (the actual player leaderboards, STATS tab), `src/app/api/players/stats/leaders/route.ts`.

**Naming trap, not a functional bug:** `/stats` (`src/app/stats/page.tsx`) is a **team**-statistics page (Record/Scoring/Performance cards per team, backed by `GET /api/teams/stats`) — it has no player leaderboard content at all, despite being the most obviously-named destination for "stats" in the nav. The actual player leaderboards (goals/assists/points/rebounds/power-ranking) live inside the football/basketball hub pages' STATS tabs instead, not under `/stats`. Confirmed by reading `src/app/stats/page.tsx` in full — no player data fetched anywhere in the file. Worth flagging purely as a discoverability/IA gap, not a broken feature.

**`/api/players/stats/leaders` itself: WORKS, correctly sport-branched** (separate query paths for `powerRanking`, `sport=Basketball` via `basketballPlayerStats`, and generic/football via `playerStats`), with sensible `getHighlightedStat`/`getBasketballHighlightedStat` per-type value extraction. All three branches apply `.limit(limit)` (default 10) — no unbounded-query concern here.

**`BUG-011` (718-goals corruption) carryover:** per `BACKLOG.md` line 790, this is `RESOLVED — WONT FIX (condition no longer exists)`. Not independently re-verified against live data this session (read-only, no DB query tool used) — taking the backlog's own resolution status at face value since re-litigating a WONT-FIX-closed historical data bug was outside this audit's assigned scope. No fresh code path was found this session that would reintroduce the same duplicate-backfill root cause described in the original filing.

**Backlog cross-reference:** `BUG-011` (RESOLVED, not re-verified). No entry found for the `/stats` naming/discoverability gap — new, low-severity.

---

## 11. Squad/lineup builder — three distinct features, not one

The brief's file list (`admin/match-lineups`, `admin/match-ratings`) is already covered in full depth by `audit_admin_platform_47D.md` §10 and §11 (Official Match Lineups: WORKS for football, `BUG-125` confirmed still open for other sports; public `/lineups`: silent-save-failure new finding; match-ratings adjustment tool: WORKS, list-page status badge dead) and `audit_logging_system_47D.md` §1/§9 (basketball has no server-side lineup persistence at all, `BACKLOG-141`/`BUG-139`). Not re-investigated — cited for completeness.

**A third, previously-uncatalogued "build a lineup" feature exists and was in scope for this audit's file list (`src/app/xi/**`):**

**`src/app/xi/page.tsx`** ("Build Your XI") is a **fan-engagement fantasy-team-builder**, unrelated to match officiating — pick a formation (4-4-2/4-3-3/3-5-2), slot in any of the top 100 players fetched from `GET /api/players?limit=100` (no sport/team filter — a viewer could build a "team" mixing football and basketball players, since the picker has no sport-awareness at all, confirmed by reading `fetchPlayers`/`filteredPlayers`, lines 115-182), save via `POST /api/user/xi`. **`src/app/xi/gallery/page.tsx`** displays public saved XIs sorted by recency/likes/views.

This is a real, live, unauthenticated-write feature — **not** one of the Tier 4 backscoped engagement features (`BACKSCOPE.md` covers FPL/predictions/polls/scouts; XI is not among them, confirmed by grep). It already has an open backlog entry: **`BUG-037`** ("POST /api/user/xi Has No Auth Gate," OPEN, LOW priority — `userId` accepted from request body, any caller can attribute an XI to any user). Not part of the `BUG-147` sweep (confirmed by checking that sweep's route list — `/api/user/xi` is not on it).

**New observation on this feature specifically:** the team-rating shown while building (`teamRating`, line 184, average of selected players' `.rating`) reads the same dead `players.rating` field documented in §9 — so a "Build Your XI" team's displayed overall rating is built entirely from frozen, never-live-updated numbers, for both sports indiscriminately.

**Backlog cross-reference:** `BUG-037` (OPEN, auth gap already filed, not re-flagged). The cross-sport-mixing gap in the player picker and its reliance on the dead rating field are **new**, unfiled, low severity given the feature's own Tier-4-adjacent, non-critical nature.

---

## 12. Head-to-head records display

**File:** `src/app/api/head-to-head/route.ts`, consumed by `src/app/matches/[id]/page.tsx` (per the viewer-experience audit's file inventory — not independently re-read here beyond confirming the consumer exists).

**Verdict: WORKS, via a live-computed fallback — but the dedicated `headToHead` table is dead weight.** `GET /api/head-to-head` first checks the stored `headToHead` table; if no row exists, it falls back to `calculateH2HStats()` (lines 208-243), which correctly derives wins/draws/goals from the last 5 finished matches between the two teams on the fly. This fallback is why the feature still functions correctly end to end despite the next finding.

**Confirmed via grep: `POST /api/head-to-head` (the only writer to the `headToHead` table) is never called anywhere in the app** — not by any admin page, not by the match-finalization path, not by any script referenced in the live codebase. The table exists, has a full write API, and is simply never populated by anything in the current system. Every head-to-head record a viewer ever sees today is necessarily the on-the-fly-computed fallback, not the "cached" table the schema and route were clearly designed to use as the primary path.

**Practical consequence:** correct today (fallback covers it), but fragile — the fallback only looks at the **last 5** finished matches (`recentMatches` query, `.limit(5)`), so a head-to-head record between two teams with a long rivalry history would silently show only a recent-form snapshot rather than the true all-time record the dedicated table's schema (`totalMatches`, `team1Wins`, etc.) implies it should track.

**Backlog cross-reference:** none found for the unused `headToHead` write path or the 5-match-cap fallback limitation. **New finding**, though functional impact today is low given the working fallback.

---

## 13. Event taxonomy / data model consistency — consumer-facing symptoms

`SYSTEM_CRITICALITY_MAP.md` already flags the free-text event-type-string taxonomy as "not canonical or exhaustive" at the structural level, and `BUG-083` tracks the primary display-normalization fix elsewhere. Two consumer-facing symptoms specific to this audit's file set, both new:

1. **§1 above** — non-global `.replace('_', ' ')` on `src/app/players/[id]/page.tsx` (icon fallback and history-tab label) would mis-render any multi-underscore event type.
2. **`src/lib/ratingsService.ts`'s stat derivation is keyword-matching on free-text `detail` strings** (`countByDetail('assist')`, `countByDetail('on target')`, etc., lines 86, 94-124) rather than structured fields. Since `detail` is operator-entered free text with no enum, any inconsistent phrasing at logging time (e.g. "Assisted by X" vs "assist: X") would silently under- or over-count that stat category in the auto-rating calculation — this is a direct, concrete illustration of exactly the risk `SYSTEM_CRITICALITY_MAP.md`'s "pre-scale prerequisite" language warns about for "any analytics layer... built on top" of the current taxonomy. The auto-rating system (§9) is precisely such a layer, already built, already running for football.

**Backlog cross-reference:** both are new illustrations of the already-tracked structural gap (`SYSTEM_CRITICALITY_MAP.md`, "Event type taxonomy is not canonical or exhaustive"), not new gaps in their own right — not separately filed.

---

## 14. Additional sub-features found

- **`BUG-039` (Unbounded Teams Query in `/api/basketball/players`) — confirmed still OPEN, and worse than the original filing describes.** `src/app/api/basketball/players/route.ts:13-18` still does `db.select().from(teams).all()` (all 236+ rows) then filters in JS — but the filter isn't even `sport === 'Basketball'` as the backlog's suggested fix implies; it's a **hardcoded array of six team names** (`['TBK', 'Titans', 'Storm', 'Rim Reapers', 'Vikings', 'Siberia']`, line 14-15). Any new basketball team whose name isn't in this literal list (e.g. a newly-onboarded university's team, or a college team created after this list was written) would be silently excluded from this endpoint's results entirely — a correctness bug on top of the already-filed performance one. `BACKLOG.md`'s existing fix suggestion ("replace with `.where(eq(teams.sport, 'Basketball'))`") would fix both problems at once.
- **`enrichPlayersWithAffiliations`/`getPrimaryTeam`/`getResolvedInstitutionalData`** (`src/lib/player-data.ts`, `src/lib/player-affiliation-utils.ts`) are the shared, correctly-reused resolution layer behind `/api/search`, `/api/players/stats/leaders`, and (per `BUG-061`'s already-resolved fix) the football logger's roster picker — this is a positive finding: multi-affiliation/college-vs-team resolution logic is centralized in one place rather than duplicated per-consumer, reducing the risk of a repeat of `BUG-061`'s class of bug in new code that reuses these helpers.
- **`BACKLOG-076`** (basketball college teams / 5-player affiliation gap) — confirmed **RESOLVED** per its own backlog text (2026-06-17), consistent with what this session found; no residual code-level symptom encountered while reading the player/team data paths above.

---

## Inventory Table

| # | Sub-feature | Verdict | Backlog ref | New finding? |
|---|---|---|---|---|
| 1 | Player profile display | WORKS (minor `.replace()` label bug) | `BUG-098` (relatedProfiles, confirmed working) | Minor, new |
| 2 | Player comparison — dedicated `/players/compare` | WORKS | — | No |
| 2 | Player comparison — inline tab on `/players/[id]` | **BROKEN** (wrong param + wrong response-shape read) | Not filed | **Yes** |
| 3 | Player search/filter listing page | **DOESN'T EXIST** (no `/players` index; 2 dead links to it) | Not filed | **Yes** |
| 4 | Team profile — roster/fixtures/activity | WORKS | — | No |
| 4 | Team profile — "Season Stats" numbers | **BROKEN** (frozen `teams` table columns, never live-updated) | Adjacent to `BACKLOG-097`, distinct table | **Yes** |
| 5 | Team creation/management (admin) | DOESN'T EXIST (create) / WORKS (roster) | `BACKLOG-077` (OPEN) | No (see admin-platform audit) |
| 6 | Competition structure display | WORKS | — | No |
| 6 | Bracket creation (admin) | DOESN'T EXIST | Not filed (admin-platform audit) | No (see that audit) |
| 7 | Standings — live recalculation on match finish | **DOESN'T EXIST, confirmed** | `BACKLOG-097` (OPEN — this audit confirms the gap is real) | Confirms existing |
| 7 | Standings — 3 disconnected storage locations | **BROKEN** (teams table vs standings table can disagree) | Extends `BACKLOG-097` | **Yes** |
| 8 | Transfer records display | WORKS (as announcement log) | `BACKLOG-126` (OPEN) | No (corroborates) |
| 9 | Player rating shown on profile (`players.rating`) | **BROKEN/DEAD** (fed only by an unused legacy endpoint) | Not filed | **Yes** |
| 9 | Match-level ratings (`playerRatings`/`teamRatings`) | WORKS for football, BROKEN for basketball | `BACKLOG-146` (OPEN) | Confirms + adds public symptom |
| 9 | Power Ranking leaderboard (public) | WORKS (football), silently empty (basketball) | `BACKLOG-146` | New public symptom |
| 9 | MOTM public display | DOESN'T EXIST beyond leaderboard sort weight | Not filed | **Yes** |
| 10 | Team stats page (`/stats`) | WORKS, misleadingly named (no player data) | Not filed | Minor, new |
| 10 | Player leaderboards (hub pages) | WORKS | — | No |
| 10 | BUG-011 historical corruption | RESOLVED (not re-verified) | `BUG-011` | No |
| 11 | Official match lineups / public lineup builder | See admin-platform + logging audits | `BUG-125`, `BACKLOG-141` | No (cited) |
| 11 | Build Your XI (fantasy team builder) | WORKS, unauthenticated write, cross-sport picker gap | `BUG-037` (OPEN) | Picker gap new |
| 12 | Head-to-head display | WORKS (via live fallback) | Not filed | **Yes** (unused table) |
| 13 | Event taxonomy consumer symptoms | 2 new illustrations of tracked structural gap | `SYSTEM_CRITICALITY_MAP.md` | Illustrative, not new gap |
| 14 | `BUG-039` basketball players full-scan | OPEN, worse than filed (hardcoded name list, not just missing filter) | `BUG-039` | Compounding detail new |
| 14 | Shared affiliation-resolution helpers | WORKS, well-factored | — | No (positive finding) |
| 14 | `BACKLOG-076` college teams | RESOLVED | `BACKLOG-076` | No |
