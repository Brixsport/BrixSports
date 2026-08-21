# BrixSports — Backscope Journal

Track of all features removed from public navigation.
Nothing is deleted — only hidden. Every entry documents current state,
what exists in code, and reinstatement criteria.

Grep for `BACKSCOPED: 2026-06-08` to find all comment-out markers in source.

---

## /fpl/* — Fantasy Premier League

**Backscoped:** 2026-06-08
**Backlog ref:** BACKLOG-028
**Current state:** NOT BUILT — schema + API routes exist, all FPL DB tables are empty, no real data, UI is scaffold only

**What exists in code:**
- `src/app/fpl/page.tsx` — now returns `notFound()`
- `src/app/fpl/create-team/page.tsx` — now returns `notFound()`
- `src/app/fpl/leagues/page.tsx` — now returns `notFound()`
- `src/app/fpl/team/page.tsx` — now returns `notFound()`
- `src/app/fpl/transfers/page.tsx` — now returns `notFound()`
- `src/app/api/fpl/leagues/join/route.ts`
- `src/app/api/fpl/leagues/route.ts`
- `src/app/api/fpl/players/route.ts`
- `src/app/api/fpl/teams/route.ts`
- `src/app/api/fpl/transfers/route.ts`

**What's missing to reinstate:**
- Full FPL feature design + build (Phase 7)
- Data pipeline for gameweeks, player scoring, captain logic
- Admin interface for gameweek management
- Integration with real player performance data

**Reinstate when:** Phase 7 revenue/engagement feature sprint begins
**Risk if reinstated early:** Empty pages, broken UX, no data to display

**Gap found session 47D (`BUG-147` investigation, same shape as the predictions/polls entries below):** all five FPL API routes are live and unauthenticated — `POST /api/fpl/teams` takes `userId` directly from the request body with no verification it belongs to the caller. Low real-world risk (no UI surfaces any of them), not fixed per the standing Tier 4 rule, noted here so it isn't forgotten when Phase 7 picks this back up.

---

## /predictions — Match Predictions

**Backscoped:** 2026-06-08
**Backlog ref:** BACKLOG-028
**Current state:** NOT BUILT — schema + API routes exist, but feature was never connected to real match data or user accounts in a functional way

**What exists in code:**
- `src/app/predictions/page.tsx` — now returns `notFound()`
- `src/app/api/predictions/route.ts`
- `src/app/api/predictions/leaderboard/route.ts`
- `src/app/api/predictions/stats/route.ts`
- `src/components/predictions/MatchPredictionCard.tsx`
- `src/components/predictions/MatchVotePoll.tsx`

**UI surfaces removed:**
- Profile page "My Predictions" QuickActionButton (`src/app/profile/page.tsx`)
- Predictions tab in match detail page (`src/app/matches/[id]/page.tsx`)
- Predict tab in MatchOverlay (`src/components/MatchOverlay.tsx`)
- Prediction/Poll tab block in UpcomingMatchView (`src/components/matches/UpcomingMatchView.tsx`)
- Predict + Fan Poll tabs in BasketballMatchOverlay (`src/components/BasketballMatchOverlay.tsx`)
- Sitemap entry (`src/app/sitemap.ts`)

**What's missing to reinstate:**
- Full predictions feature build (Phase 7)
- Verified user auth integration for score submissions
- Leaderboard and accuracy tracking
- Points system design

**Reinstate when:** Phase 7 engagement feature sprint begins
**Risk if reinstated early:** Auth not wired for submissions, leaderboard broken, confusing UX

**Gap found session 47D (`BUG-147` investigation):** the page is correctly `notFound()`'d, but `src/app/api/predictions/route.ts` (POST/PUT) is live and has zero auth — a caller who finds the route directly can still write to `matchPredictions`. Low real-world risk (no UI surfaces it, no organic traffic would discover it), but "backscoped" only holds at the page layer, not the API layer. Not fixed — Tier 4 standing rule (nothing here gets session time while Tier 0-3 gaps exist) — noted here rather than filed as its own bug so it isn't silently forgotten when Phase 7 eventually picks this up.

---

## /scouts — Scout Reports

**Backscoped:** 2026-06-08 (was already dead before this session)
**Backlog ref:** BACKLOG-028
**Current state:** DEAD — page returns `notFound()`. No API routes exist anywhere under `/api/scouts/**` (confirmed by glob, zero matches). No DB tables.

**What exists in code:**
- `src/app/scouts/page.tsx` — `notFound()` (**correction, session 47D**: this entry previously described a "redirect to `/`" — the mechanism was changed to match the other Tier 4 pages' `notFound()` convention at some point without this entry being updated; functionally equivalent, no user-facing difference)

**No pending security/auth issues to track here** — unlike FPL/Predictions/Polls, there's no API surface at all for this feature, so there's nothing to gate before it's eventually built.

**What's missing to reinstate:**
- Full scout/talent hub feature design + build
- Scout profile system
- Player rating submission by scouts

**Reinstate when:** Talent Hub feature scope defined
**Risk if reinstated early:** N/A — page is already a no-op redirect

---

## /nesa-registration — NESA Event Registration

**Backscoped:** 2026-06-08
**Backlog ref:** BACKLOG-028
**Current state:** NOT BUILT — page exists as a multi-step registration form UI, but has no API handler, no DB writes, schema has broken FK references

**What exists in code:**
- `src/app/nesa-registration/page.tsx` — now returns `notFound()`
- `src/db/schema-nesa-registrations.ts` — defines 4 tables (nesaRegistrations, nesaTrackEntries, nesaEsportsEntries, nesaTeamRegistrations)
- `src/db/add-nesa-inter-school-festival.ts` — seeding script

**What's missing to reinstate:**
- Complete API route for form submission
- FK validation and schema integrity check
- Admin review interface for submitted registrations
- Email confirmation flow

**Reinstate when:** NESA event is planned and full build is scoped
**Risk if reinstated early:** Form submits to nothing, data is lost, broken FK constraints would cause 500s

**No pending security/auth issues to track here** — session 47D confirmed zero `/api/nesa-registration/**` routes exist at all (matches this entry as already written); nothing to gate before it's eventually built.

---

## /auth/signin — NextAuth Google OAuth Sign-In

**Backscoped:** 2026-06-08
**Backlog ref:** BACKLOG-028
**Current state:** DEAD — vestigial next-auth OAuth route. Google OAuth was never configured in production. Conflicts with canonical auth at `/login` (custom JWT).

**What exists in code:**
- `src/app/auth/signin/page.tsx` — now returns `notFound()`
- `src/app/api/auth/[...nextauth]/route.ts` — still present (NextAuth config itself)

**Canonical login:** `/login` (custom JWT flow via `src/app/login/page.tsx`)

**What's missing to reinstate:**
- Google OAuth credentials configured in env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- Decision to run NextAuth alongside or replace custom JWT auth
- Session bridge between NextAuth sessions and existing JWT session model

**Reinstate when:** BACKLOG-009 (next-auth removal or full integration) is resolved
**Risk if reinstated early:** Two competing auth systems, session conflicts, security audit needed

---

## Polls UI — MatchPoll / MatchPollEnhanced / CreatePoll

**Backscoped:** 2026-06-08
**Backlog ref:** BACKLOG-028
**Current state:** DEAD — polls DB tables exist in schema, API routes exist, but no polls have ever been created in production. Feature was never launched.

**What exists in code:**
- `src/components/MatchPoll.tsx`
- `src/components/MatchPollEnhanced.tsx`
- `src/components/CreatePoll.tsx`
- `src/components/PollComments.tsx`
- `src/components/predictions/MatchVotePoll.tsx`
- `src/app/api/polls/route.ts`
- `src/app/api/polls/vote/route.ts`
- `src/app/api/polls/comments/route.ts`
- `src/app/api/polls/comments/like/route.ts`
- DB: `polls`, `pollVotes`, `pollComments` tables in `src/db/schema.ts`

**UI surfaces removed:**
- Polls tab in match detail page (`src/app/matches/[id]/page.tsx`)
- Poll tab in MatchOverlay (`src/components/MatchOverlay.tsx`)
- UpcomingMatchView prediction/poll tabs (`src/components/matches/UpcomingMatchView.tsx`)
- BasketballMatchOverlay fan poll tab (`src/components/BasketballMatchOverlay.tsx`)

**What's missing to reinstate:**
- Admin interface for creating and managing polls
- Polls must be created before they can appear — currently zero rows in `polls` table
- Decision on poll lifecycle (per match, global, timed)
- Moderation flow for poll comments

**Reinstate when:** Phase 7 engagement sprint — requires admin poll creation tool first
**Risk if reinstated early:** Components render empty states or error silently, no polls exist in DB

**Gap found session 47D (`BUG-147` investigation):** same shape as the predictions entry above — `src/app/api/polls/route.ts` (POST/PATCH) is live and unauthenticated, `createdBy` optional and taken from the request body. Low real-world risk, not fixed per the standing Tier 4 rule, noted here for whenever this feature is picked back up.

---

## User-Selectable Push Notification Preferences — BACKLOG-103

**Backscoped:** 2026-06-25
**Backlog ref:** BACKLOG-103
**Current state:** NOT BUILT — push notifications fire for all event types (GOAL, RED_CARD, YELLOW_CARD, HALF_TIME, MATCH_END) with no user control. Friendly matches also send notifications (intentional for now).

**What exists in code:**
- `src/app/api/notifications/match-event/route.ts` — dispatches notifications, no preference check
- `src/lib/notifications/match-notification-service.ts` — sends to all subscribers unconditionally

**What's missing to build this:**
- User preference model (per event type: goals only / all / match start+end only)
- DB table or column to store preferences per user (or per followed team)
- Filter logic in `match-notification-service.ts` before dispatch
- UI in profile/settings for user to configure preferences

**Reinstate when:** Notification infrastructure is stable, user count justifies the complexity, and engagement phase begins
**Risk if reinstated early:** Preference model adds complexity to an already-volatile notification pipeline

---

## Admin-Designated Primary Logger UI — single-writer enforcement (BUG-120/criticality map §5)

**Backscoped:** 2026-07-15 (session 44)
**Backlog ref:** BACKLOG (single-writer enforcement, `SYSTEM_CRITICALITY_MAP.md` §5, `LIVE_CLOCK_V2_ARCHITECTURE.md` §5)
**Current state:** NOT BUILT — never had UI, never had backend enforcement logic. Considered and explicitly not chosen as the mechanism for resolving which logger's `match:time:update` broadcasts win when two loggers are on the same match.

**What this would have been:** an admin-facing control letting an admin explicitly designate exactly one logger as `role: 'primary'` for a given match (promoting one auto-demotes any existing primary), with the WS server enforcing that only the primary's `match:time:update` emits get relayed to viewers. The schema already has the field this needs (`matchLoggerAssignments.role`, defaults `'primary'`) — but both write paths that create assignments (`POST /api/matches/[id]/assign-logger`, the admin UI's `assignLogger()`) hardcode `role: 'primary'` unconditionally, so today every simultaneously-active logger on a match has the same role value — it doesn't actually distinguish anyone.

**Why not chosen:** single-writer enforcement was scoped to solve a narrow, real problem (two loggers' clocks flickering against each other) with the smallest correct mechanism — a session-based "first logger to emit `match:time:update` for this match wins, until they disconnect" rule needs zero new UI, zero new admin workflow, and zero decision burden on the admin during a live match (the scenario this is meant to protect is already stressful; requiring an admin to notice two loggers connected and manually pick one adds a step that a live match day realistically won't have spare attention for). The admin-UI version is more correct in the sense of being an explicit, auditable decision, but it's real additional scope — new endpoint/UI, promotion/demotion logic, and a real design question about what happens to the demoted logger's own local clock display — for a problem the simpler rule already resolves adequately.

**What's missing to reinstate:**
- Admin UI control (match management page) to view current primary logger and reassign it
- Backend enforcement: promoting one assignment to primary must atomically demote any other `active`+`primary` row for the same match (currently nothing prevents two simultaneous primaries)
- Decision on what the demoted logger's own client should show/do
- `ws-server` (or the REST callback it uses) needs to read the *current* primary at whatever cadence keeps it correct if an admin changes it mid-match, not just once at connect time

**Reinstate when:** the session-based tie-break rule proves insufficient in real multi-logger use (e.g. a real need to let an admin deliberately override which logger has the clock, not just accept whoever connected first)
**Risk if reinstated early:** scope/complexity not justified by a problem that hasn't been observed yet — the simpler rule is unverified in real multi-logger conditions too (no dual-logger test has ever been run on this platform), so building the more complex version first would be solving a problem before confirming the simple version doesn't already handle it

---

## Basketball + Track live logging — write-path gaps, deferred pending shared logger module

**Backscoped:** 2026-07-21 (session 45)
**Backlog ref:** BACKLOG-125
**Current state:** NOT SAFE FOR A LIVE MATCH — `BasketballLogger.tsx` persists events but not the match score or period/quarter; `TrackLogger.tsx` persists nothing at all. Basketball/track *display*, historical data, and player pages are unaffected — this is specifically about the live-logging write path for these two sports.

**What was found (code-read, session 45, before any live test — see `BACKLOG-125` for full detail):**
- `BasketballLogger.tsx`'s match-level score never reaches the DB: the server's `isScoringEvent` check (`events/route.ts`) only recognizes football's `GOAL`/`PENALTY`/`OWN_GOAL` type strings, so the atomic score-increment path never fires for `FIELD_GOAL`/`THREE_POINTER`/`FREE_THROW`; and the one PATCH that does try to write `homeScore`/`awayScore` at finalize is sent as a `logger`-role request, which the server silently drops (score writes are admin-only, BUG-052).
- Basketball's quarter/period transitions are never persisted to the DB at all — the same bug class as football's already-fixed TD-010, whose fix (an explicit PATCH per period-transition button) was never ported over.
- The natural "End Quarter 4 → Finalize Match" UI path in `BasketballLogger.tsx` doesn't call the real, persisting `finalizeMatch()` function at all, and once it runs, the real Finalize button (gated on the same local state this path sets) becomes unreachable — a genuine dead end reachable via the logger's own intended flow, not an edge case.
- `TrackLogger.tsx` has zero `fetch()` calls anywhere in the file — no event, score, or result of any kind is ever sent to the server. It's a fully local UI.
- Basketball's event logging (`match_events` insert + broadcast) and player stats (`basketballPlayerStats`) share football's exact code path and look structurally sound, just never exercised live (0 rows recorded so far).

**Why not fixed in place this session:** each sport's logger duplicates football's event/score/period/finalize logic in its own file rather than sharing it, so patching basketball's specific gaps directly risks producing a second, subtly different implementation of logic that's already been hardened through many rounds of live-tested bug fixes in `FootballLogger.tsx` (BUG-052, BUG-121, TD-010, BUG-076, and others). Doing that under time pressure, without a live test cycle of its own, is how a regression gets introduced into the one part of this platform that's actually proven solid. The properly-scoped fix is a shared logger core (event persistence, atomic score updates recognizing each sport's own scoring event types, period-transition PATCHes, a finalize path that can't become unreachable) that all three sport loggers consume — not three more one-off patches.

**What's missing to reinstate (i.e. to make basketball/track logging safe for a real live match):**
- Design + extract a shared logger module (or hook) covering: event persistence, score persistence (needs a sport-aware `isScoringEvent`, not football's hardcoded type list), period/quarter persistence, and a finalize path that always reaches the server regardless of which UI button triggered it
- Port `FootballLogger.tsx` to the shared module first and re-verify all three Critical Flows still hold (it's the one sport with a real live-test track record — regressing it would be worse than basketball/track staying broken)
- Port `BasketballLogger.tsx`, then live-test a full match end-to-end (score updates publicly in real time, quarter survives a refresh, finalize actually reaches `FINISHED` with the correct score)
- Build `TrackLogger.tsx`'s persistence layer from scratch on the same shared module — nothing to port, it never had one
- A full live test per sport before either is used for a real scored event — code-level confirmation alone (this session's method) is not sufficient sign-off, matching this project's own standing rule that a fix isn't RESOLVED until live-verified

**Reinstate when:** the shared logger module is built and each sport has been live-tested end-to-end on staging (own instance, not inferred from football's tests)
**Risk if reinstated early / if used for a real match now:** a live basketball match's public score stays frozen at whatever it was pre-tip-off for the entire game; a live track event has literally nothing to display since nothing is ever saved. Both are silent failures from the logger's own point of view — the in-app score/timer looks correct to whoever's logging, so this would not be caught by anyone relying on that screen alone.

**Update, session 46 (2026-07-23):** score persistence, period/quarter persistence, and the `finalizeMatch()`-unreachable dead end above are now fixed and live-verified via API for `BasketballLogger.tsx` (see `BACKLOG-125`'s updated status, `RUNLOG.md`) — this entry's "what's missing" list is partially stale as a result, kept as historical context rather than rewritten mid-walkthrough. `TrackLogger.tsx` remains fully untouched, still zero persistence. The shared-logger-core question itself (the actual subject of this backscope entry) is still open and still deliberately deferred — today's fixes patched `BasketballLogger.tsx` directly, they did not extract shared logic, so the original reasoning here (avoid a second implementation of football's hardened logic) still applies going forward.

**Open question flagged for the football-to-basketball mapping session, not yet confirmed either way:** Richard observed that `BasketballLogger.tsx`'s own "Set Starting Lineup" modal lets the *logger* set/edit the starting lineup directly in-app before starting a match, with no dependency on the separate Admin "Official Match Lineups" page (`/admin/match-lineups`) — confirmed in code this session, that page and `eligible-players`/the in-app lineup modal are fully independent data paths for basketball. Richard's working assumption is that this differs from football, where lineup publishing is admin-only. **Not verified either way** — `FootballLogger.tsx` appears to use the same `eligible-players` + `memberships` pattern for its own roster resolution, which would suggest football's logger might *also* be self-contained and not actually gated on the Admin page, making the Admin page a parallel "public display" feature for both sports rather than a real football-vs-basketball workflow difference. Confirm by reading `FootballLogger.tsx`'s own lineup-selection flow directly (does it have its own in-app "set lineup" modal like basketball's, or does it read from/require the Admin-published lineup?) during the systematic mapping pass.

---

## Staff Comms — Internal Match Coordination Notes

**Backscoped:** 2026-07-27 (session 47C)
**Backlog ref:** BACKLOG-142
**Current state:** WORKING BUT PULLED — a genuinely wired, non-stub feature (not a scaffold like the rest of this file's entries), removed from the UI specifically because it shipped with zero auth and a half-built admin selection flow, not because it lacked a backend.

**What this is:** a per-match staff notes channel — `staff_comms` table (`schema.ts:782`), `GET`/`POST /api/staff-comms`. Two UIs consumed it: `FootballLogger.tsx` (a modal, fetch-on-mount + 15s poll, note composer) and `src/app/admin/manager/page.tsx` (a sidebar panel + a "Staff Comms" stat tile).

**What was found (session 47C audit, `BACKLOG-142`):**
1. Neither `GET` nor `POST` had a `getAuthUser()` call — `middleware.ts`'s matcher doesn't cover `/api/staff-comms`, so in production anyone could read any match's notes or post one under any spoofed `userId`.
2. `admin/manager/page.tsx`'s match-selection for the panel was a placeholder (`// For now, let's just fetch for the first unapproved finished match if it exists`) sitting alongside a separate, correct per-match click handler — never the intentional design.

**What exists in code (comment-out markers, grep `BACKSCOPED: 2026-07-27`):**
- `src/components/FootballLogger.tsx` — the comms-fetch `useEffect`, `handleSendNote`, the header button + unread badge, and the full modal JSX are all commented out, not deleted
- `src/app/admin/manager/page.tsx` — the comms-fetch in `fetchData`, `handleSendNote`, the `onSelect` comms-fetch line, the "Staff Comms" `TacticalCard`, and the entire sidebar `<aside>` panel are all commented out
- `src/app/api/staff-comms/route.ts` — **not backscoped, fixed in place instead**: both handlers now call `getAuthUser()` and reject unauthenticated requests; `POST` derives `userId` via `resolveEffectiveUserId(authUser)` (never the client body) so a reinstated logger-role caller doesn't hit the same FK-mismatch class as `BUG-124` (`staffComms.userId` FKs to `users.id`, not `loggers.id`)

**What's missing to reinstate:**
- `admin/manager/page.tsx`'s match-selection flow needs a real design (not the "first unapproved finished match" placeholder) before the panel goes back in
- A decision on whether logger-role callers should be able to post at all, given `resolveEffectiveUserId` only works if the logger also has a fan account in `users` — otherwise it silently falls back to the logger's own non-`users` id and would still FK-crash on insert (not hit today since no logger UI calls this route anymore, but real if `FootballLogger.tsx`'s panel comes back without addressing it)

**Reinstate when:** the admin-side selection flow above is rebuilt, and the logger-caller edge case is either resolved or explicitly decided against (admin/manager-only feature)
**Risk if reinstated early:** exactly what was found this session — an unauthenticated internal-notes endpoint, live in production, plus a placeholder selection flow presented as a finished feature

---

## /xi + /xi/gallery — "Build Your XI" (fan-engagement team builder)

**Flagged (not yet backscoped):** 2026-07-27 (session 47D) — Richard's own call, noting it here to track rather than acting yet
**Backlog ref:** `BUG-037` (auth gap), plus new unfiled findings from the player-data audit
**Current state:** LIVE and functional (no crashes — pick a formation, slot in players, save, view the public gallery of saved XIs) but genuinely not stable enough to stand as a finished feature:
1. `POST /api/user/xi` has no auth gate (`BUG-037`, OPEN) — `userId` comes from the request body, so any caller can attribute a saved XI to any other user's account.
2. The player picker (`GET /api/players?limit=100`) has no sport/team filter at all — a "team" can mix football and basketball players with nothing preventing it.
3. The displayed team rating (`teamRating`, average of selected players' `.rating`) reads the same dead, never-live-updated `players.rating` field documented in `BACKLOG-159` — the number shown while building is fabricated, not real.

**Not currently in either Tier 4's backscoped list or Tier 0-3's active-and-solid list** — this entry exists to track that ambiguity, not to resolve it. No code changed; the feature remains live as-is pending a real decision.

**What's missing to actually stabilize (if kept live) or reinstate cleanly (if backscoped later):** the `BUG-037` auth fix, a sport filter on the player picker, and either wiring the rating to something real or dropping the rating display entirely.

**Decision:** deferred — noted here per Richard's explicit request, no `notFound()` applied, no functionality removed.

---

## Account Deletion — No Mechanism Exists (NDPR Gap)

**Flagged:** 2026-08-21 (session 53) — Richard's own call, surfaced while reviewing a user-facing form.
**Current state:** no account-deletion path exists anywhere in the app — not self-service, not admin-mediated. Confirmed by context, not yet independently re-verified via a dedicated grep this session.
**Why it matters:** NDPR (Nigeria Data Protection Regulation) — like most privacy regimes BrixSports' peers operate under — expects a way for a user to request deletion of their data, even if that path is manual/contact-based rather than a self-service button.
**Not a blocker for anything in flight** — doesn't need to gate the form or feature it was noticed alongside. Filed here as a real gap to eventually close: at minimum, a documented contact-based deletion process (e.g. "email privacy@brixsports.com to request deletion, admin fulfills manually"); a self-service delete-account flow would be the fuller fix.
**Decision:** deferred — noted here, no code changed, no functionality blocked.

---

## "Off-Roster" / Non-Career Match Mode — Players Not Tied to Their Real Club Profile

**Flagged:** 2026-08-21 (session 53) — Richard's own idea, surfaced while discussing test/stub data for a different purpose (beta-testing scripts), not something requested to be built now.

**The idea:** some real match events genuinely don't fit the current model, where every match's players/teams resolve to real, permanent `players`/`teams` rows tied to a university/competition. Richard's framing: like FIFA's non-career modes, where a player can appear in a match without it touching their real club career record — e.g. a one-off friendly, an exhibition, or a different sport/format entirely from a player's real registered one. Rather than requiring a brand-new player/team profile to be created in the permanent roster system for every such stub/ad-hoc event, this mode would let a match reference lightweight, disposable team/player entries that never touch the real roster, stats, or club-affiliation data.

**Why it's not the same as `matchType: 'friendly'` (already exists):** the existing friendly-match flag still uses real `teams`/`players` rows (confirmed earlier this session — the 6 NULL-`competitionId` matches audited were all genuinely friendly, using real teams/dummy generic ones already in the roster). Richard's ask is a step further: matches whose participants shouldn't be required to exist as real roster rows at all.

**Not scoped or designed** — no schema shape, no UI, no decision on whether this reuses `players`/`teams` with a "non-career"/stub flag vs. a fully separate lightweight table. Explicitly not something to build now; Richard's own call was "we don't focus on that for now but can add to backscope doc."

**Decision:** deferred, idea-stage only — noted here for a future session to actually scope, no code changed.
