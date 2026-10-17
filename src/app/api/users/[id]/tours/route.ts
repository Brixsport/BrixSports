/**
 * Fan Tour Dismissals API
 * Fan Account Blueprint Phase 3, ADR-001 Decision 2 -- tracks which first-run
 * coachmark tours a fan has already dismissed, so they never show again.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fanTourDismissals } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { nanoid } from 'nanoid';

/**
 * GET dismissed tour ids for this fan
 * GET /api/users/[id]/tours
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: userId } = await params;

    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authUser.id !== userId && authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const rows = await db
            .select({ tourId: fanTourDismissals.tourId })
            .from(fanTourDismissals)
            .where(eq(fanTourDismissals.userId, userId))
            .limit(200);

        return NextResponse.json({ dismissedTourIds: rows.map((r) => r.tourId) });
    } catch (error) {
        console.error('Error fetching tour dismissals:', error);
        return NextResponse.json({ error: 'Failed to fetch tour dismissals' }, { status: 500 });
    }
}

/**
 * Dismiss a tour
 * POST /api/users/[id]/tours  { tourId: string }
 * Idempotent via the DB's own unique (user_id, tour_id) index -- a double-fire
 * (fast double-click, two tabs) can't create duplicates or 500.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: userId } = await params;

    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authUser.id !== userId && authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { tourId } = body;
        if (!tourId || typeof tourId !== 'string') {
            return NextResponse.json({ error: 'Missing tourId' }, { status: 400 });
        }

        const existing = await db
            .select({ id: fanTourDismissals.id })
            .from(fanTourDismissals)
            .where(and(eq(fanTourDismissals.userId, userId), eq(fanTourDismissals.tourId, tourId)))
            .limit(1);

        if (existing.length === 0) {
            await db.insert(fanTourDismissals).values({
                id: nanoid(),
                userId,
                tourId,
            });
        }

        return NextResponse.json({ success: true, tourId });
    } catch (error) {
        console.error('Error dismissing tour:', error);
        return NextResponse.json({ error: 'Failed to dismiss tour' }, { status: 500 });
    }
}
