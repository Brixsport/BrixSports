import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { playerRatings, players, teams } from '@/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

/**
 * GET /api/ratings/analytics
 * Get rating analytics and statistics
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'player-average', 'best-rated', 'position-comparison', 'team-average'
        const playerId = searchParams.get('playerId');
        const teamId = searchParams.get('teamId');
        const position = searchParams.get('position');
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10), 100);

        switch (type) {
            case 'player-average':
                return await getPlayerAverageRating(playerId);

            case 'best-rated':
                return await getBestRatedPlayers(limit, position);

            case 'position-comparison':
                return await getPositionComparison();

            case 'team-average':
                return await getTeamAverageRatings(teamId);

            default:
                return NextResponse.json(
                    { error: 'Invalid analytics type' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Error fetching rating analytics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch analytics' },
            { status: 500 }
        );
    }
}

// Get player's average rating across all matches
async function getPlayerAverageRating(playerId: string | null) {
    if (!playerId) {
        return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
    }

    const ratings = await db
        .select({
            playerId: playerRatings.playerId,
            avgAutoRating: sql<number>`AVG(${playerRatings.autoRating})`,
            avgFinalRating: sql<number>`AVG(COALESCE(${playerRatings.finalRating}, ${playerRatings.autoRating}))`,
            totalMatches: sql<number>`COUNT(*)`,
            motmCount: sql<number>`SUM(CASE WHEN ${playerRatings.isMotM} = 1 THEN 1 ELSE 0 END)`,
            player: players
        })
        .from(playerRatings)
        .leftJoin(players, eq(playerRatings.playerId, players.id))
        .where(eq(playerRatings.playerId, playerId))
        .groupBy(playerRatings.playerId);

    if (ratings.length === 0) {
        return NextResponse.json({ error: 'No ratings found for player' }, { status: 404 });
    }

    return NextResponse.json({
        playerId,
        player: ratings[0].player,
        averageAutoRating: parseFloat(ratings[0].avgAutoRating.toFixed(2)),
        averageFinalRating: parseFloat(ratings[0].avgFinalRating.toFixed(2)),
        totalMatches: ratings[0].totalMatches,
        manOfTheMatchAwards: ratings[0].motmCount
    });
}

// Get best rated players
async function getBestRatedPlayers(limit: number, position: string | null) {
    let query = db
        .select({
            playerId: playerRatings.playerId,
            avgRating: sql<number>`AVG(COALESCE(${playerRatings.finalRating}, ${playerRatings.autoRating}))`,
            totalMatches: sql<number>`COUNT(*)`,
            motmCount: sql<number>`SUM(CASE WHEN ${playerRatings.isMotM} = 1 THEN 1 ELSE 0 END)`,
            player: players
        })
        .from(playerRatings)
        .leftJoin(players, eq(playerRatings.playerId, players.id))
        .groupBy(playerRatings.playerId)
        .orderBy(desc(sql`AVG(COALESCE(${playerRatings.finalRating}, ${playerRatings.autoRating}))`))
        .limit(limit);

    const results = await query;

    return NextResponse.json({
        bestRatedPlayers: results.map(r => ({
            playerId: r.playerId,
            player: r.player,
            averageRating: parseFloat(r.avgRating.toFixed(2)),
            totalMatches: r.totalMatches,
            manOfTheMatchAwards: r.motmCount
        }))
    });
}

// Get position comparison (average ratings by position)
async function getPositionComparison() {
    const results = await db
        .select({
            position: players.position,
            avgRating: sql<number>`AVG(COALESCE(${playerRatings.finalRating}, ${playerRatings.autoRating}))`,
            totalPlayers: sql<number>`COUNT(DISTINCT ${playerRatings.playerId})`,
            totalMatches: sql<number>`COUNT(*)`
        })
        .from(playerRatings)
        .leftJoin(players, eq(playerRatings.playerId, players.id))
        .groupBy(players.position)
        .orderBy(desc(sql`AVG(COALESCE(${playerRatings.finalRating}, ${playerRatings.autoRating}))`));

    return NextResponse.json({
        positionComparison: results.map(r => ({
            position: r.position,
            averageRating: parseFloat(r.avgRating.toFixed(2)),
            totalPlayers: r.totalPlayers,
            totalMatches: r.totalMatches
        }))
    });
}

// Get team average ratings
async function getTeamAverageRatings(teamId: string | null) {
    if (!teamId) {
        // Get all teams
        const results = await db
            .select({
                teamId: playerRatings.teamId,
                avgRating: sql<number>`AVG(COALESCE(${playerRatings.finalRating}, ${playerRatings.autoRating}))`,
                totalMatches: sql<number>`COUNT(DISTINCT ${playerRatings.matchId})`,
                totalPlayers: sql<number>`COUNT(DISTINCT ${playerRatings.playerId})`,
                team: teams
            })
            .from(playerRatings)
            .leftJoin(teams, eq(playerRatings.teamId, teams.id))
            .groupBy(playerRatings.teamId)
            .orderBy(desc(sql`AVG(COALESCE(${playerRatings.finalRating}, ${playerRatings.autoRating}))`));

        return NextResponse.json({
            teamRatings: results.map(r => ({
                teamId: r.teamId,
                team: r.team,
                averageRating: parseFloat(r.avgRating.toFixed(2)),
                totalMatches: r.totalMatches,
                totalPlayers: r.totalPlayers
            }))
        });
    } else {
        // Get specific team
        const results = await db
            .select({
                teamId: playerRatings.teamId,
                avgRating: sql<number>`AVG(COALESCE(${playerRatings.finalRating}, ${playerRatings.autoRating}))`,
                totalMatches: sql<number>`COUNT(DISTINCT ${playerRatings.matchId})`,
                totalPlayers: sql<number>`COUNT(DISTINCT ${playerRatings.playerId})`,
                team: teams
            })
            .from(playerRatings)
            .leftJoin(teams, eq(playerRatings.teamId, teams.id))
            .where(eq(playerRatings.teamId, teamId))
            .groupBy(playerRatings.teamId);

        if (results.length === 0) {
            return NextResponse.json({ error: 'No ratings found for team' }, { status: 404 });
        }

        return NextResponse.json({
            teamId,
            team: results[0].team,
            averageRating: parseFloat(results[0].avgRating.toFixed(2)),
            totalMatches: results[0].totalMatches,
            totalPlayers: results[0].totalPlayers
        });
    }
}
