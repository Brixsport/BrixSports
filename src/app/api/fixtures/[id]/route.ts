/**
 * Fixture Detail API
 * PATCH /api/fixtures/[id] - Update a fixture
 * DELETE /api/fixtures/[id] - Delete a fixture
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams, matchEvents, standings } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
    params: {
        id: string;
    };
}

/**
 * PATCH - Update fixture details
 */
export async function PATCH(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const matchId = params.id;
        const body = await request.json();

        // Check if match exists
        const [existing] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId));

        if (!existing) {
            return NextResponse.json(
                { error: 'Fixture not found' },
                { status: 404 }
            );
        }

        // Build update object with only provided fields
        const updateData: any = {
            updatedAt: new Date(),
        };

        // Allow updating these fields
        const {
            sport,
            homeTeamId,
            awayTeamId,
            homeScore,
            awayScore,
            status,
            startTime,
            venue,
            competition,
            loggerId,
            stats,
            lineups,
        } = body;

        if (sport !== undefined) updateData.sport = sport;
        if (homeTeamId !== undefined) {
            // Validate team exists
            const [team] = await db.select().from(teams).where(eq(teams.id, homeTeamId));
            if (!team) {
                return NextResponse.json(
                    { error: 'Home team not found' },
                    { status: 404 }
                );
            }
            updateData.homeTeamId = homeTeamId;
        }
        if (awayTeamId !== undefined) {
            // Validate team exists
            const [team] = await db.select().from(teams).where(eq(teams.id, awayTeamId));
            if (!team) {
                return NextResponse.json(
                    { error: 'Away team not found' },
                    { status: 404 }
                );
            }
            updateData.awayTeamId = awayTeamId;
        }
        if (homeScore !== undefined) updateData.homeScore = homeScore;
        if (awayScore !== undefined) updateData.awayScore = awayScore;
        if (status !== undefined) updateData.status = status;
        if (startTime !== undefined) updateData.startTime = new Date(startTime);
        if (venue !== undefined) updateData.venue = venue;
        if (competition !== undefined) updateData.competition = competition;
        if (loggerId !== undefined) updateData.loggerId = loggerId;
        if (stats !== undefined) updateData.stats = JSON.stringify(stats);
        if (lineups !== undefined) updateData.lineups = JSON.stringify(lineups);

        // Validate teams are different if both are being updated
        const finalHomeTeamId = updateData.homeTeamId || existing.homeTeamId;
        const finalAwayTeamId = updateData.awayTeamId || existing.awayTeamId;

        if (finalHomeTeamId === finalAwayTeamId) {
            return NextResponse.json(
                { error: 'Home and away teams must be different' },
                { status: 400 }
            );
        }

        // Update the match
        await db
            .update(matches)
            .set(updateData)
            .where(eq(matches.id, matchId));

        // Fetch updated match with team details
        const [updatedMatch] = await db
            .select({
                match: matches,
                homeTeam: teams,
            })
            .from(matches)
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .where(eq(matches.id, matchId));

        // Get away team
        const [awayTeam] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, updatedMatch.match.awayTeamId));

        return NextResponse.json({
            success: true,
            match: {
                ...updatedMatch.match,
                homeTeam: updatedMatch.homeTeam,
                awayTeam,
            },
        });
    } catch (error) {
        console.error('Error updating fixture:', error);
        return NextResponse.json(
            { error: 'Failed to update fixture' },
            { status: 500 }
        );
    }
}

/**
 * DELETE - Delete a fixture
 */
export async function DELETE(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const matchId = params.id;

        // Check if match exists
        const [existing] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId));

        if (!existing) {
            return NextResponse.json(
                { error: 'Fixture not found' },
                { status: 404 }
            );
        }

        // Check if match has started (optional safety check)
        if (existing.status === 'LIVE' || existing.status === 'HALF_TIME') {
            return NextResponse.json(
                {
                    error: 'Cannot delete a match that is currently in progress',
                    hint: 'Please finish or cancel the match first'
                },
                { status: 400 }
            );
        }

        // Delete associated match events (cascade should handle this, but being explicit)
        await db
            .delete(matchEvents)
            .where(eq(matchEvents.matchId, matchId));

        // Delete the match
        await db
            .delete(matches)
            .where(eq(matches.id, matchId));

        return NextResponse.json({
            success: true,
            message: 'Fixture deleted successfully',
            deletedMatchId: matchId,
        });
    } catch (error) {
        console.error('Error deleting fixture:', error);
        return NextResponse.json(
            { error: 'Failed to delete fixture' },
            { status: 500 }
        );
    }
}
