/**
 * Bulk Match Update API
 * PATCH /api/matches/bulk
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { parseBulkMatchUpdate } from '@/lib/match-bulk-input';
import { MATCH_BULK_RESPONSE_FIELDS } from '@/lib/match-admin-fields';

export async function PATCH(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const parsed = parseBulkMatchUpdate(body);
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: 422 });
        }
        const { ids, update } = parsed;

        // loggerId intentionally excluded — logger assignment must go through the dedicated assign/remove-logger endpoints
        const result = await db
            .update(matches)
            .set({ ...update, updatedAt: new Date() })
            .where(inArray(matches.id, ids))
            .returning(MATCH_BULK_RESPONSE_FIELDS);

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
