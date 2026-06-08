/**
 * Bulk Match Creation API
 * POST /api/matches/bulk
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { matches: matchesToCreate } = body;

        if (!Array.isArray(matchesToCreate) || matchesToCreate.length === 0) {
            return NextResponse.json(
                { error: 'Invalid request: Expected an array of matches' },
                { status: 400 }
            );
        }

        const newMatches = matchesToCreate.map(match => ({
            id: nanoid(),
            sport: match.sport || 'Football',
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            homeScore: match.homeScore || 0,
            awayScore: match.awayScore || 0,
            status: match.status || 'UPCOMING',
            startTime: match.startTime || new Date().toISOString(),
            venue: match.venue || 'TBA',
            competition: match.competition || 'Friendlies',
            matchType: match.matchType || 'competition',
            competitionLevel: match.competitionLevel || 'busa-league',
            stats: match.stats ? JSON.stringify(match.stats) : null,
            lineups: match.lineups ? JSON.stringify(match.lineups) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }));

        // Batch insert
        const inserted = await db.insert(matches).values(newMatches).returning();

        return NextResponse.json({
            success: true,
            totalInserted: inserted.length,
            matches: inserted
        }, { status: 201 });

    } catch (error) {
        console.error('Error in bulk match creation:', error);
        return NextResponse.json(
            { error: 'Failed to create matches in bulk' },
            { status: 500 }
        );
    }
}
