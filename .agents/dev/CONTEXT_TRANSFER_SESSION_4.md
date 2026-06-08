# BrixSports — Context Transfer: Session 4 (Staging Scaffold)
Date: 2026-06-08
Branch: dev

---

## What Was Completed This Session

### BUG-013 — Auth gate on POST /api/players/bulk-register ✓
- `getAuthUser(request)` + `authUser.role !== 'admin'` added at top of handler
- Returns 401 before body is read
- Matches BUG-001/002 pattern exactly
- Committed: `119d366`

### BUG-014 — Admin matches page showing raw team IDs ✓
- Root cause: page fetched `/api/teams` with `.limit(200)` but 236 teams in DB
- `/api/matches` already returns `homeTeam`/`awayTeam` objects embedded — page was ignoring them
- Fix: added `MatchTeam` interface, `homeTeam?`/`awayTeam?` to `Match` interface
- `getTeamName(id)` replaced with `getTeamDisplay(match, side)` using embedded `shortName`
- Match cards now show abbreviations (COLNAS, COLENG) not full names
- Committed: `37e1908`

### BACKLOG-011 — Sentry installed and configured ✓
- `@sentry/nextjs@10.56.0` installed (exact version)
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` created
- `next.config.ts` wrapped with `withSentryConfig`
- `global-error.tsx` captures exceptions via `Sentry.captureException`
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in `.env.example`
- `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT` added — tags prod vs staging in Sentry dashboard
- Committed: `001dc42`

### BACKLOG-017 — 3 remaining BUSALYMPICS fixtures inserted ✓
- All 3 inserted as `status: UPCOMING` via `dev/fix-busalympics-remaining-fixtures.ts`
- IDs: `a9CtLwotaXyfsfMf2odAM` (MD2 G1), `_9nntLoOZZOZGzja8EQE9` (MD3 G1), `y3KcCGtHA7N7MybKTHX5K` (MD3 G2)
- All 7 BUSALYMPICS fixtures now in DB; existing 4 matchday/round values verified correct
- BACKLOG-017 updated: partial — scores still needed to PATCH to FINISHED
- Committed: `4f848d2`

### Repo migrated to Brixsport org ✓
- Old: `github.com/Mariamyussuf/BrixsV2` (never in code — was local path only)
- New: `github.com/Brixsport/BrixSports`
- Updated in: `CONTRIBUTING.md`, `README.md`, `VERCEL_DEPLOYMENT.md`, `src/app/docs/page.tsx`,
  `DEVELOPER_ONBOARDING.md`, `BLOG_QUICK_START.md`, `DATABASE_OWNERSHIP_REFACTOR_PROPOSAL.md`
- `STAGING_PLAN.md` updated with new repo URL and IN PROGRESS status

### Phase 1 Staging Scaffold — complete ✓
All code-side work done. Remaining steps are manual (Vercel/Turso/Railway config):

**Code shipped this session:**
1. `dev` branch created and pushed to `origin/dev`
2. Sentry env tagging: `SENTRY_ENVIRONMENT` in all 3 Sentry configs
3. `NEXT_PUBLIC_ENV` added to `.env.example` (`development` | `staging` | `production`)
4. Staging-wide JWT auth gate in `src/middleware.ts` — fires when `NEXT_PUBLIC_ENV === 'staging'`
5. `src/lib/env.ts` — centralised typed env object + `validateEnv()` startup check (TD-001 in progress)
6. `.github/workflows/pr-guard.yml` — fails PRs where `feature/*`/`fix/*` don't target `dev`,
   or `hotfix/*` doesn't target `main`; posts explanatory comment on violation
7. `CLAUDE.md` — full Git Governance section + Session Conventions section added

**Still manual (not yet done):**
- Create staging Turso DB: `turso db create brixsportv2-staging`
- Apply schema: `TURSO_CONNECTION_URL=<staging> npm run db:push`
- Create staging Vercel project pointed at `dev` branch
- Set staging env vars in Vercel: `TURSO_CONNECTION_URL`, `TURSO_AUTH_TOKEN`, `NEXT_PUBLIC_ENV=staging`,
  `SENTRY_ENVIRONMENT=staging`, `NEXT_PUBLIC_WS_URL` (staging Railway WS once created)
- Set prod env vars in Vercel: `NEXT_PUBLIC_ENV=production`, `SENTRY_ENVIRONMENT=production`
- Create Railway staging WS service (BACKLOG-027)
- Configure GitHub Rulesets on main + dev (BACKLOG-021)
- Verify parity checklist in `STAGING_PLAN.md`

### Git Governance established ✓
- Branch model: `main` (prod) / `dev` (staging) / `feature/*` / `fix/*` / `hotfix/*`
- PR guard workflow live in `.github/workflows/pr-guard.yml`
- Full governance rules in `CLAUDE.md` under "Git Governance"
- Merge strategy: squash for feature/fix, merge commit for hotfix

### TD-001 — env.ts scaffolded (IN PROGRESS)
- `src/lib/env.ts` created with typed `env` object covering 13 vars and `validateEnv()`
- `middleware.ts` migrated: uses `env.isStaging` and `env.jwtSecret`
- Full migration of remaining `process.env` reads (30+ files) deferred to next dedicated session
- Rule in `CLAUDE.md`: never read `process.env` directly — always import from `src/lib/env.ts`

---

## BACKLOG-020 — filed this session (Blocks 1–6)
Large architecture/audit item. Not started. Depends on Phase 5 audit.
Blocks: modular monolith, full feature audit, backscoping, per-PR DB branching, system sweep.
See `.agents/dev/BACKLOG.md` BACKLOG-020 for full spec.

## New Backlog Items Filed This Session
- **BACKLOG-021** — GitHub Rulesets (branch protection) — blocked by PR guard testing
- **BACKLOG-022** — Hotfix auto-sync (main → dev) with conflict detection
- **BACKLOG-023** — CONTRIBUTING.md rewrite with actual branch workflow
- **BACKLOG-024** — DNS CNAME `staging.brixsports.com`
- **BACKLOG-025** — Google OAuth staging config (blocked: no Google Console access)
- **BACKLOG-026** — Broken `AWS_SES_FROM_EMAIL` prod config — email non-functional in prod
- **BACKLOG-027** — Railway staging WS service not yet created

---

## Open Gaps / Known Issues Carried Forward

| Item | Status | Note |
|------|--------|------|
| BACKLOG-026 | 🔴 Affects prod | `AWS_SES_FROM_EMAIL` set to literal string — email broken in prod. Fix: set verified SES address in Vercel prod env vars. Audit active email provider (BACKLOG-010) first. |
| BACKLOG-017 | 🟡 Partial | 3 BUSALYMPICS fixtures in DB as UPCOMING. Scores not yet confirmed. PATCH to FINISHED once scores known. |
| BUG-011 | 🔴 Data integrity | 718 goals anomaly in playerStats. Do not run backfill until staging is live and dedup audit is done. |
| TD-001 | 🟡 In progress | `env.ts` created, middleware migrated. 30+ other files still read `process.env` directly. |
| BACKLOG-019 | 🟡 Blocked | Post-match lifecycle automation. Blocked on staging being fully live. |
| Staging manual setup | 🟡 Pending | Turso staging DB, Vercel staging project, Railway staging WS — all manual steps not yet done. |

---

## Next Session Starting Point

**Priority order:**

1. **BACKLOG-026 (URGENT)** — Fix `AWS_SES_FROM_EMAIL` in prod Vercel env vars.
   Confirm active email provider (BACKLOG-010) first, then set correct sender address.
   This is a live prod bug — email sending is broken right now.

2. **Manual staging setup** — Create Turso staging DB, Vercel staging project, set env vars.
   Follow the checklist in `.agents/dev/STAGING_PLAN.md` section 5.
   Once done, verify Three Critical Flows on staging before any further code work.

3. **BACKLOG-020 Block 6 — Full system audit** — Phase 5 entry point.
   Sweep every route, API, DB table, component. Output `SYSTEM_AUDIT.md`.
   Do not start until staging is live.

4. **TD-001 — complete env.ts migration** — migrate all remaining `process.env` reads
   across 30+ files to import from `src/lib/env.ts`. Add Zod validation once all 29 vars
   are mapped.

**Do not touch:**
- Any post-match automation (BACKLOG-019) — staging not yet live
- Any backfill or playerStats writes — BUG-011 still open
- `main` branch directly — all work on `feature/*` or `fix/*` off `dev`

---

## Key File Locations
- Branch governance: `CLAUDE.md` → Git Governance
- Staging plan + checklist: `.agents/dev/STAGING_PLAN.md`
- All backlog: `.agents/dev/BACKLOG.md`
- Script run log: `.agents/dev/RUNLOG.md`
- Known issues: `.agents/rules/known-issues.md`
- Env config: `src/lib/env.ts`
- PR guard: `.github/workflows/pr-guard.yml`
