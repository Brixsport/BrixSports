import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { matches, competitions, squadPlayers } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { resolveSlot } from '@/lib/lineup/placement';
import { getMatchConfig } from '@/lib/matchConfig';

// POST /api/admin/match-lineups/[id] - Publish official lineup
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);

        if (!user || (user.role !== 'admin' && user.role !== 'logger')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            );
        }

        const params = await props.params;
        const matchId = params.id;
        const body = await request.json();
        const { team, lineup } = body;

        if (!team || !lineup) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (team !== 'home' && team !== 'away') {
            return NextResponse.json(
                { error: 'Invalid team value' },
                { status: 400 }
            );
        }

        // Get current match
        const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

        if (!match || match.length === 0) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Check if match has finished
        if (match[0].status === 'FINISHED') {
            return NextResponse.json(
                { error: 'Cannot edit lineup for finished matches' },
                { status: 400 }
            );
        }

        // If logger, verify they're assigned to this match
        if (user.role === 'logger' && match[0].loggerId !== user.id) {
            return NextResponse.json(
                { error: 'Not assigned to this match' },
                { status: 403 }
            );
        }

        // BACKLOG-329 (found live-testing BACKLOG-323 step 6): this used to run
        // its own independent `competitions.name === match.competition` lookup
        // for playersPerSide -- a third, drifting copy of logic matchConfig.ts's
        // own comment already documented replacing "two independent, drifting
        // copies" of (the lineup-publish route and the admin UI), but this route
        // was missed. That lookup fails for any match without an exact
        // competition-name match (friendlies, or a real mismatch as found live:
        // a real 7-a-side match's competition row didn't resolve here, silently
        // falling back to the hardcoded 11 and rejecting every valid 7-starter
        // publish attempt). Use the same canonical resolver everything else uses.
        const matchConfig = await getMatchConfig(matchId);
        const requiredStarters = matchConfig?.config.playersPerSide ?? 11;

        // Validate lineup has the correct number of starters
        if (!lineup.starters || lineup.starters.length !== requiredStarters) {
            return NextResponse.json(
                { error: `Lineup must have exactly ${requiredStarters} starters` },
                { status: 400 }
            );
        }

        // BACKLOG-323: the rebuilt admin builder sends explicit slotId/x/y per
        // starter (placementVersion:2) instead of a free-text position label.
        // Never trust the client's x/y directly -- re-derive both from the
        // formation registry server-side, and reject unknown or duplicate
        // slotIds outright rather than silently accepting a stale/tampered
        // coordinate. Lineups without slotId (legacy callers, if any survive)
        // pass through unchanged below.
        if (lineup.placementVersion === 2) {
            const seenSlotIds = new Set<string>();
            for (const starter of lineup.starters) {
                if (typeof starter.slotId !== 'string' || starter.slotId.length === 0) {
                    return NextResponse.json(
                        { error: 'Every starter must have a slotId for a placementVersion 2 lineup', code: 'MISSING_SLOT_ID' },
                        { status: 422 }
                    );
                }
                if (seenSlotIds.has(starter.slotId)) {
                    return NextResponse.json(
                        { error: `Duplicate slot assignment: ${starter.slotId}`, code: 'DUPLICATE_SLOT_ID' },
                        { status: 422 }
                    );
                }
                seenSlotIds.add(starter.slotId);

                const slot = resolveSlot(lineup.formation, starter.slotId);
                if (!slot) {
                    return NextResponse.json(
                        { error: `Unknown slot "${starter.slotId}" for formation "${lineup.formation}"`, code: 'UNKNOWN_SLOT_ID' },
                        { status: 422 }
                    );
                }
                // Re-derive from the registry -- ignore whatever x/y the client sent.
                starter.x = slot.x;
                starter.y = slot.y;
            }
        }

        // Get existing lineups or create new object
        let existingLineups: any = {};
        if (match[0].lineups) {
            try {
                const parsed = JSON.parse(match[0].lineups as string);
                if (parsed && typeof parsed === 'object') {
                    existingLineups = parsed;
                }
            } catch (e) {
                console.error('Error parsing match lineups JSON:', e);
                // Fallback to empty object
            }
        }

        // Squad validation for external competitions
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
            status: 'published',
            publishedBy: user.id,
            publishedByRole: user.role,
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save back to database
        await db.update(matches)
            .set({
                lineups: JSON.stringify(existingLineups),
                updatedAt: new Date()
            })
            .where(eq(matches.id, matchId));

        // Send push notification for lineup availability
        try {
            const baseUrl = request.nextUrl.origin;
            await fetch(`${baseUrl}/api/notifications/match-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId,
                    homeTeamId: match[0].homeTeamId,
                    awayTeamId: match[0].awayTeamId,
                    eventType: 'LINEUP_AVAILABLE',
                    teamName: team === 'home' ? 'Home team' : 'Away team',
                }),
            });
            console.log('✅ Lineup available notification sent');
        } catch (notifError) {
            console.error('Failed to send lineup notification:', notifError);
            // Don't fail the request if notification fails
        }

        return NextResponse.json({
            success: true,
            message: 'Official lineup published successfully',
            lineups: existingLineups
        });
    } catch (error) {
        console.error('Error publishing lineup:', error);
        return NextResponse.json(
            { error: 'Failed to publish lineup' },
            { status: 500 }
        );
    }
}
