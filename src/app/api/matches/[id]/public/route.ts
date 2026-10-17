import { NextResponse } from 'next/server';
import { loadMatchDetail } from '@/lib/match-detail';
import { checkRateLimit } from '@/lib/rate-limit';

// Public match detail for the viewer match page (Flow C).
//
// Why a separate route: GET /api/matches/[id] reads the session to show logger names and draft
// lineups to staff, which makes its responses vary by cookie and so unusable for an edge cache.
// This route never calls getAuthUser and never reads cookies, so the CDN can serve one cached
// response to every viewer. The body is the same payload the viewer page already consumes,
// shaped for an anonymous caller: no logger identity on events, published lineups only, and no
// loggerId / approvalStatus / managerNotes / approvedBy / approvedAt on the match.
//
// 1s fresh plus 2s stale-while-revalidate keeps a score within about 3s of the database while
// collapsing a burst of identical polls into roughly one origin hit per second per region.
// Errors and 404s are never cached.
const PUBLIC_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=2' };
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };
// Generous on purpose: campus users share NAT egress IPs (many viewers, one IP).
const RATE_LIMIT_MAX_PER_MINUTE = 600;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const rl = await checkRateLimit(request, { max: RATE_LIMIT_MAX_PER_MINUTE });
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds), ...NO_STORE_HEADERS } }
            );
        }

        const { id: matchId } = await params;

        const detail = await loadMatchDetail(matchId, false);
        if (!detail) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404, headers: NO_STORE_HEADERS });
        }

        return NextResponse.json(detail, { headers: PUBLIC_CACHE_HEADERS });
    } catch (error) {
        console.error('Error fetching public match details:', error);
        return NextResponse.json({ error: 'Failed to fetch match details' }, { status: 500, headers: NO_STORE_HEADERS });
    }
}
