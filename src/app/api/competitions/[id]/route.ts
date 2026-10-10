/**
 * Competition Detail API
 * GET /api/competitions/[id]
 * 
 * Note: Competitions are stored as text fields in the current schema,
 * not as separate entities. This endpoint aggregates data by competition name.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, matches, standings, bracketNodes, competitions, organizations } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

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

        // competitionId is authoritative -- do NOT OR it with a name fallback
        // (BACKLOG-335: two real competitions can share an exact name, and
        // OR'ing in a name match even when a real id is known silently pulls
        // in the other competition's matches/standings/brackets too).

        // Get matches for this competition
        const competitionMatches = await db
            .select()
            .from(matches)
            .where(eq(matches.competitionId, competition.id));

        // Get standings for this competition
        const competitionStandings = await db
            .select({
                standing: standings,
                team: teams,
            })
            .from(standings)
            .leftJoin(teams, eq(standings.teamId, teams.id))
            .where(eq(standings.competitionId, competition.id));

        // Get brackets (if tournament)
        const brackets = await db
            .select()
            .from(bracketNodes)
            .where(eq(bracketNodes.competitionId, competition.id));

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
            matches: competitionMatches.map(m => ({
                id: m.id,
                sport: m.sport,
                homeTeamId: m.homeTeamId,
                awayTeamId: m.awayTeamId,
                homeScore: m.homeScore,
                awayScore: m.awayScore,
                status: m.status,
                startTime: m.startTime,
                venue: m.venue,
                competition: m.competition,
                competitionId: m.competitionId,
                matchType: m.matchType,
                competitionLevel: m.competitionLevel,
            })),
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
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const competitionId = params.id;
        const body = await request.json();

        const {
            name,
            sport,
            format,
            structure,
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
            isMultiSport,
            logo,
            hostOrganizationId,
            governingOrganizationId,
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
        if (structure !== undefined) updateData.structure = structure || null;
        if (season !== undefined) updateData.season = season;
        // Bundled review finding (2026-09-09): an unparseable startDate/endDate
        // previously became an Invalid Date object written straight through (or
        // threw at insert, surfacing as an unhelpful generic 500) -- same class as
        // BACKLOG-343's openEditModal/handleUpdate crash on the client side.
        if (startDate !== undefined) {
            const parsedStart = new Date(startDate);
            if (isNaN(parsedStart.getTime())) {
                return NextResponse.json({ error: 'Invalid startDate' }, { status: 422 });
            }
            updateData.startDate = parsedStart;
        }
        if (endDate !== undefined) {
            const parsedEnd = new Date(endDate);
            if (isNaN(parsedEnd.getTime())) {
                return NextResponse.json({ error: 'Invalid endDate' }, { status: 422 });
            }
            updateData.endDate = parsedEnd;
        }
        if (description !== undefined) updateData.description = description;
        if (level !== undefined) updateData.level = level;
        if (scope !== undefined) updateData.scope = scope;
        if (rules !== undefined) updateData.rules = JSON.stringify(rules);
        if (numberOfTeams !== undefined) updateData.numberOfTeams = numberOfTeams;
        if (numberOfGroups !== undefined) updateData.numberOfGroups = numberOfGroups;
        if (teamsPerGroup !== undefined) updateData.teamsPerGroup = teamsPerGroup;
        if (status !== undefined) updateData.status = status;
        if (isMultiSport !== undefined) updateData.isMultiSport = isMultiSport;
        if (logo !== undefined) updateData.logo = logo;
        // BACKLOG-333: no UI sets these yet (no selector exists -- see route.ts's
        // POST handler for the full TODO), but accepting them here means a future
        // selector needs no further route changes, just a form field wired to it.
        // Bundled review finding (2026-09-09): no existence check on either id --
        // same gap as the POST handler, closed the same way here.
        if (hostOrganizationId !== undefined) {
            const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, hostOrganizationId)).limit(1);
            if (!org) return NextResponse.json({ error: 'Invalid hostOrganizationId: organization not found' }, { status: 422 });
            updateData.hostOrganizationId = hostOrganizationId;
        }
        if (governingOrganizationId !== undefined) {
            const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, governingOrganizationId)).limit(1);
            if (!org) return NextResponse.json({ error: 'Invalid governingOrganizationId: organization not found' }, { status: 422 });
            updateData.governingOrganizationId = governingOrganizationId;
        }

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
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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
