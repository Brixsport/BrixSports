import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { eq, and, inArray, or, desc, sql } from 'drizzle-orm'; // inArray kept for teams fetch
import { getAuthUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { playerRatings } from '@/db/schema-ratings';

// BACKLOG-258: explicit allow-list, not `db.select()` (full row). Every
// matches column except the CLAUDE.md-banned four (approvalStatus,
// managerNotes, approvedBy, approvedAt) plus lineups (dropped from the list
// response separately -- no list consumer reads it, and it can be a large
// JSON blob). loggerId is selected here and conditionally stripped per-request
// below (admin-only), same behavior as before this change, just moved out of
// the JS destructure and into the query itself -- also retires BACKLOG-174's
// fragility concern for this file: a newly added sensitive column is absent
// by default instead of leaking until someone remembers to exclude it.
const MATCH_LIST_FIELDS = {
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
    competitionId: matches.competitionId,
    matchType: matches.matchType,
    competitionLevel: matches.competitionLevel,
    friendlyType: matches.friendlyType,
    friendlyDescription: matches.friendlyDescription,
    loggerId: matches.loggerId,
    stats: matches.stats,
    highlightsUrl: matches.highlightsUrl,
    livestreamUrl: matches.livestreamUrl,
    livestreamType: matches.livestreamType,
    livestreamEnabled: matches.livestreamEnabled,
    livestreamStartTime: matches.livestreamStartTime,
    round: matches.round,
    matchday: matches.matchday,
    groupName: matches.groupName,
    livestreamEndTime: matches.livestreamEndTime,
    livestreamViewers: matches.livestreamViewers,
    livestreamChatEnabled: matches.livestreamChatEnabled,
    livestreamChatUrl: matches.livestreamChatUrl,
    penaltiesEnabledOverride: matches.penaltiesEnabledOverride,
    allowDrawsOverride: matches.allowDrawsOverride,
    extraTimeEnabledOverride: matches.extraTimeEnabledOverride,
    currentPeriod: matches.currentPeriod,
    minute: matches.minute,
    extraTime: matches.extraTime,
    shootoutHomeScore: matches.shootoutHomeScore,
    shootoutAwayScore: matches.shootoutAwayScore,
    createdAt: matches.createdAt,
    updatedAt: matches.updatedAt,
};

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
        const includeRatingsStatus = searchParams.get('includeRatingsStatus') === '1';
        const sport = searchParams.get('sport');
        const loggerId = searchParams.get('loggerId');
        const status = searchParams.get('status');
        const competitionId = searchParams.get('competitionId');
        const competition = searchParams.get('competition');
        const matchday = searchParams.get('matchday');
        const round = searchParams.get('round');
        // BACKLOG-276: the generic default-50-most-recent window can push a
        // specific competition's own matches out entirely once other
        // competitions are active -- matchday/round let a caller ask for an
        // exact slice instead of relying on recency. Clamp pattern matches
        // the rest of the codebase (BACKLOG-169).
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50), 200);
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

        let query = db.select(MATCH_LIST_FIELDS).from(matches);
        let countQuery = db.select({ count: sql<number>`count(*)` }).from(matches);

        const conditions = [];

        if (sport) conditions.push(eq(matches.sport, sport));
        if (loggerId) conditions.push(eq(matches.loggerId, loggerId));
        if (status) conditions.push(eq(matches.status, status));
        if (matchday) conditions.push(eq(matches.matchday, parseInt(matchday, 10)));
        if (round) conditions.push(eq(matches.round, round));

        if (competitionId) {
            conditions.push(or(eq(matches.competitionId, competitionId), eq(matches.competition, competition || '')));
        } else if (competition) {
            conditions.push(eq(matches.competition, competition));
        }

        if (conditions.length > 0) {
            query = query.where(and(...conditions)) as typeof query;
            countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
        }

        // Total count for pagination UI -- a separate lightweight query rather
        // than changing the response body shape (many admin pages consume this
        // route as a bare array today; a header keeps them working unchanged).
        const [{ count: totalCount }] = await countQuery;

        const allMatches = await query.orderBy(desc(matches.createdAt)).limit(limit).offset(offset);

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

        // BACKLOG-254: admin/match-ratings/page.tsx's hasRatings/ratingsCount badge
        // was always false -- no route ever set those fields. Admin-only, opt-in
        // (not part of every /api/matches response) to keep this generic list route's
        // default shape unchanged for its many other consumers.
        let ratingsCountByMatchId = new Map<string, number>();
        if (includeRatingsStatus && isAdmin && allMatches.length > 0) {
            const ratingRows = await db
                .select({
                    matchId: playerRatings.matchId,
                    count: sql<number>`count(*)`,
                })
                .from(playerRatings)
                .where(inArray(playerRatings.matchId, allMatches.map(m => m.id)))
                .groupBy(playerRatings.matchId);
            ratingsCountByMatchId = new Map(ratingRows.map(r => [r.matchId, Number(r.count)]));
        }

        // BACKLOG-258: no per-match events fetch here anymore -- no list
        // consumer read the `events` key (grep-confirmed; LiveUpdates.tsx
        // actually calls /api/matches/[id]/events, a different route), and it
        // was up to 200 rows fetched and serialized per match in the list.
        // Same for `lineups`: no list consumer reads it either.
        const matchesWithDetails = allMatches.map((match) => {
            const homeTeam = teamsMap.get(match.homeTeamId);
            const awayTeam = teamsMap.get(match.awayTeamId);

            const { loggerId, ...publicMatch } = match;

            // Same crash class as BACKLOG-312 -- an uncaught JSON.parse here would
            // 500 the whole list (this route backs the public /live page, Flow C)
            // for every match, not just the one with malformed stats.
            let parsedStats: Record<string, unknown> = {};
            if (match.stats) {
                try {
                    parsedStats = JSON.parse(match.stats);
                } catch (e) {
                    console.error(`Error parsing stats for match ${match.id}:`, e);
                }
            }

            return {
                ...publicMatch,
                ...(isAdmin && { loggerId }),
                ...(includeRatingsStatus && isAdmin && {
                    hasRatings: (ratingsCountByMatchId.get(match.id) ?? 0) > 0,
                    ratingsCount: ratingsCountByMatchId.get(match.id) ?? 0,
                }),
                stats: parsedStats,
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
        });

        return NextResponse.json(matchesWithDetails, {
            headers: {
                'X-Total-Count': String(totalCount),
                'X-Limit': String(limit),
                'X-Offset': String(offset),
            },
        });
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
