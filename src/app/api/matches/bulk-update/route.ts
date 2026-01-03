/**
 * Bulk Match Update API
 * PATCH /api/matches/bulk
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { ids, updates } = body;

        if (!Array.isArray(ids) || ids.length === 0 || !updates) {
            return NextResponse.json(
                { error: 'Invalid request: Expected an array of ids and an updates object' },
                { status: 400 }
            );
        }

        // Build update object
        const updateData: any = {
            updatedAt: new Date(),
        };

        if (updates.status) updateData.status = updates.status;
        if (updates.venue) updateData.venue = updates.venue;
        if (updates.competition) updateData.competition = updates.competition;
        if (updates.loggerId !== undefined) updateData.loggerId = updates.loggerId;

        // Perform bulk update
        const result = await db
            .update(matches)
            .set(updateData)
            .where(inArray(matches.id, ids))
            .returning();

        return NextResponse.json({
            success: true,
            totalUpdated: result.length,
            matches: result
        });

    } catch (error) {
        console.error('Error in bulk match update:', error);
        return NextResponse.json(
            { error: 'Failed to update matches in bulk' },
            { status: 500 }
        );
    }
}
