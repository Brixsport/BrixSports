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

### Competitions
- [ ] /admin/competitions loads all competitions
- [ ] Can create new competition
- [ ] Can edit existing competition
- [ ] Competition detail shows enrolled teams

### Teams — Roster Builder (BACKLOG-037)
- [ ] /admin/teams loads full team list (500 limit)
- [ ] Search by name finds team
- [ ] Search by shortName finds team
- [ ] Sport filter works correctly
- [ ] /admin/teams/[id] loads team roster
- [ ] Roster shows correct player count
- [ ] ADD PLAYERS panel opens
- [ ] Existing player search returns results
- [ ] Existing player search matches on nickname
- [ ] Adding existing player inserts affiliation row
- [ ] Adding existing player already on team → skipped
- [ ] New player form submits and creates profile
- [ ] New player with duplicate name+college → flagged
- [ ] Submit results show per-row inserted/skipped/error

### Players
- [ ] /admin/players loads player list
- [ ] Player search works

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

### Competitions
- [ ] /competitions lists all competitions
- [ ] BUSALYMPICS (Football) visible
- [ ] BUSA League Football visible
- [ ] Competition detail loads without hydration error
- [ ] Standings tab shows correct table
- [ ] BUSALYMPICS standings: CNAS 1st, CENG 2nd

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

---

## Known Broken (do not test — already filed)

- /competitions/[id] — hydration error #418 (BUG-028)
- /competitions list — missing some competitions (BUG-027)  
- PWA CSS on direct URL visit (BUG-026)
- Email sending broken — AWS SES (BACKLOG-026)
- Google OAuth staging not configured (BACKLOG-025)
- Team logos for college teams — placeholder (BACKLOG-036)
- Railway WS on staging not created (BACKLOG-027)

---

## After Each Session — What to Verify

New feature shipped → add its test cases to this file
Bug fixed → move from Known Broken to the relevant section
Pre-prod merge → run all Critical Flows + Security checks
