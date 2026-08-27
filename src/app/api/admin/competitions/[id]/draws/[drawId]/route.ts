import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { competitionDraws, standings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { computeLeaguePhaseDraw, assignHomeAway, validateDraw } from '@/lib/competitionDraw';

const SUPPORTED_ALGORITHMS = ['POT_CIRCLE_V1'];

function toDrawDTO(row: typeof competitionDraws.$inferSelect) {
    return {
        ...row,
        seedOrder: JSON.parse(row.seedOrder),
        pots: row.pots ? JSON.parse(row.pots) : null,
        pairings: JSON.parse(row.pairings),
        publishedMatchIds: row.publishedMatchIds ? JSON.parse(row.publishedMatchIds) : null,
    };
}

async function getOwnedDraw(competitionId: string, drawId: string) {
    return db
        .select()
        .from(competitionDraws)
        .where(and(eq(competitionDraws.id, drawId), eq(competitionDraws.competitionId, competitionId)))
        .limit(1)
        .then(r => r[0] ?? null);
}

// GET — fetch a single draw
export async function GET(
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

        return NextResponse.json({ draw: toDrawDTO(draw) });
    } catch (err) {
        console.error('[competition draw GET] Error:', err);
        return NextResponse.json({ error: 'Failed to fetch draw' }, { status: 500 });
    }
}

// PATCH — re-order seeds and recompute (server-side re-validates on every edit).
// Refuses edits once PUBLISHED — a published draw's real fixtures live in
// `matches`; correcting it goes through the unpublish flow (BACKLOG-279), not this.
export async function PATCH(
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
        if (draw.status === 'PUBLISHED') {
            return NextResponse.json({ error: 'Cannot edit a published draw' }, { status: 409 });
        }

        const body = await req.json();
        const { seedOrder, pairingUpdates } = body;

        if (seedOrder !== undefined && pairingUpdates !== undefined) {
            return NextResponse.json({ error: 'Provide either seedOrder or pairingUpdates, not both' }, { status: 422 });
        }

        // pairingUpdates: targeted edits to an already-computed draw's per-match
        // scheduling (startTime/venue) or a home/away swap -- does NOT touch team
        // assignment or recompute the draw. Identified by (round, index), the
        // stable position the algorithm assigns each pairing.
        if (pairingUpdates !== undefined) {
            if (!Array.isArray(pairingUpdates) || pairingUpdates.length === 0) {
                return NextResponse.json({ error: 'pairingUpdates (non-empty array) is required' }, { status: 422 });
            }

            const currentPairings: Array<{ round: number; index: number; homeTeamId: string; awayTeamId: string; startTime?: string | null; venue?: string | null }> = JSON.parse(draw.pairings);
            const byKey = new Map(currentPairings.map(p => [`${p.round}:${p.index}`, p]));

            for (const upd of pairingUpdates) {
                const key = `${upd.round}:${upd.index}`;
                const pairing = byKey.get(key);
                if (!pairing) {
                    return NextResponse.json({ error: `No pairing found for round ${upd.round}, index ${upd.index}` }, { status: 422 });
                }
                if (upd.swapHomeAway) {
                    const tmp = pairing.homeTeamId;
                    pairing.homeTeamId = pairing.awayTeamId;
                    pairing.awayTeamId = tmp;
                }
                if (upd.startTime !== undefined) {
                    if (upd.startTime !== null && isNaN(new Date(upd.startTime).getTime())) {
                        return NextResponse.json({ error: `Invalid startTime for round ${upd.round}, index ${upd.index}: ${upd.startTime}` }, { status: 422 });
                    }
                    pairing.startTime = upd.startTime;
                }
                if (upd.venue !== undefined) {
                    pairing.venue = upd.venue;
                }
            }

            const updated = { pairings: JSON.stringify(currentPairings), updatedAt: new Date() };
            await db.update(competitionDraws).set(updated).where(eq(competitionDraws.id, draw.id));
            return NextResponse.json({ draw: toDrawDTO({ ...draw, ...updated }) });
        }

        if (!Array.isArray(seedOrder) || seedOrder.length === 0) {
            return NextResponse.json({ error: 'seedOrder (array of team IDs) is required' }, { status: 422 });
        }
        if (!SUPPORTED_ALGORITHMS.includes(draw.algorithm)) {
            return NextResponse.json({ error: `Unsupported algorithm on this draw: ${draw.algorithm}` }, { status: 422 });
        }
        if (new Set(seedOrder).size !== seedOrder.length) {
            return NextResponse.json({ error: 'seedOrder contains duplicate team IDs' }, { status: 422 });
        }

        const registeredTeams = await db
            .select({ teamId: standings.teamId })
            .from(standings)
            .where(eq(standings.competitionId, params.id));
        const registeredIds = new Set(registeredTeams.map(t => t.teamId));

        const missing = seedOrder.filter((id: string) => !registeredIds.has(id));
        if (missing.length > 0) {
            return NextResponse.json({ error: `seedOrder contains team(s) not registered to this competition: ${missing.join(', ')}` }, { status: 422 });
        }
        if (seedOrder.length !== registeredIds.size) {
            return NextResponse.json({
                error: `seedOrder has ${seedOrder.length} team(s), but this competition has ${registeredIds.size} registered`,
            }, { status: 422 });
        }

        let pairings, pots;
        try {
            const computed = computeLeaguePhaseDraw(seedOrder);
            pots = computed.pots;
            pairings = assignHomeAway(computed.pairings);
        } catch (err) {
            return NextResponse.json({ error: err instanceof Error ? err.message : 'Draw computation failed' }, { status: 422 });
        }

        const validation = validateDraw(seedOrder, pairings);
        if (!validation.valid) {
            console.error('[competition draw PATCH] recomputed draw failed validation:', validation.errors);
            return NextResponse.json({ error: 'Recomputed draw failed internal validation', details: validation.errors }, { status: 500 });
        }

        const updated = {
            seedOrder: JSON.stringify(seedOrder),
            pots: JSON.stringify(pots),
            pairings: JSON.stringify(pairings),
            updatedAt: new Date(),
        };
        await db.update(competitionDraws).set(updated).where(eq(competitionDraws.id, draw.id));

        return NextResponse.json({ draw: toDrawDTO({ ...draw, ...updated }) });
    } catch (err) {
        console.error('[competition draw PATCH] Error:', err);
        return NextResponse.json({ error: 'Failed to update draw' }, { status: 500 });
    }
}

// DELETE — refuses once PUBLISHED (its real fixtures live in `matches`;
// removing those is the unpublish flow's job, not a plain delete).
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
        if (draw.status === 'PUBLISHED') {
            return NextResponse.json({ error: 'Cannot delete a published draw' }, { status: 409 });
        }

        await db.delete(competitionDraws).where(eq(competitionDraws.id, draw.id));

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[competition draw DELETE] Error:', err);
        return NextResponse.json({ error: 'Failed to delete draw' }, { status: 500 });
    }
}
