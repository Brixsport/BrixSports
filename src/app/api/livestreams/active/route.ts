import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { eq, and, lte, gte, or } from 'drizzle-orm';

// GET /api/livestreams/active - Get all active livestreams
export async function GET(request: NextRequest) {
    try {
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
            );

        // Filter by time and fetch team details
        const activeStreamsWithTeams = await Promise.all(
            activeStreams
                .filter(stream => {
                    // Check if stream is within active time window
                    const streamStart = stream.livestreamStartTime ? new Date(stream.livestreamStartTime) : null;
                    const streamEnd = stream.livestreamEndTime ? new Date(stream.livestreamEndTime) : null;

                    const isWithinTimeWindow =
                        (!streamStart || streamStart <= now) &&
                        (!streamEnd || streamEnd >= now);

                    return stream.livestreamUrl && isWithinTimeWindow;
                })
                .map(async (stream) => {
                    // Fetch team details
                    const homeTeam = await db.query.teams.findFirst({
                        where: eq(teams.id, stream.homeTeamId),
                        columns: {
                            id: true,
                            name: true,
                            shortName: true,
                            logo: true,
                            color: true,
                        }
                    });

                    const awayTeam = await db.query.teams.findFirst({
                        where: eq(teams.id, stream.awayTeamId),
                        columns: {
                            id: true,
                            name: true,
                            shortName: true,
                            logo: true,
                            color: true,
                        }
                    });

                    return {
                        ...stream,
                        homeTeam,
                        awayTeam,
                        matchTitle: `${homeTeam?.name} vs ${awayTeam?.name}`,
                        isLive: stream.status === 'LIVE',
                    };
                })
        );

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
        });
    } catch (error) {
        console.error('Error fetching active livestreams:', error);
        return NextResponse.json(
            { error: 'Failed to fetch active livestreams' },
            { status: 500 }
        );
    }
}
