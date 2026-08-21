import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchPredictions, predictionLeaderboard } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

// GET /api/predictions - Get user predictions
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const matchId = searchParams.get('matchId');

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        const authUser = await getAuthUser(request).catch(() => null);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.id !== userId && authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // If matchId is provided, get specific prediction
        if (matchId) {
            const prediction = await db
                .select()
                .from(matchPredictions)
                .where(
                    and(
                        eq(matchPredictions.userId, userId),
                        eq(matchPredictions.matchId, matchId)
                    )
                )
                .limit(1);

            return NextResponse.json({
                prediction: prediction[0] || null,
            });
        }

        // Otherwise get all predictions for user
        const predictions = await db
            .select()
            .from(matchPredictions)
            .where(eq(matchPredictions.userId, userId))
            .orderBy(desc(matchPredictions.createdAt));

        return NextResponse.json({
            predictions,
            total: predictions.length,
        });
    } catch (error) {
        console.error('[Predictions API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch predictions' },
            { status: 500 }
        );
    }
}

// POST /api/predictions - Create a prediction
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request).catch(() => null);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            matchId,
            predictedHomeScore,
            predictedAwayScore,
            predictedWinner,
            confidence,
        } = body;
        // Ownership is never client-supplied — always the verified session (CLAUDE.md audit-field rule).
        const userId = authUser.id;

        if (!userId || !matchId || predictedHomeScore === undefined || predictedAwayScore === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Check if prediction already exists
        const existing = await db
            .select()
            .from(matchPredictions)
            .where(
                and(
                    eq(matchPredictions.userId, userId),
                    eq(matchPredictions.matchId, matchId)
                )
            )
            .limit(1);

        if (existing && existing.length > 0) {
            // Update existing prediction
            const updated = await db
                .update(matchPredictions)
                .set({
                    predictedHomeScore,
                    predictedAwayScore,
                    predictedWinner,
                    confidence: confidence || 50,
                    updatedAt: new Date(),
                })
                .where(eq(matchPredictions.id, existing[0].id))
                .returning();

            return NextResponse.json({
                success: true,
                prediction: updated[0],
                message: 'Prediction updated',
            });
        }

        // Create new prediction
        const newPrediction = await db
            .insert(matchPredictions)
            .values({
                id: `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId,
                matchId,
                predictedHomeScore,
                predictedAwayScore,
                predictedWinner,
                confidence: confidence || 50,
                points: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning();

        // Update user's leaderboard entry
        await updateLeaderboard(userId);

        return NextResponse.json({
            success: true,
            prediction: newPrediction[0],
            message: 'Prediction created',
        });
    } catch (error) {
        console.error('[Predictions API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create prediction' },
            { status: 500 }
        );
    }
}

// PUT /api/predictions - Update an existing prediction
export async function PUT(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request).catch(() => null);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            matchId,
            predictedHomeScore,
            predictedAwayScore,
            predictedWinner,
            confidence,
        } = body;
        // Ownership is never client-supplied — always the verified session (CLAUDE.md audit-field rule).
        const userId = authUser.id;

        if (!userId || !matchId || predictedHomeScore === undefined || predictedAwayScore === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Find existing prediction
        const existing = await db
            .select()
            .from(matchPredictions)
            .where(
                and(
                    eq(matchPredictions.userId, userId),
                    eq(matchPredictions.matchId, matchId)
                )
            )
            .limit(1);

        if (!existing || existing.length === 0) {
            return NextResponse.json(
                { error: 'Prediction not found' },
                { status: 404 }
            );
        }

        // Update prediction
        const updated = await db
            .update(matchPredictions)
            .set({
                predictedHomeScore,
                predictedAwayScore,
                predictedWinner,
                confidence: confidence || 50,
                updatedAt: new Date(),
            })
            .where(eq(matchPredictions.id, existing[0].id))
            .returning();

        return NextResponse.json({
            success: true,
            prediction: updated[0],
            message: 'Prediction updated successfully',
        });
    } catch (error) {
        console.error('[Predictions API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update prediction' },
            { status: 500 }
        );
    }
}


async function updateLeaderboard(userId: string) {
    try {
        const userPredictions = await db
            .select()
            .from(matchPredictions)
            .where(eq(matchPredictions.userId, userId));

        const totalPredictions = userPredictions.length;
        const correctPredictions = userPredictions.filter((p) => p.isCorrect).length;
        const totalPoints = userPredictions.reduce((sum, p) => sum + (p.points || 0), 0);
        const accuracy = totalPredictions > 0 ? Math.round((correctPredictions / totalPredictions) * 100) : 0;

        // Check if user exists in leaderboard
        const existing = await db
            .select()
            .from(predictionLeaderboard)
            .where(eq(predictionLeaderboard.userId, userId))
            .limit(1);

        if (existing && existing.length > 0) {
            await db
                .update(predictionLeaderboard)
                .set({
                    totalPredictions,
                    correctPredictions,
                    totalPoints,
                    accuracy,
                    updatedAt: new Date(),
                })
                .where(eq(predictionLeaderboard.userId, userId));
        } else {
            await db.insert(predictionLeaderboard).values({
                id: `lb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId,
                totalPredictions,
                correctPredictions,
                totalPoints,
                accuracy,
                streak: 0,
                longestStreak: 0,
                updatedAt: new Date(),
            });
        }
    } catch (error) {
        console.error('[Leaderboard Update] Error:', error);
    }
}
