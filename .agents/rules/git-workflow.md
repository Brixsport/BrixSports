---
activation: always_on
---

# Git Governance

Referenced from `CLAUDE.md` → Git Governance.

## Branch Model
```
main        ← production (Vercel prod, prod Turso DB)
dev         ← staging/integration (Vercel staging, staging Turso DB)
feature/*   ← new features — branch off dev, PR back to dev
fix/*       ← bug fixes — branch off dev, PR back to dev
hotfix/*    ← urgent prod fixes — branch off main, PR to main,
              auto-syncs back to dev after merge
```

## Rules
- All new work branches off `dev`, not `main`
- PRs to `main` require 2 reviews (1 currently — raise when team grows)
- PRs to `dev` require 1 review
- Squash merge for `feature/*` and `fix/*`
- Merge commit for `hotfix/*` (preserve audit trail)
- Schema migrations run against staging first, then prod — no exceptions
- No direct commits to `main` or `dev`
- `dev` must always be deployable — do not merge broken code

## Environments
- `main` deploys to brixsports.com (prod Vercel project)
- `dev` deploys to staging.brixsports.com (staging Vercel project)
- Each PR gets a Vercel preview deployment automatically
- `JWT_SECRET` and `CRON_SECRET` are different per environment
- `NEXT_PUBLIC_ENV` = `production` | `staging` | `development`

## Workflow — Feature Work
```bash
git checkout dev && git pull
git checkout -b feature/your-feature-name
# work, commit incrementally
git push origin feature/your-feature-name
# open PR → target dev
# PR guard checks target, Vercel builds preview
# 1 review required, merge with squash
```

## Workflow — Hotfix
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

## Multiple Parallel Sessions on One Initiative (Umbrella Branch + Worktrees)

For a multi-phase initiative several sessions/agents work on at once (e.g. the UI redesign)

**Umbrella branch, not per-phase branches.** One `feature/*` branch off `dev` for the entire
initiative. Individual phases/sessions commit to it incrementally rather than each opening its
own branch+PR — see `[[feedback_umbrella_branch_multiphase_feature]]`.

**One worktree per session, per piece of work** — never share a working directory with another
active session (Background/Sub-Agent Git Safety rule: a shared directory means any
`git stash`/`reset`/`checkout` from either session can silently wipe the other's uncommitted
work). Set up with:
```bash
git fetch origin
git worktree add .claude/worktrees/<short-name> -b work/<short-name> origin/feature/<umbrella-branch>
```
Each worktree gets its **own local branch** (git refuses to check the same branch out twice) —
this local branch is disposable scaffolding, not a persistent fork. Push its commits onto the
umbrella branch directly:
```bash
git fetch origin
git rebase origin/feature/<umbrella-branch>   # pick up what other sessions pushed since you branched
git push origin work/<short-name>:feature/<umbrella-branch>
```
**Rebase before every push, not just the first one** — another session's commits land on the
umbrella branch while you work; a stale local branch gets a plain `[rejected] (non-fast-forward)`
on push. Fix by rebasing onto `origin/feature/<umbrella-branch>` and pushing again, never
`--force`.

**`node_modules` via a junction, not a reinstall** — each worktree is a separate directory, but a
full `npm install` per worktree is slow and can corrupt the shared npm cache under concurrent
installs (hit and fixed during the redesign initiative, see
`[[project_figma_redesign_reconciliation_setup]]`). Link instead:
```powershell
New-Item -ItemType Junction -Path ".claude\worktrees\<short-name>\node_modules" -Target "node_modules"
```

**Claiming a BACKLOG number or a piece of work** is the coordination mechanism — no separate
sign-up sheet:
1. Before starting, `grep -oE "BACKLOG-[0-9]+" .agents/dev/BACKLOG.md | sort -t- -k2 -n -u | tail`
   against `origin/feature/<umbrella-branch>` (not just your local checkout, which may be behind)
   to find the next free number and confirm no one else already claimed the entry you're about
   to pick up.
2. Flip that entry's `**Status:**` to `IN PROGRESS` with your session identity, commit, and push
   it immediately — before writing any code. This is the whole claim mechanism; a second session
   has no other way to know not to duplicate the work.
3. If you find real, in-scope work beyond the entry you claimed, file it as its own new entry
   (next free number) rather than silently expanding scope — future sessions need to find it by
   number, not by re-reading your session's history.

**Cross-session coordination for shared files**: if your change alters the *contract* a file
exposes to another session's in-flight work (props a shared component receives, a data shape
another session's code depends on), message that session with the specific proposed contract *before* implementing — not after. Get
confirmation, then proceed.
