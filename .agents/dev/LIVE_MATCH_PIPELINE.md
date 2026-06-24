# Live Match Pipeline — Reference Document

_Documented: 2026-06-24. Verified by code trace + staging DB query during Session 29._

---

## 1. What a Live Match Is

A match row in `matches` with `status = 'LIVE'`. The logger is authenticated via a cookie-backed JWT (`{ id, email, role: 'logger' }`), has an active `match_logger_assignments` row, and is operating `FootballLogger.tsx` on a mobile device.

---

## 2. Event Logging Flow (The Core Loop)

Every action the logger takes (goal, foul, card, sub, penalty, own goal) goes through this path:

```
Logger taps event button in FootballLogger.tsx
  → POST /api/matches/[id]/events (with credentials:include)
      → getAuthUser(request) — verifies cookie JWT, queries loggers table
      → checks match_logger_assignments for active assignment
      → validates: type and minute required
      → inserts row into match_events
      → IF scoring event: updates matches.home_score / away_score
      → IF playerId present: calls updatePlayerStats()
      → IF match.status === 'LIVE': fires background POST to /api/matches/[id]/ratings
  → 201 response
  → Logger UI updates local score display
  → Public page picks up new score on next 15s poll
```

---

## 3. What Each Step Actually Updates

### match_events — always
Every logged event creates a row. Columns: `id`, `match_id`, `type`, `minute`, `second`, `team_id`, `player_id`, `related_player_id`, `detail`, `is_eye_point`, `value`, `logger_id`, `logger_name`, `period`, `created_at`.

### matches.home_score / away_score — scoring events only
Score update fires when `type.toUpperCase()` is `'GOAL'`, `'PENALTY'`, `'OWN GOAL'`, or when `value` is truthy.

Own Goal direction:
```
isHomeTeam = (teamId !== match.homeTeamId)  // teamId is the CONCEDING team
// So if the home team concedes an OG, isHomeTeam = false → away score goes up
```

### football_player_stats — partial, specific types only

Only these event types trigger a stat write:

| Event type   | Field incremented       |
|--------------|------------------------|
| `Goal`       | `goals`                |
| `Assist`     | `assists`              |
| `Yellow Card`| `yellow_cards`         |
| `Red Card`   | `red_cards`            |
| `Save`       | `saves`                |

**Not tracked in stats:** Penalty (increments score but not player goals), Own Goal (increments score but not player goals), Foul, Substitution, Corner, Free Kick, Shot, any other type.

Stats are **mutable cumulative increments** — there is no per-match breakdown and no rollback on event delete (BUG-060).

### player_ratings — fire-and-forget, non-blocking
A background `POST /api/matches/[id]/ratings` is fired but not awaited. Errors are swallowed. Runs only for `status === 'LIVE'`. Non-critical path.

### standings — NOT updated during event logging
Standings (`team_standings`, `/api/football/standings`, `/api/standings`) are computed at read time from `matches` rows (win/draw/loss counts). Nothing writes to standings during a live match. They update when the match reaches `FINISHED` and a standings query runs.

### head-to-head — NOT updated during event logging
Computed at read time from `matches`.

---

## 4. Period State — Current Gap (TD-010, CRITICAL)

Period transitions (First Half → HT → Second Half → FT) are **local only** — they live in React `useState` in FootballLogger. No server PATCH is sent. If the logger's phone refreshes or re-logs in mid-match:

- DB `status` remains `LIVE` — match is still live
- Logger UI resets to `NOT_STARTED` at 0:00
- Logger must manually restart the period
- Public page sees no change (status is still LIVE)
- Events logged after reload carry the wrong `period` field

**Fix (not yet built):** Add `current_period` column to `matches`. PATCH it on each period transition alongside the existing status PATCH. Read on FootballLogger mount and restore period display. Timer precision is not required — period label is what matters for event attribution.

---

## 5. Undo (Event Delete) Flow

```
Logger taps undo button
  → DELETE /api/matches/[id]/events?eventId=X
      → verifies auth + assignment
      → fetches event row before deleting
      → deletes match_events row
      → IF scoring event: decrements matches.home_score / away_score (min 0)
      → football_player_stats: NOT updated ← BUG-060
  → 200 response
```

**BUG-060:** `updatePlayerStats` is never called in reverse on delete. A deleted goal leaves the scorer's `football_player_stats.goals` permanently incremented. Also note: the undo score logic only checks `event.value || event.type.toUpperCase() === 'GOAL'` — it does not handle `'PENALTY'` or `'OWN GOAL'` separately. A deleted Penalty will not decrement the score correctly (BUG-054 mirror).

---

## 6. Match Status Lifecycle

```
PENDING / UPCOMING
  → LIVE (logger taps "Start Match" → PATCH { status: 'LIVE' })
      → events can be logged
      → score updates
      → player stats increment
  → FINISHED (logger taps "End Match" → PATCH { status: 'FINISHED' })
      → event logging still technically possible (no guard) but UI closes
      → standings update on next standings read
```

Allowed PATCH values: `['PENDING', 'UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED']`
Logger role restricted to: `['LIVE', 'FINISHED']` only (BUG-051 fix, commit `1824256`).

---

## 7. What Deleting a Match Does

Deleting the `matches` row triggers ON DELETE CASCADE on these child tables:

| Table                      | What gets deleted                        |
|----------------------------|------------------------------------------|
| `match_events`             | All events for this match                |
| `match_logger_assignments` | Logger assignment record                 |
| `player_ratings`           | Per-match player rating rows             |
| `match_comments`           | Any viewer comments (if any)             |
| `match_predictions`        | Any user predictions (if any)            |

**What does NOT cascade:**
- `football_player_stats` — stat increments are orphaned. Must be manually decremented before deleting if accuracy matters.
- `basketball_player_stats` — same.
- `team_standings` — recomputed at read time, not stored per match. Clean automatically.

---

## 8. Public Page Update Path (Flow C)

The public match page (`/matches/[id]`) polls `GET /api/matches/[id]` every 15 seconds. The response includes:
- `match.home_score`, `match.away_score` — from the `matches` row
- `events[]` — all `match_events` for this match, ordered by minute desc
- `stats` — computed in-memory from events on each request (not stored)
- `lineups` — from `matches.lineups` JSON column (set at lineup publish)

The public viewer sees score updates within 0–15 seconds of the event POST completing. Railway WebSocket server (`wss://brixsports-production.up.railway.app`) was intended for real-time push but is currently not used on staging (BACKLOG-027).

---

## 9. Player Stats — Design Question

### Current model (mutable aggregate)

One row per player per season in `football_player_stats`. Every event POST increments a counter. Fast to read, simple to query. No per-match breakdown. No rollback on delete.

```sql
SELECT goals, assists FROM football_player_stats 
WHERE player_id = 'X' AND season = '2024'
-- Returns: goals=12, assists=3
-- Cannot tell you: which matches those came from
```

### The gap this creates

- BUG-060: delete an event → score reverts, stat doesn't
- Test match cleanup: required a manual script to find and decrement dirty rows
- Penalty/OG: scores match correctly but player gets no stat credit
- No per-match breakdown: can't show "McAnthony: 2 goals vs COLNAS" in a match report

### Would linking stats to matches be overengineering?

No — but it depends on what form that takes.

**Option A — Event-sourced (compute everything on demand):**
Never store aggregates at all. `player.goals` = `SELECT COUNT(*) FROM match_events WHERE player_id=X AND type='Goal'`. Fast enough for this scale. Eliminates BUG-060 entirely. But expensive if you need it on every player card render.

**Option B — Per-match stat rows (recommended):**
A `match_player_stats` table: one row per player per match. Written atomically when the match ends (or updated per event). Season total = `SUM(goals) FROM match_player_stats WHERE season='2024'`. This is how every real sports system works.

```
match_player_stats
  id, match_id, player_id, team_id, season
  goals, assists, yellow_cards, red_cards, saves, minutes_played
```

Benefits:
- Full traceability: "which matches contributed to this stat?"
- Rollback is trivial: delete the row when a match is deleted (cascade)
- Per-match stat pages come for free
- BUG-060 disappears — delete event → recompute match_player_stats row

**Option C — Current model + rollback fix (minimal):**
Keep the aggregate, just add the decrement mirror in the DELETE handler. Solves BUG-060 immediately, costs one function. Still no per-match breakdown or cascade cleanup.

### Recommendation

Option C now (one session, fixes BUG-060). Option B as part of BACKLOG-019 (post-match pipeline). Option A is the eventual correct architecture but requires the most migration work. The current model is not wrong — it's just incomplete. The traceability question is real but not an immediate blocker for live match logging.

---

## 10. Known Gaps (Open Backlog Items)

| ID | Description | Status |
|----|-------------|--------|
| BUG-060 | Event delete does not decrement player stats | OPEN |
| TD-010 | Period state ephemeral — resets on phone refresh | CRITICAL — pre-match blocker |
| TD-011 | `season: '2024'` hardcoded in stat writes | OPEN |
| BACKLOG-019 | Post-match pipeline automation + stats restructure | OPEN |
| BACKLOG-058 | Offline queue end-to-end (Test 3 drain unverified) | UNVERIFIED |
