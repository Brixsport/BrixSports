import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, matchEvents, teams } from '@/db/schema';
import { eq, and, inArray, or, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sport = searchParams.get('sport');
        const loggerId = searchParams.get('loggerId');
        const status = searchParams.get('status');
        const competitionId = searchParams.get('competitionId');
        const competition = searchParams.get('competition');

        let query = db.select().from(matches);

        const conditions = [];

        if (sport) conditions.push(eq(matches.sport, sport));
        if (loggerId) conditions.push(eq(matches.loggerId, loggerId));
        if (status) conditions.push(eq(matches.status, status));

        if (competitionId) {
            conditions.push(or(eq(matches.competitionId, competitionId), eq(matches.competition, competition || '')));
        } else if (competition) {
            conditions.push(eq(matches.competition, competition));
        }

        if (conditions.length > 0) {
            query = query.where(and(...conditions)) as typeof query;
        }

        const allMatches = await query.orderBy(desc(matches.createdAt)).limit(50);

        // Collect all unique team IDs
        const teamIds = new Set<string>();
        allMatches.forEach(match => {
            teamIds.add(match.homeTeamId);
            teamIds.add(match.awayTeamId);
        });

        // Fetch all related teams
        let teamsList: any[] = [];
        if (teamIds.size > 0) {
            teamsList = await db.select().from(teams).where(inArray(teams.id, Array.from(teamIds)));
        }

        // Create a map for quick access
        const teamsMap = new Map(teamsList.map(t => [t.id, t]));

        // Fetch assigned loggers for these matches
        const matchIds = allMatches.map(m => m.id);
        let assignmentsList: any[] = [];

        if (matchIds.length > 0) {
            // Import matchLoggerAssignments and loggers if not imported
            // Assuming they are available via '@/db/schema'
            const { matchLoggerAssignments, loggers } = await import('@/db/schema');

            assignmentsList = await db.select({
                matchId: matchLoggerAssignments.matchId,
                loggerId: loggers.id,
                name: loggers.name,
                role: matchLoggerAssignments.role,
                status: matchLoggerAssignments.status
            })
                .from(matchLoggerAssignments)
                .leftJoin(loggers, eq(matchLoggerAssignments.loggerId, loggers.id))
                .where(
                    and(
                        inArray(matchLoggerAssignments.matchId, matchIds),
                        eq(matchLoggerAssignments.status, 'active')
                    )
                );
        }

        // Group assignments by matchId
        const assignmentsMap = new Map<string, any[]>();
        assignmentsList.forEach(a => {
            if (!assignmentsMap.has(a.matchId)) {
                assignmentsMap.set(a.matchId, []);
            }
            if (a.loggerId) { // Ensure logger exists
                assignmentsMap.get(a.matchId)?.push({
                    id: a.loggerId,
                    name: a.name,
                    role: a.role
                });
            }
        });

        // Fetch events for each match (optional, keeping existing logic)
        // But optimizing to just attach teams first
        const matchesWithDetails = await Promise.all(
            allMatches.map(async (match) => {
                const events = await db.select().from(matchEvents).where(eq(matchEvents.matchId, match.id));
                const homeTeam = teamsMap.get(match.homeTeamId);
                const awayTeam = teamsMap.get(match.awayTeamId);
                const assignedLoggers = assignmentsMap.get(match.id) || [];

                return {
                    ...match,
                    events,
                    stats: match.stats ? JSON.parse(match.stats) : {},
                    lineups: match.lineups ? JSON.parse(match.lineups) : null,
                    assignedLoggers, // Add this field
                    loggerId: assignedLoggers.length > 0 ? assignedLoggers[0].id : match.loggerId, // Fallback for backward compat
                    homeTeam: homeTeam ? {
                        name: homeTeam.name,
                        shortName: homeTeam.shortName,
                        logo: homeTeam.logo
                    } : null,
                    awayTeam: awayTeam ? {
                        name: awayTeam.name,
                        shortName: awayTeam.shortName,
                        logo: awayTeam.logo
                    } : null
                };
            })
        );

        return NextResponse.json(matchesWithDetails);
    } catch (error) {
        console.error('Error fetching matches:', error);
        return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { stats, lineups, ...matchData } = body;

        // Ensure competition is never null/empty (database requires NOT NULL)
        // For friendly matches, use friendlyDescription or default to 'Friendly'
        const competition = matchData.competition?.trim() ||
            (matchData.matchType === 'friendly'
                ? (matchData.friendlyDescription?.trim() || 'Friendly')
                : 'Unknown');

        matchData.competitionId = matchData.competitionId || null;

        const newMatch = await db.insert(matches).values({
            ...matchData,
            competition,
            stats: stats ? JSON.stringify(stats) : null,
            lineups: lineups ? JSON.stringify(lineups) : null,
        }).returning();

        return NextResponse.json(newMatch[0], { status: 201 });
    } catch (error) {
        console.error('Error creating match:', error);
        return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
    }
}
