import { db } from '@/db';
import { matches, standings, teams, competitionSportSettings, competitionTeamEntries, matchEvents } from '@/db/schema';
import { eq, and, or, isNull, inArray, notInArray, asc, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Same normalization as rating-calculator.ts's normalizeType — match_events.type
// arrives inconsistently ('Yellow Card', 'YELLOW_CARD', 'yellow-card', ...).
// A naive strict-equality match (the pattern team-stats-calculator.ts uses)
// silently undercounts. Keep these two normalizers in sync if either changes.
function normalizeEventType(type: string): string {
    return type.toLowerCase().replace(/[\s_-]+/g, '');
}

// Points -> GD -> Goals For -> Yellow Cards (fewer better) -> Red Cards (fewer
// better) -> teamId (total order). Single source of truth for every DB-level
// standings query. Mirror any change here in standingsSort.ts's compareStandings
// (the client-safe, DB-import-free JS equivalent used by useLiveStandings.ts).
export const STANDINGS_ORDER_BY = [
    desc(standings.points),
    desc(standings.goalDifference),
    desc(standings.goalsFor),
    asc(standings.yellowCards),
    asc(standings.redCards),
    asc(standings.teamId),
];

// BACKLOG-097: standings were never recalculated anywhere in the codebase — the
// `standings` table's only writer was a manual admin bulk-upsert, and `teams`'
// own played/won/drawn/lost/goalsFor/goalsAgainst columns were a frozen seed-time
// snapshot nothing ever updated. Called from the match FINISHED transition
// (src/app/api/matches/[id]/route.ts PATCH) to keep both in sync from one trigger,
// per that entry's own audit conclusion — recomputed fully from FINISHED matches
// each time (not incremental), so it's safe to call more than once for the same
// match with no double-counting.

const DEFAULT_POINTS_FOR_WIN = 3;
const DEFAULT_POINTS_FOR_DRAW = 1;

// BACKLOG-275: knockout-stage results must not count toward league/group
// standings. `matches.round` is free text with no enum constraint — these are
// the exact strings confirmed live via `SELECT DISTINCT round` (dev/query-distinct-rounds.mjs,
// 2026-08-27) across BUSA LEAGUE FOOTBALL / BUSALYMPICS (FOOTBALL) / NPUGA
// (BASKETBALL) / NPUGA (FOOTBALL), plus the clean enum values planned for the
// 2026/2027 Swiss-format competition's own knockout stage (BACKLOG-267/280) —
// not yet in the DB, included so this list doesn't need a second fix once that
// competition starts finishing knockout matches. Every current league/group
// value (`"Group A"`, `"Round 1"`, `"Match Day 1"`, `"Group Stage"`, `"Group Day 1"`,
// `""`) is deliberately absent from this list — only add a string here if it
// names a knockout round.
const KNOCKOUT_ROUNDS = [
    // Historical free-text variants, confirmed live 2026-08-27
    '3rd Place',
    '3rd Place Playoff',
    'Final',
    'Quarter Finals',
    'Quarter-Final',
    'Semifinals',
    'Semi-Final',
    // Clean enum variants planned for future competitions (BACKLOG-267/280)
    'FINAL',
    'THIRD_PLACE',
    'SEMI_FINAL',
    'QUARTER_FINAL',
    'ROUND_16',
    'ROUND_32',
];

interface TeamRecord {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    yellowCards: number;
    redCards: number;
}

async function getPointsRule(competitionId: string | null, sport: string) {
    if (!competitionId) {
        return { pointsForWin: DEFAULT_POINTS_FOR_WIN, pointsForDraw: DEFAULT_POINTS_FOR_DRAW };
    }
    const settings = await db
        .select({ pointsForWin: competitionSportSettings.pointsForWin, pointsForDraw: competitionSportSettings.pointsForDraw })
        .from(competitionSportSettings)
        .where(and(eq(competitionSportSettings.competitionId, competitionId), eq(competitionSportSettings.sport, sport)))
        .get();
    return {
        pointsForWin: settings?.pointsForWin ?? DEFAULT_POINTS_FOR_WIN,
        pointsForDraw: settings?.pointsForDraw ?? DEFAULT_POINTS_FOR_DRAW,
    };
}

// `competitionFilter` disambiguates two different meanings a null-ish value could
// have: 'all' (no competition filter — used for the teams-table overall sync, which
// must span every competition a team has played in) vs a specific competitionId
// (used for the standings-table sync, competition-scoped, where a genuinely-null
// competitionId on the match itself is matched with isNull, not skipped).
async function aggregateTeamRecord(
    teamId: string,
    sport: string,
    competitionFilter: string | null | 'all',
    pointsForWin: number,
    pointsForDraw: number
): Promise<TeamRecord> {
    const conditions = [
        eq(matches.status, 'FINISHED'),
        eq(matches.sport, sport),
        or(eq(matches.homeTeamId, teamId), eq(matches.awayTeamId, teamId)),
        // BACKLOG-275: exclude knockout-round matches from league/group aggregation.
        // `round` is nullable — notInArray() alone evaluates to SQL NULL (not TRUE)
        // for a null-round row, which would silently drop every league/group match
        // too. Must explicitly re-include null rounds via isNull().
        or(isNull(matches.round), notInArray(matches.round, KNOCKOUT_ROUNDS)),
    ];
    if (competitionFilter !== 'all') {
        conditions.push(competitionFilter ? eq(matches.competitionId, competitionFilter) : isNull(matches.competitionId));
    }

    const teamMatches = await db
        .select({
            id: matches.id,
            homeTeamId: matches.homeTeamId,
            awayTeamId: matches.awayTeamId,
            homeScore: matches.homeScore,
            awayScore: matches.awayScore,
        })
        .from(matches)
        .where(and(...conditions));

    let played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;
    for (const m of teamMatches) {
        const isHome = m.homeTeamId === teamId;
        const gf = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
        const ga = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
        played++;
        goalsFor += gf;
        goalsAgainst += ga;
        if (gf > ga) won++;
        else if (gf === ga) drawn++;
        else lost++;
    }

    let yellowCards = 0, redCards = 0;
    if (teamMatches.length > 0) {
        const events = await db
            .select({ type: matchEvents.type })
            .from(matchEvents)
            .where(and(
                inArray(matchEvents.matchId, teamMatches.map(m => m.id)),
                eq(matchEvents.teamId, teamId)
            ));
        for (const e of events) {
            const normalized = normalizeEventType(e.type);
            if (normalized === 'yellowcard') yellowCards++;
            else if (normalized === 'redcard') redCards++;
        }
    }

    return {
        played,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        points: won * pointsForWin + drawn * pointsForDraw,
        yellowCards,
        redCards,
    };
}

async function syncCompetitionStandings(teamId: string, sport: string, competition: string, competitionId: string, record: TeamRecord) {
    const groupEntry = await db
        .select({ groupName: competitionTeamEntries.groupName })
        .from(competitionTeamEntries)
        .where(and(eq(competitionTeamEntries.competitionId, competitionId), eq(competitionTeamEntries.teamId, teamId)))
        .get();
    const groupName = groupEntry?.groupName ?? null;

    const existing = await db
        .select({ id: standings.id })
        .from(standings)
        .where(and(eq(standings.teamId, teamId), eq(standings.competitionId, competitionId)))
        .get();

    if (existing) {
        await db.update(standings).set({ ...record, groupName, updatedAt: new Date() }).where(eq(standings.id, existing.id));
    } else {
        await db.insert(standings).values({
            id: `std_${nanoid()}`,
            teamId,
            sport,
            competition,
            competitionId,
            ...record,
            groupName,
            updatedAt: new Date(),
        });
    }
}

async function syncTeamOverallRecord(teamId: string, sport: string) {
    // `teams` has no competitionId column — it's one team-level snapshot across every
    // competition that team has played in, not a per-competition table like `standings`.
    // played/won/drawn/lost/goalsFor/goalsAgainst are point-system-independent, so
    // aggregating them across all of a team's FINISHED matches (any competition) is
    // unambiguous. `points` is NOT well-defined across competitions with different
    // pointsForWin/pointsForDraw rules — deliberately uses the standard 3/1/0 default
    // here regardless of each match's real competition rule, as a rough team-level
    // snapshot only. `standings.points` (synced above) is the authoritative,
    // correctly-per-competition-scoped number; this column is not.
    const record = await aggregateTeamRecord(teamId, sport, 'all', DEFAULT_POINTS_FOR_WIN, DEFAULT_POINTS_FOR_DRAW);
    await db.update(teams).set({
        played: record.played,
        won: record.won,
        drawn: record.drawn,
        lost: record.lost,
        goalsFor: record.goalsFor,
        goalsAgainst: record.goalsAgainst,
        points: record.points,
    }).where(eq(teams.id, teamId));
}

export async function recalculateStandingsForMatch(matchId: string) {
    const match = await db.select().from(matches).where(eq(matches.id, matchId)).get();
    if (!match || match.status !== 'FINISHED') return;

    const { pointsForWin, pointsForDraw } = await getPointsRule(match.competitionId, match.sport);

    for (const teamId of [match.homeTeamId, match.awayTeamId]) {
        if (match.competitionId) {
            const record = await aggregateTeamRecord(teamId, match.sport, match.competitionId, pointsForWin, pointsForDraw);
            await syncCompetitionStandings(teamId, match.sport, match.competition, match.competitionId, record);
        }
        await syncTeamOverallRecord(teamId, match.sport);
    }
}
