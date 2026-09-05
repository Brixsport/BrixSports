
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { notInArray, eq, and, inArray } from 'drizzle-orm';

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

export async function GET(request: Request) {
    try {
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
        });
    } catch (error) {
        console.error('Error fetching other matches:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch matches' }, { status: 500 });
    }
}
