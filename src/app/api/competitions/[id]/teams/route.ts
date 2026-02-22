import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, matches, competitions, standings, teamRegistrations } from '@/db/schema';
import { eq, or, inArray } from 'drizzle-orm';

/**
 * GET teams in a competition
 * GET /api/competitions/[id]/teams
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const competitionId = params.id;

        // 1. Get competition to find its name if ID was provided
        const [competition] = await db
            .select()
            .from(competitions)
            .where(eq(competitions.id, competitionId));

        const competitionName = competition ? competition.name : decodeURIComponent(competitionId);
        const actualId = competition ? competition.id : null;

        // 2. Collect unique team IDs and their groups from multiple sources
        const teamGroupMap = new Map<string, string | null>();

        // A. From Standings
        const competitionStandings = await db
            .select()
            .from(standings)
            .where(actualId
                ? or(eq(standings.competitionId, actualId), eq(standings.competition, competitionName))
                : eq(standings.competition, competitionName));

        competitionStandings.forEach(s => {
            teamGroupMap.set(s.teamId, s.groupName);
        });

        // B. From Matches
        const competitionMatches = await db
            .select()
            .from(matches)
            .where(actualId
                ? or(eq(matches.competitionId, actualId), eq(matches.competition, competitionName))
                : eq(matches.competition, competitionName));

        competitionMatches.forEach(match => {
            if (!teamGroupMap.has(match.homeTeamId)) teamGroupMap.set(match.homeTeamId, match.groupName);
            if (!teamGroupMap.has(match.awayTeamId)) teamGroupMap.set(match.awayTeamId, match.groupName);
        });

        // C. From Approved Registrations
        if (actualId) {
            const approvedRegistrations = await db
                .select()
                .from(teamRegistrations)
                .where(eq(teamRegistrations.competitionId, actualId));

            approvedRegistrations.forEach(reg => {
                if (reg.createdTeamId && !teamGroupMap.has(reg.createdTeamId)) {
                    teamGroupMap.set(reg.createdTeamId, null);
                }
            });
        }

        const teamIds = Array.from(teamGroupMap.keys());

        if (teamIds.length === 0) {
            return NextResponse.json({
                competition: {
                    id: actualId,
                    name: competitionName,
                    teamCount: 0,
                },
                teams: [],
            });
        }

        // 3. Fetch team details
        const teamsData = await db
            .select()
            .from(teams)
            .where(inArray(teams.id, teamIds));

        // 4. Merge group names into team data
        const enrichedTeams = teamsData.map(team => ({
            ...team,
            groupName: teamGroupMap.get(team.id) || null
        }));

        return NextResponse.json({
            competition: {
                id: actualId,
                name: competitionName,
                sport: competition ? competition.sport : (enrichedTeams[0]?.sport || 'Football'),
                teamCount: teamIds.length,
            },
            teams: enrichedTeams,
        });
    } catch (error) {
        console.error('Error fetching competition teams:', error);
        return NextResponse.json(
            { error: 'Failed to fetch teams' },
            { status: 500 }
        );
    }
}
