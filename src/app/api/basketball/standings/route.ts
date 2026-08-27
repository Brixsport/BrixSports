import { NextResponse } from 'next/server';
import { db } from '@/db';
import { standings, teams } from '@/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { STANDINGS_ORDER_BY } from '@/lib/standingsService';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const competition = searchParams.get('competition');
        const competitionId = searchParams.get('competitionId');

        const conditions = [eq(standings.sport, 'Basketball')];
        if (competitionId || competition) {
            // Seeded data may have different casing (e.g. "BUSA League Basketball" vs "BUSA LEAGUE BASKETBALL"),
            // so we do case-insensitive matching on the competition name.
            const name = competition || '';
            const nameLower = name.toLowerCase();

            const matchByName = name
                ? sql`lower(${standings.competition}) = ${nameLower}`
                : undefined;

            if (competitionId && matchByName) {
                conditions.push(or(eq(standings.competitionId, competitionId), matchByName)!);
            } else if (competitionId) {
                conditions.push(eq(standings.competitionId, competitionId));
            } else if (matchByName) {
                conditions.push(matchByName);
            }
        }

        const basketballStandings = await db
            .select()
            .from(standings)
            .where(conditions.length > 1 ? and(...conditions) : conditions[0])
            .orderBy(...STANDINGS_ORDER_BY)
            .limit(500)
            .all();

        const transformedStandings = await Promise.all(
            basketballStandings.map(async (standing) => {
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
        console.error('Error fetching basketball standings:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch basketball standings' },
            { status: 500 }
        );
    }
}
