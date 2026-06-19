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

### PWA — Logger Offline Event Queue (BACKLOG-058, shipped 2026-06-19)
**Online path (no queue should be used):**
- [ ] Logger logs a goal while online → Network tab shows POST to `/api/matches/[id]/events` succeeds (200/201)
- [ ] DevTools → Application → IndexedDB → `BrixsportAdminDB` → `pendingMatchEvents` → empty after successful online log
- [ ] Orange "N Queued" badge does NOT appear during normal online logging

**Offline path (queue wired correctly):**
- [ ] DevTools → Network → set Offline → log a goal → no crash, no unhandled error in console
- [ ] Orange "N Queued" badge appears in logger status bar (count increments per queued event)
- [ ] DevTools → IndexedDB → `BrixsportAdminDB` → `pendingMatchEvents` → row exists with `matchId`, `data`, `token`, `timestamp` fields populated
- [ ] `token` field in the row is a non-empty JWT string (not null, not undefined)

**Drain / sync path:**
- [ ] Set Network back to Online
- [ ] DevTools → Application → Service Workers → click "sync" next to `sync-match-events` (or wait for background sync to fire)
- [ ] `pendingMatchEvents` row is deleted from IndexedDB after successful drain
- [ ] Orange badge resets to 0
- [ ] Event appears in the match (confirm via `/api/matches/[id]/events` or public match page score)

**Auth guard (tokenless row protection):**
- [ ] If a row somehow has no token, confirm SW console shows `[SW Admin] Skipping event … — no token stored` (not a 401 error in Network tab)

**Expiry-guard path (< 30 min remaining → refuse to queue):**
- [ ] In `FootballLogger.tsx`, temporarily change the threshold constant from `30 * 60` to `9999999` (do NOT commit)
- [ ] Set Network → Offline → log a goal
- [ ] Confirm an alert fires with the "token expiring soon" message
- [ ] Confirm DevTools → IndexedDB → `BrixsportAdminDB` → `pendingMatchEvents` → row was NOT written
- [ ] Revert the threshold change before any commit

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
