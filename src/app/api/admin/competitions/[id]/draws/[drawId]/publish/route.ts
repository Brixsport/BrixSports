import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { competitionDraws, competitions, matches } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { nanoid } from 'nanoid';

interface StoredPairing {
    round: number;
    index: number;
    homeTeamId: string;
    awayTeamId: string;
    startTime?: string | null;
    venue?: string | null;
}

async function getOwnedDraw(competitionId: string, drawId: string) {
    return db
        .select()
        .from(competitionDraws)
        .where(and(eq(competitionDraws.id, drawId), eq(competitionDraws.competitionId, competitionId)))
        .limit(1)
        .then(r => r[0] ?? null);
}

function toDrawDTO(row: typeof competitionDraws.$inferSelect) {
    return {
        ...row,
        seedOrder: JSON.parse(row.seedOrder),
        pots: row.pots ? JSON.parse(row.pots) : null,
        pairings: JSON.parse(row.pairings),
        publishedMatchIds: row.publishedMatchIds ? JSON.parse(row.publishedMatchIds) : null,
    };
}

// POST — publish a DRAFT draw's pairings into real `matches` rows.
// Deliberately does NOT reuse POST /api/matches (that route spreads the
// entire client body into the insert -- a known, separate mass-assignment
// risk, not fixed by this work). Builds an explicit, server-controlled field
// set instead. Idempotent-safe: a retry (e.g. after a crash mid-publish, or a
// genuine republish of an already-PUBLISHED draw) deletes only its own prior
// UPCOMING matches first -- aborts entirely if any of them has progressed
// past UPCOMING (never touches a LIVE/FINISHED match).
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string; drawId: string } }
) {
    try {
        const authUser = await getAuthUser(req);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const draw = await getOwnedDraw(params.id, params.drawId);
        if (!draw) {
            return NextResponse.json({ error: 'Draw not found' }, { status: 404 });
        }
        if (draw.status === 'SUPERSEDED') {
            return NextResponse.json({ error: 'Cannot publish a superseded draw' }, { status: 409 });
        }

        const comp = await db
            .select({ id: competitions.id, name: competitions.name })
            .from(competitions)
            .where(eq(competitions.id, params.id))
            .limit(1)
            .then(r => r[0] ?? null);
        if (!comp) {
            return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
        }

        const pairings: StoredPairing[] = JSON.parse(draw.pairings);

        const missingSchedule = pairings.filter(p => !p.startTime || !p.venue);
        if (missingSchedule.length > 0) {
            return NextResponse.json({
                error: `${missingSchedule.length} pairing(s) are missing a startTime and/or venue -- every match needs both before publishing`,
                details: missingSchedule.map(p => ({ round: p.round, index: p.index })),
            }, { status: 422 });
        }

        // Idempotent-retry: if this draw was already published, its prior
        // matches must all still be UPCOMING before we touch them.
        if (draw.publishedMatchIds) {
            const priorIds: string[] = JSON.parse(draw.publishedMatchIds);
            if (priorIds.length > 0) {
                const priorMatches = await db
                    .select({ id: matches.id, status: matches.status })
                    .from(matches)
                    .where(inArray(matches.id, priorIds));

                const progressed = priorMatches.filter(m => m.status !== 'UPCOMING');
                if (progressed.length > 0) {
                    return NextResponse.json({
                        error: `Cannot republish -- ${progressed.length} of this draw's previously-published match(es) are no longer UPCOMING`,
                        details: progressed.map(m => ({ id: m.id, status: m.status })),
                    }, { status: 409 });
                }

                if (priorMatches.length > 0) {
                    await db.delete(matches).where(inArray(matches.id, priorMatches.map(m => m.id)));
                }
            }
        }

        const now = new Date();
        const newMatches = pairings.map(p => ({
            id: `match_${nanoid()}`,
            sport: draw.sport,
            homeTeamId: p.homeTeamId,
            awayTeamId: p.awayTeamId,
            homeScore: 0,
            awayScore: 0,
            status: 'UPCOMING' as const,
            startTime: p.startTime as string,
            venue: p.venue as string,
            competition: comp.name,
            competitionId: comp.id,
            matchType: 'competition',
            matchday: p.round,
            round: null, // league phase -- not a knockout round, matches BACKLOG-275's exclusion list
            groupName: null,
        }));

        // Single batched insert -- one atomic statement.
        const inserted = await db.insert(matches).values(newMatches).returning({ id: matches.id });
        const newIds = inserted.map(m => m.id);

        const updated = {
            status: 'PUBLISHED',
            publishedMatchIds: JSON.stringify(newIds),
            updatedAt: now,
        };
        await db.update(competitionDraws).set(updated).where(eq(competitionDraws.id, draw.id));

        return NextResponse.json({ draw: toDrawDTO({ ...draw, ...updated }), matchIds: newIds, matchCount: newIds.length });
    } catch (err) {
        console.error('[competition draw publish POST] Error:', err);
        return NextResponse.json({ error: 'Failed to publish draw' }, { status: 500 });
    }
}

// DELETE — unpublish: removes this draw's published matches and reverts it
// to DRAFT so it can be edited (via PATCH) and republished. Aborts entirely
// (no partial unpublish) if any of its matches has progressed past UPCOMING --
// per BACKLOG-267's resolved flow, real play blocks correction.
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string; drawId: string } }
) {
    try {
        const authUser = await getAuthUser(req);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const draw = await getOwnedDraw(params.id, params.drawId);
        if (!draw) {
            return NextResponse.json({ error: 'Draw not found' }, { status: 404 });
        }
        if (draw.status !== 'PUBLISHED') {
            return NextResponse.json({ error: 'Draw is not published' }, { status: 409 });
        }

        const matchIds: string[] = draw.publishedMatchIds ? JSON.parse(draw.publishedMatchIds) : [];
        if (matchIds.length > 0) {
            const existing = await db
                .select({ id: matches.id, status: matches.status })
                .from(matches)
                .where(inArray(matches.id, matchIds));

            const progressed = existing.filter(m => m.status !== 'UPCOMING');
            if (progressed.length > 0) {
                return NextResponse.json({
                    error: `Cannot unpublish -- ${progressed.length} match(es) are no longer UPCOMING`,
                    details: progressed.map(m => ({ id: m.id, status: m.status })),
                }, { status: 409 });
            }

            if (existing.length > 0) {
                await db.delete(matches).where(inArray(matches.id, existing.map(m => m.id)));
            }
        }

        const updated = { status: 'DRAFT', publishedMatchIds: null, updatedAt: new Date() };
        await db.update(competitionDraws).set(updated).where(eq(competitionDraws.id, draw.id));

        return NextResponse.json({ draw: toDrawDTO({ ...draw, ...updated }) });
    } catch (err) {
        console.error('[competition draw publish DELETE] Error:', err);
        return NextResponse.json({ error: 'Failed to unpublish draw' }, { status: 500 });
    }
}
