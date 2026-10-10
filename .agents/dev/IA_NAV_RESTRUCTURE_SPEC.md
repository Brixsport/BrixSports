# Spec — Mobile Nav / IA Restructure (Later-bucket item 15)

**Source findings:** `PRODUCT_DESIGN_STATIC_AUDIT_2026-09-17.md` H1, H2, H3.
**Prior art:** `BACKLOG.md` BACKLOG-388 — the literal fix (add Teams/Lineups/News directly into
`BottomNav`, `grid-cols-6` at 375px) shipped 2026-09-15 and was reverted the same day.
**Status:** APPROVED by Richard 2026-09-18 (revision 2), being built as `BACKLOG-406` (nav) and
`BACKLOG-407` (competition header).

## Revision history — why this differs from the first draft

The first draft (commits `d6531ae`, `4f779e0`) recommended a global "More" tab in `BottomNav`
that replaced the homepage hamburger. Richard pushed back ("the hamburger in the top bar is
calm") and asked for the design team to re-assess. The re-assessment reversed the call:

- **"More" is the generic-label anti-pattern** the `information-architecture` skill itself warns
  against ("Other", "Tools"). The first draft broke its own rule.
- **The reference Richard supplied points the other way.** The Sofascore screen shows a gear icon
  in the top bar opening a bottom sheet — a top-bar trigger with a bottom-sheet presentation, not
  a bottom-nav tab.
- **The reachability cost is one tap.** From any page: Fixtures tab, then the menu, then the
  destination. That is inside the 3-hop rule, for destinations Richard says are not daily-use.
- **A bottom-tab change is the kind already reverted once** (`BACKLOG-388`).

What survived from the first draft: the task-frequency table (Teams, Players, News and Lineup
Builder are all secondary), the `/players` browse page, and dropping Lineup Builder's promotional
treatment everywhere.

## Decision

1. **`BottomNav` is unchanged** — Fixtures, Competitions, Profile. No "More" tab.
2. **The homepage hamburger stays in the top bar**, but its panel changes from a full-screen
   overlay to a **bottom sheet** using the existing `src/components/ui/sheet.tsx` (`side="bottom"`).
   That file is the Radix-based shadcn `new-york` component already in the repo; **no install and
   no new dependency**. The Base UI `Sheet` snippet in the design brief targets a different style
   (`base-nova`, `@base-ui/react`) and must not be added, since it would introduce a second dialog
   primitive next to Radix.
3. **Sheet contents:** Teams, Players *(new)*, All Competitions with the existing dynamic list,
   Lineup Builder, News. Rows get a 44px minimum touch height.
4. **Lineup Builder loses its `NewFeatureBadge` and `UpdateTooltip` on mobile and desktop.** The link
   stays in the desktop top bar (position is fine there); only the promotion goes. Reason: 🔴
   High Volatility feature, low-frequency task, and the Live Event Readiness checklist wants
   exposure down, not up.
5. **Desktop top bar gains a Players link.**
6. **New `/players` browse page** (H1: there was no entry point at all).

**Known limitation, accepted:** the top bar (and so the hamburger) exists only on `/`, because
`page.tsx` renders its own `<nav>`. Making the header global is a much larger refactor and is out
of scope. Mitigation: `Fixtures` in `BottomNav` is one tap from anywhere.

## `/players` page (MVP scope)

- Client page at `src/app/players/page.tsx`; search box, sport chips (All, Football, Basketball),
  list rows linking to the existing `/players/[id]`, "Load more".
- Uses the existing `GET /api/players?search=&sport=&limit=&offset=`, which already returns a
  public-stripped DTO (`toPublicPlayer`) and a `total`. Team names come from one `GET /api/teams`
  call (bare array) mapped by `teamId`, because the public DTO strips `memberships`.
- **Known limit, not fixed here:** that endpoint fetches at most 500 players and filters and pages
  in memory (`db.select().from(players).limit(500)`), so the page only ever sees the first 500
  players. Fine at today's ~309; needs real DB-side search and paging before it grows past 500.
- Debounced search (300ms), stale-response guard, loading / empty / error states, a real
  `<label>` on the search input, `aria-pressed` on the chips.

## Competition group header on the homepage (`BACKLOG-407`)

Findings from the design critique of `page.tsx` (competition group header in the match list):

- The header was `bg-muted` on a `bg-muted` card, so it blended into the card body.
- Its `ChevronRight` was `text-foreground/20` — about 20% opacity, below the 3:1 non-text contrast
  bar — and it was **not a link at all**: a dead affordance that looks tappable.
- Matches were grouped by competition **name**, so two competitions sharing a name (same bug
  class as `BACKLOG-401` #7 on `/teams`) merge into one group, and there was no id to link to.

Decision: **tinted, not solid primary.** Solid primary would repeat once per competition group
and outrank the live score, and primary is reserved for active states and buttons (and was just
darkened for AA in light mode, so it would be a heavy band).

- Header becomes a real `<Link>` to `/competitions/{id}` when the id is known (the API already
  returns `competitionId`; the `Match` type just lacked it), `bg-primary/10` tint,
  full-opacity title, primary trophy and chevron, `min-h-11` touch target.
- Group by `competitionId` when present, falling back to the name.
- Without an id it renders as a plain (non-link) header with no chevron, so there is never a
  false affordance.
- Alternative Richard did not pick: a 3px primary left edge instead of a tint.

## Out of scope

- **M1 (bell icon opens Settings, not Notifications)** — separate wiring bug, Later-bucket item 24.
- A global header/top bar.
- `BottomNav` changes of any kind.

## Test scenarios

1. Mobile (375px), on `/`: menu button opens a bottom sheet; the sheet closes via the X, the
   overlay, Escape, and after tapping a link. Contents are Teams, Players, All Competitions plus
   the list, Lineup Builder, News, with no badge or tooltip on Lineup Builder.
2. Sheet with a long competitions list scrolls inside the sheet and never exceeds 85vh; the iOS
   safe-area inset is respected.
3. Desktop (≥768px): top bar shows Teams, Players, Lineup Builder (plain link), News; no badge or
   tooltip; the hamburger and sheet are not shown.
4. `/players`: loads a list; search narrows it; sport chips filter; "Load more" appends;
   empty and error states render; each row opens `/players/[id]`; back button works.
5. Homepage match list: each competition header is tinted, links to `/competitions/{id}`, and a
   duplicate-named competition no longer merges into a single group.
6. Both themes: header tint and chevron are visible in light and dark.
