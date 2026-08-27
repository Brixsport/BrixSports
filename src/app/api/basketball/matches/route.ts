import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

// Public DTO -- must never include CLAUDE.md's banned fields (loggerId,
// approvalStatus, managerNotes, approvedBy, approvedAt) or anything else not
// actually read by a real consumer. Field list verified against every known
// consumer of this route: src/app/page.tsx's transform map, src/app/basketball/page.tsx.
const PUBLIC_MATCH_FIELDS = {
    id: matches.id,
    sport: matches.sport,
    homeTeamId: matches.homeTeamId,
    awayTeamId: matches.awayTeamId,
    homeScore: matches.homeScore,
    awayScore: matches.awayScore,
    shootoutHomeScore: matches.shootoutHomeScore,
    shootoutAwayScore: matches.shootoutAwayScore,
    status: matches.status,
    currentPeriod: matches.currentPeriod,
    startTime: matches.startTime,
    venue: matches.venue,
    competition: matches.competition,
    competitionId: matches.competitionId,
    round: matches.round,
    stats: matches.stats,
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // 'LIVE', 'FINISHED', 'UPCOMING'
        const competitionId = searchParams.get('competitionId');
        const competition = searchParams.get('competition');

        // Build query with conditional filters
        const conditions = [eq(matches.sport, 'Basketball')];
        if (status) conditions.push(eq(matches.status, status));
        if (competitionId) {
            conditions.push(or(eq(matches.competitionId, competitionId), eq(matches.competition, competition || ''))!);
        } else if (competition) {
            conditions.push(eq(matches.competition, competition));
        }

        const whereConditions = and(...conditions);

        // Get all basketball matches
        const basketballMatches = await db
            .select(PUBLIC_MATCH_FIELDS)
            .from(matches)
            .where(whereConditions)
            .limit(100)
            .all();

        // Fetch only the teams actually referenced, not the whole table.
        const teamIds = new Set<string>();
        basketballMatches.forEach(m => {
            teamIds.add(m.homeTeamId);
            teamIds.add(m.awayTeamId);
        });

        const allTeams = teamIds.size > 0
            ? await db
                .select({
                    id: teams.id,
                    name: teams.name,
                    shortName: teams.shortName,
                    logo: teams.logo,
                    university: teams.university,
                    color: teams.color,
                })
                .from(teams)
                .where(inArray(teams.id, Array.from(teamIds)))
                .all()
            : [];

        const teamMap = new Map(allTeams.map(t => [t.id, t]));

        // Transform the results
        const transformedMatches = basketballMatches.map((match) => ({
            ...match,
            homeTeam: teamMap.get(match.homeTeamId),
            awayTeam: teamMap.get(match.awayTeamId),
        }));

        return NextResponse.json({
            success: true,
            matches: transformedMatches,
            count: transformedMatches.length,
        });
    } catch (error) {
        console.error('Error fetching basketball matches:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch basketball matches' },
            { status: 500 }
        );
    }
}
