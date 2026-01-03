/**
 * Competition Detail API
 * GET /api/competitions/[id]
 * 
 * Note: Competitions are stored as text fields in the current schema,
 * not as separate entities. This endpoint aggregates data by competition name.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, matches, standings, bracketNodes, competitions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

interface RouteParams {
    params: {
        id: string;
    };
}

/**
 * GET competition data by ID
 */
export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const competitionId = params.id;

        // Get competition from database
        const [competition] = await db
            .select()
            .from(competitions)
            .where(eq(competitions.id, competitionId));

        if (!competition) {
            // Fallback: try by name if ID is not a UUID (for backward compatibility)
            const [competitionByName] = await db
                .select()
                .from(competitions)
                .where(eq(competitions.name, decodeURIComponent(competitionId)));

            if (!competitionByName) {
                return NextResponse.json(
                    { error: 'Competition not found' },
                    { status: 404 }
                );
            }
            return NextResponse.json(competitionByName); // Simple return if found by name
        }

        const competitionName = competition.name;

        // Get matches for this competition
        const competitionMatches = await db
            .select()
            .from(matches)
            .where(eq(matches.competition, competitionName));

        // Get standings for this competition
        const competitionStandings = await db
            .select({
                standing: standings,
                team: teams,
            })
            .from(standings)
            .leftJoin(teams, eq(standings.teamId, teams.id))
            .where(eq(standings.competition, competitionName));

        // Get brackets (if tournament)
        const brackets = await db
            .select()
            .from(bracketNodes)
            .where(eq(bracketNodes.competition, competitionName));

        // Get unique teams from matches
        const teamIds = new Set<string>();
        competitionMatches.forEach(match => {
            teamIds.add(match.homeTeamId);
            teamIds.add(match.awayTeamId);
        });

        // Fetch team details if there are any teams
        let teamsData: any[] = [];
        if (teamIds.size > 0) {
            teamsData = await db
                .select()
                .from(teams)
                .where(sql`${teams.id} IN ${Array.from(teamIds)}`);
        }

        return NextResponse.json({
            competition: {
                ...competition,
                matchCount: competitionMatches.length,
                teamCount: teamIds.size,
            },
            teams: teamsData,
            matches: competitionMatches,
            standings: competitionStandings.map(s => ({
                ...s.standing,
                team: s.team,
            })),
            brackets: brackets.length > 0 ? brackets : null,
        });
    } catch (error) {
        console.error('Error fetching competition:', error);
        return NextResponse.json(
            { error: 'Failed to fetch competition' },
            { status: 500 }
        );
    }
}

/**
 * UPDATE competition
 * PATCH /api/competitions/[id]
 */
export async function PATCH(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const competitionId = params.id;
        const body = await request.json();

        const {
            name,
            sport,
            format,
            season,
            startDate,
            endDate,
            description,
            level,
            scope,
            rules,
            numberOfTeams,
            numberOfGroups,
            teamsPerGroup,
            status,
        } = body;

        // Check if competition exists
        const [existing] = await db
            .select()
            .from(competitions)
            .where(eq(competitions.id, competitionId));

        if (!existing) {
            return NextResponse.json(
                { error: 'Competition not found' },
                { status: 404 }
            );
        }

        // Build update object with only provided fields
        const updateData: any = {
            updatedAt: new Date(),
        };

        if (name !== undefined) updateData.name = name;
        if (sport !== undefined) updateData.sport = sport;
        if (format !== undefined) updateData.format = format;
        if (season !== undefined) updateData.season = season;
        if (startDate !== undefined) updateData.startDate = new Date(startDate);
        if (endDate !== undefined) updateData.endDate = new Date(endDate);
        if (description !== undefined) updateData.description = description;
        if (level !== undefined) updateData.level = level;
        if (scope !== undefined) updateData.scope = scope;
        if (rules !== undefined) updateData.rules = JSON.stringify(rules);
        if (numberOfTeams !== undefined) updateData.numberOfTeams = numberOfTeams;
        if (numberOfGroups !== undefined) updateData.numberOfGroups = numberOfGroups;
        if (teamsPerGroup !== undefined) updateData.teamsPerGroup = teamsPerGroup;
        if (status !== undefined) updateData.status = status;

        // Update competition
        await db
            .update(competitions)
            .set(updateData)
            .where(eq(competitions.id, competitionId));

        // Fetch updated competition
        const [updated] = await db
            .select()
            .from(competitions)
            .where(eq(competitions.id, competitionId));

        return NextResponse.json({
            success: true,
            competition: updated,
        });
    } catch (error) {
        console.error('Error updating competition:', error);
        return NextResponse.json(
            { error: 'Failed to update competition' },
            { status: 500 }
        );
    }
}

/**
 * DELETE competition
 * DELETE /api/competitions/[id]
 */
export async function DELETE(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const competitionId = params.id;

        // Check if competition exists
        const [existing] = await db
            .select()
            .from(competitions)
            .where(eq(competitions.id, competitionId));

        if (!existing) {
            return NextResponse.json(
                { error: 'Competition not found' },
                { status: 404 }
            );
        }

        // Delete competition
        await db
            .delete(competitions)
            .where(eq(competitions.id, competitionId));

        return NextResponse.json({
            success: true,
            message: 'Competition deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting competition:', error);
        return NextResponse.json(
            { error: 'Failed to delete competition' },
            { status: 500 }
        );
    }
}
