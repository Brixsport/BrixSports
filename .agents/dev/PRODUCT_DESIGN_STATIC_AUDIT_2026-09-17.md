# Product/Design Static Audit — 2026-09-17

Static/code-level half of the pre-promotion product-design review for `work/match-detail-tabs` (tracking `feature/ui-redesign`), tier **MVP -> PRODUCTION**. Read-only analysis — no source files modified. Companion to the orchestrating session's live/runtime half (real walkthrough, axe-core, responsive breakpoints). Each finding is tagged with the review step(s) that produced it:

1. product-brainstorming (strategy/nav-vs-jobs critique) · 2. design-critique (hierarchy/spacing/consistency) · 3. information-architecture (hop-count/nav structure) · 4. user-research (friction/copy-in-flow) · 5. ux-chaos-monkey (extreme-input validation, static only) · 6. accessibility-review (WCAG spec-level) · 7. micro-interaction-motion-design · 8. dark-mode-theming-system · 9. design-system (token compliance) · 10. ux-copy

Contrast ratios below were computed directly from `src/app/globals.css`'s oklch values via a WCAG relative-luminance script (oklch -> linear sRGB -> sRGB -> luminance -> ratio), not assumed.

---

## Critical

### C1. Raw error internals shown to every end user on a render crash
**Steps:** 4 (user-research), 10 (ux-copy) — flagged for engineering follow-up, not fixed here.
**File:** `src/app/error.tsx:138-157`

The global render-error boundary displays `error.message` and `error.digest` verbatim in a red, monospace, `break-all` box shown to every visitor (anonymous viewers included):

```tsx
<p className="text-red-300/80 text-sm font-mono break-all">{error.message}</p>
{error.digest && <p className="text-red-300/60 text-xs mt-2">Error ID: {error.digest}</p>}
```

CLAUDE.md's own Error Handling Rules state "Never return raw database errors to the client" — this is the client-render-boundary equivalent of that same failure mode: whatever the thrown error's message happens to contain (which can include DB/library internals depending on where the exception originated) is shown, unfiltered, to a non-technical Nigerian-university-sports audience, with no plain-language explanation. It also directly undercuts the immediately-adjacent playful copy ("Houston, we have a problem!") with a stack-trace-flavored panel — see C10 for the tonal read.

### C2. Primary-button text fails WCAG AA contrast in light mode
**Step:** 6 (accessibility-review)
**File:** `src/app/globals.css:79-81` (`--primary: oklch(0.6 0.2 250)`, `--primary-foreground: oklch(0.98 0 0)`)

Computed: **`primary-foreground` on `primary` = 3.67:1** in light mode. WCAG 1.4.3 requires 4.5:1 for normal-size text (3:1 only applies to large/bold text ≥18pt or ≥14pt-bold). Every primary CTA rendered in light mode at normal text size — "Create Account" (`src/app/signup/page.tsx:326-344`), "Sign In", save/submit buttons across admin and forms — fails AA. Dark mode is fine (7.59:1, computed). This is a token-level fix (lighten `--primary-foreground` or darken `--primary` slightly for light mode only), not a per-component one.

### C3. `not-found.tsx` and `error.tsx` are 100% hardcoded dark, bypassing the theme system entirely
**Steps:** 8 (dark-mode-theming-system), 9 (design-system)
**Files:** `src/app/not-found.tsx` (full file), `src/app/error.tsx` (full file)

Both files use zero instances of `--background`/`--foreground`/`bg-card`/etc. — every color is a hardcoded Tailwind slate/orange/white value (`bg-gradient-to-br from-slate-950 via-orange-950/30 to-slate-950`, `text-white`, `bg-white/10`, `text-red-300/80`). Grepping `.agents/dev/BACKLOG.md`'s BACKLOG-216 entries (the ~76-file light/dark retrofit, closed 2026-09-16 as "nothing outstanding") turns up no mention of `not-found.tsx`, `error.tsx`, or `global-error.tsx` — these pages were never in scope for that sweep because they're error boundaries, not "regular" pages, so they were never caught by the retrofit's own file list.

Concretely: a user on light mode who hits a 404 or a render crash is dropped into a forced-dark page — and because neither route is in `BottomNav.tsx`'s `hiddenRoutes` list (`/login`, `/signup`, `/admin`, `/reset-password`, `/forgot-password`, `/lineup-builder`, `/logger` — an arbitrary 404 path or the error-boundary's path won't match any of these), the **light-mode `BottomNav` renders on top of the hardcoded-dark page**, producing a visibly broken theme seam at exactly the moment (an error) a user is least tolerant of a broken-looking product. This is a real, previously-undocumented BACKLOG-216-class gap.

---

## High

### H1. No player browse/index page exists anywhere — Players is effectively undiscoverable
**Step:** 3 (information-architecture)

`src/app/players/` contains only `[id]/` (detail) and `compare/` — there is no `/players` listing route, and nothing in the codebase links to one (confirmed via grep across `src/app` and `src/components`). CLAUDE.md's Scope Boundaries explicitly name "Player and team data management" as in-scope, but a Viewer can only reach a specific player by (a) already knowing their name and using `GlobalSearch`, or (b) drilling into a team's roster from `/teams/[id]`. There is no path that satisfies "browse all players" in any number of hops — this isn't a >3-hop problem, it's a zero-entry-point problem.

### H2. BottomNav and the hamburger menu expose different, only partially-overlapping item sets
**Step:** 3 (information-architecture), 1 (product-brainstorming)
**Files:** `src/components/BottomNav.tsx` vs `src/app/page.tsx:817-856`

`BottomNav` (persistent on every mobile screen it isn't hidden on): **Fixtures, Competitions, Profile/Sign-In** — 3 items only. The hamburger menu (mobile-only, opened from the top nav): **Teams, All Competitions (+ dynamic sublist), Lineup Builder, News** — 4 different items, with only Competitions in common. A mobile user has two separate, non-nested navigation surfaces to check depending on which capability they want (Teams and News exist only in the hamburger; Profile exists only in the bottom bar). Neither is a subset of the other, which is the specific anti-pattern IA calls out: predictable hierarchy requires one coherent structure, not two competing ones.

### H3. Lineup Builder (🔴 High Volatility per CLAUDE.md) is the most heavily promoted nav item in the app
**Step:** 1 (product-brainstorming), 2 (design-critique)
**File:** `src/app/page.tsx:418-423` (desktop), `:848-851` (mobile hamburger)

CLAUDE.md keeps Lineup Builder flagged 🔴 "conservatively pending a full re-audit," yet it's the only nav item wrapped in an `UpdateTooltip` ("New: build and share your matchday starting XI") *and* carrying a persistent `NewFeatureBadge` in **both** desktop and mobile primary nav — more promotional weight than Teams, News, or even Competitions. If the volatility flag is meant to keep exposure low pending re-audit, the current nav treatment actively works against that by driving traffic toward it.

### H4. Non-text (border) contrast fails WCAG 1.4.11 in both themes
**Step:** 6 (accessibility-review)
**File:** `src/app/globals.css:89,103` (light `--border`/`--input: oklch(0.85 0 0)`), `:123,137` (dark `--border`/`--input: oklch(0.2 0 0)`)

Computed: `border` vs `card` = **1.56:1 light / 1.11:1 dark**; `border` vs `background` = **1.37:1 light / 1.14:1 dark**. WCAG 1.4.11 requires ≥3:1 for UI-component boundaries (input outlines, card edges, dividers). Both themes fail by a wide margin — worse in dark mode than light. The CSS's own session-51/2026-09-16 comments describe a deliberate pass to fix "nearly invisible" dividers by darkening `--border` to 0.85/0.2, but that pass targeted the card-vs-background elevation gap, not border-specific non-text contrast — the border tokens themselves were never re-validated against the 3:1 threshold and still fail it.

### H5. No form label/input association or error announcement in signup (and likely login)
**Step:** 6 (accessibility-review)
**File:** `src/app/signup/page.tsx:209-324`

All four fields (name, email, password, confirm-password) use a bare `<label className="...">Full Name</label>` with no `htmlFor`, paired with an `<input {...form.register(...)}>` that has no `id` — there is no programmatic label/input association (WCAG 1.3.1, 3.3.2, 4.1.2). Validation errors render as a plain `<p className="text-xs text-red-500">` with no `role="alert"`, `aria-live`, `aria-invalid`, or `aria-describedby` linking the error back to its field (WCAG 3.3.1). A screen-reader user gets no association between label and field, and no announcement when a field fails validation.

### H6. No max-length validation on name/team/player text fields
**Step:** 5 (ux-chaos-monkey)
**Files:** `src/app/signup/page.tsx:34-50` (zod schema), `src/app/admin/players/page.tsx`, `src/app/admin/teams/page.tsx` / `[id]/page.tsx`

Signup's zod schema enforces only `name.min(2)`, email format, and `password.min(6)` — no `.max()` anywhere. Grepping the admin players and teams forms for `maxLength` returns zero matches — there is no client-side cap on player-name or team-name length at all. `src/components/ui/MatchCard.tsx` (the component that renders team/competition names throughout the app) has only 3 total `truncate`/`overflow-hidden`/`line-clamp` occurrences in the whole file. Combined, an admin (or a compromised/careless input) entering an extremely long team or player name has very little standing between it and a broken card/table layout — this needs either schema-level max-length or comprehensive truncation, and currently has neither reliably.

---

## Medium

### M1. Bell icon opens Settings, not Notifications
**Step:** 2 (design-critique), 1 (product-brainstorming)
**File:** `src/app/page.tsx:437-448`

```tsx
<button onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(true); }} ...>
  <Bell size={18} .../>
  {notifications.length > 0 && <span className="... bg-primary rounded-full"/>}
</button>
```

The bell icon — universally understood as "notifications" — shows an unread-count dot but opens `SettingsOverlay` on click, not a notifications list. (A separate `/notifications` route and `Notifications.tsx` component exist elsewhere in the app, so the destination mismatch looks like a wiring leftover rather than an intentional choice.) This is a strong candidate for real user mis-clicks and confusion, worth confirming against the live walkthrough.

### M2. Two fully decorative, infinite-loop animations with no reduced-motion escape hatch
**Step:** 7 (micro-interaction-motion-design)
**Files:** `src/app/not-found.tsx:43-66` (5 bouncing/rotating basketballs), `src/app/error.tsx:56-76` (50 pulsing dots)

Both use `repeat: Infinity` on purely decorative background elements with no interaction tie-in. A project-wide grep for `prefers-reduced-motion` and `useReducedMotion` returns **zero matches** anywhere in `src/` — there is no reduced-motion handling at all in this codebase, on any animation. The specific placement is the concerning part: these two infinite loops sit on the exact two pages (404, crash) where a confused or frustrated user is most likely to linger, and are also the pages most likely to be visited by a vestibular-sensitive user who has no way to opt out. The rest of the app's motion (BottomNav's spring-based active-tab indicator, `layoutId="bottomNavIndicator"`, `src/components/BottomNav.tsx:82-115`; signup's mount/success transitions) is purposeful and state-driven — this is the exception, not the pattern, but it's a real one.

### M3. 589 hardcoded color-utility occurrences across 63 component files bypass the token system
**Step:** 9 (design-system), 8 (dark-mode-theming-system)
**Evidence:** grep for `text-gray-*`/`bg-gray-*`/`border-gray-*`/`text-white`/`bg-black`/raw hex across `src/components`

Highest concentrations: `FootballLogger.tsx` (113), `BasketballLogger.tsx` (68), `LoggerAnalyticsDashboard.tsx` (19), `MultiLoggerStatus.tsx` (9), `admin/AdminSidebar.tsx` (7). Per BACKLOG-216's own documented Phase 2e decision, Logger UI is **deliberately kept dark-only permanently** (glare/battery/night-game rationale) — so hardcoded-dark values there are a known, accepted design decision, not a gap. The severity read changes for the smaller number of occurrences that leak into general-audience surfaces: `src/app/signup/page.tsx:290` has one stray `text-gray-400` in an otherwise fully token-based file (`bg-card`, `text-foreground/40`, `bg-primary` everywhere else), and `not-found.tsx`/`error.tsx` (C3 above) are 100% hardcoded on pages every kind of user — including light-mode Viewers — can land on. Recommend closing the general-audience instances; the Logger/Admin volume is correctly out of scope per the existing BACKLOG-216 decision.

### M4. Registration failure toast surfaces a raw internal error code to the user
**Step:** 4 (user-research), 10 (ux-copy)
**File:** `src/app/signup/page.tsx:122-133`

```tsx
toast.error("Registration failed", {
  description: (<div>...<p>{getClientErrorMessage(error, "Please try again later.")}</p>
    {(error as any).code && <p className="text-[10px] font-mono uppercase opacity-50">Code: {(error as any).code}</p>}</div>),
});
```

Smaller-scale version of C1: a non-technical end user sees a monospace internal error code with no explanation of what it means or what to do about it. Lower severity than C1 because it's paired with a human-readable message above it, but the same underlying pattern (raw internals surfaced to a general audience) recurring in a second place suggests it's a house habit worth calling out once rather than twice.

---

## Low

### L1. Inconsistent nav-label type scale
**Step:** 2 (design-critique)

`BottomNav.tsx`'s nav labels use `text-[10px]` (an arbitrary value, not a scale step); `src/app/page.tsx`'s desktop top-nav links use `text-xs` (12px) — both are "uppercase bold tracking-wider nav label," the same conceptual role, at two different sizes with no shared token. Minor, but exactly the kind of drift a type scale exists to prevent.

### L2. Error/404 pages block all content on client hydration
**Step:** 6 (accessibility-review)
**Files:** `src/app/not-found.tsx:20-29`, `src/app/error.tsx:25-44`

Both gate their entire render behind `if (!isClient) return null` (originally there to sequence now-removed Three.js scenes — see the `BACKSCOPED: 2026-06-11` comments in both files). The 3D scenes are gone, but the gate remains, so a screen reader, a no-JS visit, or a slow-hydration session gets a fully blank page — no landmark, no heading, nothing announced — until React mounts. This is a leftover from a removed feature, not a deliberate constraint, and looks safe to remove now that nothing in either file is actually client-only.

### L3. Sport-voice inconsistency across the two error surfaces
**Step:** 10 (ux-copy)

`not-found.tsx` is written in all-basketball idiom ("AIR BALL!", "missed free throw," a Michael Jordan quote hedged **"(probably)"**), while `error.tsx` is all-football/stadium idiom ("the server fumbled the ball," a Messi quote) — on a platform whose own metadata (`layout.tsx`) advertises football, basketball, *and* "other" sports. Neither page's voice is wrong on its own, but the two don't read as one product's voice, and the parenthetical "(probably)" on the Jordan attribution reads as an unfinished placeholder rather than an intentional joke.

### L4. Positive — good copy differentiation in login's OAuth error handling
**Step:** 4 (user-research), 10 (ux-copy)
**File:** `src/app/login/page.tsx:31-47`

Worth calling out as a pattern to keep: the login page distinguishes a user-declined Google consent screen (`toast.info("Google sign-in cancelled")`) from an actual OAuth failure (`toast.error("Google sign-in failed", { description: "Please try again, or sign in with your email and password." })`), with an inline comment noting explicitly that a cancel "is not a bug." This is exactly the "what happened + why + how to fix" structure the rest of the app's error copy (C1, M4) doesn't consistently follow.

### L5. Positive — icon-only nav buttons meet the 44×44px touch-target minimum
**Step:** 6 (accessibility-review)
**File:** `src/app/page.tsx:430-479`

Search, Bell/Settings, and the hamburger toggle all use `w-11 h-11` (44×44px exactly), meeting WCAG 2.5.5's minimum touch-target size. Confirmed as a pass, not just an absence-of-failure.

---

## Contrast reference table (computed from `globals.css` oklch values)

| Pair | Light | Dark | AA requirement | Result |
|---|---|---|---|---|
| `foreground` / `background` | 17.00:1 | 19.44:1 | 4.5:1 | Pass both |
| `muted-foreground` / `background` | 6.43:1 | 5.22:1 | 4.5:1 | Pass both |
| `muted-foreground` / `card` | 7.33:1 | 5.10:1 | 4.5:1 | Pass both |
| `primary-foreground` / `primary` | **3.67:1** | 7.59:1 | 4.5:1 | **Fail light** (C2) |
| `accent-foreground` / `background` | 3.36:1 | 7.59:1 | 4.5:1 (3:1 if large) | Borderline light — only used with the `accent` background's own alpha in practice; flag for live-verification if `accent-foreground` is ever set directly on bare `background` |
| `border` / `card` | **1.56:1** | **1.11:1** | 3:1 (non-text) | **Fail both** (H4) |
| `border` / `background` | **1.37:1** | **1.14:1** | 3:1 (non-text) | **Fail both** (H4) |

---

## Summary of what's already right (don't re-litigate)

- The `:root`/`.dark` token system in `globals.css` is genuinely semantic (elevation via lightness deltas, not an inverted palette) — BACKLOG-216's own iteration history shows real live-verification work, and the token layer itself is sound.
- `/predictions` is deliberately unlinked from all navigation — confirmed intentional per BACKLOG history, not a gap.
- Logger UI's dark-only-permanent decision (BACKLOG-216 Phase 2e) is a considered call for a live-match, night-usage tool, not an oversight — the hardcoded-color volume there (M3) is correctly out of scope.
- BottomNav's active-tab motion (`layoutId` spring + icon scale) is a good example of purposeful, state-answering animation.
