import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { competitionDraws, competitions, standings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { nanoid } from 'nanoid';
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

// GET — list draws for a competition
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authUser = await getAuthUser(req);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');

        const conditions = [eq(competitionDraws.competitionId, params.id)];
        if (status) conditions.push(eq(competitionDraws.status, status));

        const rows = await db
            .select()
            .from(competitionDraws)
            .where(and(...conditions))
            .limit(50);

        return NextResponse.json({ draws: rows.map(toDrawDTO) });
    } catch (err) {
        console.error('[competition draws GET] Error:', err);
        return NextResponse.json({ error: 'Failed to fetch draws' }, { status: 500 });
    }
}

// POST — compute and persist a new DRAFT draw for a competition
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authUser = await getAuthUser(req);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const comp = await db
            .select({ id: competitions.id, sport: competitions.sport })
            .from(competitions)
            .where(eq(competitions.id, params.id))
            .limit(1)
            .then(r => r[0] ?? null);

        if (!comp) {
            return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
        }

        const body = await req.json();
        const { seedOrder, algorithm = 'POT_CIRCLE_V1' } = body;

        if (!Array.isArray(seedOrder) || seedOrder.length === 0) {
            return NextResponse.json({ error: 'seedOrder (array of team IDs) is required' }, { status: 422 });
        }
        if (!SUPPORTED_ALGORITHMS.includes(algorithm)) {
            return NextResponse.json({ error: `Unsupported algorithm: ${algorithm}` }, { status: 422 });
        }
        if (new Set(seedOrder).size !== seedOrder.length) {
            return NextResponse.json({ error: 'seedOrder contains duplicate team IDs' }, { status: 422 });
        }

        // Roster source of truth is `standings`, not `competitionTeamEntries`
        // (BACKLOG-267 correction — the admin match-creation form's own
        // GET /api/competitions/[id]/teams reads standings -> matches ->
        // teamRegistrations and never touches competitionTeamEntries).
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
            console.error('[competition draws POST] computed draw failed validation:', validation.errors);
            return NextResponse.json({ error: 'Computed draw failed internal validation', details: validation.errors }, { status: 500 });
        }

        const now = new Date();
        const row = {
            id: `draw_${nanoid()}`,
            competitionId: params.id,
            sport: comp.sport ?? 'Football',
            algorithm,
            seedOrder: JSON.stringify(seedOrder),
            pots: JSON.stringify(pots),
            pairings: JSON.stringify(pairings),
            status: 'DRAFT',
            publishedMatchIds: null,
            createdBy: authUser.id,
            createdAt: now,
            updatedAt: now,
        };

        await db.insert(competitionDraws).values(row);

        return NextResponse.json({ draw: toDrawDTO(row as typeof competitionDraws.$inferSelect) }, { status: 201 });
    } catch (err) {
        console.error('[competition draws POST] Error:', err);
        return NextResponse.json({ error: 'Failed to create draw' }, { status: 500 });
    }
}
