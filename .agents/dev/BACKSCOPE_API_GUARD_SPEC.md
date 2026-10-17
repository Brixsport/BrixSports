# Spec — Backscope Route Guard: Pages and APIs from One Registry (Later-bucket item 13)

**Source finding:** `ENGINEERING_AUDIT_2026-09-17.md` C2 — "Backscoped features leave live,
unauthenticated write endpoints reachable underneath `notFound()` pages." Priority Critical.
**Backscope entries affected:** `BACKSCOPE.md` — `/fpl/*`, `/predictions`, Polls UI (`BACKLOG-028`;
gap found session 47D, `BUG-147`), plus `/scouts` and `/nesa-registration` (pages only).
**Status:** SPEC ONLY — no code changed yet. Revised 2026-09-18 after Richard asked for the
guard to cover **pages as well as APIs, automatically**, and after re-verifying the route state
against current source (the first draft's problem table was partly stale — see below).

---

## Problem

`notFound()` on a page only removes the page. Two things go wrong from that:

1. The API routes underneath keep running with whatever auth they had.
2. Protection is per-file and manual: a new page or route added under a backscoped feature is
   live by default, and "is this feature really dead?" has to be re-answered file by file.

### Current state, re-verified against source 2026-09-18 (`getAuthUser` calls per file)

| Route file | Methods | Auth today |
|---|---|---|
| `api/fpl/teams/route.ts` | GET POST PATCH | **Authenticated** — `BACKLOG-397` |
| `api/fpl/leagues/route.ts` | GET POST PATCH DELETE | none |
| `api/fpl/leagues/join/route.ts` | POST DELETE | none |
| `api/fpl/players/route.ts` | GET POST | none |
| `api/fpl/transfers/route.ts` | GET POST | none |
| `api/polls/route.ts` | GET POST PATCH | none |
| `api/polls/vote/route.ts` | POST GET | none |
| `api/polls/comments/route.ts` | GET POST DELETE | none |
| `api/polls/comments/like/route.ts` | POST GET | none |
| `api/predictions/route.ts` | GET POST PUT | **Authenticated** — `BUG-222`, session 51 |
| `api/predictions/leaderboard/route.ts`, `stats/route.ts` | GET | none (read-only) |

**Correction to the first draft:** it listed predictions as having zero auth on writes. That was
copied from `BACKSCOPE.md`'s session-47D note without re-checking; `BUG-222` fixed it in
session 51 and `CLAUDE.md`'s checklist says so. The real remaining gap is 4 FPL files and all 4
polls files, write methods included.

## Why not reuse `src/lib/featureFlags.ts` as-is

`isFeatureEnabled` is **fail-open by design** (unknown key or DB error returns `true`) — right
for a live feature someone is mid-toggle on, wrong for a dead one. Backscoped features must be
dead by default, and a DB hiccup must never bring one back. Reusing it would invert the safety
property this fix exists to add.

## Proposed mechanism: one registry, enforced in middleware

`src/middleware.ts` already runs on every request — its matcher is the catch-all
`'/((?!_next/static|_next/image|favicon\\.ico).*)'`. That means:

- **No matcher change is needed**, so `CLAUDE.md`'s "middleware matcher and internal logic do
  not match" anti-pattern is avoided by construction, not by care.
- One check covers pages **and** APIs, and covers any route added later under a registered
  prefix without anyone remembering to guard it. That is the "auto guard" Richard asked for.
- It replaces editing ~12 route files with one registry plus one middleware block.

**`src/lib/backscopedFeatures.ts`** — static, no DB, no env, Edge-safe:

```ts
// Mirrors BACKSCOPE.md. Every path under a listed prefix 404s, pages and APIs alike.
// Reinstating a feature = delete its entry here in the same commit that removes the
// notFound() from its page (BACKSCOPE.md's "Reinstate when" line for each entry).
export const BACKSCOPED_FEATURES = [
  { key: 'fpl',          prefixes: ['/fpl', '/api/fpl'],               ref: 'BACKLOG-028' },
  { key: 'predictions',  prefixes: ['/predictions', '/api/predictions'], ref: 'BACKLOG-028' },
  { key: 'polls',        prefixes: ['/api/polls'],                     ref: 'BACKLOG-028' },
  { key: 'scouts',       prefixes: ['/scouts'],                        ref: 'BACKLOG-028' },
  { key: 'nesa',         prefixes: ['/nesa-registration'],             ref: 'BACKLOG-028' },
] as const;

export function isBackscopedPath(pathname: string): boolean {
  return BACKSCOPED_FEATURES.some(f =>
    f.prefixes.some(p => pathname === p || pathname.startsWith(p + '/')));
}
```

The `p + '/'` boundary matters: `/fpl` must not swallow a future `/fplayers`.

**In `middleware()`, first thing, before the staging auth gate** (so behavior is identical in
staging and prod, and an unauthenticated staging request gets the same 404 rather than a login
redirect that hints the route exists):

```ts
if (isBackscopedPath(pathname)) {
  return pathname.startsWith('/api/')
    ? NextResponse.json({ error: 'Not found' }, { status: 404 })
    : NextResponse.rewrite(new URL('/_backscoped', request.url)); // no such route -> app not-found.tsx, 404 status
}
```

The rewrite target deliberately does not exist, so Next renders the app's own `not-found.tsx`
with a real 404 status. Existing `notFound()` stubs in the pages stay as defense in depth;
they are not removed by this.

**Middleware is not being used as an auth check here.** `CLAUDE.md` says handlers must not rely
on middleware as the *sole auth check*. This is a route kill-switch for features that do not
exist yet, not an authorization decision, so the rule does not apply. Any feature that is
reinstated leaves the registry and goes back to per-handler `getAuthUser()`.

## Scope

- **In:** the registry above, the middleware block, and one test per prefix (below).
- **Out:** an admin toggle UI or DB-backed flag (over-engineering for MVP — these features do not
  exist; a code change and redeploy is the right weight, matching how `BACKSCOPE.md` is
  maintained). `/auth/signin` and `api/auth/[...nextauth]` (NextAuth stays live, tracked as
  `BACKLOG-009`). `staff-comms` (working feature, already fixed in place). Notification
  preferences (`BACKLOG-103`, nothing was built).

## Risks

- Middleware runs on every request; the check is a handful of `startsWith` comparisons on a
  static array — negligible, but it is on the hot path, so keep it allocation-free.
- If a prefix is registered by mistake (e.g. `/fpl` typo'd broader), live routes 404. Mitigated
  by the boundary check plus the "live route still works" test below.
- The registry can drift from `BACKSCOPE.md`. Acceptable at this size; a `dev/` script that
  diffs the two is a possible later addition, not part of this item.

## Test scenarios

1. Unauthenticated `POST /api/fpl/leagues` — before: reaches the handler; after: 404 JSON, no DB
   row (read-back to confirm nothing was written).
2. `GET /fpl` and `GET /predictions` — 404 with the app's not-found page and a real 404 status.
3. `POST /api/polls` and `POST /api/polls/vote` — 404.
4. A **new, nonexistent** route under a registered prefix (e.g. `/api/fpl/anything`) — 404
   (proves it is automatic, not per-file).
5. Live routes unaffected: `GET /api/matches`, `GET /`, `POST /api/auth/login` still behave; and
   `/fplayers` (boundary check) is not swallowed.
6. Staging: the same 404 for an unauthenticated request, not a `/login` redirect.
