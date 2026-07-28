# BrixSports — Full BACKLOG.md Audit

> **STALE — superseded by session 47D (2026-07-28).** Every item this audit flagged as "genuinely open, real risk" (§1) has since been either resolved (`BUG-041`, `BACKLOG-059`, `BACKLOG-079`, `BUG-123`) or explicitly re-deferred with a documented reason (`BUG-074`, `BACKLOG-080`). Session 47D also ran a much larger, 6-agent full-system sweep covering far more than this single-agent BACKLOG re-read did — see `.agents/dev/AUDITS/*_47D.md` (six files: logging system, public viewer, auth/notifications, admin platform, player/team/competition data, PWA/Tier 4) for the current, authoritative picture, and `BACKLOG.md` itself for live status (this file is a point-in-time snapshot, not maintained). Kept here as historical record of what session 47C found, not as a current task list.

**Date:** 2026-07-27 (session 47C)
**Method:** full start-to-end read of `.agents/dev/BACKLOG.md` (5,943 lines at the time of this audit), not a tail/grep skim — done specifically because old entries are never rewritten in place in this project's convention (only corrected in a later paragraph), so staleness and forgotten items can only be found by reading the whole thing. Cross-checked against `.agents/rules/known-issues.md` and the tail of `.agents/dev/BUILD_JOURNAL.md` (sessions 47/47B).

---

## 1. TOP-LINE: CRITICAL/HIGH items NOT at RESOLVED — read this first

**Genuinely open, real risk (as of this audit):**

| ID | Priority | Status | Why it matters |
|---|---|---|---|
| BUG-074 | HIGH | OPEN | Staging and prod still share one Railway WS instance. Room-prefixing workaround shipped, but the *actual* fix (separate Railway service for staging) was never built. A staging-issued broadcast reaching a prod viewer has never been live-verified as impossible. |
| BUG-085 | HIGH | OPEN | Notification dedup key includes `Date.now()` — dedup never works, every notification can fire repeatedly. Filed 2026-06-29, still open. |
| BACKLOG-059 | HIGH | OPEN | "SW Scope Conflict Audit (PRE-LIVE-MATCH BLOCKER)" — filed 2026-06-16, never resolved, still labeled a pre-live blocker ~30 sessions later. |
| BUG-041 | HIGH | OPEN | React hydration error 418 on homepage, "actively degrading every real user experience" — filed 2026-06-17, never fixed. |
| BACKLOG-105 | HIGH | Interim only | Penalty shootout: only an "interim guard" shipped (`da8d9ce`); full implementation still marked OPEN since session 36/37 — never closed. |
| BACKLOG-106 | HIGH | OPEN | Per-match player stat rows (replace mutable increment model) — sub-picker visibility part shipped, the core stat-model refactor remains open. |
| BUG-092 | HIGH | OPEN | Undone events stay visible to public viewers until hard refresh (no `match:event:deleted` broadcast). Filed 2026-06-30. |
| BUG-128 | HIGH | OPEN (investigated 47C, not fixed) | Admin session bleeds into viewer header via unscoped `localStorage.authToken` — violates the project's own "viewers never have a session" rule. Confirmed session 47C: real API-level identity bleed, no privilege-escalation risk, needs its own dedicated auth-architecture session. |
| BUG-134 | HIGH | OPEN | Basketball foul system fully unenforced — no disqualification, no team-foul/bonus tracking, technical fouls miscounted into personal fouls. "A real basketball match cannot be officiated correctly through this logger today." |
| BUG-136 | HIGH | OPEN | Direct consequence of BUG-134: a fouled-out player can be subbed back onto the court — nothing gates it. |
| BUG-142 | HIGH | OPEN | Basketball has zero offline-queue/retry — any failed write (now visible via banners) is permanently lost if the logger doesn't manually retry. Should land after BUG-140 (now RESOLVED). |
| BACKLOG-140 | Medium-High | OPEN | Architecture: separate `loggers` identity table is the root cause of a recurring bug class (BUG-124, 057, 044/044b + 2 known-issues entries). Deliberately unscoped — needs its own migration session. |
| BACKLOG-141 | Medium-High | OPEN | Basketball has no real server-side lineup persistence (mirror football's `/lineup`); BUG-139's fix is only a fallback. |
| TD-010 | CRITICAL (label) | Never closed to RESOLVED | Still reads "SHIPPED — pending clean verification" in the Tech Debt section; no later entry ever flips it to RESOLVED even though many football/basketball matches have run since. Likely fine in practice but the doc itself was never closed out. |

**SHIPPED-and-stuck (this project's own rule: "SHIPPED is never a final state"), long-sitting without progressing — the pile session 47C agreed to tackle in a separate pass, not folded into PR #12:**
- **BUG-080** (HIGH, public-page WS fallback) — `Status: SHIPPED — session 38D`, filed 2026-06-27. Never promoted to RESOLVED across ~10+ sessions since.
- **BACKLOG-105** (HIGH, penalty shootout) — interim-only SHIPPED since session 36 (2026-06-29), full build never landed.
- **BACKLOG-111** (LOW) — `SHIPPED — f44edfa, Session 36. Pending live verification.` — still pending as of this audit.
- **BUG-123** (MEDIUM, WS reconnect jitter) — `SHIPPED, session 44 — logic verified, not live-tested against a real multi-client outage.`
- **BUG-119** (HIGH, broadcast latency) — explicitly `SHIPPED, session 45 — ... still not consistently under the <5s target` — CLAUDE.md's own readiness checklist item this maps to is still unchecked.

---

## 2. Full inventory (grouped by literal Status, as of the audit)

Sessions 1–25 are already self-compressed in the doc (BUG-001 through BUG-029, AUDIT-001/002 partial, BACKLOG-065 — "all resolved Sessions 1–25," per the doc's own line 62–64) — not re-expanded here. Everything below covers line ~65 to EOF at audit time.

**RESOLVED** (representative full list, all verified against an Evidence block per file convention): BUG-015/016/017/018/019/020/021-025/027/028/029/030/031/032/034/035/042/043(shipped)/044/044b/045/047/049(shipped-not-fully-resolved language)/053/054/055/059/060/061/062/063/065/066/067/070/071/072/073/076/077/078/079/081/082/083(shipped)/084/093/094/095/097/098/099/100/101/102/103/105/106/107/108/109/112/113/114/115/116/117/118/120/121/122/124(BUG)/126/129/130/131/139/140/141, BACKLOG-007/008/011/016(superseded)/017/018(in progress, mostly complete)/028/029/032/033/046/053/058/062/076/093/113(absorbed)/118/124/125/133/134/142.

**SHIPPED** (not yet RESOLVED per project convention, as of audit time): BUG-050/051/052 (session 28), BUG-056, BUG-064, BUG-068, BUG-072, BUG-080, BUG-119, BUG-123, BACKLOG-104, BACKLOG-107, BACKLOG-111, BACKLOG-119, BUG-143 (session 47C's assist-chain leak fix — code + tsc clean, live verification of the negative-test scenario not yet attempted).

**OPEN** (non-exhaustive but covers everything found): BUG-033 (duplicate entry — see §5), BUG-036/037/038/039/040/041, BUG-046, BUG-048, BUG-069(WONT FIX), BUG-074, BUG-085/086/087/088/089/090/091/092, BUG-096, BUG-104, BUG-110/111, BUG-125, BUG-127/128, BUG-132, BUG-134/135/136/137, BUG-138, BUG-142, TD-002/003/004/007/009/011/012, BACKLOG-001-006/009/010/012/013/015/019-027/030/031/033-B/035/037-045/047-052/054-057/059-061/063/064/066-075/077-092/094(×3 collisions)/095(×2)/096-102/104(×2)/105(×2)/108/109/110/112/114/115/116/120/122/126/127/128/129/130/131/135/136/137/138/139/140/141/143/144/145, BACKLOG-018 (IN PROGRESS), BACKLOG-020 (Phase 1 complete, Phases 2-8 various).

**WONT FIX:** BUG-069, BUG-011 (WONT FIX — condition no longer exists), BACKLOG-103.

**DEFERRED / SUPERSEDED / ABSORBED (non-standard states, flagged as convention drift):** BACKLOG-016 (SUPERSEDED by BACKLOG-037), BACKLOG-113 (ABSORBED into BACKLOG-105), BACKLOG-132 (DEFERRED).

**Tech Debt (TD-xxx):** TD-001 IN PROGRESS; TD-005/006/008 resolved (struck through); TD-002/003/004/007/009/011/012 OPEN; TD-010 CRITICAL, stuck at SHIPPED.

---

## 3. Staleness — filed long ago, still OPEN, no sign of revisit (as of audit time)

- **BACKLOG-059** (SW scope conflict, PRE-LIVE blocker) — filed 2026-06-16, ~30 sessions with zero follow-up mention anywhere in the rest of the file.
- **BACKLOG-019** (Post-Match Lifecycle Audit) — filed 2026-06-07, HIGH, still OPEN.
- **BACKLOG-070** (Set college for 97 NULL players) — filed 2026-06-17, "blocked on Richard," no update since.
- **BACKLOG-078/079/080** (Privacy Policy/ToS, Security Headers, Auth rate limiting) — all filed 2026-06-17, HIGH, zero progress logged despite being legal/security compliance gaps.
- **BACKLOG-085** (Core Web Vitals, root cause of 22/100 Lighthouse) — filed 2026-06-17, HIGH, only a baseline was ever logged.
- **BUG-041** (hydration error 418, homepage) — filed 2026-06-17, HIGH, never touched again.
- **BUG-085/086/087/088/089** (notification system correctness) — all filed 2026-06-29, all still OPEN, no revisit despite extensive real-time work in sessions 42-44 on adjacent WS code.
- **BACKLOG-074** (BUSA League full audit) — filed 2026-06-17, HIGH; largely superseded in practice by BACKLOG-018's backfill work but never formally closed or cross-referenced to it.

---

## 4. Stale-fact drift found (as of audit time, since corrected in session 47C)

1. **Every session-47B "resolved" Evidence block still said `Commit: pending (this session, uncommitted at time of writing)`** — for BUG-124, BUG-126, BUG-129, BUG-130, BUG-131, BACKLOG-133, BUG-133, BACKLOG-134, BUG-139, BACKLOG-124. All ten already had real, landed commit hashes on `fix/basketball-parity-critical` at the time of this audit. **Fixed in session 47C** — backfilled with real hashes.
2. **BUG-033 duplicated wholesale** — a bullet-format entry (~line 796) and a separate `### BUG-033` heading entry (line ~4351, same filed date) describe the same bug with no cross-reference. Not yet fixed.
3. **ID reuse across unrelated topics:** `BACKLOG-094` (three different bugs), `BACKLOG-095` (two), `BACKLOG-104` (two), `BACKLOG-105` (two). Not yet fixed — a real risk anyone searching by number gets the wrong entry. Not yet captured as its own lesson in `known-issues.md` either.
4. **BACKLOG-096** ("No server-side WS emit on event save," HIGH, filed 2026-06-19) reads stale against BUG-116's later fix (session 43), never cross-referenced or closed.
5. **BACKLOG-125's heading was RESOLVED but never struck through** — fixed in session 47C.
6. **BUG-126's evidence note still said "not yet live-verified"** despite session 47B's banner test having done exactly that before merge — corrected in session 47C.

---

## 5. Overlap with `known-issues.md`

`known-issues.md` distills root causes from bugs `BACKLOG.md` already tracks — working as intended, not duplicative. The BACKLOG-094/095/104/105 ID-collision pattern above is a real convention gap worth a `known-issues.md` entry of its own (a project-wide "check whether an ID has already been used before filing a new heading with the same number" rule) — not yet written.

---

## Bottom line at audit time (2026-07-27, before session 47C's fixes)

The basketball-parity sprint's own scope (BUG-124 through BUG-139) was largely closed out and evidenced, with the exception of explicitly-deferred, correctly-labeled-OPEN items — those were known and intentionally carried forward, not silently dropped. The bigger risk for "starting new feature work" was the pile of stale HIGH-priority items outside this sprint's scope that predate it by weeks (BUG-041, BUG-074, BUG-085, BACKLOG-059/019/078/079/080/085) — none data-corrupting, but several real production-facing gaps (auth-bleed BUG-128, hydration crash BUG-041, notification dedup BUG-085) sitting untouched through 10+ sessions of unrelated work.

**Session 47C's own actions against this audit:** fixed BUG-140/141/143/146, BACKLOG-142, investigated BUG-128/138 thoroughly (documented, not fixed — genuinely need their own sessions), filed BACKLOG-143/144/145. The stale SHIPPED pile (BUG-080/BACKLOG-105/BACKLOG-111/BUG-123/BUG-119) and BUG-128/138 themselves were explicitly deferred to a separate pass, agreed with Richard, rather than folded into PR #12's own scope.
