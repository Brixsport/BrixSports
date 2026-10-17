import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';

// Public list of matches that are LIVE right now, across every sport, for the /live page (Flow C).
//
// Why a separate route: /api/matches reads the session (admin enrichment), which makes its responses
// vary by cookie and so unusable for an edge cache. This route is identity-independent on purpose: it
// never calls getAuthUser and never reads cookies, so the CDN can serve one cached response to every
// viewer. 2s fresh + 3s stale-while-revalidate keeps a score within about 5s of the database while
// collapsing a burst of identical polls into roughly one origin hit per 2s per region. Errors are never cached.
//
// Public DTO: no loggerId / approvalStatus / managerNotes / approvedBy / approvedAt, and no raw `stats` JSON.
const PUBLIC_LIVE_FIELDS = {
    id: matches.id,
    sport: matches.sport,
    homeTeamId: matches.homeTeamId,
    awayTeamId: matches.awayTeamId,
    homeScore: matches.homeScore,
    awayScore: matches.awayScore,
    shootoutHomeScore: matches.shootoutHomeScore,
    shootoutAwayScore: matches.shootoutAwayScore,
    status: matches.status,
    currentPeriod: matches.currentPeriod,
    minute: matches.minute,
    extraTime: matches.extraTime,
    startTime: matches.startTime,
    venue: matches.venue,
    competition: matches.competition,
    competitionId: matches.competitionId,
    round: matches.round,
};

const PUBLIC_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=3' };
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };
// Generous on purpose: campus users share NAT egress IPs (many viewers, one IP).
const RATE_LIMIT_MAX_PER_MINUTE = 600;
const MAX_LIVE_MATCHES = 100;

export async function GET(request: Request) {
    try {
        const rl = await checkRateLimit(request, { max: RATE_LIMIT_MAX_PER_MINUTE });
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds), ...NO_STORE_HEADERS } }
            );
        }

        const liveMatches = await db
            .select(PUBLIC_LIVE_FIELDS)
            .from(matches)
            .where(eq(matches.status, 'LIVE'))
            .orderBy(desc(matches.createdAt))
            .limit(MAX_LIVE_MATCHES)
            .all();

        const teamIds = new Set<string>();
        liveMatches.forEach((m) => {
            teamIds.add(m.homeTeamId);
            teamIds.add(m.awayTeamId);
        });

        const teamRows = teamIds.size > 0
            ? await db
                .select({
                    id: teams.id,
                    name: teams.name,
                    shortName: teams.shortName,
                    logo: teams.logo,
                    university: teams.university,
                    color: teams.color,
                })
                .from(teams)
                .where(inArray(teams.id, Array.from(teamIds)))
                .all()
            : [];
        const teamMap = new Map(teamRows.map((t) => [t.id, t]));

        // Bare array, the same shape /live already consumes from /api/matches?status=LIVE.
        return NextResponse.json(
            liveMatches.map((m) => ({
                ...m,
                homeTeam: teamMap.get(m.homeTeamId),
                awayTeam: teamMap.get(m.awayTeamId),
            })),
            { headers: PUBLIC_CACHE_HEADERS }
        );
    } catch (error) {
        console.error('Error fetching live matches:', error);
        return NextResponse.json({ error: 'Failed to fetch live matches' }, { status: 500, headers: NO_STORE_HEADERS });
    }
}
