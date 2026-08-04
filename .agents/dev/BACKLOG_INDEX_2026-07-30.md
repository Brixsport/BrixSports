# BrixSports — Session 47D/47E Findings, Categorized for Session Picking

Scope: every item filed by the session 47D six-agent audit and session 47E's three
follow-up audits, grouped by theme instead of filing order. Full detail/evidence for
each lives in `.agents/dev/BACKLOG.md` under its own ID — this is an index, not a
replacement. Originally updated at session 47E's close.

**Correction, session 47F:** the "nothing here is stale" claim above did not survive
one more session — an audit agent caught `BACKLOG-167`/`168`/`178`/`180`/`183`/`177`
all showing outdated status below after session 47F shipped fixes for them. Corrected
in place, session 47F, then corrected a second time the same session once
`BACKLOG-167`/`168`/`178`/`183` were live-tested against a Vercel preview and moved
to RESOLVED (`180` stays SHIPPED — it's a pure client-side form default with no API
surface to live-test the way the others were). New items filed session 47F
(`BACKLOG-185`, `-186`, `BUG-187`) are out of this index's original scope (47D/47E
only) and are not added here — see `BACKLOG.md` directly for those. Lesson learned,
logged in `known-issues.md`: this index is a live document that goes stale the
moment anything it describes changes, not something to write once and trust.

---

## 🔴 Still-Open, Genuinely Urgent

- ~~**BACKLOG-167**~~ — `/api/players` and `/api/search` leak banned/PII fields (`email`, `profileId`, `memberships`, `organizationAffiliations`) to unauthenticated callers — the same bug already fixed once on the detail route (BUG-098/101), never ported to list/search. CRITICAL, filed session 47E, **RESOLVED session 47F** — live-tested against a Vercel preview.
- ~~**BACKLOG-168**~~ — Two admin routes (`lineup/unlock`, `livestream`) bypass `getAuthUser()`, trust the JWT role claim directly — a demoted admin's token keeps working there for its full 7-day life. **RESOLVED session 47F** — live-tested.

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

## ⚙️ Match/Competition Config Coupling (new theme, session 47E — RESOLVED session 47F)

- ~~**BACKLOG-178**~~ — Lineup persistence API has no server-side cross-check against competition `playersPerSide`. Write-side of this gap. **RESOLVED session 47F**, live-tested against a Vercel preview.
- ~~**BACKLOG-183**~~ — Admin match-lineups page hardcodes `playersPerSide: 11` for any friendly (a 5-a-side friendly has no way to configure correctly). Read-side of the same gap. **RESOLVED session 47F** — server endpoint live-tested; admin page's own browser fetch not separately click-tested, noted in `BACKLOG.md`.
- ~~**BACKLOG-180**~~ — Match-creation form defaults `competitionLevel` to `'busa-league'` even for friendlies, no UI control. **SHIPPED session 47F** — pure client-side form default, no API surface to live-test the way the others were; still needs a browser click-through.
- Fixed together session 47F: extracted the three-layer config merge into a shared `src/lib/matchConfig.ts`, generalized to detect custom "N-a-side" formats from sport/competition text. Both the admin lineup UI and the lineup-publish route (the real enforcement point, not the draft-save route) now read `playersPerSide` from that one source. Bonus find: `lineup/publish/route.ts` had zero server-side auth — filed and fixed as `BUG-187` in the same pass.
- ~~**BACKLOG-177**~~ — Predictions/Polls/FPL feature flags remain equally inert (same bug BACKLOG-155 fixed for the 5 High-Volatility flags). **Closed WONT FIX session 47F** — investigated and found moot: those pages already `return notFound()` unconditionally per `BACKSCOPE.md`, nothing live exists for a flag to gate.

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

**Session 47F update:** BACKLOG-167/168/178/183 are now RESOLVED, live-tested against
a Vercel preview deployment — see the corrected sections above. BACKLOG-180 is
SHIPPED but not RESOLVED (pure client-side form default, no API surface to have
live-tested it against). Nothing in this index is genuinely open-and-urgent
anymore as of session 47F; the real next-session starting point is a live-test
pass across everything still sitting at SHIPPED (this index's 47D/47E "✅ Shipped
This Session" block below, plus session 47F's own additions, tracked directly in
`BACKLOG.md` since they're out of this index's original scope) — none of it can
move to RESOLVED without one.
