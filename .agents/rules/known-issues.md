---
activation: always_on
---
# Known Issues — BrixSports
## Bugs Already Solved (Never Reintroduce)
2026-06-05 — Middleware path mismatch (BUG-001) — `pathname.startsWith('/admin')` did not cover `/api/admin/*` routes, so middleware ran but did nothing for API calls — Always match both `/admin` and `/api/admin` in the internal check, not just the matcher config.
2026-06-05 — Debug endpoint in production (BUG-003) — `src/app/api/auth/test/route.ts` had no auth gate and exposed user ID/role/email to any caller — Never leave test/debug routes in production; delete them before any deploy.
2026-06-05 — Admin API routes with no auth (BUG-002) — `/api/admin/users`, `/api/admin/ads`, `/api/admin/settings` had zero auth enforcement — Every `/api/admin/*` handler must call `getAuthUser(request)` AND check `user.role === 'admin'`.
2026-06-05 — Logger emails in public API response (BUG-007) — `assignedLoggers` in the public `/api/matches` GET response included real email addresses — Never select or forward internal fields (email, loggerId, profileId) in public-facing responses.
2026-06-05 — Unauthenticated match/event creation (BUG-009, BUG-010) — `POST /api/matches` and `POST /api/events` had no auth gate — All mutation endpoints must auth-gate before reading the body.
2026-06-05 — Event type casing mismatch (BUG-012) — Rating calculator used `'GOAL'`, `'SAVE'` etc. but FootballLogger dispatches `'Goal'`, `'Save'` — Always normalize event type strings before comparison: `s.toLowerCase().replace(/[\s_-]+/g, '')`.
2026-06-05 — Hardcoded audit field (BUG-004) — `createdBy: 'admin-1'` hardcoded in transfers page — Audit fields must always source from the verified server-side session, never from a client-side constant or request body.
2026-06-05 — Race condition in logger assignment (BUG-008) — Non-atomic check-then-insert allowed duplicate assignments under concurrent requests — Wrap check + insert in a single Drizzle transaction; re-check inside the transaction.
2026-06-05 — Stored XSS via dangerouslySetInnerHTML (BUG-006) — `formatNewsContent` injected raw user text into HTML template strings without escaping — Always `escapeHtml()` user input before any template string injection; validate URL schemes before using in `href`.
2026-06-04 — Cannot find name 'initialData' TS Error — typeof self-referencing property in the interface definition — Define the default object above the interface and use typeof defaultObject.
2026-05-04 — Match Creation 500 Error — competitionId was sent as "" which SQL treats as a non-null value that fails FK constraints — Always coerce optional FK strings to null.
2026-05-04 — /api/events Unauthorized Access — Missing auth check in POST handler — Always call getAuthUser(request) in mutation handlers.
2026-05-04 — Unbounded List Queries — All list endpoints lacked limits, risking performance collapse — Always use .limit(50) on list queries.

2026-06-08 — Unauthenticated bulk player registration (BUG-013) — `POST /api/players/bulk-register` had no `getAuthUser` check — any unauthenticated caller could create player rows and teams — Always add `getAuthUser` + role check at the very top of every mutation handler, before reading the body.
2026-06-08 — Admin match cards showing raw team IDs (BUG-014) — Page fetched `/api/teams` with `.limit(200)` but 236 teams exist; teams beyond index 200 were missing, causing the `teamId → name` lookup to fall back to the raw ID string — The `/api/matches` response already embeds `homeTeam`/`awayTeam` objects — always use embedded response data before doing a secondary client-side lookup against a separately-fetched list.
2026-06-08 — Middleware login URL inconsistency — staging gate redirected to `/sign-in`, admin gate redirected to `/login`; these are different URLs, one produces a 404 — When writing auth redirects in different blocks of the same file, always use a single named constant for the login URL, not repeated string literals.
2026-06-08 — bash heredoc indentation breaks markdown in GitHub PR comments — heredoc body lines indented to match script indent level produce literal leading whitespace, breaking markdown tables — Always start heredoc content at column 0 when the content will be rendered as markdown.
2026-06-08 — Next.js middleware `pathname` never contains query string — `pathname.startsWith('/sign-in?')` never matches because `pathname` strips query params — Use `request.nextUrl.search` or `request.nextUrl.searchParams` for query string checks in middleware; `pathname` is path only.

2026-06-08 — PATCH /api/matches/[id] has no auth gate (BUG-015) — Any caller can update match scores, status, and internal audit fields with no authentication — Add getAuthUser + admin/logger check before body read in every PATCH/DELETE handler, not just POST. RESOLVED 2026-06-08.

2026-06-08 — POST /api/competitions has no auth gate (BUG-016) — Any unauthenticated user can create competitions — Every POST mutation in /api/* must have getAuthUser at the top, before reading the body. RESOLVED 2026-06-08.

2026-06-08 — Debug/test routes live in production (BUG-017) — /api/notifications/debug, /api/notifications/test, /api/email/test have no auth and expose internal config + subscription data — Never ship debug routes without auth. Delete or gate before any deploy. Pattern repeats BUG-003. RESOLVED 2026-06-08 — all three files deleted.

2026-06-08 — GET /api/matches/[id] leaks internal fields (BUG-018) — approvalStatus, managerNotes, loggerId returned in public response — Always shape a DTO for public responses; never spread the raw DB row. RESOLVED 2026-06-08 — explicit destructure excludes all banned fields.

2026-06-08 — Admin-purpose APIs callable without auth from any origin (BUG-019) — /api/admin/infrastructure and /api/analytics/system rely on middleware only — Middleware protects browser navigation; direct HTTP calls bypass it. Always add handler-level auth. RESOLVED 2026-06-08.

2026-06-08 — /live page has no real-time update mechanism (BUG-020) — Fetch on mount only; viewer must manually refresh to see score changes — Critical Flow C: public livescore must auto-update. Add polling interval or WS subscription. RESOLVED 2026-06-08 — polling interval changed 30s → 15s (stopgap; WS subscription still needed).

2026-06-08 — Hardcoded JWT fallback secret in auth.ts — Both verifyAuth() and generateToken() had process.env.JWT_SECRET || 'your-secret-key-change-in-production'. If JWT_SECRET is absent from env, all tokens are signed and verified with a publicly known string — any attacker can forge admin tokens — Remove the fallback entirely; import from env.ts which validates at startup. Never use || with a fallback on a secret value.

2026-06-08 — logger email leak via spread in match-logger-helpers.ts — ...a.logger! spread included email field of every assigned logger in responses accessible to the logger role — Never spread a DB row that contains PII (email, password, profileId) into an API response. Always use an explicit field shape. The password: undefined trick does NOT reliably remove a field — set it to undefined still appears on the object in some serializers.

2026-06-08 — Second handler in same file missed during auth sweep — analytics/loggers/route.ts had GET fixed but POST (leaderboard endpoint) was a separate export and was not caught in the sweep. Any caller could enumerate all logger emails via POST — When fixing auth on a file, always scan ALL exported function handlers, not just the first one visible. Two-handler files are common in Next.js route files.

2026-06-08 — Inline secret in node -e eval command — Turso auth token hardcoded directly in a node -e eval to run a DB query (turso CLI unavailable). Violates security rules — Never inline credentials in CLI commands or scripts. Always: import 'dotenv/config' + process.env. See .agents/rules/security.md.

2026-06-08 — Round label not rendering after first BACKLOG-032 commit — `/live` page only renders `status === 'LIVE'` matches; BUSALYMPICS/BUSA League matches are FINISHED/UPCOMING so they never appear there. Fix targeted the wrong page. Real render paths were `src/app/page.tsx` (homepage) and shared components (`MatchCard.tsx`, `MatchComponents.tsx`, `UpcomingMatchView.tsx`) — Always grep `match.competition` across the entire codebase before assuming a single page fix is complete.

2026-06-08 — round field not passed through page.tsx transform maps — `src/app/page.tsx` fetches from `/api/basketball/matches` and `/api/football/matches` (not `/api/matches`) and explicitly reconstructs match objects in 4 separate transform maps. `round` was not in any of them so it was silently dropped before reaching the component — When a page manually constructs match objects from API data, every field used downstream must be explicitly included. A spread (`...match`) would have avoided this; explicit maps are error-prone under field additions.

2026-06-08 — FK constraint failure on data migration with placeholder IDs — Directive specified competition IDs as human-readable slugs (`busa-league-football-2025`) that did not exist in the DB. Script applied cleanly in dry-run but failed at first UPDATE with `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed` — Always verify FK target IDs exist in the DB before writing any migration script. Run a `SELECT id FROM [table] WHERE name LIKE '%...'` diagnostic first, not after the apply fails.

2026-06-08 — `.env.local` DB target assumed to be prod but was staging — No error, no warning; scripts ran against the wrong DB and produced the wrong audit output. Root cause: `.env.local` content changed between sessions with no visible indicator — Always run `identify-db.ts` (or print `TURSO_CONNECTION_URL` hostname) at the top of any script that writes to the DB. Never assume `.env.local` target from session memory.

2026-06-08 — Pre-prod check run against prod app instead of staging — Reported 10 failures that were expected (unfixed prod code). The check must run against the staging app (dev branch code) not prod. Root cause: `NEXT_PUBLIC_APP_URL` in `.env.production` pointed at `brixsports.com` — The clearance check validates that the dev branch's fixes work. Always run it against `brixsports-staging.vercel.app` using `.env.local`.

2026-06-11 — Backscoping via hard-delete instead of comment-out — First pass of BACKLOG-028 removed nav links and UI blocks with empty-string replacements (deletes). Convention is comment-out with BACKSCOPED marker. Root cause: convention was established mid-session after edits were already made. Fix: caught in git diff review and restored all deleted content as commented blocks before commit. Prevention: confirm preservation convention before first backscope edit, not after.

2026-06-11 — Rules of Hooks violation — `useEffect` placed after conditional `return` statements in `src/app/matches/[id]/page.tsx` — React requires hook call order to be identical on every render. If a hook appears after a `if (loading) return` guard, the hook is skipped on early renders, causing hook count mismatch between renders. Prevention: all hooks and derived consts they depend on must be declared above the first conditional return, using safe nullable access (`matchData?.match?.status`) rather than assuming the data is available.

2026-06-11 — Duplicate const declaration after hook move — Moving a `const` that appears after early returns to above them, without removing the original declaration, causes TS2451 (block-scoped variable redeclared). Same function scope, two declarations. Prevention: when moving a const up, always remove the original in the same edit pass. Run tsc immediately after.

2026-06-11 — Cherry-pick conflict when hotfix branch has features reinstated that dev has backscoped — `git cherry-pick` of a dev commit failed with 3-way conflict because the hotfix branch had Predictions/Polls imports and tab types active while dev had them commented out. The diff contained `setActiveTab('predictions')` on one side and `setActiveTab('overview')` on the other. Prevention: if a hotfix branch diverges from dev by having features reinstated, cherry-pick will always conflict on those files. Apply the fix manually instead.

2026-06-14 — College team logos empty string in DB rendered as broken img — `logo: ''` for COLNAS/COLENG/COLMANS/COLENVS. Direct `<img src="">` renders broken image. Prevention: always pass logo through `isValidLogo()` before rendering; use `TeamLogo` component everywhere, not raw `<img>`.

2026-06-14 — isValidLogo initially too strict, blocked working local paths — First implementation rejected all non-http paths, blocking `/assests/...` (local public folder) used by BUSA teams. Root cause: tried to enforce Cloudinary as part of validation. Fix: `isValidLogo` only rejects clearly broken values (empty string, null, undefined). Prevention: validation guards should protect against broken states, not enforce migration progress.

2026-06-14 — db:push fails when schema has an index that doesn't exist in live DB — `organizations_slug_unique` added to schema.ts after DBs were created, no push was run at the time. Drizzle-kit tries to delete the index on reconcile, fails. Prevention: after adding any index to schema.ts, immediately apply via SQL direct or db:push to staging. Never let schema and live DB drift.

2026-06-14 — staging and prod scores diverged silently for the same match — MD2 G1 had different homeScore on staging vs prod. No error surfaced. Prevention: after any PATCH script, always run a SELECT on both DBs and compare. Include a parity check at the end of every patch script.

2026-06-15 — Teams beyond .limit(200) silently missing from admin list — 236 teams in DB, cap was 200; the last 36 (including all 4 college teams) never appeared. No error, no warning — list just stopped. Root cause: limit set conservatively when DB had ~100 teams and never revisited. Prevention: when raising a limit, check actual row count first. Document the ceiling and set a backlog item when count approaches it (BACKLOG-045).

2026-06-15 — College team shortNames are CNAS/CENG not COLNAS/COLENG — searching "colnas" on the teams page finds nothing; searching "college" finds all 4 via the `name` field ("College of Engineering" etc.). The shortName abbreviation scheme is different from the old BUSA-style codes. Prevention: when investigating "missing" teams, query the DB to see exact shortName values before assuming a search bug.

2026-06-15 — Conditional field return based on role requires non-throwing getAuthUser — `getAuthUser` throws on invalid/missing token. Wrapping with `.catch(() => null)` in GET handlers that should be public but conditionally richer for admins. Prevention: when a public GET needs to return extra data for admins, always use `.catch(() => null)` pattern — never let an auth failure block the public response.

## Anti-Patterns for This Codebase
- Middleware matcher and internal logic check do not match.
- try/catch without finally in any DB operation.
- List query with no .limit() clause.
- createdBy, updatedBy, or any audit field set to a hardcoded string.
- Auth check that only runs client-side with no server-side counterpart.
- Business logic that assumes valid token = valid role.
- TODO or FIXME comment touching auth, permissions, or data access.
- Commented-out security checks with `// temp` or `// disable for testing`.
- UI shows success state before server response is confirmed.

## Constraints Learned From Failures
- Viewers never have a session. Never assume otherwise.
- A valid JWT does NOT equal valid permissions. Always verify role explicitly.
- Admin API routes must call `getAuthUser(request)` AND check `user.role === 'admin'` — never trust middleware alone.
- Live update mechanism must have a fallback if the channel drops.
- Viewer must see stale data clearly on failure, not a crash.
- Target update latency: under 5 seconds from event save to public display.
