
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { or, notInArray, eq } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // Filter out Football and Basketball
        const sportsToExclude = ['Football', 'Basketball'];

        const otherMatches = await db.select().from(matches)
            .where(notInArray(matches.sport, sportsToExclude))
            .all();

        // Get team details
        const teamIds = new Set<string>();
        otherMatches.forEach(m => {
            teamIds.add(m.homeTeamId);
            teamIds.add(m.awayTeamId);
        });

        const allTeams = await db.select({
            id: teams.id,
            name: teams.name,
            shortName: teams.shortName,
            logo: teams.logo,
            university: teams.university,
            color: teams.color,
        }).from(teams).all(); // In production, filter by IDs if too many teams

        const teamMap = new Map(allTeams.map(t => [t.id, t]));

        const transformed = otherMatches.map(m => ({
            ...m,
            homeTeam: teamMap.get(m.homeTeamId),
            awayTeam: teamMap.get(m.awayTeamId)
        }));

        return NextResponse.json({
            success: true,
            matches: transformed,
            count: transformed.length
        });
    } catch (error) {
        console.error('Error fetching other matches:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch matches' }, { status: 500 });
    }
}
