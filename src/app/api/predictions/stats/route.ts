import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { predictionLeaderboard } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/predictions/stats - Get user prediction stats
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        const userStats = await db
            .select()
            .from(predictionLeaderboard)
            .where(eq(predictionLeaderboard.userId, userId))
            .limit(1);

        if (!userStats || userStats.length === 0) {
            return NextResponse.json({
                stats: {
                    totalPoints: 0,
                    accuracy: 0,
                    rank: 0,
                    streak: 0,
                    totalPredictions: 0,
                    correctPredictions: 0,
                },
            });
        }

        // Get user's rank
        const allUsers = await db
            .select()
            .from(predictionLeaderboard)
            .orderBy(desc(predictionLeaderboard.totalPoints));

        const rank = allUsers.findIndex((u) => u.userId === userId) + 1;

        return NextResponse.json({
            stats: {
                ...userStats[0],
                rank,
            },
        });
    } catch (error) {
        console.error('[Stats API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
