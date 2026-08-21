import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, competitions, squadPlayers } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

// GET /api/matches/[id]/lineup - Get lineup for a match
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const matchId = params.id;

        const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

        if (!match || match.length === 0) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        let lineups = null;
        if (match[0].lineups) {
            try {
                lineups = JSON.parse(match[0].lineups as string);
            } catch (e) {
                console.error('Error parsing lineups JSON:', e);
            }
        }

        // BUG-221: unpublished drafts are only visible to admin/logger. Public
        // viewers (and any unauthenticated caller) only ever see published lineups.
        const authUser = await getAuthUser(request).catch(() => null);
        const canViewDrafts = authUser?.role === 'admin' || authUser?.role === 'logger';
        if (lineups && !canViewDrafts) {
            lineups = Object.fromEntries(
                Object.entries(lineups).filter(([, teamLineup]) => (teamLineup as any)?.status === 'published')
            );
        }

        return NextResponse.json({
            success: true,
            lineups,
            matchId,
            status: match[0].status
        });
    } catch (error) {
        console.error('Error fetching lineup:', error);
        return NextResponse.json({ error: 'Failed to fetch lineup' }, { status: 500 });
    }
}

// POST /api/matches/[id]/lineup - Create/update lineup (draft)
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin' && authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const params = await props.params;
        const matchId = params.id;
        const body = await request.json();
        const { team, lineup } = body; // team: 'home' | 'away'

        if (!team || !lineup) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (team !== 'home' && team !== 'away') {
            return NextResponse.json({ error: 'Invalid team value' }, { status: 400 });
        }

        // Get current match
        const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

        if (!match || match.length === 0) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Check if match has finished (allow LIVE - logger saves lineups when match starts)
        if (match[0].status === 'FINISHED') {
            return NextResponse.json({ error: 'Cannot edit lineup for finished matches' }, { status: 400 });
        }

        // Get existing lineups or create new object
        // Get existing lineups or create new object
        let existingLineups: any = {};
        if (match[0].lineups) {
            try {
                const parsed = JSON.parse(match[0].lineups as string);
                if (parsed && typeof parsed === 'object') {
                    existingLineups = parsed;
                }
            } catch (e) {
                console.error('Error parsing lineups JSON:', e);
            }
        }

        // Squad validation - check if competition requires squad and validate players
        const matchData = match[0];
        if (matchData.competitionId) {
            const competition = await db
                .select({
                    requireSquad: competitions.requireSquad,
                    maxSquadSize: competitions.maxSquadSize,
                })
                .from(competitions)
                .where(eq(competitions.id, matchData.competitionId))
                .all();

            if (competition.length > 0 && competition[0].requireSquad) {
                // Get all player IDs from the lineup
                const lineupPlayerIds = [
                    ...(lineup.startingXI || []),
                    ...(lineup.substitutes || []),
                ].map((p: any) => p.playerId).filter(Boolean);

                if (lineupPlayerIds.length > 0) {
                    // Check if all players are in the squad
                    const teamId = team === 'home' ? matchData.homeTeamId : matchData.awayTeamId;
                    const squadMembers = await db
                        .select({ playerId: squadPlayers.playerId })
                        .from(squadPlayers)
                        .where(
                            and(
                                eq(squadPlayers.teamId, teamId),
                                eq(squadPlayers.competitionId, matchData.competitionId),
                                eq(squadPlayers.status, 'active'),
                                inArray(squadPlayers.playerId, lineupPlayerIds)
                            )
                        )
                        .all();

                    const squadPlayerIds = new Set(squadMembers.map(s => s.playerId));
                    const invalidPlayers = lineupPlayerIds.filter((id: string) => !squadPlayerIds.has(id));

                    if (invalidPlayers.length > 0) {
                        return NextResponse.json({
                            error: 'Squad validation failed',
                            message: 'Some players are not in the squad for this competition',
                            invalidPlayers,
                            code: 'SQUAD_VALIDATION_FAILED'
                        }, { status: 400 });
                    }
                }
            }
        }

        // Lock check: a published, not-yet-unlocked lineup cannot be silently
        // overwritten from this route (BUG-220) — mirrors the guard already
        // enforced in /api/matches/[id]/lineup/publish.
        if (existingLineups[team]?.status === 'published' && !existingLineups[team]?.unlocked) {
            return NextResponse.json({
                error: 'Lineup already published and locked',
                code: 'LINEUP_LOCKED',
                publishedBy: existingLineups[team].publishedBy,
                publishedAt: existingLineups[team].publishedAt,
                message: 'This lineup has already been published. Contact an admin to unlock it for editing.'
            }, { status: 409 });
        }

        // Update the specific team's lineup
        existingLineups[team] = {
            ...lineup,
            status: lineup.status || 'draft',
            updatedAt: new Date().toISOString()
        };

        // Save back to database
        await db.update(matches)
            .set({
                lineups: JSON.stringify(existingLineups),
                updatedAt: new Date()
            })
            .where(eq(matches.id, matchId));

        return NextResponse.json({
            success: true,
            message: 'Lineup saved successfully',
            lineups: existingLineups
        });
    } catch (error) {
        console.error('Error saving lineup:', error);
        return NextResponse.json({ error: 'Failed to save lineup' }, { status: 500 });
    }
}

// DELETE /api/matches/[id]/lineup - Delete lineup
export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin' && authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const params = await props.params;
        const matchId = params.id;
        const { searchParams } = new URL(request.url);
        const team = searchParams.get('team'); // 'home' | 'away'

        if (!team) {
            return NextResponse.json({ error: 'Team parameter required' }, { status: 400 });
        }

        // Get current match
        const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

        if (!match || match.length === 0) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Get existing lineups
        // Get existing lineups
        let existingLineups: any = {};
        if (match[0].lineups) {
            try {
                const parsed = JSON.parse(match[0].lineups as string);
                if (parsed && typeof parsed === 'object') {
                    existingLineups = parsed;
                }
            } catch (e) {
                console.error('Error parsing lineups JSON:', e);
            }
        }

        // Delete the specific team's lineup
        delete existingLineups[team];

        // Save back to database
        await db.update(matches)
            .set({
                lineups: JSON.stringify(existingLineups),
                updatedAt: new Date()
            })
            .where(eq(matches.id, matchId));

        return NextResponse.json({
            success: true,
            message: 'Lineup deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting lineup:', error);
        return NextResponse.json({ error: 'Failed to delete lineup' }, { status: 500 });
    }
}
