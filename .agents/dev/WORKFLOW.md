# BrixSports — Developer Workflow

## Environment Map

| Name | Turso DB | Vercel Project | Branch |
|------|----------|----------------|--------|
| **Staging** | `brixsportsv2-staging` | `brixsports-staging.vercel.app` | `dev` |
| **Production** | `brixsportv2-brixsports` | `brixsports.com` | `main` |

### `.env.local` Rule
`.env.local` points at **staging** (`brixsportsv2-staging`).  
Do NOT swap it to prod to run a script — create a `.env.prod` (gitignored) for that purpose instead.

When running data scripts, confirm which DB you're targeting:
```
npx tsx dev/identify-db.ts   ← run this if unsure
```
Look at the `TURSO_CONNECTION_URL` hostname in the output.

---

## DB Change Categories

Every change to the database falls into one of three categories:

### 1. Schema Changes
Changes to `src/db/schema.ts` (new tables, new columns, constraints).

**Path to prod:**
1. Edit `src/db/schema.ts`
2. `npm run db:push` against staging — verify
3. Commit schema change to `dev`
4. `npm run db:push` against prod (swap `.env.local` to prod URL temporarily, or use `.env.prod`)
5. Log in `RUNLOG.md`

### 2. Code Changes
API routes, components, lib functions — anything in `src/`.

**Path to prod:**
1. Develop on `feature/*` branch off `dev`
2. Run `npx tsx dev/pre-prod-check.ts` — must be `[CLEAR TO MERGE]`
3. Open PR → `dev` (staging Vercel preview auto-deploys)
4. Verify on staging preview
5. Open PR → `main` to go to prod

### 3. Data Changes
One-off scripts in `dev/` that INSERT, UPDATE, or DELETE rows.

**Path to prod:**
1. Write script in `dev/` — always read-only first (dry run)
2. Run against staging first — verify in DB
3. Only run against prod after staging is confirmed
4. Log every run in `RUNLOG.md`: date, script, target, outcome, row counts
5. Delete script after confirmed (unless it's a reusable diagnostic)

---

## Pre-Merge Checklist

Run before EVERY PR to `main`:

```bash
npx tsx dev/pre-prod-check.ts
```

Must output `[CLEAR TO MERGE]` before the PR is opened. If any check fails, fix it first.

The script checks:
- **Block 1** — All protected endpoints return 401 to unauthenticated callers
- **Block 2** — `/api/matches` response contains no banned NDPR fields (loggerId, assignedLoggers, approvalStatus)
- **Block 3** — DB integrity (no null competitionId, no dirty strings, competition/entry counts)
- **Block 4** — Round distribution (normalisation complete, no null rounds)
- **Block 5** — Expected competitions present by name

---

## Git Workflow

```
main        ← production (prod Turso DB, prod Vercel)
dev         ← staging (staging Turso DB, staging Vercel)
feature/*   ← new work → PR to dev
fix/*       ← bug fixes → PR to dev
hotfix/*    ← urgent prod fix → PR to main (auto-syncs to dev)
```

Rules:
- Never commit directly to `main` or `dev`
- All data scripts go in `dev/` (gitignored except `pre-prod-check.ts`)
- Schema migrations run against staging first, then prod
- No `.env.*` files committed — ever

---

## Reusable Dev Scripts

Scripts committed to the repo (not gitignored):

| Script | Purpose |
|--------|---------|
| `dev/pre-prod-check.ts` | Pre-merge clearance — run before every PR to main |

Scripts that are gitignored (one-time or contain env-specific data):
- All `dev/fix-*.ts` — one-time data fixes, logged in RUNLOG
- All `dev/query-*.ts` — ad-hoc diagnostic queries
- All `dev/script/` and `dev/test/` subdirectories

---

## When to Upgrade to CI (Tier 2)

When GitHub Actions are live (BACKLOG-021), convert `pre-prod-check.ts` into a workflow:
- `.github/workflows/pre-prod-check.yml`
- Trigger: PR to `main`
- Runs `npx tsx dev/pre-prod-check.ts` with staging env vars from GitHub Secrets
- Fails the PR check if exit code is 1

Zero changes needed to the script itself — it already exits 0/1 correctly.
