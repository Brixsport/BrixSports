import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bracketNodes, matches } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/brackets/[id] - Get a specific bracket node
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const nodeId = params.id;

        // Get bracket node
        const node = await db
            .select()
            .from(bracketNodes)
            .where(eq(bracketNodes.id, nodeId))
            .get();

        if (!node) {
            return NextResponse.json(
                { error: 'Bracket node not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            node,
        });
    } catch (error) {
        console.error('Error fetching bracket node:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bracket node' },
            { status: 500 }
        );
    }
}

// PATCH /api/brackets/[id] - Update bracket node
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const nodeId = params.id;
        const updates = await request.json();

        // Verify node exists
        const node = await db
            .select()
            .from(bracketNodes)
            .where(eq(bracketNodes.id, nodeId))
            .get();

        if (!node) {
            return NextResponse.json(
                { error: 'Bracket node not found' },
                { status: 404 }
            );
        }

        // Prepare update data
        const updateData: any = {};

        // Only update allowed fields
        const allowedFields = [
            'title',
            'matchId',
            'nextMatchId',
            'homeTeamId',
            'awayTeamId',
            'homeScore',
            'awayScore',
            'status',
            'round',
            'position',
        ];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        }

        // Update the bracket node
        await db
            .update(bracketNodes)
            .set(updateData)
            .where(eq(bracketNodes.id, nodeId));

        // If match is finished and there's a next match, update the next match with the winner
        if (updates.status === 'FINISHED' && node.nextMatchId) {
            const homeScore = updates.homeScore ?? node.homeScore ?? 0;
            const awayScore = updates.awayScore ?? node.awayScore ?? 0;

            // Determine winner
            const winnerId = homeScore > awayScore
                ? (updates.homeTeamId ?? node.homeTeamId)
                : (updates.awayTeamId ?? node.awayTeamId);

            if (winnerId) {
                // Get the next match node
                const nextNode = await db
                    .select()
                    .from(bracketNodes)
                    .where(eq(bracketNodes.id, node.nextMatchId))
                    .get();

                if (nextNode) {
                    // Update next match with winner
                    // Determine if winner should be home or away team in next match
                    const nextMatchUpdate: any = {};

                    if (!nextNode.homeTeamId) {
                        nextMatchUpdate.homeTeamId = winnerId;
                    } else if (!nextNode.awayTeamId) {
                        nextMatchUpdate.awayTeamId = winnerId;
                    }

                    if (Object.keys(nextMatchUpdate).length > 0) {
                        await db
                            .update(bracketNodes)
                            .set(nextMatchUpdate)
                            .where(eq(bracketNodes.id, node.nextMatchId));
                    }
                }
            }
        }

        // Get updated node
        const updatedNode = await db
            .select()
            .from(bracketNodes)
            .where(eq(bracketNodes.id, nodeId))
            .get();

        return NextResponse.json({
            success: true,
            message: 'Bracket node updated successfully',
            node: updatedNode,
        });
    } catch (error) {
        console.error('Error updating bracket node:', error);
        return NextResponse.json(
            { error: 'Failed to update bracket node' },
            { status: 500 }
        );
    }
}

// DELETE /api/brackets/[id] - Delete bracket node
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const nodeId = params.id;

        // Verify node exists
        const node = await db
            .select()
            .from(bracketNodes)
            .where(eq(bracketNodes.id, nodeId))
            .get();

        if (!node) {
            return NextResponse.json(
                { error: 'Bracket node not found' },
                { status: 404 }
            );
        }

        // Delete the node
        await db
            .delete(bracketNodes)
            .where(eq(bracketNodes.id, nodeId));

        return NextResponse.json({
            success: true,
            message: 'Bracket node deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting bracket node:', error);
        return NextResponse.json(
            { error: 'Failed to delete bracket node' },
            { status: 500 }
        );
    }
}
