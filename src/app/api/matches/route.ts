import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, matchEvents, teams } from '@/db/schema';
import { eq, and, inArray, or, desc } from 'drizzle-orm'; // inArray kept for teams fetch
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

        const authUser = await getAuthUser(request).catch(() => null);
        const isAdmin = authUser?.role === 'admin';

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

        // Fetch events for each match
        const matchesWithDetails = await Promise.all(
            allMatches.map(async (match) => {
                const events = await db.select().from(matchEvents).where(eq(matchEvents.matchId, match.id)).limit(200);
                const homeTeam = teamsMap.get(match.homeTeamId);
                const awayTeam = teamsMap.get(match.awayTeamId);

                const {
                    loggerId,
                    approvalStatus: _as,
                    managerNotes: _mn,
                    approvedBy: _ab,
                    approvedAt: _aa,
                    ...publicMatch
                } = match;

                return {
                    ...publicMatch,
                    ...(isAdmin && { loggerId }),
                    events,
                    stats: match.stats ? JSON.parse(match.stats) : {},
                    lineups: match.lineups ? JSON.parse(match.lineups) : null,
                    homeTeam: homeTeam ? {
                        name: homeTeam.name,
                        shortName: homeTeam.shortName,
                        logo: homeTeam.logo
                    } : null,
                    awayTeam: awayTeam ? {
                        name: awayTeam.name,
                        shortName: awayTeam.shortName,
                        logo: awayTeam.logo
                    } : null,
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
