import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';

// Public DTO -- must never include CLAUDE.md's banned fields (loggerId,
// approvalStatus, managerNotes, approvedBy, approvedAt) or anything else not
// actually read by a real consumer. Field list verified against every known
// consumer of this route: src/app/page.tsx's transform map, src/app/football/page.tsx.
const PUBLIC_MATCH_FIELDS = {
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
    startTime: matches.startTime,
    venue: matches.venue,
    competition: matches.competition,
    competitionId: matches.competitionId,
    round: matches.round,
    stats: matches.stats,
};

// BACKLOG-465: fully public, identity-independent response -- safe to cache at
// the edge. 5s fresh + 10s stale-while-revalidate keeps live scores within the
// <=5s Flow C target's spirit while collapsing a burst of identical polls into
// ~1 origin hit per 5s per distinct query string. Errors are never cached.
const PUBLIC_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10' };
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };
// Generous on purpose: campus users share NAT egress IPs (many viewers, one IP).
const RATE_LIMIT_MAX_PER_MINUTE = 600;

export async function GET(request: Request) {
    try {
        const rl = await checkRateLimit(request, { max: RATE_LIMIT_MAX_PER_MINUTE });
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds), ...NO_STORE_HEADERS } }
            );
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // 'LIVE', 'FINISHED', 'UPCOMING'
        const competitionId = searchParams.get('competitionId');
        const competition = searchParams.get('competition');

        // Build query with conditional filters
        const conditions = [eq(matches.sport, 'Football')];
        if (status) conditions.push(eq(matches.status, status));
        if (competitionId) {
            // competitionId is authoritative when present -- do NOT OR it with a
            // name fallback. Two different competitions can legitimately share
            // an exact name (e.g. two seasons both literally named "BUSA LEAGUE
            // FOOTBALL"), and OR'ing in a name match even when a real id is
            // already known silently pulls in the other competition's matches
            // too the moment that name collision exists (confirmed live via the
            // sibling standings route, session 2026-09-05, once BACKLOG-291's
            // grouping fix made two same-named seasons reachable side by side).
            conditions.push(eq(matches.competitionId, competitionId));
        } else if (competition) {
            conditions.push(eq(matches.competition, competition));
        }

        const whereConditions = and(...conditions);

        // Get all football matches
        const footballMatches = await db
            .select(PUBLIC_MATCH_FIELDS)
            .from(matches)
            .where(whereConditions)
            .orderBy(desc(matches.createdAt))
            .limit(100)
            .all();

        // Fetch only the teams actually referenced, not the whole table.
        const teamIds = new Set<string>();
        footballMatches.forEach(m => {
            teamIds.add(m.homeTeamId);
            teamIds.add(m.awayTeamId);
        });

        const allTeams = teamIds.size > 0
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

        const teamMap = new Map(allTeams.map(t => [t.id, t]));

        // Transform the results
        const transformedMatches = footballMatches.map((match) => ({
            ...match,
            homeTeam: teamMap.get(match.homeTeamId),
            awayTeam: teamMap.get(match.awayTeamId),
        }));

        return NextResponse.json({
            success: true,
            matches: transformedMatches,
            count: transformedMatches.length,
        }, { headers: PUBLIC_CACHE_HEADERS });
    } catch (error) {
        console.error('Error fetching football matches:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch football matches' },
            { status: 500, headers: NO_STORE_HEADERS }
        );
    }
}
