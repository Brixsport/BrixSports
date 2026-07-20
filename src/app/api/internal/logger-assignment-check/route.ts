import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchLoggerAssignments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.WS_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    const loggerId = searchParams.get('loggerId');

    if (!matchId || !loggerId) {
        return NextResponse.json({ error: 'matchId and loggerId are required' }, { status: 400 });
    }

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
}
