# Spec — Mobile Nav / IA Restructure (Later-bucket item 15)

**Source findings:** `PRODUCT_DESIGN_STATIC_AUDIT_2026-09-17.md` H1, H2, H3.
**Prior art:** `BACKLOG.md` BACKLOG-388 — the literal fix (add Teams/Lineups/News directly
into `BottomNav`, `grid-cols-6` at 375px) shipped 2026-09-15 and was **reverted same day**
by Richard, reason undocumented beyond "reconsidered." A "dedicated More tab" was floated
at revert time but never scoped.
**This pass:** ran the `information-architecture` skill against the findings before writing
anything, specifically because the last attempt skipped that step and got reverted.
**Status:** SPEC ONLY — no code changed. This is a second attempt at a nav change Richard
already reverted once; get an explicit go before implementing, unlike item 13 (backend-only,
lower blast radius).

---

## The findings

- **H1:** no `/players` browse page anywhere. Zero entry point, not a hop-count problem.
- **H2:** `BottomNav` (global, persistent: Fixtures/Competitions/Profile) and the homepage's
  own hamburger (homepage-only: Teams/All Competitions/Lineup Builder/News) are two
  non-nested nav surfaces — neither a subset of the other, and the hamburger is unreachable
  from anywhere except `/`.
- **H3:** Lineup Builder — 🔴 High Volatility per `CLAUDE.md`, untested under real
  multi-logger/multi-user load — carries the single heaviest promotional nav treatment in
  the app (`UpdateTooltip` + persistent `NewFeatureBadge`, desktop and mobile both).

## Richard's framing (verbatim, this session)

> "the lineup builder isnt a major or day to day activity task need to be on bottm nav bar
> and unlinke desktop in the top nabar guess the hamburger menu is enough then?"

His instinct: Lineup Builder isn't a daily-use action like Fixtures/Competitions, so it may
not deserve primary-nav real estate at all — asked for this to be checked against real IA
reasoning rather than either of us asserting it.

## IA assessment

Task-frequency is the load-bearing test for primary (persistent, thumb-reachable, every
screen) vs. secondary (one hop away, opened on demand) nav placement — not "does this
feature exist," which is the mistake BACKLOG-388 made by treating every top-level route as
equally nav-worthy.

| Item | Real usage pattern | Frequency | Primary or secondary? |
|---|---|---|---|
| Fixtures | cold-start "what's live/next" | every session | **Primary** (already is) |
| Competitions | cold-start hub, cross-cutting | frequent | **Primary** (already is) |
| Profile | account/auth gate | every session | **Primary** (already is) |
| Teams | reached contextually — tap a team name from a match/standings, rarely a cold "browse teams" start | moderate, contextual | Secondary |
| Players | same contextual pattern as Teams; H1's gap is "no entry point at all," not "needs primary weight" | low, contextual | Secondary |
| News | read-when-idle, not task-driven | low | Secondary |
| Lineup Builder | build-once-per-matchday at most; a tool/action, not a content hub; still 🔴 untested at load | lowest of the set | Secondary — **confirms Richard's instinct** |

**H2's actual defect isn't "too few items in BottomNav," it's two competing secondary
surfaces that don't nest.** BACKLOG-388's fix put everything in the primary bar to collapse
that into one surface — the wrong direction. The IA-correct collapse is the opposite: keep
primary nav at its current frequency-justified size, and unify the *secondary* surface into
one, made globally reachable instead of homepage-only.

## Recommendation

- `BottomNav` stays 4 items: **Fixtures, Competitions, More, Profile**. `grid-cols-4` at
  375px — well inside touch-target size, nowhere near the `grid-cols-6` squeeze that got
  reverted.
- **"More"** replaces the homepage-only hamburger as a single global secondary surface
  (bottom sheet), reachable from every route `BottomNav` already renders on — not just `/`.
  Contains: Teams, Players *(new)*, News, Lineup Builder. One coherent list, not two nav
  surfaces to check depending on what a user wants — this is the actual fix for H2.
- Lineup Builder's row inside "More" is a **plain list item** — no `NewFeatureBadge`, no
  `UpdateTooltip`. Dropping the promotional treatment isn't a separate decision bolted on;
  it falls out of the frequency table above, and it's also what the Live Event Readiness
  Checklist's "🔴 features hidden from UI" line is actually asking for — this doesn't fully
  satisfy that line (Lineup Builder is still reachable, just not promoted), but it stops
  actively driving traffic toward an untested feature, which is the more actionable half of
  that checklist item.
- **`/players` browse page (H1):** minimal MVP-tier list/search view — reuse the existing
  players search backend (`GlobalSearch`'s query or `/api/players` with pagination already
  in place per `BACKLOG-395`'s configurable `.limit()` fix), no new design system, no filter
  UI beyond what already exists. Linked from the new "More" sheet.

## Explicitly not in this spec

- **M1 (bell icon opens Settings, not Notifications)** — tracked separately as Later-bucket
  item 24, nav-adjacent but a wiring bug, not an IA question.
- Desktop nav — H3's promotional treatment exists there too, but Richard's own framing
  above specifically contrasts mobile (no room, hence this restructure) against desktop
  ("unlike desktop in the top navbar" — implying desktop's top nav already has the room and
  isn't the problem). Leaving desktop's Lineup Builder treatment untouched unless flagged
  separately.

## Implementation notes (for when this is built)

- "More" is a new small shared component (bottom sheet/drawer), not a page — same
  interaction weight as the settings/notifications overlays already in the app.
- Retire `page.tsx`'s homepage-only hamburger entirely once "More" ships — keeping both
  would resurrect H2 (two surfaces again) rather than fix it.
- `BottomNav.tsx`'s existing `hiddenRoutes` list (`/login`, `/signup`, `/admin`,
  `/reset-password`, `/forgot-password`, `/lineup-builder`, `/logger`) is unaffected — "More"
  inherits the same visibility rules as the rest of the bar.

## Test scenarios

1. 375px `scrollWidth` vs `clientWidth` check on `BottomNav` post-change — this project's
   own established verification method for this exact failure class (`BACKLOG-370`/`371`).
2. From a non-homepage route (e.g. a match detail page), confirm Teams/Players/News/Lineup
   Builder are all reachable via "More" — the concrete fix for H2's "hamburger is
   homepage-only" gap.
3. Confirm Lineup Builder's "More" row has no badge/tooltip, while the feature itself still
   works end to end when tapped (demoted in nav weight, not removed).
4. `/players` loads a real list, paginates, and each row links to the existing
   `/players/[id]` detail page.
