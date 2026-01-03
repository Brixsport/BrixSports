/**
 * Team Form API
 * Get team form guide (last N matches)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teamForm, matches, teams } from '@/db/schema';
import { eq, desc, and, lt } from 'drizzle-orm';

/**
 * GET team form
 * GET /api/teams/[id]/form?competition=xxx&limit=5
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const teamId = params.id;
        const { searchParams } = new URL(request.url);
        const competition = searchParams.get('competition');
        const limit = parseInt(searchParams.get('limit') || '5');

        // Build query
        let query = db
            .select({
                form: teamForm,
                match: matches,
            })
            .from(teamForm)
            .leftJoin(matches, eq(teamForm.matchId, matches.id))
            .where(eq(teamForm.teamId, teamId))
            .orderBy(desc(teamForm.matchDate))
            .limit(limit);

        if (competition) {
            query = db
                .select({
                    form: teamForm,
                    match: matches,
                })
                .from(teamForm)
                .leftJoin(matches, eq(teamForm.matchId, matches.id))
                .where(
                    and(
                        eq(teamForm.teamId, teamId),
                        eq(teamForm.competition, competition)
                    )
                )
                .orderBy(desc(teamForm.matchDate))
                .limit(limit) as any;
        }

        const formData = await query;

        // Get team details
        const [team] = await db.select().from(teams).where(eq(teams.id, teamId));

        // Calculate form statistics
        const stats = {
            wins: formData.filter((f) => f.form?.result === 'W').length,
            draws: formData.filter((f) => f.form?.result === 'D').length,
            losses: formData.filter((f) => f.form?.result === 'L').length,
            goalsFor: formData.reduce((sum, f) => sum + (f.form?.goalsFor || 0), 0),
            goalsAgainst: formData.reduce((sum, f) => sum + (f.form?.goalsAgainst || 0), 0),
        };

        return NextResponse.json({
            team,
            form: formData.map((f) => ({
                ...f.form,
                match: f.match,
            })),
            stats,
        });
    } catch (error) {
        console.error('Error fetching team form:', error);
        return NextResponse.json(
            { error: 'Failed to fetch team form' },
            { status: 500 }
        );
    }
}

/**
 * ADD match to team form
 * POST /api/teams/[id]/form
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const teamId = params.id;
        const body = await request.json();
        const { matchId, competition, result, goalsFor, goalsAgainst, matchDate } = body;

        if (!matchId || !result || goalsFor === undefined || goalsAgainst === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Validate result
        if (!['W', 'D', 'L'].includes(result)) {
            return NextResponse.json(
                { error: 'Invalid result. Must be W, D, or L' },
                { status: 400 }
            );
        }

        // Create form entry
        const formId = `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(teamForm).values({
            id: formId,
            teamId,
            matchId,
            competition: competition || 'Unknown',
            result,
            goalsFor,
            goalsAgainst,
            matchDate: matchDate ? new Date(matchDate) : new Date(),
        });

        return NextResponse.json(
            {
                success: true,
                formId,
                message: 'Form entry added',
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error adding form entry:', error);
        return NextResponse.json(
            { error: 'Failed to add form entry' },
            { status: 500 }
        );
    }
}

/**
 * DELETE old form entries
 * DELETE /api/teams/[id]/form?before=timestamp
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const teamId = params.id;
        const { searchParams } = new URL(request.url);
        const before = searchParams.get('before');

        if (before) {
            const beforeDate = new Date(parseInt(before));
            await db
                .delete(teamForm)
                .where(
                    and(
                        eq(teamForm.teamId, teamId),
                        lt(teamForm.matchDate, beforeDate)
                    )
                );
        } else {
            // Delete all form entries for team
            await db
                .delete(teamForm)
                .where(eq(teamForm.teamId, teamId));
        }

        return NextResponse.json({
            success: true,
            message: 'Form entries deleted',
        });
    } catch (error) {
        console.error('Error deleting form entries:', error);
        return NextResponse.json(
            { error: 'Failed to delete form entries' },
            { status: 500 }
        );
    }
}
