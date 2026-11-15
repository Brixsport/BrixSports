import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';

// Fully public, identity-independent response -- safe to share at the edge.
// 15s fresh + 30s stale-while-revalidate: a stream going live/ending shows up
// within ~45s worst case (the client already polled every 30s), and a burst of
// viewers collapses into ~1 origin hit per 15s. Errors/429s are never cached.
const PUBLIC_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' };
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

// GET /api/livestreams/active - Get all active livestreams
export async function GET(request: NextRequest) {
    try {
        const rl = await checkRateLimit(request);
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds), ...NO_STORE_HEADERS } }
            );
        }

        const now = new Date();

        // Find all matches with active livestreams
        const activeStreams = await db
            .select({
                id: matches.id,
                sport: matches.sport,
                homeTeamId: matches.homeTeamId,
                awayTeamId: matches.awayTeamId,
                homeScore: matches.homeScore,
                awayScore: matches.awayScore,
                status: matches.status,
                startTime: matches.startTime,
                venue: matches.venue,
                competition: matches.competition,
                livestreamUrl: matches.livestreamUrl,
                livestreamType: matches.livestreamType,
                livestreamEnabled: matches.livestreamEnabled,
                livestreamStartTime: matches.livestreamStartTime,
                livestreamEndTime: matches.livestreamEndTime,
                livestreamViewers: matches.livestreamViewers,
                livestreamChatEnabled: matches.livestreamChatEnabled,
            })
            .from(matches)
            .where(
                and(
                    eq(matches.livestreamEnabled, true),
                    or(
                        eq(matches.status, 'LIVE'),
                        eq(matches.status, 'UPCOMING')
                    )
                )
            )
            .limit(50);

        // Filter by time and fetch team details
        const inWindow = activeStreams.filter(stream => {
            // Check if stream is within active time window
            const streamStart = stream.livestreamStartTime ? new Date(stream.livestreamStartTime) : null;
            const streamEnd = stream.livestreamEndTime ? new Date(stream.livestreamEndTime) : null;

            const isWithinTimeWindow =
                (!streamStart || streamStart <= now) &&
                (!streamEnd || streamEnd >= now);

            return stream.livestreamUrl && isWithinTimeWindow;
        });

        // One batched team lookup for every stream, instead of two sequential
        // queries per stream (was an N+1).
        const teamIds = new Set<string>();
        inWindow.forEach(s => {
            teamIds.add(s.homeTeamId);
            teamIds.add(s.awayTeamId);
        });
        const teamRows = teamIds.size > 0
            ? await db
                .select({
                    id: teams.id,
                    name: teams.name,
                    shortName: teams.shortName,
                    logo: teams.logo,
                    color: teams.color,
                })
                .from(teams)
                .where(inArray(teams.id, Array.from(teamIds)))
                .all()
            : [];
        const teamMap = new Map(teamRows.map(t => [t.id, t]));

        const activeStreamsWithTeams = inWindow.map(stream => {
            const homeTeam = teamMap.get(stream.homeTeamId);
            const awayTeam = teamMap.get(stream.awayTeamId);
            return {
                ...stream,
                homeTeam,
                awayTeam,
                matchTitle: `${homeTeam?.name} vs ${awayTeam?.name}`,
                isLive: stream.status === 'LIVE',
            };
        });

        // Sort by status (LIVE first) and then by start time
        const sortedStreams = activeStreamsWithTeams.sort((a, b) => {
            if (a.isLive && !b.isLive) return -1;
            if (!a.isLive && b.isLive) return 1;
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });

        return NextResponse.json({
            streams: sortedStreams,
            count: sortedStreams.length,
            liveCount: sortedStreams.filter(s => s.isLive).length,
        }, { headers: PUBLIC_CACHE_HEADERS });
    } catch (error) {
        console.error('Error fetching active livestreams:', error);
        return NextResponse.json(
            { error: 'Failed to fetch active livestreams' },
            { status: 500, headers: NO_STORE_HEADERS }
        );
    }
}
