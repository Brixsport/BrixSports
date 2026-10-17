import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/db';
import { matches, matchEvents, playerStats } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';
import { recalculateStandingsForMatch } from '@/lib/standingsService';

export async function POST(request: NextRequest) {
    try {
        // === AUTH ===
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // === REQUEST BODY ===
        const body = await request.json();
        const { match, players: playerRows, forceInsert } = body;

        // === VALIDATION ===
        if (!match) {
            return NextResponse.json({ error: 'Missing match details' }, { status: 400 });
        }

        // 1. match.homeTeamId and match.awayTeamId must not be equal
        if (!match.homeTeamId || !match.awayTeamId || match.homeTeamId === match.awayTeamId) {
            return NextResponse.json({ error: 'Home and away team cannot be the same' }, { status: 400 });
        }

        // 2. match.homeScore and match.awayScore must be >= 0
        if (
            typeof match.homeScore !== 'number' ||
            typeof match.awayScore !== 'number' ||
            match.homeScore < 0 ||
            match.awayScore < 0
        ) {
            return NextResponse.json({ error: 'Scores must be non-negative' }, { status: 400 });
        }

        // 3. match.startTime must parse as valid date via new Date()
        const dateParsed = new Date(match.startTime);
        if (isNaN(dateParsed.getTime())) {
            return NextResponse.json({ error: 'Invalid match date' }, { status: 400 });
        }

        // 4. players array must not be empty
        if (!playerRows || !Array.isArray(playerRows) || playerRows.length === 0) {
            return NextResponse.json({ error: 'At least one player row is required' }, { status: 400 });
        }

        // 5. Each player row — playerId and teamId must be present
        for (let i = 0; i < playerRows.length; i++) {
            const p = playerRows[i];
            if (!p.playerId || !p.teamId) {
                return NextResponse.json(
                    { error: `Missing playerId or teamId on player row at index ${i}` },
                    { status: 400 }
                );
            }
        }

        // === DUPLICATE DETECTION ===
        if (!forceInsert) {
            const existing = await db
                .select({ id: matches.id })
                .from(matches)
                .where(
                    and(
                        eq(matches.homeTeamId, match.homeTeamId),
                        eq(matches.awayTeamId, match.awayTeamId),
                        eq(matches.startTime, match.startTime)
                    )
                )
                .get();

            if (existing) {
                return NextResponse.json(
                    {
                        error: 'duplicate',
                        message: 'A match between these teams on this date already exists',
                        existingMatchId: existing.id
                    },
                    { status: 409 }
                );
            }
        }

        // === TRANSACTION ===
        const result = await db.transaction(async (tx) => {
            // STEP 1 — INSERT MATCH ROW
            const matchId = nanoid();
            await tx.insert(matches).values({
                id: matchId,
                sport: match.sport,
                homeTeamId: match.homeTeamId,
                awayTeamId: match.awayTeamId,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                venue: match.venue,
                competition: match.competition,
                competitionId: match.competitionId || null,
                matchType: match.matchType || 'competition',
                competitionLevel: match.competitionLevel || null,
                status: 'FINISHED',
                approvalStatus: 'APPROVED',
                startTime: match.startTime,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // STEP 2 — INSERT BACKFILL NOTE EVENT
            await tx.insert(matchEvents).values({
                id: nanoid(),
                matchId: matchId,
                type: 'note',
                minute: 0,
                detail: 'Match backfilled from physical log sheet — live timeline unavailable',
                createdAt: new Date()
            });

            let eventsInserted = 1; // 1 note event

            // STEP 3 — FOR EACH PLAYER ROW
            for (const playerRow of playerRows) {
                const eventMappings = [
                    { key: 'goals', type: 'Goal' },
                    { key: 'assists', type: 'Assist' },
                    { key: 'shotsOn', type: 'SHOT_ON_TARGET' },
                    { key: 'shotsOff', type: 'SHOT_OFF_TARGET' },
                    { key: 'yellowCards', type: 'Yellow Card' },
                    { key: 'redCards', type: 'Red Card' },
                    { key: 'tackles', type: 'TACKLE' },
                    { key: 'interceptions', type: 'INTERCEPTION' },
                    { key: 'clearances', type: 'CLEARANCE' },
                    { key: 'fouls', type: 'Foul' },
                    { key: 'saves', type: 'SAVE' },
                    { key: 'blocks', type: 'BLOCK' }
                ];

                for (const mapping of eventMappings) {
                    const count = playerRow[mapping.key] || 0;
                    if (count > 0) {
                        for (let i = 0; i < count; i++) {
                            await tx.insert(matchEvents).values({
                                id: nanoid(),
                                matchId: matchId,
                                type: mapping.type,
                                minute: 0,
                                playerId: playerRow.playerId,
                                teamId: playerRow.teamId,
                                createdAt: new Date()
                            });
                            eventsInserted++;
                        }
                    }
                }

                // Substitution events
                if (typeof playerRow.subOut === 'number') {
                    await tx.insert(matchEvents).values({
                        id: nanoid(),
                        matchId: matchId,
                        type: 'Substitution',
                        minute: playerRow.subOut,
                        detail: 'subbed off',
                        playerId: playerRow.playerId,
                        teamId: playerRow.teamId,
                        createdAt: new Date()
                    });
                    eventsInserted++;
                }

                if (typeof playerRow.subIn === 'number') {
                    await tx.insert(matchEvents).values({
                        id: nanoid(),
                        matchId: matchId,
                        type: 'Substitution',
                        minute: playerRow.subIn,
                        detail: 'subbed on',
                        playerId: playerRow.playerId,
                        teamId: playerRow.teamId,
                        createdAt: new Date()
                    });
                    eventsInserted++;
                }

                // b) CALCULATE minutesPlayed
                const minutesPlayed = Math.max(0, (playerRow.subOut ?? 90) - (playerRow.subIn ?? 0));

                // c) UPSERT playerStats
                const existingStats = await tx
                    .select()
                    .from(playerStats)
                    .where(
                        and(
                            eq(playerStats.playerId, playerRow.playerId),
                            match.competitionId
                                ? or(
                                      eq(playerStats.competitionId, match.competitionId),
                                      eq(playerStats.competition, match.competition || '')
                                  )
                                : eq(playerStats.competition, match.competition || '')
                        )
                    )
                    .get();

                const rowRating = playerRow.rating || 7.0;

                if (existingStats) {
                    const newAppearances = (existingStats.appearances || 0) + 1;
                    const oldAverageRating =
                        existingStats.averageRating !== null && existingStats.averageRating !== undefined
                            ? existingStats.averageRating
                            : 7.0;
                    const newAverageRating =
                        (oldAverageRating * (existingStats.appearances || 0) + rowRating) / newAppearances;

                    await tx
                        .update(playerStats)
                        .set({
                            goals: (existingStats.goals || 0) + ((playerRow.goals || 0) + (playerRow.penalties || 0)),
                            assists: (existingStats.assists || 0) + (playerRow.assists || 0),
                            yellowCards: (existingStats.yellowCards || 0) + (playerRow.yellowCards || 0),
                            redCards: (existingStats.redCards || 0) + (playerRow.redCards || 0),
                            saves: (existingStats.saves || 0) + (playerRow.saves || 0),
                            appearances: newAppearances,
                            minutesPlayed: (existingStats.minutesPlayed || 0) + minutesPlayed,
                            averageRating: newAverageRating,
                            updatedAt: new Date()
                        })
                        .where(eq(playerStats.id, existingStats.id));
                } else {
                    await tx.insert(playerStats).values({
                        id: nanoid(),
                        playerId: playerRow.playerId,
                        competition: match.competition,
                        competitionId: match.competitionId || null,
                        sport: match.sport,
                        goals: (playerRow.goals || 0) + (playerRow.penalties || 0),
                        assists: playerRow.assists || 0,
                        yellowCards: playerRow.yellowCards || 0,
                        redCards: playerRow.redCards || 0,
                        saves: playerRow.saves || 0,
                        appearances: 1,
                        minutesPlayed: minutesPlayed,
                        averageRating: rowRating,
                        updatedAt: new Date()
                    });
                }
            }

            // STEP 4 — COMPUTE AND UPDATE MATCH STATS JSON
            const homeStats = {
                possession: 0,
                shots: 0,
                shotsOnTarget: 0,
                corners: 0,
                fouls: 0,
                yellowCards: 0,
                redCards: 0,
                saves: 0,
                passAccuracy: 0,
                tackles: 0,
                interceptions: 0,
                offsides: 0
            };

            const awayStats = {
                possession: 0,
                shots: 0,
                shotsOnTarget: 0,
                corners: 0,
                fouls: 0,
                yellowCards: 0,
                redCards: 0,
                saves: 0,
                passAccuracy: 0,
                tackles: 0,
                interceptions: 0,
                offsides: 0
            };

            for (const playerRow of playerRows) {
                const isHome = playerRow.teamId === match.homeTeamId;
                const target = isHome ? homeStats : awayStats;

                const sOn = playerRow.shotsOn || 0;
                const sOff = playerRow.shotsOff || 0;

                target.shots += sOn + sOff;
                target.shotsOnTarget += sOn;
                target.fouls += playerRow.fouls || 0;
                target.yellowCards += playerRow.yellowCards || 0;
                target.redCards += playerRow.redCards || 0;
                target.saves += playerRow.saves || 0;
                target.tackles += playerRow.tackles || 0;
                target.interceptions += playerRow.interceptions || 0;
            }

            const statsObject = {
                home: homeStats,
                away: awayStats
            };

            await tx
                .update(matches)
                .set({
                    stats: JSON.stringify(statsObject),
                    updatedAt: new Date()
                })
                .where(eq(matches.id, matchId));

            return {
                matchId,
                eventsInserted
            };
        });

        // BUG-245: this route inserts a FINISHED match directly, bypassing
        // matches/[id]/route.ts's PATCH handler entirely -- which is the only
        // other place that triggers recalculateStandingsForMatch. Without this,
        // a backfilled match sits outside standings/teams indefinitely unless
        // some other later match for the same team+competition happens to
        // trigger a fresh recompute that incidentally scans it in.
        after(async () => {
            try {
                await recalculateStandingsForMatch(result.matchId);
            } catch (error) {
                console.error('Error recalculating standings after backfill:', error);
            }
        });

        return NextResponse.json(
            {
                success: true,
                matchId: result.matchId,
                playersProcessed: playerRows.length,
                eventsInserted: result.eventsInserted
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Transaction failed during backfill:', error);
        return NextResponse.json(
            { error: 'Transaction failed' },
            { status: 500 }
        );
    }
}
