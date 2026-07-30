# BrixSports — Session 47D/47E Findings, Categorized for Session Picking

Scope: every item filed by the session 47D six-agent audit and session 47E's three
follow-up audits, grouped by theme instead of filing order. Full detail/evidence for
each lives in `.agents/dev/BACKLOG.md` under its own ID — this is an index, not a
replacement. Updated at session 47E's close to reflect final state — everything
shipped this session is marked as such; nothing here is stale as of 2026-07-30.

---

## 🔴 Still-Open, Genuinely Urgent

- **BACKLOG-167** — `/api/players` and `/api/search` leak banned/PII fields (`email`, `profileId`, `memberships`, `organizationAffiliations`) to unauthenticated callers — the same bug already fixed once on the detail route (BUG-098/101), never ported to list/search. CRITICAL, filed session 47E, **not fixed** — real, live, unauthenticated leak, still standing.
- **BACKLOG-168** — Two admin routes (`lineup/unlock`, `livestream`) bypass `getAuthUser()`, trust the JWT role claim directly — a demoted admin's token keeps working there for its full 7-day life. Not fixed.

## ✅ Shipped This Session (pending live-test verification — none of these have been re-tested live yet)

- ~~BACKLOG-141~~ — real server-side basketball lineup persistence (mirrors football's own `/lineup` endpoint).
- ~~BUG-125~~ — admin match-lineups page gated off basketball matches (football-only formation builder).
- ~~BUG-134~~ / ~~BUG-136~~ — basketball foul-out disqualification + blocked re-sub of a fouled-out player.
- ~~BACKLOG-166~~ (partial) — technical-foul split into its own DB column + team-foul tracking (data only, no UI). Sub-finding 3 (competition-level threshold override, needs a schema migration) intentionally still open, flagged for Richard's go-ahead.
- ~~BUG-142~~ — offline queue/retry in full: event POST, period-transition PATCH, undo DELETE, roster-load auto-retry. All four original paths done.
- ~~BUG-135~~ — distinct `OT2`+ period tracking (`otNumber` state, `OT${n}` labels).
- ~~BACKLOG-146~~ — superseded: original blocker (no basketball lineups) resolved as a side effect of BACKLOG-141, which exposed a bigger issue (ratings stat-extraction is 100% football-shaped) — guarded off rather than left to silently compute wrong ratings. Real fix tracked under BACKLOG-159.
- ~~BACKLOG-143~~ — box-score `ast` stat now counts standalone Assist-button events, not just embedded `assistPlayerId`.
- ~~BUG-137~~ — `SocketProvider` manual-retry timeout now actually cancelled on unmount (was a real leak — flag could get stuck permanently blocking future retry loops).
- ~~BACKLOG-155~~ — real feature-flag gating built and wired (Ads/User Management/News/Transfers admin panels). Lineup Builder deliberately left ungated (Richard's call — one of only two real ways a lineup gets persisted).
- ~~BACKLOG-182~~ — bulk-register dedup check scoped to the target team, not the whole `players` table — was silently capable of dropping a brand-new player on a name collision. CRITICAL, found and fixed same session ahead of Saturday's new-team registration.

## 🏀 Basketball Parity / Logging Core — remaining open

- **BACKLOG-166** (sub-finding 3 only) — competition-level foul-threshold override, needs a `competitionSportSettings` schema migration. Deliberately not started.
- **BACKLOG-151** — Multi-logger sync is poll-only; real-time broadcast and conflict resolution are both no-ops.
- **BUG-151** — No server-side event dedup/idempotency check exists at all (either sport).
- **BACKLOG-152** — Track & Field logger has zero persistence layer.
- **BACKLOG-153** — Admin match-edit modal has no score-correction fields; three dead offline-queue implementations found; other logging-system cleanup.

## 🔐 Auth / Identity Architecture

- **BUG-148** — Google OAuth sign-in completely broken (missing callback route, dead parallel NextAuth implementation).
- **BACKLOG-162** — Dead favourites page (100% mock data), two competing `useAuth` hooks, wrong-key `localStorage` cleanup.
- **BACKLOG-184** — Football's in-app lineup editor bypasses the admin page's own publish-lock/unlock RBAC — two lineup-editing surfaces enforce different rules for the same data. Filed session 47E (previously flagged mid-session, filing was deferred and is now done).
- Carried from earlier sessions: **BUG-128** (shared unscoped `authToken` cookie across roles — no priv-esc risk, real identity bleed), **BACKLOG-094** (JWT_SECRET rotation decision still waiting on Richard), **BACKLOG-140** (loggers-as-separate-table architecture critique).

## 🔒 Production Discipline / Security

- **BACKLOG-167** / **BACKLOG-168** — see "Still-Open, Genuinely Urgent" above.
- **BACKLOG-169** — `limit` query param unclamped in 14+ list routes.
- **BACKLOG-170** — Raw `error.message` returned to the client in 4 routes, one (`news` GET) fully public.
- **BACKLOG-171** — Public matches list embeds full event history on the Flow C hot path.
- **BACKLOG-172** — Three N+1 query patterns, one on the public livescore hot path.
- **BACKLOG-173** — Zero `Cache-Control`/ISR anywhere in the API or page layer.
- **BACKLOG-174** — Block-list DTO shaping is fragile.
- **BACKLOG-175** — `GET /api/universities` has no `.limit()` at all.
- **BACKLOG-176** — `cloudinary/sign` reads `process.env` directly instead of `src/lib/env.ts`.
- **BACKLOG-179** — `POST /api/teams` has zero NOT NULL validation, would 500 on any real caller (no live caller today).
- **BACKLOG-181** — Unbounded `players` table scan in `/api/competitions/[id]/eligible-players` (not on the live-logging hot path).

## ⚙️ Match/Competition Config Coupling (new theme, session 47E — genuinely not wired end-to-end)

- **BACKLOG-178** — Lineup persistence API has no server-side cross-check against competition `playersPerSide`. Write-side of this gap.
- **BACKLOG-183** — Admin match-lineups page hardcodes `playersPerSide: 11` for any friendly (a 5-a-side friendly has no way to configure correctly). Read-side of the same gap.
- **BACKLOG-180** — Match-creation form defaults `competitionLevel` to `'busa-league'` even for friendlies, no UI control (currently mitigated by two independent enforced paths elsewhere, not urgent).
- These three share one real root cause: match/competition config (`/api/matches/[id]/config`) is the correct source of truth and resolves things correctly, but neither the admin lineup UI, the lineup-write API, nor the match-creation form actually reads from it consistently. A coherent single fix should wire all three against that one source, not three independent patches.
- **BACKLOG-177** — Predictions/Polls/FPL feature flags remain equally inert (same bug BACKLOG-155 fixed for the 5 High-Volatility flags) — not on the gating-checklist, deliberately not wired this session.

## 👀 Public Viewer Experience

- **BUG-150** — Anonymous viewers cannot enable push notifications through any reachable UI path.
- **BUG-152** — Match-detail page's own favourite heart doesn't persist at all (a third, divergent implementation).
- **BACKLOG-154** — Status-styling/timeline-rendering/dead-component consistency debt.
- **BACKLOG-157** — Public Lineup Builder (`/lineups`) silently swallows save failures for non-admin/logger users (confirmed this session: it's not actually a second way to set real lineups, same gated API, silent 401/403).
- **BACKLOG-159** — `players.rating` is a dead field — two disconnected rating pipelines.
- **BACKLOG-160** — Player discovery gaps: broken inline Compare tab, no player listing page.
- **BACKLOG-161** — Minor data/discoverability bundle.

## 🛠️ Admin Platform

- **BACKLOG-156** — Admin dashboards present placeholder/fabricated data as real, unlabeled.
- **BACKLOG-158** — Admin CRUD completeness gaps + minor dead UI.

## 📅 Season Transition / Hardcodes

- **BACKLOG-163** — Homepage round-grouping fallback hardcodes the 2025-26 season's calendar.
- **BACKLOG-164** — Admin "Create Competition" form defaults to `season: '2024/2025'`.
- **BACKLOG-165** — Pre-existing `tsc` error (`teamId` undefined) in the admin match-lineups publish route.
- Already covered, no new filing needed: the transfer/roster-history gap is real but already fully captured by **BACKLOG-126**/**BACKLOG-049**.

---

## How to use this for session picking

BACKLOG-167 (unauthenticated PII leak) is the single most urgent unaddressed item
in this whole index — genuinely live, genuinely unauthenticated, not gated by
anything. Everything shipped this session (the large ✅ block above) still needs a
real live-test pass before it can move from SHIPPED to RESOLVED — that's the
natural next-session starting point alongside BACKLOG-167. The Match/Competition
Config Coupling theme (BACKLOG-178/180/183) is newly identified and worth treating
as one coherent fix rather than three, whenever it's picked up.
