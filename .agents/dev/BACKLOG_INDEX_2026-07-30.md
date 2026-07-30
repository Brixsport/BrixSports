# BrixSports — Session 47D/47E Findings, Categorized for Session Picking

Scope: every OPEN item filed by the session 47D six-agent audit and session 47E's
two follow-up audits, grouped by theme instead of filing order. Full detail/evidence
for each lives in `.agents/dev/BACKLOG.md` under its own ID — this is an index, not
a replacement. RESOLVED/SHIPPED items from the same audits (BUG-149/153/154, etc.)
are already closed out and not repeated here.

Session 47E's second background audit (API payload size, PII/sensitive-field
discipline, caching strategy, cross-route convention consistency) has landed —
folded in below under "Production Discipline / Security."

Also updated: BUG-134 and BUG-136 shipped this session (minimal scope — foul-out
disqualification + blocking re-sub of a fouled-out player). Full scope (team-foul
bonus, technical-foul miscounting, competition-level threshold override) split out
to BACKLOG-166.

---

## 🔴 Pre-Prod Blocker (do this before any real public match day)

- **BACKLOG-155** — Admin feature flags are fully inert (read nowhere else in the codebase). CLAUDE.md's own Live Event Readiness Checklist requires all 🔴 high-volatility features (Ads, Lineup Builder, Transfers, User Management, News, `/api/auth/test`) gated/hidden before going live — there is currently **no working mechanism to do that at all**. Confirmed the single most concrete unstarted item standing in the checklist's way.
- **BACKLOG-167** — `/api/players` and `/api/search` leak banned/PII fields (`email`, `profileId`, `memberships`, `organizationAffiliations`) to unauthenticated callers — the same bug already fixed once on the detail route (BUG-098/101), never ported to list/search. CRITICAL — real, live, unauthenticated leak.

## 🔒 Production Discipline / Security (session 47E, second audit)

- **BACKLOG-167** — (see Pre-Prod Blocker above)
- **BACKLOG-168** — Two admin routes (`lineup/unlock`, `livestream`) bypass `getAuthUser()`, trust the JWT role claim directly — a demoted admin's token keeps working there for its full 7-day life.
- **BACKLOG-169** — `limit` query param unclamped in 14+ list routes — technically has `.limit()`, but caller-controlled with no ceiling.
- **BACKLOG-170** — Raw `error.message` returned to the client in 4 routes, one (`news` GET) fully public.
- **BACKLOG-171** — Public matches list embeds full event history (up to 200/match × 50 matches) on the Flow C hot path.
- **BACKLOG-172** — Three N+1 query patterns, one on the public livescore hot path.
- **BACKLOG-173** — Zero `Cache-Control`/ISR anywhere in the API or page layer (findings only, no fix designed).
- **BACKLOG-174** — Block-list DTO shaping is fragile — new sensitive columns leak by default unless manually excluded.
- **BACKLOG-175** — `GET /api/universities` has no `.limit()` at all.
- **BACKLOG-176** — `cloudinary/sign` reads `process.env` directly instead of `src/lib/env.ts`.

## 🏀 Basketball Parity / Logging Core

- **BACKLOG-151** — Multi-logger sync is poll-only; real-time broadcast and conflict resolution are both no-ops.
- **BUG-151** — No server-side event dedup/idempotency check exists at all (either sport).
- **BACKLOG-152** — Track & Field logger has zero persistence layer — confirmed worse than assumed.
- **BACKLOG-153** — Admin match-edit modal has no score-correction fields; three dead offline-queue implementations found; other logging-system cleanup.
- **BACKLOG-166** — Basketball foul system, remaining scope: team-foul bonus tracking, technical-foul miscounting into `personalFouls`, competition-level threshold override. Split out when BUG-134 shipped minimal-only.
- (Not yet filed, folding in at session close per Richard: football's in-app lineup editor bypasses the admin page's own publish-lock/unlock RBAC — two lineup-editing surfaces enforce different rules.)
- ~~BUG-134~~ / ~~BUG-136~~ — SHIPPED session 47E (foul-out disqualification + blocked re-sub), pending live test.
- ~~BUG-142~~ — SHIPPED (partial) session 47E: event-POST offline queue ported from football, shared module extracted (`src/lib/admin-offline-queue.ts`). Remaining scope (period-transition PATCH, undo DELETE, roster-load retry) still open, same entry.
- ~~BUG-135~~ — SHIPPED session 47E: distinct `otNumber` tracking, `OT${n}` period labels, live-clock consumers updated to match on OT-prefix.
- Basketball parity pile from tonight is now fully worked through (BACKLOG-141, BUG-125, BUG-134/136, BUG-142 partial, BUG-135 all shipped) — remaining open items are BACKLOG-166 (foul system full scope) and BUG-142's remaining write paths.

## 🔐 Auth / Identity Architecture

- **BUG-148** — Google OAuth sign-in completely broken (missing callback route, dead parallel NextAuth implementation).
- **BACKLOG-162** — Dead favourites page (100% mock data), two competing `useAuth` hooks, wrong-key `localStorage` cleanup.
- Carried from earlier sessions: **BUG-128** (shared unscoped `authToken` cookie across roles — no priv-esc risk, but real identity bleed), **BACKLOG-094** (JWT_SECRET rotation decision still waiting on Richard), **BACKLOG-140** (loggers-as-separate-table architecture critique).

## 👀 Public Viewer Experience

- **BUG-150** — Anonymous viewers cannot enable push notifications through any reachable UI path.
- **BUG-152** — Match-detail page's own favourite heart doesn't persist at all (a third, divergent implementation from `useFavorites`/`BUG-091`).
- **BACKLOG-154** — Status-styling/timeline-rendering/dead-component consistency debt (4 separate live-status implementations, 3 separate timeline renderers).
- **BACKLOG-157** — Public Lineup Builder (`/lineups`) silently swallows save failures for non-admin/logger users.
- **BACKLOG-159** — `players.rating` (shown on every profile) is a dead field — two disconnected rating pipelines, neither reaching the field viewers actually see.
- **BACKLOG-160** — Player discovery gaps: broken inline Compare tab, no player listing page, two dead `/players` links.
- **BACKLOG-161** — Minor data/discoverability bundle (dead `headToHead` write path, `/stats` naming mismatch, `/xi` has no sport-awareness).

## 🛠️ Admin Platform

- **BACKLOG-155** — (see Pre-Prod Blocker above)
- **BACKLOG-156** — Admin dashboards present placeholder/fabricated data as real, unlabeled (fake "ratings published" badge, fake CPU/disk/error metrics on the infra dashboard).
- **BACKLOG-158** — Admin CRUD completeness gaps + minor dead UI (orgs/track-events can't be edited, notifications hub oversells itself, orphaned push-diagnostics page).

## 📅 Season Transition / Hardcodes (session 47E)

- **BACKLOG-163** — Homepage round-grouping fallback hardcodes the 2025-26 season's calendar (`page.tsx:278-295`) — degrades silently, doesn't crash, once the anchor date goes stale.
- **BACKLOG-164** — Admin "Create Competition" form defaults to `season: '2024/2025'` in two files.
- **BACKLOG-165** — Pre-existing `tsc` error (`teamId` undefined) in the admin match-lineups publish route — same class BUG-154 flagged as worth a deliberate sweep rather than baseline noise.
- Already covered, no new filing needed: the transfer/roster-history gap Richard asked about is real but already fully captured by **BACKLOG-126** (no working transfer tracking) and **BACKLOG-049** (seasonal affiliations schema) — confirmed via this session's audit, not re-filed.

---

## How to use this for session picking

Each category above is roughly one dedicated session's worth of work. Pre-Prod
Blocker is the one item with an explicit checklist dependency (CLAUDE.md) — everything
else is real debt but not gating a single test match. Basketball Parity is the
biggest pile and the one already in progress this session (BACKLOG-141/BUG-125 done
tonight; BUG-134/142/135/136 still open).
