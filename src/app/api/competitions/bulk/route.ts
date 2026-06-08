/**
 * Competitions Bulk Operations API
 * POST /api/competitions/bulk - Bulk create competitions
 * PATCH /api/competitions/bulk - Bulk update competitions
 * DELETE /api/competitions/bulk - Bulk delete competitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { competitions } from '@/db/schema';
import { inArray, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';

/**
 * POST - Bulk create competitions
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { competitions: competitionsData } = body;

        if (!Array.isArray(competitionsData) || competitionsData.length === 0) {
            return NextResponse.json(
                { error: 'competitions must be a non-empty array' },
                { status: 400 }
            );
        }

        // Validate each competition
        for (const comp of competitionsData) {
            if (!comp.name || !comp.sport || !comp.format || !comp.season) {
                return NextResponse.json(
                    { error: 'Each competition must have: name, sport, format, season' },
                    { status: 400 }
                );
            }
        }

        // Prepare competitions for insertion
        const newCompetitions = competitionsData.map((comp) => ({
            id: nanoid(),
            name: comp.name,
            sport: comp.sport,
            format: comp.format,
            season: comp.season,
            status: comp.status || 'upcoming',
            numberOfTeams: comp.numberOfTeams || 0,
            numberOfGroups: comp.numberOfGroups || 0,
            teamsPerGroup: comp.teamsPerGroup || 0,
            level: comp.level || null,
            scope: comp.scope || 'internal',
            rules: comp.rules ? JSON.stringify(comp.rules) : null,
            description: comp.description || null,
            startDate: comp.startDate ? new Date(comp.startDate) : null,
            endDate: comp.endDate ? new Date(comp.endDate) : null,
            followersCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        }));

        const inserted = await db.insert(competitions).values(newCompetitions).returning();

        return NextResponse.json({
            success: true,
            count: inserted.length,
            competitions: inserted,
        }, { status: 201 });
    } catch (error) {
        console.error('[Competitions Bulk API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to bulk create competitions' },
            { status: 500 }
        );
    }
}

/**
 * PATCH - Bulk update competitions
 */
export async function PATCH(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { updates } = body;

        if (!Array.isArray(updates) || updates.length === 0) {
            return NextResponse.json(
                { error: 'updates must be a non-empty array' },
                { status: 400 }
            );
        }

        // Validate each update has an ID
        for (const update of updates) {
            if (!update.id) {
                return NextResponse.json(
                    { error: 'Each update must have an id field' },
                    { status: 400 }
                );
            }
        }

        // Perform updates individually (SQLite doesn't support bulk updates easily)
        const results = [];
        for (const update of updates) {
            const { id, ...data } = update;

            const updateData: any = {
                ...data,
                updatedAt: new Date(),
            };

            // Convert dates if provided
            if (data.startDate) updateData.startDate = new Date(data.startDate);
            if (data.endDate) updateData.endDate = new Date(data.endDate);
            if (data.rules && typeof data.rules === 'object') {
                updateData.rules = JSON.stringify(data.rules);
            }

            const updated = await db
                .update(competitions)
                .set(updateData)
                .where(eq(competitions.id, id))
                .returning();

            if (updated.length > 0) {
                results.push(updated[0]);
            }
        }

        return NextResponse.json({
            success: true,
            count: results.length,
            competitions: results,
        });
    } catch (error) {
        console.error('[Competitions Bulk API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to bulk update competitions' },
            { status: 500 }
        );
    }
}

/**
 * DELETE - Bulk delete competitions
 */
export async function DELETE(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { ids } = body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { error: 'ids must be a non-empty array' },
                { status: 400 }
            );
        }

        const deleted = await db
            .delete(competitions)
            .where(inArray(competitions.id, ids))
            .returning();

        return NextResponse.json({
            success: true,
            count: deleted.length,
            deletedIds: deleted.map(c => c.id),
        });
    } catch (error) {
        console.error('[Competitions Bulk API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to bulk delete competitions' },
            { status: 500 }
        );
    }
}
