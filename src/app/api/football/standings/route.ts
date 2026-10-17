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

        const conditions = [eq(standings.sport, 'Football')];
        if (competitionId) {
            // competitionId is authoritative when present -- do NOT OR it with a
            // name fallback. Two different competitions can legitimately share
            // an exact or prefix-matching name (e.g. two seasons both literally
            // named "BUSA LEAGUE FOOTBALL", or one season's group-standings rows
            // stored as "BUSA League Football - Group A"), and the name-fallback
            // used to be OR'd in even when a real id was already known, silently
            // merging both competitions' standings into one response the moment
            // that name collision existed (confirmed live, session 2026-09-05,
            // once BACKLOG-291's grouping fix made two same-named seasons
            // reachable side by side for the first time).
            conditions.push(eq(standings.competitionId, competitionId));
        } else if (competition) {
            // No id available -- fall back to name matching for legacy/name-only
            // callers. IMPORTANT: seeded data isn't always consistent (case
            // differences, and some competitions store group standings like
            // "BUSA League Football - Group A"), so this stays case-insensitive
            // with a prefix fallback -- but only ever as a last resort, never
            // alongside a real competitionId.
            const nameLower = competition.toLowerCase();
            conditions.push(or(
                sql`lower(${standings.competition}) = ${nameLower}`,
                sql`lower(${standings.competition}) like ${nameLower + '%'}`
            )!);
        }

        const footballStandings = await db
            .select()
            .from(standings)
            .where(conditions.length > 1 ? and(...conditions) : conditions[0])
            .orderBy(...STANDINGS_ORDER_BY)
            .limit(500)
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
