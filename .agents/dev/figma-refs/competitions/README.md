# Competitions Figma Reference Set

Pulled from OGO BRIXSPORTS Figma file `pFyvF0aBQff7wwTJorYiqs`, section `2164:992`, session 2026-09-02, for the BACKLOG-284→293 competitions consolidation. Use these as the visual-QA baseline when comparing built pages against design — re-pull if the Figma file changes.

| File | Node ID | Figma layer name | Notes |
|---|---|---|---|
| `2168-1495_directory-standings.png` | `2168:1495` | Competition Standings | **Confirmed = the BACKLOG-284/289 directory screen.** ALL/FOOTBALL/BASKETBALL/OTHER sport tabs, flat competition list, star-favorite per row, one row expanded inline w/ nearest matches. |
| `2164-993_standings-a.png` | `2164:993` | Competition Standings | **Confirmed = the hub Standings tab** (BACKLOG-285 impl #1). FOOTBALL/BASKETBALL/TRACK segmented control + series pills (BUSA LEAGUE/NPUGA SPECIAL EDITION/INTERCOLLEGE) + STANDINGS/MATCHES/BRACKETS tabs. |
| `2203-2197_standings-b.png` | `2203:2197` | Competition Standings | Hub Standings tab variant — different competition/series pill selected. |
| `2204-3371_standings-c.png` | `2204:3371` | Competition Standings | Hub Standings tab variant. |
| `2455-661_standings-d.png` | `2455:661` | Competition Standings | Hub Standings tab variant. |
| `2204-3740_matches-a.png` | `2204:3740` | Competition Matches | Hub Matches tab variant. |
| `2204-4068_matches-b.png` | `2204:4068` | Competition Matches | Hub Matches tab variant. |
| `2203-2755_matches-c.png` | `2203:2755` | Competition matches | Hub Matches tab variant. |
| `2181-3437_matches-d.png` | `2181:3437` | Competition Matches | Hub Matches tab variant. |
| `2181-3776_matches-e.png` | `2181:3776` | Competition Matches | Hub Matches tab variant. |
| `2203-2457_stats-a.png` | `2203:2457` | Competition Stats | Hub Stats tab variant — see BACKLOG-293, one of these frames is the "blank frame" flagged as unfinished/no content. |
| `2455-1151_stats-b.png` | `2455:1151` | Competition Stats | Hub Stats tab variant. |
| `2470-824_stats-c.png` | `2470:824` | Competition Stats | Hub Stats tab variant. |
| `2203-3071_stats-d.png` | `2203:3071` | Competition Stats | Hub Stats tab variant. |

## Authoritative header/tab reference (session 2026-09-02, provided directly by Richard)

`richard-ref_standings-tab.jpeg` and `richard-ref_stats-tab.jpeg` — confirms the hub has **4 tabs** (STANDINGS/MATCHES/BRACKETS/STATS), not the 3 seen in the older pulled frames above. Also resolves the header-alignment question raised this session: the pulled frames above are genuinely inconsistent with each other (an unreconciled Figma iteration, not a deliberate per-tab design) — decision made was to build ONE persistent header (back-arrow + favorite-star utility row, logo/title/sport-emoji, season selector, status, "N teams registered" badge) shown identically across all 4 tabs rather than replicate either frame's specific layout. See `src/app/competitions/page.tsx`.

## Not yet pulled
Brackets tab (BACKLOG-292, gated on BACKLOG-280 landing first) — not captured this pass, pull when that phase starts.

## How to re-pull / get more
Figma MCP (`mcp__7b00ebda-...__get_screenshot`, fileKey `pFyvF0aBQff7wwTJorYiqs`) — screenshot URLs are short-lived, always re-fetch rather than reusing an old URL. Full section metadata (all node IDs under `2164:992`) was dumped via `get_metadata`; see BACKLOG.md / build journal for the session this was pulled in if the raw dump is needed again.
