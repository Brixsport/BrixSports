import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { checkRateLimit } from '@/lib/rate-limit';

// Cheap, public, edge-cacheable list of every match's start time + status + sport, so the home
// feed's day strip can show every match day without loading every match. Raw startTime (not a
// server-sliced date) so the client derives local-time day keys the same way it does everywhere else.
const MAX_ROWS = 3000;
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' };
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
    try {
        const rl = await checkRateLimit(request, { max: 600 });
        if (rl.limited) {
            return NextResponse.json(
                { success: false, error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds), ...NO_STORE_HEADERS } }
            );
        }

        const rows = await db
            .select({ sport: matches.sport, status: matches.status, startTime: matches.startTime })
            .from(matches)
            .orderBy(matches.startTime)
            .limit(MAX_ROWS)
            .all();

        return NextResponse.json({ success: true, days: rows, count: rows.length }, { headers: CACHE_HEADERS });
    } catch (error) {
        console.error('Error fetching match days:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch match days' },
            { status: 500, headers: NO_STORE_HEADERS }
        );
    }
}
