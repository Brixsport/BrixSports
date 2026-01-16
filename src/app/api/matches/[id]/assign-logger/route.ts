import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchLoggerAssignments } from '@/db/schema';
import { nanoid } from 'nanoid';
import { and, eq } from 'drizzle-orm';

/**
 * POST /api/matches/[id]/assign-logger
 * Assign a logger to a match
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: matchId } = await params;
        const { loggerId, role = 'primary', assignedBy } = await request.json();

        if (!loggerId) {
            return NextResponse.json(
                { error: 'Logger ID is required' },
                { status: 400 }
            );
        }

        // Check if logger is already assigned to this match
        const existing = await db
            .select()
            .from(matchLoggerAssignments)
            .where(
                and(
                    eq(matchLoggerAssignments.matchId, matchId),
                    eq(matchLoggerAssignments.loggerId, loggerId),
                    eq(matchLoggerAssignments.status, 'active')
                )
            )
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json(
                { error: 'This logger is already assigned to this match' },
                { status: 400 }
            );
        }

        // Create new assignment
        const assignment = await db.insert(matchLoggerAssignments).values({
            id: nanoid(),
            matchId,
            loggerId,
            role,
            assignedBy,
            status: 'active',
        }).returning();

        return NextResponse.json({
            success: true,
            assignment: assignment[0]
        });
    } catch (error) {
        console.error('Error assigning logger:', error);
        return NextResponse.json(
            { error: 'Failed to assign logger' },
            { status: 500 }
        );
    }
}
