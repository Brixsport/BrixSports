# BrixSports — Engineering Audit (Architecture / Tech Debt / Testing)

**Date:** 2026-09-17
**Scope:** Architecture, technical debt, testing coverage. Security, code-quality-line-level review, the Three Critical Flows' live behavior, and DB/schema health are covered by sibling agents in this same pre-promotion audit round — not duplicated here except where a finding is structural rather than a specific bug.
**Context:** `work/match-detail-tabs` worktree, branch tracks `feature/ui-redesign`, ~225 files diff vs `origin/dev`, about to be promoted `feature/ui-redesign` → `dev` → `main`. Tier: MVP → moving toward PRODUCTION.
**Companion doc:** `.agents/dev/SYSTEM_AUDIT_2026-09-17.md` (route/component/flow refresh vs the 2026-06-08 baseline).

Skills applied (in order, against real source): `engineering:system-design`, `engineering:architecture`, `engineering:tech-debt`, `engineering:testing-strategy`.

---

## Critical

### C1. Zero automated test coverage protecting the Three Critical Flows before a `main`-bound promotion
**Where:** repo-wide — no `jest`/`vitest`/`playwright`/`cypress`/`@testing-library` in `package.json`, zero `*.test.*`/`*.spec.*` files.
**Why it matters here, specifically:** this isn't a generic "you should have tests" observation — it's that a 225-file UI-redesign branch is about to land on top of the exact code paths (`FootballLogger.tsx`, `src/lib/socket.ts`, `src/app/api/matches/[id]/route.ts`, `src/app/api/events/route.ts`) that took multiple live-fire sessions to harden (the dual-logger race fix on 2026-09-10, the broadcast-await fix for BUG-108/116, the reconnect-listener-on-wrong-object fix). None of those fixes have a regression guard. The project's own `BUILD_JOURNAL.md` shows the *fix* method is consistently "reproduce live against a Vercel preview with real accounts, confirm, ship" — which proves the bugs *and fixes* every time, but proves nothing about tomorrow's change not reintroducing them. A theming/UI pass (this branch's actual content) touching `FootballLogger.tsx`-adjacent components has no mechanical way to know it broke event submission.
**Concrete evidence this is a real, not theoretical, risk:** `SimpleMatchOverlay.tsx` was flagged as dead code in one session and only actually deleted the next — i.e., even *dead component detection*, the simplest possible automatable check, is currently manual and reactive here.
**Recommendation (minimal-effort, matches the "ship over perfect" execution bias in this project's own CLAUDE.md):** do not attempt a full test pyramid. The single highest-leverage first test is **one Playwright (or even a plain `fetch`-based Node script under `dev/`) smoke test that exercises Flow A+B+C end-to-end against a running preview**: create match → assign logger → POST one event via the real API with a real logger JWT → assert the public `/api/matches/[id]` reflects the score within N seconds. This is exactly what's already being done by hand every session (per `BUILD_JOURNAL.md`'s dual-logger test) — the only change is running it as a checked-in script instead of an ad hoc one-off, so it can be re-run before every promotion instead of reconstructed from memory. This single script would have caught the dual-logger race and the broadcast-latency regression automatically, on every future change, for a few hours of one-time work.
**Tier note:** at PROTOTYPE this would be over-engineering (correctly, per CLAUDE.md's own anti-pattern list — "do not add ... at PROTOTYPE tier"). At MVP→PRODUCTION, with a live-sports real-time product and a promotion to `main` imminent, zero regression coverage on the three flows CLAUDE.md itself calls "must NEVER break" is a tier mismatch in the other direction.

### C2. Backscoped features leave live, unauthenticated write endpoints reachable underneath `notFound()` pages
**Where:** `src/app/api/fpl/{teams,leagues,transfers}/route.ts` (POST, `userId` taken directly from request body), `src/app/api/predictions/route.ts` (POST/PUT, zero auth), `src/app/api/polls/route.ts` (POST/PATCH, `createdBy` optional and body-supplied).
**Why it matters:** this is a case where the *architectural pattern* used for backscoping — hide the page, leave the API — is itself the debt, not any one route. `BACKSCOPE.md` documents this pattern being repeated three separate times (FPL, predictions, polls) across two sessions (47D), each time noted as "not fixed per the standing Tier 4 rule" and each time re-flagged rather than closed. A pattern that recurs three times and is deliberately deferred three times is a missing primitive, not three independent bugs: there is no "kill switch" convention in this codebase for taking a feature's *API* fully offline the same way `notFound()` takes its *page* offline. Building that primitive once (e.g., a shared `assertFeatureEnabled(flag)` guard called at the top of each backscoped route, keyed off `src/lib/featureFlags.ts`, which already exists in `src/lib/`) would close all three in one pass and prevent a fourth.
**Not this session's fix** (out of scope per this task's brief — flagging for the security/code-quality agents' finding to be cross-referenced, and for the change to be scoped as its own unit of work rather than folded into the current branch).

---

## High

### H1. Three parallel sport-specific API trees instead of one parameterized implementation
**Where:** `src/app/api/basketball/{matches,players,teams,standings,leaderboard/mvp}/route.ts` (5 routes), `src/app/api/football/{matches,players,teams,standings}/route.ts` (4 routes), vs. the generic, larger `src/app/api/matches/*` tree (20 route files) that already handles both sports via a `sport` field.
**Why it matters:** every bug class that has to be fixed once in the generic tree (auth, `.limit()` bounding, DTO shaping, banned-field stripping) has to be independently re-verified in two more trees that duplicate the same query logic per sport. This is exactly the shape of the basketball/track logger problem (H2 below) one layer down the stack — the codebase has now solved "don't duplicate per-sport logic" as a *known, named problem* for loggers (deliberately deferred, reasoned about in `BACKSCOPE.md`) but the same duplication already exists, unremarked, in the read API layer. No evidence either the basketball or football route trees receive the same level of scrutiny as `/api/matches/*` — the June `SYSTEM_AUDIT.md` explicitly flagged both as "auth status unknown."
**Recommendation:** not a rewrite-now item. Worth a BACKLOG entry scoped as "confirm `/api/basketball/*` and `/api/football/*` are read-only mirrors with no unique write logic, then either delete in favor of `/api/matches?sport=X` or explicitly document why they're kept separate" — a decision that's currently implicit, not made.

### H2. Basketball/Track live-event logging duplicates football's hardened core instead of sharing it
**Where:** `src/components/BasketballLogger.tsx`, `src/components/TrackLogger.tsx` vs. `src/components/FootballLogger.tsx`.
**Why it matters:** this is the most self-aware piece of debt in the entire codebase — `BACKSCOPE.md` names the exact problem (three independent implementations of event/score/period/finalize logic, one battle-hardened through BUG-052/BUG-121/TD-010/BUG-076 and multiple live tests, two not) and explicitly chose *not* to extract a shared core yet, reasoning that doing so under time pressure risks regressing the one sport with a real live-test track record. That reasoning is sound for a single session. It is now the *deferred* state across at least two sessions (45, 46), and `TrackLogger.tsx` still has literally zero persistence — a real live track event today saves nothing. This is a live-match-day blocker, not a code-quality nice-to-have, and it's invisible to anyone who only reads `CLAUDE.md`'s Live Event Readiness Checklist (which only covers football's flows).
**Recommendation:** keep deferring the *shared-core extraction* (the reasoning against doing it under pressure still holds) but add a standalone line to the Live Event Readiness Checklist: "Track & Field logging: NOT SAFE, zero persistence" — so it can't be missed by someone checking readiness who doesn't also read `BACKSCOPE.md`.

### H3. `BACKLOG.md` has grown to 13,672 lines / 394 numbered entries with no archival process
**Where:** `.agents/dev/BACKLOG.md`.
**Why it matters:** this is genuine process debt with a compounding cost. The backlog is clearly being used correctly session-to-session (evidence blocks, close-out discipline, cross-references are all real and followed — this is a better-run backlog than most projects this size have). The problem is pure scale: at 13.6k lines, `grep`-ing it is now the only practical way to use it, and every session's "read the backlog first" instruction (`CLAUDE.md`) gets more expensive over time with no corresponding value added for old, closed entries. There's no visible split between "open, needs attention" and "closed, historical record."
**Recommendation:** a one-time archival pass — move entries closed before a cutoff date (e.g., before session 40) into `BACKLOG_ARCHIVE.md`, keep only OPEN + recently-closed (last ~2 weeks) in the live file. This is pure process debt, zero code risk, and directly reduces every future session's context cost.

### H4. Vercel+Railway real-time split uses string/hostname matching for staging/prod isolation, not a structural boundary
**Where:** `src/lib/socket.ts` lines 60-66 (env inferred from `appEnv.appUrl.includes('staging.brixsports.com')` etc.), `ws-server/index.js` (single Railway instance serving both environments, rooms distinguished by an `env` field in the broadcast payload).
**Why it matters:** the code comments are unusually candid about this being a workaround (`BUG-074`'s own comment: "Deliberately NOT appEnv.isStaging... so it can't be trusted here"). For a PRODUCTION-tier live-sports product, this means a staging deploy with a bug in its hostname-detection logic, or a future deploy whose URL doesn't match the two hardcoded patterns (`staging.brixsports.com`, `brixsports-staging.vercel.app`), silently defaults to the `'prod'` room — the code's own fallback direction. A staging test event reaching real production viewers has, per this project's own history, "always been" possible (documented in `SYSTEM_AUDIT.md` §15 as present-at-handoff, not introduced later) and this session's re-read confirms the isolation mechanism is still string-matching, not infrastructure-level (e.g., separate Railway services, or a signed env claim in the API key itself).
**Recommendation:** not urgent enough to block this branch's promotion (it predates this branch, is unrelated to UI redesign work, and no incident has been reported). Worth a dedicated BACKLOG item once a second environment or domain is added, since each new hostname pattern is another string to keep in sync by hand across `socket.ts` and `middleware.ts`.

---

## Medium

### M1. Role-based access is a growing set of one-off carve-outs bolted onto a boolean `isAdmin` check, not a real RBAC layer
**Where:** `src/middleware.ts` lines 90-118.
**Why it matters:** the file's own comments show the pattern: `isAdmin`, then `isScopedLoggerManager` (added after `BACKLOG-306`'s prior gap let `logger_manager` through the *entire* `/admin/**` tree instead of just `/admin/manager`), then `isScopedRatingsLogger` (added after a near-identical gap for `logger` role on `/admin/match-ratings`). CLAUDE.md's actor model names 5 roles (Super Admin, Competition Admin, Team Manager, Logger, Viewer/Fan) but the code only distinguishes 3 (`admin`, `logger_manager`, `logger`), each with a single hand-maintained path exception. Every time a new role gets one new legitimate admin-adjacent page, this file gains one more `isScopedXInclude` boolean and one more chance to repeat the exact bug pattern that created `BACKLOG-306` in the first place (forgetting the scoping, granting access to the whole tree instead of one page).
**Why Medium, not High:** the pattern has so far been self-correcting — both prior gaps were found and fixed reactively, and the actor model currently only needs 3 distinguishable roles at the middleware layer (Competition Admin / Team Manager aren't yet implemented as distinct from `admin` anywhere visible). This is debt that will become High the day a 4th or 5th role needs its own carve-out, not before.
**Recommendation:** no urgent refactor needed for this promotion. Worth designing a small `roleCanAccess(role, pathname): boolean` table-driven check (even a plain object map) the next time a role is added, rather than a fourth boolean.

### M2. `next-auth` dual-auth-system remains unresolved (`BACKLOG-009`), now the longest-lived open item spanning both audits
**Where:** `package.json` (`next-auth@4.24.13`), `src/app/api/auth/[...nextauth]/route.ts`, alongside `src/app/api/auth/google/route.ts` and the custom JWT flow.
**Why it matters:** flagged as a security/architecture gap in the June audit (§9 item #10, §12 item #7), still open today per this session's direct check of both `package.json` and the route tree. Two independent Google-auth code paths (`next-auth`'s OAuth handler and the custom `/api/auth/google`) with different token formats is exactly the kind of latent inconsistency that surfaces as a hard-to-reproduce login bug (the recently-fixed `BACKLOG-371` — `/api/auth/me` ignoring the Authorization header — is adjacent to, though not directly caused by, this same dual-system area).
**Recommendation:** since `BACKLOG-371` just did real hardening work in this exact area, this is a good candidate for the *next* auth-focused session rather than folding into the current UI-redesign promotion — same file neighborhood, compounding value if done as one pass.

### M3. `tsc --noEmit` baseline of 18 errors, tolerated indefinitely rather than trending to zero
**Where:** repo-wide TypeScript compilation, per `CLAUDE.md`'s own rule ("zero NEW errors only... pre-existing errors in `src/db/` scripts are known and acceptable") and `BUILD_JOURNAL.md`'s confirmation the count has been unchanged ("18 errors, unchanged baseline") across the last several sessions' worth of commits.
**Why it matters:** the rule as written is reasonable triage (don't block a UI branch on unrelated pre-existing DB-script errors), but "18, unchanged" across many sessions means nobody has scheduled the actual fix — it's a permanent asterisk on an otherwise-clean signal. Since `tsc --noEmit` is the *only* automated gate this project runs before every commit (see C1 — there is no test suite), a permanently-dirty baseline slightly weakens the one automated check that does exist: a future error introduced in `src/db/` scripts is indistinguishable from the accepted 18 unless someone manually diffs the specific file list each time.
**Recommendation:** low effort, low urgency — a single follow-up session scoped to just the 18 `src/db/` script errors (not application code) would let the rule tighten to a true zero-baseline, making every future `tsc` run a strict pass/fail instead of a manual line-count comparison.

### M4. Dead-code discovery is opportunistic (found during unrelated sweeps), not a standing check
**Where:** demonstrated by this session's own git history — `MatchComponents.tsx`, `UpcomingMatchView.tsx`, `CreatePoll.tsx`, `MatchPoll.tsx` were all found and deleted *during* an unrelated dark/light-theming pass (`BACKLOG-216`), and `SimpleMatchOverlay.tsx` was flagged one session and only deleted the next after the theming sweep's own dead-code check initially missed it.
**Why it matters:** this is low-severity individually (dead files don't break anything) but the *pattern* — five dead-code deletions in one recent stretch, all found as a side effect of something else — suggests there's meaningfully more of this sitting undiscovered, and the only reason these five surfaced is that a large enough unrelated refactor happened to touch their neighborhood.
**Recommendation:** a one-time `ts-prune`-style or manual zero-importer grep pass across all of `src/components` and `src/lib`, run once as its own small task, would likely surface more of the same class cheaply. Not worth blocking this promotion on.

---

## Low

### L1. Seven-file schema split (`schema.ts` + `schema-{fpl,predictions,ratings,xi,user-lineups,enhanced}.ts`)
**Why it matters, and why it's Low:** on inspection this split correlates cleanly with feature boundaries that are *also* independently backscoped or narrow in scope (FPL, predictions, XI are all either backscoped or single-feature) — this is closer to sound modularization than fragmentation. The one real cost: `schema-enhanced.ts` (378 lines) has a name that describes nothing about its contents, and neither audit (June's or this one) has characterized what's actually in it. Not a structural problem, just a naming/documentation gap.
**Recommendation:** rename or document `schema-enhanced.ts`'s actual contents next time anyone touches it; not worth a dedicated session.

### L2. `src/lib/match-state-manager.ts` at 1385 lines
**Why it matters, and why it's Low:** size alone isn't damning for a file that owns genuinely central, highly-interconnected state (match lifecycle, scoring, period transitions) — splitting it prematurely risks the same regression-under-refactor risk already reasoned about and avoided for the logger duplication (H2). Flagging only so it's on record as a file worth watching if it keeps growing, not as an action item now.

---

## What's explicitly *not* re-litigated here (owned by sibling agents this round)
- Line-level code quality / correctness review — code-quality agent.
- Full API auth inventory (the June audit's 155-endpoint sweep) — security agent.
- Database table health, unused tables, missing constraints — DB/schema agent.
- Live behavioral verification of the Three Critical Flows on the current deployed preview — flow-checker / Three-Critical-Flows agent.

---

## Summary table

| # | Finding | Priority | Effort to address |
|---|---|---|---|
| C1 | Zero automated tests protecting the 3 Critical Flows before `main` promotion | Critical | Low (one smoke script) |
| C2 | Backscoped features' APIs stay live/unauthenticated under `notFound()` pages | Critical | Medium (shared feature-flag guard) |
| H1 | Duplicated per-sport API trees (basketball/football vs. generic matches) | High | Medium (audit + consolidate or document) |
| H2 | Basketball/Track loggers duplicate football's hardened core; Track has zero persistence | High | High (deferred deliberately, correctly) |
| H3 | `BACKLOG.md` at 13.6k lines, no archival | High (process) | Low (one archival pass) |
| H4 | Staging/prod WS isolation is hostname-string-matching, not structural | High | Medium (infra change) |
| M1 | RBAC is one-off middleware carve-outs, not a table-driven layer | Medium | Low now, grows with each new role |
| M2 | `next-auth` dual-auth system still unresolved (`BACKLOG-009`) | Medium | Medium |
| M3 | `tsc` baseline stuck at 18 errors indefinitely | Medium | Low |
| M4 | Dead-code discovery is opportunistic, not systematic | Medium | Low |
| L1 | `schema-enhanced.ts` undocumented/unclear name | Low | Trivial |
| L2 | `match-state-manager.ts` size (1385 lines) | Low | N/A (watch only) |

---

*Produced 2026-09-17 as the architecture/tech-debt/testing slice of a multi-agent pre-promotion audit for `feature/ui-redesign` → `dev` → `main`. Cross-reference `.agents/dev/SYSTEM_AUDIT_2026-09-17.md` for the route/flow inventory refresh this audit draws on.*
