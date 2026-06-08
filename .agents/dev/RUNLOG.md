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

Source code changes only — no database scripts run:
- BUG-013: Auth gate added to `POST /api/players/bulk-register`
- BACKLOG-011: `@sentry/nextjs` installed and configured
- BUG-014: Admin matches page fixed to use embedded `shortName` from API response

---

## Session 6 — 2026-06-07

### dev/fix-busalympics-remaining-fixtures.ts
- **Purpose:** Audit existing BUSALYMPICS match metadata, then insert 3 remaining fixtures as UPCOMING
- **Target:** Live production DB (Turso)
- **Step 1 — Read:** Found 4 existing BUSALYMPICS matches. All had correct matchday/round. 0 rows updated.
- **Step 2 — Insert:** 3 new UPCOMING fixtures inserted:

  | ID | Label | Status | Date |
  |----|-------|--------|------|
  | `a9CtLwotaXyfsfMf2odAM` | MD2 G1: COLNAS vs COLENG | UPCOMING | 2026-04-22 |
  | `_9nntLoOZZOZGzja8EQE9` | MD3 G1: COLNAS vs COLENVS | UPCOMING | 2026-04-26 |
  | `y3KcCGtHA7N7MybKTHX5K` | MD3 G2: COLMANS vs COLENG | UPCOMING | 2026-04-29 |

- **Step 3 — Verify:** SELECT all 7 BUSALYMPICS matches confirmed. All matchday/round values consistent.
- **Verified:** 7/7 rows present. No null-round/matchday anomalies.
- **Partially resolves:** BACKLOG-017 (fixtures in DB; scores still needed to PATCH to FINISHED)

---

## Session 7/8 — 2026-06-08 (BACKLOG-032 Data Normalisation)

### dev/normalise-legacy-match-rounds.ts
- **Purpose:** Backfill `competitionId` FK and `round` column on 59 legacy matches that had both set to NULL, with round baked into the denormalized `competition` string instead.
- **Target:** Live production DB (Turso)
- **Dry-run:** Confirmed 59 rows, 0 unresolvable prefixes. All extractions correct.
- **Apply:** 59/59 rows updated.
- **Changes per row:**
  - `round`: extracted from `competition` string suffix after ` - `
  - `competitionId`: resolved from prefix → `xm1OcBFeugKxLDHH6Xi6p` (BUSA LEAGUE FOOTBALL) or `m-4qhMBvnUP2a-GcU-Rsv` (BUSA LEAGUE BASKETBALL)
  - `competition` string: left intact (not modified in this script)
- **Note:** First apply attempt failed — competition IDs in the directive were placeholders (`busa-league-football-2025`), not real IDs. Real IDs confirmed via `query-competition-ids.ts` and map corrected before re-run.
- **Verified:** Post-apply query confirmed 66 matches joined via `competitionId`, 0 NULL `competitionId` remaining, 0 matches with ` - ` in `competition` and NULL `round`.
- **Resolves:** BACKLOG-032 data prerequisite (Part 1 of 2)

---

### dev/strip-competition-suffix.ts
- **Purpose:** Strip the now-redundant round suffix from the denormalized `competition` strings on the same 59 legacy matches (e.g. `"BUSA League Football - Final"` → `"BUSA League Football"`). `round` column was already correctly set by the previous script.
- **Target:** Live production DB (Turso)
- **Dry-run:** 59 rows confirmed. All stripping correct — left of first ` - ` only.
- **Apply:** 59/59 rows updated.
- **Verified:** `SELECT COUNT(*) WHERE round IS NOT NULL AND competition LIKE '% - %'` = 0.
- **Resolves:** BACKLOG-032 data prerequisite (Part 2 of 2). Display code can now use `competition · round` pattern without double-rendering.

---

## Session 9 — 2026-06-08

### dev/create-missing-competitions.ts
- **Purpose:** Create 2 missing competition rows on prod: NPUGA (FOOTBALL) and BUSALYMPICS (BASKETBALL)
- **Target:** Live production DB (Turso — `brixsportv2-brixsports`)
- **Pre-check:** SELECT confirmed neither name existed before insert.
- **Changes:** Inserted 2 rows into `competitions`:

  | ID | Name | Sport | Format | Season | Status |
  |----|------|-------|--------|--------|--------|
  | `WDQGpJ8016mdu8t-udDYq` | NPUGA (FOOTBALL) | Football | league | 2024/2025 | active |
  | `t3INEhRnQnvXGRTXTlidP` | BUSALYMPICS (BASKETBALL) | Basketball | league | 2024/2025 | active |

- **Verified:** Post-insert SELECT confirmed both rows present with correct fields.
- **Script deleted after run.**

### Pre-prod diagnostic audit (Step 2) — run same session
- `total_matches`: 66, `with_round`: 66, `with_comp_id`: 66 — round normalisation complete ✓
- `dirty_competition_strings`: 0 — no ` - ` suffixes remaining ✓
- Intercollege team org links: 4/4 set (CENG, CENVS, CMANS, CNAS) ✓
- `competition_team_entries` count: 4 ✓
- All 5 competitions now present on prod ✓

---

### dev/fix-staging-data.ts — Staging DB sync
- **Purpose:** Bring staging DB to parity with prod data state
- **Target:** Staging DB (`brixsportsv2-staging`)
- **Dry run:** Confirmed 59 rows, all competition resolutions correct
- **Step 1 — Round normalisation:** 59/59 matches updated with `round` + `competition_id`
  - Basketball matches: `6LoBXd7UYUGms0AyjCixO` (BUSA LEAGUE BASKETBALL)
  - Football matches: `xm1OcBFeugKxLDHH6Xi6p` (BUSA LEAGUE FOOTBALL)
- **Step 2 — Strip suffixes:** 59/59 `competition` strings cleaned (` - Round X` etc. removed)
- **Step 3 — Rename competitions to use parens:**
  - `BUSALYMPICS FOOTBALL` → `BUSALYMPICS (FOOTBALL)`
  - `BUSALYMPICS BASKETBALL` → `BUSALYMPICS (BASKETBALL)`
  - `NPUGA FOOTBALL` → `NPUGA (FOOTBALL)`
- **Step 4 — New competitions:** `NPUGA (FOOTBALL)` and `BUSALYMPICS (BASKETBALL)` already existed (created earlier this session) — skipped
- **Verified:** null competitionId=0, dirty strings=0, null rounds=0, all 5 competitions present ✓
- **Script deleted after run.**

### dev/pre-prod-check.ts — Final clearance run
- **Target:** Staging app (`brixsports-staging.vercel.app`) + staging DB
- **Result:** 20/20 checks passed — `[CLEAR TO MERGE]`
- Blocks 1 (auth gates), 2 (response shape), 3 (DB integrity), 4 (round distribution), 5 (competitions) all green

---

## Outstanding / Pending Scripts

| Script (not yet run) | Purpose | Blocked by |
|----------------------|---------|------------|
| PATCH MD3 G1 + MD3 G2 | Set scores + status: FINISHED for BACKLOG-017 remaining fixtures | Scores not yet confirmed from physical records |
| Standings recalculation | Calculate BUSALYMPICS group standings | All 7 fixtures must be FINISHED first (BACKLOG-033) |
| playerStats dedup audit | Investigate BUG-011 (718 goals anomaly) | Requires staging environment first (BACKLOG-005 Phase 1) |
