import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { competitions, standings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { createKnockoutStructure, type QuarterFinalSlot } from '@/lib/bracketService';

// POST — one-shot manual creation of the top-8 knockout bracket (QF x4 -> SF
// x2 -> 3rd Place + Final). Competition-agnostic; not BUSA-specific. Existing
// state can be read via the already-public GET /api/brackets?competitionId=.
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
            .select({ id: competitions.id, name: competitions.name, sport: competitions.sport })
            .from(competitions)
            .where(eq(competitions.id, params.id))
            .limit(1)
            .then(r => r[0] ?? null);
        if (!comp) {
            return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
        }

        const body = await req.json();
        const { qf } = body;

        if (!Array.isArray(qf) || qf.length !== 4) {
            return NextResponse.json({ error: 'qf must be an array of exactly 4 pairings' }, { status: 422 });
        }

        const allTeamIds: string[] = [];
        for (let i = 0; i < 4; i++) {
            const slot = qf[i];
            if (!slot?.homeTeamId || !slot?.awayTeamId) {
                return NextResponse.json({ error: `QF ${i + 1} is missing a team` }, { status: 422 });
            }
            if (!slot?.startTime || !slot?.venue) {
                return NextResponse.json({ error: `QF ${i + 1} is missing a startTime and/or venue` }, { status: 422 });
            }
            if (isNaN(new Date(slot.startTime).getTime())) {
                return NextResponse.json({ error: `QF ${i + 1} has an invalid startTime` }, { status: 422 });
            }
            allTeamIds.push(slot.homeTeamId, slot.awayTeamId);
        }

        if (new Set(allTeamIds).size !== 8) {
            return NextResponse.json({ error: 'The 8 QF slots must be 8 distinct teams' }, { status: 422 });
        }

        const registeredTeams = await db
            .select({ teamId: standings.teamId })
            .from(standings)
            .where(eq(standings.competitionId, params.id));
        const registeredIds = new Set(registeredTeams.map(t => t.teamId));
        const unregistered = allTeamIds.filter(id => !registeredIds.has(id));
        if (unregistered.length > 0) {
            return NextResponse.json({ error: `Team(s) not registered to this competition: ${unregistered.join(', ')}` }, { status: 422 });
        }

        const qfSlots = qf.map((s: QuarterFinalSlot) => ({
            homeTeamId: s.homeTeamId,
            awayTeamId: s.awayTeamId,
            startTime: new Date(s.startTime).toISOString(),
            venue: s.venue,
        })) as [QuarterFinalSlot, QuarterFinalSlot, QuarterFinalSlot, QuarterFinalSlot];

        const result = await createKnockoutStructure({
            competitionId: comp.id,
            competition: comp.name,
            sport: comp.sport ?? 'Football',
            qf: qfSlots,
        });

        return NextResponse.json({ success: true, ...result }, { status: 201 });
    } catch (err) {
        if (err instanceof Error && err.message.includes('already exists')) {
            return NextResponse.json({ error: err.message }, { status: 409 });
        }
        console.error('[knockout POST] Error:', err);
        return NextResponse.json({ error: 'Failed to create knockout bracket' }, { status: 500 });
    }
}
