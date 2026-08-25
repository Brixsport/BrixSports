import { NextResponse } from 'next/server';
import { db } from '@/db';
import { standings, teams } from '@/db/schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const competition = searchParams.get('competition');
        const competitionId = searchParams.get('competitionId');

        const conditions = [eq(standings.sport, 'Football')];
        if (competitionId || competition) {
            // We match using competitionId when available, otherwise by competition name.
            // IMPORTANT: Seeded data isn't always consistent (case differences, and some competitions store group standings like
            // "BUSA League Football - Group A"), so we do case-insensitive matching and a prefix match fallback.
            const name = competition || '';
            const nameLower = name.toLowerCase();

            const matchByName = name
                ? or(
                    // exact (case-insensitive)
                    sql`lower(${standings.competition}) = ${nameLower}`,
                    // prefix (case-insensitive) e.g. "BUSA League Football - Group A"
                    sql`lower(${standings.competition}) like ${nameLower + '%'}`
                )
                : undefined;

            if (competitionId && matchByName) {
                conditions.push(or(eq(standings.competitionId, competitionId), matchByName)!);
            } else if (competitionId) {
                conditions.push(eq(standings.competitionId, competitionId));
            } else if (matchByName) {
                conditions.push(matchByName);
            }
        }

        const footballStandings = await db
            .select()
            .from(standings)
            .where(conditions.length > 1 ? and(...conditions) : conditions[0])
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
