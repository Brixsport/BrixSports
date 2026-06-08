---
trigger: always_on
---

> **ENFORCE: All rules in this file are blocking. Violations must be surfaced and resolved before any implementation proceeds.**

# BrixSports — Workspace Rules

## Project Tier

MVP → moving toward PRODUCTION

## Stack

- Frontend: Next.js (App Router), TailwindCSS, PWA
- Backend: Next.js API Routes
- Database: Turso (LibSQL) via Drizzle ORM
- Auth: Custom JWT (jose / jsonwebtoken)
- Key libraries / SDKs: Cloudinary (images), Sentry (monitoring), VAPID (push notifications)

---

## Scope Boundaries

- Live match creation and management by admins
- Real-time event logging by assigned loggers (goals, fouls, cards, substitutions)
- Public livescore page — unauthenticated viewers, live score updates
- Player and team data management
- Competition and fixture management
- Logger assignment to matches
- Match status lifecycle (PENDING → LIVE → FINISHED)

---

## Explicit Out of Scope

- Payment, sponsorship, or financial processing
- Social features (comments, reactions, follows, DMs)
- External league API integrations
- Automated video or AI-based score detection
- Push notification campaigns
- Advanced analytics dashboards
- Role-based access beyond the defined hierarchy (Super Admin → Competition Admin → Team Manager → Logger → Viewer)

---

## Actor Model

Every feature must be evaluated against this hierarchy:

```
Super Admin
  └── Competition Admin
        └── Team Manager
              └── Logger (match operator — authenticated, mobile)
                    └── Viewer (public — always unauthenticated)
```

- Viewers never have a session. Never assume otherwise.
- A valid JWT does NOT equal valid permissions. Always verify role explicitly.
- Admin API routes must call getAuthUser(request) AND check user.role === 'admin' — never trust middleware alone.

---

## The Three Critical Flows

These must NEVER break. Every change must preserve them:

**Flow A — Match Creation**
Admin creates match → assigns loggers → match appears on public livescore

**Flow B — Live Event Logging**
Logger logs event → event saves to DB → public score updates in real time

**Flow C — Public Livescore**
Viewer opens page → sees live match → score updates without manual refresh

Any implementation touching these flows requires explicit manual testing before deploy.

---

## Architecture Rules

**API Routes**

- Every /api/admin/\* route MUST call getAuthUser(request) and verify user.role === 'admin'
- Middleware is a first layer only — handlers must not rely on it as the sole auth check
- Every list endpoint MUST have a .limit() clause — no unbounded queries ever
- API responses must return shaped DTOs, never raw Drizzle/DB rows
- Public endpoints (/api/matches, /api/players) must never return internal fields

**Database**

- All DB operations must be wrapped in try/catch/finally
- No raw SQL strings — use Drizzle query builder only
- Write operations that affect match state must be atomic or handle partial failure explicitly

**Auth**

- JWT validation is server-side in every protected handler
- Token expiry must return 401 with a clear message — never silently fail
- createdBy / updatedBy audit fields must always pull from the verified session — never hardcoded, never client-passed

**Real-time**

- Live update mechanism must have a fallback if the channel drops
- Viewer must see stale data clearly on failure, not a crash
- Target update latency: under 5 seconds from event save to public display

---

## Public API — Fields Never Exposed

These fields are BANNED from any public API response (NDPR/GDPR):

- assignedLoggers (entire object — strip from public match responses)
- assignedLoggers.email
- approvedBy
- approvalStatus
- managerNotes
- loggerId
- profileId
- organizationAffiliations (internal IDs)
- memberships (internal relationship metadata)

Public match response: scores, status, teams, competition, venue, startTime, events (type, minute, team, player jersey name only)
Public player response: name, jerseyName, number, position, team name, rating

---

## Feature Volatility

### 🟢 Stable — Touch Freely

- Match creation and management
- Event logging (goals, fouls, cards, substitutions)
- Public livescore page
- Logger dashboard
- Admin match list and approval

### 🟡 Caution — Test After Every Change

- Logger assignment to matches
- Match status transitions (PENDING → LIVE → FINISHED)
- Real-time update mechanism
- JWT auth flow and session handling

### 🔴 High Volatility — Do Not Touch Without Explicit Brief

- Ads feature (recently added, untested under load)
- Lineup Builder (marked NEW, unknown stability)
- Transfers page (intersects BUG-004)
- User management admin panel (intersects BUG-002)
- News / articles (intersects BUG-006 XSS)
- src/app/api/auth/test/route.ts (intersects BUG-003 — this file should be deleted)

---

## Vibe-Coding Anti-Patterns

Flag immediately if any of these are found or about to be introduced:

- Middleware matcher and internal logic check do not match
- try/catch without finally in any DB operation
- List query with no .limit() clause
- createdBy, updatedBy, or any audit field set to a hardcoded string
- Auth check that only runs client-side with no server-side counterpart
- Business logic that assumes valid token = valid role
- TODO or FIXME comment touching auth, permissions, or data access
- Commented-out security check with // temp or // disable for testing
- UI shows success state before server response is confirmed

---

## Error Handling Rules

- All errors must surface in both UI and server logs — no silent failures
- Match logging errors must show a clear message to the logger — never appear to succeed when they didn't
- Use correct HTTP codes: 401 unauth, 403 forbidden, 422 validation, 500 server error
- All created artifacts; test, seed scripts etc should be in '/dev/test/'
- Never return raw database errors to the client
- Sentry is configured — unhandled errors must propagate, not be swallowed

---

## PWA / Mobile Rules

Loggers use mobile devices during live matches:

- Logger interface must work on Chrome Android and Safari iOS
- Network drops must be handled — queue events, retry, never silently lose data
- Every logger action needs clear feedback: saved / saving / failed
- No page refresh required to continue logging mid-match
- Logger session must persist for at least 120 minutes without re-login

---

## Structured Output (Mandatory)

Every implementation response must include:

```
## Module Summary
What was built and why

## Assumptions Made
Explicit decisions not covered by instructions

## Known Bug Intersections
List any BUG-XXX entries this change touches or is near

## Risks / Blockers
Any instability or dependency concern

## File Structure Delta
List of created/modified files

## Test Scenarios
Exact manual steps to verify this works end to end
```

No silent execution. No skipped sections.

---

## Context Log (Mandatory Before Any Implementation)

Before writing code, output:

```
CONTEXT LOG
-----------
✓ drizzle-orm       → query builder, schema, migrations
✓ @libsql/client    → Turso HTTP connection (stateless)
✓ next/server       → middleware, API routes, App Router
✓ jose              → JWT verification server-side
✓ cloudinary        → image upload and delivery
✓ sentry            → error tracking
✗ [any unclear dep] → state assumption explicitly
```

---

## Definition of Done

A feature is complete when:

- Admin can create and publish a match end to end
- Logger can log events in real time from a mobile device
- Public viewer sees live score updates without manual refresh
- All three critical flows work simultaneously without conflict
- No unbounded queries in any involved endpoint
- No internal fields exposed in public API responses
- Error states are visible and actionable
- Manual test scenarios pass on both desktop and mobile

---

## Live Event Readiness Checklist

Before any live match deployment:

- [ ] Match creation → logger assignment → public appearance works end to end
- [ ] Logger session persists 120+ minutes
- [ ] Two simultaneous loggers do not conflict or overwrite
- [ ] Double event submission is prevented or deduplicated
- [ ] Public page updates within 5 seconds of event save
- [ ] Match can be cleanly closed and marked FINISHED
- [ ] Logger interface tested on an actual mobile device
- [ ] All 🔴 High Volatility features are disabled or hidden from the UI

---

## Cross-Project Knowledge

Read at session start: C:\Users\Wise\.gemini\antigravity\knowledge\global-patterns\artifacts\patterns.md
Apply all anti-patterns, settled decisions, and stack gotchas recorded there.

---

## Final Directive

Build Brixsports as:

- **reliable during live events** — a match running cleanly beats ten unshipped features
- **honest about errors** — never hide failures from operators or loggers
- **simple for non-technical users** — loggers are not developers
- **defensible at the API layer** — public endpoints expose only what viewers need

Not:

- over-engineered
- feature-complete before stable
- dependent on a single point of failure

## all creted artficial artficats with developing like query, test script, etc should go to the root/dev/ folder
