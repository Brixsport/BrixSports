import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { playerRatings } from '@/db/schema-ratings';
import { matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

/**
 * POST /api/matches/[id]/ratings/initialize
 * Initialize ratings for all players when match starts
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getAuthUser(request);
        if (!user || (user.role !== 'admin' && user.role !== 'logger')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const matchId = params.id;

        // Get match details
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .limit(1);

        if (match.length === 0) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Only initialize for LIVE matches
        if (match[0].status !== 'LIVE') {
            return NextResponse.json(
                { error: 'Can only initialize ratings for live matches' },
                { status: 400 }
            );
        }

        // Get lineups
        const lineups = match[0].lineups ? JSON.parse(match[0].lineups) : null;

        if (!lineups) {
            return NextResponse.json(
                { error: 'No lineups found for this match' },
                { status: 400 }
            );
        }

        const allPlayers = [
            ...(lineups.home || []),
            ...(lineups.away || [])
        ];

        // Check if ratings already exist
        const existingRatings = await db
            .select()
            .from(playerRatings)
            .where(eq(playerRatings.matchId, matchId));

        if (existingRatings.length > 0) {
            return NextResponse.json({
                message: 'Ratings already initialized',
                count: existingRatings.length
            });
        }

        // Create initial ratings for all players
        const ratingsToCreate = allPlayers.map(entry => ({
            id: `rating-${matchId}-${entry.playerId}-${Date.now()}`,
            matchId,
            playerId: entry.playerId,
            teamId: entry.playerId.includes('home') ? match[0].homeTeamId : match[0].awayTeamId, // Simplified - should be determined properly
            autoRating: 6.0,
            finalRating: null,
            adjustedBy: null,
            adjustmentNotes: null,
            adjustmentTime: null,
            isMotM: false,
            ratingBreakdown: JSON.stringify({
                goals: 0,
                assists: 0,
                eyePoints: 0,
                cards: 0,
                shots: 0,
                fouls: 0,
                positionBonus: 0
            })
        }));

        // Insert all ratings
        if (ratingsToCreate.length > 0) {
            await db.insert(playerRatings).values(ratingsToCreate);
        }

        return NextResponse.json({
            message: 'Ratings initialized successfully',
            count: ratingsToCreate.length,
            matchId
        });

    } catch (error) {
        console.error('Error initializing ratings:', error);
        return NextResponse.json(
            { error: 'Failed to initialize ratings' },
            { status: 500 }
        );
    }
}
