# BrixSports — Context Transfer: Session 3 (Phase 4)
Date: 2026-06-07
Session commit: 7eb270f

---

## What Was Completed This Session

### Phase 2 Close (carried in from previous session)
- Committed all Phase 2 bug sprint work (BUG-001 through BUG-012)
  as a single clean commit at session start.
- Deleted orphaned `UNIFIED_EVENT_PANEL.tsx` and
  `UNIFIED_EVENT_PANEL_COMPLETE.tsx` from project root — were
  causing 150+ noise errors in every `tsc` run. Confirmed
  `tsc --noEmit` exits 0 after deletion.

### Phase 4 — Bells Intercollege Live Data

**BACKLOG-007 — College team org links** ✓
- Ran `dev/fix-backlog007.ts`
- Set `ownerOrganizationId` on 4 previously-orphaned college teams:
  - `mhXc8I0hBxe5W6eCw3do9` (College of Natural & Applied Sciences) → `org_org_bells-university-colnas`
  - `k6BgZFG_mtatQ11NZNQb9` (College of Engineering) → `org_org_bells-university-coleng`
  - `ISzKeGGXuvW2h5QGmnWcp` (College of Management Sciences) → `org_org_bells-university-colmans`
  - `U6R7aZSXNvA0iMsdVi3XV` (College of Environmental Sciences) → `org_org_bells-university-colenvs`
- Verified via SELECT after each update.

**BACKLOG-008 — Competition enrolment** ✓
- Ran `dev/fix-backlog008.ts`
- Inserted 4 rows into `competition_team_entries`:
  - All 4 college teams enrolled in BUSALYMPICS (`9q8LMVqW8KAtF4BJBlyk_`)
  - `sport: Football`, `gender: male`, `status: registered`, `groupName: null`

**Player affiliations** ✓
- Ran `dev/fix-college-affiliations.ts`
- Inserted 68 `playerTeamAffiliations` rows linking students to their
  college teams. Players already existed in DB as BUSA club players —
  no new player profiles were created:
  - COLNAS: 21 players
  - COLENG: 34 players
  - COLMANS: 7 players
  - COLENVS: 6 players
- `affiliationType: 'college'`, `isPrimary: false`, `isActive: true`
- Dedup-checked per row before insert. Script hit a Turso timeout
  mid-COLENG on first run; safe re-run completed correctly (1 retry insert,
  rest skipped via dedup). Final verification: all 4 counts confirmed ✓

**4 BUSALYMPICS match fixtures** ✓
- Ran `dev/fix-match-fixtures.ts`
- All matches: `competitionId: 9q8LMVqW8KAtF4BJBlyk_`, `competition: BUSALYMPICS`,
  `venue: Bells University Sport Complex`, `sport: Football`,
  `matchType: competition`, `status: FINISHED`, `approvalStatus: PENDING`

| Match ID | Label | Result | Date |
|----------|-------|--------|------|
| `OPoEtVGUNWKcRSDe4QdSr` | MD1 G1: COLNAS vs COLMANS | 2–1 | 2026-04-17 |
| `tyYRU5nlOrqnEXEpvIEC6` | MD1 G2: COLENG vs COLENVS | 2–3 | 2026-04-18 |
| `nDns_3mSI23jERQJhMNli` | MD2 G2: COLMANS vs COLENVS | 2–1 | 2026-04-24 |
| `_lkHo5y1m6ArqvLsi1ixe` | FINAL: COLNAS vs COLENG | 5–0 | 2026-05-01 |

### Backlog Items Filed This Session
- **BUG-013** — `POST /api/players/bulk-register` has no `getAuthUser`
  check or admin role verification. Open, unresolved.
- **BACKLOG-015** — `/admin/organizations` has no detail/drill-down page.
  Schema relations already support every join needed.
- **BACKLOG-016** — Roster Builder: replace/supplement bulk-register with
  proper team roster management (existing player search + new player
  creation + CSV import with preview + player name mapping UI). Includes
  DB unique constraint on `(playerId, teamId)` as foundational step.
- **BACKLOG-017** — 3 missing BUSALYMPICS match scores. HIGH PRIORITY —
  blocking standings. See flags section below.
- **BACKLOG-018** — Game event logsheets for BUSALYMPICS. Blocked by
  BACKLOG-016 (player name mapping UI needed before entering events).
- **BACKLOG-019** — Post-match lifecycle audit + automation. Full chain:
  goal → matchEvents → score → standings → playerStats → ratings.
  Map automated vs manual, then implement FINISHED hook. Blocked by
  staging environment.

---

## Current DB State

| Entity | Count / State |
|--------|--------------|
| Total players | 179 |
| College team org links | 4 ✓ (all set this session) |
| `competition_team_entries` for BUSALYMPICS college teams | 4 ✓ |
| `playerTeamAffiliations` (college type) | 68 ✓ |
| BUSALYMPICS fixtures | 4 inserted (FINISHED) |
| BUSALYMPICS standings | 0 rows — not yet calculated |
| `matchEvents` for BUSALYMPICS | 0 rows — no events entered yet |
| BUSA-owned teams (via org) | 0 — BUSA teams use legacy slug IDs, not org ownership |

### Competition: BUSALYMPICS (`9q8LMVqW8KAtF4BJBlyk_`)
- Status: completed
- 4 of 7 fixtures inserted (3 missing — see BACKLOG-017)
- Known results:
  - MD1: COLNAS 2–1 COLMANS
  - MD1: COLENVS 3–2 COLENG
  - MD2: COLMANS 2–1 COLENVS
  - Final: COLNAS 5–0 COLENG
- Missing results (scores not yet confirmed from physical records):
  - MD2: COLNAS vs COLENG (2026-04-22, 16:30)
  - MD3: COLNAS vs COLENVS (2026-04-26, 16:00)
  - MD3: COLMANS vs COLENG (2026-04-29, 16:00)

---

## What's Next

**Immediate (next session start):**
1. **BACKLOG-017** — Confirm the 3 missing BUSALYMPICS scores from
   physical records / match organisers. Insert fixtures using
   `dev/fix-match-fixtures.ts` as the template. This unblocks standings.
2. **Standings calculation** — Once all 7 fixtures are in, run or build
   the standings recalculation for BUSALYMPICS. Check if a standings
   endpoint/admin trigger already exists before building new.
3. **Phase 5 planning** — System audit: map every module, feature,
   route, API endpoint, DB table. Tag as Working / Partial / Broken /
   Not Built. This is BACKLOG-005 Phase 5 and is the prerequisite for
   everything else in Phase 5.

**Do not touch without staging (BACKLOG-019):**
- Post-match automation hooks (standings + stats on FINISHED transition)
- Any change to the backfill system until BUG-011 (718 goals) is resolved

---

## Active Flags (carry into next session)

| Flag | Severity | Detail |
|------|----------|--------|
| **BACKLOG-017 HIGH PRIORITY** | 🔴 Blocking | 3 missing BUSALYMPICS scores — standings cannot be calculated until all 7 fixtures exist |
| **BACKLOG-018 blocked** | 🟡 Waiting | Blocked by BACKLOG-016 (Roster Builder + player name mapping UI) |
| **BACKLOG-019 blocked** | 🟡 Waiting | Blocked by Phase 1 staging environment — do not run on prod |
| **BUG-013 open** | 🔴 Security | `POST /api/players/bulk-register` has no auth gate — unauthenticated player creation possible |
| **BUG-011 open** | 🔴 Data integrity | 718 goals anomaly in playerStats — investigation only so far, no writes. Run dedup audit before any backfill |
| **dev/ gitignored** | ℹ️ Note | All scripts in `dev/` are gitignored. Audit trail is maintained in PROJECT_HISTORY.md only. Script names preserved there for reference |
| **Repo should be private** | 🔴 Security | Confirm GitHub repo is private before any further data work |
| **3 missing match scores** | 🔴 Blocking | MD2: COLNAS vs COLENG · MD3: COLNAS vs COLENVS · MD3: COLMANS vs COLENG |

---

## Key Architecture Notes (learned this session)

### Organization vs Team distinction
- `organizations` = institutional bodies (COLENG as a faculty). Can host/govern
  competitions, own teams, have a parent-child hierarchy.
- `teams` = football squads that play matches, accumulate standings, have rosters.
- Link: `teams.ownerOrganizationId` → `organizations.id`
- Competition hosting: `competitions.hostOrganizationId` → `organizations.id`
- A college organising Dean's Cup uses the org as host; its football squad
  enters as a team. Clean separation — orgs never play, teams never host.

### Player affiliation model (three layers)
1. `players.teamId` — legacy direct FK, now optional. Still set by bulk-register.
2. `playerTeamAffiliations` — preferred. Supports multi-team players.
   No DB-level unique constraint on `(playerId, teamId)` — dedup is app-level only.
   This is a known gap (BACKLOG-016 step 1).
3. `playerOrganizationAffiliations` — institutional membership (college, dept).
   Used this session to identify which students belong to which college.

### Turso connection behaviour
- Turso times out under load on sequential round trips (~68 individual queries).
- Scripts should batch operations or retry gracefully.
- The college affiliation script hit a `ConnectTimeoutError` mid-COLENG on
  first run. Re-run with dedup check recovered cleanly.

### Matches table: minimum required fields for insert
```
id, sport, homeTeamId, awayTeamId, startTime, venue, competition
```
- `competitionId` should always be set alongside `competition` string (legacy).
- `id` is not auto-generated — must be supplied (use `nanoid()`).
- `status` defaults to `UPCOMING` — must be set explicitly to `FINISHED`.

---

## Richard's Working Style (carry forward)

- **Read before write, always.** Richard expects a DB read + result display
  before any insert/update script is proposed. Never propose writes without
  first showing what the data looks like.
- **Show the plan before running it.** Describe the exact rows to be written
  and their values. Get implicit confirmation (or explicit "go") before executing.
- **Exact IDs only.** Never infer or approximate IDs. Query them from the DB
  and use the returned values verbatim.
- **Verification is mandatory.** Every write script must SELECT back and confirm.
  Show counts and key fields. Richard reads the verification output before moving on.
- **Commit discipline.** Stage and commit after every completed feature/fix block.
  Never leave uncommitted work across context switches.
- **No silent execution.** Every implementation must output exactly what it did:
  inserted N, skipped N, confirmed N. Never run silently.
- **Backlog as source of truth.** Every discovered issue, future feature, and
  flag gets filed immediately into BACKLOG.md. Richard reads it at session start.
- **Parallel where possible.** Richard expects reads, backlog writes, and DB
  queries to run in parallel when there are no dependencies between them.
- **No re-explaining decisions.** Once a concept is understood (org vs team,
  affiliation model), move forward. Don't re-explain on subsequent references.
- **Scripts go in `dev/` — gitignored.** Audit trail in PROJECT_HISTORY.md only.
- **Structured output every time.** Always output: what was done, counts, what's
  next. Richard uses the session output to brief the next session.
