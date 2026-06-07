import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchLoggerAssignments } from '@/db/schema';
import { nanoid } from 'nanoid';
import { and, eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

/**
 * POST /api/matches/[id]/assign-logger
 * Assign a logger to a match (admin only)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: matchId } = await params;
        const { loggerId, role = 'primary' } = await request.json();

        if (!loggerId) {
            return NextResponse.json(
                { error: 'Logger ID is required' },
                { status: 400 }
            );
        }

        // Atomic: check and insert inside a transaction to prevent duplicate
        // assignments from concurrent requests (race condition guard).
        const assignment = await db.transaction(async (tx) => {
            const existing = await tx
                .select({ id: matchLoggerAssignments.id })
                .from(matchLoggerAssignments)
                .where(
                    and(
                        eq(matchLoggerAssignments.matchId, matchId),
                        eq(matchLoggerAssignments.loggerId, loggerId),
                        eq(matchLoggerAssignments.status, 'active')
                    )
                )
                .limit(1)
                .get();

            if (existing) {
                return null; // signal duplicate to caller
            }

            const [row] = await tx.insert(matchLoggerAssignments).values({
                id: nanoid(),
                matchId,
                loggerId,
                role,
                assignedBy: authUser.id,
                status: 'active',
            }).returning();

            return row;
        });

        if (!assignment) {
            return NextResponse.json(
                { error: 'This logger is already assigned to this match' },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            assignment,
        });
    } catch (error) {
        console.error('Error assigning logger:', error);
        return NextResponse.json(
            { error: 'Failed to assign logger' },
            { status: 500 }
        );
    }
}
