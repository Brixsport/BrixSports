/**
 * Competitions Bulk Operations API
 * POST /api/competitions/bulk - Bulk create competitions
 * PATCH /api/competitions/bulk - Bulk update competitions
 * DELETE /api/competitions/bulk - Bulk delete competitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { competitions, matches, organizations } from '@/db/schema';
import { inArray, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';
import { MAX_BULK_COMPETITION_DELETES, buildCompetitionUpdate } from '@/lib/competition-update';

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

        // Validate each update has an ID and only touches allow-listed fields
        const prepared: { id: string; updateData: Record<string, unknown> }[] = [];
        for (const update of updates) {
            if (!update || typeof update !== 'object' || typeof update.id !== 'string' || !update.id) {
                return NextResponse.json(
                    { error: 'Each update must have an id field' },
                    { status: 400 }
                );
            }
            const { id, ...data } = update;
            const built = buildCompetitionUpdate(data);
            if (!built.ok) {
                return NextResponse.json({ error: built.error }, { status: 422 });
            }
            for (const orgField of ['hostOrganizationId', 'governingOrganizationId'] as const) {
                const orgId = built.update[orgField];
                if (typeof orgId === 'string') {
                    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
                    if (!org) {
                        return NextResponse.json({ error: `Invalid ${orgField}: organization not found` }, { status: 422 });
                    }
                }
            }
            prepared.push({ id, updateData: { ...built.update, updatedAt: new Date() } });
        }

        // Perform updates individually (SQLite doesn't support bulk updates easily)
        const results = [];
        for (const { id, updateData } of prepared) {
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

        if (ids.length > MAX_BULK_COMPETITION_DELETES || ids.some((id) => typeof id !== 'string' || !id)) {
            return NextResponse.json(
                { error: `ids must be non-empty strings, at most ${MAX_BULK_COMPETITION_DELETES} per request` },
                { status: 422 }
            );
        }

        // matches.competition_id does not cascade: refuse instead of failing on the FK
        const referenced = await db
            .select({ competitionId: matches.competitionId })
            .from(matches)
            .where(inArray(matches.competitionId, ids))
            .groupBy(matches.competitionId)
            .limit(MAX_BULK_COMPETITION_DELETES);
        if (referenced.length > 0) {
            return NextResponse.json(
                {
                    error: 'Some competitions still have matches and cannot be deleted',
                    competitionIds: referenced.map((r) => r.competitionId),
                },
                { status: 409 }
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
