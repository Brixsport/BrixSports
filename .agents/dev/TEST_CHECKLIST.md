# BrixSports — Manual Test Checklist

Run this before every prod merge and after every 
major feature ship. Check off what passes, note 
what fails with a one-line description.

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
