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

---

## /scouts — Scout Reports

**Backscoped:** 2026-06-08 (was already dead before this session)
**Backlog ref:** BACKLOG-028
**Current state:** DEAD — page component exists but already contained a redirect to `/`. No API routes. No DB tables.

**What exists in code:**
- `src/app/scouts/page.tsx` — pre-existing redirect to `/`

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
