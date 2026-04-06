import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { squadPlayers, competitions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// GET /api/squads/check?teamId=xxx&competitionId=xxx - Check squad status
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const competitionId = searchParams.get('competitionId');

        if (!teamId || !competitionId) {
            return NextResponse.json(
                { error: 'teamId and competitionId are required' },
                { status: 400 }
            );
        }

        // Get competition details
        const competition = await db
            .select({
                id: competitions.id,
                name: competitions.name,
                requireSquad: competitions.requireSquad,
                maxSquadSize: competitions.maxSquadSize,
            })
            .from(competitions)
            .where(eq(competitions.id, competitionId))
            .all();

        if (competition.length === 0) {
            return NextResponse.json(
                { error: 'Competition not found' },
                { status: 404 }
            );
        }

        const comp = competition[0];

        // If competition doesn't require squad, return early
        if (!comp.requireSquad) {
            return NextResponse.json({
                success: true,
                requiresSquad: false,
                message: 'Squad not required for this competition',
            });
        }

        // Get squad count
        const squadCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(squadPlayers)
            .where(
                and(
                    eq(squadPlayers.teamId, teamId),
                    eq(squadPlayers.competitionId, competitionId),
                    eq(squadPlayers.status, 'active')
                )
            )
            .all();

        const count = squadCount[0]?.count || 0;
        const maxSize = comp.maxSquadSize || 25;

        return NextResponse.json({
            success: true,
            requiresSquad: true,
            competition: comp,
            squadStatus: {
                current: count,
                max: maxSize,
                remaining: maxSize - count,
                isComplete: count >= maxSize,
                isValid: count > 0 && count <= maxSize,
            },
        });
    } catch (error) {
        console.error('[SquadCheck] Error:', error);
        return NextResponse.json(
            { error: 'Failed to check squad status' },
            { status: 500 }
        );
    }
}
