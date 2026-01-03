import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, matchEvents, teams } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sport = searchParams.get('sport');
        const loggerId = searchParams.get('loggerId');
        const status = searchParams.get('status');

        let query = db.select().from(matches);

        const conditions = [];

        if (sport) conditions.push(eq(matches.sport, sport));
        if (loggerId) conditions.push(eq(matches.loggerId, loggerId));
        if (status) conditions.push(eq(matches.status, status));

        if (conditions.length > 0) {
            query = query.where(and(...conditions)) as typeof query;
        }

        const allMatches = await query;

        // Collect all unique team IDs
        const teamIds = new Set<string>();
        allMatches.forEach(match => {
            teamIds.add(match.homeTeamId);
            teamIds.add(match.awayTeamId);
        });

        // Fetch all related teams
        let teamsList: any[] = [];
        if (teamIds.size > 0) {
            teamsList = await db.select().from(teams).where(inArray(teams.id, Array.from(teamIds)));
        }

        // Create a map for quick access
        const teamsMap = new Map(teamsList.map(t => [t.id, t]));

        // Fetch events for each match (optional, keeping existing logic)
        // But optimizing to just attach teams first
        const matchesWithDetails = await Promise.all(
            allMatches.map(async (match) => {
                const events = await db.select().from(matchEvents).where(eq(matchEvents.matchId, match.id));
                const homeTeam = teamsMap.get(match.homeTeamId);
                const awayTeam = teamsMap.get(match.awayTeamId);

                return {
                    ...match,
                    events,
                    stats: match.stats ? JSON.parse(match.stats) : {},
                    lineups: match.lineups ? JSON.parse(match.lineups) : null,
                    homeTeam: homeTeam ? {
                        name: homeTeam.name,
                        shortName: homeTeam.shortName,
                        logo: homeTeam.logo
                    } : null,
                    awayTeam: awayTeam ? {
                        name: awayTeam.name,
                        shortName: awayTeam.shortName,
                        logo: awayTeam.logo
                    } : null
                };
            })
        );

        return NextResponse.json(matchesWithDetails);
    } catch (error) {
        console.error('Error fetching matches:', error);
        return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { stats, lineups, ...matchData } = body;

        const newMatch = await db.insert(matches).values({
            ...matchData,
            stats: stats ? JSON.stringify(stats) : null,
            lineups: lineups ? JSON.stringify(lineups) : null,
        }).returning();

        return NextResponse.json(newMatch[0], { status: 201 });
    } catch (error) {
        console.error('Error creating match:', error);
        return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
    }
}
