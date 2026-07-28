# Audit — Admin Platform Sub-Features (Functional Completeness, UI/UX Side)

**Session:** 47D (continuation) | **Date:** 2026-07-28 | **Scope:** every distinct admin-facing sub-feature under `src/app/admin/**` (plus two adjacent non-`/admin` routes that are functionally part of the same surface: `src/app/lineups/page.tsx` and `src/app/analytics/loggers/page.tsx`). Question asked: does the FEATURE actually work end to end, not "is it authenticated."

**Method:** static code read only, no live/DB/browser testing. Every verdict is code-confirmed, not live-tested — treat as SHIPPED-level evidence at best, not RESOLVED-level per this project's lifecycle-state definitions.

**Out of scope per brief, not re-investigated here:** the auth-gate question for the ~16 routes currently being fixed under `BUG-147` (`users/[id]`, `matches/[id]/lineup`, `fixtures` + `fixtures/[id]`, `news` + `news/[id]`, `transfers/[id]`, `notifications/send`, `brackets/[id]`, `players/[id]/stats`, `events/sync`, `standings`, `competitions/templates`, `teams` + `teams/bulk`, `head-to-head`, `teams/[id]/form`) and BUG-002/BUG-034/BUG-107 (already resolved per prior sweeps). Where a finding below is adjacent to but distinct from an auth question (e.g. a hardcoded audit field, an unbounded query, a dead feature-flag), it is called out explicitly as **not an auth finding**.

---

## 1. Match creation flow

**File:** `src/app/admin/matches/page.tsx` (884 lines)

**Verdict: WORKS.** Full create/edit/delete for matches, competition-aware team filtering (`fetchCompetitionTeams`), per-match rule overrides (extra time / penalties / draws, layered on top of competition-level `competitionMatchSettings`), friendly-match support (internal/external + description), round/group/matchday fields for bracket-adjacent metadata. `Match` interface embeds `homeTeam`/`awayTeam` objects directly — confirms the historical `BUG-014` fix (admin match cards showing raw team IDs because of a secondary `.limit(200)`-capped team lookup) still holds; this page never does that secondary lookup.

**Backlog cross-reference:** none open against this page specifically.

---

## 2. Logger assignment to matches

**File:** `src/app/admin/loggers/page.tsx` (972 lines)

**Verdict: WORKS.** `assignLogger`/`removeLogger` (lines 155–182) POST/POST to `/api/matches/[id]/assign-logger` and `/api/matches/[id]/remove-logger`, availability toggle (`toggleAvailability`, line 133), coverage stats (assigned/unassigned/live-assigned), unassigned-matches queue, per-logger active-match list. Comprehensive and functional.

**Backlog cross-reference:** none open.

---

## 3. Admin match list / approval workflow

**File:** `src/app/admin/manager/page.tsx` (437 lines, "Nexus Ops" dashboard)

**Verdict: PARTIALLY WORKS.**
- Validation Queue (finished-but-unapproved matches) and Live Operations list both render from real `/api/matches` + `/api/loggers` data, refreshed every 30s.
- **Approve works correctly**: `handleApprove` (line 66) PATCHes `approvalStatus: 'APPROVED'` and `approvedBy: user?.id` — sourced from the verified session, not hardcoded. Good pattern.
- **Reject does nothing.** The `ThumbsDown` button (lines 380–382) has no `onClick` handler at all — purely decorative. An admin clicking "reject" gets no feedback and nothing happens. New finding, not filed.
- **Staff Comms sidebar is fully commented out**, confirmed still the state described in `BACKLOG-142` (resolved 2026-07-27, session 47C — auth gap fixed, UI intentionally pulled pending a real match-selection redesign). All of `fetchData`'s comms fetch, `handleSendNote`, the sidebar `<aside>`, and the "Staff Comms" stat tile are `// BACKSCOPED` block comments (lines 39–49, 84–108, 172–179, 210–211, 240–317). This is exactly what the backlog entry says should be true — confirmed, not a regression.

**Backlog cross-reference:** Staff-Comms state matches `BACKLOG-142` (RESOLVED as "UI pulled"). Reject-button no-op is new, unfiled.

---

## 4. Competition admin (create/edit, group stages, brackets)

**Files:** `src/app/admin/competitions/page.tsx` (835 lines), `src/app/admin/competitions/[id]/page.tsx` (444 lines)

**Verdict: PARTIALLY WORKS.**
- Competition create/edit (name, sport, scope, level, format, season, status, group/team counts) and per-competition match-settings (half duration, players-per-side, substitutions, extra time/penalties/draws, points system) — WORKS, real POST/PATCH.
- Team-to-group assignment and standings display on the `[id]` detail page — WORKS (`handleGroupChange`, grouped-teams rendering).
- **Bracket/knockout-stage creation has zero admin UI.** `src/app/api/brackets/route.ts` has a full `POST` and `src/app/api/brackets/[id]/route.ts` has `PATCH`/`DELETE` (auto-propagates winners downstream per a `BUG-147`-adjacent backlog note), but grepping the entire `src/app/admin/**` tree for "bracket" (case-insensitive) turns up exactly one hit — a label string in `infrastructure/page.tsx`'s endpoint-health list, not a UI. Every bracket-consuming UI is on the public side (`src/app/competitions/page.tsx`, `src/app/football/page.tsx`) and is read-only. The only way to create or edit a bracket today is a direct API call or a one-off script. This is the same shape of gap as `BACKLOG-077` (Create Team) but for brackets, and appears **not previously filed**.
- **Dead file:** `src/app/admin/competitions/page-enhanced.tsx` (650 lines) is never imported or referenced anywhere in the codebase (grepped). Next.js App Router only serves `page.tsx` at a route segment, so this file is unreachable via any URL — pure dead code sitting next to the live file, a real risk for a future editor who assumes it's the newer variant. New finding.

**Backlog cross-reference:** bracket-creation-has-no-UI and the dead `page-enhanced.tsx` file are both new, unfiled.

---

## 5. Team management

**Files:** `src/app/admin/teams/page.tsx` (231 lines, list), `src/app/admin/teams/[id]/page.tsx` (1791 lines, detail/roster)

**Verdict: PARTIALLY WORKS.**
- **No Create Team UI** — confirmed still true. `teams/page.tsx` is read-only (search + sport filter + "Manage Roster" links only, no create button anywhere). Matches `BACKLOG-077` (OPEN), which itself was corrected this session (per its own text) to note `POST /api/teams` has zero `getAuthUser` call — that specific point is `BUG-147` territory and not re-verified here.
- **No Edit Team UI** — the Info tab (`teams/[id]/page.tsx:1736–1779`) renders team fields (name, short name, sport, gender, university, colour) as read-only value blocks, with an explicit disabled button: `title="Coming soon"` / `Edit Team — Coming Soon` (lines 1770–1776). Confirmed via direct read, not inferred.
- **Roster management genuinely works**: add existing/new player to roster (`POST /api/admin/teams/[id]/roster`), reposition/deactivate (`PATCH .../roster/[affiliationId]`), squad assignment for a competition (`POST .../squad`), CSV bulk import tab, and a competitions-list fetch for squad-building context. This is a substantial, functional feature — the gap is specifically team-level metadata (create/edit), not roster operations.

**Backlog cross-reference:** `BACKLOG-077` (OPEN) covers Create Team. No existing entry found for the "Edit Team — Coming Soon" disabled button specifically — worth a companion filing if one doesn't already exist elsewhere.

---

## 6. Player management (individual CRUD + bulk register)

**Files:** `src/app/admin/players/page.tsx` (792 lines, list+delete), `src/app/admin/players/[id]/page.tsx` (496 lines, edit), `src/app/admin/bulk-register/page.tsx` (1041 lines, batch create), plus creation-via-roster in `teams/[id]/page.tsx` (the "New Player" vs "Existing Player" toggle, line 287).

**Verdict: WORKS, but spread across three separate surfaces with no single "create one player" entry point.** Delete is on the list page (`DELETE /api/players/[id]`). Edit is on the detail page (`PATCH`, line 142). Individual creation only exists embedded inside team-roster management (`POST /api/admin/teams/[id]/roster`, "New Player" mode) or via the batch `bulk-register` flow (`POST /api/players/bulk-register`). There is no standalone "Add Player" form reachable from `/admin/players` itself — grepped for "Add Player"/"Create Player"/"New Player" across `src/app/admin/players/page.tsx`, no matches. Functionally complete but discoverability is poor (an admin looking for "add a player" on the players list won't find one).

**Backlog cross-reference:** none found specifically for this; adjacent to the `BACKLOG-077` pattern (functionality exists, but not where an admin would look for it) though not the same gap.

---

## 7. User management admin panel (Access Control)

**Files:** `src/app/admin/access/page.tsx` (357 lines), `src/app/api/admin/users/route.ts` (91 lines)

**Verdict: PARTIALLY WORKS.** Admin can view all users (search/filter by role) and change a user's role (`user`/`logger`/`admin`) via `PATCH /api/admin/users`. That is the full extent of the feature. There is **no deactivate, ban, suspend, or delete** action anywhere on this page, and no way to drill into a single user's detail/activity — the table is flat, role-change is the only mutation. "Manage users" is listed as an Administrator permission in the page's own role-description card (line 245) but the only manageable attribute is role.

**Not an auth finding, but a real code-quality issue found in the same file:** `GET /api/admin/users` (`route.ts:19–27`) has **no `.limit()` clause** — it selects every row from `users` unconditionally. CLAUDE.md's Architecture Rules state explicitly: "Every list endpoint MUST have a `.limit()` clause — no unbounded queries ever," and this is also called out as a top-line anti-pattern in `known-issues.md`. This is independent of whatever `BUG-147` does for this route's auth (this route already has `getAuthUser` + admin check, confirmed present at lines 14–17 and 45–47 — it is not one of the routes in the BUG-147 list). New finding.

**Backlog cross-reference:** none found for either the missing deactivate/delete action or the unbounded query.

---

## 8. News / articles admin

**File:** `src/app/admin/news/page.tsx` (883 lines), `src/app/api/news/route.ts`

**Verdict: WORKS well as a CMS**, with one real audit-integrity gap. Full create/edit/delete, bulk publish/archive/delete, status filter (draft/published/archived), rich-text editor + Cloudinary image upload, auto-save for drafts (3s debounce, only while status is `draft`), push-notification toggle on publish.

**Real finding, not an auth question:** every create/edit payload hardcodes `authorId: 'admin-1'` and `authorName: 'Admin'` client-side (`news/page.tsx:220–221`), and the API (`src/app/api/news/route.ts:100, 117–124, 138`) trusts and uses this client-supplied `authorId` as-is (with a fallback to `null` only if the id doesn't resolve to a real user row — it never derives the author from the verified session). This is the exact `BUG-004` pattern (`createdBy: 'admin-1'` hardcoded, already fixed once for the transfers page per `known-issues.md` line 12) reappearing in a sibling feature. It is **independent of `BUG-147`**: even after that fix adds an admin-role gate to this route, the audit trail will still record every article as authored by a hardcoded string / a client-controlled field rather than the actual logged-in admin, unless fixed separately.

**Backlog cross-reference:** `news + news/[id]` are in the `BUG-147` auth-gate list (not re-flagged here); the hardcoded/client-passed `authorId` is a distinct, unfiled finding.

---

## 9. Ads feature

**File:** `src/app/admin/advertisements/page.tsx` (633 lines)

**Verdict: WORKS.** Full create/edit/delete, active/inactive toggle, payment-tier system (basic/standard/premium/platinum) that constrains available position/size/priority combinations, Cloudinary upload with manual-URL fallback, impressions/clicks display, start/end date scheduling. CLAUDE.md's caveat that this feature is "recently added, untested under load" cannot be confirmed or refuted by a static read — flagging as **unverified**, not broken. No fabricated data observed; impressions/clicks are read straight from the `advertisements` table.

**Backlog cross-reference:** none found.

---

## 10. Lineup Builder — two distinct features share this name

### 10a. Official Match Lineups (`/admin/match-lineups`, admin/logger only)

**File:** `src/app/admin/match-lineups/page.tsx` (804 lines)

**Verdict: WORKS for football, confirmed still broken for other sports.** Formation selection, starter/sub picking, captain assignment, publish (`POST /api/admin/match-lineups/[id]`), and unlock-for-re-edit (`POST /api/matches/[id]/lineup/unlock`) are all implemented and wired to real endpoints.

**`BUG-125` confirmed still OPEN, code unchanged since filing.** `handleMatchSelect` (lines 204–230) derives `playersPerSide` from `competitions.playersPerSide` (schema default `11`) rather than from `match.sport` or `competition_sport_settings`. Any competition that never explicitly set a competition-level `playersPerSide` (e.g. `BUSA LEAGUE BASKETBALL` per the original filing) falls back to 11 and shows a football formation dropdown and "0/11 starters" for a 5-a-side sport. Read at the exact line range the backlog entry cites — no fix has landed.

### 10b. Public "Lineup Builder" (`/lineups`, no visible role gate)

**File:** `src/app/lineups/page.tsx`

**Verdict: PARTIALLY WORKS, with a silent-failure UX bug.** Lets any visitor pick a match/team, build a formation visually (drag/select via `InteractivePitch`), and download it as a PNG (`handleDownload`, `html-to-image` — works for anyone, no auth needed). But "Save Draft" (`handleSaveDraft`, lines 201–225) POSTs to the **same** `/api/matches/[id]/lineup` endpoint the admin Official Match Lineups page writes to — an endpoint gated to `admin`/`logger` roles only (confirmed by reading `src/app/api/matches/[id]/lineup/route.ts:49–55`, one of the two files currently mid-edit under `BUG-147` — not re-flagged for auth, only cited to explain the role gate that already exists). The page's save handler only checks `if (data.success)` and never checks `response.ok` — so a 401/403 JSON error body silently falls through both the success and the catch branch, and the user sees **no error at all**, not even a failed-save message. This is the exact "no silent failures" anti-pattern CLAUDE.md calls out, just inverted (silent no-op instead of silent success). New finding, unfiled.

**Backlog cross-reference:** `BUG-125` confirmed OPEN, unchanged. The `/lineups` silent-save-failure is new and unfiled.

---

## 11. Match ratings admin

**Files:** `src/app/admin/match-ratings/page.tsx` (214 lines, list), `src/app/admin/match-ratings/[id]/page.tsx` (634 lines, adjust)

**Verdict: PARTIALLY WORKS — the adjustment tool is real, the list's status indicator is dead.** The `[id]` adjustment page genuinely works: fetches auto-calculated suggested ratings (`GET /api/matches/[id]/ratings/adjust`), lets an admin override per-player finalRating/notes/Man-of-the-Match, saves (`POST`, line 200), with proper role-aware error messaging (`AUTH_REQUIRED`/`INSUFFICIENT_PERMISSIONS`/`MATCH_NOT_FOUND` codes surfaced to the UI, lines 84–90).

**The list page's rating-status indicator is always wrong.** `Match.hasRatings`/`Match.ratingsCount` (`match-ratings/page.tsx:28–29`) drive the "★ N ratings published" vs "No ratings yet" badge (lines 187–198), but a codebase-wide grep for `hasRatings`/`ratingsCount` turns up **only this one file** — no API route, including `/api/matches` (the endpoint this page actually calls, `?status=FINISHED&limit=50`), ever sets these fields. Every match therefore always renders "No ratings yet" regardless of whether ratings actually exist, misleading an admin scanning the list for which matches still need attention. New finding, unfiled.

**Backlog cross-reference:** none found.

---

## 12. Analytics / Infrastructure dashboard

**Files:** `src/app/admin/infrastructure/page.tsx` (592 lines), `src/app/api/admin/infrastructure/route.ts`, `src/app/analytics/loggers/page.tsx`

**Verdict: MOSTLY WORKS, with acknowledged placeholders presented alongside real data.** Database table row counts, total records, DB latency, and API endpoint health (real `fetch` pings against ~23 endpoints with response-time measurement) are all genuinely live. Node process memory/uptime/version are real.

**Explicitly placeholder pieces, not flagged as such in the UI:**
- `disk: 0` always (`route.ts:146`, own comment: "would need OS-specific calls") — the dashboard would render a disk-usage stat that is always zero, not "unavailable."
- `cpu` (`route.ts:143`) is `process.cpuUsage().user / 1e6 % 100` — a rough, meaningless-as-a-percentage proxy, not real system CPU load.
- `recentErrors` (`route.ts:183–187`) is hardcoded to always return `[]`, with the code's own comment: "placeholder — integrate with error logging service." Despite Sentry being configured elsewhere in this project (per `CLAUDE.md`'s stack list), the admin's own "Recent Errors" panel can never show anything, ever — it is wired to nothing.

**Related page, separately routed:** `src/app/analytics/loggers/page.tsx` (not under `/admin`) shows internal logger performance analytics. Unlike every page under `/admin/**`, it has **no client-side auth check or redirect** (grepped for `useAuth`/`isAuthenticated`/role checks — none). This is not a security hole — its data source, `GET /api/analytics/loggers`, does call `getAuthUser` + admin check (`route.ts:18–22`) — but it is an inconsistent UX pattern: a non-admin hitting this URL gets a broken/empty dashboard with no explanation, instead of the redirect-to-login every other admin page gives.

**Backlog cross-reference:** none found for any of the above; all new findings.

---

## 13. Organizations management

**File:** `src/app/admin/organizations/page.tsx`

**Verdict: PARTIALLY WORKS.** Hierarchical tree view (university → college → department, etc.) with parent/child counts and a working "Create Organization" form (`POST`, line 211) covering name/type/short name/display name/parent/location/status/internal-unit flag. **No edit and no delete/deactivate anywhere in the file** — grepped for "Edit"/"Delete"/"Trash", zero matches. An org, once created, cannot be changed or removed from this page (its `status` field can only be set at creation time, never toggled afterward).

**Backlog cross-reference:** none found.

---

## 14. Settings panel

**Files:** `src/app/admin/settings/page.tsx`, `src/app/api/admin/settings/route.ts`

**Verdict: The CRUD WORKS; the feature it's supposed to control is fully inert.** Fetching, editing, and saving individual settings (algorithm weights, system toggles, feature flags) all function correctly against a real `systemSettings` table, with per-setting and "save all" flows and visible dirty-state.

**Significant finding, directly relevant to this project's own open checklist item:** the seven default settings — `system.maintenance.mode`, `system.registration.enabled`, `system.notifications.enabled`, `features.fpl.enabled`, `features.predictions.enabled`, `features.polls.enabled`, `features.transfers.enabled` (`route.ts:15–28`) — are **read nowhere else in the entire codebase.** Grepped every one of these key strings across `src/**`; the only hits are the settings page itself and its own API route. Toggling "maintenance mode" or "Enable Transfer News" off changes a database row and has **zero effect on anything a user or admin would experience** — no route guard, no conditional render, no middleware check consults these values anywhere.

This directly undercuts the still-open item in `.agents/dev/BACKLOG.md`'s Live Event Readiness Checklist: *"All 🔴 High Volatility features are disabled or hidden from the UI — OPEN."* There is currently no working feature-flag mechanism in this codebase to accomplish that with — building real gating (conditional rendering in the relevant pages/components, or a shared `isFeatureEnabled()` check wired into route/middleware logic) would be new work, not a matter of flipping an existing switch.

**Backlog cross-reference:** none found specifically calling out the flags as inert; this is new context directly relevant to the open Live Event Readiness item.

---

## 15. Transfers admin

**File:** `src/app/admin/transfers/page.tsx` (733 lines), `src/app/api/transfers/route.ts`

**Verdict: WORKS as an announcement CMS; does NOT perform an actual roster transfer — confirms `BACKLOG-126`'s structural finding directly from the admin-side code.** Create/edit/delete for transfer records is fully functional, with search/status filtering, reliability slider for rumors, push-notification-on-publish, and (unlike the News page above) a **correctly session-derived** `createdBy: user?.id` (line 192) — no hardcoded audit field here, this page gets that pattern right.

The gap is structural, not a bug in this page: `POST /api/transfers` (`route.ts:195–212`) inserts only into the standalone `transfers` table. It never reads or writes `player_team_affiliations` — the table that actually determines which team a player is on for roster, eligibility, and standings purposes anywhere else in the product. An admin "recording a transfer" here creates a news-style announcement only; the player's actual team membership is completely unaffected. This is precisely the gap `BACKLOG-126` already documented ("no admin UI action anywhere that does this") — confirmed true by reading the live handler, not just inferred from the backlog text.

**Backlog cross-reference:** `BACKLOG-126` (OPEN) — directly confirmed by this session's read of `src/app/api/transfers/route.ts`.

---

## 16. Track & Field events admin

**File:** `src/app/admin/track-events/page.tsx` (575 lines)

**Verdict: PARTIALLY WORKS.** Create (`POST /api/matches` with `sport: 'Track'`, reusing the generic match model) and delete both work. **No edit functionality exists** — grepped for `showEditModal`/`handleEdit`/`EditModal`, no matches anywhere in the file. Once a track meet is created, its details (venue, time, participating teams, event categories) cannot be changed from this page short of deleting and recreating it.

**Backlog cross-reference:** none found.

---

## 17. Past Matches Import

**File:** `src/app/admin/past-matches/import/page.tsx` (889 lines)

**Verdict: WORKS.** Both the manual-entry tab and the CSV/XLSX bulk-import tab (`xlsx` + `csv-parse` libraries) POST to `/api/matches/backfill` (lines 432–433, 520–521). Genuinely substantial feature for historical-data entry, not a stub.

**Backlog cross-reference:** none found.

---

## 18. Bulk Register (players/teams batch creation)

**File:** `src/app/admin/bulk-register/page.tsx` (1041 lines)

**Verdict: WORKS.** POSTs to `/api/players/bulk-register`, which — per `BACKLOG-077`'s own text — is the only functioning way today to create a brand-new team (as a side effect of registering its first players), since there is no standalone Create Team UI (see §5 above). `BACKLOG-077` itself already documents that this path "sets wrong defaults and breaks business logic when you need an empty team" — not re-verified independently this session, cited for completeness.

**Backlog cross-reference:** `BACKLOG-077` (OPEN), already covers this page's role as the de facto team-creation path.

---

## 19. Livestreams admin

**File:** `src/app/admin/livestreams/page.tsx`

**Verdict: WORKS.** Per-match livestream configuration (URL, provider type, enabled flag, chat toggle) via `PATCH` against the match record (lines 110, 152). No separate "create" step needed since a livestream is just fields on an existing match.

**Backlog cross-reference:** none found.

---

## 20. Notifications admin

**Files:** `src/app/admin/notifications/page.tsx` (69 lines, hub), `src/app/admin/notifications/composer/page.tsx` (737 lines)

**Verdict: PARTIALLY WORKS — the hub oversells what exists.** The hub page presents three "Quick Action" cards: Composer, History, Settings (lines 22–56). Only **Composer is a real link** (`href="/admin/notifications/composer"`). **"History" and "Settings" are plain `<div>`s with no `href` and no `onClick`** — purely decorative, dead UI elements that look clickable (hover states styled identically to the real Composer link) but do nothing. Composer itself is a real, working feature: template selection, variable interpolation (`{homeTeam}`, `{playerName}`, etc.), team/match targeting, and `POST /api/notifications/send`; it also internally fetches send history (`fetchSendHistory`, `GET /api/notifications/history`, line 149) — so "History" functionality does exist, just nested inside Composer rather than as its own page the hub implies it is.

**Backlog cross-reference:** none found for the dead History/Settings cards specifically.

---

## 21. Push Diagnostics

**File:** `src/app/admin/push-diagnose/page.tsx` (5-line wrapper around `PushDiagnosticPage`)

**Verdict: WORKS as a diagnostic tool** (delegates to `@/components/notifications/PushDiagnosticPage`, not independently re-audited here). **Orphaned route**: grepped the entire codebase for `push-diagnose` — the only occurrence is the page file itself. It is not in `AdminSidebar.tsx`'s nav list (§ inventory below) and is not linked from any other admin page. Reachable only by typing the URL directly. Minor finding, likely intentional (a debug tool not meant for casual discovery) but worth confirming.

**Backlog cross-reference:** none found.

---

## Cross-cutting observations

- **Admin section auth is centrally gated and sound** (not part of the BUG-147 sweep, confirmed separately): `src/app/admin/layout.tsx` verifies the `authToken` JWT server-side and requires `role === 'admin' || role === 'logger_manager'` before rendering anything under `/admin/**`, redirecting to `/login` or `/` otherwise. This explains why most individual admin pages don't duplicate that check client-side. `logger_manager` is a role not mentioned in `CLAUDE.md`'s stated Actor Model (Super Admin → Competition Admin → Team Manager → Logger → Viewer) — worth reconciling docs vs. code at some point, not a functional bug.
- **Recurring pattern across this audit: "API exists with full CRUD, UI only exposes read/create."** Seen in brackets (§4, no UI at all), teams (§5, no edit), organizations (§13, no edit/delete), track events (§16, no edit). None of these are new *types* of gap for this project — `BACKLOG-077` already documents the identical shape for Create Team — but this is the first time they've been enumerated together as one recurring pattern rather than one-off findings.
- **Two genuinely new "hardcoded/client-passed audit field" instances found** (§8, News `authorId: 'admin-1'`) alongside one confirmed-correct example done right (§15, Transfers `createdBy: user?.id`) — worth using Transfers as the reference pattern when News gets fixed.
- **Fabricated/misleading-but-not-malicious UI state, confirmed in three places:** Match Ratings list's `hasRatings` (§11, always false), Infrastructure's `recentErrors` (§12, always empty) and `disk`/`cpu` (§12, always 0 / meaningless proxy), and the Manager dashboard's per-match "Optimal" health badge on `/admin` itself (`src/app/admin/page.tsx:161–165` — a static `CheckCircle2`/"Optimal" label rendered identically for every match row regardless of any actual health signal; not deep-dived as its own section since it's a minor decorative badge, but worth noting alongside the pattern). None of these are "fake data presented as real" in the BUG-088 sense (no invented numbers shown as if measured) — they're closer to dead/always-same-value UI — but they share the same root cause: a field the frontend expects that nothing on the backend ever actually computes.

---

## Inventory table

| Sub-feature | File(s) | Verdict | Backlog ref |
|---|---|---|---|
| Match creation | `admin/matches/page.tsx` | WORKS | — (BUG-014 fix confirmed holding) |
| Logger assignment | `admin/loggers/page.tsx` | WORKS | — |
| Match approval workflow | `admin/manager/page.tsx` | PARTIALLY WORKS | BACKLOG-142 (comms pulled, confirmed); reject-button no-op is new |
| Competition CRUD + groups | `admin/competitions/page.tsx`, `[id]/page.tsx` | WORKS | — |
| Bracket/knockout creation | *(no admin UI exists)* | DOESN'T EXIST | new, unfiled |
| Dead file `page-enhanced.tsx` | `admin/competitions/page-enhanced.tsx` | N/A (unreachable dead code) | new, unfiled |
| Team create | `admin/teams/page.tsx` | DOESN'T EXIST | BACKLOG-077 (OPEN) |
| Team edit | `admin/teams/[id]/page.tsx` | DOESN'T EXIST ("Coming Soon") | new, unfiled |
| Team roster management | `admin/teams/[id]/page.tsx` | WORKS | — |
| Player create (individual) | via `teams/[id]` roster or `bulk-register` | WORKS (poor discoverability) | — |
| Player edit / delete | `admin/players/[id]/page.tsx`, `players/page.tsx` | WORKS | — |
| User management (Access Control) | `admin/access/page.tsx` | PARTIALLY WORKS (role-change only, no deactivate) | new, unfiled |
| `GET /api/admin/users` unbounded query | `api/admin/users/route.ts` | anti-pattern present | new, unfiled |
| News/articles admin | `admin/news/page.tsx` | WORKS (CMS features) | hardcoded `authorId` is new, unfiled |
| Ads feature | `admin/advertisements/page.tsx` | WORKS | "untested under load" unverified either way |
| Official Match Lineups | `admin/match-lineups/page.tsx` | WORKS for football; broken for other sports | BUG-125 (OPEN, confirmed unchanged) |
| Public Lineup Builder | `app/lineups/page.tsx` | PARTIALLY WORKS (silent save failure for non-admin/logger) | new, unfiled |
| Match ratings adjustment | `admin/match-ratings/[id]/page.tsx` | WORKS | — |
| Match ratings list status badge | `admin/match-ratings/page.tsx` | dead/always-wrong field | new, unfiled |
| Infrastructure dashboard | `admin/infrastructure/page.tsx` | MOSTLY WORKS, 3 acknowledged placeholders | new, unfiled |
| Logger analytics page | `app/analytics/loggers/page.tsx` | WORKS, no client-side auth redirect (API is gated) | new, unfiled (UX only) |
| Organizations | `admin/organizations/page.tsx` | PARTIALLY WORKS (create-only, no edit/delete) | new, unfiled |
| Settings panel (CRUD) | `admin/settings/page.tsx` | WORKS | — |
| Feature flags (effect) | `api/admin/settings/route.ts` defaults | inert, read nowhere | relevant to open Live Event Readiness item |
| Transfers admin (announcement) | `admin/transfers/page.tsx` | WORKS as announcement CMS | — (`createdBy` done correctly) |
| Transfers admin (actual roster move) | `api/transfers/route.ts` | DOESN'T EXIST | BACKLOG-126 (OPEN, confirmed) |
| Track & Field events | `admin/track-events/page.tsx` | PARTIALLY WORKS (no edit) | new, unfiled |
| Past matches import | `admin/past-matches/import/page.tsx` | WORKS | — |
| Bulk register | `admin/bulk-register/page.tsx` | WORKS (de facto team-create path) | BACKLOG-077 |
| Livestreams | `admin/livestreams/page.tsx` | WORKS | — |
| Notifications hub | `admin/notifications/page.tsx` | PARTIALLY WORKS (2 of 3 cards dead) | new, unfiled |
| Notifications composer | `admin/notifications/composer/page.tsx` | WORKS | — |
| Push diagnostics | `admin/push-diagnose/page.tsx` | WORKS, orphaned route | minor, unfiled |
| Admin dashboard home | `admin/page.tsx` | WORKS, one decorative "Optimal" badge | minor, unfiled |
| Admin section auth gate | `admin/layout.tsx` | WORKS (server-side JWT + role check) | — |
