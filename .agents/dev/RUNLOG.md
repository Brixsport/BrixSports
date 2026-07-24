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

## Session 13 — 2026-06-15

### dev/query-col-teams.mjs (deleted after run)
- **Purpose:** Diagnostic read — identify college team IDs and short_name values on staging
- **Target:** STAGING (`brixsportsv2-staging`) — read-only
- **Query:** `SELECT id, name, short_name, sport FROM teams WHERE name LIKE '%col%' OR short_name LIKE '%col%'`
- **Result:** 4 rows — CENG (College of Engineering), CENVS (College of Environmental Sciences), CMANS (College of Management Sciences), CNAS (College of Natural & Applied Sciences). All Football. `short_name` values are `CENG`/`CENVS`/`CMANS`/`CNAS` — match came from full name not short_name.
- **Notes:** Confirmed `shortName` abbreviation scheme differs from BUSA-style codes (`COLNAS`/`COLENG`). No writes. Script deleted after run.

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

## Session 19 — 2026-06-16

### Staging — drop redundant columns
2026-06-16 | `dev/drop-redundant-columns-staging.mjs` | STAGING (`libsql://brixsportsv2-staging-brixsports`) | SUCCESS | VERIFIED
- Dropped `match_duration` (original col) and `extraTimeDuration` (Phase A col) from `competition_sport_settings`
- Verified via `pragma_table_info` — 16 columns remain, both removed columns absent
- Script deleted after run

### Prod — BACKLOG-044 Phase A migration
2026-06-16 | `dev/migrate-sport-settings-prod.mjs` | PROD (`libsql://brixsportv2-brixsports`) | SUCCESS | VERIFIED
- **competition_sport_settings columns added:** `maxSubstitutions`, `allowSubbedOutReentry`, `extraTimeEnabled`, `penaltiesEnabled`, `allowDraws`, `pointsForWin`, `pointsForDraw` (7 columns)
- **matches columns added:** `penaltiesEnabledOverride`, `allowDrawsOverride`, `extraTimeEnabledOverride` (3 columns)
- Note: `match_duration` (col 6) still present on prod — original pre-Phase-A column, not introduced by this session. Staging had this dropped; prod drop deferred.
- Verified via `pragma_table_info` — all 10 new columns confirmed present
- Script deleted after run

---

## Session 20 — 2026-06-16

### Staging — player college + university normalization
2026-06-16 | `dev/fix-player-college-university.mjs` | STAGING (`libsql://brixsportsv2-staging-brixsports`) | SUCCESS | VERIFIED
- **College fixes:** `ColEng` → `COLENG` (2 rows), `Colmans` → `COLMANS` (1 row), `''` → `NULL` (3 rows)
- **University fixes:** 178 rows updated (`'Bells University'` and `'Bells University of Technolgy'` → `'Bells University of Technology'`)
- **Post-verify:** college distribution = NULL(111), COLENG(34), COLENVS(6), COLMANS(7), COLNAS(21). Single distinct university value: `Bells University of Technology`
- Script left in dev/ pending prod run after staging verification

## Session 21 — 2026-06-16

### Production — player college + university normalization
2026-06-16 | `dev/fix-player-college-university-prod.mjs` | PROD (`libsql://brixsportv2-brixsports`) | SUCCESS | VERIFIED
- **College fixes:** `ColEng` → `COLENG` (2 rows), `Colmans` → `COLMANS` (1 row), `''` → `NULL` (3 rows)
- **University fixes:** 178 rows updated (`'Bells University of Technolgy'` and `'Bells University'` → `'Bells University of Technology'`)
- **Post-verify:** college distribution = NULL(111), COLENG(34), COLENVS(6), COLMANS(7), COLNAS(21). Single distinct university: `Bells University of Technology`
- Script deleted after successful run

---

### Staging + Production — Animashun duplicate player stub deletion
2026-06-16 | `dev/delete-animashun-stub.mjs` | STAGING then PROD | SUCCESS | VERIFIED
- **Pre-flight:** Animashun (`sQVPtcWxrN3VBeGvL88_O`) confirmed 0 events, 0 stats, 1 affiliation (team: "Bells University") — safe to delete
- **Deleted:** 1 `player_team_affiliations` row + 1 `players` row on both staging and prod
- **Post-verify:** Exactly 1 Animashun row remains on both DBs: `Animashun Oluwanifemi` (`player-1767972615670-yet6lrue1`)
- **"Bells University" team (`bells-uni-id`):** now 0 affiliations remaining — team row NOT deleted, awaiting decision
- Script deleted after confirmed

---

### Staging + Production — Delete Bells University stub teams
2026-06-16 | `dev/delete-bells-stub-teams.mjs` | STAGING then PROD | SUCCESS | VERIFIED
- **Targets (10 teams):** `bells-uni-id` ("Bells University") + 9 "Bells University of Technology [Sport] (M/F)" variants
- **Pre-flight checks:** 0 affiliations, 0 matches — all clean on both DBs
- **Blocker found and resolved:** `users.favorite_team_id` — 2 users had stub team IDs as their favourite team (temitopeyr@gmail.com → `wrKivda1UMTyJ0nntZJjn`; ramotaadenike67@gmail.com → `bells-uni-id`). Nulled before delete.
- **Deleted:** 10 team rows on both staging and prod
- **Post-verify:** Exactly 4 Bells-related teams remain on both DBs: College of Engineering (34 players), College of Environmental Sciences (6), College of Management Sciences (7), College of Natural & Applied Sciences (21)
- Scripts deleted after confirmed

---

## Session 22 — 2026-06-16

### dev/query-joseph-leo-affiliations.mjs (retained in dev/)
- **Purpose:** Diagnostic read — investigate player affiliation flags for players named 'joseph' and 'leo' (suspected transfer dual-row candidates)
- **Target:** STAGING (`brixsportsv2-staging`, `.env.local`) — read-only
- **Query:** `SELECT p.id, p.name, pta.team_id, t.name as team_name, pta.is_primary, pta.is_active, pta.jersey_number, pta.created_at FROM players p JOIN player_team_affiliations pta ON pta.player_id = p.id JOIN teams t ON t.id = pta.team_id WHERE LOWER(TRIM(p.name)) IN ('joseph', 'leo') ORDER BY p.name, pta.created_at DESC`
- **Result:** 4 rows — each player has exactly 1 affiliation (no transfer rows). `JOSEPH` (Siberia, jersey 11, `wt7u32zw…`), `LEO` (Siberia, jersey 90, `k-5lN92H…`), `joseph` (Rim Reapers, jersey 23, `r-GRRz8I…`), `leo` (Rim Reapers, jersey 7, `vr76h3RU…`). `JOSEPH`/Siberia has `created_at: null`.
- **No writes.** Filed as BACKLOG-065 (Suspicious — pending manual verification against physical registration records).

---

### src/app/api/events/route.ts — BUG-032 null playerId gate (code change, no DB)
- **Purpose:** Block future `player_id = NULL` insertions for stat-affecting event types
- **Target:** Source code only — no DB writes
- **Changes:**
  - Added `PLAYER_REQUIRED_TYPES` guard block after substitution validation in `POST /api/events` — rejects requests where `playerId` is absent for Goal, Penalty, Own Goal, Yellow Card, Red Card, Assist, Save event types. Returns 400 with descriptive error.
  - Removed unused `desc` import from `drizzle-orm`
  - Renamed local `normalizedType` to `normalizedEventType` to avoid collision with the existing `normalizedType` const in the score recalculation block below it
- **tsc:** Zero new errors. Pre-existing errors in other files unchanged.
- **Note:** 39 existing null-player event rows on staging + prod are NOT touched. Separate audit required before any backfill. Resolves BUG-032 (forward gate only).

---

### dev/query-bells-no-college.mjs (retained in dev/)
- **Purpose:** Diagnostic read — identify Bells BUSA-league players with no college team affiliation
- **Target:** STAGING (`brixsportsv2-staging`, `.env.local`) — read-only
- **Logic:** Find all teams with `university = 'Bells University of Technology'` excluding the 4 college teams (`College of%`). Then return all players affiliated with those BUSA-league teams who have no affiliation with any of the 4 college team IDs.
- **Result:** 22 Bells BUSA-league teams found. **110 players** have no college affiliation.

  | Team | Count |
  |------|-------|
  | Hammers | 18 |
  | Rim Reapers | 13 |
  | Siberia | 17 |
  | Storm | 16 |
  | TBK | 11 |
  | Titans | 11 |
  | Vikings | 14 |
  | Kings FC | 2 |
  | Pirates FC | 7 |
  | (others — 0 on staging) | — |

  Full player list (player_id | name | team | jersey):
  `8a1670b4…|Ahima|Hammers|16`, `19983528…|Charles|Hammers|14`, `6514e137…|Charles (400L)|Hammers|78`, `1649e892…|Collins (Eberechi)|Hammers|2`, `40f8b853…|Fuad|Hammers|4`, `0e7240cc…|Gundi|Hammers|7`, `73dcf9a4…|Ike|Hammers|1`, `cbf4241e…|Lazzy (woods)|Hammers|77`, `61777abf…|OBA|Hammers|85`, `b0fc2b78…|Otti|Hammers|6`, `62f597ce…|Peter|Hammers|96`, `a7a0900f…|Sancho|Hammers|8`, `ea57cca8…|Seyi|Hammers|76`, `7da1267c…|Sky (ATk)|Hammers|17`, `f50e5eb2…|Spectrum|Hammers|10`, `1ee6d046…|Speedy|Hammers|11`, `6d0d67bc…|Stacey|Hammers|22`, `e65f3039…|Timi|Hammers|5`, `player-1767972271332…|Abdulazeez Jolaoye|Kings FC|20`, `player-1767972271817…|Ola-praise Abadoni|Kings FC|88`, `player-1767973516655…|Blacko|Pirates FC|60`, `busa-pirates-player-4|Courage Alegbe|Pirates FC|4`, `busa-pirates-player-2|Daniel Ezekwe|Pirates FC|2`, `busa-pirates-player-24|Khalid Adeboye|Pirates FC|24`, `player-1767971391197…|Malcom|Pirates FC|50`, `busa-pirates-player-19|Netochukwu Mba|Pirates FC|19`, `busa-pirates-player-1|Tomipe Oshi Bodu|Pirates FC|1`, `zqdgloSq…|CYRIL|Rim Reapers|12`, `zdkZd4Lg…|JOHN|Rim Reapers|50`, `4GSiChHs…|MARK|Rim Reapers|3`, `FYoN6GSL…|PAUL|Rim Reapers|14`, `X-nVJcXw…|ZAZA|Rim Reapers|6`, `0YixHHv4…|abdurrahman|Rim Reapers|0`, `oqoJV6Pj…|becky|Rim Reapers|24`, `nxs2DmVj…|damilare|Rim Reapers|9`, `F7DwPfnX…|dekunle|Rim Reapers|77`, `hPvgRXBO…|great|Rim Reapers|22`, `r-GRRz8I…|joseph|Rim Reapers|23`, `vr76h3RU…|leo|Rim Reapers|7`, `vLRWQkAE…|mazi|Rim Reapers|1`, `gSLGBDLi…|nathaniel|Rim Reapers|8`, `vb3dvALn…|AISHA|Siberia|12`, `1jjhvT4z…|BOBBY|Siberia|2`, `FAbUhBii…|BOSCO|Siberia|14`, `bdzYqbDO…|DC AIRWAY|Siberia|18`, `_CRC995n…|ERAH|Siberia|1`, `uPGu5PWO…|ERAH JR|Siberia|13`, `w7DvEoaa…|Flourish|Siberia|9`, `wt7u32zw…|JOSEPH|Siberia|11`, `ozsMYr5d…|Juba|Siberia|4`, `k-5lN92H…|LEO|Siberia|90`, `Honp_mvw…|Melody|Siberia|5`, `NssQR_4F…|RATHODE|Siberia|15`, `4hMYnlcN…|REHAN|Siberia|6`, `kREfbf7C…|RIRI|Siberia|8`, `047rkkX2…|SAMMY|Siberia|0`, `jBmn2ZFE…|STORMZY|Siberia|10`, `yQ91lM-e…|Uzomba|Siberia|7`, `zdc4c5li…|ALEX|Storm|11`, `3180cIoh…|CAMPBELL|Storm|9`, `l80urSGC…|CLEOPATRA|Storm|12`, `SVuGZdrB…|DANIEL|Storm|33`, `WkhHN7Bo…|DAVEREX|Storm|14`, `6A9ZehNP…|EMEKE|Storm|8`, `bKG4XfdR…|ERIN|Storm|6`, `uw_LfW0O…|FRED|Storm|4`, `uoQWh03x…|GBENGA|Storm|27`, `DRSlwyUm…|JABBAR|Storm|11`, `zzyrKo8t…|JORDAN|Storm|24`, `kEo85MZn…|Jaba|Storm|13`, `-zlcLnIu…|LUKE|Storm|21`, `j2GX36-c…|MOSES|Storm|15`, `4rm-fJoP…|OLA|Storm|5`, `ZS4ba_U1…|PLAYER17|Storm|17`, `d1mGQmmC…|DARA|TBK|24`, `-SESd9Ji…|FRANK|TBK|14`, `Up-j9fdP…|INI|TBK|25`, `p70CX0KJ…|IYANU|TBK|67`, `26chM5DL…|KOSI|TBK|3`, `dkwaBucS…|OSHAI|TBK|6`, `6Dy8Q0pK…|POSI|TBK|9`, `1E0VD5Lf…|RAYMOND|TBK|20`, `i7VBmo4R…|RICHARD|TBK|13`, `iyOhJ7CV…|RUTH|TBK|7`, `EIEBH4Uk…|SALIM|TBK|1`, `Ib-uvLcX…|Ade|Titans|5`, `mlalrGqB…|DMLA|Titans|20`, `JLEcwMtk…|Donald|Titans|9`, `tX0zxQTa…|Ebuka|Titans|30`, `56JdXXHr…|Fatiu|Titans|12`, `h6dKDAUb…|Great Man|Titans|22`, `YHiM_sg0…|Hines|Titans|2`, `rgq56UL8…|Koredolus|Titans|3`, `D7rYUyIh…|M.E.A.C|Titans|0`, `3T-XeXEc…|Miracle|Titans|23`, `pHkBCHcO…|agee14|Titans|14`, `38ka6Nb4…|DAVID|Vikings|1`, `PAzrC3xr…|ERIC|Vikings|9`, `0odlBakG…|HIBACHI|Vikings|11`, `17BKPHCh…|JEHU|Vikings|13`, `C4l2KYE9…|KAMKID|Vikings|10`, `TKIPfsct…|LIGHT|Vikings|74`, `ijguIz6o…|LUMI|Vikings|17`, `xMzOrL5R…|OJAY|Vikings|0`, `iqt9ZijA…|PLAYER14|Vikings|14`, `c8GH6YDC…|REX|Vikings|15`, `DWRrxdMr…|SARAH|Vikings|3`, `54ovWpku…|THOMAS|Vikings|44`, `HzIVk9iR…|WILTON|Vikings|16`, `LkeRna_s…|ZUBBY|Vikings|12`

- **No writes.** Next step: assign each player to the correct college team row via affiliation insert script (to be built next session).

---

## Session 23 — 2026-06-17

### dev/fix-joga-player2-college-affiliation.mjs
- **Purpose:** Correct wrong college affiliation for `busa-joga-player-2` — was pointing to CENVS (`U6R7aZSXNvA0iMsdVi3XV`), should be COLENG (`k6BgZFG_mtatQ11NZNQb9`)
- **Target:** STAGING (`brixsportsv2-staging`, `.env.local`)
- **Step 1 — DELETE:** Row `SQfFGTX8DX7o5KDVxTV7J` deleted. `rowsAffected: 1` ✓
- **Step 2 — INSERT:** New row `pta-mctee-coleng-1781690183` inserted. `rowsAffected: 1` ✓
- **Step 3 — VERIFY:** 2 rows confirmed for `busa-joga-player-2`:
  - `pta-mctee-coleng-1781690183` → COLENG, `affiliation_type: college`, `is_active: 1`, `position: CB` ✓
  - `rgUk1POhEFILphL00NGMh` → busa-joga, `affiliation_type: team`, `is_active: 1` ✓
- **Prod:** Not run yet — staging only.

---

### dev/fix-joga-player2-college-affiliation-prod.mjs
- **Purpose:** Correct wrong college affiliation for `busa-joga-player-2` on prod — was CENVS (`U6R7aZSXNvA0iMsdVi3XV`), corrected to COLENG (`k6BgZFG_mtatQ11NZNQb9`)
- **Target:** PROD (`libsql://brixsportv2-brixsports.aws-eu-west-1.turso.io`, `.env.production`)
- **Step 1 — DELETE:** 1 row removed (CENVS affiliation). `rowsAffected: 1` ✓
- **Step 2 — INSERT:** New row `pta-mctee-coleng-prod-1781690362` inserted → COLENG, `affiliation_type: college`, `is_active: 1`, `position: CB`. `rowsAffected: 1` ✓
- **Step 3 — VERIFY:** 2 rows confirmed — COLENG college affiliation + busa-joga team affiliation. Parity with staging ✓
- Script retained in dev/

---

### dev/fix-mcanthony-college-prod.mjs
- **Purpose:** Fix `players.college` for McAnthony Uzowuru (`busa-joga-player-2`) on prod — was `COLENVS`, corrected to `COLENG`
- **Target:** PROD (`libsql://brixsportv2-brixsports.aws-eu-west-1.turso.io`, `.env.production`)
- **Step 1 — Lookup:** `busa-joga-player-2` confirmed as McAnthony Uzowuru, `college: COLENVS` ✓
- **Step 2 — UPDATE:** `college = 'COLENG'`. `rowsAffected: 1` ✓
- **Step 3 — Verify:** `college: COLENG` confirmed ✓
- **Post-diagnostic:** Prod now at full parity with staging — 178 total, 110 NULL, COLENG 35, COLNAS 21, COLMANS 7, COLENVS 5, 0 mismatches ✓

---

### dev/backfill-college-affiliations-staging.mjs
- **Purpose:** Fix all 14 college affiliation mismatches on staging — 8 COLENG, 3 COLENVS, 1 COLMANS, 2 COLNAS players with `college` set but no matching affiliation row (or wrong row)
- **Target:** STAGING (`brixsportsv2-staging`, `.env.local`)
- **Pre-flight:** 14 mismatches confirmed — including Sukunmi SK with wrong COLENVS row (college=COLENG)
- **Step 1 — DELETE wrong rows:** 1 row deleted (Sukunmi SK's COLENVS affiliation). `rowsAffected: 1` ✓
- **Step 2 — INSERT missing:** COLENG: 8, COLENVS: 3, COLMANS: 1, COLNAS: 2 = 14 rows total ✓
- **Step 3 — VERIFY:** 81 players with college set, all ✓. Remaining mismatches: 0 ✓
- **Prod:** Not run yet — blocked on Richard setting college for 97 NULL players on staging first, then prod mirror

---

### dev/mirror-college-to-prod.mjs
- **Purpose:** Mirror staging college field updates to prod + fix all affiliation mismatches on prod
- **Target:** PROD (`libsql://brixsportv2-brixsports`, `.env.production`) — staging used as source of truth
- **Delta:** 14 players with college set on staging but NULL/wrong on prod — all updated ✓
- **Step 4 — UPDATE college fields:** 14 rows updated (13 NULL→set, 1 Sukunmi SK COLENVS→COLENG) ✓
- **Step 5 — DELETE wrong rows:** 1 deleted (Sukunmi SK's wrong COLENVS affiliation) ✓
- **Step 6 — INSERT missing:** COLENG×8, COLENVS×3, COLMANS×1, COLNAS×2 = 14 rows inserted ✓
- **Step 7 — VERIFY:** 81 players with college set, 0 missing affiliations, 0 remaining mismatches ✓
- **Prod now at full parity with staging** — 81 players across COLENG/COLENVS/COLMANS/COLNAS all ✓

---

## Session 27 — 2026-06-19

### College football team shortName update (CENG/CENVS/CMANS/CNAS → COLENG/COLENVS/COLMANS/COLNAS)

2026-06-19 | check-college-shortnames.mjs | STAGING | READ-ONLY | VERIFIED
- Confirmed 8 college teams: 4 football (CENG, CENVS, CMANS, CNAS) + 4 basketball (COLENG-B, COLENVS-B, COLMANS-B, COLNAS-B)

2026-06-19 | update-college-shortnames.mjs (football only) | STAGING | SUCCESS | VERIFIED
- Updated 4 football teams: CENG→COLENG, CENVS→COLENVS, CMANS→COLMANS, CNAS→COLNAS
- Basketball teams unchanged (COLENG-B etc. intentionally kept for sport disambiguation)
- Rows affected: 4/4 ✓

2026-06-19 | update-college-shortnames.mjs (football only) | PROD | SUCCESS | VERIFIED
- Same 4 football teams updated on prod
- Rows affected: 4/4 ✓
- Final state: staging and prod identical — football=COLENG/COLENVS/COLMANS/COLNAS, basketball=COLENG-B/COLENVS-B/COLMANS-B/COLNAS-B

---

## Outstanding / Pending Scripts

| Script (not yet run) | Purpose | Blocked by |
|----------------------|---------|------------|
| playerStats dedup audit | Investigate BUG-011 (718 goals anomaly) | Requires staging environment first (BACKLOG-005 Phase 1) |
| ~~backfill-college-affiliations-staging.mjs (prod run)~~ | Superseded by mirror-college-to-prod.mjs ✓ | DONE |
| mirror-college-to-prod.mjs (re-run after new profiles) | Mirror 20 new BUSALYMPICS profiles + their affiliations to prod | Run after staging verify ✓ |

_Note: PATCH MD3 scores and BUSALYMPICS standings recalculation were completed in Session 10 (see above). Table updated 2026-06-15._

---

### dev/copy-new-players-to-prod.mjs
- **Purpose:** Copy 30 new Bells players (10 already-profiled + 20 new BUSALYMPICS profiles) from staging to prod, including all affiliation rows
- **Target:** PROD (`libsql://brixsportv2-brixsports`, `.env.production`)
- **Players inserted:** 30 (COLENG×3, COLENVS×14, COLMANS×9, COLNAS×3)
- **Affiliation rows inserted:** 37 (college affiliations + BUSA team affiliations for Chris/Effiong/Enoch/Alex/Bruno/Smart/TOJU)
- **TOJU:** COLENVS college + Wolves FC team — both rows confirmed on prod ✓
- **Verify:** 30 players, 0 missing affiliations on prod ✓

---

### College affiliation backfill + new player profiles (staging + prod)

2026-06-17 | mirror-college-to-prod.mjs + copy-new-players-to-prod.mjs | STAGING + PROD | SUCCESS | VERIFIED

- Staging: 20 new player profiles created (11 COLENVS, 9 COLMANS), all with correct college affiliation rows
- TOJU: dual affiliation — COLENVS college + Wolves FC team
- 10 already-profiled players backfilled with missing affiliation rows
- Final state staging: 208 Bells students, 0 college affiliation mismatches
- Prod mirror: 30 players inserted, 37 affiliation rows inserted (college + BUSA team where applicable)
- Final state prod: 0 missing affiliations

---

### Basketball college affiliation cleanup (BUG-033 data fix)

2026-06-17 | audit-basketball-college-affiliations.mjs → cleanup-basketball-college-affiliations.mjs | STAGING | SUCCESS | VERIFIED

- Audit found 5 Basketball players wrongly affiliated to Football college teams (inserted by backfill-college-affiliations-staging.mjs which had no sport guard)
- Players removed: KAMKID (COLENG/Vikings), RICHARD (COLENG/TBK), ZUBBY (COLENG/Vikings), LIGHT (COLNAS/Vikings), OJAY (COLNAS/Vikings)
- Deleted 5 player_team_affiliations rows; verify query returned 0 remaining wrong affiliations
- These 5 players now have no college affiliation — will need re-linking once basketball college teams are created
- backfill-college-affiliations-staging.mjs updated with sport guard: excludes players whose primary team sport != Football
- PROD cleanup: 2026-06-17 | cleanup-basketball-college-affiliations-prod.mjs | PROD | SUCCESS | VERIFIED — same 5 rows deleted, verify query returned 0 rows

---

### Basketball college teams creation + player affiliation wiring

2026-06-17 | create-basketball-college-teams-staging.mjs → wire-basketball-college-affiliations.mjs | STAGING + PROD | SUCCESS | VERIFIED

- Created 4 basketball college teams on staging (coleng-basketball, colnas-basketball, colmans-basketball, colenvs-basketball)
- Prod: same 4 teams created via wire script (INSERT OR IGNORE)
- Wired 5 basketball players to correct college teams on both staging and prod:
  - KAMKID, RICHARD, ZUBBY → coleng-basketball (COLENG-B)
  - LIGHT, OJAY → colnas-basketball (COLNAS-B)
- Verify query returned 5 rows on both DBs, 0 mismatches
- BACKLOG-076 (blocked on team creation) now unblocked — teams exist, players wired

---

### Session 29 — 2026-06-24

#### Test match verification + cleanup

2026-06-24 | `dev/verify-bug-047-scores.mjs` | STAGING | SUCCESS | VERIFIED
- Queried match `LFkN14uB90brGn2E8sW1N` — `home_score=3`, `away_score=3`
- Event audit: 11 events, expected home=3 away=3. DB match confirmed.
- Both Own Goal events credited the opponent team (not `teamId` team). OG inversion logic confirmed correct.
- BUG-047 now legitimately RESOLVED with DB evidence.

2026-06-24 | `dev/check-test-match.mjs` | STAGING | SUCCESS | VERIFIED
- Match status: FINISHED. Score: 3-3.
- Dirty `football_player_stats` rows identified: Emmanuel Adeyanju (+1 goal, +1 assist), Benjamin Adenuga (+1 goal), Tisco Jr (no-op — no stat-writing events).
- Justin: no `football_player_stats` row — goal event did not write stats (no row to insert/update against).
- Own Goals, Penalties, Fouls: zero stat impact confirmed — `updatePlayerStats` switch has no case for these types.
- McAnthony Uzowuru and Ebube: no stat-writing events in test match. Pre-existing stat values unaffected.

2026-06-24 | `dev/cleanup-test-match.mjs --apply` | STAGING | SUCCESS | VERIFIED
- Decremented: Emmanuel Adeyanju goals 2→1, assists 1→0. Benjamin Adenuga goals 3→2 (assists no-op). Tisco Jr no-op.
- Justin skipped — no `football_player_stats` row existed.
- Match `LFkN14uB90brGn2E8sW1N` deleted. Cascade cleaned: `match_events` (11 rows), `match_logger_assignments`, `player_ratings`.
- Prod: NOT run — test match was staging only. Prod DB unaffected.

#### TD-010 schema migration — staging

2026-06-24 | `dev/run-td010-migration-staging.mjs` | STAGING (`brixsportsv2-staging`) | SUCCESS | VERIFIED
- SQL: `ALTER TABLE matches ADD COLUMN current_period TEXT DEFAULT 'NOT_STARTED'`
- `PRAGMA table_info(matches)` confirmed: `name=current_period, type=TEXT, default='NOT_STARTED'`
- 5 sample rows checked — all existing matches defaulted to `NOT_STARTED` as expected
- Prod: NOT yet run — pending staging verification of period survival on live match

#### TD-010 + football_player_stats — PROD migrations (Session 32b)

2026-06-25 | `dev/migrate-prod-td010.mjs --apply` | PROD (`brixsportv2-brixsports.aws-eu-west-1.turso.io`) | SUCCESS | VERIFIED
- SQL: `ALTER TABLE matches ADD COLUMN current_period TEXT DEFAULT 'NOT_STARTED'`
- `PRAGMA table_info(matches)` confirmed: `name=current_period, type=TEXT, dflt_value='NOT_STARTED'`
- 5 sample rows confirmed: all FINISHED matches defaulted to `NOT_STARTED` (correct — no live match active at migration time)
- Rows affected: all existing matches defaulted; additive column only, no data mutation

2026-06-25 | `dev/migrate-prod-football-stats.mjs --apply` | PROD (`brixsportv2-brixsports.aws-eu-west-1.turso.io`) | SUCCESS | VERIFIED
- SQL: `ALTER TABLE football_player_stats ADD COLUMN own_goals INTEGER DEFAULT 0`
- SQL: `ALTER TABLE football_player_stats ADD COLUMN penalties_scored INTEGER DEFAULT 0`
- Both columns confirmed present via `PRAGMA table_info(football_player_stats)` post-apply
- All existing rows defaulted to 0 (correct — additive only, no mutation)

2026-06-25 | `dev/query-omari-olapraise.mjs` | STAGING (read-only) | SUCCESS | VERIFIED
- Confirmed: Omari Dennis and Ola-praise Abadoni both have active `player_team_affiliations` row to `busa-kings`. Multi-affiliation with college teams also present. BUG-067 root cause trace.

2026-06-25 | `dev/query-sub-events.mjs` | STAGING (read-only) | SUCCESS | VERIFIED
- Confirmed: `related_player_id` populated on all 5 recent Substitution events. Not the failure point for BUG-067.

2026-06-25 | `dev/query-omari-record.mjs` | STAGING (read-only) | SUCCESS | VERIFIED
- Omari Dennis: `college=COLNAS, university=Bells, is_external=0`. Both affiliations active (Kings FC + COLNAS team). Clean record — not rejected by `isPlayerEligible`. BUG-067 root cause is picker pool logic, not eligibility data.

2026-06-25 | `dev/query-kings-lineup.mjs` | STAGING (read-only) | SUCCESS | VERIFIED
- Kings FC lineup confirmed: 11 starters (incl. player-1767972271817-0e46tfrjs), 10 substitutes (incl. player-1767972273154-jdc7gsxyp = Omari, busa-kings-player-17 = Ola-praise). Both incoming subs were in the lineup's `substitutes` list — not missing from data. Root cause confirmed as picker pool logic.

2026-06-29 | `dev/audit-jog-kings-s38.mjs` | STAGING (read-only) | SUCCESS | VERIFIED
- Match: EOWw93XEolhP83o1LOJGl (Joga-Bonito vs Kings FC, FINISHED, 1-0, 11 events)
- Script errored on missing `player_match_stats` / `match_lineups` tables (tables do not exist in schema — skipped)
- Stat entries found: 5 players (Justin Onyeka, Samuel Olapite, McAnthony Uzowuru, Japheth Oseiegbu, Michael Oguntola)
- Event count: 11 events to delete; 1 logger assignment to remove

2026-06-29 | `dev/cleanup-jog-kings-s38.mjs` | STAGING (write) | SUCCESS | VERIFIED
- Reverted stats for 5 players (goals, assists, fouls, saves, shotsOnTarget/Off zeroed)
- Deleted 11 match events for match EOWw93XEolhP83o1LOJGl
- Deleted logger assignment for the match
- Reset match status to PENDING, score 0-0, period NOT_STARTED

2026-06-29 | `dev/delete-match-s38.mjs` | STAGING (write) | SUCCESS | VERIFIED
- Deleted match row EOWw93XEolhP83o1LOJGl (events and logger assignment already cleared by cleanup script)
- DB clean — no orphan rows

2026-07-06 | `dev/query-colnas-colmas-baseline.mjs` | STAGING (read-only) | SUCCESS | VERIFIED
- Task 2 of backfill trace directive: baseline player rosters for COLNAS (24 players) and COLMAS/COLMANS (17 players) football teams via player_team_affiliations join
- Purpose: pre-check against BUSALYMPICS MD1 sheet (COLNAS vs COLMAS) before designing name-matching logic
- Cross-check vs 6 sample sheet names: JAPHETH, BRUNO, MARTINS matched jersey_name exactly. AMEROS vs DB 'Amros' and SHARFHI vs DB 'Sharfhii' are near-misses (transposition/typo) that exact match would NOT catch. TOMIPE matched only via `name` substring since jersey_name is NULL for that row.
- No writes executed.

2026-07-06 | `dev/check-players-schema.mjs` | STAGING (read-only) | SUCCESS | VERIFIED
- PRAGMA table_info(players) confirms `nicknames` column does NOT exist on live staging players table
- Contradicts BACKLOG.md claim that BACKLOG-037 Step 1 (nicknames column) is "complete on both staging and prod DBs" and src/db/schema.ts declaration of the column
- No writes executed. Migration not run this session — flagging drift only, decision on whether/when to migrate deferred to Richard.

2026-07-06 | `dev/backfill-match-players.mjs` | STAGING (read-only) | SUCCESS | VERIFIED
- Pilot run: 6 sample MD1 (COLNAS vs COLMAS) sheet names against live rosters
- Result: 4 exact matches (JAPHETH, BRUNO, TOMIPE, MARTINS), 2 fuzzy matches flagged for review (AMEROS->Amros dist1, SHARFHI->Sharfhii dist1), 0 stub-required
- Caught and fixed a false-positive bug during dogfooding: unguarded Levenshtein distance let short tokens (e.g. "Uno", 3 chars) fuzzy-match longer sheet names (e.g. "Bruno") purely via deletion, producing a spurious multi-candidate flag. Fixed with a length-gate (+/-1 char) before computing distance.
- No writes executed.

2026-07-06 | CORRECTION to prior entry | STAGING (read-only) | SUCCESS | VERIFIED
- Prior entry claiming `nicknames` drift (missing column) was wrong — I checked the `players` table, but `nicknames` is declared on `player_team_affiliations` (per src/db/schema.ts:95 and BACKLOG-041), not `players`. PRAGMA table_info(player_team_affiliations) confirms the column IS present on staging. No drift. BACKLOG-037 Step 1 claim stands correct.
- Practical implication for backfill matcher: nickname lookups must join through `player_team_affiliations.nicknames` (per-team-affiliation aliases), not a player-level field. `dev/backfill-match-players.mjs` will be updated to read nicknames from that join.

2026-07-06 | `dev/backfill-match-players.mjs` (updated) | STAGING (read-only) | SUCCESS | VERIFIED
- Wired nicknames lookup correctly via player_team_affiliations.nicknames join (correcting earlier drift misfire). Re-ran pilot — same 6/6 correct results, no regression.

2026-07-06 | `dev/parse-match-sheet.mjs` (new) | LOCAL FILE ONLY, no DB contact | SUCCESS | VERIFIED
- Built per directive from external planning chat. xlsx -> canonical JSON, no DB reads/writes in this stage.
- Ran against both real MD1 sheets: `MD1_Colnas_vs_mas .xlsx` (16 rows: 11 starters, 5 subs) and `MD1_Colmas_vs_nas .xlsx` (14 rows: 11 starters, 3 subs)
- Verified expected edge cases against real file content (not assumed): MAYOR/SAMMY (COLNAS) and ANIMASHAUN (COLMANS) captured as scorers; KANTE captured with noData:true; jersey #2 COLMANS row captured with unresolvedName:true
- Output: dev/parsed-sheets/md1-colnas-vs-colmas-COLNAS.json, dev/parsed-sheets/md1-colnas-vs-colmas-COLMANS.json

2026-07-06 | `dev/backfill-match-players.mjs` (rewired) | STAGING (read-only) | SUCCESS | VERIFIED
- Rewired to read parsed JSON files (CLI args) instead of hardcoded SHEET_ENTRIES; teamId now resolved live from teams.short_name (exact then substring fallback) instead of hardcoded IDs
- Caught and fixed two real bugs during this run: (1) teamSlug "COLMAS" did not match DB short_name "COLMANS" exactly — added substring fallback; (2) exact matches were being diluted into false "multiple candidates" flags by distance-2 fuzzy noise from unrelated players (SMART/OMARI both had this) — fixed by making a single exact match win outright regardless of weaker fuzzy noise, only flagging when 2+ matches exist within the SAME tier
- Full run: 30 rows (16 COLNAS + 14 COLMANS). Result: 15 LINK (exact), 3 LINK? (fuzzy review: AMEROS->Amros, SHARFHI->Sharfhii, ANIMASHAUN->Animashun), 11 CREATE STUB, 1 UNRESOLVED (jersey #2 COLMANS, no name on sheet), 0 false FLAGs remaining
- No writes executed anywhere in this pipeline.

2026-07-06 | `dev/backfill-run-sheet.mjs` (new wrapper) | STAGING (read-only), LOCAL FILE writes only | SUCCESS | VERIFIED
- One-command wrapper chaining parse-match-sheet.mjs (per team) + backfill-match-players.mjs into a single invocation, reducing per-match workflow from 3 manual commands to 1
- Verified identical output vs the manual 3-step run on MD1 COLNAS/COLMANS. Test artifact JSON files removed after verification.
- Going forward: node dev/backfill-run-sheet.mjs <matchLabel> <xlsx1> <slug1> <xlsx2> <slug2> is the standard per-match command for the remaining 32 sheets.

2026-07-06 | `dev/backfill-match-players.mjs` (platform-wide fallback + self-test added) | STAGING (read-only) | SUCCESS | VERIFIED
- Added platform-wide fallback: when team-scoped search finds zero candidates, search all players platform-wide before recommending CREATE STUB. Platform-wide hits are never auto-LINK even if exact — always flagged for human confirmation since it means the player isn't currently affiliated with this team.
- Found and fixed a real bug in this new code during the same run: platform roster query used LEFT JOIN player_team_affiliations, which duplicated any player with 2+ affiliations into "multiple candidates" false positives (Mayowa Agoyi, Israel Emmanuel, TOJU, Sukunmi SK all affected). Fixed by querying `players` alone for the platform-wide fallback (nicknames omitted from that path only — team-scoped path still has full nicknames support).
- Added --self-test mode: 10 known-correct fixtures (from real MD1 data) run against live COLNAS/COLMANS rosters, asserting expected tier+player id+candidate-count. All 10 pass. Regression guard against future edits to matching logic.
- Fixed an unrelated exit crash: process.exit() while libsql async handles were in flight threw a uv_handle assertion. Fixed with client.close() + process.exitCode instead of process.exit().
- Platform-wide fallback surfaced 5 real reclassifications that team-scoped-only matching had marked CREATE STUB: MAYOR (exact match to Mayowa Agoyi, busa-pirates), TOJU (exact match, already exists), ISREAL (fuzzy match to Israel Emmanuel), CHARLES (2 distinct existing profiles — genuinely ambiguous), IK (2 distinct existing profiles — genuinely ambiguous). None of these would have been caught by team-scoped search alone; all previously would have silently created duplicate stub players.
- No writes executed.

2026-07-06 | Manual photo cross-check | LOCAL FILES ONLY, no DB contact | FINDING | VERIFIED
- Viewed the two source photos (MD1Colnas-mans.jpg, MD1Colmans-nas.jpg) of the original paper log sheets, alongside the xlsx transcriptions.
- COLMANS photo: confirms jersey #2 row is genuinely blank (no name) on the ORIGINAL paper sheet too — not an xlsx transcription loss, not recoverable from the photo. Confirms "KANTE" row 5 has a jersey number (5) on the photo that was dropped in the xlsx (xlsx has null).
- COLNAS photo: reveals the xlsx dropped the entire NO. column (jersey numbers 1-16 are legible on the photo but transcribed as blank/null in the xlsx for every COLNAS row). Also: row 3's name is smudged/corrected on the paper — legible portion reads "OSE" followed by an obscured/overwritten section, NOT clearly "AMEROS" as the xlsx transcribed it. Real ambiguity, needs Richard's direct call — deferred to AskUserQuestion, not resolved.
- Implication: xlsx transcription for at least this match has known data loss (dropped NO. column entirely for one team) and at least one likely misread name. Worth spot-checking future sheets' xlsx against their source photos where both exist, not assuming the xlsx is a fully faithful transcription.

2026-07-06 | `dev/query-kings-roster-check.mjs` | STAGING (read-only) | SUCCESS | VERIFIED
- Checked busa-kings roster (21 players) directly for a player resembling "MAYOR" per Richard's correction that the platform-wide match (Mayowa Agoyi, busa-pirates) was wrong and the real MAYOR is a Kings player.
- No match found — MAYOR does not exist in the DB under Kings or any other team. Confirmed CREATE STUB is correct, not a link.
- TOJU also corrected by Richard: real player's identifier is "TJ", distinct from the existing platform "TOJU" profile the matcher found. CREATE STUB confirmed, not a link.
- Both cases: the platform-wide fallback correctly flagged these as "confirm before linking" rather than auto-linking — the human-review gate caught 2 wrong matches out of 4 platform-wide candidates this run. Validates the no-auto-link-on-platform-wide policy; no code change needed here, the safety mechanism worked as designed.

2026-07-06 | MD1 (COLNAS vs COLMANS) player matching — FULLY RESOLVED | STAGING (read-only so far) | SUCCESS | VERIFIED
All 30 rows now have a final human-confirmed disposition. Algorithmic note: MAYOR->Mayokun Mayokun (busa-kings, jersey_name "Mayokun") was missed by the matcher entirely because the length-gate (added to fix the Bruno/Uno false-positive) requires candidate/target length within +/-1 char; "Mayor"(5) vs "Mayokun"(7) differs by 2. This is a nickname-compression case, not a typo case (Levenshtein models typos, not shortened nicknames) - a real, accepted blind spot in the matcher, not something to chase by loosening the gate (would reopen the original false-positive bug). Human review is the correct backstop for this class of case, and it worked here.

FINAL MD1 DISPOSITION (30/30 resolved):
COLNAS: JAPHETH->LINK busa-joga-player-13 | BRUNO->LINK player-1781698762598-o88hdtv23 | AMEROS(OSE)->LINK busa-kings-player-25 | REWARD->LINK busa-kings-player-4 | TEMI->LINK busa-kings-player-21 | ROGERS->LINK busa-pirates-player-6 | MAYOR->LINK player-1767972273573-j43tp2rx3 (corrected, was misdiagnosed as stub) | JES->CREATE STUB | SAMMY->LINK busa-joga-player-45 | ALEX->LINK player-1781698817968-h5y5e0pdr | KEDEM->LINK busa-kings-player-10 | SMART->LINK player-1781698904643-n9xrxznce | CHARLES->LINK 19983528-d8e7-4235-b28c-87906dada6e1 (position CF matched) | AZEEZ->CREATE STUB | IK->CREATE STUB (both candidates rejected) | OMARI->LINK player-1767972273154-jdc7gsxyp
COLMANS: TOMIPE->LINK busa-pirates-player-1 | SHARFHI->LINK busa-joga-player-88 | MARTINS->LINK busa-kings-player-66 | AKANDE->CREATE STUB | ISREAL->LINK busa-pirates-player-17 | UCHE JR->LINK busa-joga-player-12 | PARKER->CREATE STUB | PEDRI->CREATE STUB | ANIMASHAUN->LINK player-1767972615670-yet6lrue1 | DAMI->LINK player-1781705623045-4l2nixjf7 | DOTMAN->LINK busa-pirates-player-8 | jersey#2(no name)->SKIP (unidentifiable, no synthetic player created, 1 interception stat point dropped) | TOJU->CREATE STUB (existing "TOJU" profile confirmed different person, real jersey name is "TJ") | KANTE->CREATE STUB (noData, no stats to attribute)
Still no writes executed anywhere. Next phase: build the apply/write script (create stubs + affiliations + insert match_events) — not started yet, needs its own review before running even against staging.

2026-07-06 | Decisions locked before write script | N/A (decision log) | N/A | N/A
- LINK write behavior CORRECTED: traced src/app/api/teams/[id]/route.ts:85-96, confirmed the public team-detail endpoint builds roster listings from player_team_affiliations (teamId + isActive=true). An affiliation row IS required for roster-page correctness, even though no FK forces it for events/stats. Write script must create/ensure a player_team_affiliations row for every LINK not already affiliated with COLNAS/COLMANS specifically.
- IK clarified: Richard explicitly chose "Neither / create new stub" — both platform candidates (Sukunmi SK, Ike) explicitly rejected, not a default.
- MD1 tally reconfirmed by direct recount: 8 CREATE STUB (JES, AZEEZ, IK, AKANDE, PARKER, PEDRI, TOJU, KANTE), 21 LINK, 1 SKIP = 30/30, matches 16+14 row count.
- COLNAS "missing jersey numbers" finding RETRACTED per Richard: the photo's sequential 1-16 in the NO. column was row index, not jersey numbers (unlike COLMANS's genuinely varied 01/88/66/47... numbers). No real data loss, no recovery needed. KANTE's #5 finding (COLMANS file) is unaffected and still stands.
- Mayokun nicknames ("Mayor" alias) write: DEFERRED, bundle into the write script rather than a standalone action now.
- Stats zero-and-recompute timing: DECIDED — one-time upfront, snapshot football_player_stats in full first, then zero event-derived fields globally, before MD1's events get written. Do this before any event insert, not per-match.
- All 6 items from this critique round now closed. Next: build the write script (snapshot+zero stats, create 8 stub players + affiliations for CREATE STUB rows, create affiliations for LINK rows not already on COLNAS/COLMANS, write "Mayor" nickname, insert MD1 match_events).

2026-07-06 | Read-only pass: jersey-number cross-check + squadPlayers trace | STAGING (read-only) | SUCCESS | VERIFIED

JERSEY NUMBER QUESTION — RESOLVED WITH REAL EVIDENCE (not assumption):
Viewed MD2/2-1_MD2_colnas-eng.jpg (COLNAS's own sheet for a second match, already available locally). Cross-referenced the 9 players appearing in both MD1 and MD2:
JAPHETH 1->1, TEMI 5->2, REWARD 4->3, SMART 12->4, ALEX 10->8, KEDEM 11->9, MAYOR 7->10, SAMMY 9->11, OMARI 16->13.
Only JAPHETH (GK, conventionally listed first) stayed put. Every other player's number changed between matches for the SAME person. Confirms these are row/listing-order indices tied to that day's starting XI + subs order, not fixed squad numbers. COLNAS jersey numbers correctly remain null; no data was lost, prior retraction stands with real verification behind it now (not just a plausible guess).
Bonus: "Ose" (short for Osemudiamen) appears again at row 5 on the MD2 sheet, independently reinforcing the MD1 row-3 identity resolution (Osemudiamen Amromawhe) via a second, unprompted data point.

SQUADPLAYERS TRACE — GAP CONFIRMED, MUST BE ADDRESSED IN WRITE SCRIPT:
- BUSALYMPICS (FOOTBALL) competition (9q8LMVqW8KAtF4BJBlyk_) has require_squad=0 (not enforced) but already has 77 squad_players rows total, including 16 for COLNAS and 14 for COLMANS.
- Cross-referenced our 21 resolved LINK player IDs against these existing squad_players rows. 17 already present. FOUR ARE MISSING: TOMIPE (busa-pirates-player-1), ISREAL (busa-pirates-player-17), UCHE JR (busa-joga-player-12), CHARLES (19983528-d8e7-4235-b28c-87906dada6e1). None of our 8 new CREATE STUB players are in squad_players either (expected, they don't exist yet).
- Mayokun Mayokun (MAYOR's real identity) is ALREADY in squad_players for COLNAS — independent, pre-existing confirmation of that resolution from whoever built this squad list originally, found by cross-reference rather than assumption.
- grep confirms squadPlayers/api/squads is consumed by exactly one frontend page: src/app/admin/teams/[id]/page.tsx (admin Squad Selector UI). Not read by any public-facing page. player_team_affiliations (via teams/[id]/route.ts) is the one driving public roster correctness.
- Verdict: squad_players insert is a should-have (keeps the existing admin Squad Selector list accurate/complete for BUSALYMPICS), not a must-have for public correctness. But since the table is already 90%+ populated for this exact competition/teams, the write script should top up the 4 missing existing-player entries + add all 8 new stub players to squad_players too, to avoid leaving the admin tool showing an incomplete squad after this backfill.

AFFILIATION UNIQUE CONSTRAINT — CONFIRMED SAFE:
player_team_affiliations has a unique index on (playerId, teamId) only, not on playerId alone (schema.ts:101-102, pta_player_team_unique). Multi-team affiliation for the same player (different teamId per row) is not blocked. Safe to insert a second active affiliation row for players already affiliated elsewhere (e.g. Omari Dennis: busa-kings + COLNAS simultaneously).

Still no writes executed anywhere. Write script scope now confirmed complete:
1. Snapshot + zero football_player_stats (one-time, upfront)
2. Create 8 stub players (JES, AZEEZ, IK, AKANDE, PARKER, PEDRI, TOJU, KANTE)
3. Create player_team_affiliations for all new stubs + the 4 missing existing-player links (TOMIPE, ISREAL, UCHE JR, CHARLES) to COLNAS/COLMANS
4. Create squad_players for the same set (8 stubs + 4 existing gaps) under BUSALYMPICS FOOTBALL competitionId
5. Add "Mayor" to Mayokun Mayokun's nicknames
6. Insert MD1 match_events with null minutes for all resolved players
Needs a --dry-run mode logging every intended write before any --apply, per standing rule.

2026-07-06 | `dev/test-snapshot-restore-mechanism.mjs` | STAGING (throwaway tables only) | SUCCESS | VERIFIED
- Tested the actual snapshot->mutate->restore mechanism end-to-end using two throwaway tables (zz_test_snapshot, zz_test_target), never touching the real football_player_stats table's data.
- Snapshot: CREATE TABLE AS SELECT * FROM football_player_stats (38 rows, matched original count exactly)
- Mutate: UPDATE test_target SET goals=0, assists=0 (simulated the zero step)
- Restore: DELETE FROM test_target; INSERT INTO test_target SELECT * FROM snapshot
- Verification: row count matched (38=38), 0 mismatches across goals/assists/yellow_cards/red_cards/tackles/interceptions comparing restored vs original snapshot
- PASS. Mechanism confirmed working on this exact Turso/LibSQL setup before being relied on for the real stats-zero step. Both test tables dropped after verification, real table untouched throughout.

2026-07-06 | squad_players per-team gap re-verification | STAGING (read-only) | SUCCESS | VERIFIED
- Re-ran the check explicitly per (team_id, player_id) pair rather than a flat existence check across the combined 30-row result, per critique's item F.
- Confirmed same 4 gaps hold under correct per-team scoping: CHARLES (COLNAS), TOMIPE (COLMANS), ISREAL (COLMANS), UCHE JR (COLMANS) are each missing from squad_players specifically under THEIR OWN resolved team_id, not a coincidental cross-team artifact.

2026-07-06 | Final decisions locked before write directive | N/A (decision log) | N/A | N/A
- squad_players: INSERT for the 4 gap players (CHARLES, TOMIPE, ISREAL, UCHE JR) + all 8 new stubs, under BUSALYMPICS FOOTBALL competitionId (9q8LMVqW8KAtF4BJBlyk_)
- Event scope: EVERYTHING the sheet captured — goals, assists, cards (+ match_events), substitutions (real minutes), clearances, interceptions, tackles, shots on/off, fouls, saves
- B/S column resolved: saves (GK rows only), dropped for outfield rows (no schema column for generic "blocks", would misrepresent an outfield player as having made goalkeeper saves)
- Eye Point / Rating: SKIPPED this session (no clean destination, deferred not lost)
- players.number for the 8 new stubs: LEFT UNSET, schema default 0 applies. No BUSA-club-number import attempted — confirmed platform-wide fallback already searched all teams and found nothing for any of these 8, so there is no existing number to import (that's precisely what distinguished them from MAYOR/TOJU, who did have existing profiles found elsewhere). Flagged as a known cosmetic gap (multiple "#0" players on same team roster if numbers ever get rendered) — not a data-integrity issue (no unique constraint on number), to be enriched later via admin same as other incomplete fields.
- Confirmed scope: write script creates full player profiles only for the 8 new stubs. The 4 gap LINK players (CHARLES, TOMIPE, ISREAL, UCHE JR) already have full existing profiles — they only get the missing player_team_affiliations + squad_players rows, no new player row. The other 17 LINK players need no player-table changes at all.
All decisions now locked (A through F, plus number field). Ready to draft the write directive.

2026-07-06 | Trace: event-vs-direct-write for clearances/tackles/interceptions/shots | READ-ONLY (code trace) | SUCCESS | VERIFIED
- Traced src/app/api/matches/[id]/events/route.ts updatePlayerStats (the REAL, live, production stat-update switch, post-BUG-083 normalization: .toUpperCase().replace(/\s+/g,'_')). It only handles: GOAL, ASSIST, OWN_GOAL, PENALTY, PENALTY_MISSED, PENALTY_SAVED, FOUL, YELLOW_CARD, RED_CARD, SAVE.
- NO case exists for TACKLE, INTERCEPTION, CLEARANCE, or generic (non-goal/penalty) SHOT tracking anywhere in the live pipeline. These stats have never been event-derived in production.
- Found a SEPARATE consumer that DOES reference these types: src/app/api/matches/[id]/ratings/route.ts (auto rating calculator) counts match_events by type == 'Goal', 'Tackle', 'Interception', 'Clearance', 'Save', 'Block', 'Shot' (Title Case, exact string match, NOT normalized).
- REAL BUG DISCOVERED (unrelated to backfill, pre-existing): the ratings route's exact-match comparison against Title-Case type strings will never match the live pipeline's post-BUG-083 UPPER_SNAKE_CASE storage ('GOAL' != 'Goal', 'SAVE' != 'Save', etc). Any match finished after the BUG-083 fix landed would have its auto-calculated ratings silently return ~0 for every event-derived category. Not fixed here (out of scope for backfill) - recommend filing as a new BACKLOG/BUG entry.
- RESOLUTION for backfill event scope: create match_events ONLY for types with real live-pipeline precedent (GOAL, ASSIST, FOUL, YELLOW_CARD, RED_CARD, SAVE, SUBSTITUTION) using the EXACT SAME type strings the live pipeline emits - this is genuinely restoring consistency, not inventing new pipeline behavior. Clearances/Interceptions/Tackles/shotsOnTarget/shotsOffTarget get written DIRECTLY to footballPlayerStats as aggregate counts with NO corresponding match_events - there is no existing event-type precedent for these to reuse, and inventing new ones for a one-time historical backfill would be overengineering.
- Double-count avoidance: since the backfill write script is separate from the live POST /events route (not calling it), the sheet's raw "on"/"off" shot columns get written directly as the complete value for shotsOnTarget/shotsOffTarget - no additional synthetic +1 gets layered on top when a GOAL event is also created for the same player, avoiding an ambiguous double-count risk (unclear whether the sheet's own on/off tally already includes the scoring shot).
- This resolves the "display-strategy blocks proceeding" concern raised in the planning-chat text: since no event types are being invented that don't already exist in the live product, there's no synthetic-event-clutter risk for any future timeline UI regardless of which display strategy gets chosen later.

2026-07-06 | Empirical check: actual stored event type casing + minute NOT NULL + sentinel precedent | STAGING (read-only) | SUCCESS | VERIFIED
- CORRECTION (major): queried real stored match_events.type values directly. ALL 17 distinct types in live data are Title-Case-with-spaces: Goal, Save, Foul, Substitution, Clearance, Interception, Tackle, Block, Shot on Target, Shot off Target, Shot, Corner, Offside, Throw In, Free Kick, Goal Kick, Catch. ZERO are UPPER_SNAKE_CASE.
- This DISPROVES my own prior-turn claim (that live storage uses UPPER_SNAKE_CASE post-BUG-083, and that the ratings route's Title-Case exact-match was a mismatch bug). I had conflated the internal .toUpperCase().replace(/\s+/g,'_') normalization used ONLY inside updatePlayerStats's switch-statement comparison logic with the actual persisted `type` column value - the switch normalizes for reliable comparison, it does not rewrite what gets stored. The ratings route's Title-Case exact-match is CORRECT, not broken. NOT FILING the bug I proposed last turn - it was wrong. No BACKLOG entry added.
- SECOND CORRECTION: Clearance (20 real rows), Interception (36), Tackle (1), Shot on Target (4), Shot off Target (10), Block (5) are ALL real, already-used, empirically-confirmed live event types with real historical volume - contrary to my prior claim that these "have no live pipeline precedent." I had only checked the narrow updatePlayerStats switch (which handles footballPlayerStats side-effects for a subset of types) and wrongly concluded that meant these types are never logged as real events at all. They are - just not aggregated into footballPlayerStats via that specific switch. Reverses the G recommendation toward Option 1 (create real match_events using these exact type strings), not Option 2 (direct-write only).
- No 'Assist' type exists anywhere in live data - confirms assists are represented via a related_player_id field on the Goal event, never as a standalone event type, consistent with the planning-chat's suggestion.
- H CONFIRMED as a real blocker: PRAGMA table_info(match_events) confirms minute is INTEGER NOT NULL, dflt_value=null. Checked for existing sentinel precedent: only 4 rows exist with minute=0, ALL clustered in a single unrelated match (8Mek2CA7KPlnk1EQ647jx: Catch, Goal, 2x Substitution) - looks like genuine kickoff-moment events in that specific match, not an established "unknown minute" convention. minute=0 should NOT be silently reused for backfilled null-minute events without an explicit decision, since any consumer treating minute=0 as "kickoff" would misread every backfilled event as literally happening in minute zero.

2026-07-06 | FINAL decision: minute sentinel | N/A (decision log) | N/A | N/A
- match_events.minute sentinel for backfilled events with no real minute data: -1 (out-of-range, unambiguous, filterable). period left null for these rows.
- Assist pairing resolved: write assist count directly to footballPlayerStats.assists for JES and ALEX (real sheet data), relatedPlayerId left null on both Goal events (MAYOR, SAMMY) since pairing cannot be determined from the sheet.
- ALL decisions now locked for MD1 write script: A (squad_players insert yes), B (6 steps incl. squad_players), C (everything the sheet captured), D (Eye Point skipped), E (snapshot-restore proven working), F (squadPlayers gaps verified per-team), number field (default 0, no import), G (real match_events for Clearance/Interception/Tackle/Shot using exact live-precedented Title-Case type strings, footballPlayerStats derived from these events via recompute), H (minute=-1 sentinel), I (event type casing = Title-Case-with-space, matches empirically confirmed live convention), assist pairing (direct count, no relatedPlayerId).
- Ready to draft the write directive with --dry-run mode required before --apply, per standing rule.

2026-07-06 | MD1 substitution pairings — FULLY RESOLVED via Richard's domain knowledge | N/A (decision log) | N/A | N/A
- SAMMY out for CHARLES @65 (confirms the "orphaned" CHARLES-in with no matching out-partner from the sheet's minute data alone - SAMMY's real out-minute wasn't captured on the sheet, this was known information not derivable from the parsed data)
- OMARI in for MAYOR @89 (resolves one of the two ambiguous same-minute pairs)
- ROGERS out for IK @89 (resolved by elimination, the only remaining pair once OMARI-MAYOR was confirmed)
- Final COLNAS substitution set (all 5, all with confirmed related_player_id): SMART in for BRUNO @45, CHARLES in for SAMMY @65, AZEEZ in for ALEX @75, OMARI in for MAYOR @89, IK in for ROGERS @89
- COLMANS: zero minute in/out data recorded - no Substitution events for COLMANS this match

2026-07-06 | dev/parse-match-sheet.mjs + dev/backfill-run-sheet.mjs updated for consolidated workbook format | LOCAL FILE ONLY, STAGING (read-only for matcher) | SUCCESS | VERIFIED
- Richard provided a new consolidated format: one xlsx workbook with one tab per team (tab name = team slug), replacing the two-separate-files format used for MD1 originally. Expected to be the standard format for remaining 33 matches.
- Updated parse-match-sheet.mjs: when called without an explicit teamSlug arg, loops over every sheet in the workbook and parses each one using its own sheet/tab name as the teamSlug. Legacy single-team-file mode (explicit teamSlug arg) still supported unchanged for backward compatibility.
- Updated backfill-run-sheet.mjs: now accepts either a single consolidated xlsx path (auto-discovers per-team parsed output via directory listing) or the legacy (xlsx, slug) pairs syntax.
- Verified: parsed the actual MD1_COLNAS_vs_COLMANS.xlsx consolidated file, confirmed output is byte-for-byte identical (JSON.stringify equality check) to the original two-separate-file parse for both teams' player arrays.
- Verified full one-command pipeline (dev/backfill-run-sheet.mjs <label> <consolidated.xlsx>) runs end-to-end against the new format with no errors.
- Going forward, standard command for a consolidated-format match sheet: node dev/backfill-run-sheet.mjs <matchLabel> <consolidatedXlsxPath>

2026-07-06 | dev/update-college-team-logos.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
- Updated teams.logo for COLNAS, COLENG, COLMANS, COLENVS from broken placeholder path (/assets/Logos/placeholder.png - typo mismatch, folder doesn't exist) to real logo files copied into public/assests/Logos/college/{colnas,coleng,colmans,colenvs}.png
- Source files: C:\Users\Wise\Downloads\BRIXSPORT\Intercollege\Logos\{COLCOMP,COLENG,COLMANS,COLENVS}.png (COLCOMP.png confirmed by Richard to be COLNAS's logo, filename mismatch only)
- Verified via SELECT: all 4 rows now show correct new paths
- BUG-096 filed separately: 6 code files reference /assets/Logos/BRIX-SPORT-LOGO.png (correct spelling) which doesn't exist - real folder is /assests/Logos/ (typo). Site-wide SEO/OG image bug, found incidentally, not fixed (deferred per Richard - filed, not fixed this session)
- Prod NOT updated yet - staging only per migration convention, prod update pending

2026-07-06 | dev/update-college-team-logos.mjs --prod --apply | PROD (brixsportv2-brixsports.aws-eu-west-1.turso.io) | SUCCESS | VERIFIED
- Code: hotfix/college-team-logos branch (cherry-pick of 088cc4a from dev), PR #10, merged to main (23421e6). Confirmed via git log origin/main before proceeding.
- DB: same script reused with new --prod flag (loads .env.production instead of .env.local) rather than writing a separate prod script - reduces drift risk between staging/prod logic. Dry-run confirmed prod had the same broken placeholder state as staging did, before applying.
- Updated teams.logo for COLNAS, COLENG, COLMANS, COLENVS on PROD to /assests/Logos/college/{slug}.png. Verified via SELECT post-write - all 4 rows correct.
- Both branches (fix/college-team-logos on dev, hotfix/college-team-logos on main) cleaned up - deleted locally and on origin after confirming merge via git log/branch --merged, not assumed.
- Recoverable mid-task error: accidentally attempted to pop an unrelated pre-existing stash (stash@{1}, "On main: Audit-001 api/event auth", not mine) instead of the intended one (stash@{0}, session 40 doc updates), causing a merge conflict in src/app/api/events/route.ts. Caught immediately, restored the file to clean HEAD state via `git checkout HEAD -- <file>`, confirmed both stashes remained intact and untouched, then correctly popped stash@{0} by explicit index. No data lost, unrelated stash left exactly as found.
- College team logos now live and correct on both staging and prod.

2026-07-06 | Corrections before write script, caught by Richard | N/A (decision log) | N/A | N/A
- JES reclassified: NOT a stub. Matches existing player "Jesse Uno" (busa-joga-player-30, jersey_name "Zico", position CAM) - missed by the matcher for the same reason MAYOR/Mayokun was (length-gated fuzzy: "jes"(3) vs "jesse"(5) exceeds the +/-1 char gate, a nickname-truncation case not a typo case). Confirmed already fully affiliated to COLNAS (player_team_affiliations AND squad_players both present) - zero new writes needed, treat as plain LINK exact.
- Revised CREATE STUB list: 7, not 8 (removed JES). Final: AZEEZ, IK, AKANDE, PARKER, PEDRI, TOJU, KANTE.
- Revised gap-LINK affiliation list: unchanged at 4 (CHARLES->COLNAS, TOMIPE/ISREAL/UCHE JR->COLMANS). JES was never part of this list once confirmed already affiliated.
- Position inheritance for stubs with no recorded position: AZEEZ inherits 'AM' from ALEX (whom he substituted for @75), IK inherits 'DM' from ROGERS (whom he substituted for @89). TOJU and KANTE have no substitution pairing available (COLMANS recorded zero minute data) - fall back to '' per the confirmed NOT NULL/no-default constraint on players.position, matching 20 existing real players using this same empty-string convention.
- players.position confirmed NOT NULL, no default (PRAGMA table_info) - directive's original "position: null" spec for 4 stub players would have failed on insert. Fixed to '' (2 inherited, 2 fallback) before any write executes.

2026-07-06 | Correction: shotsOnTarget must include goal-implied shots | N/A (decision log) | N/A | N/A
- Richard caught: a GOAL is definitionally a shot on target, matching the live pipeline's own confirmed convention (events/route.ts case 'GOAL': also increments shotsOnTarget). My earlier plan (write raw sheet "on" value directly, no goal side-effect) would have left MAYOR/SAMMY/ANIMASHAUN at shotsOnTarget=0 despite each scoring, since none of the 3 scorers have any raw "on" value recorded on the sheet (checked - no overlap risk, sheet's on/off columns track non-scoring attempts only for these 3).
- Fix for Step 7 recompute: shotsOnTarget = count('Shot on Target' events) + count('Goal' events) for that player, matching the live system's exact side-effect logic. No new event type needed - Goal events already exist, this is purely a recompute-logic correction. Affects MAYOR (0->1), SAMMY (0->1), ANIMASHAUN (0->1).

2026-07-09 | dev/backfill-write-md1.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
MD1 (COLNAS 2-1 COLMANS, matchId OPoEtVGUNWKcRSDe4QdSr) FULLY BACKFILLED.

First --apply attempt FAILED and rolled back cleanly (SQLITE_CONSTRAINT: UNIQUE player_team_affiliations.player_id/team_id). Root cause: conflated the earlier squad_players gap-check (correctly found CHARLES/TOMIPE/ISREAL/UCHE JR all missing from squad_players) with player_team_affiliations existence, which was never separately re-verified for TOMIPE/UCHE JR. Re-verified both tables independently per candidate:
  CHARLES: affiliation MISSING, squad MISSING
  TOMIPE: affiliation EXISTS, squad MISSING
  ISREAL: affiliation MISSING, squad MISSING
  UCHE JR: affiliation EXISTS, squad MISSING
Fixed script to generate two independent insert lists (needsAffiliation vs needsSquad flags) instead of one combined list. Confirmed batch is atomic (client.batch(..., 'write')) - first failed attempt left zero trace (no snapshot table, 0 events, stats untouched) before the fix was applied and re-run succeeded.

FINAL APPLIED STATE (209 statements, single atomic batch, committed successfully):
- Snapshot: football_player_stats_snapshot_pre_md1_20260709, 38 rows (matches pre-zero count exactly)
- New players: 7 (Azeez/AM, Ik/DM - both position-inherited from the starter they substituted for; Akande/CB, Parker/DM, Pedri/CM - from sheet; Toju/'', Kante/'' - no pairing data, empty string per NOT NULL constraint)
- player_team_affiliations: 9 (7 stubs + CHARLES + ISREAL - corrected from originally-planned 11)
- squad_players: 11 (7 stubs + CHARLES + TOMIPE + ISREAL + UCHE JR)
- Mayokun nicknames: [] -> ["Mayor"], verified post-write
- match_events: 151 total (Clearance 59, Interception 44, Shot off Target 11, Tackle 9, Foul 8, Substitution 5, Shot on Target 5, Save 4, Goal 3, Assist 2, Yellow Card 1)
- football_player_stats recomputed for 28 players who appear in any MD1 event, uniformly from events (no special cases, including Assist)
- Sanity check passed: MAYOR (Mayokun) = goals=1, fouls_committed=1, shots_on_target=1 (0 raw + 1 goal-implied, per the goal-always-implies-shot-on-target fix)
- KANTE: player row created, 0 events (noData preserved correctly)
- Jersey #2 (COLMANS, unresolved name): confirmed absent everywhere - no player, no event, no stat. 1 clearance data point from the sheet permanently not captured, by design.
- Platform-wide: 29 other players now show zero event-derived stats as the expected, intentional consequence of Step 1's global zero - will recompute correctly as their own matches get backfilled in later sessions.

This closes MD1 end to end: player resolution -> xlsx parsing -> matching -> human sign-off on every ambiguous case -> write. First of 34 matches. Pipeline (parser, matcher, self-test, write script pattern) is now reusable for MD2 onward.

2026-07-09 | MD1 Game 2 (COLENG 2-3 COLENVS, tyYRU5nlOrqnEXEpvIEC6) — player matching started | STAGING (read-only) | IN PROGRESS
- Fixed a real bug in dev/parse-match-sheet.mjs: consolidated workbook mode used raw sheet/tab names as teamSlug without trimming. This workbook's COLENG tab is literally named "COLENG " (trailing space), which failed team resolution entirely and even leaked into the output filename. Fixed: teamSlug = sheetName.trim() in consolidated mode. Re-ran cleanly after the fix.
- Real catch, not a duplicate: sheet has TWO "Enoch" entries in one match - row 0 (starter, GK, yellow card) and row 13 "ENOCH (SAKA)" (sub, LW, on at 69'). These are different roster slots, not the same person twice. Checked the DB's existing "Enoch" (jersey_name "Saka") position: RW - matches the wide-attacker sub (row 13, LW) far better than the starting GK (row 0). Matcher had auto-assigned the exact name match to row 0 (first-encountered), which the position evidence contradicts. Richard confirmed: row 13 (sub, LW) = Saka (LINK), row 0 (starter GK) = a different, new player (CREATE STUB).
- DANIEL (COLENG) flagged as 2 exact candidates (Daniel Tiamiyu, Daniel Ezekwe). Row "EZEKWE" already independently exact-matched Daniel Ezekwe - confirmed by Richard as the Pirates player, correct. By elimination, DANIEL = Daniel Tiamiyu (busa-kings-player-77).
- Still open: EMEKA (fuzzy dist=2 to Victor Ememe, who is ALSO already exactly claimed by row "EMEME" - same elimination-logic red flag as Daniel/Ezekwe, needs the same scrutiny), MICHEAL (fuzzy dist=2, Michael Oguntola), ISREAL/COLENG (fuzzy dist=2, Israel Emmanuel - note this is COLENG not COLMANS, a different context from MD1's ISREAL), SHAPAN (fuzzy dist=1, low-risk typo), POSI (platform-wide exact, not on this team, needs confirm), CEPHAS + FORTUNE (COLENVS, CREATE STUB, no candidate found at all).

2026-07-09 | MD1 Game 2 — remaining ambiguous rows resolved | N/A (decision log) | N/A | N/A
- EMEKA: confirmed different person (elimination logic held - Ememe already claimed by row EMEME) -> CREATE STUB
- MICHEAL: confirmed -> LINK to Michael Oguntola (player-1767972272690-bjbpqarn5)
- ISREAL (COLENG): confirmed different person, different team context (not the same Israel as MD1's COLMANS match) -> CREATE STUB
- POSI (COLENVS): confirmed different person - the platform-wide candidate found is a Kings/Joga player, not this COLENVS one -> CREATE STUB
- Notable session pattern: this match surfaced 2 real "matcher grabbed the wrong/already-claimed identity" cases (ENOCH row-swap, EMEKA vs already-claimed EMEME) that the elimination-logic discipline caught before either could have created a wrong link or a missed split. Still open: SHAPAN (dist=1, low-risk, pending simple accept), CEPHAS + FORTUNE (COLENVS, CREATE STUB, no candidate found, no ambiguity).

2026-07-09 | MD1 Game 2 — two stub reclassifications, both verified before accepting | N/A (decision log) | N/A | N/A
- EMEKA reclassified: NOT a stub. Matches Chukwuemeka Uduchukwu (busa-kings-player-5, jersey_name "Chukwuemeka", CB) - same nickname-truncation blind spot as MAYOR/Mayokun and JES/Jesse Uno (fuzzy length-gate excludes "Emeka"(5) vs "Chukwuemeka"(11), diff of 6, far beyond +/-1). CONFIRMED not just by name: he is already affiliated with COLENG specifically - exactly this match's team. Zero new affiliation/squad_players writes needed, same shape as Jesse Uno.
- POSI reclassified: NOT the platform-wide candidate the matcher found (which turned out to be a BASKETBALL player, position "Guard", only affiliated with TBK - a pure name coincidence across sports, correctly rejected). The REAL match is "Ayomiposi Alabi" (busa-joga-player-24, jersey_name "Puyoo"), found via direct roster search on Joga-Bonito per Richard's identification ("the joga ayomiposi", distinct from "Ayomiposi Peters" at Kings, MD1's MARTINS). This player is NOT currently affiliated with COLENVS - genuine gap-LINK, needs new affiliation + squad_players, same treatment as CHARLES/ISREAL in MD1.
- Updated MD1 Game 2 tally: 26 LINK (was 24), 4 CREATE STUB (was 6: removed EMEKA, POSI - remaining stubs are ENOCH/GK-starter, ISREAL/COLENG, CEPHAS, FORTUNE), 0 SKIP.
- Gap-LINK (needs new affiliation): POSI only. EMEKA needs no new writes (already on COLENG).

2026-07-09 | dev/recompute-pirates-hammers.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
Real, live data integrity fix — NOT part of the college backfill. MD1 g1's global one-time zero (2026-07-09) had wiped football_player_stats for every player platform-wide, including the 28 real players in the one live-logged match already in the DB (Pirates vs Hammers, 8Mek2CA7KPlnk1EQ647jx, 154 events, Pirates 5-0). The zero only touched the stats cache, never the underlying match_events, so this was a correctness bug on real public data, not a backfill artifact — discovered when MD1 g2's cumulative recompute correctly restored 4 of these 28 players (Jerry, Blacko, Ezekwe, Eniola) simply by them appearing in both matches. Ran the same cumulative recompute logic against all 28 distinct players in the Pirates/Hammers match directly, not waiting for further coincidental overlap.
- 28 players recomputed: 9 had an existing (zeroed) football_player_stats row -> UPDATE; 19 had NO row at all (never seeded) -> INSERT, first stats they've ever had.
- Sanity check: sum of goals across all 28 = 5, matches Pirates 5-0 Hammers exactly (Francis Abbey, Abdul-jabbaar Bello, Taiwo Olaofeoguntunde, Daniel Ezekwe, Mayowa Agoyi - 1 each).
- Post-apply SELECT confirms all 28 rows present with correct values.
- This closes a live, public-facing data bug, independent of the college backfill's own correctness.

2026-07-09 | dev/backfill-write-md1g2.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
MD1 Game 2 (COLENG 2-3 COLENVS, matchId tyYRU5nlOrqnEXEpvIEC6) FULLY BACKFILLED. Second of 34 matches.

Preceded by dev/recompute-pirates-hammers.mjs --apply (see entry above) to fix the live-match stats bug before this match's cumulative recompute could touch any overlapping players.

FINAL APPLIED STATE (151 statements, single atomic batch, committed successfully):
- Snapshot/zero: correctly SKIPPED (one-time only, already done before MD1 g1 - re-running would have wiped g1's stats)
- New players: 4 (Enoch/GK - different person from Enoch(SAKA); Isreal/LW - different person from MD1 g1's ISREAL; Cephas/CB; Fortune/'')
- player_team_affiliations: 4 (all new stubs, zero gap-LINKs this match - all 26 LINK players pre-flight-verified already affiliated)
- squad_players: 4
- match_events: 109 (Interception 34, Clearance 30, Shot off Target 10, Substitution 8, Yellow Card 5, Tackle 5, Shot on Target 4, Foul 4, Goal 3, Save 2, Penalty 2, Assist 2)
- Penalty type introduced for the first time (MICHEAL, EFFIONG) - separate from Goal, increments penaltiesScored not goals, matching the live schema's own PENALTY case exactly
- football_player_stats recomputed CUMULATIVELY (fixed this session - queries each player's full event history across ALL matches, not scoped to just this one, before writing). 4 players' cumulative totals verified by hand against prior + this-match contributions: Jerry (goals 0+1=1), Blacko (clearances 0+2=2, interceptions 2+4=6), Ezekwe (clearances 8+4=12), Eniola (clearances 2+1=3) - all exact matches.
- Sanity check: this match's own Goal+Penalty event count = 5, matches 2-3 final score exactly.
- Real matcher-catch corrections this match: ENOCH split into two different people (GK starter vs LW sub "Saka", position evidence contradicted the matcher's first-pick), EMEKA/EMEKA-elimination-logic reclassified from CREATE STUB to LINK (Chukwuemeka Uduchukwu, already on COLENG), POSI reclassified from CREATE STUB to LINK (Ayomiposi Alabi on Joga, not the basketball-playing platform-wide match or Ayomiposi Peters), ISREAL correctly kept as CREATE STUB (different person, different team context from MD1 g1's ISREAL), DANIEL resolved by elimination (Ezekwe already claimed separately).
- Real bug fixed mid-build: consolidated workbook tab name "COLENG " had a trailing space, breaking team resolution and leaking into output filenames. Fixed at the parser level (trim sheet-derived teamSlug).

This is the second match closed end to end with the full pipeline, and the first to prove the cumulative recompute fix matters in practice (not hypothetical) - it both protected this match's correctness AND surfaced+fixed a live data integrity bug on the one real match in the DB.

---

## Session 40C — 2026-07-09

2026-07-09 | dev/fix-israel-emmanuel-swap.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
Israel Emmanuel / COLMANS "ISREAL" dual-college-affiliation collision (surfaced end of Session 40B) - fully resolved. Dry-run reviewed first, matched the confirmed trace exactly (5 g1 events, 1 g2 event, 1 substitution reference), then applied as a single atomic batch (14 statements).

- New real player created for the actual COLMANS "Isreal" (id `cuLj5e05N6IXn-qR7sY_g`, jersey 34, CB, College of Management Sciences).
- MD1 g1's 5 events (4 Clearance, 1 Interception) re-pointed from Israel Emmanuel (`busa-pirates-player-17`) to the new stub.
- Israel's wrong COLMANS affiliation + squad_players row deleted; new stub given its own COLMANS affiliation + squad_players (BUSALYMPICS). Israel's COLENG and Pirates FC affiliations confirmed untouched throughout.
- MD1 g2's 1 event (Foul) + the substitution row's `related_player_id`/`detail` ("Enoch IN for Isreal" -> "Enoch IN for Israel Emmanuel") re-pointed from the redundant g2 stub (`ClqNXQiORuTQE54v5gqKU`) to Israel Emmanuel.
- Redundant g2 stub fully deleted: players, affiliation, squad_players, football_player_stats - all 4 rows removed and confirmed 0/0/0/0/0 (including event_refs) post-apply.
- Cumulative recompute run for both final IDs.

**Post-apply verification (DB query results, not UI/HTTP):**
- New stub: 1 affiliation (COLMANS only) confirmed via SELECT. Stats: clearances=4, interceptions=1, everything else 0 - matches g1's contribution exactly.
- Israel Emmanuel: 2 affiliations confirmed (PIR/team, COLENG/college) - no COLMANS row. match_events: 1 row (Foul, g2 match) - zero g1 events remain. football_player_stats: fouls_committed=1, everything else 0.
- g2 stub: player_rows=0, affil_rows=0, squad_rows=0, stats_rows=0, event_refs=0 - fully gone, no dangling references anywhere.

Closes the last open item from Session 40B. No other player touched.

---

2026-07-09 | dev/lib/college-guard.mjs (new) + dev/backfill-match-players.mjs (wired) | STAGING (read-only) | SUCCESS | VERIFIED
Built the college-affiliation exclusivity guard Richard asked for after the Israel Emmanuel fix - matcher now hard-flags any LINK recommendation that would give a player a second simultaneous active `affiliation_type='college'` row, instead of relying solely on human review to catch it.

- New shared module `dev/lib/college-guard.mjs`: `checkCollegeExclusivity(client, playerId, targetTeamId)` (query-only, returns conflict descriptor or null) and `assertNoCollegeConflict(...)` (hard-abort variant, for future per-match write scripts' pre-flight step - not yet wired into any write script since no new match write script has been created this session).
- `backfill-match-players.mjs`: any recommendation starting with `LINK`/`LINK?` targeting one of the 4 college teams now runs the guard against the top candidate before the report is printed. On conflict, recommendation is overridden to `FLAG - DUAL-COLLEGE CONFLICT (do not LINK without manual review)` with the existing/target college named explicitly.
- Self-test extended: added an 11th regression case using Israel Emmanuel's real post-fix state (active COLENG, no COLMANS) - simulates a LINK to COLMANS and asserts the guard flags it. Full self-test run: 11/11 passed.
- Smoke-tested against the real MD1 g1 parsed sheet (already-applied match, re-run for verification only, no re-apply): guard immediately surfaced a live, real, previously-undetected issue - see below.

**Real finding, not hypothetical:** re-running the matcher against MD1 g1's COLNAS sheet, row "MAYOR" was flagged as a dual-college conflict against Mayowa Agoyi (`busa-pirates-player-11`, real active COLENG affiliation, unrelated Pirates FC player). Investigated: the actual MD1 g1 write correctly used the real Mayokun (`player-1767972273573-j43tp2rx3`, hardcoded in `RESOLUTIONS`, unaffected) - so MD1 g1's applied data is NOT wrong. Root cause of the flag: Mayokun's "Mayor" nickname (added in the MD1 g1 write script's Step 5) was written to his `busa-kings` (Kings FC) affiliation row, not his COLNAS college affiliation row. `getRoster()` reads `nicknames` scoped to the team being searched, so a COLNAS-scoped search for "MAYOR" now finds zero team-scoped candidates, falls through to the platform-wide fallback, and platform-wide the closest name match is the unrelated Mayowa Agoyi - who the new guard correctly blocks. Confirmed via direct query against both players' live affiliation rows (`dev/query-mayokun.mjs`, `dev/query-mayowa-agoyi.mjs`, both deleted after use, no writes). Does not affect any already-applied event/stat data. Flagged to Richard as a decision rather than fixed unilaterally (out of scope for the guard task).

2026-07-09 | dev/fix-mayokun-colnas-nickname.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
Richard's call: add "Mayor" to Mayokun's COLNAS affiliation nicknames too (not move it off busa-kings - both rows now carry it). Dry-run confirmed COLNAS affiliation (`K8wIIijwtIyzf1xM-wZYF`) nicknames was `[]`; applied -> `["Mayor"]`; post-apply SELECT confirmed. Kings FC affiliation untouched. Re-ran the matcher against MD1 g1's COLNAS sheet again post-fix: "MAYOR" now resolves `LINK (exact)` to the real Mayokun via team-scoped nickname match - no platform-wide fallback, no dual-college flag. Confirms both the fix and the guard's earlier flag were correct.

2026-07-09 | Audit: every nickname write made across sessions 40/40B/40C for the wrong-affiliation-row pattern | STAGING (read-only, grep + inspection) | SUCCESS | VERIFIED
Richard asked whether the Mayokun mis-scoped-nickname mistake could exist elsewhere already, given at least 2 other players (Jesse Uno, the new COLMANS "Isreal" stub) had nicknames touched or considered this session. Grepped every dev/*.mjs referencing `nicknames`, inspected each actual write:
- `backfill-write-md1.mjs`: the ONLY real alias ever written (Mayokun's "Mayor") - already found wrong and already fixed above.
- `backfill-write-md1g2.mjs` (4 new stubs) and `fix-israel-emmanuel-swap.mjs` (new COLMANS "Isreal" stub): both insert `nicknames = '[]'` for brand-new players - no alias written, no wrong-row risk (nothing to be scoped incorrectly).
- Jesse Uno (JES): confirmed via prior session's `dev/verify-jes-jesse-uno.mjs` (read-only) - required zero new writes of any kind, no nickname ever set.
Conclusion: Mayokun's was the only actual nickname-alias write in the entire backfill to date. No other instance of this pattern exists. Nothing further to fix.

---

2026-07-09 | MD2 G1 (COLNAS vs COLENG) player matching + a real duplicate-player catch | STAGING | SUCCESS | VERIFIED
`node dev/backfill-run-sheet.mjs md2-colnas-vs-coleng "MD2_COLNAS-COLENG .xlsx"` (consolidated workbook, tabs "Colnas"/"COLENG") - parsed clean, 15 + 13 = 28 rows, 0 unresolved names, 0 team-resolution errors.

22 of 28 rows resolved LINK (exact) with no ambiguity, mostly reused from MD1 g1/g2 (same college rosters, second group-stage match). 6 needed human sign-off:
- DANIEL (COLENG): FLAG - 2 exact candidates (Daniel Tiamiyu / Daniel Ezekwe). Resolved by the same elimination logic as MD1 g2 (row EZEKWE already claims Daniel Ezekwe exactly) -> Daniel Tiamiyu (`busa-kings-player-77`). Confirmed by Richard.
- MICHEAL (COLENG): fuzzy dist=2 -> Michael Oguntola (`player-1767972272690-bjbpqarn5`), same identity confirmed in MD1 g2. Confirmed.
- ISREAL (COLENG): fuzzy dist=2 -> Israel Emmanuel (`busa-pirates-player-17`). Verified via direct COLENG roster query (44 players) that no leftover "Isreal" stub exists (correctly deleted by the session 40C fix) and Israel Emmanuel's own COLENG affiliation is real and un-conflicted (target team = his actual college, guard correctly did not flag it). Confirmed.
- JES (COLNAS): tool default CREATE STUB (same nickname-truncation blind spot as MD1 g1 - fuzzy length-gate excludes "JES" vs "Jesse"). Same real person as MD1 g1: Jesse Uno (`busa-joga-player-30`), already affiliated to COLNAS. Confirmed - LINK, not stub.
- LEZZY (COLENG): fuzzy dist=1, platform-wide candidate "Lazzy (woods)" (`cbf4241e-018f-4645-b88b-59f6dae31155`, Hammers, no college affiliation). **Richard corrected the initial read:** this is the SAME real person as `busa-hammers-player-97` (Olaoluwa Olusanya, jersey "Woods", already COLENG-affiliated with squad_players in BUSALYMPICS) - a genuine duplicate player record, not two different Hammers players who happen to share a nickname. Queried both directly: `cbf4241e...` had zero events, zero stats, zero squad_players anywhere - only a Hammers club affiliation + a redundant university-only `player_organization_affiliations` row (the real player already has the equivalent, fuller university+college+department set). Corrected resolution: LEZZY -> LINK to `busa-hammers-player-97` directly (already on COLENG, no new affiliation needed for this row at all).

2026-07-09 | dev/delete-lazzy-woods-duplicate.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
Deleted the confirmed-inert duplicate (`cbf4241e-018f-4645-b88b-59f6dae31155`, "Lazzy (woods)") found while resolving MD2's LEZZY row. Pre-flight used a full `PRAGMA foreign_key_list` scan across every table with an FK to `players` (known-issues.md precedent - never use a hand-written child-table list), not just the two tables anticipated. Scan caught `player_organization_affiliations.player_id: 1 row` in addition to the expected `player_team_affiliations.player_id: 1 row` - both investigated before the script proceeded (the org-affiliation row was a redundant university-only entry, no unique data). Every other FK-linked table (match_events, football_player_stats, squad_players, player_ratings, transfers, fpl_*, etc.) returned 0. Dry-run reviewed, applied: 1 `player_team_affiliations` row + 1 `player_organization_affiliations` row + the `players` row deleted. Post-apply verify: all three counts 0.

2026-07-09 | dev/fix-olusanya-coleng-nickname.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
Proactive fix (Richard's call, same shape as the Mayokun fix): added "Lazzy" to Olaoluwa Olusanya's (`busa-hammers-player-97`) COLENG affiliation nicknames, alongside his existing jersey_name "Woods". Dry-run confirmed nicknames was `[]`; applied -> `["Lazzy"]`; post-apply SELECT confirmed. Re-ran the matcher against MD2's COLENG sheet: LEZZY now resolves unambiguously to Olusanya (still tier FUZZY dist=1, not EXACT, because the sheet spells it "LEZZY" vs the real nickname "Lazzy" - one-vowel difference - but no more duplicate/ambiguity risk since the duplicate record is already deleted).

2026-07-09 | dev/backfill-write-md2g1.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
MD2 G1 (COLNAS 1-2 COLENG, matchId a9CtLwotaXyfsfMf2odAM) FULLY BACKFILLED. Third of 34 matches, first with zero new players/affiliations/squad_players (all 28 sheet entries resolved to players already correctly wired from MD1 g1/g2).

Player resolution required human sign-off on 5 of 28 rows (all confirmed by Richard):
- DANIEL (COLENG): 2 exact candidates, resolved by elimination (EZEKWE already claims Daniel Ezekwe) -> Daniel Tiamiyu (`busa-kings-player-77`), same as MD1 g2.
- MICHEAL (COLENG): fuzzy dist=2 -> Michael Oguntola (`player-1767972272690-bjbpqarn5`), same as MD1 g2.
- ISREAL (COLENG): fuzzy dist=2 -> Israel Emmanuel (`busa-pirates-player-17`). Verified via full COLENG roster query (44 players, no leftover stub) that this is his real, un-conflicted college - guard correctly did not flag it.
- JES (COLNAS): tool default CREATE STUB (nickname-truncation blind spot) -> Jesse Uno (`busa-joga-player-30`), already on COLNAS, same as MD1 g1.
- LEZZY (COLENG): fuzzy dist=1 -> initially flagged a duplicate player record; Richard corrected to Olaoluwa Olusanya (`busa-hammers-player-97`), already COLENG-affiliated. Duplicate deleted separately (see above).

Substitution pairing for 2 same-minute windows (COLNAS @88' - 3 out/3 in; COLENG @53' - 2 out/2 in) resolved by matching Richard's named pairs against each player's own isSub/minuteIn/minuteOut in the parsed sheet data (not by parsing English word order, which was inconsistent between the two answers) - MAYOR/OMARI, SMART/AZEEZ, REWARD/IK (elimination), SAKA/OSARO, CHRIS/LEZZY (elimination).

FINAL APPLIED STATE (155 statements, single atomic batch):
- match_events: 127 (Clearance 42, Interception 23, Foul 16, Shot off Target 7, Save 7, Tackle 6, Substitution 6, Yellow Card 5, Shot on Target 5, Assist 5, Goal 3, Red Card 2)
- Sanity check: Goal+Penalty event count = 3, matches 1-2 final score exactly
- football_player_stats recomputed CUMULATIVELY for all 28 players; 24/28 had prior history (from MD1 g1/g2) correctly added to, not overwritten - spot-checked Mayokun (prior 1 goal+1 foul -> now 1 goal+3 fouls+2 shots-on-target) and Israel Emmanuel (prior 1 foul -> now 1 foul+1 assist+1 shot-on-target+1 interception) against hand-computed expected totals, both exact
- Post-apply DB query confirmed all 127 events by type and all 4 spot-checked players' cumulative stats

This is the third match closed end to end, and the first with zero new player-side writes - a good sign the roster is stabilizing as more of each college's players get established from earlier matches.

---

2026-07-09 | MD2 G2 (COLMANS vs COLENVS) player matching + a recurring wrong-basketball-player catch | STAGING | SUCCESS | VERIFIED
`node dev/backfill-run-sheet.mjs md2-colmans-vs-colenvs "MD2_COLMANS-COLENVS .xlsx"` - parsed clean, 15 + 16 = 31 rows, 0 unresolved names, 0 team-resolution errors. TOMIPE flagged `noData` (jersey #1, on sheet with zero recorded stats) - same convention as prior noData rows, zero events for him this match.

26 of 31 rows resolved LINK (exact) with no ambiguity. 5 needed sign-off:
- POSI (COLENVS): matcher found an unrelated basketball player (`6Dy8Q0pKw-aOEJ1zx8S_F`, TBK, position Guard) via platform-wide fallback - CONFIRMED via direct query as the exact same wrong match MD1 g2 already caught and rejected once. Real match: Ayomiposi Alabi (`busa-joga-player-24`), already COLENVS-affiliated from MD1 g2 (jersey_name "Puyoo", zero nicknames recorded, so team-scoped search for "POSI" found nothing and fell through to platform-wide every time). Added "Posi" nickname to his COLENVS affiliation (Richard confirmed nicknames are per-affiliation, not a `players.jersey_name` rename, which would have overwritten his real club identity "Puyoo" globally). Re-ran the matcher post-fix: POSI now resolves `LINK (exact)`.
- SHAPAN, SHARFFHI, ANIMASHAUN: established identities from MD1 g1/g2 (SHARFFHI and ANIMASHAUN are both self-test regression fixtures), reconfirmed by Richard.
- Gozie, TJ, Wale (COLMANS): CREATE STUB, no candidates at any tier, confirmed new. Sheet records each one's actual position directly (LB/ST/RW), so no inheritance logic needed this time.

Match verified against DB: `nDns_3mSI23jERQJhMNli`, COLMANS(home)/COLENVS(away), 2-1, FINISHED, 0 existing events - matches sheet's own goal tally (MARTINS + GABRIEL's own goal = COLMANS 2, KELLY = COLENVS 1).

Substitution data required two rounds of correction from Richard: COLENVS's 2-for-2 window at 45' (GABRIEL/TIMI out, JERRY/LEKAN in) resolved by elimination once JERRY-GABRIEL was confirmed. COLMANS's sub data was initially incomplete - only 3 of 4 outgoing starters had a recorded minuteOut, and only 1 of 4 incoming subs had a recorded minuteIn (mislabeled - the "75" on the sheet actually belonged to a different pairing). Richard corrected: Gozie/ISREAL and Tisco/PEDRI both at 52' (not 75'), Wale/DAMI at 58', TJ/DOTMAN at 75' (DOTMAN's own minuteOut was never captured on the sheet at all). Final 9 pairs confirmed by cross-referencing names against each player's own isSub/minuteIn/minuteOut fields, not sentence word order.

2026-07-09 | dev/backfill-write-md2g2.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
MD2 G2 (COLMANS 2-1 COLENVS, matchId nDns_3mSI23jERQJhMNli) FULLY BACKFILLED. Fourth of 34 matches. First match in this backfill with an Own Goal, and the first write script to call `assertNoCollegeConflict()` from `dev/lib/college-guard.mjs` in its pre-flight (zero conflicts found, as expected - all LINKs were pre-existing affiliations).

FINAL APPLIED STATE (273 statements, single atomic batch):
- New players: 3 (Gozie/LB, TJ/ST, Wale/RW - all with sheet-recorded positions, no inheritance needed)
- player_team_affiliations: 3, squad_players: 3 (all new stubs, zero gap-LINKs this match)
- match_events: 234 (Interception 89, Clearance 55, Tackle 21, Foul 19, Shot off Target 16, Substitution 9, Shot on Target 9, Save 7, Yellow Card 4, Goal 2, Assist 2, Own Goal 1) - the largest single-match event count in this backfill so far
- Own Goal handling: GABRIEL (COLENVS) written as `type: 'Own Goal'`, `teamId: COLENVS` (his own team, the conceding side, matching the live system's established BUG-047/BUG-054 convention). Recompute logic extended to include `own_goals` for the first time (column already existed in schema, unused until now). Post-apply DB check confirmed `goals: 0, own_goals: 1` for GABRIEL - correctly NOT counted as a regular goal.
- Sanity check: Goal + Own Goal event count = 3, matches 2-1 final score (3 total goals scored across both teams) exactly
- football_player_stats recomputed CUMULATIVELY for 30 players (27 LINK + 3 new stubs); 23 had prior history correctly carried forward, including Israel Emmanuel's COLMANS stub, Ayomiposi Alabi/POSI, and Olamidotun Salau/DOTMAN
- Post-apply DB query confirmed all 234 events by type, all 3 new player rows, and both spot-checked players' (busa-joga-player-24, busa-pirates-player-1) cumulative stats

This is the fourth match closed end to end, the first to exercise the college-exclusivity guard's write-time enforcement, and the first to correctly isolate an Own Goal from a regular Goal in the recompute step.

---

2026-07-09 | dev/backfill-write-md3g1.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
MD3 G1 (COLNAS 3-1 COLENVS, matchId `_9nntLoOZZOZGzja8EQE9`) — GOALS-ONLY BACKFILL. Fifth of 34 matches. Richard had no match sheet for this fixture, only a goal-scorer screenshot (Sammy 24', Kedem 39', Mayor 74' for COLNAS; Blacko(pen) 12' for COLENVS). All 4 scorers were already-established players from MD1/MD2 (no new matching needed).

First script variant in this backfill written for partial data (no sheet). Deliberately writes ONLY Goal/Penalty events - no fouls, cards, clearances, saves, or substitutions, since none of that data exists for this match and none was fabricated.

Caught and fixed a real bug during drafting, before it ran: an early draft computed `shots_on_target` as "existing stored value + this match's delta" instead of as a pure function of full event history (`total('Shot on Target') + total('Goal') + total('Penalty')`, matching every other script in this backfill). The delta-add approach would have violated the established cumulative-recompute invariant (see 2026-07-09 "Recompute logic scoped to..." entry and BUG-060 precedent) - caught and corrected before the dry-run, not after.

FINAL APPLIED STATE (8 statements, single atomic batch):
- match_events: 4 (Goal 3, Penalty 1)
- Sanity check: scoring event count = 4, matches 3-1 final score (4 total goals) exactly
- football_player_stats recomputed CUMULATIVELY: Sammy/Kedem/Mayokun each now 2 goals (1 prior + 1 new), Blacko now 1 penalty (0 prior)
- Post-apply DB query confirmed all 4 events and all 4 players' cumulative stats

2026-07-09 | dev/backfill-write-md3g2.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
MD3 G2 (COLMANS 0-1 COLENG, matchId `y3KcCGtHA7N7MybKTHX5K`) — GOALS-ONLY BACKFILL. Sixth of 34 matches. Only known scorer: Effiong (COLENG), no minute recorded - used the established `-1` unknown-minute sentinel (same convention as all null-minute backfill events).

FINAL APPLIED STATE (2 statements, single atomic batch):
- match_events: 1 (Goal)
- Sanity check: scoring event count = 1, matches 0-1 final score (1 total goal) exactly
- football_player_stats recomputed CUMULATIVELY: Effiong now 2 goals (1 prior from MD1 g2 + 1 new), penalties_scored unchanged at 1 (his prior MD1 g2 penalty)
- Post-apply DB query confirmed the event and Effiong's cumulative stats

Both MD3 games close out the group stage's known-goal-only fixtures. 6 of 34 matches now done (MD1 g1/g2, MD2 g1/g2, MD3 g1/g2).

---

2026-07-09 | dev/backfill-write-final.mjs --apply | STAGING (write) | SUCCESS | VERIFIED
BUSALYMPICS FINAL (COLNAS 5-0 COLENG, matchId `_lkHo5y1m6ArqvLsi1ixe`) — GOALS-ONLY BACKFILL. Seventh and LAST of the 7 BUSALYMPICS football matches (no MD4 — format goes straight from 3 group-stage match days to the Final). Richard's scorer list: "jesse x3, sammy, rogers" — Jesse Uno x3, Samuel Olapite x1, Tamuno Jumbo x1 = 5, matching the 5-0 score exactly. No minutes given, `-1` sentinel used for all 5. All 3 scorers already COLNAS-affiliated, confirmed via pre-flight before any write.

FINAL APPLIED STATE (8 statements, single atomic batch):
- match_events: 5 (Goal x5)
- Sanity check: scoring event count = 5, matches 5-0 final score exactly
- football_player_stats recomputed CUMULATIVELY: Jesse Uno now 3 goals (0 prior — his first goals in this backfill, previously only recorded for assists/fouls), Samuel Olapite now 3 goals (2 prior from MD1 g1 + MD3 g1, +1 new), Tamuno Jumbo now 1 goal (his first)
- Post-apply DB query confirmed all 5 events and all 3 players' cumulative stats

**ALL 7 BUSALYMPICS FOOTBALL MATCHES NOW FULLY BACKFILLED** (MD1 g1/g2, MD2 g1/g2, MD3 g1/g2, Final). 27 BUSA League matches remain in the original 34-match BACKLOG-018 scope — different competition, not started.

---

2026-07-09 | Post-wrap follow-up audit (Richard's request) — nickname write audit, Final identity re-check, self-test fixtures | STAGING (read-only + one code change) | SUCCESS | VERIFIED

**Nickname audit (all affiliation rows, not just this session's writes):** queried every `player_team_affiliations` row in the DB with a non-empty `nicknames` array. Exactly 4 exist total: Ayomiposi Alabi/COLENVS "Posi", Mayokun/KIN "Mayor" (pre-existing, untouched), Mayokun/COLNAS "Mayor" (this session's fix), Olaoluwa Olusanya/COLENG "Lazzy" (this session's fix). All 4 correctly scoped to the team they're meant to help match on. Complete result, not sampled - closes the audit.

**Final's identity resolution re-checked:** the Final's 3 scorers (Jesse Uno, Samuel Olapite, Tamuno Jumbo) were resolved from known prior-match IDs directly, NOT run through the matcher tool (no sheet existed to invoke it against). Verified after the fact: queried the full 27-player COLNAS roster, confirmed "jesse"/"sammy"/"rogers" each match exactly one candidate with zero ambiguity. Correct outcome, but a real process deviation from "every match runs through the same pipeline" - flagged as a precedent decision still open (see BUILD_JOURNAL "Deferred").

**College-guard scoping for BUSA League club teams:** confirmed via code inspection (not yet exercised against a live write) - `checkCollegeExclusivity`/`assertNoCollegeConflict` only fire when the target team is one of the 4 hardcoded `COLLEGE_TEAM_IDS`. BUSA club team IDs are never in that set, so the guard is structurally inert for club-team LINKs - correct behavior (club affiliation is multi-valued), but genuinely untested against real BUSA League data yet.

**Self-test fixtures added** for the nickname-as-fallback tier (`dev/backfill-match-players.mjs`): MAYOR (COLNAS, EXACT via nickname), LEZZY (COLENG, FUZZY dist=1 - sheet spelling differs from the "Lazzy" nickname, stays fuzzy even post-fix), POSI (COLENVS, EXACT via nickname). Full suite re-run: 14/14 passed (13 fixtures + the college-exclusivity guard case).

**Still open per Richard, before BUSALYMPICS is treated as fully closed / mirrored to prod:**
- Independent (non-script, by-hand) spot-check of final staging state against the original xlsx/photos - not yet done, must not be CC re-verifying its own writes with more scripts.
- The "no-sheet match" precedent (always route through the matcher for the paper trail even without a sheet vs. direct-ID shortcut when unambiguous) - not yet decided.
- No prod mirror until both of the above are resolved.

2026-07-09 | DECISION: no-sheet match identity resolution precedent | N/A (decision log) | N/A | N/A
Richard's call: for any future no-sheet match (goals-only, scorer-list-only backfill), identity resolution MUST always route through `dev/backfill-match-players.mjs` against the target team's live roster - even with no xlsx to parse. Practical method: type the scorer names into a throwaway JSON matching `parse-match-sheet.mjs`'s output shape (`{ matchLabel, teamSlug, players: [{ name, ... }] }`) and run it through the matcher like any sheet-derived file. Keeps every match on the same audited pipeline with the same paper trail, regardless of whether a physical sheet exists. Retroactive note: MD3 g1/g2 and the Final did NOT follow this (direct-ID shortcut, verified unambiguous only after the fact) - not being redone, but this is now the standing rule for anything backfilled from here forward, including a future BUSA League no-sheet match if one comes up.

2026-07-09 | REAL BUG FOUND AND FIXED: college-exclusivity guard false-positive on club-team targets | STAGING (read-only test + code fix) | SUCCESS | VERIFIED

Richard's explicit ask before BUSA League starts: don't just trust the code-level reasoning that the guard is "structurally a no-op" for club teams - actually test it against real data. Added two new self-test cases using a real player with a genuine dual affiliation (Olamidotun Salau, `busa-pirates-player-8` - active COLMANS college affiliation AND active Pirates FC club affiliation, confirmed via direct query first).

**Found a real bug on the first run, not hypothetical:** `checkCollegeExclusivity(client, 'busa-pirates-player-8', 'busa-pirates')` incorrectly returned a conflict - it checks "does the player have an active college affiliation to a DIFFERENT team" but never checked whether the TARGET team is itself a college team. The matcher's own calling code in `backfill-match-players.mjs` happened to gate this correctly by coincidence (only ever invokes the guard when the target is one of the 4 college teams), which is exactly why the flaw stayed hidden - the protection lived in the caller, not the guard itself. `assertNoCollegeConflict` (the hard-abort variant meant for future write-script pre-flights) had NO such protection. `dev/backfill-write-md2g2.mjs`'s pre-flight loop only ever iterated college teams too, so this never fired incorrectly in any already-applied write - purely latent, would have first fired on the first BUSA League write script that called `assertNoCollegeConflict` for a club-team LINK on a player who also has a college affiliation (a completely normal, legitimate case).

**Fix (`dev/lib/college-guard.mjs`):** `checkCollegeExclusivity` now returns `null` immediately if `targetTeamId` is not one of the 4 `COLLEGE_TEAM_IDS`, before running any query. Moved the gate INTO the shared function rather than relying on every caller to remember to scope their own loop to college teams - the same "don't rely on caller discipline" lesson BACKLOG-111's `decrementPlayerStats` bug already taught this project.

**Verified:** self-test extended to 16 cases (was 14) - new cases: (1) `checkCollegeExclusivity` against Olamidotun Salau -> Pirates FC now correctly returns no conflict; (2) full matcher end-to-end - "DOTMAN" against the live Pirates FC roster resolves `EXACT` to `busa-pirates-player-8` cleanly. Full suite: 16/16 pass. This was found and fixed BEFORE any BUSA League write script existed to be silently broken by it - exactly the "test before it ships" outcome the ask was for.

2026-07-10 | dev/parse-fa-match-reports.mjs + dev/query-busa-league-matches.mjs + dev/query-check-missing-fixtures.mjs (RECONCILE directive) | STAGING (read-only) | SUCCESS | VERIFIED
Session 41 start — read-only reconciliation of FA official BUSA League records (26 PDF match reports, parsed via new `dev/parse-fa-match-reports.mjs` using `pdf-parse` v2.4.5, installed unsaved/no manifest change) against all 27 `busa-match-1`..`busa-match-27` rows on staging, before any events backfill or group/bracket seeding begins. Full report: `dev/busa-league-reconciliation-report.md`.

**Result: 23 of 27 DB rows confirmed correct against FA source** — teams and score agree exactly, zero score mismatches, zero team mismatches, zero DB-side duplicates. This contradicts the severity Richard initially suspected ("previous developer must have mixed things up") for the portion of the season FA data currently covers.

**Real gap found, verified DB-wide (not just busa-match-* prefix) before concluding:** 2 FA-listed matches have zero corresponding rows anywhere in `matches` — Joga FC 1-0 Hammers FC, and Kings FC 2-0 Pirates FC. Confirmed via a team-pair search across all ids/competitions, not only the 27-row table, to rule out mis-filing under a different id. Genuinely absent, not mislabeled elsewhere.

**4 DB rows (busa-match-24/25/26/27) have no FA report yet** — consistent with Richard's own "~90% of FA data" estimate, not treated as errors pending the remaining files.

**Blaze FC / Deadline FC — resolved.** "Blaze" appears in zero FA reports; "Deadline"/"Deadline FC" appears in exactly 2, matching busa-match-14 and busa-match-17 exactly on score. Richard separately confirmed directly this session that Blaze FC was swapped for Deadline FC before the season started and never played — draw image showing Blaze FC in Group D is simply pre-swap and outdated. No DB fix needed.

**FA-source internal contradiction found (not a DB issue):** Kings FC v Cruise FC report's own scoreline says Kings 15-0, but all 18 listed goal-scorer lines in that same PDF are grouped under a "Cruise FC" subheader. DB score (15-0) matches the header, so no DB discrepancy — but this will need resolving before that match's events get backfilled.

**Two real parser bugs found and fixed while building the PDF parser** (both mechanical, not data issues): (1) PDF page-break markers ("-- 1 of 2 --") leaking into extracted text as literal lines — stripped in `cleanLines()`. (2) One source file (`Kings Fc vs Pirates_115913.pdf`) used tab characters between words instead of spaces, breaking the space-literal score-line regex — fixed by normalizing all internal whitespace before parsing and switching detection to `\s+`.

**Groups/brackets:** confirmed schema already supports this — `competitions.numberOfGroups`/`teamsPerGroup`/`groupDrawComplete`, `competition_team_entries.group_name`, `matches.group_name`, `standings` table, `bracket_nodes` table all already exist. Every one of the 27 `busa-match-*` rows currently has `group_name = null` — nothing seeded yet. This is a data-entry task against existing structure, not new schema work.

No writes made. Richard to call each finding (the 2 missing matches, the Kings/Cruise contradiction) before any correction or backfill directive gets drafted.

2026-07-10 | dev/busa-insert-competition-team-entries.mjs --apply + dev/busa-schedule-image-crosscheck.mjs | STAGING (write: 16 rows + read-only) | SUCCESS | VERIFIED
**Group seeding (write).** `competition_team_entries` had ZERO rows for BUSA LEAGUE FOOTBALL (`xm1OcBFeugKxLDHH6Xi6p`) — confirmed before writing: every UPDATE attempt against the 16 teams returned `rowsAffected: 0` (silent no-op, caught before being mistaken for success), and the table had only 4 rows platform-wide, all belonging to BUSALYMPICS. Pre-flight checks before inserting: `created_at` confirmed epoch-seconds from the Drizzle `mode: 'timestamp'` declaration itself (not just inferred from sample rows); `PRAGMA index_list` confirmed the only constraint on the table is the primary key on `id` — no compound uniqueness on `(team_id, competition_id)`, and 0 teams currently hold duplicate rows anywhere, so no collision risk. `--dry-run` reviewed first (16/16 teams resolved cleanly by name), then `--apply`: 16 rows inserted in one atomic batch. Post-insert count confirmed = 16. `group_draw_complete` confirmed still `0` (not flipped — left as a separate, explicit decision per the original directive). Group letters used the DB's existing convention (Group B = Kings/Hammers/Santos/Cruise, Group C = Agenda/La Fabrica/Allianz/Legacy) — this was originally the reverse in the source draw list handed in, caught via a letter cross-check against `matches.round` before any write, and confirmed correct by Richard directly.

**Schedule image cross-check (read-only).** Transcribed all 21 matches shown across 3 uploaded schedule graphics (GW1 partial crop, GW2, GW3) and cross-referenced against all 29 DB rows for this competition. Full output: `dev/busa-league-canonical-schedule.md`.

Findings:
- 20 of 21 image matches match their DB row's date exactly (WAT-adjusted from the stored `T23:00:00.000Z` UTC convention).
- **New: Quantum FC vs Deadline FC (previously "fully unsourced") now has a confirmed date** — GW3 image shows it scheduled 2025-11-22. Still needs a score before it can be inserted.
- **New: busa-match-17 (Pirates FC 10-0 Deadline FC) has a real date anomaly** — image places it in GW1 (alongside the other 2 crop-missing matches, both of which landed correctly on 2025-11-09), but the DB stores it at 2025-11-21, two weeks later, in Quarterfinal-adjacent territory. Teams and score aren't in question, only the date. Not yet corrected — flagged for Richard's call.
- busa-match-18 (Kings v Cruise) has a minor 1-day date mismatch (image: Fri 21 Nov, DB WAT-adjusted: 22 Nov) — noted alongside its existing open item (goal-scorer attribution needs to flip from Cruise to Kings whenever events get built for this match).
- Task 3 completeness check: all 29 rows accounted for exactly once, no duplicates. Every team's match count matches expectation exactly once the 3 already-known gaps (Deadline-Quantum, Joga-Hammers SF, Kings-Pirates SF) are accounted for — no new hidden or duplicated matches surfaced.

Net open items after this session's tracing work: 3 inserts (Joga-Hammers SF 1-0, Kings-Pirates SF 2-0, Deadline-Quantum score pending) + 1 date correction on an existing row (busa-match-17). No writes made to any match row or to busa-match-27 — both remain exactly as they were, per standing instruction to hold all corrections for a separate directive.

2026-07-10 | doc correction: dev/busa-league-canonical-schedule.md | STAGING (docs only, no DB writes) | SUCCESS | VERIFIED
Richard caught two real mischaracterizations in the canonical schedule doc's verification tally, both corrected:
1. Joga-Hammers (SF1) and Kings-Pirates (SF2) were wrongly listed as "no FA report, scores from Richard directly" — both actually have real FA reports in the original 26-file batch (`Joga FC vs Hammers FC_115804.pdf` = 1-0, `Kings Fc vs Pirates_115913.pdf` = 2-0), correctly identified as such in the very first reconciliation of this session but lost/mischaracterized in a later summary table. "Pending FA verification" count corrected from 7 down to 5 (QF1/QF2/QF3/QF4/Deadline-Quantum only).
2. busa-match-17 (Pirates-Deadline) "date anomaly" flagged earlier this session is RESOLVED, not a bug — Richard confirmed the match was legitimately rescheduled from GW1 to 2025-11-21 due to a logistics problem. No fix needed, date is correct as stored.
3. busa-match-18 (Kings-Cruise) date IS a real, confirmed error — schedule image says 21 Nov (confirmed correct), DB's stored value WAT-converts to 22 Nov. Off by 1 day, not yet corrected.

No DB writes this entry — doc-only correction pass on `dev/busa-league-canonical-schedule.md`.

2026-07-11 | dev/busa-create-stub-players.mjs --apply | STAGING (write: 85 players + 85 affiliations) | SUCCESS | VERIFIED
**BUSA League player stub creation — session 41 close.** 85 new players created across 8 teams (Cruise 7, Santos 14, La Fabrica 14, Legacy 14, Underrated 8, Prime 7, Deadline 17, Kings 1 [Anuoluwapo]) — the "mostly unbackfilled" rosters identified this session. Each got 1 `players` row + 1 `player_team_affiliations` row (type='team', is_primary=1), matching the original club-registration pattern (no `squad_players` row — that table is only used for the later BUSALYMPICS crossover cases, confirmed by inspecting an existing reference row before writing anything).

**Verification pipeline that got this number right (163 → 85), each pass catching real duplicates the previous one missed:**
1. Raw compile from all 10 parsed logsheets: 163 candidates (jersey number + real name + real recorded stat, per Richard's closing criteria — jersey number turned out NOT to be required, only stats).
2. First DB-truth pass (team+jersey slot match) caught 54 already-existing players — including a near-miss on AHIMA, who was already cleanly linked under a UUID-style id and would have been duplicated by a memory-based exclusion list alone.
3. Second pass (name+team match) caught 8 more (TIMI, MICHEAL, OSARO, OMARI, BLACKO, UZO, CHRIS, EFFIONG) — same real person recorded in two different files, once with a jersey number and once without.
4. A full thorough re-verification against all 97 existing players *and* the 37-player unassigned (`team_id IS NULL`) pool, using 4 match strategies (exact name, exact jersey_name, word-match, jersey-number-with-different-name) caught 66 + 13 = 79 more real duplicates the earlier heuristics missed (BRICKS via jersey_name only, DAVID via first-name-vs-full-name, and critically "Tisco Jr" and 12 others sitting in the unassigned pool with no team at all — a pattern already proven real earlier this session with Wale/Lucky/Kelly/Andrew/Segun/Pedri).
5. Cross-validated the whole remaining list against the established `dev/backfill-match-players.mjs` matcher (extended with a `--json` export flag for this purpose) rather than trusting the ad-hoc verification alone — found 10 more matcher-flagged CREATE STUB names my checks had wrongly excluded (7 were jersey-slot collisions needing a human call, not an automatic same-person assumption; 2 were correctly excluded already for having zero recorded stats; 1 wasn't a player at all) — and spot-checked all 36 names the matcher had a fuzzy/cross-team candidate for that my check called "new," confirming all 36 were correctly kept (every candidate the matcher suggested was already an established player on a *different* club or even a different sport — cross-club/cross-sport noise, consistent with the season's "no transfers before QF" rule and the earlier Jabbar/basketball false-match precedent).
6. Final human calls on the 7 jersey-collision cases: PRAISE = Ola-praise Abadoni (link, not created), ATK = Sky (ATk) (link, not created), LAZZY = Woods/Olaoluwa Olusanya (link, not created — reversed once, then confirmed), SUPRA and EZECHI held out pending further confirmation (not created this pass), ANUOLUWAPO and MUHAMMED both genuinely different from their jersey-slot neighbors — but MUHAMMED was separately excluded anyway for having zero recorded stats. Net: only ANUOLUWAPO of the 7 collision cases made it into this batch.

**Real process lesson, called out directly mid-session:** built several ad-hoc duplicate-detection scripts instead of trusting/extending the already-proven `backfill-match-players.mjs` matcher (16/16 self-test, used successfully throughout BUSALYMPICS and earlier this session) — this is exactly why the same class of bug (missed jersey_name-only matches, missed unassigned-pool records) recurred multiple times before the cross-validation pass caught it properly. Fixed going forward by adding the `--json` export to the established matcher itself rather than continuing to duplicate its logic.

**Deferred to next session:** SUPRA and EZECHI (Hammers jersey-slot collisions, still unconfirmed) — not created, not linked, genuinely open.

2026-07-11 | dev/fix-hammers-duplicate-players.mjs --apply | STAGING (write: 10 statements) | SUCCESS | VERIFIED
**Session 41B — Hammers duplicate-player merge (Sancho + Speedy).** Two more duplicate-player-with-real-events cases found while resolving identities for busa-match-13's full-stat event build (goals+cards had already surfaced these as ambiguous jersey collisions in an earlier pass; full-stat capture is what forced actually resolving them). "Sancho" dup (`a7a0900f...`, busa-hammers #8) was inert — 1 affiliation + 1 org affiliation only, no events — deleted outright, merged into real busa-hammers-player-8 (Joseph Ikyernum). "Speedy" dup (`1ee6d046...`, busa-hammers #11) was NOT inert — 4 real match_events + 1 football_player_stats + 1 player_ratings row, all from the live-logged 3rd Place Playoff (`8Mek2CA7KPlnk1EQ647jx`) — re-pointed to real busa-hammers-player-11 (Oluwasurefunmi Adetuyi) via UPDATE (not delete), cumulative recompute applied (1 foul, matches the events exactly), rating re-pointed with zero clash. Dry-run reviewed first, matched expectations exactly. Post-apply: both dup rows fully gone (0 across players/affiliations/stats/events), real player-11's events/stats/rating all confirmed correct.

2026-07-11 | dev/fix-spectrum-duplicate-player.mjs --apply | STAGING (write: 7 statements) | SUCCESS | VERIFIED
**Session 41B — "Spectrum" duplicate merge (busa-hammers #10).** Same shape as Sancho/Speedy, found while reviewing the proper `backfill-match-players.mjs` matcher's FLAG output for busa-match-13 (my own quick jersey-first resolver had missed this one entirely since it only checks for ambiguity, not name-based dup risk — matcher's FLAG output caught it). "Spectrum" dup (`f50e5eb2...`) carried 4 real match_events (2x Shot off Target, 1x Interception, 1x Substitution) + stats + rating from the same 3rd Place Playoff match. Real busa-hammers-player-10 (Ephraim Ogah) had zero prior events/stats — dry-run reviewed, applied, all 4 events + rating re-pointed, new stats row inserted (2 shots off target, 1 interception, matches exactly).

2026-07-11 | dev/fix-olusanya-hammers-nickname.mjs --apply | STAGING (write: 1 UPDATE) | SUCCESS | VERIFIED
**Session 41B — Olusanya "Lazzy" nickname, 2nd affiliation.** His COLENG affiliation got this nickname in session 40C; his busa-hammers CLUB affiliation still had `nicknames: "[]"`, causing a busa-hammers-scoped search for "LAZZY" to correctly find nothing and recommend CREATE STUB for an already-existing real player. Added additively (not a move) to the busa-hammers affiliation row. Dry-run + apply, confirmed `["Lazzy"]` post-write.

2026-07-11 | dev/fix-timi-jersey-number.mjs --apply | STAGING (write: 2 UPDATEs) | SUCCESS | VERIFIED
**Session 41B — Timi jersey number correction (busa-hammers).** DB had `players.number = 5` (colliding with Iyanuloluwa Olusore's real #5, causing an ambiguous jersey lookup for "IYANU"); every logsheet across 2 matches consistently shows Timi's jersey as #18. Confirmed #18 was unoccupied on busa-hammers before writing. Corrected both `players.number` and `player_team_affiliations.jersey_number` to 18. Root-cause fix, not a workaround — prevents the same ambiguity recurring in any future BUSA League match involving Hammers.

2026-07-11 | dev/backfill-write-busa-match13.mjs --apply | STAGING (write: 132 statements) | SUCCESS | CORRECTED (see fix below)
**Session 41B — first BUSA League match_events write.** busa-match-13 (Cruise FC 2-2 Hammers). Full BUSALYMPICS-parity stat capture chosen over goals+cards-only (Richard's call) — every player with any recorded stat or substitution involvement gets a real event, not just goal-scorers and carded players. 104 events written initially (Clearance 24, Interception 20, Save 11, Substitution 12, Tackle 10, Shot off Target 8, Shot on Target 7, Yellow Card 4, Foul 5, Goal 3), 24 players touched, cumulative recompute applied to every one (adds to existing history where present, e.g. players who also appeared in the live 3rd Place Playoff). Two roster gaps resolved inline: new stub created for Cruise's "Seyi" (existing same-name player belongs to Hammers — the opponent in this exact match, so must be a different person); existing unassigned-pool player "Andrew" given a new busa-cruise affiliation (`team_id` was null). SUPRA (busa-hammers #24, sheet jersey collides with a real, unrelated player Bruno Ken, no platform-wide candidate) explicitly skipped per Richard rather than guessed. Goal count (Cruise 1, Hammers 2, total 3) reconciles with the known 2-2 score minus Cruise's known 0%-lineup-coverage gap — not a new bug, matches the canonical schedule doc's documented limitation. First attempt failed on `players.number NOT NULL` and `players.position NOT NULL` (Seyi stub used `null` for both) — fixed to `0` and `''` respectively, matching the established stub-creation convention from the BUSALYMPICS sessions; batch is atomic so the failed attempt left zero partial writes (confirmed via direct query before retrying).

**The 12 Substitution events were wrong and were corrected in a follow-up fix (`dev/fix-match13-substitutions.mjs --apply`), caught before commit by re-checking `dev/backfill-write-md1g2.mjs` for the established convention.** Two errors: (1) built as two unpaired "IN"/"OUT" events per player instead of the established single paired event (`player_id`=incoming, `related_player_id`=outgoing, one row per swap); (2) treated every non-null `minuteOut` as a real substitution, not knowing BUSA League matches are 35-minute halves (full time = 70', not 90) — so 9 players who simply played the whole match (`minuteOut: 70`) got fabricated substitution-out events, including one literal duplicate row (Ike, twice). Fixed: deleted all 12 wrong rows, rebuilt only the genuine early-exit pair confirmed by minute (Cruise: ony zor IN for andrew OUT @37). The other early exit (Hammers: AHIMA out @43, matched by SUPRA in @43) could not be written — SUPRA's identity was never resolved. **Final correct state: 93 events, 1 Substitution.** New known-issues.md entries added for both the 70-minute-full-time fact (affects every remaining BUSA League match) and the paired-substitution-event convention.

**6 of 7 identified full-lineup/events-only logsheet matches remain**, plus 25 more matches in the full 32-match BUSA League structure. Continuing match-by-match with sign-off, same rhythm as BUSALYMPICS — and now checking an established write script directly before building each new one, rather than reconstructing conventions from partial context.

2026-07-11 | dev/backfill-write-busa-match16.mjs --apply | STAGING (write: 78 statements) | SUCCESS | VERIFIED
**busa-match-16 (Hammers FC 6-0 Santos) — APPLIED, 64 match_events.** Built with corrected conventions from the start (paired substitution shape, 70-minute full-time threshold) after a full read of `dev/backfill-write-md2g2.mjs` confirmed everything else (assist pairing with no `related_player_id`, shots/clearances/tackles derivation, cumulative recompute scope, `is_eye_point=0` default) already matched. This match's sheets have zero real `minuteIn`/`minuteOut` data (only `isSub` flags) — zero Substitution events written, per the established "no fabrication" precedent. Goal count (6, all Hammers) matches the 6-0 score exactly. 14 players touched; cumulative recompute correctly carried forward busa-match-13 history (e.g. Olaoluwa Olusanya's goals 1→2, Joseph Adewale's assists carried from match-13 combined with this match's own goal).

**5 of 7 identified matches remain: busa-kings-santos, busa-legacy-lafabrica, busa-pirates-quantum, busa-underrated-deadline, busa-final.**

2026-07-11 | dev/backfill-write-busa-match15.mjs --apply | STAGING (write: 131 statements) | SUCCESS | VERIFIED
**busa-match-15 (Kings FC 5-0 Santos) — APPLIED, 102 match_events.** Three real identity corrections caught before writing: (1) MICHEAL (Kings #99 on sheet) — a THIRD distinct player exists with an exact name+jersey_name match (`player-1783726262888-715f2f18-`, number=0), not Michael Oguntola (real #99) as an earlier ad-hoc guess had assumed — caught by checking the proper matcher's exact tier instead of trusting name-similarity alone. (2) POSI (Kings #66) — platform-wide fallback surfaced a TBK (Basketball) player, same cross-sport false-positive class as MD2g2's POSI mistake; real match is jersey #66 = Ayomiposi Peters ("Ayomiposi" contracts to "Posi"). (3) ENOCH (Santos GK, 12 real saves) — busa-santos had zero goalkeepers on record; of 2 ambiguous "Enoch" candidates, one was a real Prime FC player (ineligible, different club), the other was in the unassigned pool (`team_id` null) — linked, new busa-santos affiliation added. Kings' substitution window (5 players out at minute 48, 4 incoming at staggered minutes 48-51) was genuinely ambiguous with no reliable pairing — deferred, not fabricated, consistent with the BUSALYMPICS precedent that ambiguous multi-sub windows need a named-pair confirmation. Goal count (5, all Kings) matches 5-0 exactly. 27 players touched.

**4 of 7 identified matches remain: busa-legacy-lafabrica, busa-pirates-quantum, busa-underrated-deadline, busa-final.**

2026-07-11 | dev/backfill-write-busa-match10.mjs --apply | STAGING (write: 149 statements) | SUCCESS | VERIFIED
**busa-match-10 (Legacy FC 0-1 La Fabrica) — APPLIED, 117 match_events.** Four identity resolutions: PEDRI (#8), WALE (#11), KELLY (#99, Legacy) all exact-name matches in the unassigned pool, linked with new team affiliations (no existing occupant at those jersey slots). Ebuka (Legacy GK, real saves+clearances data) had only a Titans (Basketball) platform-wide candidate — cross-sport false positive, rejected, same class as the established POSI mistake — genuinely new player, CREATE STUB. Two La Fabrica substitution windows (36' and 68', both clean 2-for-2 swaps with real minutes) deferred — no distinguishing name or position data on the incoming subs to determine correct pairing, not fabricated. Goal count (1, La Fabrica) matches 0-1 exactly. 24 players touched.

**3 of 7 identified matches remain: busa-pirates-quantum, busa-underrated-deadline, busa-final.**

2026-07-11 | dev/backfill-write-busa-match12.mjs --apply | STAGING (write: 102 statements) | SUCCESS | VERIFIED
**busa-match-12 (Pirates FC 2-1 Quantum) — APPLIED, 89 match_events.** Quantum's sheet was empty (0 players parsed) — only Pirates' side contributes; Quantum's 1 goal is a known, accepted gap. One identity correction: JABARR (#9) — platform-wide fallback surfaced a Storm (Basketball) player "JABBAR", the exact cross-sport false-positive pattern already flagged in known-issues.md — real match is jersey #9 = Abdul-jabbaar Bello, already on this team. Three substitution windows: @44 and @68 both genuinely ambiguous 2-for-2 swaps, deferred; @59 was a clean 1-for-1 pair (DOTMAN IN for ENIOLA) — written with correct paired shape. Goal count (2, Pirates) matches the known 2-1 score minus Quantum's expected gap. 13 players touched; cumulative recompute correctly reflects prior BUSALYMPICS history for cross-competition players (Mayowa Agoyi, Abdul-jabbaar Bello both also play COLNAS).

**2 of 7 identified matches remain: busa-underrated-deadline, busa-final.**

2026-07-11 | dev/backfill-write-busa-match14.mjs --apply | STAGING (write: 162 statements) | SUCCESS | VERIFIED
**busa-match-14 (Underrated FC 3-1 Deadline) — APPLIED, 126 match_events.** SALMAN (Underrated #5) had a genuine 2-person jersey collision with ALI, disambiguated by exact name. AKANDE/ABDULKABIR/OTIS/TJ (Underrated) and SEGUN (Deadline) all exact-name unassigned-pool matches, linked with new affiliations. Four confident 1-for-1 substitution pairs written (TJ/SALMAN @56, NESTOR JR/JOJO @67 on Underrated; JONATHAN/ANTHONY @40, DAMILOLA/IBRAHIM @46 on Deadline); two group-swap windows deferred as genuinely ambiguous (Underrated @48 2-for-2, Deadline @35 3-for-3). Goal count (3, Underrated) matches 3-1 minus Deadline's expected 0%-coverage gap. 26 players touched.

**1 of 7 identified matches remains: busa-final.**

2026-07-11 | dev/backfill-write-busa-final.mjs --apply | STAGING (write: 138 statements) | SUCCESS | VERIFIED
**busa-match-final-2026 (Kings FC 0-0 Joga-Bonito, 4-3 pens) — APPLIED, 115 match_events.** Last of the 7 identified logsheet matches. Two more Storm/Basketball cross-sport false positives caught and rejected (OLA #88 → real match is Ola-praise Abadoni, same identity already confirmed for "PRAISE" in busa-match-15) and one more genuine jersey #99 collision (ANUOLUWAPO, same Michael-Oguntola-vs-Anuoluwapo pattern as busa-match-15, disambiguated by exact name). Kings' sheet showed the same false minuteIn=1/minuteOut=70 "full match" pattern as busa-match-13 — correctly NOT treated as substitutions this time; only 2 real early-exit pairs found and written (Kings: ADEDEJI out/CHUKUWUEMEKA in @44; Joga: KENNY out/IDIMU in @57). Zero goals this match (0-0, decided on penalties) — penalty shootout kicks are not represented in `match_events` at all, no established event type or precedent exists anywhere in this backfill or the live schema; the match's stored 0-0/4-3-pens score was already correct from a prior session. 23 players touched.

## ALL 7 IDENTIFIED BUSA LEAGUE LOGSHEET MATCHES NOW APPLIED (session 41B): busa-match-13, -16, -15, -10, -12, -14, -final-2026. Combined: 706 match_events written across 7 matches, ~9 duplicate-player/identity bugs found and fixed along the way (2 more merges beyond Sancho/Speedy, 4 more cross-sport basketball false positives beyond the already-known Jabbar pattern, 2 jersey-number data errors, 1 nickname-scoping recurrence). This closes the "7 identified full-lineup/events-only logsheet matches" scope from session 41 — 25 more matches remain in the full 32-match BUSA League structure (16 FA-only group matches with no full lineup, 3 remaining QFs, both semifinals still held out of the `matches` table, Deadline-Quantum still missing a score).

2026-07-11 | dev/fix-micheal-oguntola-merge.mjs --apply | STAGING (write: 5 statements) | SUCCESS | VERIFIED
**Real correction from Richard: busa-match-15's "MICHEAL" is Michael Oguntola, not the separate exact-name stub.** During the write, an ad-hoc resolution had wrongly created/credited a distinct stub (`player-1783726262888-715f2f18-`, jersey #0) instead — plausible at the time since the matcher's exact tier found a literal "MICHEAL" name match, but Richard confirmed post-hoc it's actually Oguntola using a different display name on this particular sheet. 8 stub match_events re-pointed to Oguntola (`player-1767972272690-bjbpqarn5`), stub deleted, cumulative recompute correctly merged this match's contribution with his 2 prior BUSALYMPICS-adjacent matches (1 goal, 2 assists, 6 shots on target total). Same merge shape as Sancho/Speedy/Spectrum — dry-run reviewed, applied, DB-verified.

2026-07-11 | dev/backfill-write-deferred-substitutions.mjs --apply | STAGING (write: 18 statements) | SUCCESS | VERIFIED
**Resolved and wrote all deferred substitution windows across busa-match-15, -12, -14, -10, using Richard's real pairing input.** Direction (IN vs OUT) taken from each player's own recorded minuteIn/minuteOut, not from Richard's word order (confirmed his phrasing just names the pair). Two 2-for-2/3-for-3 windows still had a genuine leftover ambiguity after Richard's named pairs (busa-match-15 Kings' remaining pair, busa-match-14's Deadline 3-for-3) — resolved by explicit "pick random" instruction, arbitrary pairing applied and clearly logged as such. Caught one more near-miss while resolving: busa-match-15's OMARI (sheet jersey #17) collides with Toheeb Akinbode's real DB #17 — same jersey-collision-needs-name-resolution pattern as SALMAN/ALI and the Oguntola case, correctly resolved to Omari Dennis by name, not jersey. 18 events written: busa-match-15 (5 total subs now), busa-match-12 (5), busa-match-14 (9), busa-match-10 (4). **busa-match-13's AHIMA/SUPRA pair remains genuinely deferred — SUPRA has no resolvable identity anywhere on the platform.**

2026-07-11 | dev/fix-missed-markers-and-quantum.mjs --apply | STAGING (write: 14 statements) | SUCCESS | VERIFIED
**Real correctness bugs found by Richard reviewing an already-applied match against the real result graphic (busa-match-12), not by any internal check.** A full scan of every parsed sheet's stat fields for non-numeric non-null values (triggered by this discovery) found 12 total instances of a silently-dropped marker across 6 sheet files: "P" (Penalty, 2 instances: Tumi/busa-match-13, ADEKUNLE/busa-match-14) and "I" (a single card, confirmed by Richard to mean 1 — 6 instances already in applied matches: JOSEPH/match-13, TUNMISE/match-16, ANIMASHAUN+PAUL+ROLEX/match-15, EFFIONG/match-14; 4 more in not-yet-written matches, tracked separately). Fixed: 6 Yellow Card events + 2 Penalty events inserted, cumulative recompute for all 8 affected players. Separately, Richard's graphic revealed real Quantum FC data (Boluwatife goal, Adam yellow card) for busa-match-12 — verified directly against the raw source .xlsx first that Quantum's tab is genuinely empty (headers present, zero player rows — not a parser bug), so this is new information, not a correction. Neither player existed anywhere on the platform — 2 new busa-quantum stubs created, first players ever on that team's roster. busa-match-12 now correctly shows 3 total goals (2 Pirates + Boluwatife), reconciling exactly with the real 2-1 score for the first time. Dry-run reviewed, applied, all 5 affected matches' post-apply event breakdowns confirmed by direct query.

**LAZZY/ATK resolved — false alarm.** Richard's phrasing ("scored for cruise") meant "scored against Cruise" (i.e. for Hammers, in the match against Cruise), not a data correction. Current DB state (Lazzy/ATK credited to Hammers) is confirmed correct against a real result graphic Richard shared — Cruise=Senpal+Tumi=2, Hammers=Lazzy+ATK=2, exact match to 2-2.

2026-07-11 | cross-check vs FA report — busa-match-15 5th goal (Kedem vs Reward) | STAGING (read-only) | SUCCESS | VERIFIED
Richard's result graphic showed "REWARD" as the 5th scorer; the sheet (and my write) credited Kedem. FA report ("Match Report Kings FC v Santos.pdf") settles it by jersey number: goal credited to #10, which is Kedem's jersey (Reward is #4). Graphic's label was the error, same shape as the earlier Kings-Cruise 15-0 FA mislabeling. FA also independently re-confirmed all 3 "I"-marker yellow cards just fixed (Kings #7 Animashaun, Santos #10 Rolex, Santos #69 Paul) and Oguntola's 2 assists. **busa-match-15 required no changes.**

2026-07-11 | dev/backfill-write-busa-match11.mjs --apply | STAGING (write: 38 statements) | SUCCESS | VERIFIED
**busa-match-11 (Wolves FC 0-1 Prime FC) — APPLIED, 21 match_events.** Wolves' side has zero sheet data (source .xlsx genuinely empty, not a parser bug) — Richard supplied real card data directly, cross-checked against the FA report ("Match Report Wolves V Prime FC.pdf"): goal = Prime #20 (VAL-VERDE, confirmed 3 ways), cards = Prime #4 (Dracos, matches the sheet's "I"-marker fix), Wolves #6 (Pablo, named by Richard), Wolves #2 (identity unknown — Richard doesn't know who this is, written as a placeholder-named stub "Wolves #2" since the event itself is FA-confirmed real, just the name isn't). Two more real identity resolutions on Prime's side: EMMY vs AL AMEEN (genuine 2-person jersey #11 collision on busa-prime, disambiguated by exact name), LUCKY (unassigned pool, linked with new affiliation). Wolves FC now has 3 players total (was 1, TOJU, before this fix). Goal reconciles exactly with 0-1.

## 8 of the identified BUSA League matches now applied (busa-match-13, -16, -15, -10, -12, -14, -final-2026, -11). Only the Joga-Hammers semifinal remains — parsed sheets exist for both sides, but no `matches` table row exists yet (held out since session 41, no sourced date). Cannot be written until that row exists.

2026-07-11 | dev/fix-supra-stub-and-events.mjs --apply | STAGING (write: 6 statements) | SUCCESS | VERIFIED
**SUPRA (busa-hammers #24, busa-match-13) — new stub created.** No candidate anywhere on the platform, jersey #24 belongs to a different real player (Bruno Ken) — Richard's call: create the stub. SUPRA appears only in this one match (confirmed absent from busa-match-16's Hammers sheet too). Real data beyond the deferred substitution: 1 Interception, 1 Yellow Card (both genuine numeric values on his row, not markers), plus the deferred pair (SUPRA IN for Ahima @43) now written with the established paired convention. **busa-match-13 now has zero deferred items.**

**Full FA + result-graphic cross-check pass, all 8 matches.** Systematic comparison against `dev/fa-match-reports.md` plus 6 real result graphics Richard shared surfaced:
- **busa-match-15's 5th goal**: graphic said "REWARD", sheet/DB said Kedem — FA settled it by jersey number (#10 = Kedem, Reward is #4). Graphic's label was the error. No change made.
- **busa-match-16's "Charles"/"FUAD" jersey #14**: initially looked like a misattribution, but confirmed as a false alarm — Charles is the real, established DB player at #14; "Fuad" is just this sheet's nickname for him. A follow-up graphic (Hammers 6-0 Santos) independently confirmed his card (🟨🟥, matching the sheet's `yellow:2, red:1` exactly). No change made.
- **busa-match-16's FA-listed cards for Ise (#32) and Speedy (#11)**: FA's structured "Cards" section named these two, but the actual result graphic shows no card icon for either, and #11 already has a real assist recorded elsewhere in the same FA report — concluded this is an FA parser extraction error, not a real gap. Not added.
- **busa-match-13's Cruise-side cards**: FA wanted 4 (#1/#5/#19/#24); both the sheet and the result graphic independently show only 2 (Churchill, Tumi) — same FA-parser-artifact conclusion, not added.
- **busa-match-14's "Timo"/"Dami" FA fragments**: both from FA's own "unparsed" lines (low confidence). Adekunle's penalty is independently confirmed by the sheet's explicit "P" marker and Richard's direct confirmation — "Timo" not acted on. "Dami" (Damilola) — no corroborating second source, not acted on.
- **busa-match-10's La Fabrica "#30" card**: already a known, resolved non-issue from session 41 (no player #30 exists; #27/FAITH is correct).

**Working rule established this session: when FA's structured extraction conflicts with both the source logsheet AND a real result graphic, treat the FA extraction as the error, not the other two.** FA reports come from an automated PDF parser with no manual review layer; logsheets and result graphics are both closer to the primary event.

**Final state: all 8 matches fully reconciled, zero further FA/graphic discrepancies open.** Grand total 758 match_events (755 + SUPRA's 3).

2026-07-11 | platform-wide collision audit (84 stubs) | STAGING (read-only) | SUCCESS | VERIFIED
**Read-only audit of all 84 distinct session-41 stub players against the full platform** (exact name match, cross-sport basketball check, fuzzy/nickname tier, old contaminated-batch check). 43 of 84 had zero collisions. Two genuine pre-existing-player collisions surfaced (Charles/busa-santos vs Charles/busa-hammers; Peter/busa-legacy vs Peter/busa-hammers) — flagged, not resolved, awaiting Richard's call. One real signal acted on separately: "Azeez" (unassigned pool, `qSOyWP9XlknBwALPm2ITQ`) flagged as a fuzzy match against Abdulazeez Jolaoye (busa-kings).

2026-07-11 | dev/fix-azeez-jolaoye-college-merge.mjs --apply | STAGING (write: 5 statements) | SUCCESS | VERIFIED
**Confirmed real merge: the unassigned "Azeez" was Abdulazeez Jolaoye's own COLNAS college identity, never linked to his Kings FC club identity.** Investigation found the unassigned stub had an active COLNAS college affiliation and 2 real BUSALYMPICS substitution events (MD1 g1 `OPoEtVGUNWKcRSDe4QdSr`, MD2 g1 `a9CtLwotaXyfsfMf2odAM`) — same club+college shape as Mayowa Agoyi and Abdul-jabbaar Bello, confirmed by Richard. Re-pointed both events to Jolaoye, moved the COLNAS college affiliation onto his real ID (no conflict — he had zero prior college affiliations), deleted the redundant stub (player row, its own COLNAS affiliation, stats row). Jolaoye's existing football_player_stats (2 goals from busa-match-15) untouched — Substitution events carry no stat weight. Dry-run reviewed, applied, all 4 checks (stub gone, affiliations, events, stats) confirmed by direct query.

2026-07-11 | investigation: Charles + Peter collisions (from the 84-stub audit) | STAGING (read-only) | SUCCESS | VERIFIED
**Both false alarms — no merge needed, unlike Azeez.** Charles (busa-hammers, `19983528-...`, jersey #14, 14 real events, already separately holds his own COLNAS college affiliation) vs Charles (busa-santos, `player-...66783081-`, jersey #7, 6 real events) — both have **active club affiliations to different clubs**, not one club-only + one college-only like Azeez's case. Same for Peter (busa-hammers `62f597ce-...` jersey #96 vs busa-legacy `player-...13913df3-` jersey #8, 1 event each). Club-exclusivity (no mid-group-stage transfers) rules out same-person for both — genuinely two different real people sharing a common first name in each case. Closes both open items from the 84-stub audit.

**Separately, this session traced `players.profile_id` (cross-sport identity linking field, flagged as an open architecture question) — full findings: 0 of 309 players have it populated, but the read/write/display mechanism is fully built and reachable (not dead code) — `getPlayerProfileId()` links two rows only if they share an email at bulk-register time, `GET /api/players/[id]` reads it into `relatedProfiles`, and `/players/[id]` renders a real "Multi-Sport Athlete" card. Zero live precedent — would be the first real exercise of this feature if ever used. Confirmed both Abdul-jabbaar Bello (football) and Storm's "JABBAR" (basketball) have `profile_id: null`, no existing link between them. No decision made on whether/how to link them — fact-finding only, per the directive.**

2026-07-11 | dev/link-jabbaar-profile.mjs --apply | STAGING (write: 2 statements) | SUCCESS | VERIFIED
**First-ever real exercise of `profile_id` on this platform.** Linked Abdul-jabbaar Bello (`busa-pirates-player-9`, football) and Storm's "JABBAR" (`DRSlwyUmV-Bgff6JMnt0r`, basketball) — same real person, confirmed directly by Richard. Both rows had `profile_id: null` and different sports (pre-flight guard checked both). Generated a fresh `nanoid()` (matching `getPlayerProfileId()`'s own convention for the no-existing-ID case — no ID existed on either side to reuse) and wrote it to both rows via a single atomic batch. No other field touched — pure identity link, not a data merge; each player keeps independent stats/events/affiliations. Post-apply verified: both rows share the identical `profile_id`; `relatedProfiles` join resolves correctly in both directions (Bello→JABBAR/Storm/Basketball, JABBAR→Bello/Pirates FC/Football). Re-verified live on staging in a real browser session (admin-authenticated) — see BUG-098 evidence block below for the actual response.

2026-07-11 | git commit `2771297` + push to origin/dev | STAGING (Vercel auto-deploy) | SUCCESS | VERIFIED
**BUG-098 fix deployed to staging.** `src/app/api/players/[id]/route.ts` — stripped `profileId` from non-admin payload, gated `memberships`/`organizationAffiliations` behind `isAdmin`. Deploy confirmed via GitHub commit status API (`Vercel – brixsports-staging`: "Deployment has completed"). Verified both authenticated (admin, real staging session) and unauthenticated (local dev server, staging's own middleware blocks unauthenticated API access by design) paths — see BUG-098 entry in BACKLOG.md for full evidence.

2026-07-12 | dev/fix-stale-current-period.mjs --apply | STAGING (write: 1 UPDATE, 66 rows) | SUCCESS | VERIFIED
**BUG-100 — every FINISHED match on the platform (66/66) was displaying "NOT STARTED" instead of "FT" on its own detail page.** Root cause: `matches.current_period` schema default is `'NOT_STARTED'`; the display fallback chain (`matchTime?.period ?? match.currentPeriod ?? match.status`) never reaches `status` once `currentPeriod` holds any real string. Confirmed via code read that the live match-finish flow (`FootballLogger.tsx:982-983,1097`) still correctly writes `currentPeriod: 'FINISHED'` today — zero FINISHED matches have `startTime` after 2026-06-27 (when BUG-076/078 shipped), so every affected row predates or bypassed the live flow (backfilled BUSALYMPICS/BUSA League football + basketball). Pure historical population gap, not a live-code regression. `UPDATE matches SET current_period = 'FINISHED' WHERE status = 'FINISHED' AND current_period = 'NOT_STARTED'` — 66 rows affected, verified 0 remaining stale post-apply.

2026-07-13 | dev/backfill-write-busa-sf-both.mjs --apply (two atomic batches) | STAGING (write: 78 + 155 statements) | SUCCESS | VERIFIED
**Both BUSA League semifinals written — the last two matches held out of the `matches` table since session 41 pending real dates/scores, both now supplied directly by Richard.** Full BUSALYMPICS-parity stat capture from the already-parsed sheets (`dev/parsed-sheets/busa-sf-joga-hammers-JOGA.json`, `-HAMMERS FC.json`, `busa-lonesheets-KINGS.json`, `-PIRATES.json`), same convention as the other 8 completed matches. Round: `Semifinals` (matching the existing `Quarter Finals`/`Final` plural convention). Competition: `xm1OcBFeugKxLDHH6Xi6p`.
- **busa-sf-joga-hammers** — Joga-Bonito 1-0 Hammers FC, Sat 10 Jan 2026 4pm WAT. 59 events (Goal:1 McTee, Assist:1 Veronica, plus full stat spread). One real paired substitution (Jesse Uno "Zico" IN for Abdulrahman Ajibola "Hayjay" @23'). Hammers' own side near-zero sheet coverage (3 yellow cards only: Iyanu, Fuad, Gundi) — consistent with the sparse-opponent-sheet pattern seen on other matches, not fabricated.
- **busa-sf-kings-pirates** — Kings FC 2-0 Pirates FC, Fri 9 Jan 2026 4pm WAT. 125 events. **Correction applied per Richard, resolving session 41's "3rd, extra goal (Akinbode) not corroborated by either independent source" note**: the sheet's AKINBODE row (`goals:1`) is wrong — real breakdown is 2 goals (Animashaun, Kedem) + 1 assist (Akinbode, relabeled from the sheet's goal stat) + a missed penalty (Kedem, saved by Malcom/Pirates GK) that the original sheet mis-recorded as a 3rd goal. Written as two new standalone event types not previously used in any backfill: `Penalty Missed` (Kedem) and `Penalty Saved` (Malcom) — both already-valid types in `FootballLogger.tsx`/`LiveMatchTimeline.tsx`, just never exercised by a backfill script before. 5 clean lettered substitution pairs (A-E) resolved unambiguously from the sheet's own paired out/in markers. Pirates' own subs (3 players all marked `minuteIn: 47`, no distinguishing pairing data) deliberately **not** written — same "defer, don't fabricate" rule as every other ambiguous multi-player substitution window this project has hit.
- **Real bug caught mid-write**: first attempt used a fabricated player ID for the Kings sheet's unresolved "MICHEAL" entry (misremembered from an old session-41B journal note describing a *different* match's identity resolution) — caused a clean FK-constraint rollback on the whole Kings-Pirates batch (Joga-Hammers, a separate atomic batch, had already committed successfully and was unaffected). Richard confirmed the real identity directly: Michael Oguntola (`player-1767972272690-bjbpqarn5`, already has 3 prior real career events). Re-ran with the corrected ID — succeeded cleanly.
- Cumulative recompute sanity-checked before applying: several touched players (Sammy, Kedem, Animashun Oluwanifemi) show high pre-existing career totals — confirmed real via direct `match_events` history query, not a bug — all three are dual-affiliated BUSALYMPICS-college + BUSA-League-club athletes, same established pattern as Abdul-jabbaar Bello.
- Post-apply verification: both matches' `home_score`/`away_score`/`round`/`current_period` and full per-type event counts confirmed via direct `SELECT`, matching the dry-run exactly (59 and 125 events respectively).

2026-07-13 | dev/backfill-write-busa-match1.mjs --apply | STAGING (write: 27 statements) | SUCCESS | VERIFIED
**busa-match-1 (Joga-Bonito 7-0 Wolves FC, GW1) — first of the 20 group/QF matches newly unlocked by 6 files Richard shared** (`roaster.md`, `matchreport.md`/`2`/`3`/`4.md`, `matchscore.md`) plus 14 team-sheet CSVs (`dev/../teamsheet/*.csv`). Goals-only mode (no team logsheet exists for this match, FA report only). 15 events: 7 Goal, 5 Assist, 3 Yellow Card. **Goal list went through two corrections before writing**: (1) the original FA-PDF parse had McTee/Yanko's scorer-assist roles backwards, fixed against `matchreport2.md`'s structured JSON; (2) a real "FULL TIME" result graphic Richard shared directly then superseded even that JSON on 3 more points (Benjamin's and Aguero's goals are each unassisted, not as the JSON had them; two of Sammy's 3 goals carry real assists — Goodluck, Kenny — that the JSON omitted). Cards: Joga's #100 (Benjamin Adenuga) and #10 (Damola Akinola) — real, already-established players. Wolves' "Aaron Osuji" confirmed exact match at jersey #29 on `wolves.csv` — new stub created (Wolves had near-zero DB presence: only TOJU + 2 generic stubs from session 41B). Wolves' "Zubby" and "Dami" deliberately **not** written — Richard corrected the `wolves.csv` reading of Zubby=#100 as wrong with no alternative number given, and "Dami" #99 matches no player on the sheet at all; left unresolved rather than guessed.
- Verified by: post-apply `SELECT type, COUNT(*) FROM match_events WHERE match_id='busa-match-1' GROUP BY type` → Assist:5, Goal:7, Yellow Card:3 (15 total, matches dry-run exactly). Goal count (7) matches the 7-0 scoreline.
- Built `dev/busa-group-qf-goal-data-consolidated.md` organizing all 4 report files against the DB/canonical schedule — found this data actually unlocks 20 of the 21 remaining matches (everything except Deadline-Quantum), not just this one. Richard's call: proceed match-by-match with sign-off, same rhythm as every prior match.

2026-07-13 | dev/backfill-write-busa-sf-kp-subs.mjs --apply | STAGING (write: 5 statements) | SUCCESS | VERIFIED
**Resolved the Kings-Pirates SF's deferred Pirates substitutions** (3-way overlap at minute 47, no pairing data in the original Lone Sheets parse). Richard supplied the real pairing directly: Uzo IN for Ezekwe @47', Musiala IN for Eniola @47', Oplus IN for Jabbar @47' (by elimination — the only remaining pair once the two explicit ones are set), Courage IN for Vinchi @54' (corrected — sheet had Vinchi@57/Courage@54, timing didn't line up as a clean swap; Richard corrected both to 54'), Dotman IN for Rogers @60' (already a clean pair). 5 Substitution events added on top of the already-committed 125. **busa-sf-kings-pirates now has zero deferred items** — both BUSA League semifinals are fully closed.
- Guard bug caught before writing anything: first version of the abort-if-already-written check queried `WHERE type='Substitution'` with no team filter, which correctly found Kings' 5 pre-existing subs and aborted — fixed to `AND team_id='busa-pirates'` before re-running.
- Verified by: post-apply `SELECT minute, detail FROM match_events WHERE match_id='busa-sf-kings-pirates' AND type='Substitution' ORDER BY minute` → all 10 subs present (5 Kings @ minute -1, 5 Pirates @ 47/47/47/54/60), matching Richard's confirmed pairing exactly.

2026-07-13 | dev/backfill-write-busa-match2.mjs --apply | STAGING (write: 43 statements) | SUCCESS | VERIFIED
**busa-match-2 (Legacy FC 0-2 Agenda FC, GW1).** Goals-only mode, cards where they cleanly resolve. 14 events: 2 Goal, 1 Assist, 9 Yellow Card, 2 Red Card. First match needing brand-new identity resolution for two teams (Legacy already had 16 stub players from an earlier platform-wide batch; Agenda had only 3). Real jersey-number conflict found and deliberately NOT auto-corrected: `LEGACY.csv` gives Uzor's real number as 4 (currently held by the existing `MAVIN` stub) and #5 to a different, not-yet-created player (Blackish/Seun Olaiya) — the DB's existing `UZOR` stub is wrongly at #5. Richard's call: leave Uzor untouched, give Blackish no jersey number (`0`, the established NOT-NULL sentinel — hit and fixed the known `players.number` NOT NULL constraint mid-write, batch rolled back cleanly with zero partial writes before the retry). Legacy's #10, #23, and "Dara" cards matched nobody on the sheet — "Dara" cross-checked platform-wide and found to be an unrelated Basketball player (TBK), same cross-sport false-positive pattern seen repeatedly this project. Richard's call: profile all 3 as placeholder stubs rather than skip, so future matches can identify and merge them (same pattern as the earlier "Wolves #2" placeholder). Jamil (#6, Israel Ameh) written as a single straight Red Card — the report's "#6" yellow-list mention and "Jamil (Straight Red)" mention read as one double-referenced incident, not two separate cards, distinct from Mbk (#99), whose "Two yellows = Red" phrasing is explicitly a two-incident case (written as one Yellow + one Red). Agenda's "Justin" linked to an existing unassigned-pool player (no team, COLMANS college, zero conflicting affiliation) rather than a new stub — same pattern as Andrew/Enoch/PEDRI/AKANDE from prior sessions.
- Cumulative recompute sanity-checked: Alex (Agenda, existing #88 stub) shows 4 total assists after this match's 1 new one — verified real via direct `match_events` query, 3 prior assists from 2 BUSALYMPICS matches — another dual-affiliated college+club athlete, same established pattern, not a bug.
- Verified by: post-apply `SELECT type, COUNT(*) FROM match_events WHERE match_id='busa-match-2' GROUP BY type` → Assist:1, Goal:2, Red Card:2, Yellow Card:9 (14 total, matches dry-run exactly). Goal count (2) matches the 0-2 scoreline.

2026-07-13 | dev/fix-wolves2-identity.mjs --apply | STAGING (write: 1 UPDATE) | SUCCESS | VERIFIED
**Resolved the "Wolves #2" placeholder stub** (created during busa-match-11's write, session 41B, before Wolves had any real roster data) now that `wolves.csv` confirms jersey #2 = Oladipupo Martins, jersey name "Gabriel", RB, COLENG. Same player ID (`2qg_cbBzI8VeUrJ6qeDBx`) renamed in place — he already carries 1 real Yellow Card event from busa-match-11, untouched by the rename. No collision with the other existing "Gabriel" (a different, unrelated player on Kings FC).
- Verified by: post-update `SELECT` confirms `name="Oladipupo Martins"`, `jersey_name="Gabriel"`, same id/team/number as before.

2026-07-13 | dev/backfill-write-busa-match3.mjs --apply | STAGING (write: 32 statements) | SUCCESS | VERIFIED
**busa-match-3 (Allianz FC 1-1 La Fabrica, GW1).** 14 events: 2 Goal, 2 Assist, 6 Yellow Card, 4 Red Card. `ALLIANZ.csv` independently confirmed identical to `roaster.md`'s "Team 3 — Allianz" section — double-sourced, no discrepancies. La Fabrica has only the single CSV source. Card ambiguity resolved via two rounds of Richard confirmation: the original narrative note read as up to 4 straight reds for La Fabrica; Richard first clarified only 3 of the 4 mentioned players (#7 Jeje, #66 Jegede/TJ, #8 Pedri) are real double-yellow-reds, #10 (Khaliq) and #44 (Ire) are single yellows only; then a real FT result graphic showed TJ and El Motor (Allianz's own double-yellow case) with only a single red icon each (no yellow shown), prompting a second check — Richard confirmed directly that TJ, Pedri, and El Motor are all genuinely double-card despite the graphic's simplified single-icon display, no change from the first clarification. Allianz's Kante (#5, David Anagwu) linked from an existing unassigned-pool player — college (COLMANS) matched exactly on both sides. La Fabrica's Khaliq (#10), Ire (#44), and Pedri (#8) already existed from an earlier session's platform-wide stub batch (Pedri specifically already linked to La Fabrica during busa-match-10) — used directly, not re-created.
- Cumulative recompute sanity-checked: Pedri's existing stats (before this match's new events) already carry a real event from busa-match-10 — confirmed expected, not a bug.
- Verified by: post-apply `SELECT type, COUNT(*) FROM match_events WHERE match_id='busa-match-3' GROUP BY type` → Assist:2, Goal:2, Red Card:4, Yellow Card:6 (14 total, matches dry-run and the FT graphic exactly). Goal count (2) matches the 1-1 scoreline.

2026-07-13 | dev/backfill-write-busa-match4.mjs --apply | STAGING (write: 34 statements) | SUCCESS | VERIFIED
**busa-match-4 (Underrated FC 4-0 Quantum FC, GW1).** 9 events: 4 Goal, 1 Assist, 4 Yellow Card. Source: Richard directly, cross-checked against `UNDERRATED.csv`/`QUANTUM.csv`. **Also bundled 6 profile fixes for existing session-41 platform-wide stub players, per Richard's explicit "update the profiles also"** — not just jersey numbers (Effiong 0→10, Abdulkabir 0→42, Otis 0→66, Akande 0→49, TJ 0→11, Quantum's Boluwatife 0→7) but full names too (e.g. "Effiong"→"Effiong Uduak", "Otis"→"Israel Otis"), plus position and college, matching the fuller "Wolves #2"→"Oladipupo Martins" precedent rather than a numbers-only fix. Both the `players` row and the specific club-scoped `player_team_affiliations` row were updated (college-scoped affiliation rows for the same players left untouched, per the established per-affiliation jersey_number rule). Quantum's existing "Boluwatife" stub turned out to already be this match's own #7 card-holder — used directly instead of creating a duplicate new stub. Two new stubs created: David Olapade (Underrated #44) and Al ameen Badmus (Underrated #17 — confirmed a different person from the existing "Al Ameen" #11 on Prime FC before ruling out a link) and Oluwaseyi Koko (Quantum #5 — confirmed different from Joga's existing "Koko"/Emmanuel Ekpenyong #70).
- Cumulative recompute sanity-checked: Boluwatife (1 prior goal from busa-match-12) and Maleek (3 interceptions + 2 shots off target from busa-match-14) both verified real via direct `match_events` history query — both teams already played one other already-completed match this project.
- Verified by: post-apply `SELECT type, COUNT(*) FROM match_events WHERE match_id='busa-match-4' GROUP BY type` → Assist:1, Goal:4, Yellow Card:4 (9 total, matches dry-run exactly). Goal count (4) matches the 4-0 scoreline. Profile fixes verified via direct `SELECT id, name, number` — all 6 show corrected full names and numbers.

2026-07-13 | dev/backfill-write-busa-match5.mjs --apply | STAGING (write: 23 statements) | SUCCESS | VERIFIED
**busa-match-5 (Kings FC 2-0 Hammers, GW1).** 11 events: 2 Goal, 2 Assist, 7 Yellow Card. **A real FT graphic Richard shared initially looked authoritative (as it correctly was for matches 1 and 3) but this time under-reported — only showed 2 of the real 7 cards.** The FA report (`Match Report Kings FC v Hammers.pdf`) had the fuller picture once its own goal/card jumbling was reconciled against the 2-0 scoreline (same parser artifact as match-1): 2 real goals, both assisted (Mayokun→Kedem's, Ola-praise→Kedem's own), 7 real cards (Kings: Osaro, Posi; Hammers: A.jay, Sancho, an unresolved #47, Charles, Spectrum). Richard confirmed the fuller version directly. "Mayor" reconfirmed as Mayokun Mayokun (#9) — already had "Mayor" recorded as a nickname from a prior session, not a new player; a same-name Pirates FC player was checked and ruled out (different club, different person). Hammers' #47 matches nobody on the roster or team sheet — profiled as a placeholder stub.
- **Real bug caught before writing**: fabricated "Ola-praise Abadoni"'s ID as `busa-kings-player-88` by false analogy to other Kings IDs (`busa-kings-player-10`, etc.) instead of querying for it — caused a clean FK-rollback (2nd time this exact mistake happened this session, after "MICHEAL" in the Kings-Pirates SF write). Richard named it directly as a pattern to stop: "you stop faking id without acc confirming them... always use db as source of truth." Fixed by querying for his real id (`player-1767972271817-0e46tfrjs`), then re-verified all 9 IDs in the script against a live query before re-running, not just the one that broke.
- Verified by: post-apply `SELECT type, COUNT(*) FROM match_events WHERE match_id='busa-match-5' GROUP BY type` → Assist:2, Goal:2, Yellow Card:7 (11 total, matches dry-run exactly). Goal count (2) matches the 2-0 scoreline.

2026-07-13 | dev/backfill-write-busa-match6.mjs --apply | STAGING (write: 32 statements) | SUCCESS | VERIFIED
**busa-match-6 (Westbridge 2-3 Prime FC, GW1) — the last GW1 match, closing out the full gameweek.** 11 events: 5 Goal, 2 Assist, 3 Yellow Card, 1 Red Card. Source: Richard directly, cross-checked against `PRIME.csv` (Westbridge has zero team sheet in this batch and zero prior DB roster). Real jersey #10 collision on `PRIME.csv` itself (both Mohammed Musa and Enoch Onyanyem listed at #10) — resolved per Richard: #10 is Enoch (matches the FA sheet); Mohammed's real matchday number is #70, corroborated by 2 independent match-report-style sources, the CSV's own #10 entry for him is the error. Existing Prime FC stubs fixed in place, full names not just numbers (per Richard's explicit "update their full names also"): Enoch's number 0→10 plus name "Enoch"→"Enoch Onyanyem"; Val-Verde's name "VAL-VERDE"→"Ugochukwu Ifeanyichukwu" (jersey_name kept as the nickname on both). New stubs: Mohammed Musa (Prime #70), Benjamin Ojeyemi/"OMO IGBO" (Prime #69, double-yellow-red), and 3 Westbridge players with no known numbers (Sule Banti, Samuel, Natty) — Westbridge remains the one team in this project with zero real roster data beyond names mentioned in match reports.
- Verified by: post-apply `SELECT type, COUNT(*) FROM match_events WHERE match_id='busa-match-6' GROUP BY type` → Assist:2, Goal:5, Red Card:1, Yellow Card:3 (11 total, matches dry-run exactly). Goal count (5) matches the 2-3 scoreline (2 Westbridge + 3 Prime). Full-name fixes verified via direct `SELECT` — both show corrected names.
- **GW1 complete: all 6 matches (busa-match-1 through -6) now applied and DB-verified.** (Correction: GW1 actually has 7 matches, not 6 — busa-match-7/Cruise-Santos also belongs to GW1, missed initially. Resuming with it next.)

2026-07-13 | dev/fix-stale-seeded-stats.mjs --apply | STAGING (write: 1 UPDATE, 14 rows) | SUCCESS | VERIFIED
**BUG-105 — 14 already-backfilled matches were showing fake, stale stats on their public Stats tab despite having real `match_events`.** Found while investigating busa-match-7's pre-existing `stats` column at Richard's prompt ("check where those stats emerged from"). Root cause: matches were seeded at initial DB creation with a non-empty but algorithmically-fake `stats` JSON blob (giveaway: possession like `56.667927829149534%`). `src/app/api/matches/[id]/route.ts:251-252`'s `statsEmpty` guard only recomputes from real `match_events` when `stats` is null/`{}` — never fires for a non-empty fake blob. Confirmed directly: busa-match-13's `stats` said `yellowCards:[0,0]` while 98 real events (6 real Yellow Cards) sat unused underneath. `UPDATE matches SET stats = NULL WHERE id IN (...)` for all 14 affected rows (busa-match-1 through -6, -10 through -16 except the 2 SFs, -final-2026) — the SFs were unaffected since they're fresh inserts this session with no `stats` value at all. No code change needed; existing guard now correctly recomputes on next read.
- Verified by: pre-flight query confirmed exactly 14 affected rows platform-wide; post-apply query confirms 0 remaining.
- **Action item for every future match-write script**: also clear `stats` to NULL for any pre-existing match row being backfilled, or this bug recurs per-match going forward.

2026-07-13 | dev/backfill-write-busa-match7.mjs --apply | STAGING (write: 46 statements) | SUCCESS | VERIFIED
**busa-match-7 (Cruise FC 4-2 Santos, GW1) — actually the true last GW1 match** (a correction: GW1 has 7 matches, not 6 — Richard caught that I'd claimed GW1 complete after match-6, missing this one). 20 events: 6 Goal, 4 Assist, 8 Yellow Card, 2 Red Card. Cruise's own logsheet has zero jersey numbers on record (same known limitation as busa-match-13) — reconciled a real FT graphic against Richard's fuller text data: Tumi = #100 (Penalty + Yellow Card combo matches his busa-match-13 sheet row exactly), Evo = #19 (direct name match, 2 goals), Ife = new player (#21, not on the busa-match-13 roster — plausible, not every player appears in every match), Seyi (existing player) credited the #2 assist per the graphic's boot icon; the #30 assist (Evo's 2nd goal) and 2 cards (#5, "Wahab") have no name anywhere — profiled as placeholder stubs rather than guessed. The coach's card ("Tupac") was NOT written — not a player. Santos side: used the graphic to confirm scorers (Paul, Charles) and one assist (Taiwo→Charles), but the FULL text card list (6 total — GK #1, Paul, Elijah, Charles, Taiwo, Rolex's double-yellow-red) was used over the graphic's simplified single-icon display, same "text has the complete picture" pattern already confirmed in busa-match-5. Santos' GK (#1) matches nobody on the established roster — profiled as a placeholder.
- Also cleared this match's stale seeded `stats` column (BUG-105) as part of the same batch, since it's a pre-existing match row.
- Verified by: post-apply `SELECT type, COUNT(*) FROM match_events WHERE match_id='busa-match-7' GROUP BY type` → Assist:4, Goal:6, Red Card:2, Yellow Card:8 (20 total, matches dry-run exactly). Goal count (6: 4 Cruise + 2 Santos) matches the 4-2 scoreline.
- **GW1 is now genuinely fully complete: all 7 matches (busa-match-1 through -7) applied and DB-verified.**

2026-07-13 | dev/check-match-blob-sizes.mjs (read-only) | STAGING (0 rows affected — SELECT only) | SUCCESS | VERIFIED
**BUG-107 payload-reduction sanity check.** Confirmed `matches.lineups` for `8Mek2CA7KPlnk1EQ647jx` is 6,482 bytes — this blob was previously spread in full into every assigned-match entry in `GET /api/loggers` and `GET /api/loggers/[id]` responses (via `getLoggerMatches()` and the inline join in `route.ts`) before both were narrowed to 9 named columns. Also surfaced: this same match id appeared twice in one logger's `assignedMatches` in a pre-fix response (duplicate active `matchLoggerAssignments` row) — filed as a small follow-up, not yet investigated further.

2026-07-13 | dev/backfill-write-busa-match17.mjs --apply | STAGING (write: 27 statements) | SUCCESS | VERIFIED
**busa-match-17 (Pirates FC 10-0 Deadline FC) — the GW1 fixture ("Group D" pairing) that session 41D's "GW1 complete" claim almost skipped, rescheduled in-tournament to Nov 21.** Goals-only mode: no team logsheet exists for this match, only `matchreport3.md`'s compact scorer list (10 goal-lines, matching the 10-0 scoreline exactly) from `dev/busa-group-qf-goal-data-consolidated.md`'s Round 17 section. All 10 scorers/assisters resolved cleanly against the already-established Pirates roster with zero new identity work — including "Neto" (Netochukwu Mba, #19, confirmed via platform-wide name search, distinct from Ilyas Lawal-Okunuga #29 who scored the final goal). No card data exists for this match anywhere in the source files. Deadline FC (0 side of the scoreline) untouched.
- Also cleared this match's stale seeded `stats` column (BUG-105) as part of the same batch — confirmed present with the same absurd-decimal-precision signature (`possession: [42.4677..., 57.9105...]`) as the other 14 affected matches, now `null`, verified post-apply.
- Verified by: post-apply `SELECT type, COUNT(*) FROM match_events WHERE match_id='busa-match-17' GROUP BY type` → Assist:6, Goal:10 (16 total, matches dry-run exactly). Goal count (10) matches the 10-0 scoreline.

2026-07-13 | dev/backfill-write-busa-match17-deadline-cards.mjs --apply | STAGING (write: 10 statements) | SUCCESS | VERIFIED
**busa-match-17 follow-up — Deadline FC cards.** The original write above was goals-only (no card data existed in any source file at the time). Richard supplied it directly afterward: Yellow Card × 2 (Osas, Ladi), Red Card × 1 (Wisdom). Wisdom already existed on Deadline's roster; Osas and Ladi checked platform-wide (not found) before creating new stubs — a "Ladi" hit on Wolves FC (Oladipupo Martins/"Gabriel") was a coincidental substring match, not this player, correctly ruled out. busa-match-17 now has 19 total events (10 Goal, 6 Assist, 2 Yellow Card, 1 Red Card).
- Verified by: post-apply `SELECT type, COUNT(*) FROM match_events WHERE match_id='busa-match-17' GROUP BY type` → matches expected.

2026-07-13 | dev/backfill-write-busa-match8.mjs --apply | STAGING (write: 11 statements) | SUCCESS | VERIFIED
**busa-match-8 (Allianz FC 1-1 Agenda FC, GW2) — closes GW2 together with busa-match-9 below.** Goals-only mode. Allianz: Ibrahim Muhammad "EL MOTOR" #7 scored a Penalty (already an established player, same one confirmed in busa-match-3). Agenda: Waris Hassan "Wareez" #9 scored, assisted by Alex.
- **Real process gap caught mid-match, corrected before finishing**: initially treated Allianz's carded "#6" and Agenda's assisting "#8" as unresolved (checked DB roster + platform-wide name/jersey search only) and profiled both as placeholder stubs. Richard corrected: real team-sheet CSVs exist locally at `C:\Users\Wise\Downloads\BRIXSPORT\BUSA LEAGUE\teamsheet\` (14 files, one per BUSA League team) — never checked this session before falling back to stubs, wrongly assumed the CSVs from earlier sessions were ephemeral/no longer available. Checking `ALLIANZ.csv` and `AGENDA.csv` directly resolved both: #6 is real (Jeremiah Osuya, "Big shalli", CB, COLENG — not absent from the roster, just never checked against the source), and the Agenda "#8" assist is actually Alex, whose established DB record already existed but with the **wrong club-scoped jersey number (88, corrected to 8 per the CSV)** — not a college-number mix-up as first guessed; his COLNAS affiliation row has no number set at all, the 88 was sitting directly on the club (Agenda) row itself.
- **Corrective fixes applied same session** (`dev/fix-match8-identities.mjs --apply`): renamed the Allianz #6 stub in place to Jeremiah Osuya (same pattern as the earlier Wolves #2 fix — player id unchanged, so the already-written Yellow Card event stayed correctly attributed); corrected Alex's `players.number` and his `busa-agenda` affiliation's `jersey_number` from 88 to 8 (his busa-match-8 Assist event already correctly referenced his player id, no event change needed).
- **Process rule for the rest of this backfill**: always check `C:\Users\Wise\Downloads\BRIXSPORT\BUSA LEAGUE\teamsheet\*.csv` for the relevant team(s) before creating any placeholder stub or accepting an existing DB jersey number at face value — confirmed this session that this directory is real and current, not a one-time ephemeral share.
- Also cleared this match's stale seeded `stats` column (BUG-105) as part of the same batch.
- Verified by: post-apply `SELECT type, COUNT(*) FROM match_events WHERE match_id='busa-match-8' GROUP BY type` → Assist:1, Goal:1, Penalty:1, Yellow Card:1 (4 total). Goal count (2, Goal+Penalty) matches the 1-1 scoreline.

2026-07-13 | dev/backfill-write-busa-match9.mjs --apply | STAGING (write: 30 statements) | SUCCESS | VERIFIED
**busa-match-9 (Joga-Bonito 4-0 Westbridge, GW2) — GW2 now fully closed (busa-match-8 and -9 were the only two GW2 fixtures still open; -10 through -16 were already done from earlier sessions).** All 4 Joga goals/assists and both Joga cards (#100 Benjamin, #24 Puyoo) resolved cleanly against the already-established roster, zero new identity work on that side.
- **Westbridge's 3 card mentions (#2, #15, #77), originally flagged in the source doc as unconfirmed, were confirmed by Richard directly as real Yellow Cards.** Checked `WESTBRIDGE.csv` (per the process rule established in the busa-match-8 entry above) to resolve numbers: #15 = Uthman Adeyemi "MIDNIGHT" (real, new stub), #77 = Nathaniel Adelekan (real, new stub), #2 = genuinely absent from the sheet after checking every row (numbers present: 1,5,9,10,11,15,16,17,21,22,23,24,25,30,45,66,69,77 — no 2 anywhere) — a real placeholder stub, not a lookup miss. Westbridge's existing 3 DB entries (Sule Banti, Samuel, Natty, all jersey 0) are unrelated, different players entirely.
- Also cleared this match's stale seeded `stats` column (BUG-105) as part of the same batch.
- Verified by: post-apply `SELECT type, COUNT(*) FROM match_events WHERE match_id='busa-match-9' GROUP BY type` → Assist:4, Goal:4, Yellow Card:5 (13 total). Goal count (4) matches the 4-0 scoreline.

2026-07-13 | dev/fix-westbridge2-identity.mjs --apply | STAGING (write: 1 UPDATE) | SUCCESS | VERIFIED
**busa-match-9 follow-up — "Westbridge #2" stub resolved.** Richard supplied a real Westbridge starting-lineup graphic for this specific match confirming #2 = Matthew. Renamed the existing stub in place (same pattern as the Allianz #6 fix) — player id unchanged, so the already-written Yellow Card event stayed correctly attributed. Worth noting for future matches: this graphic's numbering only partially overlapped `WESTBRIDGE.csv` (Smart #5, Lavenda/Lavender #69, Fuad #17, Natty/Nathaniel #77 all matched; #2 Matthew, #11 Distro, #7 Rhino, #8 Leo, #6 Banti, #1 Chike, #88 Samuel did not appear on the CSV at all or conflicted with it) — the CSV may be a stale/incomplete roster relative to real matchday squads for this team. Only #2 was corrected here since that's the only number this match's cards needed; the rest of the roster was not spec­ulatively reconciled.
- Verified by: post-update `SELECT` confirms `name="Matthew"`, `jersey_name="Matthew"`, same id/team/number as before.

2026-07-13 | dev/gw2-identity-surgery.mjs --apply | STAGING (write: 6 statements) | SUCCESS | VERIFIED
**GW2 roster cleanup, batch 1 (higher-risk: merge + cross-team reassignment).** Richard supplied 5 real starting-lineup graphics (Prime, Quantum, Santos, La Fabrica, Underrated) plus pointed at the full local teamsheet CSV set to cross-check busa-match-10 through -15's already-seeded rosters. Two real identity problems surfaced:
- **Merge: Underrated's duplicate "Chris" (`#0`, no surname) into "O.C" (`#4`).** `UNDERRATED.csv` row 13 confirms "Omadime, Christian, O.C, CB, 4, COLENG" — O.C and Chris are the same real person, not two players. Chris had 4 real COLENG (BUSALYMPICS) events as `player_id` and — caught only on a first failed attempt — 1 more as `related_player_id` (the outgoing side of a Substitution pairing). First apply attempt hit a clean `SQLITE_CONSTRAINT: FOREIGN KEY` rollback for missing that second column; re-verified against every FK-bearing table in the schema (`transfers`, `registered_players`, all `fpl_*` tables) before re-running — all zero. Second attempt succeeded: both columns reassigned, then Chris's affiliation + player rows deleted. O.C's total event references: 13 post-merge.
- **Reassign: Agenda's "Smart" (`#0`) is actually a Westbridge player.** `WESTBRIDGE.csv` row 4 "Smart-Alli, Abdulwahab, SMART, CB, 5, COLNAS" matches his existing COLNAS college affiliation exactly (his 10 real events are all COLNAS-scoped BUSALYMPICS events, untouched by this club-level move). Moved his club affiliation from `busa-agenda` to `busa-westbridge`, name set to "Abdulwahab Smart-Alli", number `0` → `5`. Verified no pre-existing Westbridge affiliation row before the move (would have collided).
- Verified by: post-apply `SELECT` confirms Chris's player row is gone (0 remaining), O.C's combined event-reference count is 13, Smart's record shows `team_id='busa-westbridge'`, `number=5`.

2026-07-13 | dev/gw2-routine-additions.mjs --apply | STAGING (write: 30 statements) | SUCCESS | VERIFIED
**GW2 roster cleanup, batch 2 (lower-risk: plain updates + inserts, no deletes/cross-references).** Same graphics/CSV cross-check as batch 1 above.
- **4 number fixes on existing players**: Quantum's Adam (`null` → `35`), La Fabrica's Khaliq (`10` → `2`), Pedri (`null` → `8`), Wale (`null` → `11`) — all confirmed via the real lineup graphics, none conflicting with any other player already on that number for their team.
- **11 new player profiles seeded proactively, no events yet** — per Richard's explicit request, so a future match doesn't require re-resolving the same identity from scratch. 9 for Quantum FC (Sunkanmi Mohammed "SK" #6, Inumidun Odedeyi #1, Abraham Odifa "TINO" #25, Fortune Omadime #31, Akanprice Maurice #12, Jireh Obibia-bisong #19, Ahmad Tariq Ndayako #17, Khalid Yusuf #77, Giwa Abdulfatai "Fatai" #21), 2 for Prime FC (Afolabi Adetayo "Afoo" #420, Olasunkanmi Ajayi "Ola" #1, GK). **Two of these deliberately correct the lineup graphic against the real CSV rather than trust the graphic at face value**: the Quantum graphic showed "SK" at `#5` and "Inumidun" at `#90` — `QUANTUM.csv` rows 7 and 2 show `#5` is unambiguously Koko (already correctly established in the DB, matches both CSV and prior session data) and Inumidun's real number is `#1`; SK's real number is `#6` (CSV row 11). Prime's "420 — AFOO" was double-checked against `PRIME.csv` row 15 and confirmed as a real (if unusual) jersey number for a real, different person from Pirates' own "AFOO" (Muiz Kazeem) — not a graphic rendering glitch as first suspected.
- **Deliberately not touched**: Prime's existing "ROQEEB" (`#17`) — `PRIME.csv` itself has an internal collision, listing both Roqeeb and a separate player "Shadow" at `#19`, so the sheet doesn't cleanly resolve which of Roqeeb's two possible numbers (`17` or `19`) is real. Left the existing DB value alone rather than guess between two ambiguous CSV mentions.
- Verified by: post-apply `SELECT` on the 4 fixed players confirms new numbers; Quantum roster size 3→12, Prime roster size 11→13, matching the exact counts expected from the inserts.

2026-07-13 | dev/fix-oc-nicknames.mjs --apply | STAGING (write: 2 statements) | SUCCESS | VERIFIED
**O.C nickname + missing college affiliation follow-up, from the Chris merge above.** Added "Chris" as a nickname on O.C's existing club affiliation (`busa-underrated`), and created a College of Engineering (COLENG) affiliation row that didn't previously exist for him — his 4 merged events are all COLENG-tagged (BUSALYMPICS), but the original Chris→O.C merge deleted Chris's `player_team_affiliations` rows by `player_id` without individually inspecting each one first, so if Chris had a college-scoped row it wasn't reassigned, only discarded. Named plainly rather than glossed over: exact prior content (if any) isn't recoverable. Not judged to be a real loss — `UNDERRATED.csv` doesn't record a separate college jersey number for him, and his events reference `player_id` directly so nothing downstream depends on the affiliation row itself. New COLENG row created with `nicknames: ["Chris"]`, no jersey number (consistent with how other players' college-scoped rows are recorded in this project, e.g. Alex's COLNAS row).
- Verified by: post-apply `SELECT` shows both affiliation rows (`busa-underrated` and COLENG) with `nicknames: ["Chris"]`.

2026-07-13 | live match test on staging (match G4er-Gc0_E1xo8_BgvyIQ, Kings FC vs COLNAS) | STAGING (read-only monitoring + live DB spot-checks) | SUCCESS | VERIFIED
**Live clock/real-time investigation, closing out the Live Clock v2 decision from earlier this session.** Richard ran a real match through the logger (mobile, real device) while Claude watched the public match page independently via browser pane + direct DB queries — the live test that had been deferred multiple times earlier in the session in favor of the auth/backfill work. Three scenarios tested in sequence, each with clean before/after evidence:

**Scenario 1 — logger goes genuinely offline (DevTools throttle set to Offline), events pushed, network restored.** Offline-queue system (BACKLOG-058) worked correctly: events queued locally, Service Worker background sync (`sw-admin.js:184`) correctly drained the queue and persisted to the DB once the network returned (confirmed via direct DB query — both events present with correct data). **But neither of two independent public viewers ever received a live push for those events** — no visible error, no disconnect, the socket simply never delivered `event:new` for them. A full page reload immediately showed both correctly. Traced to root cause: `POST /api/matches/[id]/events` has zero WS emit calls anywhere in it — the live broadcast is triggered client-side only, from `FootballLogger.tsx:701`'s `emit('event:log', ...)`, a separate uncoordinated step from the DB persist. The Service Worker has no socket connection, so any event synced via the offline queue can never trigger a live broadcast, by construction. Filed as **BUG-108** (CRITICAL).

**Scenario 2 — live event pushed with the logger's socket confirmed disconnected (mid-session, non-offline network blip).** Reproduced the exact same gap live, this time with direct console confirmation of the mechanism: `[FootballLogger] Socket NOT connected for match G4er-Gc0_E1xo8_BgvyIQ, skipping event:log emit`. Events kept landing correctly in the DB (confirmed via query) while the public page's clock header stayed frozen. Investigating why the header specifically (not just the Timeline) never recovers led to the session's biggest finding: `matches` table schema has no `minute` column at all, and `GET /api/matches/[id]` computes no clock value anywhere in its response — the numeric clock displayed to viewers exists *exclusively* as long as the WS tick keeps arriving, with zero DB-persisted fallback of any kind. A page refresh correctly repopulated the Timeline (each event renders from its own `minute` field) but did not move the clock header at all — direct proof this isn't a caching issue, it's the total absence of a fallback value. This is the actual root cause of the "freezes, no recovery, network back doesn't retime it" symptom that motivated the entire Live Clock v2 investigation earlier this session — now reproduced live rather than inferred from code. Filed as **BUG-109** (CRITICAL) — supersedes the "ship the trimmed subset" clock decision reached earlier the same session, since none of those three fixes (SUSPENDED stop, single-writer, WS auth) touch this at all.

**Scenario 3 — Railway WS server killed outright (confirmed via Railway dashboard: "Service is offline"), held down for an extended period, events pushed throughout.** Clean disconnect detected (`[WS] Disconnected: transport close`), correct reconnection attempts (1-5), correctly hit "Max reconnection attempts reached. Waiting for server..." without the old disconnect()-kills-reconnect bug recurring. Direct DOM inspection during the outage found a second gap: the public page's `isStale`/degraded-state dimming is not applied anywhere on the actual clock render (`opacity: 1`, zero stale/reconnect text) — BUG-080's one-shot disconnect toast fired correctly, but nothing persists after it fades, so a viewer gets one brief notice then total silence with a normal-looking clock for the rest of the outage. Filed as **BUG-111** (HIGH). Separately confirmed BUG-080's polling fallback *is* working correctly and silently — an untouched, passive browser tab picked up 5 new Timeline events entirely on its own via repeated `GET /api/matches/[id]` polls (confirmed in the network log) with Railway fully down the whole time — but the same poll response has nothing for the clock to read (same root cause as BUG-109), so events self-heal while the clock stays permanently stuck. Also found, via source inspection rather than live reproduction: the logger's own prominent connection-status pill (`FootballLogger.tsx:1453-1455`) is driven entirely by `isSocketConnected`, conflating "WebSocket down" with "offline" even though a more accurate `isConnected` (true network) signal already exists elsewhere in the same component — misleading the logger into thinking their data isn't saving during exactly this scenario, when it demonstrably still was. Filed as **BUG-112** (MEDIUM).

**Net effect on this session's earlier clock decision**: the "ship the trimmed subset now, defer the full smoothing model" call from earlier is superseded, not just refined — BUG-109 is upstream of everything the original Live Clock v2 design doc was scoped to address. Next actual directive needs fresh scoping against BUG-108/109/111/112/113 together, not against the original design doc as written.

**BUG-113 (polling flicker) filed after the fact** — Richard directly observed the 10s polling fallback causing a visible full-page flicker/silent-reload feel rather than a smooth update, distinct from a genuine WS push. Traced to `fetchMatchData(true)` doing a wholesale `setMatchData(data)` replace on every poll tick versus the WS handler's surgical single-item prepend.

**Railway restored** — confirmed the shared-instance risk this whole outage carried is real, not theoretical (BUG-074): the Railway project restarted was labeled `production` (`brixsports-production-8fa3...`), the same single service BUG-074 already documented as serving both staging and prod. This entire test window took down real-time delivery for both environments simultaneously — acceptable given Richard's earlier confirmation that prod has no live match running right now, but a direct, live demonstration of BUG-074's severity rather than a hypothetical.

**Reconnection confirmed working** on a fresh page load — new WS connection succeeded immediately once Railway was back (`[WS] Connected`). One more manifestation of BUG-109's root cause caught in the process: on a genuinely fresh session with no live tick received yet, the clock rendered as a bare pulsing dot with no minute text at all (both `matchTime` and `match.minute` empty) — added as an addendum to the BUG-109 entry rather than filed separately, since it's the same missing-fallback cause producing a second visible symptom (blank vs. frozen, depending on timing).

**Filed BUG-114 (CRITICAL) after Richard reported his own already-open tab — left untouched through the entire outage — never reconnected on its own, well after Railway confirmed back online.** Requested and reviewed the full console transcript directly rather than concluding from a summary: all 5 `connect_error` attempts logged with `wss://brixsports-production-8fa3.up.railway.app/api/socket/...` handshake 404s (same URL, independently reconfirming BUG-074 live), then `[WS] Max reconnection attempts reached`, then genuinely nothing WS-related ever again. While reviewing this transcript, found a separate, concrete bug in `useWebSocket.tsx:95-103`'s own reconnection logging: the `connect_error` handler only logs `'Max reconnection attempts reached'` for `reconnectAttempts === 5` (strict equality, not `>= 5`), meaning every attempt after the 5th is silently unlogged forever — so "nothing happened after attempt 5" in the console is provably ambiguous, not proof that Socket.IO's reconnection engine itself gave up. Root cause narrowed to two candidate explanations (Socket.IO's `reconnect_failed` genuinely never firing after a full server-process restart vs. firing but hidden by this same logging gap) but not fully confirmed — noted honestly in the BACKLOG-114 entry rather than overclaiming a definitive root cause from ambiguous evidence.

2026-07-14 | dev/add-match-clock-columns.mjs --apply | STAGING (schema: 2 ALTER TABLE) | SUCCESS | VERIFIED
**BUG-109 fix, step 1 — schema migration.** Added `minute` and `extra_time` (both nullable INTEGER) to `matches`, confirming the session-42 live-test finding that the table had no persisted clock at all. Additive only, no backfill, no existing rows touched — pre-flight dry run confirmed target host (`brixsportsv2-staging-brixsports.aws-eu-west-1.turso.io`, genuinely staging, not prod) and the exact two `ALTER TABLE` statements before `--apply` was run. `src/db/schema.ts`'s `matches` table updated to match (Drizzle `minute`/`extraTime` fields added).
- Verified by: post-apply `PRAGMA table_info(matches)` re-check inside the same script confirms both columns present.
- Next: write path (`PATCH /api/matches/[id]`, throttled client-side checkpoint from `FootballLogger.tsx`) and the `isStale`-aware read priority fix on the public match page — schema alone doesn't close BUG-109 yet, nothing writes to these columns until that lands.

2026-07-14 | live match test on staging (match G4er-Gc0_E1xo8_BgvyIQ, Kings FC vs COLNAS) | STAGING (real logger session + independent browser-pane viewer + direct DB queries) | SUCCESS | VERIFIED
**BUG-109 fix verification — session 43.** Richard drove a real logger session on mobile/desktop while Claude watched independently via the Browser pane (viewer tab) and direct DB queries (`dev/gen-admin-test-token.mjs` for short-lived admin tokens). First pass hit a stale-bundle false negative: Richard's logger tab was still running an older deployed chunk (`page-c7ceca15da772407.js`) from before the fix landed — confirmed by diffing against the actual current chunk hash (`page-fd63f889e45982d2.js`) fetched fresh from staging; a hard refresh picked up the real build and checkpoints started landing.
- **Cold load (no live tick yet)**: DB-persisted minute rendered correctly (`23'`) on a completely fresh page load with zero WS connection — confirmed via screenshot, no console errors.
- **Stale tab (WS dies mid-session)**: real Railway kill, tab's WS disconnected (`transport close`, reconnect attempts 1-5 exhausted), clock frozen at `16'`. Over ~15s the displayed minute self-healed to `19'` via the existing 10s poll (BUG-080) picking up fresh checkpoints — confirmed those checkpoints kept landing throughout the outage via direct DB polls (`minute: 18` at T+6s), since the checkpoint PATCH goes straight to Vercel, independent of Railway. This was the one BUG-109 reproduction that couldn't be safely faked and needed a real session — now confirmed fixed.
- **WS reconnect instability observed** (didn't fully stabilize this run, matches known BUG-114, not a regression) — clock kept advancing correctly via the poll regardless (`19' → 20' → 21'`), proving the DB fallback holds up even when the WS layer itself doesn't recover.
- **New bug found and filed (BUG-115, CRITICAL, not fixed)**: mid-test, a hard refresh + re-login sequence caused the match's `currentPeriod` to regress from `SECOND_HALF` back to `FIRST_HALF` — root-caused via a HAR export (parsed with the new `dev/parse-har-auth-match.mjs`, kept for reuse) to `getMatchStateManager()`'s module-level singleton registry silently ignoring the DB-seeded period whenever a manager instance already exists in memory. Confirmed not caused by the BUG-109 diff (different files entirely, regression PATCHes are pre-existing start/resume-match code). Full detail in `BACKLOG.md` BUG-115.
- Verified by: direct DB queries at each step (`dev/gen-admin-test-token.mjs` + curl against `GET /api/matches/G4er-Gc0_E1xo8_BgvyIQ`), Browser pane screenshots and console logs, HAR analysis for the BUG-115 timeline.
- Test match (`G4er-Gc0_E1xo8_BgvyIQ`) left live/in-progress at session end per the real test session in progress — not reset, since Richard was actively using it.

2026-07-14 | dev/add-match-clock-columns.mjs --env=.env.production --apply | PROD (schema: 2 ALTER TABLE) | SUCCESS | VERIFIED
**BUG-109 fix, step 2 — prod schema migration.** Same additive `minute`/`extra_time` (nullable INTEGER) columns applied to prod's `matches` table, now that staging verification (live-tested, see entry above) is complete — per project rule (staging first, then prod). Script extended with a `--env=<file>` flag for reuse. Pre-flight dry run confirmed target host (`brixsportv2-brixsports.aws-eu-west-1.turso.io`, genuinely prod, distinct from staging's `brixsportsv2-staging-brixsports...`) and the exact two `ALTER TABLE` statements before `--apply`.
- Verified by: post-apply `PRAGMA table_info(matches)` re-check inside the same script confirms both columns present.
- Code (BUG-109 fix) is on `dev`, not yet merged to `main` — this migration only unblocks a future prod deploy from erroring on missing columns; it doesn't itself activate the fix in prod.

2026-07-15 | direct POST /broadcast test against Railway ws-server (before/after WS_API_KEY added) | STAGING/RAILWAY (no DB write, HTTP auth check only) | SUCCESS | VERIFIED
**BUG-108/116 root-cause isolation, session 43 continued post-wrap.** Called `POST https://brixsports-production-8fa3.up.railway.app/broadcast` directly via curl, bypassing the whole Next.js app, using the `WS_API_KEY` value from `.env.local` (`x-api-key` header) — confirmed `401 {"error":"Unauthorized"}`, proving Railway's `ws-server` service genuinely had no matching key configured (not just inferred from the earlier "0 Variables" dashboard observation). Richard added `WS_API_KEY` to the Railway service's environment variables. Identical curl retested immediately after: `200 {"success":true}` — confirms Railway's side of the auth check is now correctly configured for that key value.
- **Full chain still not confirmed working**: redid the live test through the real app (`dev/gen-logger-test-token.mjs` + `POST /api/matches/[id]/events`, connected viewer tab watching the Timeline) — DB write succeeded (`201`-equivalent success response), but the event did not appear on the viewer's Timeline. Since the isolated direct test only proves Railway accepts *that specific* key value (the one sitting in the local `.env.local` file), and the real app's broadcast call uses whatever `WS_API_KEY` is actually configured in **Vercel's own dashboard** (not necessarily identical to the local file), this narrows the remaining gap to: has Vercel's actual configured value been confirmed to match what's now in Railway? Not yet checked.
- Next step: compare Vercel staging project's real `WS_API_KEY` (dashboard, not local file) against Railway's newly-added value; fix and redeploy if they differ; then redo both the isolated direct-POST test and the full live viewer-tab test — only the latter closes BUG-108/116.

2026-07-15 | dev/test-live-broadcast-post.mjs (x3) + dev/cleanup-broadcast-test-event.mjs --apply | STAGING (write: 3 match_events inserted, 2 deleted, 1 pre-existing left untouched) | SUCCESS | VERIFIED
**BUG-108/116, session 44 — root cause found and fixed (config-only, no code change).** Richard confirmed Vercel's and Railway's `WS_API_KEY` values were byte-identical, ruling out session 43's suspected cause. Two live-app tests against staging (`POST /api/matches/[id]/events` + a connected viewer tab) both still failed to deliver a live push — DB writes succeeded (`201`), viewer only picked events up later via the 25s reconciliation poll, never via WS. Real cause: `src/lib/socket.ts:43`'s `NEXT_PUBLIC_WS_URL || WS_SERVER_URL` — Vercel's `NEXT_PUBLIC_WS_URL` was missing its `https://` scheme, so every server-side broadcast `fetch()` threw on the malformed URL, silently caught by the surrounding `try/catch`. `WS_SERVER_URL` had the correct value the whole time but was never reached, since the code prefers `NEXT_PUBLIC_WS_URL` when both exist.
- Richard added the missing scheme on Vercel's dashboard and redeployed.
- **Retest after fix, fresh viewer tab + fresh WS connection**: posted a real event via the app's own route — console logged `[WS] New event received for Match G4er-Gc0_E1xo8_BgvyIQ` four times, Timeline updated live with zero reload. First confirmed live broadcast delivery this project has produced.
- An earlier retest in this same session used an artificial `minute: 199` event with no `period` set, which landed in a separate "Extra Time" timeline bucket and looked like a chronological-ordering bug — traced to `LiveMatchTimeline.tsx`'s period-grouping fallback (`minute > 90` → "Extra Time" when `period` is unset), confirmed as a test-data artifact, not a real bug. Later posts set an explicit `period` to avoid it.
- Verified by: direct console log capture (`[WS] New event received...`) plus a visible new Timeline card appearing with no page reload — the definitive signal for a genuine WS push, distinct from the poll fallback that had masked every prior attempt.
- Test events (3 total posted across this session's retries, minute 199/91/199) cleaned up: 2 explicitly deleted by id (`b-oUvHwslh292_yfhosrk`, `ANJs9VC8HqqdczEqnspKC`), confirmed 0 rows remaining for each. One pre-existing event (`rnd6FDuL5V_VxzyXKAOIl`, "BUG-108 retest after Vercel key confirm", minute 95) found already on this match from Richard's own prior test — left untouched, not created by this session.
- **Caveat**: delivery took ~7–17s in this test, not CLAUDE.md's <5s target — not investigated further this session, flagged as a follow-up.
- BUG-108 and BUG-116 both moved to RESOLVED in BACKLOG.md with full evidence blocks.

2026-07-15 | git push origin dev (ea9454f) + dev/test-live-broadcast-post.mjs + dev/cleanup-broadcast-test-event.mjs --apply | STAGING (write: 1 match_event inserted + deleted) | SUCCESS | VERIFIED
**BUG-074, session 44 — env-scoping workaround ported to the deployed `ws-server/index.js`.** Ported `server.js`'s room-prefix pattern (session 43, local-dev only, protected nothing live) to the file Railway actually deploys — every socket room now prefixed `staging:`/`prod:` from the connecting browser's Origin header, plus the two gaps the original BUG-074 filing said room-prefixing alone wouldn't fix: the `notification:global` goal broadcast and the `matchTimes` cache, both now scoped too. `src/lib/socket.ts`'s REST `/broadcast` call (Vercel → Railway, no browser Origin) now sends an explicit `env` field computed from `NEXT_PUBLIC_APP_URL`'s hostname — not `NEXT_PUBLIC_ENV`, since Richard flagged mid-session that staging deliberately keeps that label off `'staging'` to bypass `middleware.ts`'s JWT gate, which would have silently misrouted every broadcast.
- `tsc --noEmit`: no new errors (all pre-existing, unrelated to these files). `node --check ws-server/index.js`: no syntax errors.
- Committed `ea9454f`, pushed to `origin/dev`. Richard confirmed Railway's `ws-server` service tracks `dev` for auto-deploy. Both Vercel staging and Railway confirmed live by Richard directly on their dashboards.
- **Post-deploy live re-verification**: redid the exact BUG-108 live-broadcast test (fresh viewer tab, real event via `POST /api/matches/[id]/events` on staging) — the event did land live (console `[WS] New event received...`, new Timeline card, no reload). This confirms both sides of the fix (the `env` field sent by `socket.ts`, the room-prefix applied by `ws-server`) are deployed consistently — a mismatched partial deploy would have broken delivery outright (room names wouldn't match between client and broadcaster).
- **Timing correction, same test, from Railway's own logs (Richard pasted the raw log export)**: initially reported delivery as "~5-8s" based on browser-side tool-call timing, which was imprecise (eyeballing gaps between my own tool calls, not a real measurement). Railway's server-side log is authoritative: DB write completed `16:20:33.347Z` (API response `createdAt`), but `[Broadcast API] event:new → staging:match:G4er-Gc0_E1xo8_BgvyIQ` didn't fire until `16:21:15.719Z` — a **42-second** gap, worse than the ~7-17s observed in the pre-BUG-074-fix test earlier this session, not better. The <5s target (CLAUDE.md) is not met and the latency problem is not resolved — corrected here rather than let the earlier wrong "faster" claim stand.
- Test event (`gZCwHMEW_LrgLno38TDnU`) cleaned up, confirmed 0 rows remaining.
- **Not verified by this test**: actual cross-environment isolation (a staging broadcast reaching a prod viewer, or vice versa) — would need a real prod-origin viewer connected simultaneously, not attempted against live prod traffic this session. Logic reviewed carefully but isolation itself remains live-unverified.

2026-07-15 | git push origin dev (b2ffcde) + dev/test-live-broadcast-post.mjs + dev/cleanup-broadcast-test-event.mjs --apply | STAGING (write: 1 match_event inserted + deleted) | SUCCESS | VERIFIED
**BUG-119, session 44 — fixed unawaited broadcast calls, real latency improvement confirmed.** The 42s gap found in the previous test traced to all 5 `broadcast*()` calls being fire-and-forget, with the exported functions in `src/lib/socket.ts` not even returning their underlying promise — nothing to await even if a caller tried. On Vercel's serverless runtime an unawaited promise has no guaranteed completion once the function returns its response. Fix: `socket.ts`'s broadcast functions now return `Promise<void>`; all 5 real call sites (`POST`/`DELETE /api/matches/[id]/events[/:eventId]`, `PATCH /api/matches/[id]`) wrapped in `next/server`'s `after()` (stable, confirmed available on this repo's Next.js 15.3.8) instead of calling bare — keeps the invocation alive until the broadcast settles without delaying the response to the client. `/api/events` (separate, older route, same pattern) left untouched — no frontend callers found.
- `tsc --noEmit`: no new errors in any touched file.
- Committed `b2ffcde`, pushed to `origin/dev`. Vercel staging redeployed, confirmed by Richard (no `ws-server` changes this time, Railway untouched).
- **Live re-verification, server-log timing from the start this time**: DB write completed `16:35:27.914Z` (API response `createdAt`); Railway logged `[Broadcast API] event:new → staging:match:G4er-Gc0_E1xo8_BgvyIQ` at `16:35:37.781Z` — a **9.9-second gap**, down from 42s pre-fix (~4x faster). Confirms the unawaited-promise theory was a real, major contributor, not a red herring.
- Test event (`eVk8vqubwAQc-m1u_D6Ty`) cleaned up, confirmed 0 rows remaining.
- **Still open**: ~9.9s remains, short of CLAUDE.md's <5s target. Root cause of the remaining gap not investigated this session — candidates: Vercel cold start on the route invocation itself, Vercel→Railway network round-trip, or something inside Socket.IO's own emit path. BUG-119 stays SHIPPED, not RESOLVED.

2026-07-15 | git push origin dev (ada6c0c) + dev/test-ws-logger-auth.mjs + dev/test-ws-env-secret-selection.mjs + dev/test-ws-logger-auth-live.mjs | LOCAL then LIVE (STAGING Railway + Vercel) | SUCCESS | VERIFIED
**BUG-120, session 44 — logger WS socket auth built, deployed, and live-verified.** `ws-server/index.js` had zero identity verification at the socket level — any WebSocket client could emit `event:log`/`match:time:update`/etc. and have it broadcast to real viewers as a real logger, no login required. Real DB persistence was never at risk (`POST /api/matches/[id]/events` already checks `matchLoggerAssignments`), only the live broadcast trigger itself.
- Added `jsonwebtoken` (`9.0.3`, pinned) to `ws-server/package.json`. New `io.use()` middleware verifies the logger JWT sent via Socket.IO's `auth` option; `src/hooks/useWebSocket.tsx` now attaches it (function-form, re-reads `localStorage` on every reconnect). No/invalid token degrades to viewer-only rather than hard-disconnecting. ~14 logger-mutation handlers gated behind a `requireLogger()` wrapper.
- **Caught before shipping, not after (Richard's catch)**: staging and prod sign logger JWTs with different `JWT_SECRET` values, but share this one Railway instance (BUG-074) — a single hardcoded secret would have silently broken auth for whichever environment it didn't match. Fixed with two vars (`JWT_SECRET_STAGING`/`JWT_SECRET_PROD`), selected per-connection via the same Origin-based env detection BUG-074 already established (`getEnvFromOrigin()`, extracted to a shared helper, replacing duplicated inline logic).
- **Local verification** (before any deploy): started `ws-server` locally with distinct test secrets, ran two real Socket.IO test-client scripts. Confirmed: no-token/wrong-role/wrong-secret all correctly downgraded to viewer-only with `event:log` rejected; valid logger token succeeds; cross-environment secret isolation genuinely works (staging token rejected against a prod-Origin connection and vice versa, not just coincidentally passing). `tsc --noEmit` and `node --check` both clean.
- Created `ws-server/.env.example` (referenced by the README, never existed) and updated the README's env var and "How It Works" sections.
- Committed `ada6c0c`, pushed to `origin/dev`. Richard added `JWT_SECRET_STAGING`/`JWT_SECRET_PROD` to Railway before the push. Both Railway `ws-server` and Vercel staging confirmed redeployed (Railway uptime observed dropping then stabilizing across two checks, consistent with a real restart landing the new code).
- **Live verification against the real deployed infrastructure**: `dev/test-ws-logger-auth-live.mjs` connected directly to the real Railway URL with a staging Origin header. No-token connection: `event:log` correctly rejected (`"Unauthorized: logger authentication required"`). Real logger JWT (`dev/gen-logger-test-token.mjs`, signed with staging's actual `JWT_SECRET`): `event:log` succeeded. A separately-connected real viewer tab watching the match's Timeline logged `[WS] New event received for Match G4er-Gc0_E1xo8_BgvyIQ` (×4), no reload — the authenticated logger's direct socket emit reached a live viewer end to end. This is the direct client-emit path specifically (`event:log` over the socket), not the REST-broadcast path BUG-108/116/119 already cover — no DB write, `ws-server`'s `event:log` handler is a pure relay, so no test-data cleanup needed.
- **Known, deliberately-scoped-out limitations, named not hidden**: authentication only, not per-match authorization (a valid logger could still emit for a match they're not assigned to at the WS layer — REST persistence still blocks the actual write); an already-anonymous shared connection doesn't upgrade to logger privileges on login without a page reload; Origin header is spoofable by a non-browser client (the real security boundary is possessing a validly-signed JWT, not Origin-based routing, which was never a security boundary even for BUG-074's original room-scoping); silent-degrade-on-bad-secret could mask a Railway misconfiguration the same way `WS_API_KEY`/`NEXT_PUBLIC_WS_URL` did earlier this exact session.

2026-07-21 | git push origin dev (bdf10f3) + dev/test-live-broadcast-post.mjs (x2) + dev/cleanup-broadcast-test-event.mjs --apply | STAGING (write: 2 match_events inserted, 2 deleted) | SUCCESS | VERIFIED
**BUG-119, session 45 — second, real contributor to the remaining ~9.9s found and fixed, further improvement confirmed live.** `POST /api/matches/[id]/events` registered its `after()` broadcast calls but then still `await`ed two more things before it could `return` — `updatePlayerStats()` and, when the match is `LIVE`, a synchronous internal self-`fetch()` to its own `/api/matches/[id]/ratings`. Since `after()` callbacks don't start until the handler's own promise resolves, that self-fetch sat directly between "DB write committed" and "broadcast fires," adding a full extra Vercel-to-Vercel HTTP round trip to every live event. Fix: wrapped the ratings self-fetch in its own `after()` call, same pattern as the broadcast calls. `tsc --noEmit`: no new errors in the touched file.
- Also found while tracing this, filed separately (not fixed): the ratings self-fetch forwards no `Cookie`/`Authorization` header, so it has silently 401'd on every call since it was written — live auto-ratings has never actually run. Filed as BACKLOG-124.
- Committed `bdf10f3`, pushed to `origin/dev`. `ws-server` also redeployed as a side effect (tracks `dev`), confirmed via its own fresh `Starting Container` log line — no `ws-server` code changed this session.
- **Live re-verification, server-log timing**: two events posted via `dev/test-live-broadcast-post.mjs`, gap measured as DB `createdAt` vs. Railway's `[Broadcast API]` log line (Richard pasted the raw Railway log export): event `c0B-BFeb5UDObt1qsA5AR` — `10:52:42.505Z` → `10:52:46.604Z` = **~4.10s**; event `eNAH-7BsHWJ_rhegzNDnN` — `10:53:49.827Z` → `10:53:56.178Z` = **~6.35s**. Down from the session-44 baseline of ~9.9s (and the original 42s). One reading landed under CLAUDE.md's <5s target, the other still slightly over.
- Both deliveries also confirmed functionally correct via a connected viewer tab (`[WS] New event received...` x2, no reload) — no regression from this session's change.
- Test events cleaned up (`dev/cleanup-broadcast-test-event.mjs`, both ids), confirmed 0 rows remaining.
- **Incidental finding, not a real bug**: Railway's `ws-server` log for this deploy included `[WS Auth] WARNING: JWT_SECRET_STAGING and/or JWT_SECRET_PROD not set`. Richard confirmed this was a deliberate, momentary unset to verify the warning fires correctly — not a regression of BUG-120. No action taken, not filed.
- **Still open**: remaining ~4-6s variance between two near-identical calls not root-caused. BUG-119 stays SHIPPED, not RESOLVED — downgraded from active Tier 0 candidate given diminishing returns vs. other open work.

2026-07-21 | dev/backfill-match-players-basketball.mjs --self-test + dev/parse-basketball-stats.mjs (x21) + dev/backfill-match-players-basketball.mjs (full run) | STAGING (read-only) | SUCCESS | VERIFIED
**Basketball backfill pipeline stood up, session 45 — parser + matcher adapted from football's proven pattern.** `dev/parse-basketball-stats.mjs` parses the 21 unique BUSA League Basketball box-score CSVs (`C:\Users\Wise\Downloads\BRIXSPORT\BUSA LEAGUE\BASKETBALL BUSA LEAGUE STATS\`) into 42 per-team JSON files (`dev/parsed-basketball-sheets/`), zero unresolved names. `dev/backfill-match-players-basketball.mjs` reuses football's `backfill-match-players.mjs` tiering (EXACT/FUZZY, team-scoped-then-platform-wide) and `college-guard.mjs` unchanged, with one real adaptation: a hardcoded 6-team slug->id map replacing football's DB-lookup `resolveTeamId()`, since BUSA basketball team ids aren't `busa-`-prefixed and CSV slugs don't match `short_name` codes. Self-test: 9/9 passed (college-guard regression cases reused from football, plus all 6 team-slug resolutions). First full run: 490 player-appearance rows, 349 clean `LINK (exact)`, 141 needing review.
- Confirmed `player_team_affiliations` fully in sync with legacy `players.team_id` for all 6 basketball club teams (row counts match exactly) — `getRoster()` reused unmodified from football's matcher.
- No writes this entry — pure parse + match, report only.

2026-07-21 | dev/backfill-basketball-nicknames-and-stubs-batch1.mjs --apply | STAGING (write: 4 nicknames added, 2 players + 2 affiliations inserted) | SUCCESS | VERIFIED
**Basketball identity resolution, batch 1.** Cross-referenced full team rosters (`dev/get-basketball-team-rosters.mjs`) against the matcher's 5 original `CREATE STUB` flags for TBK/Rim Reapers/Titans — caught 4 of the 5 were actually nicknames for existing same-team, same-jersey-number players the fuzzy matcher's length-gate (±1 char) couldn't reach: TBK #20 `ray`->RAYMOND, #67 `benzo`->IYANU, #13 `ajibade`->RICHARD, #7 `skylar`->RUTH. Written to `player_team_affiliations.nicknames` (per-affiliation, not `players.jersey_name`, per known-issues.md's standing nickname rule). Remaining 2 confirmed genuine stubs (no candidate anywhere on their team): Rim Reapers #6 `mofe` (DNP in all 6 sheet appearances), Titans #2 `mujeeb`. Pre-flight confirmed no existing player already named `mofe`/`mujeeb` before creating.
- Verified by: re-ran the matcher against the affected files post-apply — all 6 now resolve `LINK (exact)`.

2026-07-21 | dev/backfill-basketball-nicknames-batch2.mjs --apply | STAGING (write: 4 nicknames added) | SUCCESS | VERIFIED
**Basketball identity resolution, batch 2 — same-team fuzzy spelling variants.** Jersey-number cross-referenced against full rosters, all 4 confirmed same team + same jersey number as the CSV row: Rim Reapers #0 `abdulrahman`->abdurrahman, Titans #3 `Koredeolus`->Koredolus, TBK #1 `salimo`->SALIM, TBK #6 `osha`->OSHAI. Written as nicknames, same rationale as batch 1 (recur across many matches; resolving once lets every future match auto-link instead of re-flagging).

2026-07-21 | dev/backfill-basketball-stubs-batch2.mjs --apply | STAGING (write: 2 players + 2 affiliations inserted) | SUCCESS | VERIFIED
**Basketball identity resolution, batch 3 — confirmed-different-person stubs.** Matcher flagged `victor` (Siberia #14) and `azeez` (TBK #24) as exact matches to existing platform players (Victor Ememe, Abdulazeez Jolaoye — both football). Richard confirmed both are different, unrelated people from the CSV entries. Cross-checked against real rosters first: Siberia's actual #14 is BOSCO, TBK's actual #24 is DARA — neither matches, confirming genuine new stubs rather than the platform-wide matches.

2026-07-21 | dev/backfill-basketball-transfer-history.mjs --apply + dev/fix-basketball-transfer-history-startdates.mjs --apply | STAGING (write: 1 affiliation inserted, 3 affiliations updated) | SUCCESS | VERIFIED
**Two real mid-season transfers found and properly recorded as roster history (BACKLOG-126).** Chronologically proven via CSV appear/disappear cutoffs, both landing inside the league's own official trading window ("TRADING BEGINS FROM ROUND 3 THROUGH ROUND 7", `dev/basketball-dates-and-fixtures.md`): `LIGHT` (Rim Reapers #3 through 11-22-25 -> Vikings #18 from 11-26-25) and `dekunle` (Rim Reapers #77 through 11-28-25 -> Storm #15 from 12-6-25). Neither transfer had ever been recorded — both players had exactly one current `player_team_affiliations` row, no historical trace either way, confirming BACKLOG-126's finding that nothing in the app actually uses the schema's `is_active`/`start_date`/`end_date` columns for this. First script added the missing historical rows / closed out the stale one; a bug in that first pass left the pre-existing rows' stale batch-seed `start_date` (~2025-12-26 for both, confirmed via inspection to be a DB-row-creation timestamp, not a real join date) untouched, producing a `start_date` AFTER `end_date` on dekunle's closed Rim Reapers row — caught from the post-apply output and fixed same session with a second script (season start 2025-10-25 applied to dekunle's Rim Reapers row; LIGHT's Vikings row corrected to the real 11-24 transfer date).
- Verified by: full affiliation history re-query for both players post-fix — both now show clean, contiguous, non-overlapping date ranges.
- Filed alongside: `BACKLOG-126` and a `SYSTEM_CRITICALITY_MAP.md` Tier 2 entry documenting the broader gap (no admin UI for transfers, `updatePlayerStats()`'s hardcoded `season: '2024'`, no unique constraint on `(playerId, season, competitionId)`).

2026-07-21 | dev/backfill-basketball-batch3.mjs --apply | STAGING (write: 1 nickname added, 6 players + 6 affiliations inserted) | SUCCESS | VERIFIED
**Basketball identity resolution, batch 4.** `ike` (Storm #11, every Storm match) -> nickname on ALEX (Storm's #11 is shared by two existing players, Alex and Jabbar; Richard ruled out Jabbar directly as the already-known cross-sport identity, Abdul-jabbaar Bello/busa-pirates-player-9, leaving Alex by elimination). 6 new placeholder stubs created for genuinely unidentified players — confirmed via a full cross-team scan of all 73 distinct CSV names that "playerN" is the source app's own generic marker, not a real name (e.g. "player14" appears as 4 different teams' #14 on the same day): Titans #14, Storm #13, Storm #14, Vikings #15, Siberia #13, Siberia #14. (Vikings #14 and Storm #17 already had correct pre-existing placeholder stubs on the right team from an earlier, unrelated session — confirmed via lookup, no action needed, matcher already resolves them.)
- Note recorded, not a DB write: `zaza`'s one anomalous Rim Reapers #13 appearance (`siberia_vs_rim_reapers_12-10-25`) confirmed as a likely copy-paste data-entry artifact (impossible for Storm's real Zaza to also be playing a different Storm game the same exact day) — to be skipped, not attributed to anyone, when that match is written.

2026-07-21 | dev/backfill-basketball-batch4-final.mjs --apply | STAGING (write: 2 nicknames added, 2 players + 2 affiliations inserted) | SUCCESS | VERIFIED
**Basketball identity resolution, batch 5 (final) — closes out identity resolution at 479/490 auto-resolved, remaining 2 resolved by explicit human decision.** `Adeyemo` (Titans #5) -> nickname on Ade (same team, same jersey number; the 2 football candidates the fuzzy matcher found were unrelated cross-team noise). `obi` (Vikings #14) -> nickname on the existing `PLAYER14` placeholder (not a real identity to begin with). `oj` (Rim Reapers #7) -> new stub, ruled out as both OJAY (real appearances for Vikings on the exact same dates "oj" appears for Rim Reapers -- can't be the same person) and as leo's continuation (leo held #7 through 11-22 then transferred to Siberia; #7 sat vacant one game, "oj" picked it up from 12-6 -- a new person taking a vacated number). `damilare` (Titans #14) -> new stub, confirmed different person from Rim Reapers' own #9 damilare via overlapping-date evidence. `zaza` (Storm #13) needed no write -- matcher already resolves it via platform-wide exact match to the existing ZAZA record (registered to Rim Reapers, who has zero legitimate appearances all season -- same real person, plays for Storm the whole time our CSV coverage exists, no fabricated transfer date recorded since it predates coverage).
- Verified by: full matcher re-run (`dev/basketball-matcher-report-final2.json`) — 479/490 rows now `LINK (exact)`, remaining 2 (`erah`, `zaza`) are resolved by documented human decision the matcher's own labels can't express.

2026-07-21 | dev/fix-basketball-seeded-matches.mjs --apply | STAGING (write: 30 rows updated) | SUCCESS | VERIFIED
**Fixed the 30 pre-existing `busa-basketball-N` seeded matches (`src/db/seed-busa-basketball.ts`): wrong `competition_id`, fabricated `stats` blob.** All 30 were wired to BUSALYMPICS (BASKETBALL)'s competition id (`6LoBXd7UYUGms0AyjCixO`) instead of the real BUSA LEAGUE BASKETBALL competition (`m-4qhMBvnUP2a-GcU-Rsv`). `home_score`/`away_score` turned out NOT to need fixing — cross-checked against `dev/basketball-busa-league-scores.md`'s real round-by-round results and confirmed correct, team-for-team, round-for-round (the seed script's scores were real, contrary to an earlier research-agent claim of "fabricated scores per round" — only the `stats` JSON blob was `Math.random()`-seeded). Cleared `stats` to `NULL` on all 30 rows per BUG-105's established precedent (clear stats on any pre-existing match row being backfilled, so the app's real recompute guard isn't blocked by a stale non-null value).
- Verified by: post-apply count query — 30/30 rows correctly wired with `stats IS NULL`, 0 rows remaining on the wrong competition_id.

2026-07-21 | dev/fix-basketball-match-dates.mjs --apply | STAGING (write: 30 rows updated) | SUCCESS | VERIFIED
**Fixed `start_time` on all 30 seeded basketball matches — was a fake sequential Jan-Mar 2025 placeholder pattern from the seed script; real season runs Nov 2025 -> Jan 2026.** CSV dates treated as source of truth (23 of 30 rows), `dev/basketball-dates-and-fixtures.md`'s per-pairing schedule used as fallback only for the 7 rows with no CSV coverage at all. Caught and fixed a timezone bug in the first draft (`new Date(y,m,d).toISOString()` was shifting dates back a day under UTC conversion; switched to `Date.UTC()`). One real, unresolved discrepancy found and documented (not silently accepted): Round 9's TBK-Storm match (`busa-basketball-26`) has a CSV-assigned date (1-8-26) whose own box-score total (46-41) doesn't match the official stored score (44-40) — every other CSV-backed match this session cross-checked exactly (e.g. Round 4's TBK-Storm CSV summed to exactly 33-32, matching stored). Richard's call: proceed with the date assignment (chronologically consistent with the season's established heavy-rescheduling pattern) and flag the score mismatch rather than exclude the match — documented in `dev/basketball-busa-league-scores.md`.
- Verified by: post-apply query, all 30 rows resolved to a real date, none left on the fake placeholder pattern.

2026-07-21 | dev/backfill-write-basketball-match.mjs titans_vs_rim_reapers_11-15-25 --apply | STAGING (write: 22 basketball_player_stats rows inserted) | SUCCESS | VERIFIED
**First-ever write to `basketball_player_stats` (0 rows in both staging AND prod before this) — match 1 of 21 in the per-match write phase, `titans_vs_rim_reapers_11-15-25`.** Writes directly from box-score CSV data (made-counts only: points, FGM/3PM/FTM, rebounds off/def/total, assists, turnovers, steals, blocks, fouls, games played) via `dev/lib/basketball-identity-map.mjs` (canonical resolver consolidating every identity decision from this session's matcher runs + explicit `erah`/`zaza` overrides). Deliberately excludes `fieldGoalsAttempted`/`threePointersAttempted`/`freeThrowsAttempted`/all `*_percentage` columns — 92.7% of shot rows across the full CSV set show a fabricated `FGM==FGA` (100%), only 7.3% have a real recorded miss, so writing "attempted" would produce a false, misleadingly-precise ~100% shooting percentage for nearly every player. Cumulative-recompute discipline (matching football's own rule): recomputes each affected player's FULL total from every match in a running ledger (`dev/basketball-applied-matches.json`) every run, never delta-adds to a stored value — necessary because `basketball_player_stats` has no per-match granularity and no unique constraint on `(playerId, season, competitionId)`.
- Real gap caught before this run, fixed in the script: `pointsPerGame`/`reboundsPerGame`/`assistsPerGame` weren't being computed at all (would have silently stayed `0`, breaking the leaderboard's `'rating'` sort and the player-compare route on real data) — added, derived from totals/gamesPlayed with a zero-games guard.
- Verified by: pre-write dry run reviewed and confirmed, 22 players resolved with zero identity errors, post-apply row count matches expected.
- 21 matches remain in the write phase (22 total unique CSV-backed matches, corrected count from an earlier miscount of 21).

2026-07-21 | dev/backfill-write-basketball-match.mjs (x21, all remaining matches) --apply | STAGING (write: 79 basketball_player_stats rows total, cumulative across all 22 matches) | SUCCESS | VERIFIED
**BUSA League Basketball player-stats backfill COMPLETE — all 22 CSV-backed matches applied.** Processed in small batches (3-4 matches per shell invocation) to avoid tool timeout as the cumulative-recompute cost grows with ledger size (each run re-sums every touched player's full history across every match in `dev/basketball-applied-matches.json`, per the no-delta-add discipline). One batch of 10 hit a 2-minute tool timeout partway into match 11 (`tbk_vs_siberia_11-15-25`) — confirmed safe before retrying: the ledger file still showed only 10 matches, and the DB's total row count (65) matched exactly what match 10's own run had reported, confirming the killed process never reached its `client.batch()` write. Re-ran cleanly; the cumulative-recompute design (always sets the full correct total, never increments) would have self-corrected even if a partial write had landed.
- Final state: **79 distinct players** with real `basketball_player_stats` rows, up from 0 (both staging and prod) before this session.
- Sanity-checked, not just trusted: top scorer (271 points, 8 games, 33.9 ppg) is Vikings' `38ka6Nb4NPfsV-8IoB-WG` — cross-checked against `dev/basketball-busa-league-scores.md`'s own MVP call-outs (DAVID won MVP in Rounds 2, 3, 6, and 7) — same player, numbers corroborate the independently-sourced MVP record rather than contradicting it.
- Live-verified against the real API afterward, not just the DB row count: `GET /api/players/stats/leaders?sport=Basketball&type=points|rebounds|assists` (the exact query shape `src/app/basketball/page.tsx`'s STATS tab sends — corrected from an earlier test that used the wrong query param name and coincidentally still worked via a default-case fallback) returns correctly-sorted real data for all three categories on the full 22-match dataset.
- `zaza`'s one anomalous stat line (`siberia_vs_rim_reapers_12-10-25`, Rim Reapers #13) confirmed excluded via the write script's `SKIP_ROWS` set — not attributed to anyone.
- This closes the `SYSTEM_CRITICALITY_MAP.md` Tier 2 "basketball player-stats write path unverified" gap (RESOLVED, session 45) — via historical backfill, explicitly NOT via the live logger, which remains fully broken per `BACKLOG-125`.
- Basketball player-stats backfill is now fully done. Remaining basketball-adjacent work, in priority order per this session's agreed sequencing: `BasketballLogger.tsx`'s Tier 0 live-write fixes (`BACKLOG-125`) next, then the ~8 score-only (no CSV/PDF) BUSA League Basketball games and the Semi Final/Finals bracket (currently unplayed/tentative, out of scope until real results land), then the remaining 11 football backfill matches (`BACKLOG-018`), then Tier 1 work.

2026-07-21 | dev/verify-basketball-missed-shot-fix.mjs (throwaway match, deleted after run) | STAGING (write: 1 test match + 6 test events + 1 logger assignment inserted, all deleted same run — net 0 rows remaining) | SUCCESS | VERIFIED
**DIRECTIVE 1 (P0) — missed-shot-counted-as-made fix, live-verified against the real fixed route.** Root cause: `BasketballLogger.tsx`'s "2PT/3PT/FT Missed" buttons pass `points=0`; `recordEvent` sent `value: points || null` (0 is falsy, collapses to null); `events/route.ts`'s `updatePlayerStats` basketball switch incremented `fieldGoalsMade`/`threePointersMade`/`freeThrowsMade`/`totalPoints` unconditionally on event type alone, with no make/miss branch — every logged miss silently wrote a make + its points to `basketball_player_stats`. Fix: explicit `made: boolean` field sent by the client (computed from `points > 0`, never inferred from `value`), server switch now gates every made-counter and `totalPoints` increment on `made`, not `value`. `fieldGoalsAttempted`/`threePointersAttempted`/`freeThrowsAttempted` deliberately left untouched (write-dead, per the earlier CSV-backfill decision to exclude unreliable attempt data).
- Verified against a real player (`C4l2KYE9n92qy--FUc03H`, KAMKID) via `POST /api/matches/[id]/events` (the actual fixed route, hit through a local dev server pointed at the staging DB, not a direct DB write) for all 6 combinations: 2PT/3PT/FT make + miss. Raw `basketball_player_stats` deltas: `fieldGoalsMade` 4→5, `threePointersMade` 1→2, `freeThrowsMade` 0→1, `totalPoints` 9→15 (+6 = exactly 2+3+1, the three makes) — all three misses contributed zero, confirmed by direct before/after query, not UI state or HTTP status alone.
- **New bug found during this verification, NOT fixed here (out of Directive 1's scope, flagging separately):** an admin-authenticated `POST` to this route sets `match_events.logger_id` to the admin's `users.id`, but `logger_id` has an FK constraint to `loggers.id` — any admin directly logging an event (not via a logger session) 500s with `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`. First attempt at this verification used an admin test token and hit exactly this; switched to a logger token + a real `match_logger_assignments` row to complete the test.
- Also confirmed in passing: the route's ratings self-fetch (`after(() => fetch(NEXT_PUBLIC_APP_URL + '/ratings'))`, gated on `match.status === 'LIVE'`) hung the entire local dev server process when triggered, because `.env.local`'s `NEXT_PUBLIC_APP_URL` points at the real deployed staging URL rather than localhost. Sidestepped by giving the test match a non-LIVE status; not fixed (separate, already-known BACKLOG-124 territory).
- tsc --noEmit: 51 errors before and after, matching the pre-existing baseline — zero new errors.

2026-07-21 | dev/verify-basketball-period-writepath.mjs, dev/verify-preview-score-and-timestamps.mjs (x3), dev/setup-part-c-visual-check.mjs + cleanup, dev/verify-basketball-score-and-timestamps.mjs | STAGING (write: throwaway test matches + events + logger assignments, all deleted same run each time — net 0 rows remaining across all runs) | SUCCESS | VERIFIED
**DIRECTIVE 2 (Parts A/B/C) + code-review response fixes — live-verified across local dev and the real PR preview deployment, catching up unlogged runs per Richard's mid-session correction (should have been logged as each ran, not batched here).**
- **Part B write path** (`verify-basketball-period-writepath.mjs`, local): real PATCH/POST calls through Q1->Q2->Q3->Q4->OT->FINISHED, `currentPeriod` confirmed correct at every transition via direct DB query.
- **Score-persistence CRITICAL fix** (`verify-basketball-score-and-timestamps.mjs` local attempt failed with ECONNRESET — traced to a timing collision with the pre-existing `localStorage.getItem is not a function` root-page SSR hang, not a real code failure; re-run via `verify-preview-score-and-timestamps.mjs` against the actual PR preview succeeded): `basketball_player_stats`-adjacent `matches.home_score` went 0->6 (exactly 2+3+1, the three makes; the one miss contributed 0), confirmed via direct DB query against the real deployed preview build, not local.
- **Timestamp-ordering CRITICAL fix**: three `Steal` events logged ~1.2s apart got distinct `second` values (not identical) -- confirmed the core fix works. Surfaced one small separate pre-existing bug in the same test (`second: second || null` collapsing a legitimate 0 to null, same falsy-zero class as the already-fixed missed-shot bug) -- fixed same session, re-verified clean on the next preview build.
- **`currentPeriod` enum validation**: `PATCH` with a garbage value correctly returned `422` against the real preview (device returned `401` on the first, protection-gated attempt -- see below).
- **Part C rendering**: real test match set to `Q2` via the actual API, viewed on the real PR preview (`brixsports-staging-ppuubg8sx-...vercel.app/matches/test-p5-visual-check-partc`) -- confirmed "Q2" renders correctly both near the score and in the Status card, replacing what would previously have shown `NOT_STARTED`/a raw fallback. Screenshot taken as evidence.
- **Vercel Deployment Protection setup, in passing**: preview deployments are gated by Vercel Authentication (SSO). Richard added a `VERCEL_AUTOMATION_BYPASS_SECRET` (32-char, generated this session, added to both `.env.local` and the Vercel project's Deployment Protection settings) to unblock automated API-level testing against protected previews going forward -- documented as a new capability for future sessions, not just this one.

2026-07-23 | dev/add-known-basketball-affiliations.mjs --apply | STAGING (write: 6 player_team_affiliations rows inserted, PERMANENT -- not cleaned up) | SUCCESS | VERIFIED
**Added 6 real, Richard-identified players as secondary basketball-team affiliations for COLENG-B and COLNAS-B, to unblock 5-starter lineup selection in `BasketballLogger`'s "Set Starting Lineup" modal** (itself blocked until this same session's `getPlayerTeam`/BUG-061 fix, `94b661c`, without which none of these players would have shown up regardless of affiliation). All 6 already existed as real players with a primary affiliation elsewhere (mostly BUSA League Basketball teams -- TBK, SBR); each was checked for an existing college affiliation before writing, per the established college-exclusivity discipline -- none conflicted.
- COLENG-B (+3): SALIMO (`EIEBH4Ukskt02QKte2Y2v`), IYANU (`p70CX0KJ4RUog6tXyAJpt`, nickname "Benzo" recorded on this affiliation row specifically per the per-affiliation-nickname convention), Koredolus (`rgq56UL8O37buyYwLA-py`).
- COLNAS-B (+3): KOSI (`26chM5DLO9l11aqy6cxrJ`), RUTH (`iyOhJ7CVccePXmKrzsAET`), Flourish (`w7DvEoaaUoVTIvxIiESjk`).
- **One identity ambiguity resolved with Richard directly rather than guessed**: two "Iyanu" candidates existed -- a generic `IYANU` basketball player (TBK primary, no college affiliation) and `Iyanuloluwa Olusore` (a football player, Busa Hammers primary + COLENG's football team secondary -- different sport, different team, almost certainly a different person). Richard confirmed the basketball one directly by ID rather than the name alone.
- Verified by: post-write roster count query -- COLENG-B 3 -> 6, COLNAS-B 2 -> 5 (both now enough for a 5-starter lineup). Not yet confirmed in the actual UI at time of this log entry -- Richard is retesting the lineup modal against the current preview build next.

2026-07-23 | Richard, real interactive logger walkthrough against the PR preview (match `MRBIz1YqN61DgjHfpyhw4`, real match created via Admin, not scripted) | STAGING (no direct script writes by Claude this entry -- all writes came from Richard's own logger session through the real UI) | SUCCESS | RESOLVED
**"Finalize Match reachable" fix (Directive 2 Part B, `470ffe0`) -- confirmed live, end-to-end, by an actual logger clicking through the real UI, not API automation.** Richard set a 6/5-player lineup (unblocked by the same-day `getPlayerTeam`/BUG-061 fix), started the match, logged real scoring events across Q1-Q4 (final score reached 2-3), then at Q4 (non-tied) clicked "Finalize Match" in the End-of-Quarter modal. Browser alert confirmed "Match finalized successfully! All events have been saved." -- and, critically, the public match page flipped from "Q4"/"Match is currently live!" to **"FT"/"Match has ended"**, which only happens if `finalizeMatch()`'s real PATCH actually reached the server (the pre-fix behavior was a dead end: `setMatchEnded(true)` locally only, real Finalize button gated on the same state so it vanished, match stuck LIVE forever).
- **Evidence:** direct DB query on the real match row post-finalize: `{"status":"FINISHED","current_period":"FINISHED","home_score":2,"away_score":3}` -- matches the UI exactly, confirmed via `dev/check-finalize-result.mjs`, not inferred from the alert or the page alone.
- **Three additional real findings surfaced during this walkthrough, confirmed live (not just predicted), filed for the upcoming football-to-basketball systematic mapping session, none fixed in this PR:**
  1. **No mid-match-resume seeding for basketball at all** -- worse than the earlier-suspected version: `matchStarted` correctly re-seeds from the server (`match.status === 'LIVE'`) on a fresh mount, but `lineupSet`/`homeStarters`/`awayStarters` do not, and the header's "Set Lineup & Start Match" button is gated on `!matchStarted` -- so once `matchStarted` is `true` again, there is **no UI path back into lineup selection at all**. Richard hit this directly: left the tab, came back, lineup/players wouldn't mount, hard refresh didn't recover it either. Same bug class football already solved (BUG-115/117/118), never ported to basketball.
  2. **No WS emit wired up for basketball at all** -- matches football's own already-fixed `BUG-108/116` history (DB write and live broadcast being two disconnected things) -- basketball never got any of that work.
  3. Confirmed (not new, already documented as a deliberate scope choice) -- the logger's on-screen clock display does not tick in real time; only event *timestamps* are computed from real elapsed time (this session's CRITICAL fix), not the display itself.
- Failure-save banner (the other pending test-plan item) was not tested this walkthrough -- deprioritized in favor of finishing the Finalize confirmation first.
- **Unconfirmed, not diagnosed:** Richard reported hitting a 404 error page once after clicking on "one of the events" mid-walkthrough. Not reproduced, not root-caused -- insufficient detail captured at the time (which tab/button, what URL the 404 landed on). Noting explicitly so it isn't lost, not filing a full bug report against a guess. Needs reproduction next session if it recurs.

2026-07-23 | dev/cleanup-two-test-matches-s47.mjs --apply | STAGING (write: 2 test matches + 39 match_events + 3 match_logger_assignments deleted; 10 player-stat rows reverted) | SUCCESS | RESOLVED
**Session 47 cleanup, Richard-directed by exact match ID -- both confirmed test artifacts, not real data, before deletion.**
- `MRBIz1YqN61DgjHfpyhw4` (Basketball, COLENG-B 2 - 3 COLNAS-B) -- the session 46 walkthrough match itself (see entry above), created same day. 2 events (Field Goal, Three Pointer), both "made" (score matched event count exactly). Reverted `basketball_player_stats` for both scorers (`fieldGoalsMade`/`totalPoints` for SALIMO, `threePointersMade`/`totalPoints` for Flourish).
- `G4er-Gc0_E1xo8_BgvyIQ` (Football, Kings FC 1 - 0 COLNAS), created 2026-07-13 -- confirmed as dev/route-testing debris, not a real match, via event-type inspection before deleting anything: 37 events including non-taxonomy types (`Push`, `Catch`, `Handball`) that only appear from someone exercising the API's free-text event-type acceptance, plus one placeholder player ID (`player-1767972615670-yet6lrue1`, timestamp-pattern, not a real roster player).
- Reverted `football_player_stats` for every stat-affecting event present (mirrors `updatePlayerStats`'s switch in `events/route.ts` -- `Block`/`Corner`/`Push`/etc. carry no stat weight and were correctly skipped): 3x Save + 1x Goal for `busa-kings-player-19`, 2x Save for `busa-joga-player-13`, 1x Yellow Card for `busa-kings-player-25`, 1x Penalty Missed for the placeholder ID (no-op -- no stats row existed for it).
- **Evidence:** dry-run reviewed first (`node dev/cleanup-two-test-matches-s47.mjs`, no `--apply`) -- matched the inspection exactly. Applied, then DB-verified: both match rows return zero rows on lookup, `match_events` count is 0 for both IDs, every stat UPDATE reported `rowsAffected: 1`. Pending items: none.

2026-07-23 | Favicon/PWA icon directive -- 3 manifests + 3 layouts wired, `sharp@0.35.3` added as devDependency | dev (direct push, Richard-authorized for this session) | SUCCESS | RESOLVED
**Recolored the approved light-monogram PWA icon set (navy/viewer already existed, purple/admin and amber/logger newly generated) and wired all three roles' manifests + tab favicons.** Read-first pass confirmed: `manifest.json` (no suffix) has zero references anywhere in `src`/`public`/`next.config.*` **and** is internally broken (references `icon-72x72.png` through `icon-152x152.png`, none of which exist in `public/icons/` -- only 192/512 do) -- confirmed orphan, not deleted, flagged here per backscoping convention. Separately found and fixed a *live* broken reference along the way: `manifest-user.json`'s shortcuts (Live Matches/News/Profile) pointed at `/icons/icon-96x96.png`, which also doesn't exist -- not orphaned, just broken; fixed as part of this same pass.
- **Generated:** `public/icons/role-colorways/{admin,logger,viewer}-{16,32,192,512}.png` (solid rounded-square, mark pixel-identical across all three) + `viewer-{16,32,192,512}-transparent.png` (for root's browser-tab favicon). Admin `#581C87` (deep purple, deliberately distinct from viewer's existing `#8b5cf6` brand purple to avoid the exact identity-collision problem this exercise exists to solve). Logger `#D97706` (amber) -- checked side-by-side against the app's actual warning-amber (`amber-500`/`amber-400`, used in disconnect toasts and stoppage-time indicators) before confirming; distinct enough in practice given icon vs. toast are different visual contexts, Richard's call.
- **Maskable safe-zone measured, not eyeballed** (`dev/check-maskable-safe-zone.mjs`): the source crop's mark overflows Android's 40%-radius safe circle by ~4.5% at every size, consistently -- confirmed FAIL, not "probably fine." Since repadding the mark is out of scope (directive's own DO-NOT), fixed the *claim* instead of the asset: dropped `"maskable"` from `purpose` in all 3 manifests (`"any maskable"` -> `"any"`). Real backlog item if a true maskable-safe icon is ever wanted: needs a new export with more mark padding, not a manifest-level fix.
- **`manifest-user.json` trimmed** from 8 declared icon sizes (72/96/128/144/152/192/384/512, all reusing one full-lockup image regardless of declared size) down to 192+512 -- the actual PWA-spec minimum, matching admin/logger's existing pattern. 16/32 don't belong in a manifest's icon array (favicon-only sizes).
- **Root layout consolidated from 3 overlapping favicon declarations to 1:** previously had Next.js's `app/favicon.ico` + `app/icon.png` file-convention icons, *plus* an explicit `metadata.icons.icon` array, *plus* 3 hardcoded `<link>` tags in the JSX `<head>` -- all pointing at old assets, some redundant with each other. Now: `app/icon.png` (replaced with navy-transparent) is the single active favicon source; `metadata.icons.apple` holds the solid-navy iOS home-screen icon (transparent would render with a black-filled background on iOS); redundant JSX `<link>` tags removed. `app/favicon.ico`'s bytes intentionally left unchanged (old asset) -- acceptable, evergreen browsers all resolve `app/icon.png` first; flagging as a known minor gap rather than silently leaving it unmentioned.
- **Tab favicon color extended to admin/logger too, not just the installed PWA icon** (Richard's explicit call, since the whole point is distinguishing multiple simultaneously-open BrixSports tabs): admin's browser tab now shows purple (`admin-32.png`), logger's shows amber (`logger-32.png`), root/viewer stays navy-transparent.
- **Pre-cleanup check, nothing deleted:** before assuming any existing `public/icons/*` files were now-replaceable leftovers, grepped for references first. `icon-192x192.png`/`icon-512x512.png` turned out to be actively used by a completely separate system -- OS push-notification icons (`push-service.ts`, `match-notification-service.ts`, both service workers, notification composer, reminders API) -- not favicon/manifest leftovers at all; left untouched. `admin-icon.svg` has zero references anywhere in the codebase, a genuine orphan, but pre-existing and unrelated to this directive -- flagged here (same convention as `manifest.json`), not deleted. `BRIX-SPORT-LOGO.png` also still required elsewhere (OG/Twitter share images, SEO metadata, email templates, password-reset pages) -- untouched, was never in scope beyond the favicon/manifest usages already replaced.
- **`tsc --noEmit`:** 49 errors, matches the established pre-existing baseline exactly -- zero new errors from this change.
- **Verification:** all 3 manifests + all 6 new `role-colorways/` PNGs confirmed serving with real HTTP 200s directly (bypassing the known pre-existing local-dev SSR hang, which does still affect the `app/icon.png` metadata-route specifically -- unrelated to this change, already documented). Full rendered-`<head>`/DevTools Application-tab verification pending a real deploy (favicons cache aggressively -- hard-refresh against a live build is the only real evidence per the directive's own requirement, not local dev).

2026-07-23 | Favicon directive, follow-up after live user testing found real gaps | dev (direct push, Richard-authorized) | SUCCESS | RESOLVED
**Correction to the entry above: `app/favicon.ico`'s bytes were NOT safely left unchanged -- that claim was wrong, and Richard's live screenshot (installed PWA taskbar icons + browser tab) disproved it directly, not a guess.** Extracted and viewed all 4 embedded resolutions of the "old asset" -- it was never a BrixSports asset at all, it's the literal unmodified `create-next-app` boilerplate favicon (black circle, white triangle -- Vercel's own default). Never replaced since project scaffolding. I asserted "old asset, evergreen browsers resolve icon.png first" without ever actually looking at what the file contained, inferring safety from file-size proximity to an unrelated file instead. Root cause of exactly the symptom in Richard's screenshot.
- **Fix:** hand-rolled a minimal ICO container (`dev/generate-favicon-ico.mjs`) packing 4 PNG-format entries (16/32/48/256, resized from the approved navy colorway) -- PNG-in-ICO is universally supported since Vista, sharp can't write true ICO directly so this was the pragmatic path. Verified by re-parsing the written file and viewing the extracted 16px and 256px entries directly -- real navy monogram, legible at 16px, not a guess this time.
- **Also fixed, same investigation:** `public/icons/icon-192x192.png`/`icon-512x512.png` (the actual OS push-notification icons, confirmed load-bearing last entry) turned out to ALSO be a generic "B" placeholder, not the real monogram -- Richard's suspicion, verified by viewing both files directly. Content swapped to the navy monogram at matching sizes, same filenames/paths, zero code changes needed across the 13 files that reference them.
- **`manifest-admin.json` name fix -- Richard had already made this edit directly** (`"Brixsport Admin & Logger"` -> `"Brixsport Admin Panel"`, removed the redundant "Logger" shortcut entry) before this entry; folded into this commit as-is, not redone.
- **Investigated, not fixed -- viewer PWA (root `/`) installability, Richard-reported "unable to install":** checked what's inspectable without live device interaction -- `manifest-user.json` fetched directly from the live deploy is valid (name/short_name/icons 192+512/start_url/scope/display all present, meets Chrome's documented criteria on paper), console confirms `Service Worker registered: /sw-user.js` with zero errors. Could not reproduce further from an automated browser session -- `beforeinstallprompt` needs real engagement signals a scripted navigation doesn't provide, and Chrome doesn't log an explicit installability-blocker reason to console (only in DevTools' own Application -> Manifest panel or an interactive Lighthouse run). **Deliberately not fixed on a guess** -- filed as BUG-127, needs Richard's own repro (what does the install UI actually show/not show) before further diagnosis.
- **Confirmed real, deferred to avoid scope creep (Richard's own framing), filed as BACKLOG-128/129/130:** (128) the site header logo is a hand-rolled CSS div (`<div class="...bg-primary...">B</div>`), not an image, confirmed via Richard's element inspector -- platform-wide, not favicon-directive scope. (129) PWA shortcuts could be made dynamic/role-relevant in the future -- explicitly Richard's own "later" framing, not scoped. (130) `public/next.svg`/`vercel.svg`/`window.svg`/`file.svg`/`globe.svg` confirmed zero-reference `create-next-app` boilerplate via repo-wide grep -- `grid.svg` explicitly excluded, confirmed actively used on 2 pages, do not touch it.
- **`tsc --noEmit`:** 49 errors, matches baseline exactly -- these were asset-only changes (ICO bytes, 2 PNG swaps), no source touched.
- **Pending:** live hard-refresh re-verification of the new favicon.ico on an actual browser tab/taskbar (the original symptom) -- not yet re-checked post-fix at time of this entry.

2026-07-24 | dev/verify-bug131-fix.mjs | STAGING (write: 1 throwaway match + 1 event + 1 logger assignment, all created and deleted within the run) | SUCCESS | RESOLVED
**Live verification for BUG-131's fix (server-side scoring value allowlist).** Created a throwaway `UPCOMING` basketball match (`bug131-verify-mBG8teWw`, real teams TBK/Titans) and an active assignment for the real test logger (`logger_1767968844029`), then POSTed `{ type: 'Field Goal', minute: 1, teamId: <TBK>, value: 500, made: true }` to the local dev server (running the session's fixed `events/route.ts`) as that logger.
- **Result:** `201`, event saved with raw `value: "500"` on the row (unrelated to score integrity — that field is a display/stat annotation). `matches.home_score` read back directly from the DB as exactly `2` — the canonical Field Goal value — confirming client-supplied `value` no longer has any influence on the atomic score increment.
- **Side finding, not fixed:** first attempt used an admin token and hit a live `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed` on `match_events.logger_id` — confirmed reproduction of the already-filed, still-open `BUG-124` (admin's `users.id` doesn't satisfy the FK to `loggers.id`). Switched to a logger token for the actual test, per the vulnerability's real threat model anyway (a logger, not an admin, is the intended actor here).
- **Cleanup:** throwaway match, its one event, and its one logger assignment all deleted at the end of the script regardless of outcome. Real logger row (`logger_1767968844029`) untouched.
- **Pending items:** none for this verification. `BUG-124` remains separately open.

2026-07-24 | dev/setup-bug129-live-match.mjs + inline cleanup | STAGING (write: 1 throwaway LIVE match + 1 logger assignment, created then immediately deleted, zero events ever logged against it) | ABORTED-SAFE | N/A
**Started setting up a live browser walkthrough for BUG-129 (event-dedup fix), stopped before any real interaction.** Created a persistent `LIVE`-status throwaway match + active logger assignment intending to inject a browser session and click a real scoring button to observe the 15s-sync dedup behavior directly. Flagged mid-setup (Richard) that a `LIVE`-status match is exactly the trigger condition for the known `BACKLOG-124` local-dev hang (event logged on a `LIVE` match -> internal ratings self-fetch to a real deployed `NEXT_PUBLIC_APP_URL` -> can freeze the local dev server for minutes) — no event was ever logged against this match, but leaving a `LIVE` match sitting around unnecessarily risked it. Deleted the match + assignment immediately (confirmed via `rowsAffected: 1`).
- **Decision (Richard):** reserve full interactive UI/browser verification for cases a server-side script/API call genuinely can't cover, rather than mid-flow this session. `BUG-129`'s fix ships on code-trace + a live API-response-shape confirmation (from the same session's `BUG-131` verification run — `saved.event.id` confirmed present and real-nanoid-shaped) instead; full click-through dedup confirmation deferred to PR-review time, done together with `BUG-130`'s equivalent live test.

2026-07-24 | dev/verify-bug133-fix.mjs | STAGING (write: 1 throwaway match + 2 events + 1 logger assignment, all created and deleted within the run) | SUCCESS | RESOLVED
**Live verification for BUG-133's fix (basketball shot-attempt counters).** Created a throwaway `UPCOMING` basketball match + active assignment for the real test logger, then POSTed a made Field Goal followed by a missed Field Goal for a real TBK player (`i7VBmo4RZkk5Q6_Zixw2I`), reading `basketball_player_stats.field_goals_attempted`/`field_goals_made` back from the DB after each.
- **Result:** made shot moved both attempted and made +1; missed shot moved attempted +1 again (made unchanged) — confirming the attempt counter now tracks every shot regardless of outcome, closing the "no denominator for shooting percentage" gap. Deleting both events (via the BUG-130 DELETE revert path, extended this same session to decrement `*Attempted` symmetrically) brought both columns back to their exact pre-test baseline.
- **Cleanup:** throwaway match, both events, and the assignment deleted at the end of the script. Real logger and player rows untouched.

2026-07-24 | Browser-pane sanity check attempt on /logger, dev server restart | LOCAL (no DB writes) | FAILED-UNRELATED | N/A
**Attempted a basic page-load sanity check of BasketballLogger.tsx's BACKLOG-134 JSX changes via the Browser pane -- hit `500: Internal Server Error` on `/logger`.** Killed the stray dev server process and restarted fresh via preview_start; same 500 on a clean server. Confirmed this is a separate, undiagnosed local-dev issue, not the known BACKLOG-124 LIVE-match hang (no event was ever logged in this attempt, and the 500 happens on plain navigation with no match interaction at all). Richard's direction: stop attempting Browser-pane verification for the remainder of this fix sequence -- only dev/*.mjs scripts and direct fetch/API calls are usable for verification right now. Debugging the browser-500 itself is deferred to its own pass after the current sequence wraps. Logged to memory (`project_local_dev_browser_broken_session47b.md`) so future sessions don't retry blind.

2026-07-24 | dev/verify-bug124-fix.mjs + unauth curl check | STAGING (write: 1 throwaway match + 1 event, created and deleted within the run) | SUCCESS | RESOLVED
**Live verification for BUG-124's fix (admin-authenticated event POST FK crash) and audit-trail preservation.** POSTed as a real admin (not logger) to a throwaway UPCOMING basketball match. Result: `201` (not a 401 -- admins are already authorized by this route's own gate, this was purely a DB FK issue), `match_events.logger_id` stored `null` (FK-safe), `logger_name` stored as the admin's real `users.id` (`admin-001`) -- confirming the audit trail survives via the non-FK'd column instead of being silently dropped, per Richard's own catch mid-session. `matches.home_score` correctly credited to 2.
- **Also re-confirmed, not a new test:** BUG-121's atomic transaction already correctly rolled back this exact FK crash pre-fix with zero partial state -- cited from this same session's earlier verification attempt (admin token, before the loggerId fix landed), where `matches.home_score` independently stayed at 0 despite the insert throwing mid-transaction.
- **Separately confirmed via plain curl:** an unauthenticated POST to this same route (no cookie/Authorization header) returns `401` -- the auth gate itself is untouched by any of today's changes; viewers (who never have a session) are correctly rejected before the handler reads the request body.
- **Cleanup:** throwaway match and its one event deleted at the end of the script.

2026-07-24 | dev/verify-backlog124-fix.mjs + dev/check-rating-tables.mjs + dev/cleanup-backlog124-leftover.mjs | STAGING (write: 1 throwaway LIVE match + lineups + 1 event + 1 logger assignment + 1 player_ratings row, all created and deleted within the run) | SUCCESS + 1 finding | RESOLVED (BACKLOG-124), OPEN (BUG-138, new)
**Live verification for BACKLOG-124's fix (ratings self-fetch converted to a direct shared-function call).** Created a throwaway LIVE-status basketball match with real lineups (1 real player per side) and an active logger assignment -- the exact configuration that has caused this session's recurring local-dev hang all along. POSTed a real Field Goal event as that logger.
- **Result:** `201` in `7.4s` (not the old multi-minute freeze). Confirmed the dev server itself stayed responsive via a separate unrelated `curl` request immediately after (`404` in under a second). A real `player_ratings` row was written (`auto_rating: 6.2`) for the scorer -- auto-ratings computed and persisted from a live event for the first time since this feature was written.
- **New finding, filed as BUG-138 (Richard's call: file only, no schema changes tonight):** `team_ratings` table doesn't exist on staging at all -- confirmed via a direct `sqlite_master` query (`dev/check-rating-tables.mjs`), only `player_ratings`/`rating_history` exist. The rating calculation throws on its first team_ratings write (after all player_ratings writes already succeeded), silently caught by the same try/catch. Pre-existing schema drift, not caused by today's changes -- just newly reachable now that the auth-forwarding bug is fixed.
- **Script bug, not a real issue:** the verification script's own cleanup crashed on `DELETE FROM team_ratings` (same missing-table cause) -- caught, cleaned up the remaining throwaway rows manually via `dev/cleanup-backlog124-leftover.mjs`, confirmed 1 assignment + 1 match deleted.

2026-07-24 | Live PR #12 preview walkthrough via Vercel deployment-protection bypass + injected logger session | STAGING (real existing LIVE match w6o4YQAF5pem_Qa8uazAm reused, read-only investigation, no writes made to it) | FINDING | RESOLVED (BUG-139, same session)
**First real interactive browser walkthrough of the session, on the actual PR #12 Vercel preview (`brixsports-staging-oc48782w2...vercel.app`), not local dev** -- local dev server's browser rendering was broken all session (separate, tracked issue). Bypassed Vercel's deployment-protection SSO gate using a project-provided Protection Bypass token (`?x-vercel-protection-bypass=...`), then injected a real logger session (JWT signed via `dev/gen-token-for-live-match.mjs`, cookie + localStorage set via `javascript_tool`) rather than typing a password into any login form.
- Reused a real, already-`LIVE` match (`w6o4YQAF5pem_Qa8uazAm`, COLNAS-B 2 - 3 COLENG-B, Friendly/Semi-Finals) already assigned to the real test logger -- confirmed via `dev/find-live-match.mjs` before touching anything.
- Landed in the real `BasketballLogger` UI successfully (confirms this session's `BACKLOG-134` fixes are live in the build: Undo/Finalize buttons visible, scoring grid rendered).
- **Found live, not inferred:** clicking any scoring button (`2PT`) opened the "Select Player" modal with **zero players listed**, for either team. Root-caused by cross-referencing `dev/check-colnas-coleng-roster.mjs` (confirmed `player_team_affiliations` has 5/6 real rows for these teams) against a direct in-browser `fetch('/api/matches/.../eligible-players')` (confirmed `200`, `success: true`, 11 real players with correct `memberships`) against the actual modal source (`BasketballLogger.tsx:1262`, filters strictly to `homeStarters`/`awayStarters`, which are only ever populated by the in-app lineup wizard -- never re-seeded on resume). This is the already-known, previously-buried "no mid-match-resume seeding for basketball" Tier 0 gap (`BACKLOG-125`'s session-46 carried-forward note) -- filed as its own tracked item (`BUG-139`) and fixed same-session per Richard's call.
- **Blocked, not yet completed this walkthrough:** could not log a new scoring event, test the `BUG-129` dedup-after-sync behavior, or test the `BUG-130` Undo click, because the player-select modal was empty the entire time -- these all require `BUG-139`'s fix to be live on a rebuilt preview first. Re-run once the new commit deploys.

2026-07-24 | Full live UI walkthrough on PR #12 preview (rebuilt after BUG-139) | STAGING (real match w6o4YQAF5pem_Qa8uazAm: 1 real event created via UI, then undone via UI -- net zero change, match returned to its exact starting state) | SUCCESS | RESOLVED (BUG-129, BUG-130)
**Completed the deferred BUG-129/BUG-130 live UI verification, now that BUG-139 unblocked the player-select modal.** Same real logger session, same real LIVE match. Clicked "2PT" -> selected real player "LIGHT" -> skipped assist -> event logged. DB confirmed exactly 1 new row, score `2 -> 4`. Waited 18s (past the 15s multi-logger sync interval), re-checked both the client's Event Log ("3 Events Recorded", no duplicate) and the DB row count (`COUNT(*) = 3`) -- BUG-129's dedup fix holds under a real click, not just a scripted POST.
- Clicked the real "Undo" button: score reverted client-side `4 -> 2`. DB-confirmed the event row was actually deleted (not just hidden client-side) and `home_score` reverted to `2` server-side. Player stat row confirmed reverted too (`field_goals_attempted` back to `0`, `field_goals_made`/`total_points` back to pre-event baseline) -- BUG-130's full server round-trip holds under a real click.
- Match left in its exact original state (2-3, 2 events) -- no lasting changes to this real match from the walkthrough.
- **Also confirmed via source-diving during this walkthrough (BUG-139, filed and fixed same session):** the "Select Player" modal was empty before this session's resume-seeding fix, for any already-LIVE match -- root-caused and fixed mid-walkthrough, see the earlier same-day RUNLOG entry.

2026-07-24 | Debounce stress test (double_click) on PR #12 preview + fix + cleanup | STAGING (real match w6o4YQAF5pem_Qa8uazAm: 3 test Foul events created via UI double-click race, then deleted by exact id) | FINDING+FIX | SHIPPED (BACKLOG-134's debounce piece, re-verification pending)
**Stress-tested the debounce guard shipped earlier this session using the Browser pane's native `double_click` action (fires two genuine click events close enough together to race) on a Foul action's player button.** First check (immediately after) looked clean -- client showed one event. A follow-up check after the next 15s multi-logger sync tick showed **two** identical "Foul KOSI" entries client-side; a direct DB query confirmed two separate rows with an identical `created_at` timestamp, confirming a genuine server-side duplicate, not a display artifact.
- **Root cause:** `useState`-based `isRecording` guard is not synchronous across two click-handler invocations sharing the same render's closure -- both can read the same stale `isRecording === false` before React commits the state update from the first call.
- **Fix:** switched the actual guard to `isRecordingRef` (`useRef`, synchronous mutation), keeping `isRecording` state only for the visual `disabled` attribute. Also converted `recordEvent`'s optimistic `setEvents([...events, newEvent])` to a functional update -- the non-functional version was independently masking the duplicate client-side.
- **Cleanup:** the 3 test Foul events (1 clean + 2 from the race) deleted by exact id (`dev/cleanup-live-match-test-events.mjs`), confirmed the real match back to its original 2-event, 2-3 score state.
- **Pending:** re-run the double-click test against the rebuilt preview once the new commit deploys, to confirm the `useRef` fix actually closes the race -- not yet re-proven.

2026-07-24 | Failure-banner probes (roster-load, period-transition, event-save) on PR #12 preview | STAGING (real match w6o4YQAF5pem_Qa8uazAm: read-only probes, no lasting writes -- the event-save probe's Field Goal was rejected client-side by design and never reached the DB) | SUCCESS | RESOLVED (BACKLOG-134, full closure)
**Completed BACKLOG-134's last untested pieces -- all three failure banners actually triggered via a simulated fetch failure, not just observed working in the happy path.**
- **Roster-load banner:** patched fetch to reject /api/teams, /api/players, /eligible-players, forced a fresh BasketballLogger mount (exit to match assignment, re-enter). Banner rendered exactly as written; team names/logos correctly blank. Restored fetch, confirmed normal load resumed on next mount.
- **Period-transition banner:** patched fetch to return 500 for the PATCH call, clicked End Quarter -> Start Quarter 2. Banner rendered with the correct message. DB-confirmed current_period stayed Q1 (write correctly never landed) despite the client's optimistic local Q2 display -- reloaded to resync.
- **Event-save banner (`eventSaveError`) -- the one carried forward since session 46 as "never actually tested":** patched fetch to reject the event POST specifically (simulated offline, not just a 500), logged a real Field Goal. Banner rendered with the correct message. DB-confirmed no phantom event/score landed.
- All probes cleaned up (fetch restored each time, one leftover test event deleted by exact id). Final DB check confirmed the real match exactly matches its original state (home_score: 2, away_score: 3, current_period: Q1, 2 events) -- no lasting changes from tonight's entire walkthrough.
- **New finding, filed as BUG-142 (not fixed):** confirmed live that none of these failures have any recovery path -- basketball has zero offline-queue/retry mechanism at all (unlike football's IndexedDB + service-worker drain). A failed write today is visible (thanks to tonight's fixes) but still permanently lost if the logger doesn't manually retry.
