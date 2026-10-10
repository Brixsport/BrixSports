import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userXI } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { readAnonymousId, getOrCreateAnonymousId } from '@/lib/anonymousIdentity';

const LIST_LIMIT = 50;

// GET /api/user/xi
// - ?mine=true  -> the caller's own teams (real account or anonymous device id), public or private
// - default     -> public teams only (the gallery's feed) -- BACKLOG-324: the old
//                  no-param branch returned every user's teams, private included
async function resolveOwnerFilter(request: NextRequest) {
    const authUser = await getAuthUser(request);
    if (authUser) return eq(userXI.userId, authUser.id);

    const anonId = readAnonymousId(request);
    if (!anonId) return null; // no identity yet -- caller has nothing saved
    return eq(userXI.anonymousId, anonId);
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const mine = searchParams.get('mine') === 'true';

        let teams;

        if (mine) {
            const ownerFilter = await resolveOwnerFilter(request);
            teams = ownerFilter
                ? await db
                    .select()
                    .from(userXI)
                    .where(ownerFilter)
                    .orderBy(desc(userXI.createdAt))
                    .limit(LIST_LIMIT)
                : [];
        } else {
            teams = await db
                .select()
                .from(userXI)
                .where(eq(userXI.isPublic, true))
                .orderBy(desc(userXI.createdAt))
                .limit(LIST_LIMIT);
        }

        return NextResponse.json({
            teams,
            total: teams.length,
        });
    } catch (error) {
        console.error('[User XI API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch teams' },
            { status: 500 }
        );
    }
}

// POST /api/user/xi - Create a new XI
// BACKLOG-324: owner identity is always server-derived -- a real session via
// getAuthUser, or a signed anonymous cookie -- never a client-passed userId.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, formation, players, isPublic } = body;

        if (!name || !formation || !players) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const response = new NextResponse();
        const authUser = await getAuthUser(request);
        const owner = authUser
            ? { userId: authUser.id, anonymousId: null }
            : { userId: null, anonymousId: getOrCreateAnonymousId(request, response) };

        const newXI = await db
            .insert(userXI)
            .values({
                id: `xi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                ...owner,
                name,
                formation,
                players: JSON.stringify(players),
                isPublic: isPublic || false,
                likes: 0,
                views: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning();

        return NextResponse.json(
            { success: true, xi: newXI[0] },
            { headers: response.headers }
        );
    } catch (error) {
        console.error('[User XI API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create XI' },
            { status: 500 }
        );
    }
}
