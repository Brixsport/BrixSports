import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';

// GET /api/admin/assigned-matches - Get matches assigned to logger or all matches for admin
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser(request);

        if (!user || (user.role !== 'admin' && user.role !== 'logger')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            );
        }

        let matchesQuery;

        if (user.role === 'admin') {
            // Admins can see all upcoming and live matches
            matchesQuery = db
                .select()
                .from(matches)
                .where(
                    or(
                        eq(matches.status, 'UPCOMING'),
                        eq(matches.status, 'LIVE')
                    )
                )
                .orderBy(matches.startTime)
                .limit(50);
        } else {
            // Loggers can only see their assigned matches
            matchesQuery = db
                .select()
                .from(matches)
                .where(
                    and(
                        eq(matches.loggerId, user.id),
                        or(
                            eq(matches.status, 'UPCOMING'),
                            eq(matches.status, 'LIVE')
                        )
                    )
                )
                .orderBy(matches.startTime)
                .limit(50);
        }

        const matchesList = await matchesQuery;

        // Fetch team details for each match
        const matchesWithTeams = await Promise.all(
            matchesList.map(async (match) => {
                const [homeTeam, awayTeam] = await Promise.all([
                    db.select().from(teams).where(eq(teams.id, match.homeTeamId)).limit(1),
                    db.select().from(teams).where(eq(teams.id, match.awayTeamId)).limit(1)
                ]);

                return {
                    ...match,
                    homeTeam: homeTeam[0],
                    awayTeam: awayTeam[0]
                };
            })
        );

        return NextResponse.json({
            success: true,
            matches: matchesWithTeams
        });
    } catch (error) {
        console.error('Error fetching assigned matches:', error);
        return NextResponse.json(
            { error: 'Failed to fetch matches' },
            { status: 500 }
        );
    }
}
