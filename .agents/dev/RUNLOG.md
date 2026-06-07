# BrixSports — Script Run Log

All scripts in `dev/` are gitignored. This file is the permanent audit trail
of every script run against the live database or system.

Format per entry:
```
DATE | SCRIPT | TARGET | OUTCOME | VERIFIED
```

---

## Session 1 — 2026-05-03

No scripts recorded. Work was API route edits and audit only.

---

## Session 2 — 2026-05-04

No scripts recorded. Work was API route edits and audit only.

---

## Session 3 — 2026-06-05 (Phase 2 Bug Sprint)

No database scripts run. All work was source code edits (BUG-001 through BUG-012).

---

## Session 4 — 2026-06-07 (Phase 4: Bells Intercollege Setup)

### dev/fix-backlog007.ts
- **Purpose:** Set `ownerOrganizationId` on 4 orphaned college teams
- **Target:** Live production DB (Turso)
- **Changes:**
  - `mhXc8I0hBxe5W6eCw3do9` (COLNAS) → `org_org_bells-university-colnas`
  - `k6BgZFG_mtatQ11NZNQb9` (COLENG) → `org_org_bells-university-coleng`
  - `ISzKeGGXuvW2h5QGmnWcp` (COLMANS) → `org_org_bells-university-colmans`
  - `U6R7aZSXNvA0iMsdVi3XV` (COLENVS) → `org_org_bells-university-colenvs`
- **Verified:** SELECT after each update confirmed. 4/4 rows updated.
- **Resolves:** BACKLOG-007

---

### dev/fix-backlog008.ts
- **Purpose:** Enrol 4 intercollege teams in BUSALYMPICS competition
- **Target:** Live production DB (Turso)
- **Changes:** Inserted 4 rows into `competition_team_entries`:
  - COLNAS → BUSALYMPICS (`9q8LMVqW8KAtF4BJBlyk_`)
  - COLENG → BUSALYMPICS
  - COLMANS → BUSALYMPICS
  - COLENVS → BUSALYMPICS
  - All: `sport: Football`, `gender: male`, `status: registered`, `groupName: null`
- **Verified:** SELECT confirmed 4 rows inserted.
- **Resolves:** BACKLOG-008

---

### dev/fix-college-affiliations.ts
- **Purpose:** Insert `playerTeamAffiliations` rows linking college players to their college teams
- **Target:** Live production DB (Turso)
- **Changes:** Inserted 68 rows into `playerTeamAffiliations`:
  - COLNAS: 21 players
  - COLENG: 34 players
  - COLMANS: 7 players
  - COLENVS: 6 players
  - All: `affiliationType: 'college'`, `isPrimary: false`, `isActive: true`
- **Notes:** Script hit a Turso `ConnectTimeoutError` mid-COLENG on first run.
  Safe re-run completed correctly — dedup logic skipped already-inserted rows.
  1 retry insert, remainder skipped. Final counts confirmed via SELECT.
- **Verified:** 4 per-college SELECT counts all matched expected numbers.

---

### dev/fix-match-fixtures.ts
- **Purpose:** Insert 4 BUSALYMPICS match fixtures with known scores
- **Target:** Live production DB (Turso)
- **Changes:** Inserted 4 rows into `matches`:

  | Match ID | Label | Result | Date |
  |----------|-------|--------|------|
  | `OPoEtVGUNWKcRSDe4QdSr` | MD1 G1: COLNAS vs COLMANS | 2–1 | 2026-04-17 |
  | `tyYRU5nlOrqnEXEpvIEC6` | MD1 G2: COLENG vs COLENVS | 2–3 | 2026-04-18 |
  | `nDns_3mSI23jERQJhMNli` | MD2 G2: COLMANS vs COLENVS | 2–1 | 2026-04-24 |
  | `_lkHo5y1m6ArqvLsi1ixe` | FINAL: COLNAS vs COLENG | 5–0 | 2026-05-01 |

  All: `status: FINISHED`, `approvalStatus: PENDING`,
  `competitionId: 9q8LMVqW8KAtF4BJBlyk_`, `competition: BUSALYMPICS`,
  `venue: Bells University Sport Complex`, `sport: Football`
- **Verified:** SELECT by match ID confirmed all 4 rows present with correct scores.

---

## Session 5 — 2026-06-07 (continuation)

No database scripts run. Work was:
- BUG-013: Auth gate added to `POST /api/players/bulk-register`
- BACKLOG-011: `@sentry/nextjs` installed and configured
- BUG-014: Admin matches page fixed to use embedded `shortName` from API response

---

## Outstanding / Pending Scripts

| Script (not yet run) | Purpose | Blocked by |
|----------------------|---------|------------|
| `dev/fix-match-fixtures.ts` (extension) | Insert 3 missing BUSALYMPICS fixtures (BACKLOG-017) | Scores not yet confirmed from physical records |
| Standings recalculation | Calculate BUSALYMPICS group standings | BACKLOG-017 (missing fixtures) |
| playerStats dedup audit | Investigate BUG-011 (718 goals anomaly) | Requires staging environment first (BACKLOG-005 Phase 1) |
