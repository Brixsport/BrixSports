import { NextResponse } from 'next/server';
import { db } from '@/db';
import { standings, teams } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const competition = searchParams.get('competition');

        const conditions = [eq(standings.sport, 'Football')];
        if (competition) {
            conditions.push(eq(standings.competition, competition));
        }

        const footballStandings = await db
            .select()
            .from(standings)
            .where(conditions.length > 1 ? require('drizzle-orm').and(...conditions) : conditions[0])
            .orderBy(desc(standings.points), desc(standings.goalDifference))
            .all();

        const transformedStandings = await Promise.all(
            footballStandings.map(async (standing) => {
                const team = await db
                    .select({
                        id: teams.id,
                        name: teams.name,
                        shortName: teams.shortName,
                        logo: teams.logo,
                        university: teams.university,
                        color: teams.color,
                    })
                    .from(teams)
                    .where(eq(teams.id, standing.teamId))
                    .get();

                return {
                    ...standing,
                    team,
                };
            })
        );

        return NextResponse.json({
            success: true,
            standings: transformedStandings,
            count: transformedStandings.length,
        });
    } catch (error) {
        console.error('Error fetching football standings:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch football standings' },
            { status: 500 }
        );
    }
}
