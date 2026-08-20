## SYSTEM AUDIT — Priority Before Next Data Operations
**Filed:** 2026-06-04
**Status:** BLOCKING

### Why This Is Needed
Attempted to create college football teams for Bells 
Intercollege competition and discovered the system 
architecture is more complex than expected.

The previous developer built:
- An organizations table (172 orgs, hierarchy structure)
- COLNAS, COLENG, COLMANS, COLENVS already exist 
  as college-type orgs under Bells University
- A teams table (separate from orgs)
- ownerOrganizationId FK linking teams to orgs
- playerAffiliations or similar linking players to orgs
- Bulk register flow that may handle team+org+player 
  creation together

The relationship between organizations → teams → players
is unclear. Creating teams blindly via script without 
understanding this convention risks:
- Orphaned teams not linked to orgs
- Duplicate entries
- Breaking the registration/affiliation flow

### What the Audit Must Cover

1. ORGANIZATIONS TABLE
   - What is the full schema?
   - What types exist (university, college, department)?
   - How does ownerOrganizationId on teams work?
   - Can one org own multiple teams (different sports)?

2. TEAMS TABLE  
   - Full schema including all FK relationships
   - How is a team linked to an org?
   - How is a team linked to a competition?
   - What is the correct creation flow?

3. PLAYERS TABLE
   - Full schema
   - How are players linked to teams? 
     Via teamId directly or via affiliations table?
   - Can a player belong to multiple teams?
   - What is playerAffiliations table if it exists?

4. COMPETITIONS → TEAMS relationship
   - How are teams added to a competition?
   - Is there a competitionTeams join table?
   - What does the standings table look like?

5. BULK REGISTER FLOW
   - Full flow: what does it create?
   - Does it create org + team + players together?
   - Or just players under existing team?

6. CORRECT CREATION CONVENTION
   - To create a new college team from scratch:
     Step 1: ?
     Step 2: ?
     Step 3: ?
   - What is the minimum viable path to get a team 
     playing matches with players linked correctly?

7. FULL MODULE INVENTORY
   List every feature, page, API route, DB table 
   with status: Working / Partial / Broken / Not built

### What Was Done This Session
- Created 4 teams via script (may need to be deleted 
  if they were created incorrectly without org links)
- Confirmed COLNAS/COLENG/COLMANS/COLENVS exist 
  as organizations already
- Script query confirmed these org names do NOT 
  appear as teams yet

### Immediate Questions
- Did scripts/create-intercollege-teams.ts create 
  valid teams or orphaned records?
- Should those 4 rows be deleted and recreated 
  via the proper flow?
- Is bulk-register the correct tool for creating 
  college teams or is there a better path?

### Next Session Starting Point
Run the full audit directive below before touching 
any data. Understand first, act second.
