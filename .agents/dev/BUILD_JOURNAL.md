# BrixSports — Build Journal

## Architecture Decisions

- **Database**: Turso (LibSQL) via Drizzle ORM
- **Auth**: Custom JWT (jose / jsonwebtoken). Validation is strictly server-side.
- **Real-time**: Custom WebSockets broadcasting events and score updates.
- **Client**: Next.js App Router with TailwindCSS. PWA implementation required for offline event queueing for loggers.

---

## Sessions

### Session 5 — 2026-06-08

**Focus:** BACKLOG-020 Block 6 — Full system audit. Sweep all routes, API endpoints, DB schema, components, and services. Produce SYSTEM_AUDIT.md.

**Built:**
- `.agents/dev/SYSTEM_AUDIT.md` — 14-section audit: feature state matrix (WORKING/PARTIAL/BROKEN/NOT BUILT), full API security inventory, DB table usage map, component catalogue, backscoping candidates, dead packages, priority fix list of 10 items before production.

**Bugs encountered:** None during audit itself — this was a read-only sweep.

**Resolved:** None — audit-only session. No code changed.

**New bugs filed from audit findings:**
- BUG-015 *(CRITICAL)* — `PATCH /api/matches/[id]` has no auth. Any caller can update match scores, status, `approvedBy`. File: `src/app/api/matches/[id]/route.ts`.
- BUG-016 *(HIGH)* — `POST /api/competitions` has no auth. Any caller can create a competition. File: `src/app/api/competitions/route.ts`.
- BUG-017 *(HIGH)* — Three debug/test routes live with no auth: `/api/notifications/debug`, `/api/notifications/test`, `/api/email/test`. Expose push subscriptions, VAPID keys, and trigger real email sends.
- BUG-018 *(MEDIUM — NDPR)* — `GET /api/matches/[id]` returns `approvalStatus`, `managerNotes`, `loggerId` in public response — banned internal fields.
- BUG-019 *(MEDIUM)* — `GET /api/admin/infrastructure` and `GET /api/analytics/system` have no handler-level auth — middleware-only, callable cross-origin.
- BUG-020 *(MEDIUM — Flow C)* — `/live` page fetches matches once on mount. No polling interval, no WS subscription. Public viewer must manually refresh to see score changes.
- BUG-021 — `POST /api/notifications/subscribe` no auth gate.
- BUG-022 — Unbounded queries on `GET /api/competitions`, `GET /api/events`, `GET /api/matches/[id]/events`.
- BUG-023 — `schema-nesa-registrations.ts` broken imports (will crash on use).
- BUG-024 — Duplicate `/match/[id]` and `/matches/[id]` routes.

**New backlog items filed:**
- BACKLOG-028 — Backscope dead/partial features from public nav (fpl, predictions, scouts, nesa-registration, auth/signin, polls)
- BACKLOG-029 — Auth audit sweep: 17 endpoints flagged "auth unknown"
- BACKLOG-030 — Clean up deprecated mock-data.ts imports in 3 components
- BACKLOG-031 — Dead/heavyweight package audit (three.js, babel/parser, downloadjs, dotted-map)

**Key audit findings:**
- Flow A (Match Creation) — WORKING ✓
- Flow B (Live Event Logging) — WORKING ✓
- Flow C (Public Livescore) — PARTIAL — `/live` page has no real-time update mechanism (BUG-020)
- Two conflicting auth systems coexist: custom JWT (active) + next-auth (vestigial, BACKLOG-009)
- 6 dead DB tables: `individualSportStats`, `competitionSportSettings`, `teamForm`, `userActivity`, `systemSettingsHistory`, `newsRelations`
- 3 dead packages: `resend`, `stripe`, `next-auth` (vestigial)
- `next-auth` Google OAuth still active via `[...nextauth]` route — two Google sign-in paths exist simultaneously

**Deferred:**
- BACKLOG-026 (AWS SES fix) — skipped per Richard's instruction, stays in backlog
- Manual staging setup (Turso DB, Vercel project, Railway WS) — still pending
- Fixing any of the newly filed bugs — audit only this session

**Next session:** Fix BUG-015 first (`PATCH /api/matches/[id]` auth) — CRITICAL, directly compromises match integrity. Then BUG-016 (competitions POST), BUG-017 (delete/gate debug routes), BUG-018 (strip internal fields from public match response). All four are small targeted fixes in known files.

---

### Session 1 - May 3, 2026

- Executed the "May 9th Event Stability" Dry-Run Audit on critical paths.
- Uncovered severe zero-auth vulnerability in `/api/events` (anyone can write events).
- Uncovered critical performance threat: `/api/matches` has an unbounded polling query fetching all matches every 30s.
- Logged all new and existing bugs into `BACKLOG.md`.
- **FIXED**: Added `.limit(50)` to `/api/matches` GET handler (BUG-005 partial).
- **FIXED**: Added `getAuthUser()` + logger assignment check to `/api/events` POST (AUDIT-001).
- Built complete `.env` from codebase scan (29 keys across 30+ files). Added `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `WS_API_KEY`, Cloudinary server keys, and AWS SES keys that were missing from `.env.example`.
- Discovered WS server on Railway is down — `bun.lock` out of sync with `package.json` causing frozen lockfile build failure.

### Session 2 — May 4, 2026

**Focus:** Infrastructure audit and high-priority bug remediation.
**Built:**

- `src/app/api/matches/route.ts`: Coerced `competitionId` to `null` if empty string to fix 500 error on match creation.
  **Bugs encountered:**
- **Match Creation 500**: Root cause was `competitionId: ""` triggering a Foreign Key violation in LibSQL (empty string != null).
- **NDPR/GDPR Leak**: `assignedLoggers` emails and internal fields exposed in public `/api/matches` response.
- **Race Condition (BUG-008)**: Match logger assignment lacks atomic uniqueness checks.
  **Resolved:**
- Fixed the 500 error in match creation by sanitizing `competitionId` before insert.
- Audited `ws-server/index.js` for environment variables; identified `PORT`, `WS_API_KEY`, `VERCEL_URL`, and `NEXT_PUBLIC_APP_URL` as critical for Railway deployment.
  **Deferred:**
- Resolving the privacy leak in `/api/matches` (requires role-based branching).
- Atomic refactor for logger assignment.
  **Next session:**
- Complete Railway deployment fix: `git add bun.lock`, `git commit -m "fix: update bun lockfile"`, `git push`.
- Verify WebSocket connectivity once Railway build passes.
- Implement response sanitization for `/api/matches` to prevent email leaks.

### Session 6 — 2026-06-08

**Focus:** Phase 1 staging scaffold — infrastructure, governance, security hardening, env management.

**Built / Changed:**

- `src/middleware.ts` — Staging-wide JWT auth gate added (`env.isStaging`). All routes require valid session on staging except `/api/auth/*` and `/login`. All redirects unified to `/login` (was split between `/login` and `/sign-in` — inconsistency fixed). `JWT_SECRET` constant now reads from `env.jwtSecret`. `process.env.NEXT_PUBLIC_ENV` reads replaced with `env.isStaging` from `src/lib/env.ts`. Matcher expanded to cover all non-static routes.
- `src/lib/env.ts` — **New file.** Centralised typed `env` object (13 vars) + `validateEnv()` startup function that throws on 4 required missing vars. Partial TD-001 implementation — full migration of 30+ `process.env` reads across codebase deferred.
- `.github/workflows/pr-guard.yml` — **New file.** GitHub Action: fails PRs where `feature/*`/`fix/*` don't target `dev`, or `hotfix/*` doesn't target `main`. Posts explanatory markdown comment with branch table on violation. Uses `GITHUB_TOKEN` (no additional secrets needed).
- `CLAUDE.md` — Git Governance section added: full branch model, merge rules, environment table, feature + hotfix workflow scripts. Session Conventions section added: env var rules, pre-commit checks, schema migration protocol, DB script logging rules.
- `.env.example` — `NEXT_PUBLIC_ENV` added with values `development | staging | production` and per-environment instructions.
- `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` — `environment` field added reading `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT`.
- `src/app/api/players/bulk-register/route.ts` — `getAuthUser` + admin role check added at top of POST handler (BUG-013).
- `src/app/admin/matches/page.tsx` — `Match` interface extended with `homeTeam?`/`awayTeam?`. `getTeamName(id)` replaced with `getTeamDisplay(match, side)` that reads embedded `shortName` first, falls back to local teams list, then raw ID (BUG-014).
- `dev/fix-busalympics-remaining-fixtures.ts` — Inserted 3 BUSALYMPICS fixtures as UPCOMING: MD2 G1, MD3 G1, MD3 G2. All 7 BUSALYMPICS fixtures now in DB.
- `.agents/dev/BACKLOG.md` — TD-001 marked IN PROGRESS. BACKLOG-020 (Blocks 1–6) filed. BACKLOG-021 through BACKLOG-027 filed.
- `.agents/dev/RUNLOG.md` — Created. Full audit trail of all DB scripts run across sessions 1–6.
- `.agents/dev/STAGING_PLAN.md` — Created. Full staging environment plan (Vercel, Turso, Railway, parity checklist, implementation order).
- `.agents/dev/CONTEXT_TRANSFER_SESSION_4.md` — Full session handoff doc written.
- Multiple public-facing docs (`CONTRIBUTING.md`, `README.md`, `VERCEL_DEPLOYMENT.md`, `DEVELOPER_ONBOARDING.md`, `src/app/docs/page.tsx`) — old placeholder repo URLs replaced with `github.com/Brixsport/BrixSports`.

**Bugs encountered:**

- **PR guard COMMENT indentation** — bash heredoc with indented body lines caused leading whitespace in all comment lines, breaking markdown table rendering. Root cause: heredoc content was indented to match script indent level. Fix: `cat <<EOF` with content at column 0.
- **Middleware redirect inconsistency** — staging gate redirected to `/sign-in`; admin gate redirected to `/login`. These are two different URLs — one would produce a 404. Root cause: written independently without cross-checking. Fix: unified to `/login` (confirmed canonical URL).
- **Dead pathname check** — `pathname.startsWith('/sign-in?')` in middleware exemption. Root cause: misunderstanding that Next.js middleware `pathname` never contains query string. Fix: removed dead check.

**Resolved:** All three issues above before commit.

**Deferred:**

- TD-001 full migration: 30+ files still read `process.env` directly. `env.ts` file created, `middleware.ts` migrated, remaining files deferred.
- BACKLOG-021 (GitHub Rulesets): PR guard must be tested on a real PR first.
- BACKLOG-026 (broken `AWS_SES_FROM_EMAIL` in prod): confirmed broken, fix deferred — needs Google Console + AWS SES access.
- Manual staging infrastructure: Turso staging DB, Vercel staging project, Railway staging WS — all deferred to manual setup steps.

**Next session:** BACKLOG-026 first (live prod bug — email broken). Then manual staging setup following `STAGING_PLAN.md` section 5 checklist. Then BACKLOG-020 Block 6 (full system audit) once staging is live.

---

### Session 5 — 2026-06-07

**Focus:** Phase 4 — Bells Intercollege data setup: org links, competition enrolment, player affiliations, match fixtures.

**Built / Changed:**

- `dev/fix-backlog007.ts` — UPDATE 4 college teams to set `ownerOrganizationId`. COLNAS/COLENG/COLMANS/COLENVS now linked to their respective org records. Gitignored.
- `dev/fix-backlog008.ts` — INSERT 4 rows into `competition_team_entries` for BUSALYMPICS. Gitignored.
- `dev/fix-college-affiliations.ts` — INSERT 68 `playerTeamAffiliations` rows (college type, isPrimary: false). Dedup-checked per row. Players sourced from `playerOrganizationAffiliations` — no new player profiles created. Gitignored.
- `dev/fix-match-fixtures.ts` — INSERT 4 BUSALYMPICS match fixtures (FINISHED): MD1 G1, MD1 G2, MD2 G2, Final. All confirmed via SELECT after insert. Gitignored.
- `.agents/dev/BACKLOG.md` — BUG-013, BACKLOG-015 through BACKLOG-019 added.
- `.agents/dev/PROJECT_HISTORY.md` — Session 4 entry appended.
- `.agents/dev/CONTEXT_TRANSFER_SESSION_3.md` — Full context transfer doc written.
- `UNIFIED_EVENT_PANEL.tsx`, `UNIFIED_EVENT_PANEL_COMPLETE.tsx` — Deleted from project root (orphaned fragments causing 150+ tsc errors). Confirmed `tsc --noEmit` exits 0 after deletion.

**Bugs encountered:**

- Turso `ConnectTimeoutError` mid-COLENG on college affiliations insert (68 sequential round trips). Script died at `busa-joga-player-8`. Resolved by re-run — dedup check correctly identified all already-inserted rows, inserted the 1 missing row, completed cleanly.

**Resolved:** Turso timeout handled by dedup-safe re-run pattern. No data loss.

**Deferred:**

- BACKLOG-017: 3 missing BUSALYMPICS scores (MD2 COLNAS/COLENG, MD3 COLNAS/COLENVS, MD3 COLMANS/COLENG). Blocking standings.
- BUG-013: `POST /api/players/bulk-register` still has no auth gate.
- BUG-011: playerStats 718 goals anomaly — investigation only, no writes.
- BACKLOG-018: game event logsheets — blocked by BACKLOG-016.
- BACKLOG-019: post-match lifecycle automation — blocked by staging environment.

**Next session:** Confirm 3 missing BUSALYMPICS scores → insert remaining fixtures using `dev/fix-match-fixtures.ts` as template → run standings calculation for BUSALYMPICS.

---

### Session 4 — 2026-06-05

**Focus:** Phase 2 Bug Sprint — full security and stability sweep across all open BUG-001 through BUG-012 items.

**Built / Changed:**

- `src/middleware.ts` — Fixed `pathname.startsWith('/admin')` to also cover `/api/admin`. API routes now return 401/403 JSON instead of a browser redirect. All debug `console.log` statements removed.
- `src/app/api/auth/test/route.ts` — **Deleted.** Debug endpoint was live in production with no auth gate.
- `src/app/api/admin/users/route.ts` — `getAuthUser` + `role === 'admin'` added to GET and PATCH.
- `src/app/api/admin/ads/route.ts` — `getAuthUser` + `role === 'admin'` added to GET (signature fixed to `NextRequest`) and POST. `createdBy` now sources from `authUser.id`.
- `src/app/api/admin/settings/route.ts` — `getAuthUser` + `role === 'admin'` added to GET, PATCH, POST. `updatedBy` now sources from `authUser.id`; client-supplied `userId` body field removed.
- `src/app/api/matches/route.ts` — Stripped `email` from `assignedLoggers` in public GET response. Added `getAuthUser` + admin check to POST. Upgraded both handler signatures from `Request` to `NextRequest`. Import updated to `NextRequest`.
- `src/app/api/events/route.ts` — Added `getAuthUser` to POST (admins pass; loggers verified against `matchLoggerAssignments` for the specific `matchId`). Added role gate to DELETE (admin or logger). GET remains public. Import added.
- `src/lib/services/rating-calculator.ts` — Added `normalizeType()` helper (`s.toLowerCase().replace(/[\s_-]+/g, '')`). All 14 event-type comparisons in `calculateStatsFromEvents` updated to use it, fixing the `Goal`/`GOAL`/`Yellow Card`/`YELLOW_CARD` casing mismatch for live-logged matches.
- `src/app/api/events/route.ts` (score block) — Score trigger and score tally loop updated with same `normalizeType` normalization. Fixes live goals not incrementing the score.
- `src/app/admin/transfers/page.tsx` — `createdBy: 'admin-1'` replaced with `user?.id ?? null` from `useAuth()`. Import added.
- `src/app/api/teams/route.ts` — `.limit(200)` added to GET.
- `src/app/api/loggers/route.ts` — `.limit(200)` added to GET.
- `src/app/api/players/route.ts` — `.limit(500)` added to full-table fetch branch (higher cap — feeds in-memory search).
- `src/lib/utils/format-content.ts` — Added `escapeHtml()` helper. Applied to all user-supplied text before template string injection (headings, list items, blockquotes, paragraph lines). Link handler now validates URLs — only `http://` and `https://` pass; all other schemes become `#`. Closes stored XSS via `dangerouslySetInnerHTML` in news pages.
- `src/app/api/matches/[id]/assign-logger/route.ts` — Race condition fixed: check-then-insert moved into a Drizzle transaction. `assignedBy` now from `authUser.id` (not client body). Missing auth gate added (admin only). Duplicate response changed from 400 to 409.
- `.agents/dev/BACKLOG.md` — BUG-001 through BUG-012 entries added. BUG-001/002/003/004/005/006/007/008/009/010/012 moved to Resolved. BACKLOG-007 through BACKLOG-013 appended.
- `.agents/dev/SYSTEM_ARCHITECTURE.md` — Full system audit written by agent subagent.
- `.agents/dev/PHASE_ROADMAP_ASSESSMENT.md` — Full phase roadmap assessment written by agent subagent.
- `.agents/dev/PROJECT_HISTORY.md` — Created. Session 3 entry written.
- `~/.claude/agent-skills/` — Context docs stored for next.js, drizzle-orm, zod, socket.io, cloudinary, turso.
- `scripts/db-audit-query.ts` — Created by audit agent to run live DB queries.

**Bugs encountered:**

- `POST /api/events` score update was silently broken for live matches: the `normalizeEventType` fix revealed the score trigger (`['GOAL', ...].includes(type)`) was checking UPPERCASE against PascalCase logger output — scores never updated for live goals. Fixed in same pass.
- `format-content.ts` had two distinct XSS vectors: raw HTML injection through unescaped template strings, and `javascript:` URL injection via the link regex replacement.
- `assign-logger` route had no auth check at all — any unauthenticated caller could assign loggers to matches.

**Resolved:** All 11 bugs above. See BACKLOG.md Resolved section for per-bug detail.

**Deferred:**

- BUG-011: playerStats 718 goals / 133 appearances anomaly. Root cause identified (duplicate backfill runs with differing `startTime` formats bypass the duplicate match check). Investigation only — no writes. Requires audit of all matchEvents before any data correction.
- BACKLOG-007 → BACKLOG-008: Intercollege team org links and competition enrollment.

**Next session:** Phase 4 — Bells Intercollege live data. Start with BACKLOG-007: UPDATE intercollege teams (CNAS, CENG, CMANS, CENVS) to set correct `ownerOrganizationId` from the `organizations` table. Then BACKLOG-008: insert `competition_team_entries` rows.

---

### Session 3 — 2026-06-04

**Focus:** Refactor Competition admin forms and setup backlog architecture.
**Built:** Consolidated create/edit forms into reusable CompetitionModal. Fixed UI disabling logic. Populated backlog with multi-sport architectural roadmap.
**Bugs encountered:** TypeScript 'Cannot find name initialData' error caused by self-referencing inside an interface.
**Resolved:** Hoisted defaultFormData and mapped types using typeof to resolve circular reference.
**Deferred:** All newly added backlog items (001, 002, 003, 004).
**Next session:** Execute BACKLOG-001 — Goal Type Breakdown schema migration
