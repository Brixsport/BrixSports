# BrixSports — Phase Roadmap Assessment
> Audit Date: 2026-06-05 | Auditor: Antigravity

---

## Phase Assessment Summary

### Phase 1 — Dev/Production Infrastructure

**What exists today:**
- Single `main` branch in git
- Vercel deployment configured (`vercel.json` present)
- Railway WS server configured (`render.yaml` present — note: render.yaml suggests Render, not Railway)
- Local `.env` with 33 keys injected by dotenv
- Turso DB connection via `TURSO_CONNECTION_URL` env var
- `local.db` SQLite file for local development

**What is missing:**
- No staging branch (`dev/staging`)
- No separate Turso DB for staging
- No separate WS server for staging
- No environment parity checklist
- No branching strategy enforced
- `render.yaml` suggests Render hosting, not Railway — unclear which is active production WS server

**Complexity:** Medium
**Blocking anything?** YES — blocks safe iteration without touching production
**Recommended:** DO FIRST before Phase 2+ work touches prod

---

### Phase 2 — Bug Fixes & Pending Blockers

**Overall complexity:** Low to Medium per bug | **Risk:** High if done wrong

#### BUG-001: Middleware bypass
- **File confirmed:** `src/middleware.ts`
- **Fix complexity:** Small — change the internal string check from `/admin` to `/api/admin`
- **Risk if fixed wrong:** Medium — could accidentally block legitimate routes
- **Recommended fix order:** 1st

#### BUG-002: Admin routes missing auth
- **Files confirmed:** `src/app/api/admin/users/route.ts`, `ads/route.ts`, `settings/route.ts`, `organizations/route.ts`
- **Fix complexity:** Small per file — add `getAuthUser` + role check at top of each handler
- **Risk if fixed wrong:** Low — only makes routes more restrictive
- **Recommended fix order:** 2nd (immediately after BUG-001)

#### BUG-003: Debug auth endpoint
- **File confirmed:** `src/app/api/auth/test/route.ts`
- **Fix complexity:** 1-line (delete file)
- **Risk if fixed wrong:** None — file should not exist in production
- **Recommended fix order:** 1st (can do simultaneously with BUG-001)

#### BUG-004: Hardcoded createdBy
- **File confirmed:** `src/app/admin/transfers/page.tsx` L189
- **Fix complexity:** Small — read user from auth context and pass actual user ID
- **Risk if fixed wrong:** Low
- **Recommended fix order:** 4th

#### BUG-005: Unbounded queries
- **Files:** `/api/teams/route.ts`, `/api/players/route.ts`, `/api/loggers/route.ts`
- **Fix complexity:** 1-line per file — add `.limit(50)` to each query
- **Risk if fixed wrong:** Low
- **Recommended fix order:** 3rd

#### BUG-006: XSS via news content
- **File:** `src/lib/utils/format-content.ts`
- **Fix complexity:** Medium — need to sanitize HTML input before storage and/or sanitize at render
- **Risk if fixed wrong:** Medium — must not break legitimate HTML content in articles
- **Recommended fix order:** 5th

#### BUG-007: Logger emails in public response
- **File:** `src/app/api/matches/route.ts` L65-91
- **Fix complexity:** Small — strip `email` from the `assignedLoggers` map before returning
- **Risk if fixed wrong:** Low
- **Recommended fix order:** 2nd (NDPR violation — should be treated as Critical)

#### BUG-008: Logger assignment race condition
- **File:** `src/app/api/matches/[id]/assign-logger/route.ts`
- **Fix complexity:** Medium — needs either a DB unique constraint on (matchId, loggerId) or transaction-wrapped upsert logic
- **Risk if fixed wrong:** Medium — can break logger assignment if constraint not added correctly
- **Recommended fix order:** 6th

**Additional fixes from this audit:**
- BUG-009 (NEW): Add auth check to `POST /api/matches`
- BUG-010 (NEW): Verify and fix auth in `POST /api/events`
- BUG-011 (NEW): Audit and fix player stats data (718 goals anomaly)
- BUG-012 (NEW): Fix SAVE/BLOCK/GOAL casing in rating calculator

**Recommended Phase 2 fix order:**
1. BUG-003 — Delete debug file (30 seconds)
2. BUG-001 — Fix middleware matcher (15 minutes)
3. BUG-002 — Add auth to all /api/admin/* handlers (1 hour)
4. BUG-007 — Strip emails from public response (30 minutes)
5. BUG-009 — Add auth to POST /api/matches (30 minutes)
6. BUG-005 — Add .limit() to unbounded queries (30 minutes)
7. BUG-004 — Fix hardcoded createdBy (30 minutes)
8. BUG-012 — Fix casing in rating calculator (1 hour)
9. BUG-006 — Fix XSS in news content (2-3 hours)
10. BUG-008 — Fix logger assignment race condition (2-3 hours)

---

### Phase 3 — UI & Experience Cleanup

**What exists today:**
- Admin UI has loading states, error boundaries, skeleton loaders, toast notifications in admin section
- Public pages: mostly CSR with no loading states or skeleton screens visible
- No empty state components on most public pages
- Mobile nav via `BottomNav.tsx` present
- `ErrorBoundary` exists for admin pages; public pages use `error.tsx` and `global-error.tsx`

**What is missing:**
- Consistent loading states on all public pages
- Empty states for all public list views
- Mobile responsiveness audit
- Console warning cleanup (competition NaN warnings known)
- Accessibility pass

**Complexity:** Medium
**Blocking anything?** No — UX quality work
**Recommended:** Can wait until Phase 2 security bugs fixed

---

### Phase 4 — Pending Competitions & Live Data

**What exists today:**
- 3 competitions in DB — all completed (BUSALYMPICS, BUSA League Football, BUSA League Basketball)
- 59 matches — all FINISHED
- Backfill script exists and is functional
- Physical sheet sync UI exists (`/admin/matches` with import functionality)
- 236 teams — mostly seeded from NPUGA/BUSA structure

**What is missing:**
- No active or upcoming competitions
- Bells Intercollege competition not yet created
- Intercollege teams (CNAS, CENG, CMANS, CENVS) exist but have no competition entries
- No current season matches
- competitionTeamEntries table is empty (0 rows) — teams not formally linked to competitions via the join table

**Complexity:** Low (data entry / backfill) | Medium (new competition structure)
**Blocking anything?** YES — system looks dormant without live competitions
**Recommended:** Do after Phase 2 security fixes

---

### Phase 5 — System Audit & Testing

**What exists today:**
- This audit (SYSTEM_ARCHITECTURE.md) serves as the module/feature inventory
- No unit tests found in repository
- No integration tests found
- References to k6 load testing scripts but files not found in repo

**What is missing:**
- Unit tests for all utility functions and services
- Integration tests for all API routes
- E2E tests for critical flows
- Load tests
- The k6 scripts mentioned in BACKLOG may not be committed

**Complexity:** High
**Blocking anything?** No (directly) — but production deployment without tests carries high risk
**Recommended:** Can wait — but plan before production launch

---

### Phase 6 — Tier Validation

#### MVP Definition — What Is Working?

| MVP Feature | Status | Evidence |
|-------------|--------|---------|
| View live scores | ✅ Works | `/live` page polls /api/matches, Socket.IO for real-time |
| View match history | ✅ Works | 59 FINISHED matches visible in /api/matches |
| View player stats | ⚠️ Partial | Stats exist but 718 goals vs 133 appearances is data anomaly |
| Admin logs a match | ✅ Works | Backfill route confirmed working with proper auth |
| Live event logging (logger) | ✅ Works | FootballLogger + /api/events + Socket.IO pipeline confirmed |
| Competition standings | ⚠️ Partial | 22 standings rows exist; update mechanism is manual |

**Current Assessment: MVP-incomplete**

Reason: The core flows (A, B, C) are technically functional but:
- 3 open Critical security bugs (BUG-001, BUG-002, BUG-006, BUG-007) make it unacceptable for production
- Player stats data is demonstrably corrupted (718 goals anomaly)
- No active competitions or live matches (system is dormant)
- Debug endpoint (BUG-003) is live in production

#### What Blocks Production?

**Security blockers (non-negotiable before production):**
1. BUG-001 — Middleware bypass: admin API routes accessible without auth
2. BUG-002 — /api/admin/* routes have no auth enforcement
3. BUG-003 — Debug endpoint leaking auth state
4. BUG-006 — Stored XSS via news content
5. BUG-007 — Real user emails in public API (NDPR violation)
6. BUG-009 — Match creation endpoint unauthenticated
7. JWT_SECRET fallback to `'your-secret-key-change-in-production'` — must be enforced as required env var
8. Rate limiting on all public endpoints (none exists)
9. Security headers (CSP, HSTS, X-Frame-Options) — not audited

**Stability blockers:**
10. Player stats data corruption must be resolved
11. Logger assignment race condition (BUG-008)
12. Event type casing mismatch breaks rating calculations

**Data integrity blockers:**
13. Intercollege teams not linked to org hierarchy
14. Duplicate org records in organizations table
15. Competition start/end dates always null (BACKLOG-003)

**Missing production infrastructure:**
16. Sentry not in package.json — error monitoring claim in CLAUDE.md is false
17. No uptime monitoring
18. No rate limiting middleware
19. Staging environment does not exist

**VERDICT: MVP-incomplete**

The system works well enough for a demo but has multiple critical security vulnerabilities and data integrity issues that make production deployment inadvisable without the Phase 2 fixes.

---

### Phase 7 — Revenue & Monetisation

#### Ads System — Current State
- `advertisements` table exists with 1 row
- `AdBanner` component exists at `src/components/ads/AdBanner.tsx`
- Admin ad management page exists at `/admin/advertisements`
- `GET/POST /api/admin/ads` and `PATCH/DELETE /api/admin/ads/[id]` API routes exist
- **BUT:** All `/api/admin/ads` routes have NO auth check (BUG-002)
- Ad serving endpoint `GET /api/ads` appears to exist
- Impression and click tracking columns exist in schema

**Status:** Infrastructure exists but auth is broken and it's untested under load (marked HIGH VOLATILITY in CLAUDE.md)

#### Manager Center — Current Status
- `/admin/manager` page exists but is marked as a stub
- No dedicated manager role in the system — only `admin`, `logger`, `user`
- No Team Manager API routes identified

**Status:** Not built — stub page only

#### Prerequisites Before Monetisation:
1. Complete Phase 2 security bug fixes (especially BUG-002 which directly breaks ad admin auth)
2. Fix and load-test the ads feature
3. Define the Team Manager role and permissions
4. Complete Phase 6 tier validation — confirm MVP-complete before adding revenue features
5. Implement rate limiting (prevents ad fraud)
6. Implement proper analytics/tracking (privacy-compliant)

---

## Final Summary

```
BRIXSPORTS SYSTEM HEALTH REPORT
================================
Audit date: 2026-06-05
Auditor: Antigravity

Database:
  Total tables: 68 (including FPL and extended schemas)
  Active tables with data: ~25
  Key table row counts:
    organizations: 172
    teams: 236
    players: 179
    matches: 59 (all FINISHED)
    match_events: 154
    competitions: 3 (all completed)
    standings: 22
    users: 18
    loggers: 6
    player_stats: 65 (data anomaly: 718 goals vs 133 appearances)

Codebase:
  Total API routes: ~140 route.ts files
  Total admin pages: 21
  Total public pages: ~35
  Largest concern files:
    src/app/api/matches/route.ts — no POST auth, email leak
    src/app/api/admin/users/route.ts — no auth at all
    src/app/api/auth/test/route.ts — should be deleted
    src/app/admin/transfers/page.tsx — hardcoded audit field

System Health Score: 5/10
Justification:
  - Core three flows (create match, log event, view livescore) work functionally
  - Real-time architecture is sound (Socket.IO + fallback polling)
  - Schema is well-designed with proper normalization
  - BUT: 4 open Critical security bugs including NDPR violation and auth bypass
  - BUT: Debug endpoint live in production
  - BUT: Player stats data is corrupted (718 goals anomaly)
  - BUT: Sentry monitoring claimed but package not installed
  - BUT: All 3 competitions are completed — system is effectively dormant
  - BUT: 30+ unpinned production dependencies

Current Tier: MVP-incomplete

Top 5 things to fix before production:
  1. Delete src/app/api/auth/test/route.ts (BUG-003) — debug endpoint live
  2. Add getAuthUser + role checks to ALL /api/admin/* routes (BUG-002) — complete auth bypass
  3. Strip assignedLoggers.email from public /api/matches response (BUG-007) — NDPR violation
  4. Add auth check to POST /api/matches (BUG-009) — anyone can create matches
  5. Fix stored XSS in news content formatting (BUG-006) — security vulnerability

Recommended next session starting point:
  Phase 2 Bug Sprint — start with BUG-003 (delete file), then BUG-002 (add auth to
  all /api/admin/* handlers), then BUG-007 (strip emails). These three can be done in
  under 2 hours and close the most critical attack surface. Then fix BUG-009 (POST /api/matches
  auth) and BUG-005 (add .limit() to unbounded queries).

Phase execution order recommendation:
  1. Phase 2 (Bug Fixes) — non-negotiable before any live match
  2. Phase 4 (Live Data) — create new season competitions and backfill data
  3. Phase 1 (Infrastructure) — staging environment for safe iteration
  4. Phase 3 (UI Cleanup) — user experience improvements
  5. Phase 6 (Tier Validation) — formal audit against MVP definition
  6. Phase 5 (Testing) — build test suite before scaling
  7. Phase 7 (Revenue) — only after MVP-complete validated
  8. Phase 8 (E2E Testing) — final sign-off checklist

Rationale for this order:
  Phase 2 first because the system has critical security bugs that must be closed
  before any public event. Phase 4 before Phase 1 because the system needs live
  competitions to be useful and that's data entry work that can happen on current
  infrastructure. Phase 1 staging environment before Phase 3+ to avoid iterating
  directly on production. Phase 6 validation before Phase 7 monetisation because
  revenue features on an insecure foundation create compounded risk.
```
