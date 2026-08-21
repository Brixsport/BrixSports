import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { predictionLeaderboard } from '@/db/schema';
import { desc } from 'drizzle-orm';

// GET /api/predictions/leaderboard - Get prediction leaderboard
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100), 100);

        const leaderboard = await db
            .select()
            .from(predictionLeaderboard)
            .orderBy(desc(predictionLeaderboard.totalPoints))
            .limit(limit);

        // Add ranks
        const rankedLeaderboard = leaderboard.map((entry, index) => ({
            ...entry,
            rank: index + 1,
        }));

        return NextResponse.json({
            leaderboard: rankedLeaderboard,
            total: rankedLeaderboard.length,
        });
    } catch (error) {
        console.error('[Leaderboard API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch leaderboard' },
            { status: 500 }
        );
    }
}
