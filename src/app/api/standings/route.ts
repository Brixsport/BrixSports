import { NextResponse } from 'next/server';
import { db } from '@/db';
import { standings } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sport = searchParams.get('sport');
        const competition = searchParams.get('competition');
        const competitionId = searchParams.get('competitionId');

        const whereConditions = [];
        if (sport) whereConditions.push(eq(standings.sport, sport));

        const { or } = await import('drizzle-orm');

        if (competitionId) {
            whereConditions.push(or(eq(standings.competitionId, competitionId), eq(standings.competition, competition || '')));
        } else if (competition) {
            whereConditions.push(eq(standings.competition, competition));
        }

        const allStandings = await db.query.standings.findMany({
            where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
            with: {
                team: true
            },
            orderBy: [desc(standings.points), desc(standings.goalDifference)]
        });

        return NextResponse.json(allStandings);
    } catch (error) {
        console.error('Error fetching standings:', error);
        return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { entries } = body;

        if (!Array.isArray(entries) || entries.length === 0) {
            return NextResponse.json({ error: 'Invalid request: Expected an array of entries' }, { status: 400 });
        }

        const newEntries = entries.map(entry => ({
            id: entry.id || `std-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            teamId: entry.teamId,
            sport: entry.sport,
            competition: entry.competition,
            competitionId: entry.competitionId || null,
            played: entry.played || 0,
            won: entry.won || 0,
            drawn: entry.drawn || 0,
            lost: entry.lost || 0,
            goalsFor: entry.goalsFor || 0,
            goalsAgainst: entry.goalsAgainst || 0,
            goalDifference: (entry.goalsFor || 0) - (entry.goalsAgainst || 0),
            points: entry.points || 0,
            updatedAt: new Date(),
        }));

        // Use a transaction for bulk insert/replace
        const result = await db.insert(standings).values(newEntries).onConflictDoUpdate({
            target: standings.id,
            set: {
                played: sql`excluded.played`,
                won: sql`excluded.won`,
                drawn: sql`excluded.drawn`,
                lost: sql`excluded.lost`,
                goalsFor: sql`excluded.goals_for`,
                goalsAgainst: sql`excluded.goals_against`,
                goalDifference: sql`excluded.goal_difference`,
                points: sql`excluded.points`,
                updatedAt: new Date(),
            }
        }).returning();

        return NextResponse.json({
            success: true,
            totalProcessed: result.length,
            entries: result
        });
    } catch (error) {
        console.error('Error in bulk standings operation:', error);
        return NextResponse.json({ error: 'Failed to process standings' }, { status: 500 });
    }
}
