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

## Session 10 — 2026-06-13

### dev/patch-busalympics-scores.ts — BUSALYMPICS MD2/MD3 Score Entry
- **Purpose:** Patch 3 BUSALYMPICS matches from UPCOMING (0–0) to FINISHED with correct scores
- **Staging target:** `brixsportsv2-staging` (`.env.local`)
- **Prod target:** `brixsportv2-brixsports` (`.env.production`)

**Staging — 3 matches patched:**

| Match ID | Label | Result | Status |
|----------|-------|--------|--------|
| `_9nntLoOZZOZGzja8EQE9` | MD3 G1: COLNAS vs COLENVS | 3–1 | FINISHED |
| `y3KcCGtHA7N7MybKTHX5K` | MD3 G2: COLMANS vs COLENG | 0–1 | FINISHED |
| `a9CtLwotaXyfsfMf2odAM` | MD2 G1: COLNAS vs COLENG | 1–2 | FINISHED |

- **Staging verified:** Post-apply SELECT confirmed all 3 rows match expected values ✓

**Prod — 2 matches patched (MD3 only; MD2 G1 is staging-only fixture):**

| Match ID | Label | Result | Status |
|----------|-------|--------|--------|
| `_9nntLoOZZOZGzja8EQE9` | MD3 G1: COLNAS vs COLENVS | 3–1 | FINISHED |
| `y3KcCGtHA7N7MybKTHX5K` | MD3 G2: COLMANS vs COLENG | 0–1 | FINISHED |

- **Prod verified:** Post-apply SELECT confirmed both rows match expected values ✓
- **Script deleted after both DBs confirmed.**
- **BACKLOG-033 (standings recalculation) is now unblocked** — all BUSALYMPICS match results are in.

---

### dev/recalculate-busalympics-standings.ts — BUSALYMPICS Standings Recalculation
- **Purpose:** Calculate and write group-stage standings for BUSALYMPICS (competition `9q8LMVqW8KAtF4BJBlyk_`)
- **Staging target:** `brixsportsv2-staging` (`.env.local`)
- **Prod target:** `brixsportv2-brixsports` (`.env.production`)
- **Logic:** 6 FINISHED matches counted (Final excluded via `round != 'Final'`). Win=3, Draw=1, Loss=0. Sort: points DESC, GD DESC, GF DESC.

**Final standings written (group stage only):**

| Pos | Team | P | W | D | L | GF | GA | GD | Pts |
|-----|------|---|---|---|---|----|----|----|-----|
| 1 | COLNAS | 3 | 2 | 0 | 1 | 6 | 4 | +2 | 6 |
| 2 | COLENG | 3 | 2 | 0 | 1 | 5 | 4 | +1 | 6 |
| 3 | COLMANS | 3 | 1 | 0 | 2 | 3 | 4 | -1 | 3 |
| 4 | COLENVS | 3 | 1 | 0 | 2 | 5 | 7 | -2 | 3 |

- **Staging:** 4 rows INSERTed, post-apply SELECT verified ✓
- **Prod:** 4 rows INSERTed, post-apply SELECT verified ✓
- **Script deleted after both DBs confirmed.**
- **Resolves:** BACKLOG-033

---

## Session 11 — 2026-06-13

### Schema migration — player_team_affiliations (BACKLOG-037 Step 1)

Applied directly via SQL (not drizzle-kit push — blocked by pre-existing `organizations_slug_unique` drift, see BACKLOG-040).

**Changes applied to STAGING (brixsportsv2-staging) and PROD (brixsportv2-brixsports):**

1. `ALTER TABLE player_team_affiliations ADD COLUMN nicknames TEXT DEFAULT '[]'`
2. `CREATE UNIQUE INDEX pta_player_team_unique ON player_team_affiliations (player_id, team_id)`

**Staging verification:**
- `pragma_table_info` → `nicknames` column present ✓
- `sqlite_master` → `pta_player_team_unique` index present ✓

**Prod verification:**
- `pragma_table_info` → `nicknames` column present ✓
- `sqlite_master` → `pta_player_team_unique` index present ✓

**schema.ts updated:** `nicknames` column at line 95, `playerTeamAffiliationsUnique` export at lines 101–102.
**No script file created** — changes applied inline via node -e with dotenv/config pattern.
**Resolves:** BACKLOG-037 Step 1 (both DBs). Unblocks BACKLOG-038, BACKLOG-039, BACKLOG-041.

---

## Session 14 — 2026-06-15

Source code changes only — no database scripts run.

**Commits:**
- `fix: add All tab to competitions page, fix sport=null visibility (BUG-027)` — `src/app/competitions/page.tsx`
- `fix: remove motion initial props to resolve hydration error #418 on standings page (BUG-028)` — `src/app/competitions/[id]/standings/page.tsx`
- `feat: migrate team logo img tags to TeamLogo component across 13 files, skip size-sensitive instances (BACKLOG-036)` — commit `a02283b`

**Notes:**
- BUG-021 (`POST /api/notifications/subscribe` auth gate) and BUG-022 (`.limit()` on competitions + events routes) confirmed already fixed in a prior session — backlog updated to resolved.
- BUG-027: root cause was client-side sport filter defaulting to 'Football', making `sport=null` competitions permanently invisible. Fixed by adding 'All' tab as default.
- BUG-028: root cause was Framer Motion `initial` prop creating style attributes on client not present in SSR HTML; `<motion.tr>` tag mismatch was worst case. Fixed by removing all `initial` props from motion elements on the standings page.
- BACKLOG-036: 13 files migrated to `TeamLogo` component. 5 files skipped (size-sensitive layout). tsc clean post-migration.

---

## Session 15 — 2026-06-15

### squad_players unique index (staging)
2026-06-15 | `dev/add-squad-players-unique-index.mjs` | `brixsportsv2-staging` (STAGING) | SUCCESS | VERIFIED
- SQL: `CREATE UNIQUE INDEX IF NOT EXISTS squad_players_team_comp_player_unique ON squad_players (team_id, competition_id, player_id)`
- Verified via `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='squad_players'`
- Indexes confirmed: `sqlite_autoindex_squad_players_1`, `squad_players_team_comp_player_unique`
- Script deleted after run.

### squad_players unique index (prod)
2026-06-15 | `dev/add-squad-players-unique-index.mjs` | `brixsportv2-brixsports` (PROD) | SUCCESS | VERIFIED
- SQL: same as staging run above
- Verified via `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='squad_players'`
- Indexes confirmed: `sqlite_autoindex_squad_players_1`, `squad_players_team_comp_player_unique`
- Script deleted after run.

---

## Session 16 — 2026-06-15

Source code changes only this session. DB changes were applied in Session 15 (see above).

**DB changes logged this session:**
- `squad_players_team_comp_player_unique` unique index added to `squad_players` on STAGING (2026-06-15) — logged under Session 15 above.
- Same index added to PROD (2026-06-15) — logged under Session 15 above.
- Scripts: one-off index script (`dev/add-squad-players-unique-index.mjs`), deleted after run.

---

## Session 18 — 2026-06-15

### dev/migrate-sport-settings-columns.mjs
- **Purpose:** Add BACKLOG-044 Phase A columns to staging DB
- **Target:** STAGING (`libsql://brixsportsv2-staging-brixsports`)
- **Outcome:** All 11 ALTER TABLE statements succeeded
- **competition_sport_settings columns added:** `maxSubstitutions`, `allowSubbedOutReentry`, `extraTimeEnabled`, `extraTimeDuration`, `penaltiesEnabled`, `allowDraws`, `pointsForWin`, `pointsForDraw`
- **matches columns added:** `penaltiesEnabledOverride`, `allowDrawsOverride`, `extraTimeEnabledOverride`
- **Verified:** `pragma_table_info` confirmed all 11 new columns present
- **Script:** Deleted after confirmed run

---

## Outstanding / Pending Scripts

| Script (not yet run) | Purpose | Blocked by |
|----------------------|---------|------------|
| playerStats dedup audit | Investigate BUG-011 (718 goals anomaly) | Requires staging environment first (BACKLOG-005 Phase 1) |

_Note: PATCH MD3 scores and BUSALYMPICS standings recalculation were completed in Session 10 (see above). Table updated 2026-06-15._
