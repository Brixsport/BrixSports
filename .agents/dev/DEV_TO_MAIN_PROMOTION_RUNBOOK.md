# Dev -> Main Promotion Runbook

Created 2026-10-04 from BACKLOG-469 ("DEV -> MAIN PLAN" and "Standard promotion procedure").
The plan and procedure below are copied from that entry; they come from review, not from a
rehearsed promotion. Rollback: see `ROLLBACK_RUNBOOK.md`. Every prod schema or data step gets a
`RUNLOG.md` entry. Env vars and secrets are set by the owner, not by an agent.

## A. The 11-step plan

1. Commit a replayable prod migration (idempotent, outside `dev/`) and rehearse it on a copy of staging.
2. Run read-only prod preflights (schema diff of staging vs prod).
3. Take a Turso backup or branch of prod.
4. Apply the additive schema changes to prod, in order.
5. Set prod Vercel env: `NEXT_PUBLIC_ENV=production`, `NEXT_PUBLIC_APP_URL` (no trailing slash),
   `WS_SERVER_URL`/`WS_API_KEY`, `JWT_SECRET`, `NEXT_PUBLIC_WS_URL`.
6. Set the VAPID pair (new keys, see BACKLOG-463), `CRON_SECRET`, `NEXTAUTH_SECRET`,
   `COOKIE_DOMAIN`, the Cloudinary trio, email credentials, both Sentry DSNs with the Sentry
   environment `production`, and `SENTRY_AUTH_TOKEN`. `.env.example` documents each variable.
7. Confirm the Railway WS server has `JWT_SECRET_PROD`, `JWT_SECRET_STAGING` and `WS_API_KEY`
   matching Vercel.
8. Confirm the Google redirect URI for brixsports.com is registered. Fix the stale `bun.lock` /
   Vercel install command (BACKLOG-469 item 5).
9. Merge `dev` -> `main` with 2 reviews; watch the Sentry source-map upload in the build.
10. Verify on prod: `/api/health` and the WS `/health`; Flow A with a throwaway match; Flow B
    event; Flow C under 5s; one Google login; one Cloudinary upload; `/api/competitions`.
11. Rollback if needed: Vercel Instant Rollback (the service-worker cache version is stamped per
    commit); leave additive schema in place; if WS is the problem, empty `WS_API_KEY` (read the
    caveat in `ROLLBACK_RUNBOOK.md` section 4 first).

Startup env check (BACKLOG-469 item 2, warn mode): after step 5/6, a prod cold start logs
`[env] production environment is missing: ...` (names only) and reports it to Sentry if any
required variable is absent. It does not block startup.

## B. Schema promotion procedure (7 steps)

1. One idempotent SQL migration per change, dry-run by default, with `--env=staging|prod --apply`.
2. Precheck with `PRAGMA table_info` / `sqlite_master`.
3. Apply to staging; verify with a read-only schema diff of staging vs prod.
4. Snapshot or branch prod before applying.
5. Apply to prod in a quiet window and re-diff.
6. Log in `RUNLOG.md` and close the BACKLOG entry in the same commit.
7. Additive migration first, code deploy second. Never ship code that reads a column before it
   exists on prod.
