# BrixSports — Testing Strategy

**Date:** 2026-09-18
**Driven by:** `BACKLOG-400` / `ENGINEERING_AUDIT_2026-09-17.md` C1 — zero automated test coverage anywhere in the repo, protecting none of the Three Critical Flows a 225-file branch is landing on top of.
**Constraint this plan is written against:** solo developer, MVP → PRODUCTION tier, "ship over perfect" execution bias per `CLAUDE.md`. This is explicitly NOT a full test-pyramid adoption plan — a full pyramid at this stage would itself be the anti-pattern CLAUDE.md warns against ("do not overengineer for the declared tier").
**Relationship to the peer session's work:** a peer session (`agent-ops-f0`) is already implementing the audit's own Phase 0 recommendation — one plain-`fetch` smoke script exercising Flow A+B+C end to end. This document defines what comes after that, not a competing first step.

---

## The one correction to the audit's own recommendation, found while planning this out

`ENGINEERING_AUDIT_2026-09-17.md`'s C1 recommends putting the smoke script "under `dev/`." **That's a real problem, not a style note**: `dev/` is explicitly gitignored per this project's own convention ("All scripts go in `dev/` (gitignored)"). A smoke test that lives in a gitignored directory never gets committed, never travels with the repo, and cannot possibly "re-run before every promotion" the way the audit intends — it would only ever exist on whichever single machine wrote it, indistinguishable from every other throwaway verification script this project already has dozens of.

**Fix:** the smoke test (and everything else in this plan) needs to live in a new, tracked, non-gitignored location — recommend `tests/smoke/` at the repo root. This is a one-line change to what the peer session is already building (move the file, don't gitignore the new folder), not a redesign — flagging it now so it doesn't get built in the wrong place and then rediscovered stale later.

---

## Phased plan

### Phase 0 (in progress, peer session) — one smoke script
Flow A+B+C end to end: create match → assign logger → `POST` one event with a real logger JWT → assert the public `/api/matches/[id]` reflects the score within N seconds. Plain `fetch`, no framework, no dependency to install. **Only change needed:** put it in `tests/smoke/`, not `dev/`.

### Phase 1 — codify the dual-logger race test as a repeatable script
This session's own history already proves the exact test that matters most: `BACKLOG-151`'s dual-logger race was found and fixed using real concurrent `POST` calls (`Promise.all`) against two real logger accounts on a real deployed preview (`dev/dual-logger-setup.mjs`, `dev/dual-logger-race-test.mjs`, `dev/dual-logger-cleanup.mjs`, per `BUILD_JOURNAL.md`). That exact method already works and already caught a real bug once — it just isn't checked in anywhere durable. Port those three scripts' logic into `tests/smoke/dual-logger-race.test.ts` (setup → concurrent fire → assert exactly one write landed → cleanup, all in one file instead of three throwaway ones), so the next change to `events/route.ts`'s transaction logic gets caught automatically instead of needing another live-fire debugging session to rediscover the same race. Also codify the double-submission dedup check the same way (`BACKLOG.md`'s Live Event Readiness Checklist already flags this as UNVERIFIED — this closes that gap for good, not just once).

### Phase 2 — unit tests on pure logic, zero mocking needed
Introduce **Vitest** (not Jest — zero-config for this project's existing TS/ESM setup, much lighter install, and the project already runs `tsx` for its scripts so the ecosystem fit is close). Target pure functions with no DB/network dependency, where a unit test is trivial to write and genuinely protects against silent regressions:
- `src/lib/match-state-manager.ts`'s state-transition logic (1385 lines of genuinely central, easy-to-silently-break state).
- `src/lib/match-logger-helpers.ts`'s `isLoggerAssigned` and related authorization-adjacent helpers — these gate who can log events; a silent regression here is a real security-shaped bug, not just a UX one.
- The event-dedup key logic in `events/route.ts` (id OR type+minute+playerId+teamId) — this exact logic has already been the subject of multiple past bugs (`BUG-196` and others); a unit test on the key-generation function itself is cheap and would have caught several of those earlier.
- `src/lib/utils/team-logo.tsx`'s `hashColor`/`getInitials` (this session's own `BACKLOG-393` fix) and `src/lib/competitionDraw.ts`'s `computeLeaguePhaseDraw`/`assignHomeAway` (already noted elsewhere in this audit round as pure, zero-import, easy to test in isolation).
No server, no DB, no mocking required for any of these — genuinely the cheapest possible tests to add, and they're the "quick wins" quadrant of any effort-vs-value test-prioritization.

### Phase 3 — API integration tests against a real (throwaway) DB
For routes that can't be reduced to a pure function — `events/route.ts`, `assign-logger/route.ts`, `matches/route.ts`'s auth/DTO-shaping — extend the same pattern this project already uses for live verification (spin up against the real STAGING Turso DB via a throwaway match/team/player, assert, clean up afterward, confirmed via a post-delete `COUNT(*)`) but as a checked-in Vitest suite instead of an ad hoc `dev/*.mjs` script reconstructed from memory each time. This is the highest-leverage tier for catching the exact class of bug this project has repeatedly found live (auth gaps, unbounded queries, DTO field leaks — see `BACKLOG-397`/`398`/`395` from this same audit round) automatically instead of via another audit pass.

### Phase 4 — real-time (Socket.IO) coverage: extend Phase 1's pattern, don't build a WS unit-test harness
This codebase's real-time bugs have only ever been caught by live concurrent testing against a real deployed preview (per `BUILD_JOURNAL.md`'s own history) — an artificial, mocked WebSocket unit test is unlikely to reproduce the actual failure modes (the Vercel/Railway split, the `after()`-based broadcast timing that fixed `BUG-108`/`116`). Recommendation: don't invest in WS-specific unit tests. Instead, extend Phase 1's real-concurrent-request pattern to also assert the broadcast side (a `socket.io-client` instance connecting and asserting it receives the expected event within N seconds of the API call completing) — same script, one more assertion, not a new test category.

### Phase 5 (defer, don't build now) — browser-level E2E
Playwright or similar. **Not recommended at this stage** — real cost to write and maintain solo, and the click-through flows this would protect (logger login → log event → see it appear) are already covered end-to-end by Phase 1/3's API-level assertions for the parts that actually break historically (data correctness, race conditions, auth). Revisit only if a recurring class of UI-only regression emerges that API-level tests structurally can't catch (e.g., a CSS/layout regression breaking a critical button) — this project's existing Browser-pane live-verification habit already substitutes for this reasonably well at MVP tier.

---

## Beyond the Three Flows — full test-type catalog (principal-engineer view)

The phased plan above is deliberately scoped tight to what a solo developer should build *now*. This section is the wider map a principal engineer would hold for the whole platform — every test category that exists, why it would or wouldn't matter here, and where it sits on the Now/Next/Later scale. Most of it is intentionally **Later or Never** for this project's actual size — listing a category is not a recommendation to build it, and several are flagged as active overengineering risks per `CLAUDE.md`'s execution bias. Treat this as the reference to pull from later, not a new backlog.

| # | Test type | What it is | BrixSports-specific relevance | Placement |
|---|---|---|---|---|
| 1 | Unit | Pure functions, no I/O | `match-state-manager.ts`, dedup-key logic, `hashColor`/`getInitials`, draw algorithms | **Now** — Phase 2 above |
| 2 | Integration | Route handlers against a real (throwaway) DB | Auth gaps, DTO leaks, mass-assignment — exactly the class of bug `BACKLOG-397`/`398` found live this session | **Now** — Phase 3 above |
| 3 | Regression | A permanent test written *the moment* a live-fire bug is fixed, not just closed in `BACKLOG.md` | Highest-leverage category for this specific project — 400+ backlog entries, most root-caused via live debugging, almost none converted into a standing check. `BUG-236`'s exact fix (found while implementing `BACKLOG-394` just now) is a textbook case: it silently fixed part of a later-filed backlog item, and nobody would know that without re-reading the code | **Now, as a habit** — the process change ("closing a BUG-XXX and shipping a regression test are the same commit") matters more than a dedicated phase |
| 4 | Contract | Producer/consumer schema agreement | Would matter between the Vercel API and the Railway WS server, or if external consumers ever integrated — `CLAUDE.md` explicitly puts external league API integrations out of scope, so there's no consumer to protect yet | **Later** — revisit only if a third party integrates |
| 5 | E2E (browser) | Full click-through via Playwright/Cypress | Real cost to write/maintain solo; API-level tests + the existing Browser-pane live-verification habit already cover what actually breaks (data correctness, races, auth) rather than UI wiring | **Later** — Phase 5 above, deferred on purpose |
| 6 | Visual regression | Screenshot diffing to catch unintended CSS/layout drift | Genuinely relevant given the active `feature/ui-redesign` palette work this session — a semantic-token typo (`bg-card` → `bg-cart`) is exactly the silent-drift class this catches and a unit test never would | **Next** once the redesign branch is stable — not now, don't add a second moving target mid-redesign |
| 7 | Accessibility (automated) | axe-core or similar run against real pages | Blocked in this session's own live audit — the deployed site's CSP blocks both cdnjs and jsdelivr script injection. Real fix: run axe against local dev (no prod CSP) or self-host the bundle, not skip it | **Next** — cheap once unblocked, and this session's manual DOM sweep already proved there are real findings to catch |
| 8 | Security / authz matrix | A structured test walking every role × every restricted route, asserting the boundary holds | Directly motivated by this session's own findings — client-passed `approvedBy`, mass-assignment on `matches` POST, spoofable chat identity are all "the boundary wasn't actually checked" bugs a role-matrix test structurally catches, rather than needing another live audit to rediscover them | **Next**, right after `BACKLOG-397`/`398` land — test the fix, don't just ship it |
| 9 | Load / performance | Simulated concurrent load against a real endpoint (k6, artillery) | Zero load testing exists today; `CLAUDE.md`'s own "<5s update latency" target has never been measured under realistic concurrent-viewer load, only ad hoc. Worth scoping given a real match day is a stated near-term goal — but a lightweight script against `/api/matches/[id]`, not a load-testing platform | **Later**, but scope it before the first real multi-hundred-viewer match day, not after |
| 10 | Chaos / resilience | Deliberately kill a dependency mid-flow and assert the documented fallback engages | BrixSports already *has* real fallbacks (10s disconnect poll, 25s reconciliation poll, `BUG-236`'s stale-data-preserved-on-error behavior found today) — none of them have ever been tested by actually killing the connection, only trusted by code review | **Next** — natural extension of Phase 4's real-concurrent-request pattern, cheap once that harness exists |
| 11 | A/B / experimentation | Variant comparison against a metric | No feature-flag system, no experiment instrumentation, and `CLAUDE.md` explicitly excludes "Advanced analytics dashboards" from scope. This requires a userbase and product maturity this project doesn't have pre-launch | **FLAG: overengineering for this tier — do not build.** Naming it here so it's a conscious "not yet," not an oversight |
| 12 | Migration / schema | Idempotency and rollback-safety checks on Drizzle migrations | Project already runs real migrations against prod (`BACKLOG-365` item 6) with no automated guard beyond "ran it on staging first" | **Later** — one idempotency check per migration going forward is cheap; a full migration-testing framework is not warranted yet |
| 13 | Synthetic monitoring | A scheduled health check hitting the live public site, independent of deploys | Sentry already catches errors that happen; nothing currently notices Flow C degrading in production between deploys unless a human happens to look. A `/api/matches/[id]` + homepage ping every few minutes is the cheapest possible continuous enforcement of "Flow C must never break" | **Next** — very low effort, directly enforces the project's own hardest rule in real time instead of only at test time |

**The one-line summary for each bucket:** Now = the 5-phase plan already above. Next = accessibility unblock, authz matrix, chaos extension of Phase 4, synthetic monitoring, visual regression once the redesign settles — none of these need new infrastructure, they extend what Phases 1-4 already build. Later = contract tests, load testing, migration framework — real but genuinely gated on the project reaching a different scale. Never (for now) = A/B/experimentation — flagged explicitly so it doesn't quietly creep in as "well, we should probably also..." during some future planning pass.

---

## Coverage target — not a percentage

Per this project's own "ship over perfect" bias, chasing a % coverage number would itself be the wrong goal for a solo developer. **The actual target: each of the Three Critical Flows has at least one automated regression check by the end of Phase 1**, and CLAUDE.md's own Live Event Readiness Checklist gets its UNVERIFIED items (double-submission stress test, 120-min logger session, <5s latency) converted to VERIFIED-BY-AUTOMATED-TEST rather than staying manual-and-unverified indefinitely. That's the real success condition — a smaller, sharper bar than "% of lines covered," and one that maps directly to what has actually broken in production before.

---

## What NOT to do

- Don't retrofit tests onto every existing file "for coverage" — test the paths that have actually broken before (dedup races, auth gaps, DTO leaks) and the pure logic that's cheap to test, not everything uniformly.
- Don't adopt a full CI pipeline with required-checks-to-merge yet — this is a solo project; a checked-in, easily-runnable test suite that gets run before promotion is the right scope, not GitHub Actions gating every commit (that's a Phase 6 this plan deliberately doesn't reach).
- Don't block the current `feature/ui-redesign` → `dev` promotion on this plan — `BACKLOG-397`/`398`'s security fixes are the actual blockers; this testing work is Next/Later per the roadmap already sent to the peer session, not a new blocker.
