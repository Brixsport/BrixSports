import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { matches, matchLoggerAssignments, teams } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

// ~a full season of upcoming fixtures; the old 50 silently hid later ones from lineup posting.
const ASSIGNED_MATCHES_LIMIT = 200;

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
                        eq(matches.status, 'LIVE'),
                        eq(matches.status, 'HALF_TIME')
                    )
                )
                .orderBy(matches.startTime)
                .limit(ASSIGNED_MATCHES_LIMIT);
        } else {
            // Loggers can only see their assigned matches (assignment table, not the
            // legacy matches.loggerId column)
            matchesQuery = db
                .select()
                .from(matches)
                .where(
                    and(
                        inArray(
                            matches.id,
                            db
                                .select({ matchId: matchLoggerAssignments.matchId })
                                .from(matchLoggerAssignments)
                                .where(
                                    and(
                                        eq(matchLoggerAssignments.loggerId, user.id),
                                        eq(matchLoggerAssignments.status, 'active')
                                    )
                                )
                        ),
                        or(
                            eq(matches.status, 'UPCOMING'),
                            eq(matches.status, 'LIVE'),
                            eq(matches.status, 'HALF_TIME')
                        )
                    )
                )
                .orderBy(matches.startTime)
                .limit(ASSIGNED_MATCHES_LIMIT);
        }

        const matchesList = await matchesQuery;

        // One team query for the whole list (was 2 queries per match, which a 200-row window would multiply).
        const teamIds = [...new Set(matchesList.flatMap(m => [m.homeTeamId, m.awayTeamId]))];
        const teamRows = teamIds.length > 0
            ? await db.select().from(teams).where(inArray(teams.id, teamIds)).limit(teamIds.length)
            : [];
        const teamById = new Map(teamRows.map(t => [t.id, t]));
        const matchesWithTeams = matchesList.map(match => ({
            ...match,
            homeTeam: teamById.get(match.homeTeamId),
            awayTeam: teamById.get(match.awayTeamId),
        }));

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
