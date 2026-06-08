import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchLoggerAssignments } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

/**
 * POST /api/matches/[id]/remove-logger
 * Remove a logger from a match assignment
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: matchId } = await params;
        const { loggerId } = await request.json();

        if (!loggerId) {
            return NextResponse.json(
                { error: 'Logger ID is required' },
                { status: 400 }
            );
        }

        // Update assignment status to 'removed'
        const result = await db
            .update(matchLoggerAssignments)
            .set({ status: 'removed' })
            .where(
                and(
                    eq(matchLoggerAssignments.matchId, matchId),
                    eq(matchLoggerAssignments.loggerId, loggerId),
                    eq(matchLoggerAssignments.status, 'active')
                )
            )
            .returning();

        if (result.length === 0) {
            return NextResponse.json(
                { error: 'Logger assignment not found or already removed' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Logger removed from match successfully'
        });
    } catch (error) {
        console.error('Error removing logger:', error);
        return NextResponse.json(
            { error: 'Failed to remove logger' },
            { status: 500 }
        );
    }
}
