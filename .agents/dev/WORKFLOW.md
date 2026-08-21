# BrixSports — Developer Workflow

## Environment Map

| Name | Turso DB | Vercel Project | Branch |
|------|----------|----------------|--------|
| **Staging** | `brixsportsv2-staging` | `brixsports-staging.vercel.app` | `dev` |
| **Production** | `brixsportv2-brixsports` | `brixsports.com` | `main` |

### `.env.local` Rule
`.env.local` points at **staging** (`brixsportsv2-staging`).
`.env.production` points at **prod** (`brixsportv2-brixsports`).

Do NOT swap `.env.local` to prod to run a script — use `.env.production` directly
or pass it to the pre-prod-check script via the `--production` flag.

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
4. `npm run db:push` against prod (use `.env.production` — never swap `.env.local`)
5. Log in `RUNLOG.md`

### 2. Code Changes
API routes, components, lib functions — anything in `src/`.

**Path to prod:**
1. Develop on `feature/*` branch off `dev`
2. Run `npx tsx dev/pre-prod-check.ts` — must be `[CLEAR TO MERGE]`
3. Open PR → `dev` (staging Vercel preview auto-deploys)
4. Verify on staging preview
5. Open PR → `main` to go to prod
6. After merge: run `npx tsx dev/pre-prod-check.ts --production` — verify prod is clean

### 3. Data Changes
One-off scripts in `dev/` that INSERT, UPDATE, or DELETE rows.

**Path to prod:**
1. Write script in `dev/` — always read-only first (dry run)
2. Run against staging first — verify in DB
3. Only run against prod after staging is confirmed
4. Log every run in `RUNLOG.md`: date, script, target, outcome, row counts
5. Delete script after confirmed (unless it's a reusable diagnostic)

---

## Git Workflow

```
main        ← production (prod Turso DB, prod Vercel)
dev         ← staging (staging Turso DB, staging Vercel)
feature/*   ← new work → PR to dev
fix/*       ← bug fixes → PR to dev
hotfix/*    ← urgent prod fix → PR to main (then merge main back into dev — no auto-sync action exists yet, do it manually, see below)
```

Rules:
- Never commit directly to `main` or `dev`
- All data scripts go in `dev/` (gitignored except `pre-prod-check.ts`)
- Schema migrations run against staging first, then prod
- No `.env.*` files committed — ever

---

## dev ↔ main Sync — Always a Real Merge, Never `--squash`

**Rule: any sync between `dev` and `main`, in either direction, must be a real `git merge` (or fast-forward) — never `git merge --squash`.**

**Why:** `git merge --squash` never records the source branch as a parent of the resulting commit — it produces a same-content commit with no linkage. This means git's merge-base calculation between `dev` and `main` afterward still points at whatever commit they last *really* shared, so every future sync in *either* direction re-flags already-identical content as a fresh conflict, forever. This bit us directly: after session 53's `dev`→`main` squash-merge (391 commits, justified one-time exception to land it as one clean commit alongside a history rewrite), the very next `main`→`dev` sync (a same-day sitemap hotfix) hit conflicts on 5 files that had zero real content differences — `next.config.ts`'s conflict was two branches independently adding the *identical* block, and 3 of the 5 were pure duplication noise from the broken merge-base, not real divergence.

**The fix:** the `main`→`dev` merge that day used a real `git merge main` (not squash) into `dev`, which already repairs the link on `dev`'s side — confirmed via `git merge-base --is-ancestor main dev`. Going forward, **the next `dev`→`main` sync must also be a real merge**, not another squash, to repair the other direction and permanently stop this recurring.

**The tradeoff, accepted deliberately:** `main`'s history becomes as verbose as `dev`'s (every individual commit, not one clean squash) — this is not a new cost, it's just applying this file's own Hotfix Flow rule ("merge commit, NOT squash — preserve audit trail") consistently to routine syncs too, not only hotfixes.

**No auto-sync action exists.** The Git Workflow diagram above used to claim hotfixes "auto-sync back to dev" — false; there is no GitHub Action for this (checked `.github/workflows/`, nothing matches). After any hotfix PR merges to `main`, manually `git checkout dev && git merge main` (real merge) and push. Building the actual auto-sync action is still open, not yet done.

---

## Hotfix Flow

Use when a bug is live in production and cannot wait for the next `dev → main` cycle.

```bash
git checkout main && git pull
git checkout -b hotfix/short-description
# fix, commit incrementally
git push origin hotfix/short-description
# open PR → main (NOT dev)
# 2 reviews required (or 1 if team is < 2)
# merge commit (NOT squash — preserve audit trail)
```

After merge to `main`:
- The GitHub auto-sync action merges `main` back into `dev` automatically
- If the action fails: manually `git merge main` into `dev` before starting new work
- Log the hotfix in `RUNLOG.md` with: date, branch, what broke, root cause, fix applied

**When NOT to use hotfix:**
- Bug is on staging only — fix via `fix/*` → `dev` instead
- Bug is non-blocking — schedule in next sprint via BACKLOG

---

## Partial Feature Flow

Use when a feature is partially built but not ready to ship in full. The goal is to
merge safe, working code to `dev` without exposing the unfinished feature to users.

### Option A — Backscope (preferred)
Feature exists in code but is hidden from users until complete.

1. Build the safe portion on a `feature/*` branch
2. Gate the UI entry point with `notFound()` (page) or comment-out the nav link
3. Add an entry to `.agents/dev/BACKSCOPE.md` documenting what was hidden and why
4. Merge to `dev` — code ships but the feature is invisible
5. Reinstate by removing the `notFound()` gate when the full feature is ready

**Nav link comment format (grep-able, reversible):**
```tsx
// BACKSCOPED: YYYY-MM-DD — BACKLOG-XXX. Reinstate when: [condition]
// { label: 'Feature Name', href: '/feature-path' },
```

**Page gate format:**
```tsx
// BACKSCOPED: YYYY-MM-DD — see .agents/dev/BACKSCOPE.md
import { notFound } from 'next/navigation';
export default function Page() { notFound(); }
```

### Option B — Feature flag (future)
Not yet implemented. When BACKLOG-021 (GitHub Actions / config infra) is live,
consider a server-side feature flag from the admin settings table
(`features.X.enabled` column already exists in DB).

---

## Pre-Merge Checklist

Run before EVERY PR to `main`:

```bash
npx tsx dev/pre-prod-check.ts              # against staging (default)
npx tsx dev/pre-prod-check.ts --staging    # explicit staging
```

Must output `[CLEAR TO MERGE]` before the PR is opened. If any check fails, fix it first.

Run after EVERY merge to `main` (post-deploy verification):

```bash
npx tsx dev/pre-prod-check.ts --production
```

Must output all checks passing against the live prod app and prod DB.

The script checks:
- **Block 1** — All protected endpoints return 401 to unauthenticated callers
- **Block 2** — `/api/matches` response contains no banned NDPR fields (loggerId, assignedLoggers, approvalStatus)
- **Block 3** — DB integrity (no null competitionId, no dirty strings, competition/entry counts)
- **Block 4** — Round distribution (normalisation complete, no null rounds)
- **Block 5** — Expected competitions present by name

---

## Reusable Dev Scripts

Scripts committed to the repo (not gitignored):

| Script | Purpose |
|--------|---------|
| `dev/pre-prod-check.ts` | Pre-merge clearance — run before every PR to main |
| `dev/identify-db.ts` | Print which DB the current env points at |

Scripts that are gitignored (one-time or contain env-specific data):
- All `dev/fix-*.ts` — one-time data fixes, logged in RUNLOG
- All `dev/query-*.ts` — ad-hoc diagnostic queries
- All `dev/script/` and `dev/test/` subdirectories

---

## Beta-Testing with the `beta-tester` Tool (Live, Authenticated Flows)

The global `beta-tester` skill (`~/.claude/skills/beta-tester`, standalone project at `C:\Users\Wise\Desktop\beta-tester-skill`) can drive a real, recorded browser session against staging. This section is BrixSports-specific glue for using it against *this* app — the tool itself stays generic, this workflow doesn't belong in that repo.

**Target environment:** always `https://brixsports-staging.vercel.app`, never prod, unless explicitly verifying a live production issue.

**Authenticated personas need a REAL `users.id`, not a fabricated one.** `getAuthUser()` (`src/lib/auth.ts`) re-verifies the JWT's subject against a live DB row on every request (`BACKLOG-168`'s fix — confirmed working correctly, not a bug: a synthetic `userId` in an otherwise-validly-signed token gets a clean 401, not a silent trust of the JWT's own role claim). A throwaway *email* is fine; the `userId` itself must resolve to a real row, or auth-gated actions (anything past a page load) will 401.

To get one, read-only:
```js
// from brixsports-v2/, with dotenv loaded from .env.local
const { createClient } = require('@libsql/client');
const client = createClient({ url: process.env.TURSO_CONNECTION_URL, authToken: process.env.TURSO_AUTH_TOKEN });
client.execute("SELECT id, email, role FROM users WHERE role = 'admin' LIMIT 3").then(r => console.log(r.rows));
```
Known real staging admin: `admin-001`  (as of 2026-08-21 — re-verify it still exists before reusing, don't assume it's permanent).

**Minting the token:** sign `{ userId, email, role }` with the real `JWT_SECRET` from `.env.local`, matching `src/lib/auth.ts`'s `generateToken` shape. A hand-rolled HS256 signer (no `jsonwebtoken` dependency needed) works fine — verified byte-compatible with the real `jsonwebtoken` library's own `.verify()` this session.

**If a run writes real (even if throwaway) data to a real row** (e.g. a livestream URL, a match field), check the field's value *before* running so you know what to revert to, and revert it after — the same discipline as every other dev/ script touching staging. Don't assume a "throwaway" value is harmless just because the identity minting it is fake; the row it writes to is real.

**Known BrixSports-specific gotcha:** a page load can occasionally hit stale CDN-cached HTML shortly after a deploy, referencing a JS chunk hash that's since been deleted — the page hangs on its loading spinner indefinitely, with a 404+wrong-MIME-type error in the console for the missing chunk. Self-resolving (a fresh reload moments later gets the current, correct chunk) — don't mistake this for an app bug on the flow actually being tested; a quick `fetch()` on the same route to check whether the chunk reference has changed is enough to tell the two apart.

---

## When to Upgrade to CI (Tier 2)

When GitHub Actions are live (BACKLOG-021), convert `pre-prod-check.ts` into a workflow:
- `.github/workflows/pre-prod-check.yml`
- Trigger: PR to `main`
- Runs `npx tsx dev/pre-prod-check.ts --staging` with staging env vars from GitHub Secrets
- Fails the PR check if exit code is 1

Zero changes needed to the script itself — it already exits 0/1 correctly.
The `--staging` flag is already the default, so the workflow command is clean.
