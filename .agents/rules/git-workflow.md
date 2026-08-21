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
