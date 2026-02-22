import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // 'LIVE', 'FINISHED', 'UPCOMING'
        const competitionId = searchParams.get('competitionId');
        const competition = searchParams.get('competition');

        // Build query with conditional filters
        const conditions = [eq(matches.sport, 'Football')];
        if (status) conditions.push(eq(matches.status, status));
        if (competitionId) {
            conditions.push(or(eq(matches.competitionId, competitionId), eq(matches.competition, competition || '')));
        } else if (competition) {
            conditions.push(eq(matches.competition, competition));
        }

        const whereConditions = and(...conditions);

        // Get all football matches
        const footballMatches = await db
            .select()
            .from(matches)
            .where(whereConditions)
            .all();

        // Fetch teams separately to avoid column issues
        const teamIds = new Set<string>();
        footballMatches.forEach(m => {
            teamIds.add(m.homeTeamId);
            teamIds.add(m.awayTeamId);
        });

        const allTeams = await db
            .select({
                id: teams.id,
                name: teams.name,
                shortName: teams.shortName,
                logo: teams.logo,
                university: teams.university,
                color: teams.color,
            })
            .from(teams)
            .all();

        const teamMap = new Map(allTeams.map(t => [t.id, t]));

        // Transform the results
        const transformedMatches = footballMatches.map((match) => ({
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
        console.error('Error fetching football matches:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch football matches' },
            { status: 500 }
        );
    }
}
