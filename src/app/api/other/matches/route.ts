
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { notInArray, eq, and, inArray, desc } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';

// Public DTO -- must never include CLAUDE.md's banned fields (loggerId,
// approvalStatus, managerNotes, approvedBy, approvedAt) or anything else not
// actually read by a real consumer. Field list verified against every known
// consumer of this route: src/app/page.tsx's transform map.
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
        const competitionId = searchParams.get('competitionId');
        const competition = searchParams.get('competition');
        const status = searchParams.get('status');

        // Filter out Football and Basketball
        const sportsToExclude = ['Football', 'Basketball'];

        const conditions = [notInArray(matches.sport, sportsToExclude)];
        if (status) conditions.push(eq(matches.status, status));
        // competitionId is authoritative when present -- see BACKLOG-335.
        if (competitionId) {
            conditions.push(eq(matches.competitionId, competitionId));
        } else if (competition) {
            conditions.push(eq(matches.competition, competition));
        }

        const otherMatches = await db.select(PUBLIC_MATCH_FIELDS).from(matches)
            .where(and(...conditions))
            .orderBy(desc(matches.createdAt))
            .limit(100)
            .all();

        // Get team details -- only the teams actually referenced.
        const teamIds = new Set<string>();
        otherMatches.forEach(m => {
            teamIds.add(m.homeTeamId);
            teamIds.add(m.awayTeamId);
        });

        const allTeams = teamIds.size > 0
            ? await db.select({
                id: teams.id,
                name: teams.name,
                shortName: teams.shortName,
                logo: teams.logo,
                university: teams.university,
                color: teams.color,
            }).from(teams).where(inArray(teams.id, Array.from(teamIds))).all()
            : [];

        const teamMap = new Map(allTeams.map(t => [t.id, t]));

        const transformed = otherMatches.map(m => ({
            ...m,
            homeTeam: teamMap.get(m.homeTeamId),
            awayTeam: teamMap.get(m.awayTeamId)
        }));

        return NextResponse.json({
            success: true,
            matches: transformed,
            count: transformed.length
        }, { headers: PUBLIC_CACHE_HEADERS });
    } catch (error) {
        console.error('Error fetching other matches:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch matches' }, { status: 500, headers: NO_STORE_HEADERS });
    }
}
