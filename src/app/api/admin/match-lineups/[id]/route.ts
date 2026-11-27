import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { sendMatchEventNotification } from '@/lib/notifications/match-notification-service';
import { db } from '@/db';
import { matches, competitions, squadPlayers } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { resolveSlot } from '@/lib/lineup/placement';
import { getMatchConfig } from '@/lib/matchConfig';
import { isLoggerAssigned } from '@/lib/match-logger-helpers';
import { writeMatchLineupsAtomic, CONCURRENT_MODIFICATION_RESPONSE } from '@/lib/lineup/atomicLineupWrite';
import { decideLineupPost, canOverwritePublishedLineup, sidesNeedingLineupNotification } from '@/lib/lineup/logger-lineup-permission';

type Side = 'home' | 'away';

// Validates one team's lineup; returns an error response, or null when valid.
// May normalise starters (x/y re-derived from the formation registry).
async function validateTeamLineup(
    matchRow: typeof matches.$inferSelect,
    team: Side,
    lineup: any,
    requiredStarters: number
): Promise<NextResponse | null> {
    if (!lineup || typeof lineup !== 'object') {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate lineup has the correct number of starters
    if (!lineup.starters || lineup.starters.length !== requiredStarters) {
        return NextResponse.json(
            { error: `Lineup must have exactly ${requiredStarters} starters` },
            { status: 400 }
        );
    }

    // The builder sends explicit slotId/x/y per starter (placementVersion:2).
    // Never trust the client's x/y directly -- re-derive both from the
    // formation registry server-side, and reject unknown or duplicate slotIds
    // outright rather than silently accepting a stale/tampered coordinate.
    // Lineups without slotId (legacy callers) pass through unchanged.
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
            starter.x = slot.x;
            starter.y = slot.y;
        }
    }

    // Squad validation for competitions that require a squad
    if (matchRow.competitionId) {
        const competition = await db
            .select({
                requireSquad: competitions.requireSquad,
                maxSquadSize: competitions.maxSquadSize,
            })
            .from(competitions)
            .where(eq(competitions.id, matchRow.competitionId))
            .all();

        if (competition.length > 0 && competition[0].requireSquad) {
            const lineupPlayerIds = [
                ...(lineup.starters || []),
                ...(lineup.substitutes || []),
            ].map((p: any) => p.playerId).filter(Boolean);

            if (lineupPlayerIds.length > 0) {
                const teamId = team === 'home' ? matchRow.homeTeamId : matchRow.awayTeamId;
                const squadMembers = await db
                    .select({ playerId: squadPlayers.playerId })
                    .from(squadPlayers)
                    .where(
                        and(
                            eq(squadPlayers.teamId, teamId),
                            eq(squadPlayers.competitionId, matchRow.competitionId),
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

    return null;
}

// POST /api/admin/match-lineups/[id] - Publish official lineup(s)
// Body: { team, lineup } for one side, or { lineups: { home, away } } to publish
// both sides in ONE validated, all-or-nothing write (no half-published match).
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (user.role !== 'admin' && user.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const params = await props.params;
        const matchId = params.id;
        const body = await request.json();

        const entries: Array<[Side, any]> = [];
        if (body?.lineups && typeof body.lineups === 'object') {
            for (const side of ['home', 'away'] as const) {
                if (body.lineups[side]) entries.push([side, body.lineups[side]]);
            }
        } else if (body?.team && body?.lineup) {
            if (body.team !== 'home' && body.team !== 'away') {
                return NextResponse.json({ error: 'Invalid team value' }, { status: 400 });
            }
            entries.push([body.team, body.lineup]);
        }
        if (entries.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get current match
        const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

        if (!match || match.length === 0) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Role + assignment + kick-off rule, decided server-side from the verified
        // session (never from the client). See decideLineupPost.
        const decision = decideLineupPost({
            role: user.role,
            isAssigned: user.role === 'logger' ? await isLoggerAssigned(matchId, user.id) : false,
            matchStatus: match[0].status,
        });
        if (!decision.allow) {
            return NextResponse.json({ error: decision.error }, { status: decision.status });
        }

        // Check if match has finished
        if (match[0].status === 'FINISHED') {
            return NextResponse.json({ error: 'Cannot edit lineup for finished matches' }, { status: 400 });
        }

        // Same canonical resolver everything else uses for playersPerSide.
        const matchConfig = await getMatchConfig(matchId);
        const requiredStarters = matchConfig?.config.playersPerSide ?? 11;

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

        // Validate EVERY side and check locks before writing anything.
        for (const [team, lineup] of entries) {
            const invalid = await validateTeamLineup(match[0], team, lineup, requiredStarters);
            if (invalid) return invalid;

            // Lock check: an admin-published, not-yet-unlocked lineup cannot be
            // overwritten by a logger; loggers (and admins) may correct a lineup a
            // logger published, mirroring basketball.
            if (!canOverwritePublishedLineup({ callerRole: user.role, existing: existingLineups[team] })) {
                return NextResponse.json({
                    error: 'Lineup already published and locked',
                    code: 'LINEUP_LOCKED',
                    publishedBy: existingLineups[team].publishedBy,
                    publishedAt: existingLineups[team].publishedAt,
                    message: 'This lineup was published by an admin. Contact an admin to unlock it for editing.'
                }, { status: 409 });
            }
        }

        // Captured before we overwrite: only first-time publishes notify followers.
        const notifySides = sidesNeedingLineupNotification(existingLineups, entries.map(([team]) => team));

        const now = new Date().toISOString();
        for (const [team, lineup] of entries) {
            existingLineups[team] = {
                ...lineup,
                status: 'published',
                publishedBy: user.id,
                publishedByRole: user.role,
                publishedAt: now,
                unlocked: false,
                updatedAt: now
            };
        }

        // Single compare-and-swap write for all sides.
        const writeResult = await writeMatchLineupsAtomic(matchId, match[0].lineups as string | null, existingLineups);
        if (!writeResult.ok) {
            return NextResponse.json(CONCURRENT_MODIFICATION_RESPONSE, { status: 409 });
        }

        // Push notification for lineup availability (first-time publishes only, not corrections)
        for (const team of notifySides) {
            try {
                await sendMatchEventNotification({
                    matchId,
                    homeTeamId: match[0].homeTeamId,
                    awayTeamId: match[0].awayTeamId,
                    eventType: 'LINEUP_AVAILABLE',
                    teamName: team === 'home' ? 'Home team' : 'Away team',
                });
            } catch (notifError) {
                console.error('Failed to send lineup notification:', notifError);
                // Don't fail the request if notification fails
            }
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
