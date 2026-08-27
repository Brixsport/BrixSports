import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
    try {
        const rl = checkRateLimit(request);
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        // BACKLOG-283: same header pattern as /api/matches (BACKLOG-276), but
        // the default limit stays 500 (the pre-existing safety cap), NOT 50 --
        // ~10 other pages (match-creation team dropdowns, roster-transfers,
        // notifications composer, etc.) call this bare expecting the full
        // list, and team count realistically exceeds 50. Only a caller that
        // explicitly passes `limit` opts into a smaller page.
        const { searchParams } = new URL(request.url);
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '500', 10) || 500), 500);
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

        const [{ count: totalCount }] = await db.select({ count: sql<number>`count(*)` }).from(teams);
        const pagedTeams = await db.select().from(teams).limit(limit).offset(offset);

        return NextResponse.json(pagedTeams, {
            headers: {
                'X-Total-Count': String(totalCount),
                'X-Limit': String(limit),
                'X-Offset': String(offset),
            },
        });
    } catch (error) {
        console.error('Error fetching teams:', error);
        return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }
}

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
        const newTeam = await db.insert(teams).values(body).returning();
        return NextResponse.json(newTeam[0], { status: 201 });
    } catch (error) {
        console.error('Error creating team:', error);
        return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
    }
}
