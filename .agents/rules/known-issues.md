---
activation: always_on
---
# Known Issues — BrixSports
## Bugs Already Solved (Never Reintroduce)
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
