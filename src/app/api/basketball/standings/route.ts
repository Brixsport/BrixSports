import { NextResponse } from 'next/server';
import { db } from '@/db';
import { standings, teams } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { STANDINGS_ORDER_BY } from '@/lib/standingsService';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const competition = searchParams.get('competition');
        const competitionId = searchParams.get('competitionId');

        const conditions = [eq(standings.sport, 'Basketball')];
        if (competitionId) {
            // competitionId is authoritative when present -- do NOT OR it with a
            // name fallback. Two different competitions can legitimately share
            // an exact name (e.g. two seasons both literally named "BUSA LEAGUE
            // BASKETBALL"), and the name-fallback used to be OR'd in even when a
            // real id was already known, silently merging both competitions'
            // standings into one response the moment that name collision
            // existed (confirmed live on the football sibling route, session
            // 2026-09-05, once BACKLOG-291's grouping fix made two same-named
            // seasons reachable side by side for the first time).
            conditions.push(eq(standings.competitionId, competitionId));
        } else if (competition) {
            // No id available -- fall back to name matching for legacy/name-only
            // callers, only as a last resort, never alongside a real competitionId.
            // Seeded data may have different casing (e.g. "BUSA League Basketball"
            // vs "BUSA LEAGUE BASKETBALL"), so this stays case-insensitive.
            conditions.push(sql`lower(${standings.competition}) = ${competition.toLowerCase()}`);
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
