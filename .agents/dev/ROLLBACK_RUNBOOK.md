# Rollback Runbook

Created 2026-10-04 for BACKLOG-469 item 6 (no rollback runbook existed). Written from
code reads only; **no step here has been rehearsed**. Rehearse the Vercel rollback once on
staging before the first `dev` -> `main` promotion.

## 1. Bad code deploy (Vercel)

1. Vercel dashboard -> the production project -> Deployments -> pick the last known-good
   deployment -> Instant Rollback. No rebuild; the old build is re-pointed at the production
   domain.
2. Vercel pauses auto-assignment of new deployments to the production domain after a rollback
   (confirm in the dashboard). Fix forward on a branch, then promote the new deployment
   explicitly, or the next merge to `main` will not go live as expected.
3. Verify (see section 5), then log what happened in `RUNLOG.md`.

## 2. Service worker cache

`npm run build` runs `scripts/inject-sw-cache-version.mjs` before `next build`. It rewrites the
`CACHE_VERSION` line in `public/sw-user.js` and `public/sw-admin.js` with the first 12 characters
of `VERCEL_GIT_COMMIT_SHA` (or `local-<timestamp>` when that variable is absent), and aborts the
build if the line is not found. It mutates the ephemeral build checkout only, nothing is committed.

Consequence for rollback: each deployment ships service-worker scripts stamped with its own
commit, so a rolled-back deployment serves the older stamp and browsers treat it as a different
service worker. This holds only while Vercel builds with `npm run build` (the package.json
`build` script); `vercel.json` sets no `buildCommand`, so confirm the project's Build Command is
not overridden. Not verified: how quickly installed PWA clients (loggers on phones) pick up the
rolled-back worker; check on a real device during the staging rehearsal.

## 3. Database schema

Rollbacks do **not** revert the schema. Schema changes are promoted additive-first (see
`DEV_TO_MAIN_PROMOTION_RUNBOOK.md`), so previously deployed code keeps working against a database
that has extra columns or tables. Leave additive changes in place. If a change was not additive,
restore from the Turso backup/branch taken before the promotion (promotion step 3) instead, and
treat it as an incident.

## 4. Real-time (WebSocket) problem

The Vercel app notifies the standalone WS server through `src/lib/socket.ts` `broadcast()`:
with no local Socket.IO instance it POSTs to `<NEXT_PUBLIC_WS_URL or WS_SERVER_URL>/broadcast`
with `x-api-key: WS_API_KEY`, and **returns silently when `WS_API_KEY` or the URL is empty**.

- To stop all server-to-WS traffic: set `WS_API_KEY` empty (or remove it) in the Vercel project
  and redeploy (env changes apply to new deployments only). Writes to the database are
  unaffected.
- What viewers then get, per code read (`MatchDetailClient.tsx`, BACKLOG-467):
  - `/matches/[id]`: if the browser socket is still connected it receives no pushes and relies on
    the 25s reconcile poll; if the WS server itself is unreachable it polls every 10s. Either way
    updates are slower than the 5s target.
  - `/` and `/live` already poll every 15s with no socket and are unaffected.
  - Not checked: effects on the logger clock relay if the WS server itself is down (BACKLOG-467
    item 10 says loggers lose it).
- Correction to the shorthand in BACKLOG-469 ("pages fall back to polling"): emptying
  `WS_API_KEY` does not disconnect browsers, so the faster 10s fallback poll is **not** triggered
  by it. It is a way to stop broadcasts, not a way to speed up recovery.
- Restore: set the real `WS_API_KEY` (must equal the Railway ws-server's `WS_API_KEY`) and redeploy.

## 5. Verify after any rollback

`/api/health` (liveness only, no DB or WS probe, BACKLOG-467 item 5), the ws-server `/health`,
open `/` and one `/matches/[id]`, log in as a logger on a phone and confirm the logger page loads.
For a match day also re-run Flow A/B/C on a throwaway match.
