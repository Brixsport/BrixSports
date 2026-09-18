# BrixSports — Live Product Walkthrough (Product-Team-Review, step 5 substitute)

**Date:** 2026-09-17
**Method:** Personal Browser-pane walkthrough against the real deployed preview (`brixsports-staging-git-feature-ui-redesign-brixsports-projects.vercel.app`), replacing the `beta-tester` automated pipeline per Richard's explicit instruction — same live build, but navigated and evaluated directly rather than through a recorded synthetic persona run.
**Session:** long-lived 4h admin token (`dev/gen-admin-audit-token.mjs`) injected via cookie + localStorage, so both Viewer/Fan-facing and Admin-facing surfaces are reachable in one continuous pass.
**Scope:** whole platform, not this session's feature track alone — covers step 5 (live walkthrough), step 7-runtime (axe-core accessibility against the live DOM), and step 8 (responsive QA at real breakpoints) of the `product-team-review` pipeline.
**Format:** findings grouped by surface, tagged Critical/High/Medium/Low, each with what was checked and what was found (or confirmed fine).

---

## Method notes

- Findings are logged incrementally as surfaces are covered — this file is the working record, not a final polished report. A synthesis pass happens at the end once all engineering + product-design agents have also reported back.
- Screenshots are not embedded here (this is a markdown doc); a per-surface note describes what was seen.
- **axe-core could not be loaded** — the live site's CSP blocks external script injection from both cdnjs and jsdelivr (confirmed via direct `<script src>` injection attempt, both failed to load). This is itself a mildly positive security signal (CSP is doing its job), but means step 7-runtime is a manual DOM sweep (missing `alt`, unlabeled icon-only controls, unlabeled form inputs, heading-sequence check) rather than a full axe-core ruleset. Noted as a methodology limitation, not a product finding.

---

## Homepage (`/`)

**Runtime accessibility (manual DOM sweep):**
- **HIGH — 4 icon-only interactive controls with no accessible name**: the search icon, bell/notifications icon, and mobile hamburger menu button in the header (all `w-11 h-11` — the exact touch-target fix from this session's `BACKLOG-390` work), plus one `absolute top-4 right-4` close (X) button on an overlay, all render as `<button>` with an `<svg>` child and zero `aria-label`/`aria-labelledby`/visible text. A screen reader announces these as bare "button" with no indication of what they do. Fix is small (add `aria-label="Search"` / `"Notifications"` / `"Menu"` / `"Close"`) but real — these are primary nav controls, not decorative.
- **HIGH — no `<h1>` anywhere on the homepage.** Heading sequence starts at `H3`, alternates `H3`/`H2` roughly 50 times (once per match-card group, by inspection), never establishing a top-level `H1` for the page. Bad for both screen-reader page orientation and SEO (a page with no `h1` has no clear single-sentence "what is this page" signal for either audience).

**Visual/content:**
- **MEDIUM — a test fixture literally labeled "MOCK SHOWCASE (DELETE ME)"** renders as a real match card on the public homepage (`TBK vs Titans`). Per project convention (`project_staging_prod_env_separation` — mock data on staging is expected and not itself a bug), this isn't a defect in the strict sense, but a match card whose own title asks to be deleted is a real content-hygiene miss worth a quick cleanup pass — if this staging URL is ever screenshotted for a stakeholder update or investor demo (this repo's `.agents/dev/` already contains a `STAKEHOLDER_STATUS_REPORT_2026-08-07.md` and similar docs, so that's a real use case, not hypothetical), this card would be visible.
- Confirmed live: admin session persists correctly across navigation (header shows "ADMIN USER" with the injected token), `LIVE CENTER` banner, date navigation, status filter pills, and Live/Upcoming/Finished match cards all render with the correct semantic-token theming from this session's earlier `BACKLOG-390` work — no hardcoded-dark boxes visible.

---

## `/live`

**Runtime accessibility (manual DOM sweep):** `issueCount: 2`, `h1Count: 1`.
- **HIGH — 2 icon-only interactive controls with no accessible name**, consistent with the homepage pattern: a header icon button (`p-2 hover:bg-muted rounded-lg`, likely back/refresh — ambiguous specifically *because* it has no label) and an `absolute top-4 right-4` close (X) button on the "Update available" PWA toast. Same fix class as homepage (`aria-label`).
- **Good — `<h1>` present** (count: 1), unlike the homepage. Worth homepage picking up the same pattern this page already uses.

**Visual/content/data:**
- **HIGH — "Invalid Date" rendered on the live match card** (`Gba` competition, `TEAM B 11 – 9 TEAM A`). Root-caused via `fetch('/api/matches?limit=5')`: this specific match's `startTime` is `"1788963960000.0"` — a raw epoch-milliseconds value serialized as a **string with a trailing decimal**, not an ISO datetime string like every other match record (e.g. `"2026-09-09T05:20"`). Whatever client-side formatter renders the card date almost certainly does `new Date(startTime)` expecting ISO — a numeric string with `.0` on the end does not parse via the `Date` constructor and falls through to `Invalid Date`. This is a **data-shape bug at write time** (something wrote a stringified epoch instead of an ISO string for this one record), not a rendering bug — worth a BACKLOG entry to (a) find what write path produced this and guard it, and (b) defensively coerce/validate `startTime` client-side so a malformed value degrades to blank rather than the literal text "Invalid Date" on a public-facing live card.
- **MEDIUM — same `/api/matches` response includes a `loggerId` field** (`null` on the records checked, but present in the shape) on the public list endpoint. `loggerId` is explicitly named in this project's own banned-public-fields list (NDPR/GDPR). Value is currently `null` for the records sampled so no PII is actually leaking today, but the field's presence in the DTO means it *will* leak the moment a match has a logger assigned, unless the serializer already strips it elsewhere for other callers. Flagging for the security/DB-health agents to confirm scope — did not chase further, out of this agent's lane.
- Live score, LIVE badge, minute-based state, and the venue/competition line all otherwise render correctly and match DB values (`homeScore: 11, awayScore: 9, status: LIVE`).

---

## `/matches/[id]` (real LIVE match: `FPwxd_sliJR0kS__GWa66`, "TEAM B vs TEAM A")

**Runtime accessibility:** `issueCount: 2`, `h1Count: 0`.
- **HIGH — no `<h1>` on the match detail page either** (only one `H3` found). Same pattern as homepage — recurs here. Worth fixing once at a shared layout/page-title level rather than per-route.
- **HIGH — 2 icon-only controls with no accessible name**: header icon button (`p-2 rounded-lg bg-muted` — bell/notifications by position) and the same PWA "Update available" toast close (X), consistent with `/` and `/live`.

**Tabs (Overview / Timeline / Stats / Lineups / H2H / Table) — all clicked through, all render correctly:**
- Overview, Timeline, Lineups (pitch view with real player positions/jersey numbers), H2H (head-to-head record with real aggregate stats) all rendered correctly with real data.
- Stats tab initially appeared to render blank on first click — investigated via DOM inspection rather than trusting the screenshot (per this project's own "DOM measurement over screenshots" convention): the stat rows (Shots, Shots on Target, Corners, Fouls, Yellow Cards, Saves) were present in the DOM with correct light-colored text on transparent background, not actually a rendering bug — a re-screenshot after allowing hydration to settle showed it fully populated. **False alarm, not a finding** — noting only so it isn't re-flagged by a later pass without re-checking.
- Table tab correctly shows a proper empty state ("Standings Unavailable — This match isn't linked to a competition table") rather than crashing, since this specific match has `competitionId: null`. Good defensive UX.

**Data quality (found via this match, root cause already logged under `/live` above):**
- The malformed `startTime` (`"1788963960000.0"`) causing "Invalid Date" is a `/live`-and-detail-page-shared issue — same match, same root cause, not re-logged separately here.

**Theming:** Toggled `localStorage.theme` between dark/light + reload on this route — light theme renders correctly across header, score, tabs, and the "Standings Unavailable" empty state. No leftover hardcoded-dark boxes found. Confirms `BACKLOG-216` light/dark retrofit holds on this route.

**Responsive (375 / 768 / 1440):** `document.documentElement.scrollWidth === clientWidth` at all three breakpoints — no real horizontal overflow at any size.
- At 375px, the tab strip (Overview/Timeline/Stats/Lineups/H2H/Table) correctly overflows into its own horizontally-scrollable container (`overflow-x-auto` on a dedicated wrapper, confirmed via computed style: `scrollWidth: 482` vs `clientWidth: 343` on that wrapper only) rather than pushing the whole page wide. This is a deliberate, working mobile pattern — not a bug.
- Verified via `getBoundingClientRect()` (not screenshot pixel-counting, which the Browser pane sometimes renders at a different internal scale than the emulated viewport and can look misleading) that both team crests and the score sit correctly inside the viewport bounds at 768 and 1440 — no overlap or clipping.
- **LOW — team crest images have empty `src` (`logo: ""` in the API response) and fall back to the browser's native broken-image icon + "TEAM" alt text**, at 48×48px (`w-12 h-12`), consistent across all breakpoints. This is a content/data-completeness gap (these specific test teams have no logo uploaded), not a code defect — flagging only because it's visible on every match card and detail page across the site and would look unpolished in a stakeholder demo screenshot.

---

## `/competitions` and `/competitions/[id]`

**Runtime accessibility:** both clean — `issueCount: 0`, `h1Count: 1` on both. Competition list uses colored-initial avatar badges (e.g. "BL", "BF", "NF") instead of `<img>` tags, which incidentally sidesteps the broken-logo problem seen on team/match crests.
**Visual/content:** `/competitions/m-4qhMBvnUP2a-GcU-Rsv` ("BUSA LEAGUE BASKETBALL") renders a full standings table with real team logos, W/L/PCT/GD/PTS columns, correctly sorted by rank. No issues found. Tabs present (Standings/Matches/Brackets/Stats) — not all clicked through in depth given time budget, but Standings (default) is solid.

---

## `/teams` and `/teams/[id]`

**Runtime accessibility:**
- `/teams`: clean — `issueCount: 0`, `h1Count: 1`.
- `/teams/NVn_ZGTVuW_Kqx-7I1X7O` ("TBK"): **MEDIUM — one unlabeled `<select>`** (a season/competition dropdown in the "Season Stats" panel — no `name`, `id`, or `aria-label`), `h1Count: 1` (good).

**Visual/content:**
- **MEDIUM — sport-terminology mismatch**: `/teams?competition=<BUSA LEAGUE BASKETBALL>` summary bar shows a stat tile labeled **"TOTAL GOALS"** (value `2322`) on a **basketball** league page. Basketball doesn't have "goals" — this is very likely a shared stat-tile component hardcoded to football terminology ("goals") reused as-is for basketball's points total, not translated per-sport. Same likely root cause would affect any other basketball/non-football competition using this shared component — worth a quick grep for other sport-conditional label logic nearby.
- **MEDIUM — two distinct competitions share the exact same display name "BUSA LEAGUE FOOTBALL"** with no disambiguator, both appearing as separate, identically-labeled tabs in the `/teams` page's "Internal Leagues" filter row (confirmed via DOM query — two separate `<button>` elements, both text `"BUSA LEAGUE FOOTBALL"`, distinct click handlers). Cross-checked against `/api/competitions`: there are indeed two real competitions with this exact name — one `season: "2025/2026"` (completed), one `season: "2026/2027"` (per the `/competitions` page's own season subtext, upcoming). The `/competitions` list page shows season alongside the name so they're distinguishable there, but the `/teams` page's competition-filter tabs drop the season, making the two picks indistinguishable to a user until after they click one.
- **Recurs from homepage** — the same **"MOCK SHOWCASE (delete me)"** test-fixture text appears again, this time on the TBK team detail page header (next to the "12 Players" count). Same non-bug-per-project-convention caveat as the homepage finding, but now confirmed to recur on at least 2 surfaces — likely worth a single quick data cleanup pass across whichever fixture(s) carry this label, given it's now spotted twice independently.
- Team overview (recent activity / results with W/L badges, season stats card with PTS FOR/AGST and win-rate bar) all render correctly with real, consistent data (`Matches Played: 10`, `PTS FOR: 360`, matches the `/teams` list total of `10 games, 8W`).

---

## `/players/[id]` (real player: `zzyrKo8tGIMIw-IGU2yKq`, "JORDAN", Storm, Basketball)

**Runtime accessibility:** clean — `issueCount: 0`, `h1Count: 1`.

**Visual/content — two real bugs found:**
- **MEDIUM — duplicated unit suffix on Height/Weight**: Basic Info shows **"Height: 186cm cm"** and **"Weight: 81kg kg"**. The underlying value is already a formatted string with its unit (`"186cm"`, `"81kg"`), and the display template appends a second, hardcoded `" cm"` / `" kg"` label on top of it. Low-effort fix (either store/read the raw number and format once, or stop appending the label), but visible on every player profile's Basic Info card — high-visibility for something this small.
- **HIGH — "Recent Performances" renders dozens of broken, meaningless event badges**: each of the 3 recent-match entries shows a row of small chips reading **"📋 -1′"** repeated many times per match (11 on the first match shown, 26 on the second, 9 on the third — counts don't obviously map to anything about the match). Each badge is a clipboard icon + a negative, clearly-invalid minute value with no event type, player action, or other label — this reads as a broken render of a match-events list (a loop iterating over the wrong array, or a minute field defaulting to `-1` when unset, repeated once per some unrelated count rather than once per real event). This is a public player-profile page and the bug is immediately visible without any interaction — worth prioritizing over the other Medium/Low findings on this page. Did not chase the root cause in `src/` (out of this agent's read-only-audit scope) but the pattern (fixed icon + literal `-1'` + a per-match repeat count that doesn't match anything visible) is a strong lead for whoever picks this up.
- Individual Stats (Pts/Game, Rebounds/Game, Assists/Game, Steals, Blocks) and Career History render correctly with plausible real data.

---

## `/search`

**Runtime accessibility:** `issueCount: 1` (one icon-only header button, consistent pattern), `h1Count: 1` ("Search Results" — good).

**Visual/content:**
- **MEDIUM — the dedicated `/search` route appears to be dead/orphaned and hangs forever if visited directly.** The actual search UX on this site is a header-triggered inline overlay (magnifying-glass icon → an in-place `<input placeholder="Search teams, players, matches...">` that live-filters and renders results without ever navigating — confirmed: after typing "team" and pressing Enter, `location.href` stayed at `/`, results rendered inline with a working Teams/Matches/Players/Competitions tab breakdown, all correct). The standalone `/search` route, by contrast, loads with `ALL 0 / TEAMS 0 / PLAYERS 0 / MATCHES 0 / COMPETITIONS 0` and a permanent "Searching…" spinner that never resolves and never shows an empty-state prompt — there's no `<input>` anywhere on that page (confirmed via DOM query, `inputs: 0`), so a user landing there (bookmark, shared link, browser back/forward, direct URL entry) has no way to actually search and no escape from the spinner. Low-traffic path (the real search entry point bypasses this route entirely) but a genuine dead end if hit.
- **LOW — inconsistent team-name casing in search results**: "TEAM A", "TEAM B", "TEAM c", "TEAM D" — one entry ("TEAM c") is lowercase where its siblings are uppercase. Data-entry inconsistency in test fixtures, not a code bug.
- Inline overlay search itself works well: live-as-you-type, correct result counts per category, real team/match data returned.

---

## `/profile` and `/profile/settings`

**Runtime accessibility:**
- `/profile`: `issueCount: 3` (1 icon-only avatar-edit button + 2 unlabeled inputs), `h1Count: 1`.
- `/profile/settings`: `issueCount: 6`, all unlabeled inputs (`Full Name`, `Email Address`, and further fields below the fold not individually inspected) — these have adjacent visible text ("Full Name", "Email Address") but it's a plain `<div>`/`<span>`, not a `<label for>`, so screen readers get an unlabeled textbox. `h1Count: 1` ("Settings" — good).

**Visual/content:**
- `/profile` renders correctly: cover photo, avatar, stats (Matches Watched, Favorite Players/Teams, Predictions), achievements grid, Favorite Team card, Recent Activity empty state — all real data for the injected admin/Fan session, nothing broken.
- `/profile/settings` Account/Appearance sections render correctly in both themes. One methodology note: an initial screenshot made the Full Name/Email input **values** look blank in dark mode, which looked like a contrast bug — investigated via `getComputedStyle` before concluding anything (per this project's "verify before concluding" convention) and found the real cause was a **viewport/screenshot-canvas width mismatch** (input `rect.right` at x=928 while the screenshot canvas was only 799px wide — the field was simply off the right edge of the captured image, not actually invisible). Text color/contrast (`oklab(0.98 0 0)` near-white on a dark `oklab(0.18 0 0)` background) is fine. **Not a bug** — noted only so this isn't mistakenly re-flagged from a screenshot alone by a later pass.
- Theme toggle buttons (Dark/Light) on this page work and correctly reflect/update `localStorage.theme` — spot-checked as one of the 4-5 high-traffic light/dark toggles for this walkthrough.
