# BACKLOG Stale / No-Reason OPEN Item Audit — 2026-09-18

**Purpose:** flag OPEN (or equivalent non-closed) `BUG-XXX`/`BACKLOG-XXX` entries in
`.agents/dev/BACKLOG.md` that look stale — no clear reason they're still open, no
recent activity, or possibly already resolved by code that's since changed. This is a
**flagging pass only** — nothing below was closed, resolved, or edited. All decisions
belong to Richard.

Companion to this session's archival pass (`BACKLOG_ARCHIVE.md`), per
`ENGINEERING_AUDIT_2026-09-17.md` finding H3.

## Methodology

- Parsed all ~535 entry blocks in `BACKLOG.md` (script-based, not manual transcription,
  to avoid missing any). Classified each as OPEN/PARTIAL (not resolved/shipped/etc.)
  or CLOSED based on its own `**Status:**` field and strikethrough convention.
- Of 220 OPEN/PARTIAL entries, 116 had **both** (a) no explicit deferral language
  (no mention of "Richard," "deferred," "blocked on," "accepted risk," "explicit call,"
  "descoped," "future work," etc. anywhere in the entry body) **and** (b) either no
  date evidence at all, or a most-recent date before 2026-08-01 (~7 weeks stale as of
  today).
- That heuristic is a starting filter, not a verdict — plenty of the 116 below are
  perfectly legitimate backlog items that are simply old and low-priority, not actually
  wrong or forgotten. A sample was spot-checked directly against the current codebase
  (grep/read) to see whether the underlying problem still exists, was silently fixed by
  later work, or references something that no longer exists. Given the volume (116),
  not every item was code-checked — see "Verified against current code" below for what
  was, and treat everything else as flagged-but-unverified.
- **Important false-negative caveat:** the heuristic only reads each entry's own text.
  A few flagged items (e.g. `BACKLOG-009`) are *not* actually forgotten — they're
  re-confirmed as still-open elsewhere in the document, just not inside their own
  entry body where my scan looked. See the note under `BACKLOG-009` below.

---

## Most concerning finding

### BUG-148 — "Google OAuth Sign-In Is Completely Broken (Missing Callback Route)"

**Status in file:** `OPEN — found session 47D, not fixed` (filed 2026-07-27, L5145)

**Verified against current code: this has been silently resolved, and the entry was
never closed or cross-referenced.** `BACKLOG-362` (a much later entry, ~L10511, well
after this audit's own archival cutoff) fixed exactly the problem BUG-148 describes —
moved the callback to `src/app/api/auth/callback/google/route.ts` (the path actually
registered in Google Cloud Console) and fixed a trailing-slash double-slash bug in the
redirect URI (`src/lib/google-oauth.ts`). Confirmed on disk: `src/app/api/auth/google/`
now contains only the initiate route, and `src/app/api/auth/callback/google/route.ts`
exists with a code comment explicitly describing this exact fix ("This route did not
exist at all until this fix... sent a fan through the actual Google consent screen and
then 404'd on the way back"). Git log confirms multiple real commits
(`73400a2`, `0e77479`, `5ba2bc4`, `f6f92f6`) plus the most recent session's own commits
(`d406ed4`, `e37d5ef`, `8b2e971` — `BACKLOG-371`, "Google OAuth cherry-pick confirmed
live by Richard on brixsports-staging.vercel.app").

**Why this matters more than a typical stale entry:** anyone reading `BACKLOG.md` today
sees "Google OAuth Sign-In Is Completely Broken" as an open, unaddressed bug, when in
fact Google OAuth is now live, confirmed by Richard on staging, and has its own recent
hardening pass (`BACKLOG-371`). This is actively misleading, not just outdated.
**Recommend closing BUG-148 as `SUPERSEDED by BACKLOG-362` in the same pass this audit
gets reviewed.**

---

## Other verified findings (checked against current code)

| ID | One-line description | Verification result |
|---|---|---|
| `BUG-030` / `BUG-031` | `/competitions/[id]` base route 404s; `TeamLogo` rendering broken across standings tables | **Stale — likely resolved.** `src/app/competitions/[id]/page.tsx` now exists as a full, substantial page (not a stub/redirect) — the 404 no longer reproduces. The page appears to have been rebuilt entirely since this was filed (references `BACKLOG-229` in an inline comment, a much later item), so the original "needs a redirect page.tsx" fix description is obsolete even though the underlying complaint is resolved. `BUG-031` (logo rendering) needs a fresh look at the current component, not assumed fixed. |
| `BACKLOG-061` | Competition detail page tab audit — Top Scorers/Assists/Discipline are empty shells, no Teams tab, Rules hardcoded | Cites `BUG-030`/`BUG-031` as supporting context; since the base page has clearly been rebuilt since this was filed (2026-06-16), the whole table of "verified status after trace" in this entry is likely out of date. Worth a fresh trace before assuming any row is still accurate, rather than resuming from this entry's table as-is. |
| `BACKLOG-030` | Clean up deprecated `mock-data.ts` imports | **Still valid, not stale.** `src/lib/mock-data.ts` still exists and is still imported by `src/components/MyFeed.tsx` and `src/components/TopPlayers.tsx`. Old (filed 2026-06-08) but the problem is unchanged — just neglected. |
| `BACKLOG-013` | Audit Stripe installation (payments are explicit Out of Scope per `CLAUDE.md`) | **Still valid, and worth escalating.** `package.json` still has `"stripe": "^19.2.0"` — an unused, out-of-scope payment SDK has been sitting in production dependencies since session ~5 (2026-06-05), unaudited for 3+ months. Also itself violates the settled "pin all production deps to exact versions" rule (caret range, not pinned). Low urgency (unused code, not a live risk) but a very cheap, very safe cleanup that's been sitting untouched the whole project. |
| `BUG-026` | Service worker serves stale JS chunk URLs after deploy | Has a stated reason (fix shipped session 19, verification step never completed) so it's not a "no reason" case, but it's been sitting exactly at "prod verification still open" for 3+ months without anyone circling back. Borderline — flagging for visibility, not miscategorized. |
| `BACKLOG-009` | Remove vestigial `next-auth` package (dual Google-auth system) | **Not actually stale** despite no date/reason in its own entry — a much later entry (~L11797, in the `BACKLOG-371` writeup) explicitly re-confirms: *"`next-auth` dual-auth-system remains unresolved (`BACKLOG-009`)... Flagged in the June audit, still open today per direct check."* `package.json` confirms `next-auth@4.24.13` is still present alongside the custom Google OAuth flow. This is a real, live, recently-reconfirmed gap, not a forgotten one — good candidate to fold into the next auth-focused session as that later entry itself recommends. Included here only to document the heuristic's blind spot (see Methodology). |

---

## Full flagged list (heuristic: OPEN/PARTIAL, no deferral language found, and stale/no date)

Unverified beyond the table above — one-line description is the entry's own header/opening
text, truncated. `L` is the current line number in `BACKLOG.md`.

| ID(s) | Line | Last date seen | One-line description |
|---|---|---|---|
| BACKLOG-094 (Eye Point Awards) | L80 | 2026-06-24 | `LiveMatchTimeline` Eye Point Awards panel never renders — API never returns `eyePoints` |
| BUG-085 | L102 | 2026-06-29 | `EventDrivenNotifier` dedup key includes `Date.now()`, so dedup never matches |
| BUG-086, BUG-084 | L104 | 2026-06-29 | Notifier logs success regardless of actual `sentCount` |
| BUG-087, BUG-082 | L106 | 2026-06-29 | Viewer favorites fetch races with auth initialization |
| BUG-088 | L108 | 2026-06-29 | `GET /api/notifications` returns fabricated data; hardcoded `unreadCount: 0`; PATCH is a no-op |
| BUG-089 | L110 | 2026-06-29 | WS "subscribe storm" — 3-5x `match:subscribe` per connect |
| BUG-091, BACKLOG-118 | L112 | 2026-06-30 | Favourite heart button optimistic-UI with no confirmed write / no rollback |
| BUG-090 | L133 | 2026-06-29 | Socket emit attempted on a `CLOSING` socket |
| BUG-048, BUG-042 | L232 | 2026-06-19 | Cross-team player shows blank name on logger confirm screen even after BUG-042 fix |
| BUG-046, BUG-026 | L238 | 2026-06-19 | `/matches/[id]` black screen with spinner indefinitely, non-incognito admin session |
| BUG-096 | L240 | 2026-07-06 | Platform's own logo 404s for OG/SEO meta images site-wide |
| BUG-033 | L244 | 2026-06-17 | Squad tab player pool doesn't filter by sport (part 2 open) |
| BUG-026 | L248 | (session 19) | SW stale JS chunk after deploy — verification step never completed (see table above) |
| BACKLOG-115 | L314 | 2026-06-29 | Missing `.limit()` on `userFavorites` query in notification audience build |
| BACKLOG-116 | L324 | 2026-06-29 | Notification audience preference inconsistency |
| BACKLOG-103 | L418 | none | User-selectable push notification preferences — explicitly "do not implement until..." (has a real gating condition, likely fine, but no revisit date) |
| BACKLOG-117 | L419 | none | SSO across roles (admin/logger/viewer are separate identity pools) |
| BACKLOG-110 | L424 | 2026-06-27 | Event timestamps show regulation ceiling instead of real stoppage minute |
| BACKLOG-041 | L465 | 2026-06-13 | Nickname search integration in logger platform |
| BACKLOG-040 | L482 | 2026-06-13 | Schema drift: `organizations_slug_unique` |
| BACKLOG-037 | L500 | 2026-06-13 | Roster Builder |
| BACKLOG-038 | L571 | 2026-06-13 | Bulk Register dedup refinement |
| BACKLOG-039 | L593 | 2026-06-13 | Match Import CSV nickname-aware reconciliation |
| BACKLOG-035 | L610 | 2026-06-13 | Sentry configuration cleanup |
| BACKLOG-001 | L636 | 2026-06-04 | Goal type breakdown in `playerStats` |
| BACKLOG-003 | L701 | 2026-06-04 | Competition start/end date fields |
| BACKLOG-002 | L762 | 2026-06-04 | Competition archive & delete |
| BACKLOG-004 | L808 | 2026-06-04 | Multi-sport competition display & structure |
| BACKLOG-019 | L916 | 2026-06-07 | Post-match lifecycle audit + automation |
| BACKLOG-061 | L1369 | 2026-06-16 | Competition detail page tab audit (see verified table above) |
| BUG-030, BUG-031 | L1400 | none | `/competitions/[id]` 404; TeamLogo broken (see verified table above — likely resolved) |
| BACKLOG-015 | L1519 | 2026-06-07 | Organizations detail/drill-down page |
| BACKLOG-005 | L1565 | 2026-06-04 | Next Phase Roadmap (large planning doc, likely superseded by actual roadmap docs since) |
| BACKLOG-006 | L1687 | 2026-06-05 | Bulk Register: select existing players |
| BACKLOG-009 | L1738 | 2026-06-05 | Remove vestigial `next-auth` package (see verified table above — NOT stale, re-confirmed recently) |
| BACKLOG-010 | L1754 / L2375 | none | Audit and remove unused email providers (appears twice, possible duplicate filing) |
| BACKLOG-012 | L1787 | 2026-06-05 | Pin all production dependencies to exact versions |
| BACKLOG-013 | L1803 | 2026-06-05 | Audit Stripe installation (see verified table above — still valid) |
| BACKLOG-020 | L1819 | 2026-06-08 | Phase 6: Architecture, Audit & Backscoping (large planning item) |
| BACKLOG-021 | L2178 | 2026-06-08 | GitHub Rulesets (branch protection) |
| BACKLOG-022 | L2213 | 2026-06-08 | Hotfix auto-sync (main → dev) |
| BACKLOG-023 | L2247 | 2026-06-08 | CONTRIBUTING.md branch workflow docs |
| BACKLOG-024 | L2279 | 2026-06-08 | DNS CNAME: staging.brixsports.com |
| BACKLOG-025 | L2306 | 2026-06-08 | Google OAuth staging config (likely overlaps/superseded by BACKLOG-362's OAuth work — worth checking together with BUG-148) |
| BACKLOG-026 | L2348 | 2026-06-08 | Broken AWS SES config (non-functional email) |
| BACKLOG-027 | L2391 | 2026-06-08 | Railway staging WebSocket service not created (likely superseded — BUG-074's entries describe a real Railway WS setup existing since) |
| BACKLOG-030 | L2537 | 2026-06-08 | Clean up deprecated `mock-data.ts` imports (see verified table above — still valid) |
| BACKLOG-031 | L2574 | 2026-06-08 | Dead/heavyweight package audit |
| BACKLOG-033-B | L2666 | 2026-06-08 | Game event handler for key match events |
| BACKLOG-042 | L2755 | 2026-06-13 | Duplicate player merge tool |
| BACKLOG-043 | L2788 | 2026-06-13 | Temp/unregistered player flow |
| BACKLOG-045 | L2840 | 2026-06-15 | Teams list pagination |
| BACKLOG-047 | L2942 | 2026-06-15 | Roster add-existing eligibility filters |
| BACKLOG-048 | L2967 | 2026-06-15 | Friendly match support |
| BACKLOG-066 | L3006 | 2026-06-17 | College field change auto-manages college team affiliation |
| BACKLOG-049 | L3040 | 2026-06-15 | Seasonal affiliations + transfer window (likely superseded — season/transfer tracking has since shipped, `BACKLOG-126`) |
| BACKLOG-050 | L3054 | 2026-06-15 | Team type field |
| BACKLOG-051 | L3068 | 2026-06-15 | Nigerian football format research |
| BACKLOG-052 | L3082 | 2026-06-15 | Team uniqueness + duplicate audit |
| BACKLOG-054 | L3131 | 2026-06-15 | Match-level position override (formation roster) |
| BACKLOG-055 | L3169 | 2026-06-15 | Player profile position as canonical truth |
| BACKLOG-056 | L3200 | 2026-06-15 | Role-scoped player edit permissions |
| BACKLOG-057 | L3218 / L3312 | 2026-06-16 / 2026-06-17 | Rename Pool/Squad tab labels (filed twice, second is an "updated scope" — possible duplicate) |
| BACKLOG-067 | L3340 | 2026-06-17 | Competition display name per squad entry |
| BACKLOG-071 | L3489 | 2026-06-17 | Player create form: no client-side error feedback |
| BACKLOG-072 | L3508 | 2026-06-17 | Make `players.number` nullable |
| BACKLOG-073 | L3539 | 2026-06-17 | Dependabot security audit + fixes |
| BACKLOG-074 | L3674 | 2026-06-17 | BUSA League full audit (likely largely superseded by extensive later backfill work) |
| BACKLOG-075 | L3754 | 2026-06-17 | Remove `players.sport` free-text field |
| BUG-036 | L3864 | 2026-06-17 | `POST/PATCH /api/polls` no auth gate (check against `BACKLOG-155`'s later feature-flag gating work — polls may be fully backscoped now) |
| BUG-037 | L3885 | 2026-06-17 | `POST /api/user/xi` no auth gate |
| BUG-038 | L3904 | 2026-06-17 | `DELETE/POST /api/reminders` no auth gate (check against the reminder-system rework in the archive, session 50) |
| BACKLOG-077 | L3943 | 2026-06-17 | No "Create Team" UI on `/admin/teams` |
| BUG-040 | L3973 | 2026-06-17 | `/placeholder.png` 400s via Next.js Image Optimizer |
| BACKLOG-081 | L4008 | 2026-06-17 | Umami analytics |
| BACKLOG-082 | L4018 | 2026-06-17 | Uptime monitoring |
| BACKLOG-083 | L4028 | 2026-06-17 | JSON-LD structured data (check against later AEO/SEO work, `aeo.ts` referenced elsewhere in the file) |
| BACKLOG-084 | L4038 | 2026-06-17 | robots.txt + sitemap |
| BACKLOG-085 | L4048 | 2026-06-17 | Core Web Vitals audit |
| BACKLOG-086 | L4060 | 2026-06-17 | NDPA registration |
| BACKLOG-087 | L4070 | 2026-06-17 | Rate limiting: all mutation endpoints (check against `BACKLOG-080`, which shipped auth-endpoint rate limiting later) |
| BACKLOG-088 | L4080 | 2026-06-17 | Database backup strategy |
| BACKLOG-089 | L4090 | 2026-06-17 | Sentry alerts configuration |
| BACKLOG-090 | L4100 | 2026-06-17 | CSR/RSC architecture decision for public pages |
| BACKLOG-091 | L4114 | 2026-06-17 | Accessibility batch fix |
| BACKLOG-092 | L4126 | 2026-06-17 | Lighthouse performance baseline tracking |
| BACKLOG-095 | L4278 | 2026-06-19 | Data freshness strategy: per-zone caching |
| BACKLOG-098 | L4310 | 2026-06-19 | Formalise BACKLOG lifecycle states (ironic given this very audit) |
| BACKLOG-099 | L4346 | 2026-06-19 | Flow A/B/C integration test suite |
| BACKLOG-100 | L4396 | 2026-06-19 | RUNLOG structure upgrade |
| BACKLOG-101 | L4451 | 2026-06-19 | Explicit dependency tracking in BACKLOG entries |
| BACKLOG-102 | L4492 | 2026-06-25 | Live match clock on public pages (check against `LIVE_CLOCK_V2_ARCHITECTURE.md`, referenced elsewhere as already built) |
| BACKLOG-104 | L4570 | 2026-06-25 | Exclude friendly matches from stat aggregation queries |
| BACKLOG-112 | L4757 | 2026-06-30 | Overturned/disallowed decisions |
| BUG-132 | L4944 | none | `value: 0` collapses to `null` on write (basketball) |
| BACKLOG-135 | L4972 | none | Dead `BASKETBALL_EVENT`/`MULTI_LOGGER_EVENT` CustomEvent dispatches |
| BACKLOG-137 | L5040 | none | Basketball quarter duration fetched, never enforced |
| BACKLOG-138 | L5049 | none | No halftime state for basketball |
| BACKLOG-152 | L5336 | none (session 47) | Track & Field logger has zero persistence layer |
| BUG-152 | L5368 | none (session 47) | Match-detail page favourite heart doesn't persist (third divergent implementation) |
| BACKLOG-156 | L5410 | none (session 47) | Admin dashboards show placeholder/fabricated data unlabeled |
| BACKLOG-162 | L5529 | none (session 47) | Auth/account minor cleanup: dead favourites page, duplicate `useAuth` hooks |
| BACKLOG-170 | L5597 | none (session 47) | Internal error messages returned to client in 4 routes |
| BACKLOG-171 | L5610 | none (session 47) | Public matches list embeds full event history for all 50 matches every response |
| BACKLOG-172 | L5623 | none (session 47) | Three N+1 query patterns, one on the public livescore hot path |
| BACKLOG-173 | L5642 | none (session 47) | Zero cache-control headers or ISR anywhere |
| BACKLOG-174 | L5655 | none (session 47) | Block-list DTO shaping fragile — new sensitive column leaks by default |
| BACKLOG-176 | L5681 | none (session 47) | `cloudinary/sign` reads `process.env` directly instead of `env.ts` |
| BACKLOG-179 | L5694 | none (session 47) | `POST /api/teams` no validation against NOT NULL columns |
| BACKLOG-181 | L5720 | none (session 47) | Unbounded `players` table scan in eligible-players endpoint |

*(116 total flagged; table above lists all of them. Items noted "check against X" are ones
where later BACKLOG entries elsewhere in the file suggest the item may already be moot —
not independently code-verified this pass, flagged as a shortcut for whoever triages
next.)*

---

## Recommendation

Don't bulk-close any of these. The session-47 cluster (`BACKLOG-152` through `BACKLOG-181`)
came from a single dedicated security/perf audit and is almost certainly still fully
accurate — it's flagged here only because it predates the archive cutoff and uses
different phrasing than my reason-keyword list, not because it looks abandoned. The
June-dated items (sessions 1-19) are the ones most worth a real triage pass: several
(`BACKLOG-025`, `BACKLOG-027`, `BACKLOG-049`, `BACKLOG-074`, `BACKLOG-087`, `BACKLOG-102`,
`BACKLOG-083`) likely have been substantially or fully overtaken by later, more specific
entries and are candidates for closing as `SUPERSEDED` rather than staying open verbatim.
`BUG-148` (above) is the one item this audit is confident is simply wrong as currently
written and should be corrected regardless of what else Richard decides to triage.
