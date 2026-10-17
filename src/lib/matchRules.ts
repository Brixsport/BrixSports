// Pure match-format rules with zero DB/env dependencies -- safe to import from
// client components. Split out of matchConfig.ts (BACKLOG-310): matchConfig.ts
// imports `db` from '@/db' at module scope for getMatchConfig(), and '@/db'
// itself calls dotenv.config() and opens a real @libsql/client connection as a
// top-level side effect. A client component that only needed
// requiresDecisiveResult() was still pulling that entire chain into the
// browser bundle -- dotenv's TTY-detection then threw on the browser's
// process.stdout being undefined, hard-crashing the whole /logger route.
// Keep this file free of any import that reaches '@/db', directly or
// transitively.

// BACKLOG-281: knockout-round matches must produce a decisive result (a
// winner via extra time/penalties, never a level FINISHED score) regardless
// of the stored allowDraws setting -- Richard's explicit call (BACKLOG-267
// question 2) was to hardcode this check rather than extend
// competitionSportSettings with a phase concept. Uses the same clean enum
// round strings bracketService.ts (BACKLOG-280) writes onto matches it
// creates -- already in standingsService.ts's KNOCKOUT_ROUNDS exclusion list
// (BACKLOG-275) too. Deliberately excludes the historical free-text round
// variants ('Quarter Finals', 'Semifinals', etc.) -- those belong to
// already-completed competitions; this only ever runs against a match that
// hasn't finished yet.
export const DECISIVE_RESULT_ROUNDS = ['QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'];

export function requiresDecisiveResult(round: string | null | undefined): boolean {
    return !!round && DECISIVE_RESULT_ROUNDS.includes(round);
}
