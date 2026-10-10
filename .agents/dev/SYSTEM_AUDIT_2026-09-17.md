# BrixSports — System Audit (Refresh)

**Audited:** 2026-09-17
**Previous audit:** `.agents/dev/SYSTEM_AUDIT.md`, 2026-06-08 (BACKLOG-020 Block 6) — over 3 months stale, not overwritten
**Branch:** `work/match-detail-tabs` (worktree, tracks `feature/ui-redesign`), pre-promotion to `dev` then `main`
**Task:** Architecture/tech-debt/testing slice of a multi-agent pre-promotion audit (security, code-quality, DB/schema, and Three-Critical-Flows are covered by sibling agents in this same audit round — not duplicated here)
**Method:** targeted re-verification against current source + `.agents/dev/BACKLOG.md`, `BUILD_JOURNAL.md`, `BACKSCOPE.md`, git history — not a from-scratch full sweep of all 65+ routes/155 API handlers/158 components. Where a 2026-06-08 finding wasn't re-checked, it's marked **NOT RE-VERIFIED** rather than assumed fixed.

---

## 0. Why this refresh exists

The 2026-06-08 audit is doing real work as a historical baseline (its own §15 already documents several corrections made after live use proved the static sweep wrong). Three months of shipped work — visible in 380+ BACKLOG entries filed since, an entire dark/light theming pass (`BACKLOG-216`), a lineup/XI rebuild (`BACKLOG-323`), a Fan Account Blueprint, and a Google OAuth session fix (`BACKLOG-371`) — have moved or invalidated a large fraction of its route/component inventory. This document is additive: it does not overwrite `SYSTEM_AUDIT.md`, it records what changed.

---

## 1. Three Critical Flows — re-verified

| Flow | 2026-06-08 | 2026-09-17 | Change |
|------|------------|------------|--------|
| **A — Match Creation** | WORKING | WORKING | Unchanged. `POST /api/matches/[id]/assign-logger` still admin+transaction gated. |
| **B — Live Event Logging** | WORKING | WORKING, hardened | **Resolved since:** dual-logger race condition (score double-count) found and fixed 2026-09-10 — dedup check moved inside the same transaction as the event insert (`BACKLOG-151`), live-tested with two real logger accounts firing `Promise.all` simultaneous goals against a deployed preview. This is the single most load-bearing regression-risk item in the whole platform and it now has a real concurrency fix, not just a code-read. |
| **C — Public Livescore** | PARTIAL (no WS fallback, one-shot fetch) | Still PARTIAL, but for a different, better-understood reason | The June audit's own §15 (added later) shows the real picture was worse than the June pass could see: DB-write and broadcast were entirely uncoordinated, the match clock had no DB-persisted value, and the reconnect listener was on the wrong object. **`broadcastToMatch()` in `src/lib/socket.ts` is now awaited** (BUG-108/116 fixed — fire-and-forget removed), which was the single biggest latency contributor (was ~42s, now ~9.9s). **Still open:** the <5s target in CLAUDE.md's Live Event Readiness Checklist is unmet and unmeasured since Aug 7 — this is now a *known, tracked, measured* gap rather than an unknown one, which is real progress, but the flow itself has not closed. |

**Net assessment:** Flow C's status hasn't changed (PARTIAL) but the audit trail underneath it has — this is no longer an under-audited flow, it's a well-instrumented one with a specific unmet latency target.

---

## 2. Route inventory changes since 2026-06-08

### Resolved (existed as a problem in June, fixed since)
| Item | June status | Now |
|------|-------------|-----|
| `/match/[id]` vs `/matches/[id]` duplicate routes | Flagged as likely duplicate, unresolved | **Resolved** — only `/matches/[id]` exists in the current tree. `/match/[id]` is gone. |
| `PATCH /api/matches/[id]` no auth (Critical security gap, item #1 in June's priority list) | CRITICAL, open | **Fixed** — `getAuthUser(request)` confirmed present at `src/app/api/matches/[id]/route.ts:593` and `:955`. Matches June audit's own later §15 correction. |
| `/competitions/[id]/standings` as a separate mock route | WORKING (but flagged BACKLOG-286/287 for ALL/TRACK 404s) | **Removed** — standings now lives inside `/competitions/[id]/page.tsx` as a tab; the old mock standings route and its 404s were deleted per commit `b44ae0a`. |
| `/football`, `/basketball` public pages | PARTIAL | **Deleted** (`BACKLOG-290`, commit `6d14c99`) — sport-specific public pages removed; the flagged "potential duplication" between these and `/api/matches` is now moot at the page level (the API duplication below still stands). |
| `/favourites` | PARTIAL | **Deleted and replaced** — was linked to a dead mock page; fixed to point at the real hub (`BACKLOG-385`, commit `41f3a90`). |
| `/scouts` | Recorded as "DEAD — redirects to `/`" | **Mechanism changed, same outcome**: now `notFound()`, not a redirect — `BACKSCOPE.md` explicitly corrects this stale description (its own session-47D note). Still DEAD/no-op, cosmetic difference only. |
| `/fpl/*`, `/predictions`, `/nesa-registration` | NOT BUILT (live but empty/scaffold) | **Formally backscoped** — all now return `notFound()` at the page layer per `BACKSCOPE.md` (2026-06-08 backscoping pass, same day as the old audit). The pages are no longer reachable; **the API routes underneath are not gated the same way** — see §5. |
| `/xi` (Team Builder, PARTIAL in June) | PARTIAL, standalone | **Absorbed into `/lineup-builder`** — `src/app/xi/page.tsx` was deleted (commit `13a1195`, `BACKLOG-323` step 7); `/lineup-builder` was rebuilt as the public XI feature and `/lineup-builder/gallery` added. `src/app/xi` no longer exists on disk. Any external link or bookmark to `/xi` is now dead. |
| `/admin/match-lineups` (Lineup Builder, 🔴 in both audits) | PARTIAL, 🔴, "unknown stability" | **Substantially hardened** — `BUG-219` (publish crash), `BUG-220` (no publish path + unenforced lock), `BUG-221` (unauthenticated draft-lineup leak) all resolved and live-verified (session 51/53); `BACKLOG-220`'s architecture cleanup (dead duplicate rendering code, non-atomic write race, no formation-change confirm) also resolved 2026-09-05 with a live-tested concurrent-write race fix. Current `CLAUDE.md` keeps it 🔴 *conservatively* pending a full re-audit against this specific bug list, not because the original reasons still hold. This is a meaningfully different risk profile than either audit's classification implies at face value. |
| `PATCH /api/matches/[id]` internal-field leak (`approvalStatus`, `managerNotes`, `loggerId`) | MEDIUM gap, open | **Fixed** — explicit DTO stripping, per June audit's own §15 correction. |

### Newly dead code (found and removed this session, not present at either audit)
| File | Notes |
|------|-------|
| `src/components/MatchComponents.tsx` | Zero importers, imported from deprecated `mock-data.ts` (flagged in June §7). Deleted commit `2edd028`. |
| `src/components/matches/UpcomingMatchView.tsx` | Same commit, same pattern. |
| `src/components/CreatePoll.tsx`, `src/components/MatchPoll.tsx` | Polls dead-code cluster (June §7 "Scope-Creep Components"). Deleted commit `942543e`. |
| `src/components/SimpleMatchOverlay.tsx` | Found *during* the theming sweep, not by the sweep's own dead-code check — flagged one session, deleted the next (`7568095`). Evidence that dead-code discovery here is still opportunistic, not systematic (see tech-debt report). |

### Still dead / still an open gap (unchanged from June, NOT newly re-verified beyond a grep)
- `src/components/TopPlayers.tsx` and `src/components/MyFeed.tsx` still import from deprecated `src/lib/mock-data.ts` — 2 of the original 3 importers remain (the third, `MatchComponents.tsx`, is now deleted). **Unchanged gap**, not worsened.
- `next-auth@4.24.13` is still installed and `/api/auth/[...nextauth]/route.ts` still exists alongside the custom JWT flow and `/api/auth/google` — **`BACKLOG-009` (dual auth system) is still open**, confirmed present in both `package.json` and the route tree today. This is the single-longest-lived unresolved item across both audits (over 3 months, still open).
- `MatchLineup.tsx` and related lineup components — largely superseded; several dead-code clusters under this name were deleted across multiple commits (`9d7a493`, `cf23a82`, `cc0f242`) as the lineup builder was rebuilt. **Not independently re-verified** that nothing else in this family is now orphaned.

### Newly built, not present in June's inventory at all
| Route/feature | Status | Notes |
|---|---|---|
| `/admin/roster-transfers` | 🟢 WORKING | New season-readiness roster-transfer UI, distinct from the old `/admin/transfers` news/rumor page (still 🔴). Freshly built and live-verified session 53. |
| `/lineup-builder`, `/lineup-builder/gallery` | Public, absorbed `/xi` | See above. |
| Fan account model (Viewer can hold an authenticated "Fan" session) | New actor-model concept | `CLAUDE.md`'s Actor Model was revised: Viewer is "anonymous by default," not "never has a session" — a signed-up/signed-in Viewer is a Fan with favourites/follows/preferences, still zero privileged capability. This is a real model change from the June audit's "Viewers NEVER have a session" framing (that framing is now stale, not just the route inventory). |
| Google OAuth session handling | Fixed this cycle | `BACKLOG-371`: `/api/auth/me` previously ignored the `Authorization` header (cookie-only), and the OAuth session was localStorage-dependent in places that silently acted logged-out. Both fixed and confirmed live on staging (commits `af072d8`, `e37d5ef`, `8b2e971`). |

---

## 3. API surface — not independently re-swept, spot-checked only

The June audit's full 155-endpoint security inventory (§5) was **not re-run in full** — that class of work is explicitly owned by the sibling security-review agent in this audit round, and duplicating it here would waste both sessions' budgets. What is in scope here (architecture/structure) and was checked:

- **Confirmed still true, structural duplication**: three parallel sport-scoped route trees exist side by side — `/api/basketball/{matches,players,teams,standings,leaderboard/mvp}` (5 routes), `/api/football/{matches,players,teams,standings}` (4 routes), and the generic `/api/matches/*` tree (20 routes) that also serves both sports via a `sport` field/filter. This wasn't mentioned as duplication-of-concern in the June audit beyond a one-line "potential duplication" note — it's real, confirmed by direct route listing, and is the clearest concrete case of code-debt in the API layer (detailed in the consolidated engineering audit).
- **Confirmed still true**: `BACKSCOPE.md` documents (as of sessions 47D, i.e. after the June audit) that `/api/fpl/*` POST routes, `/api/predictions` POST/PUT, and `/api/polls` POST/PATCH remain live and unauthenticated even though their pages are `notFound()`-gated. This is a real, currently-open gap the project's own docs flag and *deliberately* defer under a stated "Tier 4" triage rule — worth surfacing here because it's exactly the kind of thing a stale audit would otherwise let go unmentioned for another 3 months.

---

## 4. Basketball/Track live-logging — unchanged critical gap, now better documented

Not present at all in the June audit (which didn't examine sport-specific logger internals this deeply). `BACKSCOPE.md` (sessions 45-46, both after June) documents:
- `TrackLogger.tsx` has **zero `fetch()` calls** — a fully local UI, nothing is ever persisted for a live track event.
- `BasketballLogger.tsx`'s score/period persistence gaps were found and fixed session 46, but the underlying architectural problem — three sport loggers each duplicating football's event/score/finalize logic instead of sharing a hardened core — remains open and deliberately deferred (risk of regressing football's live-tested logic under time pressure was judged worse than leaving basketball/track under-shared).
- **This is a live-match-day blocker for track specifically** (basketball's core gaps are fixed) that predates this branch and is untouched by it — flagging because CLAUDE.md's own Live Event Readiness Checklist doesn't mention track at all.

---

## 5. Testing / verification method — structural gap, unchanged since June, now quantified

Confirmed this session: **zero automated tests exist anywhere in the repository** — no test framework in `package.json` (`jest`/`vitest`/`playwright`/`cypress`/`@testing-library` all absent), zero `*.test.*`/`*.spec.*` files. This was true in June and is still true now; the 2026-06-08 audit didn't call it out as its own finding, which is itself a gap in that audit's method (a route/table/component sweep doesn't surface "there is no test suite"). Full analysis in the consolidated engineering audit's testing-strategy section.

---

## 6. What this refresh did not re-verify

To keep this pass proportionate to a 3-month refresh rather than a full re-audit, the following June sections were **not** independently re-checked and should not be assumed current:
- The full §5 API security inventory (135+ endpoints) — owned by the sibling security-review agent this round.
- The full §6 database table inventory — owned by the sibling DB/schema-health agent this round.
- §8 Packages — Dead/Risk (next-auth confirmed still present; `resend`/`stripe` not re-checked).
- Admin page auth-gate details beyond what `src/middleware.ts` itself shows (re-read in full this session — see consolidated report's architecture section for what changed there, notably the `logger_manager`/`logger` scoped carve-outs added since June, BACKLOG-306/-317).

---

*This document supplements, does not replace, `.agents/dev/SYSTEM_AUDIT.md` (2026-06-08). Cross-reference both for full history. Produced as part of the 2026-09-17 pre-promotion audit round (architecture/tech-debt/testing slice); see `.agents/dev/ENGINEERING_AUDIT_2026-09-17.md` for the consolidated, prioritized findings.*
