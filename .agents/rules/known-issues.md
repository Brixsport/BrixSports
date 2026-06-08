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

2026-06-08 — PATCH /api/matches/[id] has no auth gate (BUG-015) — Any caller can update match scores, status, and internal audit fields with no authentication — Add getAuthUser + admin/logger check before body read in every PATCH/DELETE handler, not just POST.

2026-06-08 — POST /api/competitions has no auth gate (BUG-016) — Any unauthenticated user can create competitions — Every POST mutation in /api/* must have getAuthUser at the top, before reading the body.

2026-06-08 — Debug/test routes live in production (BUG-017) — /api/notifications/debug, /api/notifications/test, /api/email/test have no auth and expose internal config + subscription data — Never ship debug routes without auth. Delete or gate before any deploy. Pattern repeats BUG-003.

2026-06-08 — GET /api/matches/[id] leaks internal fields (BUG-018) — approvalStatus, managerNotes, loggerId returned in public response — Always shape a DTO for public responses; never spread the raw DB row.

2026-06-08 — Admin-purpose APIs callable without auth from any origin (BUG-019) — /api/admin/infrastructure and /api/analytics/system rely on middleware only — Middleware protects browser navigation; direct HTTP calls bypass it. Always add handler-level auth.

2026-06-08 — /live page has no real-time update mechanism (BUG-020) — Fetch on mount only; viewer must manually refresh to see score changes — Critical Flow C: public livescore must auto-update. Add polling interval or WS subscription.

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
