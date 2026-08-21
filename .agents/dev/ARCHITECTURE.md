# BrixSports — Full System Architecture

> Last updated: 2026-07-01
> Tier: MVP → PRODUCTION
> Author: Claude Code (generated from full codebase read)

> **Section 12 (Known Structural Gaps) staleness note, session 53 (2026-08-20):** that
> table was generated from sessions 27-38C's read (see its own footer) and was never
> fully re-swept since. Spot-checked and corrected the rows this session had direct
> evidence for (`BACKLOG-105`, `TD-011`, `BUG-083`) — the rest of the table has NOT
> been independently re-verified and may contain other stale `OPEN` rows; treat
> `BACKLOG.md` as the authoritative live source, this table as a snapshot.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Infrastructure Topology](#2-infrastructure-topology)
3. [Actor Model](#3-actor-model)
4. [Database Layer](#4-database-layer)
5. [Auth Architecture](#5-auth-architecture)
6. [API Layer](#6-api-layer)
7. [Real-Time Architecture (Full Breakdown)](#7-real-time-architecture-full-breakdown)
8. [PWA & Service Worker Architecture](#8-pwa--service-worker-architecture)
9. [Notification Architecture](#9-notification-architecture)
10. [Frontend Architecture](#10-frontend-architecture)
11. [The Three Critical Flows](#11-the-three-critical-flows)
12. [Known Structural Gaps](#12-known-structural-gaps)

---

## 1. System Overview

BrixSports is a live sports scoring platform for university sports (BUSA League — Bells University Student Association League). It handles:

- **Football and Basketball** — live match logging, scoring, player stats
- **Real-time public livescore** — viewers see score/events without refresh
- **Admin match management** — create matches, assign loggers, publish lineups
- **Logger mobile interface** — field operators log events live from their phones
- **Push notifications** — subscribers receive goal/card/period alerts

```
┌─────────────────────────────────────────────────────────────┐
│                        BRIXSPORTS                           │
│                                                             │
│  Admin Panel ──┐                                            │
│                ├──► Next.js App Router ──► Turso (LibSQL)   │
│  Logger PWA ───┤         │                                  │
│                │         ├──► Railway WebSocket Server      │
│  Viewer App ───┘         │                                  │
│                          ├──► Cloudinary (images)           │
│                          ├──► VAPID (push notifications)    │
│                          └──► Sentry (error tracking)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Infrastructure Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRODUCTION                               │
│                                                                 │
│  brixsports.com                                                 │
│  ┌──────────────────────────────────┐                           │
│  │   Vercel (Next.js)               │                           │
│  │   - App Router (SSR + API routes)│                           │
│  │   - Edge middleware (auth check) │◄──── Turso DB (LibSQL)    │
│  │   - Serverless functions         │      (prod instance)      │
│  └──────────────┬───────────────────┘                           │
│                 │ NEXT_PUBLIC_WS_URL                            │
│                 ▼                                               │
│  ┌──────────────────────────────────┐                           │
│  │   Railway (Node.js + Socket.IO)  │                           │
│  │   server.js — custom HTTP server │                           │
│  │   - Next.js handler wrapped      │                           │
│  │   - Socket.IO mounted at         │                           │
│  │     /api/socket                  │                           │
│  │   - In-memory matchTimes Map     │                           │
│  │   - In-memory room management    │                           │
│  └──────────────────────────────────┘                           │
│                                                                 │
│  STAGING: staging.brixsports.com (same Railway WS — BUG-074)    │
└─────────────────────────────────────────────────────────────────┘
```

**Critical deployment note:** Vercel hosts the Next.js app (serverless). Railway hosts a _separate_ Node.js process (`server.js`) that runs Next.js + Socket.IO together. The WebSocket server is NOT on Vercel — Vercel serverless functions cannot hold persistent socket connections. This is why Railway going down kills real-time but the REST API (Vercel) stays up.

---

## 3. Actor Model

```
Super Admin
  └── Competition Admin
        └── Team Manager
              └── Logger (authenticated, mobile, field operator)
                    └── Viewer (always unauthenticated — no session)
```

| Actor             | Identity Store  | Auth Method            | Primary Interface |
| ----------------- | --------------- | ---------------------- | ----------------- |
| Super Admin       | `users` table   | JWT (jose, 7d)         | `/admin/*`        |
| Competition Admin | `users` table   | JWT (jose, 7d)         | `/admin/*`        |
| Team Manager      | `users` table   | JWT (jose, 7d)         | `/admin/*`        |
| Logger            | `loggers` table | JWT (jsonwebtoken, 7d) | `/logger/*` PWA   |
| Viewer            | none            | none                   | `/` public pages  |

**Auth split:** Admins use `jose` (Web Crypto API, async). Loggers use `jsonwebtoken` (Node.js, sync). Both verify via `getAuthUser()` in `src/lib/auth.ts`. Logger JWTs carry `{ id, email, role }`. Admin JWTs carry `{ userId, email, role }`. `verifyAuth()` normalises both to `userId` field.

**JWT secret rotation (2026-07-01):** Staging and production now use separate `JWT_SECRET` values — staging no longer shares a secret with prod. Both loggers and admins within an environment use the same single `JWT_SECRET` (one secret per env, not per role). This gap is RESOLVED.

---

## 4. Database Layer

**Engine:** Turso (LibSQL — SQLite-compatible, hosted) via Drizzle ORM  
**Access:** HTTP (stateless) via `@libsql/client` — no persistent connection pool  
**Schema file:** `src/db/schema.ts`

### Core Tables

```
organizations          — universities, colleges, departments
teams                  — sports teams (Football/Basketball/etc.)
players                — player registry
playerTeamAffiliations — many-to-many player↔team (replaces hard teamId)

competitions           — league/cup competitions
competitionTeams       — teams enrolled in competitions
fixtures               — scheduled matches within competitions
matches                — live match records (THE central table)
matchEvents            — every logged event (Goal, Card, Sub, etc.)
matchLoggerAssignments — which loggers are assigned to which match
matchLineups           — published lineups per match per team

users                  — viewer/admin accounts
loggers                — logger accounts (separate from users)
userFollows            — viewer follows (team/player/competition)
userFavorites          — viewer favorites
pushSubscriptions      — VAPID push endpoints

footballPlayerStats    — per-player cumulative football stats
basketballPlayerStats  — per-player cumulative basketball stats
eyePointAwards         — Eye Point award records per match

news / newsComments    — news/article system
polls / pollVotes      — in-match polls
predictions            — match predictions
```

### The `matches` table (central live-match record)

```sql
matches
  id                TEXT PK
  homeTeamId        TEXT → teams.id
  awayTeamId        TEXT → teams.id
  competitionId     TEXT → competitions.id
  status            TEXT  -- 'PENDING'|'LIVE'|'FINISHED'|'CANCELLED'
  currentPeriod     TEXT  -- 'NOT_STARTED'|'FIRST_HALF'|'HALF_TIME'|...
  homeScore         INT
  awayScore         INT
  shootoutHomeScore INT   -- penalty shootout score (separate from match score)
  shootoutAwayScore INT
  sport             TEXT
  matchType         TEXT  -- 'league'|'friendly'|'cup'
  stats             TEXT  -- JSON blob of computed stats
  venue             TEXT
  startTime         TIMESTAMP
  createdAt / updatedAt
```

### Schema migrations

No automated migration runner — all DDL changes are manual `ALTER TABLE` SQL run via `dev/*.mjs` scripts. Schema.ts is updated to match manually after migration. `db:push` is available but blocked by BACKLOG-040 (schema drift risk on Turso). All migrations logged in `.agents/dev/RUNLOG.md`.

---

## 5. Auth Architecture

```
Request
  │
  ▼
src/middleware.ts
  ├── Staging gate: x-staging-bypass header check
  ├── Admin routes (/admin/*): JWT cookie check → redirect if missing
  └── Logger routes (/logger/*): JWT cookie check → redirect if missing

  (Middleware is a FIRST LAYER only — not the sole auth check)

  │
  ▼
API Route Handler
  ├── getAuthUser(request) → verifyAuth() → jwt.verify() → DB lookup
  │     ├── role='logger' → query loggers table
  │     │     └── miss → fall through to users table (logger-role fan accounts)
  │     └── role='admin'/'user' → query users table
  │
  ├── Role check: authUser.role === 'admin' for admin routes
  ├── Assignment check: matchLoggerAssignments for logger routes
  └── resolveEffectiveUserId() for viewer-app routes
        └── logger cookie on viewer route → bridge via email to users table
```

**Token lifecycle:**

- Login → `POST /api/auth/login` (admin) or `POST /api/loggers/auth` (logger)
- Token set as `httpOnly` cookie (`authToken`, maxAge 7d) + localStorage (logger only, for SW offline queue)
- Refresh → `POST /api/auth/refresh` (normalises both token shapes)
- Expiry → 401, clear cookie, redirect to login

---

## 6. API Layer

**~110 route files** in `src/app/api/`. All Next.js App Router route handlers (serverless on Vercel, except when running via Railway's custom server).

### Route Groups

```
/api/auth/*          — login, logout, register, refresh, me, Google OAuth
/api/loggers/*       — logger auth, logger profile, assigned matches
/api/matches/*       — match CRUD, events, lineup, ratings, assign-logger
/api/admin/*         — admin-gated: users, ads, settings, lineups, organizations
/api/competitions/*  — competition management, standings, fixtures, stats
/api/players/*       — player profiles, stats, performance, compare
/api/teams/*         — team management, form, stats, follow
/api/users/*         — follows, favorites, preferences, activity, bookmarks
/api/notifications/* — push subscribe, send, diagnose, match-reminders
/api/football/*      — football-specific: matches, players, standings, teams
/api/basketball/*    — basketball-specific: matches, players, leaderboard
/api/news/*          — articles, comments, likes, related
/api/polls/*         — in-match polls and votes
/api/predictions/*   — match predictions and leaderboard
/api/standings/*     — cross-sport standings
/api/search/*        — global search
/api/fpl/*           — Fantasy Premier League (scoped feature)
/api/ratings/*       — player rating analytics
/api/health          — uptime check
```

### API rules enforced (CLAUDE.md)

- Every `/api/admin/*` must call `getAuthUser()` AND check `user.role === 'admin'`
- Every list endpoint must have `.limit()` — no unbounded queries
- Public endpoints (`/api/matches`, `/api/players`) must never return banned fields
- All DB operations in `try/catch/finally`
- Responses are shaped DTOs — never raw Drizzle rows

---

## 7. Real-Time Architecture (Full Breakdown)

This is the core of the live match product. Five distinct layers.

---

### Layer 1 — The WebSocket Server (`server.js` on Railway)

```
Node.js HTTP server
  └── Next.js app handler (wraps all HTTP)
  └── Socket.IO Server mounted at /api/socket
        │
        ├── In-memory state
        │     └── matchTimes Map<matchId, timePayload>
        │           (last known time per match — sent to late joiners)
        │
        ├── Rooms
        │     ├── match:{matchId}   — per-match subscribers
        │     ├── chat:{matchId}    — per-match chat
        │     └── admin:loggers     — admin dashboard logger status feed
        │
        └── Events handled (server receives → rebroadcasts)
              match:subscribe        → socket.join(room) + send cached time
              match:unsubscribe      → socket.leave(room)
              match:time:update      → cache in matchTimes + broadcast match:time:updated
              match:score:update     → broadcast match:score:updated
              match:status:change    → broadcast match:status:changed + notification:global
              event:log              → broadcast event:new + notification:global (Goals/Cards)
              event:undo             → broadcast event:deleted
              match:lineup:update    → broadcast match:lineup:updated
              rating:update          → broadcast rating:updated
              stats:update           → broadcast stats:updated
              eyepoint:award         → broadcast eyepoint:awarded
              substitution:log       → broadcast substitution:logged
              poll:vote              → broadcast poll:updated
              prediction:submit      → broadcast prediction:updated
              ping                   → pong
              logger:status:update   → broadcast to admin:loggers room
```

**The server is a pure passthrough.** It does not validate events, does not check auth on socket messages, does not write to the DB. It receives and fans out. ALL writes go through the Next.js REST API.

**Global `io` object:** `global.io = io` is set at startup. API route handlers that need to broadcast (e.g. after a DB write confirms) can access `global.io` directly without going through the client. This is the correct pattern for server-initiated broadcasts.

---

### Layer 2 — The Logger Clock (`src/lib/match-state-manager.ts`)

The logger's browser tab is the **sole clock authority** for all connected viewers.

```
Logger phone (Chrome Android)
  │
  └── MatchStateManager (singleton per matchId, client-side only)
        │
        ├── STATE
        │     ├── clock: { absoluteMinute, displayMinute, second, period,
        │     │            isRunning, lastTickTimestamp, startTimestamp,
        │     │            announcedStoppage, periodEndTriggered }
        │     ├── score: { home, away }
        │     ├── events: MatchEvent[]
        │     ├── stats: MatchStats
        │     ├── lineups: { home, away }
        │     └── halfDuration: number (from competition config)
        │
        ├── CLOCK MECHANISM
        │     ├── setInterval(tick, 1000) — fires every ~1s
        │     ├── tick(): deltaMs = Date.now() - lastTickTimestamp
        │     │           deltaSeconds = floor(deltaMs / 1000)  ← NO CAP ⚠️
        │     │           absoluteMinute += floor((second + delta) / 60)
        │     │           → broadcastTimeUpdate() → DOM CustomEvent
        │     │
        │     ├── Starts on: transitionStatus('FIRST_HALF' | 'SECOND_HALF' | 'EXTRA_TIME_*')
        │     ├── Stops on:  transitionStatus('HALF_TIME' | 'FINISHED' | 'ABANDONED')
        │     └── SUSPENDED: period exists, but NO stopClock() in handler ⚠️
        │
        ├── PERSISTENCE
        │     └── localStorage.setItem('match_state_{matchId}', JSON)
        │           — persists clock, score, events, lineups
        │           — rehydrated on mount (catch-up: uncapped elapsed time added) ⚠️
        │
        └── BROADCASTING (all DOM CustomEvents — local only)
              MATCH_TIME_UPDATE     → picked up by FootballLogger useEffect → WS emit
              MATCH_EVENT           → picked up by FootballLogger → WS emit
              MATCH_STATUS_CHANGE   → picked up by FootballLogger → WS emit
              MATCH_PERIOD_END      → triggers UI period-end confirmation modal
              MATCH_NOTIFICATION_TRIGGER → picked up by EventDrivenNotifier
```

**Clock risks (Directive 6 confirmed):**
| Risk | Status |
|------|--------|
| Phone backgrounded 3min → clock jumps 3min | Confirmed possible |
| SUSPENDED period doesn't stop clock | Confirmed |
| Two loggers → two independent clocks → viewer jitter | Confirmed possible |
| No jump detection on viewer side | Confirmed |
| isStale binary (3s hiccup = 5min outage visually) | Confirmed |

---

### Layer 3 — The WS Client (`src/hooks/useWebSocket.tsx`)

Singleton Socket.IO client shared across all React hooks and components.

```
SocketProvider (wraps entire app)
  └── getOrCreateSocket()
        ├── Checks: sharedSocket?.connected || sharedSocket?.active
        ├── io(NEXT_PUBLIC_WS_URL, { path: '/api/socket', reconnectionAttempts: 5 })
        ├── connect_error handler: counts to 5, logs — does NOT disconnect ← BUG-080 fix
        └── reconnect_failed handler: 30s setInterval retry loop ← BUG-080 fix
              ⚠️ Interval leaks on SocketProvider remount (no ref to clear it)

Exported hooks (all share ONE socket):
  useSocket()              — raw socket + isConnected
  useMatchSubscription()   — emits match:subscribe on connect ← 3-5x storm (BUG-089)
  useMatchEvents()         — event:new, event:deleted handlers
  useMatchStatus()         — match:status:changed, match:score:updated, match:updated
  useMatchTimer()          — match:time:updated / match:time:update (dual event names ⚠️)
                             isStale: true on disconnect (binary, no duration tracking)
  usePlayerRatings()       — rating:updated handler
  useTeamStats()           — stats:updated handler
  useMatchViewers()        — match:viewers handler
  useLineupUpdates()       — match:lineup:updated handler
  useWebSocket()           — legacy wrapper, exposes on/off/emit/subscribe
```

**Subscribe storm (BUG-089):** `useMatchSubscription` has `[socket, isConnected, matchId]` as deps. Each hook that calls it (`useMatchEvents`, `useMatchStatus`, `useMatchTimer`, `usePlayerRatings`, `useTeamStats`, `useMatchViewers`, `useLineupUpdates`) independently calls `socket.emit('match:subscribe')` on every `isConnected` change. That's 3–5 subscribes per connect. Server joins the room multiple times (no-op for rooms, but the subscribe message still fires).

---

### Layer 4 — The Event Write Path (REST + WS broadcast)

The authoritative path for every event. Separate from the WS-only path.

```
Logger taps event button
  │
  ├── 1. MatchStateManager.recordEvent()
  │         — adds to local events array
  │         — updates local score
  │         — persists to localStorage
  │         — broadcasts MATCH_EVENT DOM CustomEvent
  │
  ├── 2. FootballLogger useEffect catches MATCH_EVENT
  │         — POST /api/matches/{id}/events (REST)
  │               │
  │               ├── Auth: getAuthUser() + logger assignment check
  │               ├── INSERT matchEvents row
  │               ├── UPDATE matches.homeScore / awayScore (if scoring event)
  │               ├── updatePlayerStats() (football/basketball switch)
  │               ├── POST /api/matches/{id}/ratings (fire-and-forget)
  │               └── Returns { event: newEvent } with permanent DB id
  │
  ├── 3. FootballLogger receives 201 response
  │         — MatchStateManager.confirmEvent(tempId, serverId) — swaps ID
  │         — socket.emit('event:log', payload) → WS server
  │               └── server broadcasts event:new to match:{id} room
  │
  └── 4. Viewers receive event:new
              — useMatchEvents handler adds to local events array
              — Dedup: id OR (type+minute+playerId+teamId) to handle dual-path duplicates
```

**Dual broadcast risk:** Logger emits `event:log` after DB write (path 3). The WS server also has legacy `event:log` handler that independently broadcasts `event:new`. If both fire (they do), viewer receives two `event:new` signals per event — one with temp ID, one with server ID. Dedup key added in BUG-080 work handles this, but it's not committed yet.

---

### Layer 5 — The Viewer Fallback (HTTP Polling)

Added in BUG-080. Activates when WS is down during a live match.

```
isConnected === false && LIVE_STATES.has(match.status)
  │
  └── setInterval(fetchMatchData(silent=true), 10000)
        — fetches full match document from GET /api/matches/{id}
        — merges into matchData state (no loading spinner)
        — clears when WS reconnects
        — toast: 'Live updates paused — refreshing automatically'

LIVE_STATES = { 'LIVE', 'HALF_TIME', 'FIRST_HALF', 'SECOND_HALF',
                'EXTRA_TIME_1', 'EXTRA_TIME_2', 'PENALTY_SHOOTOUT' }
```

On WS reconnect: one-shot `fetchMatchData(silent=true)` to pull missed events from DB.

---

## 8. PWA & Service Worker Architecture

Two separate PWA manifests, two separate service workers.

```
/public/manifest-admin.json   — Admin PWA: start_url=/admin?source=pwa, scope=/admin
/public/manifest-logger.json  — Logger PWA: start_url=/logger?source=pwa, scope=/logger

/public/sw-admin.js           — Service worker for admin + logger
/public/sw-user.js            — Service worker for viewer app
```

### sw-admin.js behaviour

```
CACHE STRATEGY:
  HTML documents    → network-first, no-store (prevents stale chunk errors — BUG-026)
  Static assets     → cache-first (CSS, JS, fonts, images)
  API calls (GET)   → network-first with cache fallback

OFFLINE EVENT QUEUE (logger):
  When POST /api/matches/{id}/events fails (network error):
    → Write to IndexedDB: 'pendingMatchEvents' object store
    → { url, method, headers, body, timestamp }

  Background Sync (Android/desktop):
    → SW registers 'sync-match-events' tag
    → syncMatchEvents() drains IDB queue on next connectivity

  iOS fallback (BACKLOG-107):
    → FootballLogger listens: window.addEventListener('online', triggerDrain)
    → document.addEventListener('visibilitychange', handler)
    → triggerDrain → postMessage({ type: 'DRAIN_MATCH_EVENTS' }) to SW
    → SW message handler calls syncMatchEvents() directly

  Drain: idbGetAll(db, 'pendingMatchEvents')
         → for each item: fetch(item.url, item.options)
         → on success: idbDelete(db, 'pendingMatchEvents', item.key)
```

### Logger session persistence

- JWT stored in both `httpOnly cookie` (for API calls) and `localStorage.authToken` (for SW queue drain)
- On mount: `POST /api/auth/refresh` → re-writes token to localStorage (survives AuthContext wipe)
- `localStorage.brix_logger_matchId` — preserves selected match across hard refresh
- `localStorage.match_state_{matchId}` — full MatchStateManager state (events, clock, score, lineups)

---

## 9. Notification Architecture

Push notifications via VAPID (Web Push Protocol).

```
PIPELINE:

  MatchStateManager
    triggerNotification(event)
    triggerPeriodNotification(period)
         │
         └── window.dispatchEvent(
               'MATCH_NOTIFICATION_TRIGGER')
                    │
                    ▼
         EventDrivenNotifier
         (window singleton, no constructor context)
              │
              ├── handleEvent() / handlePeriodEvent()
              ├── Dedup key: matchId_eventId_Date.now()  ← BROKEN (BUG-085)
              ├── Push to retry queue
              └── processQueue()
                    │
                    ▼
         POST /api/notifications/match-event
              │
              ├── Build audience:
              │     ├── userFollows WHERE notificationsEnabled=true (no .limit() — BACKLOG-115)
              │     ├── userFavorites (no notificationsEnabled filter — BACKLOG-116)
              │     ├── users.favoriteTeamId
              │     └── MINUS userPreferences WHERE matchAlerts=false
              │           (if no prefs row exists, default = alerts ON)
              │
              ├── For each subscriber:
              │     SELECT pushSubscriptions WHERE userId IN audience
              │     └── webpush.sendNotification(subscription, payload)
              │           → 410/404 response → DELETE stale subscription
              │
              └── Returns { success, sentCount }

CURRENT STATE (DB-confirmed 2026-07-01):
  pushSubscriptions has 3 rows on prod:
    - 2× Apple Push (web.push.apple.com) — iOS Safari subscribers
    - 1× FCM (fcm.googleapis.com) — Android/Chrome subscriber (user_id: admin-001)
  Pipeline is LIVE and delivering real pushes.

  Enrollment UI confirmed in 3 places — BUG-084 was a false finding:
    - SettingsOverlay.tsx — subscribe/unsubscribe toggle
    - OnboardingModal.tsx — first-time onboarding step
    - NotificationPermission.tsx — auto-show banner on first visit

  Active issue: BUG-085 (dedup key broken — Date.now() suffix) means every
  notifiable event fires unconditionally with no dedup protection on retries.

NOTIFIABLE EVENTS (confirmed at match-state-manager.ts:981):
  Goal, Penalty, Penalty Saved, Penalty Missed, Red Card
  MATCH_START (FIRST_HALF transition)
  HALF_TIME
  MATCH_END (FINISHED transition)

  ⚠️ Yellow Card: getNotificationType() maps it → 'YELLOW_CARD' and the API
  accepts YELLOW_CARD, but triggerNotification() excludes it from the
  notifiableEvents list — so no CustomEvent is ever dispatched for Yellow Cards.
  The push path exists structurally but is never triggered.
```

### Push enrollment flow (confirmed built — BUG-084 retracted)

```
Viewer opens SettingsOverlay
  → subscribe/unsubscribe toggle (SettingsOverlay.tsx)
  → PushService.subscribe(userId)
        → pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })
        → POST /api/notifications/subscribe { endpoint, keys }
        → INSERT pushSubscriptions row
```

### Push subscriptions table — known gaps for scale

Current schema tracks: endpoint, auth key, p256dh key, userId.
Missing fields needed before multi-campus scale:

- `platform` (TEXT: 'apns'|'fcm'|'mozilla') — derived from endpoint URL at subscribe time; enables platform-specific delivery debugging without parsing endpoint URLs
- `isActive` (BOOLEAN, default true) — soft-delete on 410/404 response rather than hard delete; preserves subscription churn history for audience debugging
- `lastUsedAt` (TIMESTAMP) — updated on every successful delivery; enables proactive pruning of stale subscriptions without waiting for a 410
- `deviceLabel` (TEXT, nullable) — user-agent simplified or user-set label; distinguishes multiple devices per user in push diagnostics UI

These are pre-multi-campus additions, not current blockers.

---

## 10. Frontend Architecture

**Framework:** Next.js App Router (React Server Components + Client Components)  
**Styling:** TailwindCSS  
**State:** React `useState`/`useContext` — no Redux/Zustand

### App structure

```
src/app/
  (public routes — no auth)
  /                    → Homepage (live matches, news, standings)
  /matches/[id]        → Public match detail (Timeline, Stats, Lineups, Overview)
  /competitions/[id]   → Competition page
  /players/[id]        → Player profile
  /teams/[id]          → Team page
  /live                → Live scores hub

  (admin routes — JWT required, role=admin)
  /admin/
    matches            → Match management + creation
    match-lineups      → Lineup builder
    players            → Player registry
    teams              → Team management
    competitions       → Competition management
    loggers            → Logger account management
    news               → CMS for articles
    ads                → Ad management
    settings           → App settings

  (logger routes — JWT required, role=logger)
  /logger/             → Logger dashboard + match selection
                         FootballLogger | BasketballLogger component

src/components/
  FootballLogger.tsx        — Main logger UI (~2500 lines, the most complex file)
  BasketballLogger.tsx      — Basketball variant
  LiveMatchStatus.tsx       — Real-time period + clock badge (WS-driven)
  LiveMatchTimeline.tsx     — Event feed with commentary + icons
  LiveStats.tsx             — Real-time match statistics
  PenaltySequenceModal.tsx  — Penalty logging (taker → outcome → keeper)
  PlayerSelectionModal.tsx  — Shared player picker
  MatchCard.tsx             — Match card (compact + live variants)

src/hooks/
  useWebSocket.tsx          — WS singleton + all real-time hooks
  useToast.tsx              — Toast notification system

src/lib/
  match-state-manager.ts    — Logger clock + event state machine
  auth.ts                   — JWT verify, getAuthUser, resolveEffectiveUserId
  env.ts                    — Typed env vars, validateEnv()
  notifications/
    event-driven-notifier.ts    — Push trigger singleton
    match-notification-service.ts — Audience query + webpush.sendNotification
    push-service.ts             — Client-side pushManager.subscribe wrapper
```

### Context providers

```
SocketProvider     — wraps entire app, owns the shared WS connection
AuthContext        — viewer/admin session (reads authToken cookie)
ToastContext       — global toast system
```

---

## 11. The Three Critical Flows

These must NEVER break. Every code change is evaluated against them.

### Flow A — Match Creation

```
Admin → /admin/matches → POST /api/matches
  └── competitionId, homeTeamId, awayTeamId, startTime, venue, sport
      │
      └── Admin assigns loggers → POST /api/matches/{id}/assign-logger
            └── INSERT matchLoggerAssignments { matchId, loggerId, status: 'active' }
                  │
                  └── Match appears on:
                        - /live (live scores hub)
                        - Homepage (upcoming card)
                        - /matches/[id] (public detail page)
```

### Flow B — Live Event Logging

```
Logger → /logger → selects match → FootballLogger
  │
  ├── Start Match button
  │     └── PATCH /api/matches/{id} { status: 'LIVE', currentPeriod: 'FIRST_HALF' }
  │           └── MatchStateManager.transitionStatus('FIRST_HALF')
  │                 └── startClock() → setInterval(tick, 1000)
  │
  ├── Log event (e.g. Goal)
  │     ├── MatchStateManager.recordEvent() → local state + localStorage
  │     ├── POST /api/matches/{id}/events → DB write + score update + stat write
  │     └── socket.emit('event:log') → WS server → event:new to match room
  │
  └── End Match
        ├── PATCH /api/matches/{id} { status: 'FINISHED', currentPeriod: 'FINISHED' }
        └── MatchStateManager.transitionStatus('FINISHED') → stopClock()
```

### Flow C — Public Livescore

```
Viewer → /matches/{id}
  │
  ├── Initial load: GET /api/matches/{id}
  │     └── Returns: match, events, score, currentPeriod, lineups
  │
  ├── WS connect → useMatchSubscription → match:subscribe
  │     └── Server sends cached matchTime on join
  │
  ├── Real-time updates via WS:
  │     ├── event:new → adds to events array (deduped)
  │     ├── match:time:updated → useMatchTimer → LiveMatchStatus updates
  │     ├── match:score:updated → score display updates
  │     └── match:status:changed → isLive recalculated
  │
  └── WS down fallback:
        └── setInterval(GET /api/matches/{id}, 10s) — silent polling
              → amber toast: 'Live updates paused — refreshing automatically'
              → score/events stay current within 10s window
```

---

## 12. Known Structural Gaps

Ordered by operational risk to a live match day.

### Real-Time / Clock

| Gap                                                | Risk                                                                                                                                                                                          | Location                                      | Status |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------ |
| No delta cap in `tick()`                           | Phone sleep → clock jump → all viewers see wrong time                                                                                                                                         | `match-state-manager.ts:293`                  | OPEN — football-specific (`match-state-manager.ts`), not imported by `BasketballLogger.tsx`; would need explicit copy-in if basketball ever adopts a ticking clock, not inherited automatically |
| SUSPENDED period doesn't stop clock                | Referee stoppage → clock keeps running                                                                                                                                                        | `match-state-manager.ts:423` switch           | OPEN — same file, same inheritance note as above |
| Dual logger sessions → dual clocks                 | Viewer jitter on second-by-second display                                                                                                                                                     | `ws-server/index.js` `match:time:update` handler | ✅ **RESOLVED — BUG-122, session 44.** This row was stale; single-writer clock enforcement (`clockAuthority`/`assignmentCache` Maps keyed by `matchId`) shipped and was live-verified against real concurrent socket connections. Confirmed live in `ws-server/index.js` during session 47's basketball-native audit — no sport-specific branching in the handler, so this protection is inherited automatically by any future basketball WS-emit port that reuses the `match:time:update` event name. See `BACKLOG.md` BUG-122. |
| `isStale` binary — no escalation                   | 3s hiccup looks same as 5min outage                                                                                                                                                           | `useWebSocket.tsx:385,401`                    | OPEN — shared/sport-agnostic code, already inherited by basketball's public viewer pages today (they already use these hooks) |
| Subscribe storm (BUG-089)                          | 3-5× match:subscribe per WS connect                                                                                                                                                           | `useWebSocket.tsx:265-279`                    | OPEN — shared code, same inheritance note as above |
| Retry interval leaks on remount                    | Mechanism has changed since this row was written (post-BUG-114, now a `setTimeout` chain with a `manualRetryLoopActive` guard, not a raw `setInterval`) — the leak class persists in mutated form: neither the pending timeout nor the `reconnect_failed` listener is cleared on `SocketProvider` unmount, so the guard flag can get stuck `true` forever, blocking any future retry loop | `useWebSocket.tsx` `scheduleRetry()`/`SocketProvider` cleanup | OPEN — re-confirmed in current code, session 47. Filed as `BUG-137` in `BACKLOG.md` with the accurate current description. Shared code, inherited by basketball automatically. |
| `PENALTY_SHOOTOUT` period label missing            | Shows clock instead of 'PK'                                                                                                                                                                   | `LiveMatchStatus.tsx:64`                      | OPEN   |
| Staging and prod share Railway WS server (BUG-074) | Staging test events broadcast to prod viewers if matchId collides — fix is a dedicated staging Railway service (env-prefixed rooms are insufficient: `io.emit` global broadcasts bypass them) | `server.js` CORS allowlist + room join logic  | OPEN, but partially mitigated — room-prefixing by environment Origin shipped and is live (commit `ea9454f`), covering match/chat/competition/admin rooms, the global notification emit, and the `matchTimes` cache. The dedicated-second-Railway-service fix (this row's actual title) remains unbuilt; true cross-environment isolation is logically-verified, not live-tested under simultaneous prod+staging load. Confirmed current via session 47's audit. |
| No mutation audit trail for `matches` table        | Admin score/status corrections leave no record of previous value, actor, or timestamp                                                                                                         | `matches` table — no history table equivalent | OPEN   |

### Notifications

| Gap                                            | Risk                                                 | Location                           | Status                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| ~~No push enrollment UI (BUG-084)~~            | ~~Zero push notifications ever delivered~~           | ~~`SettingsOverlay` — missing~~    | RESOLVED — enrollment UI confirmed in SettingsOverlay, OnboardingModal, NotificationPermission |
| Dedup key broken (BUG-085)                     | Every event fires unconditionally, including retries | `event-driven-notifier.ts:151,123` | OPEN                                                                                           |
| `GET /api/notifications` type casing (BUG-088) | Goal events never appear in notification list        | `notifications/route.ts`           | OPEN                                                                                           |
| `userFavorites` no `.limit()` (BACKLOG-115)    | Full table scan on every notifiable event            | `match-notification-service.ts:86` | OPEN                                                                                           |

### Auth / Security

| Gap                                        | Risk                                               | Location                        | Status |
| ------------------------------------------ | -------------------------------------------------- | ------------------------------- | ------ |
| `resolveEffectiveUserId` no try/catch      | DB timeout → uncaught 500                          | `auth.ts:159`                   | OPEN   |
| PATCH `[eventId]` body spread (BUG-093)    | Any field overwritable by authenticated user       | `events/[eventId]/route.ts:125` | OPEN   |
| Score revert before event delete (BUG-094) | Delete fails → score permanently wrong             | `events/[eventId]/route.ts:216` | OPEN   |
| `loggerId` in public events GET (BUG-095)  | Logger identity exposed to unauthenticated callers | `events/route.ts:38`            | OPEN   |
| Event type string mismatch (BUG-083)       | OWN GOAL may not match → score not credited        | Multiple route files            | **RESOLVED, code fix + live visual confirmation both done** (`efb0081` session 38D; visually confirmed session 53, 2026-08-21). Real throwaway match, real `POST /api/matches/[id]/events` with `type: 'Own Goal'` (the exact string `FootballLogger.tsx` sends) and `minute: 34` against staging: Timeline tab correctly rendered "34' Own Goal by TOJU, Wolves FC", score correctly credited to the opposing team (1-0), `football_player_stats.own_goals` correctly incremented. See `BACKLOG.md` BUG-083. |

### Data Integrity

| Gap                                                     | Risk                                                                                                                                                                   | Location                               | Status     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------- |
| BUG-011 playerStats corruption (718 goals/133 apps)     | Historical stats unreliable                                                                                                                                            | `footballPlayerStats`                  | OPEN       |
| BACKLOG-105 — penalty shootout full implementation      | Shootout goals corrupt match score                                                                                                                                     | `events/route.ts` (interim guard only) | RESOLVED — this row was stale. Distinct `PEN_SCORED`/`PEN_MISSED`/`PEN_SAVED` event types (zero stat-write cases by construction), dedicated `shootout_home_score`/`shootout_away_score` columns, atomic score isolation — shipped session 48, remaining display/rules gaps closed session 53. See `BACKLOG.md` BACKLOG-105. |
| TD-011 — `season: '2024'` hardcoded                     | Stats written to wrong season bucket                                                                                                                                   | `events/route.ts:271,328`              | RESOLVED, session 53 — this row was stale. `updatePlayerStats()` rewritten to derive `season` from the match's real competition, scoping every stat lookup/upsert accordingly instead of a lifetime-blended `WHERE playerId = ?`. See `BACKLOG.md` BACKLOG-126. |
| BACKLOG-094 — eyePoints never returned from API         | Eye Point Awards panel always empty                                                                                                                                    | `matches/[id]/route.ts`                | OPEN       |
| Basketball stats write path unverified                  | `basketballPlayerStats` has 0 rows in DB — stat-write branch in `updatePlayerStats()` may be broken or untested                                                        | `events/route.ts` basketball branch    | UNVERIFIED |
| `fixtures` table relationship to `matches` undocumented | Both tables exist in schema; Three Critical Flows only reference `matches` — `fixtures` purpose unclear, ambiguity must be resolved before multi-competition expansion | `src/db/schema.ts`                     | OPEN       |

---

_Document generated from full codebase read: server.js, src/lib/match-state-manager.ts, src/hooks/useWebSocket.tsx, src/db/schema.ts, src/lib/auth.ts, src/lib/notifications/_, public/sw-admin.js, src/app/api/_ (110 routes), BACKLOG.md, BUILD_JOURNAL.md sessions 27–38C._
