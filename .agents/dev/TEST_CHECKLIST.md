# BrixSports — Manual Test Checklist

Run this before every prod merge and after every major feature ship.
Check off what passes. Evidence = DB query output, not UI observation.

---

## ⚠️ PENDING VERIFICATION — Next Staging Test Match

> Run all phases on a **single fresh test match** created after current `dev` branch is deployed to staging. Have a DB query script or MCP ready for evidence.

---

### PHASE 1 — Logger mount + match selection (BUG-062) ✅ RESOLVED session 34

- [x] Hard refresh after start → logger resumes directly in active logging view
- [x] `selectedMatchId` persists across refresh — confirm screen NOT shown when match started

---

### PHASE 2 — Start match + FIRST_HALF persistence (TD-010) ✅ RESOLVED session 34

- [x] PATCH `/api/matches/[id]` → 200 on Start Match
- [x] DB: `current_period = FIRST_HALF`
- [x] Hard refresh → logger shows FIRST_HALF, clock running

---

### PHASE 3 — Lineup edit modal (BUG-077) ✅ RESOLVED session 34

- [x] Published starters show highlighted — NOT all greyed as SUB

---

### PHASE 4 — Event logging + undo (BUG-054, BUG-060, BUG-055) ✅ RESOLVED session 34

- [x] FOUL → score unchanged
- [x] GOAL undo → score + stat both decremented correctly
- [x] OWN GOAL undo → opponent's score reverted, not conceding team

---

### PHASE 5 — Period transitions (TD-010, BUG-063) ✅ RESOLVED session 34

- [x] HALF_TIME → DB `current_period = HALF_TIME`, hard refresh survives
- [x] SECOND_HALF → DB write correct, logger resumes after hard refresh
- [x] Public page: period labels correct at each phase (1ST HALF / HT / 2ND HALF)
- [x] Timer ceiling stops at configured half duration

---

### PHASE 6 — Sub picker pools (BUG-067) ✅ RESOLVED session 34 / BACKLOG-106 SHIPPED session 35

- [x] Subbed-off player absent from sub-OUT picker
- [ ] **NEW — BACKLOG-106 scenario A (same session):** Log a sub → immediately open general event picker (fouls, goals, cards) → ✅ subbed-on player visible, shows 11 not 10
- [ ] **NEW — BACKLOG-106 scenario B (tab close):** Log a sub → close tab entirely → reopen logger → open general event picker → ✅ shows 11 (DB seed path)
- [ ] **NEW — BACKLOG-106 scenario C (hard refresh):** Log a sub → hard refresh → open general event picker → ✅ shows 11 (localStorage path)
- [ ] **Assist picker:** After a goal, open assist picker → ✅ subbed-on player visible

**Closes:** BACKLOG-106 (all 3 scenarios must pass)

---

### PHASE 7 — End match + final state (BUG-076, BUG-078, BUG-063) ✅ RESOLVED session 34

- [x] End 2nd half → DB: `status = FINISHED`, `current_period = FINISHED`
- [x] Public page: shows `FT` badge
- [x] All period labels correct retrospectively (1ST HALF / HT / 2ND HALF / FT)

---

### PHASE 8 — LiveStats (shape fix) ✅ RESOLVED session 34

- [x] Stats tab on public page: real numbers — not 0 / NaN% / 5050%

---

### PHASE 9 — Logger dashboard stats + match card (BUG-044b, BUG-045) ✅ RESOLVED session 34

- [x] "Total Events" and "Logged Matches" cells show real numbers
- [x] Match cards with null startTime show "Time TBC" — not "INVALID DATE"

---

### PHASE 10 — Event counter + tab overflow (BUG-065, BUG-064) ✅ RESOLVED session 34

- [x] Event counter pill increments live with each logged event
- [x] Tab bar scrolls horizontally on mobile with no scrollbar chrome bleed

---

### PHASE 11 — Auth rate limit (BUG-053) ✅ RESOLVED session 34

- [x] 6th bad login attempt returns 429 within 15 min window

---

### PHASE 12 — Public page polling fallback (BUG-080) SHIPPED session 35

> Requires Railway WS to be confirmed DOWN to test the fallback path properly.
> Can simulate by setting `NEXT_PUBLIC_WS_URL` to a dead URL on staging.

- [ ] Open `/matches/[id]` for a LIVE match while WS is confirmed disconnected
- [ ] Score header still shows green "Live" dot
- [ ] Log an event via the logger → within 10 seconds, public page score updates without manual refresh
- [ ] Amber toast fires once: *"Live updates paused — refreshing automatically"* — auto-dismisses
- [ ] WS reconnects → green toast fires once: *"Live updates restored"* — auto-dismisses
- [ ] No toast spam if WS flaps rapidly (amber fires once per disconnect cycle, not per flap)

**Closes:** BUG-080

---

### PHASE 13 — iOS PWA install (BACKLOG-107, BUG-075) SHIPPED session 35

> Requires a real iPhone with Safari.

**BACKLOG-107 — online/visibilitychange drain fallback**
- [ ] On iPhone Safari: log into logger, navigate to the test match
- [ ] Switch to Airplane Mode
- [ ] Log one event — no crash, queued badge appears
- [ ] Switch Airplane Mode off — stay on same tab (do NOT refresh)
- [ ] ✅ Within a few seconds: queued badge resets to 0 without manual action
- [ ] DB check: event appears in `match_events`

**BUG-075 — logger manifest + correct install target**
- [ ] On iPhone Safari: navigate to `/logger` → tap Share → "Add to Home Screen" option is present
- [ ] Install the PWA
- [ ] ✅ PWA launches to `/logger` — NOT `/admin` (was broken before session 35 fix)
- [ ] Logger session works normally from the Home Screen install
- [ ] Navigate to `/` (viewer) → install separately → ✅ viewer PWA launches to `/` (no regression)

**Closes:** BACKLOG-107, BUG-075

---

### PHASE 14 — Sub cap gate (BACKLOG-044 Phase B) ✅ RESOLVED session 34

- [x] Alert fires at sub cap limit; opposing team can still substitute

---

## Critical Flows (must pass before every prod merge)

### Flow A — Match Creation
- [ ] Admin creates match with two teams
- [ ] Logger assigned to match
- [ ] Match appears on public `/live` page and homepage fixtures

### Flow B — Live Event Logging
- [ ] Logger logs in, selects assigned match
- [ ] Goal increments score in real time
- [ ] Score update visible on public match detail page
- [ ] Yellow/red card, substitution captured

### Flow C — Public Livescore
- [ ] `/live` page shows current matches
- [ ] Match detail loads without error
- [ ] Score updates without manual refresh (polling every 10s when WS down, WS push when up)

---

## Admin Surfaces

### Matches
- [ ] `/admin/matches` loads full list
- [ ] Create new match, assign logger, change status

#### Match Settings (BACKLOG-044 Phase A)
- [ ] Competition modal Match Settings section saves and reloads correctly (BUG-079 ✅ fixed session 34)
- [ ] Half duration, max subs, extra time, penalties, allow draws all persist on edit reopen
- [ ] Match creation override panel shows inherited values from competition

### Competitions
- [ ] Create and edit competition
- [ ] Competition detail shows enrolled teams

### Teams — Roster Builder (BACKLOG-037)
- [ ] `/admin/teams/[id]` — Squad tab, Roster tab, CSV Import tab, Info tab

### Players
- [ ] Player search, profile edit, NDPR field check (email not in public response)

### Loggers
- [ ] Create logger account, dashboard stats show correctly

---

## Public Pages

### Homepage
- [ ] Loads without error, fixtures with correct scores, team logos render

### Competitions
- [ ] List loads, standings correct (CNAS 1st, CENG 2nd for BUSALYMPICS Football)

### Match Detail
- [ ] `/matches/[id]` loads, score correct, Timeline tab no crash
- [ ] Period label correct at each phase

### PWA — Service Worker Coverage
- [ ] `/logger` → `sw-admin.js` active (not sw-user.js)
- [ ] `/` → `sw-user.js` active (no regression)
- [ ] `/admin` → `sw-admin.js` active

---

## Auth

- [ ] Login works, invalid credentials rejected
- [ ] Admin routes redirect when unauthenticated
- [ ] Logger routes redirect when unauthenticated
- [ ] Public routes accessible without login

---

## Security

- [ ] `npx tsx dev/pre-prod-check.ts --staging` → 20/20
- [ ] `GET /api/matches` (unauth) — no `loggerId`, `assignedLoggers`, `approvalStatus`, `managerNotes`
- [ ] `GET /api/players/[id]` (unauth) — no `email`

---

### PHASE 15 — Second yellow cascade undo (BUG-072) SHIPPED `238e4ec` + WS fix `6feb3e5`

**Pre-req:** Railway WS up, live match in LIVE period, player with one Yellow Card already logged.

- [ ] Log a second Yellow Card for the same player → confirm Red Card auto-appears in event feed
- [ ] Tap Undo → confirm **both** Red Card and Yellow Card disappear from logger event feed
- [ ] Confirm DB: `GET /api/matches/[id]/events` returns neither the Red nor the Yellow for that player
- [ ] Confirm public page `/matches/[id]`: **both** cards removed from timeline (WS undo broadcast for Yellow now fires separately — verify it clears)
- [ ] Undo with no preceding Yellow for that player (edge case) → confirm only Red Card is removed, no error

**Closes:** BUG-072

---

### PHASE 16 — Penalty outcomes: Missed / Saved (BACKLOG-104) SHIPPED `10d90d7`

**Pre-req:** Railway WS up, live match in LIVE period, lineup set for both teams.

- [ ] Log a penalty → select **Missed** outcome → confirm `Penalty Missed` event in feed, score unchanged
- [ ] Log a penalty → select **Saved** outcome → keeper picker appears → select a keeper → confirm `Penalty Saved` event in feed, score unchanged
- [ ] Log a penalty → select **Saved** → tap "Skip / Unknown" → confirm event logs with no keeper linked (`relatedPlayerId` null in DB)
- [ ] Confirm push notification fires for Penalty Saved (keeper name as headline) and Penalty Missed
- [ ] Confirm public timeline shows 🛡️ amber icon for Penalty Saved, ❌ red for Penalty Missed
- [ ] DB check: taker `shotsOffTarget++` on Missed; taker `shotsOnTarget++` + keeper `saves++` on Saved (if keeper selected)
- [ ] Log Penalty Saved during PENALTY_SHOOTOUT period → confirm keeper `saves` stat NOT incremented (shootout guard)

**Closes:** BACKLOG-104

---

### PHASE 17 — Stat reversion on event undo (BACKLOG-111) SHIPPED `f44edfa`

**Pre-req:** Railway up, competitive (non-friendly) match, player stats row exists.

- [ ] Log a Goal → note DB `footballPlayerStats.goals` for that player → Undo → confirm `goals` decremented by 1, `shotsOnTarget` decremented by 1
- [ ] Log an Assist → Undo → confirm `assists` decremented
- [ ] Log a Penalty Saved (with keeper) → Undo → confirm taker `shotsOnTarget--`, keeper `saves--`
- [ ] Log a Yellow Card → Undo → confirm `yellowCards--`
- [ ] Log an event on a **friendly** match → Undo → confirm stats row unchanged (friendly guard)
- [ ] Simulate a stat DB failure (if possible in staging) → confirm logger still gets 200, event is gone, Sentry logs the error (try/catch guard — fix `6feb3e5`)

**Closes:** BACKLOG-111

---

## Known Broken / Deferred (do not test)

- Railway WS staging dead — BUG-074 OPEN. Infra decision pending.
- BACKLOG-105 full penalty shootout — interim guard only, full implementation open
- BUG-011 playerStats corruption — do not run any stat backfill until resolved
- Email sending broken — AWS SES misconfigured (BACKLOG-026)
