# Spec — Backscoped-Feature API Guard (Later-bucket item 13)

**Source finding:** `ENGINEERING_AUDIT_2026-09-17.md` C2 — "Backscoped features leave live,
unauthenticated write endpoints reachable underneath `notFound()` pages." Priority Critical,
effort estimated Medium ("shared feature-flag guard").
**Backscope entries affected:** `BACKSCOPE.md` — `/fpl/*`, `/predictions`, `Polls UI` (all filed
under `BACKLOG-028`, gap itself found session 47D under `BUG-147`).
**Status:** SPEC ONLY — no code changed yet. Sequenced ahead of item 15 (IA/nav restructure)
per Richard + peer session agreement, 2026-09-18.

---

## Problem

`notFound()` on a page component only removes the *page*. The API routes underneath keep
running with their original (missing) auth checks:

| Feature | Route(s) | Gap |
|---|---|---|
| FPL | `src/app/api/fpl/{teams,leagues,leagues/join,transfers,players}/route.ts` | `POST`/write handlers take `userId` straight from the request body — no session check |
| Predictions | `src/app/api/predictions/route.ts` (`POST`/`PUT`) | zero auth on writes |
| Polls | `src/app/api/polls/route.ts` (`POST`/`PATCH`), `src/app/api/polls/comments/route.ts` | `createdBy` optional, body-supplied |

None of this is reachable through the UI (pages are `notFound()`'d), so real-world exposure is
low — but the routes are live in production today for anyone who finds them directly. `staff-comms`
(a related but different case — a *working* feature pulled for an auth gap) already got a direct
fix in `api/staff-comms/route.ts`; this spec is for the "feature was never really built" category
instead, where the correct fix is to stop the route from doing anything at all, not to harden it.

## Why not reuse `src/lib/featureFlags.ts` as-is

That module (`isFeatureEnabled`, backing the admin Settings flags panel) is **fail-open by
design**: an unrecognized key or a DB error both return `true`. That's the right polarity for a
*live* feature someone might be mid-toggle on — a flag going down must never be the reason a
working feature vanishes for users.

Backscoped features need the opposite default: dead by default, and a DB hiccup must never be
the reason a route that's supposed to be dead comes back alive. A shared primitive with fail-open
semantics is the wrong tool here even though the name ("feature flag") sounds like a fit — reusing
it verbatim would silently invert the safety property this fix exists to add.

## Proposed primitive

A static, code-only allow-list — no DB table, no admin UI, no request-time I/O:

**`src/lib/backscopedApiGuard.ts`**
```ts
// Mirrors BACKSCOPE.md. A key here means every route under it 404s unconditionally.
// Reinstating a feature = delete its key here in the same commit that un-notFound()s
// the page (see BACKSCOPE.md's own "Reinstate when" line for each entry).
const BACKSCOPED_FEATURES = new Set([
  'fpl',          // BACKSCOPE.md: /fpl/* -- BACKLOG-028
  'predictions',  // BACKSCOPE.md: /predictions -- BACKLOG-028
  'polls',        // BACKSCOPE.md: Polls UI -- BACKLOG-028
]);

export function guardBackscopedRoute(featureKey: string) {
  if (BACKSCOPED_FEATURES.has(featureKey)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return null; // caller falls through to real handler logic
}
```

Call at the top of every affected handler:
```ts
export async function POST(request: NextRequest) {
  const blocked = guardBackscopedRoute('fpl');
  if (blocked) return blocked;
  // ...existing handler unchanged
}
```

Gates the whole route file (GET included), not just the write methods the audit flagged —
simpler and more consistent with the page already being fully `notFound()`'d; no legitimate
caller should reach any method on a route whose page doesn't exist.

## Rollout (pilot = the three confirmed gaps, nothing else)

- `fpl` → all 5 files under `src/app/api/fpl/**/route.ts`
- `predictions` → `src/app/api/predictions/route.ts`, `leaderboard/route.ts`, `stats/route.ts`
- `polls` → `src/app/api/polls/route.ts`, `vote/route.ts`, `comments/route.ts`, `comments/like/route.ts`

**Explicitly not touched by this primitive:**
- `/scouts`, `/nesa-registration` — no API routes exist, nothing to gate
- `/auth/signin` (NextAuth) — stays live intentionally, tracked separately under `BACKLOG-009`
- `staff-comms` — already fixed in place with real auth, not a "dead feature" case
- notification preferences (`BACKLOG-103`) — was never built, no live route to gate

## Test scenario

Before: `curl -X POST /api/fpl/teams -d '{"userId":"<any-id>","name":"x"}'` → 200, writes a row
attributed to any user.
After: same request → 404, no DB write. Manually re-run for one route per feature (fpl/teams,
predictions, polls) plus one already-working flow (e.g. `/api/matches` POST) to confirm the
guard doesn't false-positive on live routes.

## Out of scope (flagging per CLAUDE.md anti-pattern list)

FLAG: an admin-facing toggle UI for this, or a DB-backed version, would be overengineering for
MVP tier — these are routes for features that don't exist yet, not routes an admin needs to
flip live. A code change + redeploy is the correct weight, matching how `BACKSCOPE.md` itself is
already maintained (hand-edited markdown, not a live toggle).
