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
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user || (user.role !== 'admin' && user.role !== 'logger')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id: matchId } = await params;

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

        // Allow initialization for LIVE or FINISHED matches
        if (match[0].status !== 'LIVE' && match[0].status !== 'FINISHED') {
            return NextResponse.json(
                { error: 'Can only initialize ratings for live or finished matches' },
                { status: 400 }
            );
        }

        // Get lineups
        const lineupsRaw = match[0].lineups;
        const lineups = typeof lineupsRaw === 'string' ? JSON.parse(lineupsRaw) : lineupsRaw;

        if (!lineups) {
            return NextResponse.json(
                { error: 'No lineups found for this match' },
                { status: 400 }
            );
        }

        // Helper to extract players with team info
        const getPlayersFromTeam = (teamLineup: any, teamLabel: 'home' | 'away') => {
            if (!teamLineup) return [];
            let list = [];
            if (Array.isArray(teamLineup)) list = teamLineup;
            else if (teamLineup.starters || teamLineup.bench) {
                list = [...(teamLineup.starters || []), ...(teamLineup.bench || [])];
            }
            return list.map(p => ({ ...p, team: teamLabel }));
        };

        const allPlayers = [
            ...getPlayersFromTeam(lineups.home, 'home'),
            ...getPlayersFromTeam(lineups.away, 'away')
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
        const ratingsToCreate = allPlayers.map(entry => {
            const playerId = entry.playerId || entry.id; // Handle both formats
            if (!playerId) return null;

            return {
                id: `rating-${matchId}-${playerId}-${Date.now()}`,
                matchId,
                playerId,
                teamId: entry.team === 'home' ? match[0].homeTeamId : match[0].awayTeamId,
                autoRating: 6.0,
                finalRating: null,
                adjustedBy: null,
                adjustmentNotes: null,
                adjustmentTime: null,
                isMotM: false,
                ratingBreakdown: {
                    goals: 0,
                    assists: 0,
                    eyePoints: 0,
                    cards: 0,
                    shots: 0,
                    fouls: 0,
                    positionBonus: 0
                }
            };
        }).filter(Boolean);

        // Insert all ratings
        if (ratingsToCreate.length > 0) {
            await db.insert(playerRatings).values(ratingsToCreate as any);
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
