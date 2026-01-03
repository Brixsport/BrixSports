import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // 'LIVE', 'FINISHED', 'UPCOMING'

        // Build query with conditional filters
        const whereConditions = status
            ? and(eq(matches.sport, 'Basketball'), eq(matches.status, status))
            : eq(matches.sport, 'Basketball');

        // Get all basketball matches
        const basketballMatches = await db
            .select()
            .from(matches)
            .where(whereConditions)
            .all();

        // Fetch teams separately to avoid column issues
        const teamIds = new Set<string>();
        basketballMatches.forEach(m => {
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
