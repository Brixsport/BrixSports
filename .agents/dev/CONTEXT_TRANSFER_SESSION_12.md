---
CONTEXT TRANSFER: Brixsports — Sessions 11-12
Exported: 2026-06-14
---

## WHO THIS IS FOR

Richard is the sole developer behind BrixSports, a campus sports livescore platform for Bells University of Technology. Sessions 11-12 completed all outstanding BUSALYMPICS data work, built the Roster Builder foundation (BACKLOG-037 Steps 1-4), fixed broken team logo rendering with a shared utility component, and shipped the Three.js error-page hotfix to prod.

---

## WHAT LANDED

### Data
- All 7 BUSALYMPICS fixtures FINISHED on staging + prod (MD3 G1: COLNAS 3–1 COLENVS, MD3 G2: COLMANS 0–1 COLENG)
- BUSALYMPICS standings live on both DBs — 4 rows, correct (COLENG top, Final excluded)

### Schema
- `nicknames TEXT DEFAULT '[]'` column added to `player_team_affiliations` (both DBs, SQL direct)
- `pta_player_team_unique` index on `(player_id, team_id)` added to both DBs (SQL direct)
- `src/db/schema.ts` updated to match

### API (both tsc-clean, committed)
- `POST /api/admin/teams/[teamId]/roster` — 276 lines, discriminated union (existing|new mode), dedup, org affiliation sync
- `GET /api/players/search` — 219 lines, nickname-aware (parses JSON array), `excludeTeamId` param, admin-only

### UI (committed)
- `/admin/teams/page.tsx` (231 lines) — Teams list
- `/admin/teams/[id]/page.tsx` (919 lines) — Team detail with Roster Builder tab, fuzzy dedup warning panel
- `AdminSidebar.tsx` — Teams entry added

### Utility
- `src/lib/utils/team-logo.tsx` — `isValidLogo()` + `TeamLogo` component with initials fallback
- Migrated to: `MatchCard.tsx` (6), `competitions/page.tsx` (5), `admin/page.tsx` (2) — 13 instances

### Hotfix
- `src/app/error.tsx` and `src/app/not-found.tsx` — Three.js dynamic import + Scene JSX commented out, pushed to prod

---

## NEXT SESSION STARTS WITH

**1. Verify Roster Builder on staging**
Navigate to `/admin/teams`, pick any team (e.g. COLENG), add an existing player via search, then add a new player inline. Confirm DB rows written. Check per-row feedback states (inserted/skipped/error).

**2. BUG-025 — Quick warm-up fix**
File: `src/app/api/matches/route.ts` GET handler response map.
Strip `assignedLoggers` and `loggerId` from the public DTO.
These are NDPR-banned fields. The `assignmentsList` fetch block was removed in Session 7 but the DTO map may still reference them — grep to confirm then remove.

**3. BACKLOG-037 Step 5 — Bulk Register pre-flight dedup**
File: `src/app/api/players/bulk-register/route.ts`
Before any INSERT, search `players` WHERE `name LIKE '%input.name%' AND college = input.college`.
If match found with similarity > threshold: add to `skippedPlayers` with `reason: 'possible_duplicate'`, include matched player `id` and `name`. Do not insert.
Admin can then use Roster Builder to link the existing player instead.

---

## ARCHITECTURAL DECISIONS MADE

### Roster Builder is 3 separate concerns
- **Roster Builder** (playerTeamAffiliations) — built in Steps 1-4. Who is on a team.
- **Squad Selector** (squadPlayers table) — future Step 7. Who plays in a specific competition.
- **Bulk Register** (src/app/api/players/bulk-register) — remains for mass onboarding of new players. Gets dedup refinement in Step 5.

### TeamLogo: local paths today, Cloudinary migration is future
- `isValidLogo()` accepts local public/ paths (BUSA teams use `/assests/...` — typo is consistent with DB so they resolve)
- College teams (COLNAS etc.) have `logo: ''` in DB — initials fallback renders
- Cloudinary migration tracked as BACKLOG-036 (second pass: 18 files, 40 remaining instances)

### nicknames as JSON TEXT per affiliation row
- `playerTeamAffiliations.nicknames` stores `'["Blacko","No.9"]'` — per-team aliases
- Search parses with `JSON.parse()` and checks `Array.includes()`
- Solves logger reconciliation problem: "Blacko" finds the player because the affiliation row stores it

### Do NOT run db:push until BACKLOG-040 is resolved
- `organizations_slug_unique` index is in schema.ts but not in live DBs
- Drizzle-kit push fails with "no such index" when trying to reconcile
- Workaround: use SQL direct for all schema changes until drift is fixed

---

## KNOWN SCHEMA DRIFT

`organizations_slug_unique` — defined in `src/db/schema.ts` but not in staging or prod DBs.
**BACKLOG-040** filed. Do not run `db:push` until this is resolved (create the index in both DBs first).

---

## OPEN BUGS (not started)

| Bug | Severity | File | Fix |
|-----|----------|------|-----|
| BUG-021 | Medium | `src/app/api/notifications/subscribe/route.ts` | Add `getAuthUser` to POST |
| BUG-022 | Medium | competitions, events routes | Add `.limit()` |
| BUG-023 | Low | `src/db/schema-nesa-registrations.ts` | Mark DEAD or delete |
| BUG-024 | Low | Duplicate match routes | Already resolved in Session 7 — verify |
| BUG-025 | Medium (NDPR) | `src/app/api/matches/route.ts` GET | Strip `assignedLoggers` + `loggerId` from DTO |
| BUG-026 | Medium | PWA service worker | CSS cache miss on direct URL visit |
| BUG-027 | Medium | `/competitions` list page | Not showing all competitions |
| BUG-028 | Medium | Competition detail page | React hydration error #418 |

---

## FLAGS FOR NEW CHAT

- Read `.agents/dev/BACKLOG.md` and `.agents/dev/WORKFLOW.md` at session start
- Read `.agents/rules/security.md` before any DB/script work
- Roster Builder is at `/admin/teams` on staging — verify visually before continuing Step 5
- **Do not run `db:push`** until BACKLOG-040 (organizations_slug_unique drift) is fixed
- BUG-025 is a 10-minute fix (strip 2 fields from response DTO) — good warm-up before Step 5
- BACKLOG-036 second pass (18 files, 40 logo instances) is low-effort but wide — batch it separately, not mid-feature
- BACKLOG-037 Steps 5-7 spec is fully written in BACKLOG.md — read it before building Step 5
