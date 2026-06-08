# BrixSports — Project History

## Session 4 — Phase 4: Bells Intercollege Setup
Date: 2026-06-07
Commit: 7eb270f (phase 4 base) + pending commit (fixtures + backlog)

Completed: BACKLOG-007 (college team org links), BACKLOG-008 (BUSALYMPICS enrolment),
68 playerTeamAffiliations inserted (COLNAS 21, COLENG 34, COLMANS 7, COLENVS 6),
4 BUSALYMPICS match fixtures inserted (FINISHED).
Backlog filed: BUG-013, BACKLOG-015 through BACKLOG-019.
Scripts used: dev/fix-backlog007.ts, fix-backlog008.ts, fix-college-affiliations.ts,
fix-match-fixtures.ts (all gitignored).

Next session: Confirm 3 missing BUSALYMPICS scores (BACKLOG-017) → insert remaining
fixtures → run standings calculation → Phase 5 planning (system audit).

Context transfer: .agents/dev/CONTEXT_TRANSFER_SESSION_3.md

---

## Session 3 — Phase 2 Bug Sprint
Date: 2026-06-05

Bugs closed: BUG-001, BUG-002, BUG-003, BUG-004, BUG-005, BUG-006, BUG-007, BUG-008, BUG-009, BUG-010, BUG-012
Still open: BUG-011 (playerStats 718 goals — investigation only, no writes)

Next session starting point: Phase 4 — Bells Intercollege live data (BACKLOG-007 → BACKLOG-008)

---

## Session 6 — Auth Sweep, Bug Sprint, System Audit Continuation
Date: 2026-06-08
Commit: ac7d85c (fix(auth): user authentication checks across multiple routes)

### What Was Done

**BACKLOG-029 — Auth Audit Sweep (RESOLVED)**
Audited 17 endpoints flagged as "auth unknown" from the system audit.
Result: 0 of 17 were secure. All 17 had getAuthUser + role checks added.

Key pattern: getAuthUser called before request.json() in every handler.
401 returned if no session; 403 returned if wrong role.

Fixes per group:
- CRITICAL: competitions/register/approve, competitions/bulk (POST/PATCH/DELETE), matches/bulk, matches/bulk-update
- HIGH: matches/[id]/remove-logger, matches/[id]/loggers (all 4 methods with logger identity check), matches/[id]/assigned-loggers, players/bulk, players/create-individual, transfers (BUG-004 recurrence — createdBy sourced from authUser.id not body), competitions/[id] (PATCH+DELETE), cloudinary/sign (POST+GET), admin/ads/[id] (PUT+DELETE), analytics/loggers GET
- MEDIUM: notifications/history (GET+POST), brackets POST
- LOW: competitions/register — left public, comment added

**Additional fixes from security + code-review agents:**
- analytics/loggers POST handler had zero auth (missed in sweep) — admin gate added
- DELETE ordering bug in matches/[id]/loggers — null check now precedes identity check
- match-logger-helpers.ts — replaced ...a.logger! spread with explicit DTO (email of assigned loggers was leaking to logger role)
- auth.ts — removed hardcoded JWT fallback secret ('your-secret-key-change-in-production'); now uses env.jwtSecret from env.ts (fails fast if JWT_SECRET absent); removed console.log PII leaks (user email logged on every auth call)
- transfers GET — removed createdBy from public response; player sub-object shaped to safe fields only
- competitions/[id] GET — loggerId stripped from competitionMatches response DTO
- competitions/register GET — contactEmail and contactPhone stripped from public response
- matches/bulk-update — loggerId removed as client-writable field (banned per CLAUDE.md)

**BUG-015 through BUG-020 — All Resolved**

- BUG-015: PATCH /api/matches/[id] — getAuthUser + admin-or-logger check added; logger role verified against isLoggerAssigned(matchId, authUser.id)
- BUG-016: POST /api/competitions — getAuthUser + admin check added
- BUG-017: Deleted 3 debug/test routes (notifications/debug, notifications/test, email/test). Note: PushNotificationDebugger.tsx still references deleted endpoints — will 404; follow-up needed.
- BUG-018: GET /api/matches/[id] — loggerId, approvalStatus, managerNotes, approvedBy, approvedAt excluded via explicit destructure before response
- BUG-019: GET /api/admin/infrastructure + GET /api/analytics/system — both gated with getAuthUser + admin
- BUG-020: /live page polling interval changed from 30s to 15s (stopgap until WS subscription wired to public viewer)

**TypeScript**: tsc --noEmit exits 0 — zero new errors from all changes.

**Security rules created**
.agents/rules/security.md created (always_on). Enforces: no hardcoded secrets, no secrets in git, correct DB script pattern, env-based API tokens.
Memory saved: feedback_no_hardcoded_secrets.md in project memory store.
Triggered by: Turso auth token was hardcoded inline in a node -e eval command. Violation will not recur.

**BUSALYMPICS — MD2 G1 Score Confirmed**
Match `a9CtLwotaXyfsfMf2odAM` (COLNAS vs COLENG, Match Day 2) PATCHed directly via libsql.
Result: COLNAS 1 – 2 COLENG. Status: FINISHED.
2 of 3 missing scores remain: MD3 G1 (COLNAS vs COLENVS) and MD3 G2 (COLMANS vs COLENG).

**Backlog items filed this session**
- BACKLOG-032: Display round/matchday label on match cards (Medium)
- BACKLOG-033: BUSALYMPICS standings recalculation — blocked until both MD3 fixtures confirmed

### What Is Still Open

- MD3 G1 (COLNAS vs COLENVS, `_9nntLoOZZOZGzja8EQE9`) — score from physical records needed
- MD3 G2 (COLMANS vs COLENG, `y3KcCGtHA7N7MybKTHX5K`) — score from physical records needed
- BACKLOG-033 (standings) blocked until both above are confirmed
- BUG-021 to BUG-024 — still open
- PushNotificationDebugger.tsx — references deleted routes (notifications/debug, notifications/test) — will 404 in prod; needs fetch calls removed
- BACKLOG-032 (round label on match cards) — not started

### Next Session Entry Point
BACKLOG-032 (round display on match cards) or BACKLOG-028 (backscope dead nav items) or BUG-021 sprint.
Context transfer: .agents/dev/CONTEXT_TRANSFER_SESSION_6.md
