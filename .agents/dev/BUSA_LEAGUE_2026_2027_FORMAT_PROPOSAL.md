# BUSA League 2026/2027 — Format Proposal (transcribed from Richard's PDF, session 58)

Source: `C:\Users\Wise\Downloads\Document.pdf`, transcribed in full session 58 (2026-08-27) so
the next-season format work isn't dependent on that file staying put. Nothing built yet — this
is the requirements doc for a competition-format model that doesn't exist in the schema today.

## Football — Male (BUSA League)
- **20 teams**, registration fee ₦90,000/team.
- **Swiss-style league phase** — explicitly "similar to the UEFA Champions League format."
  Each team plays **4 matches against 4 different opponents** (not all 19 — this is real Swiss
  pairing, not a small round-robin subset picked once).
- Single league table, ranked by: Points → Goal Difference → Goals Scored → Yellow Card(s) →
  Red Card(s) (fewer cards presumably ranks better as a tiebreak — not stated explicitly which
  direction, confirm with Richard before building the sort).
- Top 8 → Quarter-Finals → Semi-Finals → 3rd Place Match → Final.

## Football — Female (5-a-side)
- Round-robin, single (not double).
- Standard points/GD/goals/head-to-head tiebreakers.
- Top-ranked teams advance to a "final stage" — exact cutoff (top 2? top 4?) not specified in
  the source doc.
- Registration fee: not yet decided.

## Basketball — Male (BUSA League)
- **6 teams**, registration fee ₦50,000/team.
- Single round-robin (each team plays every other once).
- Top 4 → Semi-Finals → Final. **No 3rd place match mentioned** (unlike football).

## Basketball — Female (BUSA League)
- **3 teams.**
- **Triple round-robin** — each team plays every other team 3 times (3 full rounds).
- Straight league-table winner, no knockout stage at all.
- Tie-breakers: head-to-head, point difference, points scored.
- Registration fee: TBD.

## Volleyball — Male & Female
- Number of teams: TBD.
- Format: TBD, "to be determined based on the final number of participating teams."
- Registration fee: TBD.

## Why this needs real engineering work, not a config tweak
Every format this project currently models (`competitions.format`: `league`, `league-knockout`,
`group-knockout`) is **upfront-fixture** — all matches for a round are known and can be
generated/entered at once (round-robin schedule, or a fixed bracket). **True Swiss pairing is
not upfront** — after every round, the next round's pairings depend on the live standings at
that moment (typically: pair teams with similar records, avoid rematches, sometimes avoid
same-affiliation pairings). This is a genuinely different competition *mechanism*, not just a
new enum value:
- Needs a pairing algorithm (Swiss pairing — Buchholz/median-based systems are the common
  real-world implementations; even a simplified "pair by current standing, skip repeat
  opponents" version is real logic, not data entry).
- Needs the admin flow to generate one round's fixtures at a time (not all 4 rounds upfront),
  since round N+1's pairing depends on round N's completed results.
- Needs the existing standings/tiebreaker pipeline (`recalculateStandingsForMatch`,
  `src/lib/standingsService.ts`) extended to sort by the new tiebreaker chain (GD → Goals →
  Yellow → Red), which it does not do today (currently just Points → implicit insertion order,
  confirm exact current sort before changing it).
- The triple round-robin (Basketball Female) is a smaller lift — likely just a schedule
  generator that repeats the round-robin pairing 3 times, reusing existing round-robin
  standings logic as-is. Lower risk, could be tackled first as a warm-up before Swiss.

## Not decided yet, needs Richard's input before design starts
- Card-count tiebreaker direction (fewer cards ranks higher, presumably — confirm).
- Female football's exact "final stage" qualifying cutoff and format.
- Volleyball's whole format, once team count is known.
- Whether Swiss pairing needs to avoid same-college/same-affiliation rematches (relevant given
  this project's existing multi-college structure) — not mentioned in the source doc, worth
  asking since it came up implicitly in past intercollege work this session.

## Next session — suggested entry point
Start with a real design pass (the `architect` agent, or a dedicated planning session) on the
Swiss-pairing mechanism specifically — that's the one piece with no existing analog anywhere
in this codebase. The triple-round-robin and plain round-robin+knockout pieces are much closer
to patterns that already exist (BUSA League Basketball Male's existing format is already
single round-robin + top-4 knockout, reusable almost as-is).
