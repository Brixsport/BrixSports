---
CONTEXT TRANSFER: Brixsports — Session 13
Exported: 2026-06-15
---

## WHO THIS IS FOR

Richard is the developer behind BrixSports, a campus sports livescore platform for Bells University of Technology. Session 13 verified the Roster Builder end-to-end on staging, closed BUG-025, raised the teams API limit, completed BACKLOG-037 Step 5 (bulk register dedup), and created the manual test checklist.

---

## WHAT LANDED

- **BUG-025 RESOLVED** — `loggerId` stripped from public `GET /api/matches` response. Admin callers get it back via `getAuthUser` conditional. `assignedLoggers` was already absent.
- **Teams API limit 200 → 500** — college teams (CNAS/CENG/CMANS/CENVS) were in the missing 36 above the old cap. Now visible.
- **BACKLOG-037 Step 5** — bulk register pre-flight dedup by `LOWER(name)` + college. Skip with `reason: 'possible_duplicate'`, `matchedPlayerId`, `matchedPlayerName`. NPUGA email-reuse path exempted.
- **`.agents/dev/TEST_CHECKLIST.md`** — full manual test checklist created. Update it when bugs are fixed or features ship.
- **BACKLOG-045, 046 filed** — teams pagination, player profile edit page.
- **Roster Builder verified on staging** — `/admin/teams` loads, search works, CNAS shows 21 players, add existing + new player both work.

---

## BACKLOG-037 STATUS

| Step | Description | Status |
|------|-------------|--------|
| 1 | Schema: nicknames column + unique index | ✓ COMPLETE |
| 2 | POST /api/admin/teams/[teamId]/roster | ✓ COMPLETE |
| 3 | GET /api/players/search (nickname-aware) | ✓ COMPLETE |
| 4 | Roster Builder UI /admin/teams/[id] | ✓ COMPLETE — VERIFIED |
| 5 | Bulk register pre-flight dedup | ✓ COMPLETE |
| 6 | CSV import tab on Roster Builder | NOT STARTED |
| 7 | Squad Selector (revive squadPlayers) | NOT STARTED |

---

## NEXT SESSION STARTS WITH

**Option A — Bug sprint (recommended, clears visible prod issues):**
1. **BUG-021** (5 min) — add `getAuthUser(request)` to `POST /api/notifications/subscribe` in `src/app/api/notifications/subscribe/route.ts`. Same pattern as every other auth fix.
2. **BUG-022** (10 min) — add `.limit()` to `GET /api/competitions` (`src/app/api/competitions/route.ts`), `GET /api/events` (`src/app/api/events/route.ts`), `GET /api/matches/[id]/events` (`src/app/api/matches/[id]/events/route.ts`).
3. **BUG-027** — investigate `/competitions` list page missing competitions. Start by reading the competitions list API and page component to understand the query.
4. **BUG-028** — investigate React hydration error #418 on competition detail page.

**Option B:** BACKLOG-037 Step 6 — CSV import tab on Roster Builder.

---

## KEY DATA FACTS

- **Total teams in DB:** 236. API returns up to 500.
- **College team shortNames:** CNAS, CENG, CMANS, CENVS (not COLNAS — search "college" to find them)
- **CNAS roster:** 21 players, all `affiliationType: college`
- **squadPlayers table:** 0 rows — Step 7 will populate

---

## CONSTRAINTS ACTIVE

- **Do NOT run `db:push`** — `organizations_slug_unique` schema drift (BACKLOG-040) will fail. Use SQL direct.
- `.env.local` = staging, `.env.production` = prod
- Read `.agents/rules/security.md` before any DB/script work
- All DB scripts go in `dev/` as `.mjs` files — run via `node dev/script.mjs` in Richard's terminal (Bash tool cannot run node)

---

## OPEN BUGS (priority order)

| Bug | Severity | File | Fix |
|-----|----------|------|-----|
| BUG-021 | Medium | `api/notifications/subscribe/route.ts` | Add `getAuthUser` to POST |
| BUG-022 | Medium | competitions + events routes | Add `.limit()` |
| BUG-027 | Medium | `/competitions` list page | Investigate missing competitions |
| BUG-028 | Medium | Competition detail page | Investigate hydration error #418 |
| BUG-026 | Medium | PWA service worker | CSS cache miss on direct URL visit |
| BUG-023 | Low | `schema-nesa-registrations.ts` | Dead file, broken imports |

---

## FLAGS FOR NEW CHAT

- `TEST_CHECKLIST.md` at `.agents/dev/` — update it when bugs fixed or features ship
- BUG-027 + BUG-028 affect prod visibly — prioritise before BACKLOG-037 Step 6
- BACKLOG-036 second pass (18 files, 40 logo instances) — low risk, good filler task between fixes
- BACKLOG-046 (Player Profile Edit) follows same pattern as `/admin/teams/[id]` — straightforward when ready
- Pre-existing tsc errors: 49 across 25 files — all pre-date session 13, none in files we touched
