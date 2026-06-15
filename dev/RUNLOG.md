# BrixSports — DB Script Run Log

All one-off and reusable scripts that touch any database (staging or prod) are logged here.
Format: date | script | what it did | rows affected | environment

---

## Session 13 — 2026-06-15

### dev/query-col-teams.mjs (deleted after run)
- **Staging:** SELECT id, name, short_name, sport FROM teams WHERE name/short_name LIKE '%col%'. Read-only diagnostic.
- **Result:** 4 rows — CENG (College of Engineering), CENVS (College of Environmental Sciences), CMANS (College of Management Sciences), CNAS (College of Natural & Applied Sciences). All Football. short_name values are CENG/CENVS/CMANS/CNAS (no "col" in short_name — match comes from full name "College of...").

---

## Sessions 11-12 — 2026-06-14

### dev/patch-busalympics-scores.ts (deleted after run)
- **Staging:** PATCH `_9nntLoOZZOZGzja8EQE9` (MD3 G1: COLNAS 3–1 COLENVS) → FINISHED. PATCH `y3KcCGtHA7N7MybKTHX5K` (MD3 G2: COLMANS 0–1 COLENG) → FINISHED. PATCH `a9CtLwotaXyfsfMf2odAM` (MD2 G1 correction: COLNAS 1–2 COLENG) → score corrected. 3 rows affected.
- **Prod:** PATCH MD3 G1 and MD3 G2 only (MD2 G1 was already correct on prod). 2 rows affected.
- **Result:** All 7 BUSALYMPICS fixtures now FINISHED on both DBs.

### dev/recalculate-busalympics-standings.ts (deleted after run)
- **Staging + Prod:** Upserted 4 standings rows for `competitionId: 9q8LMVqW8KAtF4BJBlyk_`. Final excluded. Results: COLENG 6pts, COLNAS 3pts, COLMANS 3pts, COLENVS 0pts (GD tiebreaker to be confirmed).
- 4 rows affected per environment.

### SQL direct — ALTER TABLE (staging + prod)
```sql
ALTER TABLE player_team_affiliations ADD COLUMN nicknames TEXT DEFAULT '[]';
```
- Applied to staging first, verified, then prod. 0 rows affected (additive column, existing rows get default).

### SQL direct — CREATE UNIQUE INDEX (staging + prod)
```sql
CREATE UNIQUE INDEX pta_player_team_unique ON player_team_affiliations (player_id, team_id);
```
- Applied to staging first. Verified no duplicates existed before applying. Then prod.
- Index enforces one affiliation row per (player, team) pair. Application-layer dedup check remains as defence-in-depth.

---

## Session 10 — 2026-06-11

*(No DB scripts run this session — Three.js hotfix was code-only.)*

---

## Sessions 1-9 — see BUILD_JOURNAL.md for prior run history
