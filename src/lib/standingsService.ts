import { db } from '@/db';
import { matches, standings, teams, competitionSportSettings, competitionTeamEntries } from '@/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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

interface TeamRecord {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
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
    ];
    if (competitionFilter !== 'all') {
        conditions.push(competitionFilter ? eq(matches.competitionId, competitionFilter) : isNull(matches.competitionId));
    }

    const teamMatches = await db
        .select({
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

    return {
        played,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        points: won * pointsForWin + drawn * pointsForDraw,
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
