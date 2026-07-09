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
