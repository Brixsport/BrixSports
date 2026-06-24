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
