# BrixSports — Manual Test Checklist

Run this before every prod merge and after every 
major feature ship. Check off what passes, note 
what fails with a one-line description.

---

## ⚠️ PENDING VERIFICATION — Fresh Staging Match (Session 34)

> Run all phases on a **single fresh test match** created after the current `dev` branch is deployed to staging. Do not reuse any existing match ID. Have a DB query script or MCP ready for evidence. Evidence = DB query output, not UI observation.

---

### PHASE 1 — Logger mount + match selection (BUG-062)

**What it proves:** `selectedMatchId` persists across refresh; fast path skips confirm screen when match already started.

- [ ] Open logger page, tap the test match — land on lineup confirm screen (match is NOT_STARTED, expected)
- [ ] Hard refresh **before** starting — expected: returns to match selection list (fast path not triggered, match hasn't started)
- [ ] Proceed to Phase 2, then come back and hard refresh **after** start
- [ ] ✅ After Start Match: hard refresh → logger resumes directly in active logging view (confirm screen NOT shown)

**Closes:** BUG-062

---

### PHASE 2 — Start match + FIRST_HALF persistence (TD-010)

**What it proves:** `current_period` is written to DB on Start Match and seeds `MatchStateManager` on remount.

- [ ] Tap "▶ Start Match" → Network tab: PATCH `/api/matches/[id]` returns 200
- [ ] DB check: `SELECT current_period FROM matches WHERE id = '<id>'` → `FIRST_HALF`
- [ ] Hard refresh logger tab
- [ ] ✅ Logger shows `FIRST_HALF`, clock running — NOT `NOT_STARTED` at 0:00

**Closes:** TD-010 (FIRST_HALF path)

---

### PHASE 3 — Lineup edit modal (BUG-077)

**What it proves:** `handleEditLineup` builds `starterIds` from `p.playerId` correctly — starters pre-highlighted.

- [ ] While in FIRST_HALF, tap the lineup edit button for either team
- [ ] ✅ Published starters show highlighted (primary colour) — NOT all greyed as SUB

**Closes:** BUG-077

---

### PHASE 4 — Event logging + undo (BUG-054, BUG-060, BUG-055, BUG-067, BUG-068)

**BUG-055 — non-scoring events don't touch score**
- [ ] Log a FOUL → DB check: `home_score` / `away_score` unchanged
- [ ] Log a YELLOW CARD → DB check: score unchanged

**BUG-054 + BUG-060 — GOAL undo (score + stat)**
- [ ] Log a GOAL for a named home team player
- [ ] DB before undo: `home_score` +1, player's `goals` +1 in `football_player_stats`
- [ ] Tap undo
- [ ] DB after undo: `home_score` back to prior value, player's `goals` back to prior value
- [ ] ✅ No ghost stat — both score and stat decremented

**BUG-054 + BUG-060 — OWN GOAL undo (correct team + stat)**
- [ ] Log an OWN GOAL for a home team player (should credit away team)
- [ ] DB before undo: `away_score` +1 (NOT `home_score`), player's `own_goals` +1
- [ ] Tap undo
- [ ] DB after undo: `away_score` back to prior, player's `own_goals` decremented
- [ ] ✅ Opponent's score was reverted — not the conceding team's

**BUG-067 + BUG-068 — sub picker pools + BENCH tag**
- [ ] Log a substitution: starter goes OFF, bench player comes ON
- [ ] Open sub-OUT picker for a second sub attempt
- [ ] ✅ Previously subbed-off player is absent from sub-OUT picker
- [ ] ✅ Incoming sub from previous sub does NOT show BENCH tag in sub-OUT picker
- [ ] Sub-IN picker does NOT include already-used subs

---

### PHASE 5 — Period transitions (TD-010 continued, BUG-063)

**HALF_TIME**
- [ ] Tap "⏸ End 1st Half" → PATCH fires → DB: `current_period = HALF_TIME`
- [ ] Hard refresh → ✅ logger shows HALF_TIME, not NOT_STARTED
- [ ] Public page (incognito): score header shows `HT` — not `LIVE`

**SECOND_HALF ← critical unverified path**
- [ ] Tap "▶ Start 2nd Half" → Network tab: PATCH returns 200
- [ ] DB check immediately: `current_period = SECOND_HALF`
- [ ] Hard refresh logger tab
- [ ] ✅ Logger resumes in active view at SECOND_HALF — NOT reset to NOT_STARTED
- [ ] Public page: score header shows `2ND HALF`

**Closes:** TD-010 (SECOND_HALF path — the one that was failing)

**BACKLOG-044 Phase B — timer ceiling**
- [ ] Confirm match clock stops at configured half duration (e.g. 45:00)
- [ ] Clock does not count past the ceiling

**Sub cap gate (if competition has maxSubstitutions set)**
- [ ] Log subs up to the cap for one team → attempt one more
- [ ] ✅ Alert: "Maximum substitutions reached for this team (N)" — no event logged
- [ ] Opposing team can still substitute

---

### PHASE 6 — End match + final state (BUG-076, BUG-078, BUG-063)

**BUG-076 — decisive match (different scores at 90')**
- [ ] Ensure home score ≠ away score at end of 2nd half before tapping End
- [ ] Tap "⏸ End 2nd Half" and confirm the modal
- [ ] DB check: `status = FINISHED`, `current_period = FINISHED` in a single PATCH
- [ ] ✅ Public page: shows `FT` badge — not `LIVE`, not `2ND HALF`

**BUG-078 — End Match button fallback (if scores level / PK path)**
- [ ] If match went to PK or ended level, tap "🏁 End Match" button manually
- [ ] DB check: `current_period = FINISHED` (not stuck at `PENALTY_SHOOTOUT` or `SECOND_HALF`)
- [ ] ✅ Public page: shows `FT`

**BUG-063 — all period labels on public page**
- [ ] Retrospectively confirm correct label was shown at each phase during the match:
  - FIRST_HALF → `1ST HALF` ✅/❌
  - HALF_TIME → `HT` ✅/❌
  - SECOND_HALF → `2ND HALF` ✅/❌
  - FINISHED → `FT` ✅/❌
- [ ] Homepage match card: showed correct period label during match, `FT` after finish
- [ ] Public page on initial load (no WS yet): showed `1ST HALF · N'` not blank or `LIVE`

**Closes:** BUG-076, BUG-078, BUG-063

---

### PHASE 7 — LiveStats (shape fix `7faaab9`)

- [ ] Open Stats tab on public match detail page while match is LIVE
- [ ] ✅ Shots, possession, fouls show real numbers — not 0 / `NaN%` / `5050%`

---

### PHASE 8 — Logger dashboard stats + match card date (BUG-044b, BUG-045)

> Can run independently, no live match needed.

**BUG-044b — Logger dashboard stats**
- [ ] Log in as a logger on `/logger`
- [ ] ✅ "Total Events" cell shows a real number (not `"-"`)
- [ ] ✅ "Logged Matches" cell shows a real number (not `"-"`)
- [ ] DevTools → Network: confirm `GET /api/loggers/me` returns 200 with `stats.totalEvents` and `stats.loggedMatches` fields
- [ ] DevTools: confirm `GET /api/loggers/me` does NOT return 401 (old endpoint used header auth — would have 401'd)

**BUG-045 — INVALID DATE guard**
- [ ] On the logger match list, check any match whose `startTime` is null or malformed
- [ ] ✅ Card shows `"Time TBC"` — not `"INVALID DATE"`
- [ ] ✅ Matches with valid `startTime` still render the correct time (regression check)

**Closes:** BUG-044b, BUG-045

---

### PHASE 9 — Event counter + tab overflow (BUG-065, BUG-064)

> BUG-065 requires a live match. BUG-064 can be checked on any match detail page on mobile.

**BUG-065 — Event counter in logger header**
- [ ] During a live match session, log 3 events
- [ ] ✅ Counter pill in the compact header shows `3` (not `0`, not blank)
- [ ] Log an undo → ✅ counter decrements to `2`
- [ ] Counter updates in real time without page refresh

**BUG-064 — Mobile tab overflow**
- [ ] Open any match detail page (`/matches/[id]`) on a mobile device or narrow viewport (≤ 390px)
- [ ] ✅ Tab bar (Overview / Timeline / Stats / Lineups / H2H) scrolls horizontally — no visible scrollbar chrome
- [ ] ✅ No tab content bleeds past the viewport edge
- [ ] Tapping a tab in the overflowed area still activates it correctly

**Closes:** BUG-065, BUG-064

---

### PHASE 10 — Auth rate limit (BUG-053)

> Can run independently, no match needed.

- [ ] Attempt logger login with wrong password 5 times from the same IP/device
- [ ] ✅ 6th attempt returns 429: `"Too many login attempts. Try again in 15 minutes."`
- [ ] Successful login on a fresh device/IP still works (confirm not globally blocked)

**Closes:** BUG-053

---

### PHASE 11 — iOS (run if iPhone available, BACKLOG-107, BUG-075)

**BACKLOG-107 — online/visibilitychange drain fallback**
- [ ] On iPhone Safari: log into logger, navigate to the test match
- [ ] Switch to Airplane Mode
- [ ] Log one event — confirm no crash, orange queued badge appears
- [ ] Switch Airplane Mode off — stay on the same tab (do NOT refresh)
- [ ] ✅ Within a few seconds: queued badge resets to 0 without any manual action
- [ ] DB check: event appears in `match_events`

**BUG-075 — manifest scope**
- [ ] On iPhone Safari: tap Share → "Add to Home Screen" option is present
- [ ] No `Manifest: property 'scope' ignored` warning in Safari console
- [ ] ✅ PWA installs and opens to `/admin` correctly from Home Screen

**Closes:** BACKLOG-107, BUG-075

---

### POST-TEST GATE

All phases passed → run prod migrations:
- [ ] `ALTER TABLE matches ADD COLUMN current_period TEXT DEFAULT 'NOT_STARTED'` — **already on staging, apply to prod**
- [ ] `ALTER TABLE football_player_stats ADD COLUMN own_goals INTEGER DEFAULT 0` — **apply to prod**
- [ ] `ALTER TABLE football_player_stats ADD COLUMN penalties_scored INTEGER DEFAULT 0` — **apply to prod**

Then update BACKLOG.md: move each passing SHIPPED item to RESOLVED, attach DB evidence block. Items that couldn't be tested → UNVERIFIED.

---

---

## Critical Flows (must pass before every prod merge)

### Flow A — Match Creation
- [ ] Admin can create a new match with two teams
- [ ] Logger can be assigned to the match
- [ ] Match appears on public /live page
- [ ] Match appears on homepage fixtures

### Flow B — Live Event Logging  
- [ ] Logger can log in and select assigned match
- [ ] Goal event increments score in real time
- [ ] Score update visible on public match detail page
- [ ] Yellow/red card event captured
- [ ] Substitution event captured

### Flow C — Public Livescore
- [ ] /live page shows current matches
- [ ] Match detail page loads without error
- [ ] Score updates without manual refresh (polling)
- [ ] WebSocket connected (check console — no WS errors)

---

## Admin Surfaces

### Matches
- [ ] /admin/matches loads full list
- [ ] Can create new match
- [ ] Can assign logger to match
- [ ] Can change match status

#### Match Overrides (BACKLOG-044 Phase A)
- [ ] Match creation form has collapsible "Override Match Settings for This Fixture"
- [ ] Extra Time override toggle: Inherit / On / Off (null/true/false)
- [ ] Penalties override toggle: same three states
- [ ] Allow Draws override toggle: same three states
- [ ] Overrides saved on match creation
- [ ] GET /api/matches/[id]/config reflects match-level override over competition setting

### Competitions
- [ ] /admin/competitions loads all competitions
- [ ] Can create new competition
- [ ] Can edit existing competition
- [ ] Competition detail shows enrolled teams

#### Match Settings (BACKLOG-044 Phase A)
- [ ] Competition modal has collapsible "Match Settings" section
- [ ] Match Duration field saves and reloads correctly
- [ ] Half Duration field saves and reloads correctly
- [ ] Players Per Side: Standard (11) / 5-aside / Custom selector works
- [ ] Custom option shows number input
- [ ] Max Substitutions field saves (null when Unlimited checked)
- [ ] Rolling Subs toggle ON hides Max Substitutions field
- [ ] Extra Time toggle ON saves correctly
- [ ] Penalties toggle saves correctly
- [ ] Allow Draws toggle saves correctly
- [ ] Points for Win / Points for Draw save correctly
- [ ] Edit mode loads existing match settings (not defaults)
- [ ] GET /api/competitions/[id]/match-settings returns saved values
- [ ] GET /api/matches/[id]/config returns merged config (match → competition → sport default)

### Teams — Roster Builder (BACKLOG-037)
- [ ] /admin/teams loads full team list (500 limit)
- [ ] Search by name finds team
- [ ] Search by shortName finds team (e.g. "CNAS" not "colnas")
- [ ] Sport filter works correctly
- [ ] /admin/teams/[id] loads with 4 tabs: Roster / Squad / CSV Import / Info

#### Squad tab — Affiliation Pool (BACKLOG-053 Part 1)
- [ ] Squad tab shows all playerTeamAffiliations rows for the team
- [ ] Player count matches expected roster size
- [ ] Pencil icon on a row opens inline edit fields (jerseyNumber, position, nicknames)
- [ ] Save on inline edit PATCHes `/api/admin/teams/[teamId]/roster/[affiliationId]`
- [ ] Saved changes persist on page refresh
- [ ] Cancel discards unsaved changes
- [ ] ADD PLAYERS TO POOL panel opens
- [ ] Existing player search returns results
- [ ] Existing player search matches on nickname
- [ ] Adding existing player inserts affiliation row
- [ ] Adding existing player already on team → skipped (not duplicated)
- [ ] New player form submits and creates profile + affiliation
- [ ] New player with duplicate name+college → flagged as possible_duplicate
- [ ] Submit results show per-row inserted/skipped/error

#### Roster tab — Competition Squad (BACKLOG-037 Step 7 + BACKLOG-053 Part 2)
- [ ] Roster tab shows competition dropdown populated from team's enrolled competitions
- [ ] Selecting a competition loads the dual panel
- [ ] Left panel (Available) shows players in affiliation pool not yet in squad
- [ ] Right panel (Squad) shows current squad players for that competition
- [ ] Clicking a player in Available moves them to Squad (POST to `/api/admin/teams/[teamId]/squad`)
- [ ] Remove button on squad player shows confirm step before DELETE
- [ ] Confirmed remove deletes from squad, player returns to Available
- [ ] Pencil icon on squad row opens inline squadNumber edit
- [ ] Saving squadNumber PATCHes `/api/admin/teams/[teamId]/squad/[squadPlayerId]`
- [ ] squadNumber persists on refresh
- [ ] Cross-team manipulation blocked — squad DELETE/PATCH for wrong teamId returns 403
- [ ] No competition selected → dual panel not shown

#### CSV Import tab (BACKLOG-037 Step 6)
- [ ] CSV Import tab visible on /admin/teams/[id]
- [ ] File upload accepts .csv only
- [ ] Parsed rows appear in preview table after upload
- [ ] High confidence match auto-resolves to existing (green badge)
- [ ] Medium confidence match shows pending state (yellow badge)
- [ ] No match defaults to Create New (grey)
- [ ] Pending rows block the Import button
- [ ] Invalid position (mode: new) highlights row red, blocks import
- [ ] Admin can link a pending row to existing player via search
- [ ] Admin can unlink a high-confidence match to Create New
- [ ] Import button POSTs to roster endpoint, shows results
- [ ] Inserted / skipped / error counts shown after import
- [ ] Squad tab refreshes after successful CSV import

### Players
- [ ] /admin/players loads player list
- [ ] Player search works
- [ ] "View" link on player row navigates to /admin/players/[id]

#### Player Profile Edit (BACKLOG-046)
- [ ] /admin/players/[id] loads with all profile fields populated
- [ ] Can edit name, jerseyName, number, position, college, university
- [ ] Can edit bio, nationality, DOB, height, weight, foot, rating
- [ ] Save PATCHes `/api/players/[id]` and shows success
- [ ] Memberships list shows correct organization affiliations
- [ ] Recent events section loads if player has match history
- [ ] Unauthenticated access to /api/players/[id] does NOT return email field (NDPR — BUG-029)
- [ ] Admin-authenticated request to /api/players/[id] DOES return email field

### Bulk Register
- [ ] Can register new team + players in one flow
- [ ] Existing player by email is reused (NPUGA path)
- [ ] Duplicate name+college triggers warning (Step 5)

### Organizations
- [ ] /admin/organizations loads

### Loggers
- [ ] /admin/loggers loads
- [ ] Can create new logger account

---

## Public Pages

### Homepage
- [ ] Loads without error
- [ ] Fixtures show with correct scores
- [ ] Team logos render (or initials fallback)
- [ ] No broken img tags in console

#### BACKLOG-036 — TeamLogo component
- [ ] Teams with no logo show initials fallback in: manager page, transfers, user profile, search results, livestreams, profile, logger, match lineups, live stats, match selector, global search, football logger
- [ ] Broken image URL triggers onError fallback (not broken img icon)
- [ ] Logo renders correctly when valid Cloudinary path is present

### Competitions
- [ ] /competitions lists all competitions
- [ ] BUSALYMPICS (Football) visible
- [ ] BUSA League Football visible
- [ ] Competition detail loads without hydration error
- [ ] Standings tab shows correct table
- [ ] BUSALYMPICS standings: CNAS 1st, CENG 2nd

### PWA (BUG-026 — hotfix shipped 2026-06-16)
- [ ] Direct URL visit (e.g. brixsports.com/competitions) loads with full styles — no unstyled flash
- [ ] Hard reload not required to get styles
- [ ] Browser console shows no 404 errors for JS chunks on first load
- [ ] After new deploy: clear SW cache manually → direct URL visit still loads correctly

### PWA — Logger SW Coverage (BACKLOG-093, shipped 2026-06-19)
- [ ] Navigate to `/logger/[match-id]` → DevTools → Application → Service Workers → confirm `sw-admin.js` is the active SW (not sw-user.js, not empty)
- [ ] Navigate to `/` (homepage) → confirm `sw-user.js` is still active there (no regression)
- [ ] Navigate to `/admin` → confirm `sw-admin.js` is active (unchanged)

### Start Match silent-failure fix (Session 27)
> Fix shipped (FootballLogger.tsx). PATCH now fires before local state transitions. Failure shows alert, re-enables button. Run this before BUG-047 and BACKLOG-058 — everything downstream depends on Start Match working.

**Setup:**
- Log in as a logger account
- Navigate to a PENDING match in the logger UI (`/logger` → select match)
- Open DevTools → Network tab

**Test A — Happy path:**
- Tap "▶ Start Match"
- Confirm button shows "Starting..." and is disabled while PATCH is in-flight
- Confirm PATCH `/api/matches/[id]` returns 200 in Network tab
- Confirm button disappears (replaced by "⏸ End 1st Half") — period flipped to FIRST_HALF
- Confirm event buttons are now unlocked
- Check DB: `matches.status = 'LIVE'` for this match ✓

**Test B — Failure path (simulate with DevTools):**
- Open DevTools → Network → block requests matching `/api/matches`
- Tap "▶ Start Match"
- Confirm button shows "Starting..." briefly
- Confirm an alert pops: "Couldn't start match — check connection and try again."
- Confirm button re-enables after the alert — period is still NOT_STARTED (clock has NOT started)
- Unblock network, tap again → should succeed as Test A

---

### End Match silent-failure fix (Session 27)
> Same ordering fix as Start Match, applied to `handleFinalize`. PATCH now fires before `transitionStatus('FINISHED')`. On failure: alert shown, local period stays in prior state (logger can retry). `isSaving` already correctly scoped to this handler — reused, no new state var.

**Setup:**
- Active LIVE match with events logged, logger session open
- Open DevTools → Network tab

**Test A — Happy path:**
- Tap "🏁 End", confirm the confirm dialog, click OK
- Confirm button shows "..." (isSaving) and is disabled during PATCH
- Confirm PATCH `/api/matches/[id]` returns 200
- Confirm `alert('Match finalized.')` appears
- Confirm period transitions to FINISHED, event buttons lock
- Check DB: `matches.status = 'FINISHED'` ✓

**Test B — Failure path:**
- Open DevTools → Network → block `/api/matches`
- Tap "🏁 End" and confirm
- Confirm `alert('Error saving match result.')` appears
- Confirm period is still in its prior state (NOT FINISHED) — logger can tap End again
- Unblock network, retry → should succeed as Test A

---

### BUG-047 — Penalty and Own Goal score update
> ⚠️ Code fix shipped (commit `5fbc3e5`) but **not yet exercised by a real logged event**. Run this before BACKLOG-058 tests.

**Setup:**
- Open Chrome on desktop (or Android Chrome)
- Log in as a logger account
- Navigate to a LIVE match in the logger interface (`/logger` → select match)
- Open DevTools → Network tab
- Note the current score before starting

**Test A — Penalty (normal play, not shootout):**
- Select a team and a player
- Tap the "Penalty" button (in the normal play event grid, not penalty shootout mode)
- Complete the penalty flow if a modal appears
- Network tab: confirm `POST /api/matches/[id]/events` returns 201
- Request body: confirm `type` field is `"Penalty"`
- Open `/api/matches/[id]` in a new tab (or check the public match page score)
- ✅ Score should have incremented by 1 for the team that took the penalty

**Test B — Own Goal:**
- Select the defending team (the team who scored the own goal)
- Tap the "OG" button
- Select the player who scored the OG
- Network tab: confirm `POST /api/matches/[id]/events` returns 201
- Request body: confirm `type` field is `"Own Goal"` and `teamId` is the defending team
- Open `/api/matches/[id]` or public page
- ✅ Score should have incremented by 1 for the **opposing** team (not the team in `teamId`)

---

### PWA — Logger Offline Event Queue (BACKLOG-058)
> ⚠️ Code shipped (commit `33d9b4d`, 2026-06-19) but **never tested end-to-end with working auth**. BUG-044 (auth cookie) was broken when this was shipped — `localStorage('authToken')` was never set so every queued event had `token: null` and the SW null-guard silently skipped them all. **Run BUG-047 tests above first, then proceed.**

**Setup:**
- Open Chrome on desktop (Android Chrome for the real mobile path)
- Log in as a logger account — after login, verify `localStorage.getItem('authToken')` is a real JWT string (DevTools → Application → Local Storage → check `authToken` key exists and is non-empty)
- Navigate to a LIVE match in the logger interface
- Open DevTools with three tabs ready: Network, Application → IndexedDB → `BrixsportAdminDB`, Application → Service Workers

**Test 1 — Online path (nothing should queue):**
- Log an event (e.g. a goal)
- Network tab: confirm `POST /api/matches/[id]/events` returns 200/201
- Application → IndexedDB → `BrixsportAdminDB` → `pendingMatchEvents` → should be empty
- No orange "N Queued" badge should appear

**Test 2 — Offline path (queue wires up):**
- DevTools → Network → throttle dropdown → **Offline**
- Log a goal
- Confirm: no crash, no unhandled console error
- Confirm: orange "N Queued" badge appears in logger status bar
- Application → IndexedDB → `BrixsportAdminDB` → `pendingMatchEvents` → one row should exist
- Inspect the row: confirm `matchId`, `data`, `token`, `timestamp` fields are all present
- Confirm `token` is a real non-null JWT string (not `null`, not `undefined`, not empty)

**Test 3 — Drain:**
- Set Network back to **Online**
- Application → Service Workers → find `sync-match-events` → click **Sync** (or wait for background sync to fire automatically — may take a few seconds)
- Confirm: row disappears from `pendingMatchEvents` in IndexedDB
- Confirm: orange badge resets to 0
- Confirm: event appears on the match — check the public match page or call `/api/matches/[id]/events` directly

**Test 4 — Expiry guard (temporary code edit, do NOT commit):**
- In `src/components/FootballLogger.tsx`, find the `jwtSecondsRemaining(token) < QUEUE_MIN_TTL_SECONDS` check in the offline catch block
- Temporarily change `QUEUE_MIN_TTL_SECONDS` (or the threshold inline) from `30 * 60` to `9999999`
- Save — let dev server hot-reload
- Set Network → **Offline** → log a goal
- Confirm: an alert fires with the "token expiring soon" message
- Confirm: `pendingMatchEvents` in IndexedDB has **no new row** (event was refused, not queued)
- **Revert the threshold change before any commit**

**Auth guard (skip not 401-storm):**
- If a row somehow has no token, confirm SW console shows `[SW Admin] Skipping event … — no token stored` and no 401 appears in Network tab

**iOS Safari note (known limitation — do not file as bug):**
- Background Sync API not supported on iOS Safari — queued events will not auto-drain. Logger must return to the page online to trigger drain. Not a regression.

#### BUG-027 — Competitions page sport filter
- [ ] All tab shows all competitions including sport=null
- [ ] Football tab shows only Football + isMultiSport competitions
- [ ] Basketball tab shows only Basketball competitions
- [ ] Switching tabs selects first competition in that sport
- [ ] Empty tab (no competitions for sport) shows empty state gracefully

#### BUG-028 — Competition standings page
- [ ] Standings page loads without hydration warning in browser console
- [ ] Table rows animate in without opacity flash on first paint
- [ ] Mobile cards animate without position flash on first paint

### Match Detail
- [ ] /matches/[id] loads without 500 error
- [ ] Score displays correctly
- [ ] Timeline tab shows events
- [ ] No Rules of Hooks errors in console

#### Period label (BUG-063 — shipped `ea4a1d5`, pending live verification)
> Full test steps in the ⚠️ PENDING VERIFICATION section at the top of this file.
- [ ] Page load (no WS): score header shows `1ST HALF · N'` not blank or `LIVE`
- [ ] During active play (WS live): score header shows `● 1ST HALF · 33'`
- [ ] Half time: score header shows `HT`, no minute
- [ ] Overview Status card: shows period label, not raw `LIVE`

### Teams
- [ ] /teams loads team list
- [ ] /teams/[id] loads team detail

### Players
- [ ] /players/[id] loads player profile

---

## Auth

- [ ] /login works with valid credentials
- [ ] /login rejects invalid credentials
- [ ] Admin routes redirect to /login when unauthenticated
- [ ] Logger routes redirect when unauthenticated
- [ ] Public routes accessible without login

---

## Security (run pre-prod-check.ts instead of manual)

- [ ] npx tsx dev/pre-prod-check.ts --staging → 20/20
- [ ] npx tsx dev/pre-prod-check.ts --production → 20/20

### NDPR Regression Checks
- [ ] `GET /api/matches` (unauthenticated) — response does NOT contain `loggerId`, `assignedLoggers`, `approvalStatus`, `managerNotes` (BUG-025)
- [ ] `GET /api/players/[id]` (unauthenticated) — response does NOT contain `email` (BUG-029)
- [ ] `GET /api/matches/[id]` (unauthenticated) — response does NOT contain `loggerId`, `approvedBy`, `approvalStatus`, `managerNotes` (BUG-018)
- [ ] `GET /api/matches` (admin-authenticated) — response DOES contain `loggerId` for admin use

---

## Known Broken (do not test — already filed)

- ~~PWA CSS / stale SW chunk URLs on direct URL visit (BUG-026)~~ — **FIXED 2026-06-16** (no-store headers + document bypass + cache version bump)
- Email sending broken — AWS SES misconfigured (BACKLOG-026)
- Google OAuth staging not configured (BACKLOG-025)
- Railway WS on staging not created (BACKLOG-027)

---

## After Each Session — What to Verify

New feature shipped → add its test cases to this file
Bug fixed → move from Known Broken to the relevant section
Pre-prod merge → run all Critical Flows + Security checks
