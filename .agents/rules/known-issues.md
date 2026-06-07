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
