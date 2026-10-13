import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchLoggerAssignments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { env as appEnv } from '@/lib/env';
import { isAuthorizedApiKey } from '@/lib/api-key-guard';

// GET /api/internal/logger-assignment-check?matchId=X&loggerId=Y
// Server-to-server only (ws-server -> Vercel, opposite direction from
// src/lib/socket.ts's Vercel -> ws-server /broadcast call) -- reuses the
// same WS_API_KEY shared secret rather than adding a new one.
//
// Single-writer enforcement (BUG-120's follow-up, SYSTEM_CRITICALITY_MAP.md
// §5 / LIVE_CLOCK_V2_ARCHITECTURE.md §5) needs to know whether a socket
// claiming to be a logger is actually assigned to the specific match it's
// trying to control the clock for -- BUG-120's JWT check only proved "this
// is a real logged-in logger," not "assigned to this match." Same
// assignment check POST /api/matches/[id]/events already does for
// persistence, exposed here for ws-server to call once per (socket,
// matchId) pair and cache -- not a per-emit DB hit.
export async function GET(request: NextRequest) {
    // Fails closed: with WS_API_KEY unset or empty every request is rejected.
    if (!isAuthorizedApiKey(request.headers.get('x-api-key'), appEnv.wsApiKey)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    const loggerId = searchParams.get('loggerId');

    if (!matchId || !loggerId) {
        return NextResponse.json({ error: 'matchId and loggerId are required' }, { status: 400 });
    }

    // A database error must come back as JSON 500, never an HTML error page: the ws-server tells
    // "not assigned" (200) apart from "could not check" (non-2xx) and only trusts the former.
    try {
        const [assignment] = await db
            .select({ id: matchLoggerAssignments.id })
            .from(matchLoggerAssignments)
            .where(
                and(
                    eq(matchLoggerAssignments.matchId, matchId),
                    eq(matchLoggerAssignments.loggerId, loggerId),
                    eq(matchLoggerAssignments.status, 'active')
                )
            )
            .limit(1);

        return NextResponse.json({ assigned: !!assignment });
    } catch (error) {
        console.error('[logger-assignment-check] lookup failed:', error);
        return NextResponse.json({ error: 'Assignment check failed' }, { status: 500 });
    }
}
