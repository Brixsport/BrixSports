# BrixSports — Claude Code Project Rules

## Project Tier
MVP → moving toward PRODUCTION

## Stack
- Frontend: Next.js (App Router), TailwindCSS, PWA
- Backend: Next.js API Routes
- Database: Turso (LibSQL) via Drizzle ORM
- Auth: Custom JWT (jose / jsonwebtoken)
- Key libraries: Cloudinary (images), Sentry (monitoring), VAPID (push notifications)

## Scope Boundaries
- Live match creation and management by admins
- Real-time event logging by assigned loggers (goals, fouls, cards, substitutions)
- Public livescore page — unauthenticated viewers, live score updates
- Player and team data management
- Competition and fixture management
- Logger assignment to matches
- Match status lifecycle (PENDING → LIVE → FINISHED)

## Explicit Out of Scope
- Payment, sponsorship, or financial processing
- Social features (comments, reactions, follows, DMs)
- External league API integrations
- Automated video or AI-based score detection
- Push notification campaigns
- Advanced analytics dashboards
- Role-based access beyond: Super Admin → Competition Admin → Team Manager → Logger → Viewer

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

- Viewers NEVER have a session. Never assume otherwise.
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

### API Routes
- Every /api/admin/* route MUST call getAuthUser(request) and verify user.role === 'admin'
- Middleware is a first layer only — handlers must not rely on it as the sole auth check
- Every list endpoint MUST have a .limit() clause — no unbounded queries ever
- API responses must return shaped DTOs, never raw Drizzle/DB rows
- Public endpoints (/api/matches, /api/players) must never return internal fields

### MCP Access
- brixsports-db MCP is READ-ONLY — token is physically incapable of writes
- Never use MCP query results to infer write patterns or schema mutations
- Use MCP for: schema inspection, query planning, data verification only

### Database
- All DB operations must be wrapped in try/catch/finally
- No raw SQL strings — use Drizzle query builder only
- Write operations that affect match state must be atomic or handle partial failure explicitly

### Auth
- JWT validation is server-side in every protected handler
- Token expiry must return 401 with a clear message — never silently fail
- createdBy / updatedBy audit fields must always pull from the verified session — never hardcoded, never client-passed

### Real-time
- Live update mechanism must have a fallback if the channel drops
- Viewer must see stale data clearly on failure, not a crash
- Target update latency: under 5 seconds from event save to public display

---

## Public API — Fields BANNED from any public response (NDPR/GDPR)

- assignedLoggers (entire object)
- assignedLoggers.email
- approvedBy
- approvalStatus
- managerNotes
- loggerId
- profileId
- organizationAffiliations
- memberships

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

## Anti-Patterns — Flag Immediately

Flag if any of these are found or about to be introduced:

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
- HTTP codes: 401 unauth, 403 forbidden, 422 validation, 500 server error
- All created artifacts (test scripts, seed scripts, etc.) go in /dev/ at project root
- Never return raw database errors to the client
- Sentry is configured — unhandled errors must propagate, not be swallowed

---

## PWA / Mobile Rules (Loggers use mobile during live matches)
- Logger interface must work on Chrome Android and Safari iOS
- Network drops must be handled — queue events, retry, never silently lose data
- Every logger action needs clear feedback: saved / saving / failed
- No page refresh required to continue logging mid-match
- Logger session must persist for at least 120 minutes without re-login

---

## Structured Output (Mandatory for every implementation)

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

### Backlog Close — Mandatory Before Moving On

Before committing or starting the next task, update `.agents/dev/BACKLOG.md`:

1. **Bug fixed** → change `**Status:** OPEN` to `**Status:** RESOLVED — YYYY-MM-DD (commit <hash>)` and strike through the heading (`~~BUG-XXX~~`). Move to Bugs (Resolved) section if it is in Bugs (Open).
2. **Feature complete** → change `**Status:** OPEN` to `**Status:** COMPLETE — YYYY-MM-DD`. Strike through the heading if the item is fully done.
3. **Partially resolved** → update the status line with what changed and what remains open. Never leave the status line unchanged after a partial fix.
4. **Stale blocker note** → if the fix removes a dependency that another item listed (e.g. "Blocked by BUG-XXX"), update that item's notes too.
5. **Priority drift** → if resolving this item changes the priority of a related item, update that item's `**Priority:**` line.

**Never commit a fix without closing or updating its corresponding backlog entry in the same commit.**

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

## Compact Policy

When summarizing this conversation, preserve:
- All architectural decisions and their rationale
- Bug root causes and their fixes (reference BUG-XXX)
- Any changes to the Three Critical Flows
- Auth and permission decisions
- Files created or modified
- Anything explicitly rejected and why

Summarize briefly:
- Exploration attempts and dead ends
- Repeated debug iterations (keep final solution only)

---

## Git Governance

### Branch Model
```
main        ← production (Vercel prod, prod Turso DB)
dev         ← staging/integration (Vercel staging, staging Turso DB)
feature/*   ← new features — branch off dev, PR back to dev
fix/*       ← bug fixes — branch off dev, PR back to dev
hotfix/*    ← urgent prod fixes — branch off main, PR to main,
              auto-syncs back to dev after merge
```

### Rules
- All new work branches off `dev`, not `main`
- PRs to `main` require 2 reviews (1 currently — raise when team grows)
- PRs to `dev` require 1 review
- Squash merge for `feature/*` and `fix/*`
- Merge commit for `hotfix/*` (preserve audit trail)
- Schema migrations run against staging first, then prod — no exceptions
- No direct commits to `main` or `dev`
- `dev` must always be deployable — do not merge broken code

### Environments
- `main` deploys to brixsports.com (prod Vercel project)
- `dev` deploys to staging.brixsports.com (staging Vercel project)
- Each PR gets a Vercel preview deployment automatically
- `JWT_SECRET` and `CRON_SECRET` are different per environment
- `NEXT_PUBLIC_ENV` = `production` | `staging` | `development`

### Workflow — Feature Work
```bash
git checkout dev && git pull
git checkout -b feature/your-feature-name
# work, commit incrementally
git push origin feature/your-feature-name
# open PR → target dev
# PR guard checks target, Vercel builds preview
# 1 review required, merge with squash
```

### Workflow — Hotfix
```bash
git checkout main && git pull
git checkout -b hotfix/description
# fix, commit
git push origin hotfix/description
# open PR → target main
# PR guard checks target, 2 reviews required
# merge commit (not squash)
# auto-sync action merges main back into dev automatically
```

---

## Session Conventions

### Before Every Session
- Read `.agents/rules/backlog.md` (if it exists) and `.agents/dev/PROJECT_HISTORY.md`
- Check current branch — all work on `feature/*` or `fix/*` off `dev`, never directly on `dev` or `main`
- Run `tsc --noEmit` before touching any file to establish a baseline error count

### Environment Variables
- Never read `process.env` directly in application code
- Always import from `src/lib/env.ts` instead
- Add new vars to `env.ts` first, then document in `.env.example`
- `validateEnv()` in `env.ts` fails fast at startup if required vars are absent

### Before Every Commit
- Run `tsc --noEmit` — zero new errors only (pre-existing errors in `src/db/` scripts are known and acceptable)
- Confirm you are on the correct branch
- **Update `.agents/dev/BACKLOG.md`** — close or update every BUG/BACKLOG entry touched by this commit (see Definition of Done → Backlog Close). This is not optional. Do not commit without it.
- Write descriptive commit messages using these types:
  - `feat:` — new feature
  - `fix:` — bug fix
  - `chore:` — config, tooling, docs
  - `refactor:` — code restructure with no behaviour change
  - `test:` — test additions
- Never commit `.env` files, `dev/` scripts, or `node_modules`

### Schema Migrations
- Always run `db:push` against staging first
- Verify on staging before running against prod
- Log every migration in `.agents/dev/RUNLOG.md`

### DB Scripts
- All scripts go in `dev/` (gitignored)
- Every run logged in `.agents/dev/RUNLOG.md`
- Include: date, script name, what it did, row counts affected

### Security Rules — Mandatory Read
Before writing any script or code that touches:
- The database (Turso/Drizzle, any direct libsql client)
- Auth tokens, JWT, or session handling
- Environment variables containing secrets
- API keys (Cloudinary, Sentry, VAPID, AWS)
- Any dev/ script that connects to staging or prod

**Read `.agents/rules/security.md` first. Violations are blocking.**

---

## Cross-Project Knowledge
Read at session start: ~/.claude/knowledge/global-patterns/patterns.md
Apply all anti-patterns, settled decisions, and stack gotchas recorded there.
