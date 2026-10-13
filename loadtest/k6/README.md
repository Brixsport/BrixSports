# BrixSports k6 load / latency / resilience suite

k6 scripts for the public read path (viewer mix, spike, soak, rate limit) and for the logger write path.
Everything targets the **staging** deployment only. The read-only scenarios also run from GitHub Actions
(`.github/workflows/k6-loadtest.yml`); the scenarios that write data are for local use with a disposable match.

## 1. Running from GitHub Actions (read-only scenarios)

Workflow: **k6 load test (staging)**, Actions tab > select the workflow > Run workflow.

| Input | Default | Meaning |
|---|---|---|
| `scenario` | `smoke` | `smoke` (5 VUs, 1 min), `viewer-mix` (ramp to the VU ceiling, ~17 min), `spike` (3x load for 60 s, ~9 min), `soak` (30 min), `rate-limit` (~12 min) |
| `base_url` | `https://brixsports-staging.vercel.app` | Only that exact URL is accepted |
| `match_id_read` | `busa-match-1` | Match used by the match-page viewers (read-only) |
| `max_vus` | `250` | VU ceiling **per shard**; the workflow clamps anything above 250 |
| `shards` | `1` | 1, 2 or 3 parallel jobs, each on its own runner (its own public IP) |
| `ws_down` | `true` | Match page polls every 10 s (WebSocket down) instead of 25 s |

Why a runner: a GitHub-hosted runner has a clean data-centre network, so latency numbers are not distorted by a laptop on a
mobile hotspot, and each shard sends from a different source IP. That matters for the rate limiter, which counts per client IP.

How scenarios map to scripts: `smoke` and `viewer-mix` run `01-viewer-mix.js` (smoke sets `SMOKE=1`), `spike` and `soak`
run `04-spike-soak.js` (`PROFILE=spike|soak`; base load is `max_vus / 3` capped at 80 for spike, `max_vus` capped at 100 for soak),
`rate-limit` runs `05-rate-limit.js`. Scripts `02`, `03` and `06` write data and are **never** run by the workflow.

Safety and caps in the workflow:

* The first step fails the run unless `base_url` is exactly the staging URL, and also refuses anything containing `brixs2` or
  `brixsports.com`. The job checks again before checkout, and `config.js` refuses again inside k6 (`CONFIRM_STAGING=yes`
  required, production hosts hard-blocked). Inputs reach the shell only through environment variables.
* Wall-clock caps per job: smoke 5 min, viewer-mix 25, spike 20, soak 40, rate-limit 25. The k6 process itself is killed
  2 minutes earlier (`timeout`), so a hung k6 ends the job and is reported as a failure.
* One load test against staging at a time (`concurrency` group), read-only permissions, no repository secrets, no logger
  tokens, no deployment-protection bypass. The staging deployment is publicly readable.
* k6 is installed from the pinned official release (v2.2.0, linux-amd64) with its SHA-256 checked against the checksums file
  published with that release. No third-party install action.

Result handling:

* k6 exit code 99 means only thresholds were crossed. The job then **passes with a warning annotation** (latency thresholds are
  noisy on shared runners against a shared staging deployment, and the numbers are still produced). Any other non-zero exit
  (usage error, a refused guard, a script exception, the time cap) fails the job.
* Each shard writes a summary to the job's step summary (requests, failed %, p95/p99, per-endpoint p95, cache HIT/STALE share,
  429 count, crossed thresholds) and uploads `results/` as the artifact `k6-<scenario>-shard-<n>` (kept 14 days).

Reading the numbers:

* All VUs of one shard share one IP. The limiter allows 600 requests per minute per IP per warm instance on the live and
  match-page polls (120 on `/api/competitions`), and the current client polls `/api/live-matches` every 3 s, so about 30 viewers
  on the home or live page saturate it. Large VU counts from one runner will therefore show 429s (`rate_limited`) that real
  viewers spread over many IPs would not see. 429 is not counted as a failed request; it is reported separately. Use more shards
  for a more realistic spread, and keep the per-shard VU count modest when you care about latency rather than the limiter.
* The staging database and deployment are shared with whatever else is happening on staging; repeat a run before trusting a
  single outlier.

**GitHub only lets you dispatch a workflow file that exists on the default branch.** Until this workflow is on `main`, the
"Run workflow" button does not appear for it. The `pull_request` trigger (smoke scenario only, only when `loadtest/k6/**` or the
workflow file changes) is how the workflow is proved on a real runner before it is promoted. After the next promotion to the
default branch, run the larger scenarios from the Actions tab.

## 2. Running locally

Requires k6 (v2.2.0 was used). Never point it at production: `config.js` refuses to start unless `CONFIRM_STAGING=yes`, the URL
matches `ALLOWED_HOST_REGEX` (default `brixsports-staging|staging\.brixsports\.com`), and it hard-blocks `brixs2` and the
production apex/www hosts (not overridable). That is a seatbelt, not a substitute for checking `BASE_URL` yourself.

```powershell
$env:BASE_URL = "https://brixsports-staging.vercel.app"
$env:CONFIRM_STAGING = "yes"
k6 run loadtest/k6/01-viewer-mix.js -e MATCH_ID_READ=busa-match-1 -e SMOKE=1 -e OUT_DIR=results
```

Do not commit anything from `results/`, tokens or bypass secrets.

### Environment variables (via `-e` or the shell; nothing hardcoded)

| Var | Required by | Meaning |
|---|---|---|
| `BASE_URL` | all | Staging deployment URL |
| `CONFIRM_STAGING=yes` | all | Acknowledgement |
| `VERCEL_BYPASS` | if deployment protection is on | Sent as `x-vercel-protection-bypass` header (never in the URL) |
| `MATCH_ID_READ` | 01, 04, 05 | Staging match id for the match-page viewers; defaults to `MATCH_ID_WRITE` |
| `MATCH_ID_WRITE` | 02, 03, 06 | Disposable friendly LIVE match (TEAM A vs TEAM B) |
| `LOGGER_TOKENS` (comma list) or `LOGGER_TOKEN` | 02, 03, 06 | JWTs of loggers actively assigned to `MATCH_ID_WRITE` |
| `HOME_TEAM_ID`, `AWAY_TEAM_ID` | 02, 03, 06 | The match's team ids |
| `HOME_PLAYER_IDS`, `AWAY_PLAYER_IDS` | 02, 03, 06 | Comma lists of real player ids (look them up; never guess) |
| `FINISHED_MATCH_ID` | 06 | A FINISHED staging match (a write must return 409) |
| `FINISHED_MATCH_KNOWN_EVENT_ID` | 06 (optional) | Existing event id on that match (replay must still return 200) |
| `EXPIRED_TOKEN` | 06 | Pre-minted expired logger JWT (preferred) |
| `JWT_SECRET_STAGING` + `LOGGER_ID_FOR_MINT` | 06 (optional) | Alternative: k6 mints an expired token locally. Staging secret only |
| `UNASSIGNED_LOGGER_TOKEN` | 06 (optional) | Valid logger not assigned to the match (expects 403) |
| `WS_DOWN=1` | 01, 04 | Match viewers poll every 10 s instead of 25 s |
| `SMOKE=1` | 01, 05 | Tiny run (5 VUs, about a minute) |
| `PROFILE`, `BASE_VUS` | 04 | `spike` or `soak`, and the base VU count |
| `MAX_VUS`, `CONFIRM_HIGH_LOAD=yes` | 01, 04 | Lift the VU ceiling (default and hard default 250) |
| `THRESH_SCALE` | all | Multiply latency thresholds |
| `OUT_DIR` | all | Where `summary-*.json` is written (default `./results`) |

## 3. Scenario files

| File | What | Writes data |
|---|---|---|
| `config.js` | Env wiring, staging guard, cadences, helpers | |
| `lib.js` | Metrics, request wrappers, viewer personas, JSON summary | |
| `01-viewer-mix.js` | Ramping viewers; home 50%, /live 20%, match page 30%, with the current client cadences | no |
| `02-write-path.js` | Steady loggers, bursts, idempotent replay, dedup race | **yes** |
| `03-freshness.js` | Event save to public display latency probe | **yes** |
| `04-spike-soak.js` | `PROFILE=spike` (3x for 60 s) or `PROFILE=soak` (30 min) | no |
| `05-rate-limit.js` | 429 behaviour, headers, recovery, shared-NAT headroom, forged `X-Forwarded-For` | no |
| `06-auth-failure.js` | 401/403/400/409, oversize and malformed bodies | **yes** |
| `ci-summary.cjs` | Turns `summary-*.json` into the Markdown step summary used by the workflow | |
| `failure-modes.md` | Manual failure-mode checks (expected behaviour, how to inject, pass/fail) | |

Client cadences used by the viewer personas (seconds): home polls `/api/live-matches` every 3 and the three sport lists every
15; `/live` polls `/api/live-matches` every 3; the match page polls `/api/matches/{id}/public` every 10 (WebSocket down) or 25
(up) and fetches `/api/head-to-head` once per session.

### Thresholds

Starting points, calibrate with `THRESH_SCALE` after a baseline run:

* Edge-cached lists (`/api/football/matches`, `/api/basketball/matches`, `/api/other/matches`): p95 < 800 ms (other: 1200), p99 < 2000 ms (3000).
* Other reads (`/api/matches/{id}/public`, `/api/live-matches`, `/api/competitions`, `/api/head-to-head`): p95 < 1500 ms, p99 < 3500 ms.
* HTML pages `/`, `/live`, `/matches/{id}`: p95 < 2000 ms (shell only; k6 does not execute client JS).
* `http_req_failed{kind:read}` < 1%; 429 is excluded from failures and measured by `rate_limited` (< 2% for 01, < 5% for 04).
* Writes: ack p95 < 2000 ms, p99 < 4000 ms. Freshness p95 < 5 s (the probe polls every ~0.5 s, so it measures server and cache
  visibility, not the real viewer cadence).

### Metrics

`freshness_detail_ms`, `freshness_list_ms` (Trends), `freshness_timeouts`, `write_ack_ms` (Trend), `write_dedup_hits`,
`dup_rows_found`, `race_not_single_winner` (Counters; duplicates and races must be 0), `rate_limited` (Rate),
`banned_field_leak` (Counter, must be 0: scans every public JSON body for `assignedLoggers`, `approvedBy`, `approvalStatus`,
`managerNotes`, `loggerId`, `profileId`, `organizationAffiliations`, `memberships`), and
`xvc_<endpoint>_<HIT|MISS|STALE|BYPASS|NONE|OTHER>` (Counters from `x-vercel-cache`; the end-of-test table prints the share per
endpoint).

## 4. Local-only scenarios that write data (02, 03, 06)

* Use a disposable **friendly** football match, teams `TEAM A` vs `TEAM B`, status LIVE (friendly matches skip player-stat
  updates). Make sure no real staging user follows those teams or players, because goal and card events send push notifications.
* Assign 1 to 4 test loggers actively to the match; without that, event POSTs return 403. Create a second match set to FINISHED
  for `06`.
* The events GET returns at most 200 rows ordered by minute ascending, so the suite uses minutes 0-29 for verified events
  (replay and race) and minutes 30 and up for load events. Re-create the match if load events push it near 200 rows.
* The WebSocket server is a single instance shared by staging and production. Every event POST triggers a broadcast to it, so
  keep write rates light (at most 4 loggers, about 0.4 events/s in total) and never run reconnect storms against it. k6 does not
  open WebSockets.
* Order: smoke each script first (`-e SMOKE=1` where supported), then `02`, `03`, `06`, `01`, `05`, `04`. Do not run `01` or
  `04` while `02` or `03` write to the same match.
* Clean-up afterwards: remove the disposable match on staging, check there are no leftover rows whose ids start with `k6_`,
  no stray notifications or push subscriptions, and no change to standings. Let the logger tokens expire and rotate any bypass
  secret that was pasted into a shared terminal.

## 5. Not covered

* WebSocket push latency and health.
* Real browser behaviour (service worker, offline queue, token refresh); see `failure-modes.md` for manual steps.
* Multi-region edge behaviour (the runner is in one region; Vercel caches per region).
* The basketball logger write path (same route; a football payload is used).
