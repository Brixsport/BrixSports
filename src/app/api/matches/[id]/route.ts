/**
 * Match Details API Route
 * Fetch detailed match information with events, lineups, stats, and more
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/db';
import { matches, teams, matchEvents, players, bracketNodes, teamForm, headToHead } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { playerRatings } from '@/db/schema-ratings';
import { getAuthUser } from '@/lib/auth';
import { isLoggerAssigned } from '@/lib/match-logger-helpers';
import { broadcastToMatch, broadcastGlobalNotification } from '@/lib/socket';
import { sendMatchEventNotification } from '@/lib/notifications/match-notification-service';
import { getNotifiablePeriodType } from '@/lib/notifications/notification-rules';
import { recalculateStandingsForMatch } from '@/lib/standingsService';
import { advanceBracketForMatch } from '@/lib/bracketService';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Raised well above the default 120/min (see rate-limit.ts) -- this route backs
        // the live match page's WS-fallback poll (every 10s while the socket is down,
        // src/app/matches/[id]/page.tsx). Per-IP bucketing means every viewer on a shared
        // NAT (campus WiFi -- this is a college sports app) counts against the same
        // bucket: at the default ceiling, ~20 concurrent same-IP viewers polling during a
        // real WS outage would already be at the limit. 600/min covers roughly 100
        // concurrent same-IP fallback-polling viewers while still catching anything
        // polling faster than the fallback's own 10s interval, which no real viewer does.
        const rl = checkRateLimit(request, { max: 600 });
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        const { id: matchId } = await params;

        // Fetch match with team details
        const [match] = await db
            .select({
                match: matches,
                homeTeam: {
                    id: teams.id,
                    name: teams.name,
                    shortName: teams.shortName,
                    logo: teams.logo,
                    university: teams.university,
                    color: teams.color,
                },
            })
            .from(matches)
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .where(eq(matches.id, matchId));

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Get away team separately
        const [awayTeam] = await db
            .select({
                id: teams.id,
                name: teams.name,
                shortName: teams.shortName,
                logo: teams.logo,
                university: teams.university,
                color: teams.color,
            })
            .from(teams)
            .where(eq(teams.id, match.match.awayTeamId));

        // Competition is stored as text field in matches table
        const competition = match.match.competition;

        // Fetch match events with player and team details
        const eventsData = await db
            .select({
                event: matchEvents,
                player: players,
                team: {
                    id: teams.id,
                    name: teams.name,
                    shortName: teams.shortName,
                    logo: teams.logo,
                    color: teams.color,
                },
            })
            .from(matchEvents)
            .leftJoin(players, eq(matchEvents.playerId, players.id))
            .leftJoin(teams, eq(matchEvents.teamId, teams.id))
            .where(eq(matchEvents.matchId, matchId))
            .orderBy(desc(matchEvents.minute), desc(matchEvents.second))
            .limit(500);

        // Process events to include related player data
        const events = await Promise.all(
            eventsData.map(async (row) => {
                let relatedPlayer = null;
                if (row.event.relatedPlayerId) {
                    const [rp] = await db
                        .select({
                            id: players.id,
                            name: players.name,
                            jerseyName: players.jerseyName,
                            number: players.number,
                            position: players.position,
                        })
                        .from(players)
                        .where(eq(players.id, row.event.relatedPlayerId));
                    relatedPlayer = rp ?? null;
                }

                // BUG-018: explicit DTO — loggerId is a banned public field
                const { loggerId: _l, ...publicEvent } = row.event;
                return {
                    ...publicEvent,
                    player: row.player
                        ? {
                            id: row.player.id,
                            name: row.player.name,
                            jerseyName: (row.player as any).jerseyName ?? null,
                            number: row.player.number,
                            position: row.player.position,
                        }
                        : null,
                    relatedPlayer,
                    team: row.team,
                    value: row.event.value ? JSON.parse(row.event.value) : null,
                };
            })
        );

        // Note: Player time tracking and eye points features not yet implemented in schema

        // Parse lineups if available
        let lineups = null;
        if (match.match.lineups) {
            try {
                lineups = JSON.parse(match.match.lineups);
            } catch (e) {
                console.error('Error parsing lineups:', e);
            }
        }

        // If lineups are not available for basketball, generate from events
        if (!lineups && match.match.sport === 'Basketball' && events.length > 0) {
            console.log('🏀 Generating lineups from', events.length, 'events');
            const homePlayerStats: any = {};
            const awayPlayerStats: any = {};


            // Calculate player stats from events and track first appearance
            events.forEach((event: any) => {
                if (!event.player) return;

                const isHomeTeam = event.teamId === match.match.homeTeamId;
                const playerMap = isHomeTeam ? homePlayerStats : awayPlayerStats;

                if (!playerMap[event.playerId]) {
                    playerMap[event.playerId] = {
                        id: event.playerId,
                        name: event.player.name,
                        number: event.player.number,
                        position: event.player.position,
                        rating: event.player.rating || 7.0,
                        firstAppearance: event.minute || 0,
                        stats: {
                            points: 0,
                            rebounds: 0,
                            assists: 0,
                            steals: 0,
                            blocks: 0,
                        }
                    };
                } else {
                    // Track earliest appearance
                    if (event.minute < playerMap[event.playerId].firstAppearance) {
                        playerMap[event.playerId].firstAppearance = event.minute;
                    }
                }

                const playerStats = playerMap[event.playerId].stats;

                switch (event.type) {
                    case '2PT_MADE':
                        playerStats.points += 2;
                        break;
                    case '3PT_MADE':
                        playerStats.points += 3;
                        break;
                    case 'FREE_THROW':
                        playerStats.points += 1;
                        break;
                    case 'REBOUND':
                        playerStats.rebounds++;
                        break;
                    case 'ASSIST':
                        playerStats.assists++;
                        break;
                    case 'STEAL':
                        playerStats.steals++;
                        break;
                    case 'BLOCK':
                        playerStats.blocks++;
                        break;
                }
            });

            // Sort players: starters first (appeared in first 5 minutes), then by points
            const sortPlayers = (players: any[]) => {
                return players.sort((a: any, b: any) => {
                    const aIsStarter = a.firstAppearance <= 5;
                    const bIsStarter = b.firstAppearance <= 5;

                    if (aIsStarter && !bIsStarter) return -1;
                    if (!aIsStarter && bIsStarter) return 1;

                    // Within same group (starters or subs), sort by points
                    return b.stats.points - a.stats.points;
                });
            };

            const homePlayers = sortPlayers(Object.values(homePlayerStats).map((p: any) => ({
                ...p,
                points: p.stats.points,
                rebounds: p.stats.rebounds,
                assists: p.stats.assists,
                steals: p.stats.steals,
                blocks: p.stats.blocks,
            })));

            const awayPlayers = sortPlayers(Object.values(awayPlayerStats).map((p: any) => ({
                ...p,
                points: p.stats.points,
                rebounds: p.stats.rebounds,
                assists: p.stats.assists,
                steals: p.stats.steals,
                blocks: p.stats.blocks,
            })));

            lineups = {
                home: {
                    starters: homePlayers.filter((p: any) => p.firstAppearance <= 5),
                    bench: homePlayers.filter((p: any) => p.firstAppearance > 5),
                },
                away: {
                    starters: awayPlayers.filter((p: any) => p.firstAppearance <= 5),
                    bench: awayPlayers.filter((p: any) => p.firstAppearance > 5),
                },
            };
        }

        // Parse stats if available
        let stats: any = null;
        if (match.match.stats) {
            try {
                stats = JSON.parse(match.match.stats);
            } catch (e) {
                console.error('Error parsing stats:', e);
            }
        }

        // If stats are not available and this is a football match, calculate from events
        const isFootball = !match.match.sport || match.match.sport === 'Football' ||
            (match.match.sport as string) === '5-a-side' || (match.match.sport as string) === 'Five-a-side';
        const statsEmpty = !stats || Object.keys(stats).length === 0;
        // BACKLOG-122: goals-only backfilled matches (no team logsheet) only ever write
        // Goal/Penalty/Own Goal/Assist/Yellow Card/Red Card events -- every other category
        // below always computes to a literal 0-0. Worse, and easy to miss: some matches have
        // ASYMMETRIC coverage (e.g. busa-match-16 -- Hammers has a real full-stat logsheet,
        // Santos has almost nothing), which produces a fabricated-looking lopsided stat line
        // (100%-0% possession, 26-0 shots) rather than a neutral 0-0. A per-match "does any
        // event anywhere have a full-stat type" check misses this entirely, since Hammers'
        // real events pass it. The real test is per-team: both sides must have logged at
        // least one full-stat-only event for the comparison to mean anything.
        const FULL_STAT_ONLY_EVENT_TYPES = new Set([
            'Shot on Target', 'Shot off Target', 'Corner', 'Foul', 'Push', 'Handball',
            'Offside', 'Free Kick', 'Save', 'Catch', 'Block', 'Interception', 'Clearance',
        ]);
        const homeHasFullStatCoverage = events.some((e: any) => e.teamId === match.match.homeTeamId && FULL_STAT_ONLY_EVENT_TYPES.has(e.type));
        const awayHasFullStatCoverage = events.some((e: any) => e.teamId !== match.match.homeTeamId && FULL_STAT_ONLY_EVENT_TYPES.has(e.type));
        const isGoalsOnlyCapture = events.length > 0 && !(homeHasFullStatCoverage && awayHasFullStatCoverage);
        if (statsEmpty && isFootball && events.length > 0) {
            const homeIdx = 0; // home = index 0
            const awayIdx = 1; // away = index 1
            const s: number[][] = Array.from({ length: 18 }, () => [0, 0]);

            events.forEach((event: any) => {
                const idx = event.teamId === match.match.homeTeamId ? 0 : 1;
                switch (event.type) {
                    case 'Goal': s[0][idx]++; s[2][idx]++; break; // goals, shots
                    case 'Penalty': s[0][idx]++; s[3][idx]++; break; // goals, penalties
                    case 'Own Goal': s[0][idx === 0 ? 1 : 0]++; break; // goals for opponent
                    case 'Shot on Target': s[2][idx]++; s[4][idx]++; break; // shots, shotsOnTarget
                    case 'Shot off Target': s[2][idx]++; s[5][idx]++; break; // shots, shotsOffTarget
                    case 'Corner': s[6][idx]++; break;
                    case 'Foul': case 'Push': case 'Handball': s[7][idx]++; break; // fouls
                    case 'Yellow Card': s[8][idx]++; break;
                    case 'Red Card': s[9][idx]++; break;
                    case 'Offside': s[10][idx]++; break;
                    case 'Free Kick': s[11][idx]++; break;
                    case 'Assist': s[12][idx]++; break;
                    case 'Save': s[13][idx]++; break;
                    case 'Catch': s[14][idx]++; break;
                    case 'Block': s[15][idx]++; break;
                    case 'Interception': s[16][idx]++; break;
                    case 'Clearance': s[17][idx]++; break;
                }
            });

            // Compute possession from attacking events (shots + corners + free kicks)
            const homePossession = (s[2][0] + s[6][0] + s[11][0]) || 0;
            const awayPossession = (s[2][1] + s[6][1] + s[11][1]) || 0;
            const totalPoss = homePossession + awayPossession;
            const homePct = totalPoss > 0 ? Math.round((homePossession / totalPoss) * 100) : 50;
            const awayPct = 100 - homePct;

            stats = {
                shots: [s[2][0], s[2][1]],
                shotsOnTarget: [s[4][0], s[4][1]],
                shotsOffTarget: [s[5][0], s[5][1]],
                goals: [s[0][0], s[0][1]],
                penalties: [s[3][0], s[3][1]],
                corners: [s[6][0], s[6][1]],
                fouls: [s[7][0], s[7][1]],
                yellowCards: [s[8][0], s[8][1]],
                redCards: [s[9][0], s[9][1]],
                offsides: [s[10][0], s[10][1]],
                freeKicks: [s[11][0], s[11][1]],
                assists: [s[12][0], s[12][1]],
                saves: [s[13][0], s[13][1]],
                catches: [s[14][0], s[14][1]],
                blocks: [s[15][0], s[15][1]],
                interceptions: [s[16][0], s[16][1]],
                clearances: [s[17][0], s[17][1]],
                possession: [homePct, awayPct],
                possessionEvents: [homePossession, awayPossession],
                expectedGoals: [s[0][0], s[0][1]], // xG approx from goals
                ownGoals: [s[0][1], s[0][0]], // simplified
                tackles: [0, 0],
                throwIns: [0, 0],
                goalKicks: [0, 0],
                substitutions: [0, 0],
                statsCaptureMode: isGoalsOnlyCapture ? 'goals-only' : 'full',
            };
        }

        // If stats are not available and this is a basketball match, calculate from events.
        // BACKLOG-139: this switch previously matched on '2PT_MADE'/'3PT_MADE'/'FREE_THROW'/
        // 'REBOUND'/'ASSIST'/'STEAL'/'BLOCK' -- BasketballLogger.tsx has only ever dispatched
        // 'Field Goal'/'Three Pointer'/'Free Throw'/'Rebound'/'Assist'/'Steal'/'Block' (see its
        // own BasketballEventType union). Every case here was dead on arrival, so every
        // basketball team stat (not just the percentage fields originally filed) was always
        // zero for every real match. Attempt/made distinction now uses the same convention
        // already correct in BasketballLogger.tsx's own calculateAdvancedStats: `value` holds
        // the point value on a make (2/3/1) and 0 on a miss; every shot-type event counts as
        // an attempt regardless of outcome.
        if (!stats && match.match.sport === 'Basketball' && events.length > 0) {
            stats = {
                homeFieldGoalsMade: 0,
                awayFieldGoalsMade: 0,
                homeFieldGoalsAttempted: 0,
                awayFieldGoalsAttempted: 0,
                homeThreePointersMade: 0,
                awayThreePointersMade: 0,
                homeThreePointersAttempted: 0,
                awayThreePointersAttempted: 0,
                homeFreeThrowsMade: 0,
                awayFreeThrowsMade: 0,
                homeFreeThrowsAttempted: 0,
                awayFreeThrowsAttempted: 0,
                homeRebounds: 0,
                awayRebounds: 0,
                homeAssists: 0,
                awayAssists: 0,
                homeSteals: 0,
                awaySteals: 0,
                homeBlocks: 0,
                awayBlocks: 0,
                homeTurnovers: 0,
                awayTurnovers: 0,
            };

            // Calculate stats from events
            events.forEach((event: any) => {
                const isHomeTeam = event.teamId === match.match.homeTeamId;
                const prefix = isHomeTeam ? 'home' : 'away';
                const made = Number(event.value) > 0;

                switch (event.type) {
                    case 'Field Goal':
                        stats[`${prefix}FieldGoalsAttempted`]++;
                        if (made) stats[`${prefix}FieldGoalsMade`]++;
                        break;
                    case 'Three Pointer':
                        stats[`${prefix}FieldGoalsAttempted`]++;
                        stats[`${prefix}ThreePointersAttempted`]++;
                        if (made) {
                            stats[`${prefix}FieldGoalsMade`]++;
                            stats[`${prefix}ThreePointersMade`]++;
                        }
                        break;
                    case 'Free Throw':
                        stats[`${prefix}FreeThrowsAttempted`]++;
                        if (made) stats[`${prefix}FreeThrowsMade`]++;
                        break;
                    case 'Rebound':
                        stats[`${prefix}Rebounds`]++;
                        break;
                    case 'Assist':
                        stats[`${prefix}Assists`]++;
                        break;
                    case 'Steal':
                        stats[`${prefix}Steals`]++;
                        break;
                    case 'Block':
                        stats[`${prefix}Blocks`]++;
                        break;
                    case 'Turnover':
                        stats[`${prefix}Turnovers`]++;
                        break;
                }
            });

            // BACKLOG-139: the actual originally-filed gap -- percentage fields were never
            // computed at all, so BasketballMatchOverlay.tsx's Field Goal %/3-Point %/Free
            // Throw % bars always rendered a flat 0% regardless of the (now-fixed) counters
            // above.
            const pct = (made: number, attempted: number) => attempted > 0 ? Math.round((made / attempted) * 100) : 0;
            stats.fieldGoalPercentage = [pct(stats.homeFieldGoalsMade, stats.homeFieldGoalsAttempted), pct(stats.awayFieldGoalsMade, stats.awayFieldGoalsAttempted)];
            stats.threePointPercentage = [pct(stats.homeThreePointersMade, stats.homeThreePointersAttempted), pct(stats.awayThreePointersMade, stats.awayThreePointersAttempted)];
            stats.freeThrowPercentage = [pct(stats.homeFreeThrowsMade, stats.homeFreeThrowsAttempted), pct(stats.awayFreeThrowsMade, stats.awayFreeThrowsAttempted)];
        }

        // Note: Viewer count feature not yet implemented in schema

        // Merge updated ratings into lineups
        if (lineups) {
            try {
                const updatedRatings = await db
                    .select()
                    .from(playerRatings)
                    .where(eq(playerRatings.matchId, matchId))
                    .limit(100);

                if (updatedRatings.length > 0) {
                    const ratingMap = new Map();
                    updatedRatings.forEach(r => {
                        ratingMap.set(r.playerId, r.finalRating ?? r.autoRating);
                    });

                    const updatePlayerRatings = (players: any[]) => {
                        if (!Array.isArray(players)) return players;
                        return players.map((p: any) => ({
                            ...p,
                            rating: ratingMap.has(p.id) ? ratingMap.get(p.id) : p.rating
                        }));
                    };

                    if (lineups.home) {
                        lineups.home = updatePlayerRatings(lineups.home);
                    }
                    if (lineups.away) {
                        lineups.away = updatePlayerRatings(lineups.away);
                    }
                }
            } catch (err) {
                console.error('Error merging ratings:', err);
            }
        }

        // BUG-018: shape a public DTO — banned fields (loggerId, approvalStatus,
        // managerNotes, approvedBy, approvedAt) are intentionally excluded.
        const { loggerId, approvalStatus, managerNotes, approvedBy, approvedAt, ...publicMatch } = match.match;

        return NextResponse.json({
            match: {
                ...publicMatch,
                homeTeam: match.homeTeam,
                awayTeam,
                competition,
                lineups,
                stats,
            },
            events,
        });
    } catch (error) {
        console.error('Error fetching match details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch match details' },
            { status: 500 }
        );
    }
}

/**
 * UPDATE match (Logger/Admin only)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: matchId } = await params;

        if (authUser.role === 'logger') {
            const assigned = await isLoggerAssigned(matchId, authUser.id);
            if (!assigned) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } else if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();

        // BUG-051: validate status against allowed enum; restrict loggers to safe transitions only
        const VALID_STATUSES = ['PENDING', 'UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED'] as const;
        const LOGGER_ALLOWED_STATUSES: string[] = ['LIVE', 'FINISHED'];
        if (body.status !== undefined) {
            if (!VALID_STATUSES.includes(body.status)) {
                return NextResponse.json({ error: 'Invalid status value' }, { status: 422 });
            }
            if (authUser.role === 'logger' && !LOGGER_ALLOWED_STATUSES.includes(body.status)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // If assigning a logger, validate that the match isn't already assigned to another logger
        if (body.loggerId !== undefined && body.loggerId !== null) {
            const [existingMatch] = await db
                .select()
                .from(matches)
                .where(eq(matches.id, matchId));

            if (!existingMatch) {
                return NextResponse.json(
                    { error: 'Match not found' },
                    { status: 404 }
                );
            }

            // Check if match is already assigned to a different logger
            if (existingMatch.loggerId && existingMatch.loggerId !== body.loggerId) {
                return NextResponse.json(
                    {
                        error: 'Match is already assigned to another logger',
                        code: 'MATCH_ALREADY_ASSIGNED',
                    },
                    { status: 409 }
                );
            }
        }

        const updateData: any = {
            updatedAt: new Date(),
        };

        // Update allowed fields
        // BUG-052: score writes restricted to admin only; integer guard prevents corruption
        if (authUser.role === 'admin') {
            if (body.homeScore !== undefined) {
                const s = Number(body.homeScore);
                if (!Number.isInteger(s) || s < 0) {
                    return NextResponse.json({ error: 'Invalid homeScore' }, { status: 422 });
                }
                updateData.homeScore = s;
            }
            if (body.awayScore !== undefined) {
                const s = Number(body.awayScore);
                if (!Number.isInteger(s) || s < 0) {
                    return NextResponse.json({ error: 'Invalid awayScore' }, { status: 422 });
                }
                updateData.awayScore = s;
            }
        }
        if (body.status !== undefined) updateData.status = body.status;
        // currentPeriod had no enum validation at all, unlike status just above --
        // reachable only by an authenticated, assigned logger/admin so low exploitability,
        // but cheap to close. No DB-level constraint either (schema.ts:340, plain text
        // column), so this is the only gate.
        // BUG-191: the flat 'OT' entry was stale the moment this list was written --
        // BUG-135 (session 47E) already changed basketball's OT label to numbered
        // OT1/OT2/etc, but this allowlist was added later without picking that up.
        // Confirmed live, session 47F: every real OT transition since BUG-135 shipped
        // has 422'd here, visibly failing to persist (BasketballLogger.tsx only ever
        // sends `OT${n}`, never the flat string). Matched via regex instead of a fixed
        // list since the OT number is unbounded (a match can theoretically reach OT3+).
        const VALID_PERIODS = [
            'NOT_STARTED', 'FIRST_HALF', 'HALF_TIME', 'SECOND_HALF',
            'EXTRA_TIME_1', 'EXTRA_TIME_BREAK', 'EXTRA_TIME_2', 'PENALTY_SHOOTOUT',
            'FINISHED', 'SUSPENDED',
            'Q1', 'Q2', 'Q3', 'Q4',
        ] as const;
        if (body.currentPeriod !== undefined) {
            const isNumberedOT = /^OT\d+$/.test(body.currentPeriod);
            if (!VALID_PERIODS.includes(body.currentPeriod) && !isNumberedOT) {
                return NextResponse.json({ error: 'Invalid currentPeriod value' }, { status: 422 });
            }
            updateData.currentPeriod = body.currentPeriod;
        }
        // BUG-109: periodic DB checkpoint of the live clock — assigned logger or admin only
        // (already gated above), same integer-guard pattern as score. null clears the value
        // (e.g. on FINISHED) without requiring a separate code path.
        if (body.minute !== undefined) {
            if (body.minute !== null) {
                const m = Number(body.minute);
                if (!Number.isInteger(m) || m < 0 || m > 200) {
                    return NextResponse.json({ error: 'Invalid minute' }, { status: 422 });
                }
                updateData.minute = m;
            } else {
                updateData.minute = null;
            }
        }
        if (body.extraTime !== undefined) {
            if (body.extraTime !== null) {
                const e = Number(body.extraTime);
                if (!Number.isInteger(e) || e < 0 || e > 60) {
                    return NextResponse.json({ error: 'Invalid extraTime' }, { status: 422 });
                }
                updateData.extraTime = e;
            } else {
                updateData.extraTime = null;
            }
        }
        if (body.loggerId !== undefined) updateData.loggerId = body.loggerId;
        if (body.stats) updateData.stats = JSON.stringify(body.stats);
        if (body.lineups) updateData.lineups = JSON.stringify(body.lineups);

        // Additional fields for match details editing
        if (body.sport) updateData.sport = body.sport;
        if (body.homeTeamId) updateData.homeTeamId = body.homeTeamId;
        if (body.awayTeamId) updateData.awayTeamId = body.awayTeamId;
        if (body.startTime) updateData.startTime = new Date(body.startTime);
        if (body.venue) updateData.venue = body.venue;
        if (body.competition) updateData.competition = body.competition;
        if (body.competitionId) updateData.competitionId = body.competitionId;
        if (body.competitionLevel) updateData.competitionLevel = body.competitionLevel;
        if (body.matchType) updateData.matchType = body.matchType;
        if (body.friendlyType) updateData.friendlyType = body.friendlyType;
        if (body.friendlyDescription !== undefined) updateData.friendlyDescription = body.friendlyDescription;
        // Approval fields are admin-only — loggers must not write these
        if (authUser.role === 'admin') {
            if (body.approvalStatus) updateData.approvalStatus = body.approvalStatus;
            if (body.managerNotes !== undefined) updateData.managerNotes = body.managerNotes;
            if (body.approvedBy) updateData.approvedBy = body.approvedBy;
            if (body.approvedAt) updateData.approvedAt = new Date(body.approvedAt);
        }

        await db
            .update(matches)
            .set(updateData)
            .where(eq(matches.id, matchId));

        // Broadcast update via Socket.IO — was a raw `global.io` check, only ever true
        // when running the local custom server.js; dead code on Vercel's serverless
        // deployment, same class of gap as BUG-108. broadcastToMatch (src/lib/socket.ts)
        // handles both cases correctly (local global.io, or HTTP /broadcast on Railway).
        // after() rather than a bare fire-and-forget call — see events/route.ts's POST
        // handler for why (traced root cause of BUG-108/116's multi-second broadcast delay).
        after(() => broadcastToMatch(matchId, 'match:updated', { matchId, ...updateData }));

        // BACKLOG-097: standings/team-record recalculation, wired into the FINISHED
        // transition — see standingsService.ts for why this is safe to call more than
        // once (fully recomputed from FINISHED matches each time, not incremental).
        if (body.status === 'FINISHED') {
            after(async () => {
                try {
                    await recalculateStandingsForMatch(matchId);
                } catch (error) {
                    console.error('Error recalculating standings:', error);
                }
            });

            // BACKLOG-280: knockout bracket advancement -- own try/catch, own
            // after() call, deliberately isolated from the standings recalc
            // above so a bracket failure can never block or break it. No-ops
            // silently for the overwhelming majority of matches (not part of
            // any bracket).
            after(async () => {
                try {
                    await advanceBracketForMatch(matchId);
                } catch (error) {
                    console.error('Error advancing bracket:', error);
                }
            });
        }

        // Notification-reliability fix (same as events/route.ts's POST handler,
        // see that file's comment for the full BUG-108/116-class rationale): period
        // transitions used to notify only via MatchStateManager.triggerPeriodNotification()
        // dispatching a window CustomEvent from the logger's own tab. Moved server-side.
        //
        // Which currentPeriod values are notifiable, per sport, now lives in
        // notification-rules.ts's NOTIFICATION_RULES table (roadmap thread 5/7) --
        // basketball's 'FINISHED' -> MATCH_END entry there is now an explicit,
        // consciously-kept table row rather than an accidental match on a
        // football-shaped if-chain (it was firing unintentionally before Phase 2
        // formalized it — NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md thread 3).
        if (body.currentPeriod !== undefined) {
            after(async () => {
                try {
                    const [current] = await db
                        .select({
                            sport: matches.sport,
                            homeTeamId: matches.homeTeamId,
                            awayTeamId: matches.awayTeamId,
                            homeScore: matches.homeScore,
                            awayScore: matches.awayScore,
                            competitionId: matches.competitionId,
                        })
                        .from(matches)
                        .where(eq(matches.id, matchId));
                    if (!current) return;

                    // Sport-keyed lookup (notification-rules.ts) -- resolved here, not
                    // synchronously before scheduling after(), since it needs the match's
                    // sport and this avoids an extra query on the hot PATCH request path.
                    const periodEventType = getNotifiablePeriodType(current.sport, body.currentPeriod);
                    if (!periodEventType) return;

                    const [homeTeam, awayTeam] = await Promise.all([
                        db.select({ name: teams.name }).from(teams).where(eq(teams.id, current.homeTeamId)).get(),
                        db.select({ name: teams.name }).from(teams).where(eq(teams.id, current.awayTeamId)).get(),
                    ]);
                    await sendMatchEventNotification({
                        matchId,
                        homeTeamId: current.homeTeamId,
                        awayTeamId: current.awayTeamId,
                        eventType: periodEventType,
                        teamName: homeTeam && awayTeam ? `${homeTeam.name} vs ${awayTeam.name}` : undefined,
                        homeScore: current.homeScore ?? undefined,
                        awayScore: current.awayScore ?? undefined,
                        competitionId: current.competitionId,
                    });

                    // BUG-210: same in-app toast fix as events/route.ts's POST handler --
                    // server-side, no logger-tab dependency, works for basketball too.
                    // HALF_TIME maps to GlobalNotificationListener.tsx's 'PERIOD_CHANGE'
                    // type (its accepted-type list predates this sport-keyed HALF_TIME
                    // notion and was never updated -- mapped here rather than touching
                    // the listener's own vocabulary).
                    // periodEventType is narrowed to MATCH_START/HALF_TIME/MATCH_END at
                    // runtime (the only three values NOTIFICATION_RULES' periods maps
                    // produce for either sport) but typed as the full NotificationKey
                    // union, so TS can't see that -- explicit cast, not a real widening risk.
                    const toastType: 'MATCH_START' | 'MATCH_END' | 'PERIOD_CHANGE' =
                        periodEventType === 'HALF_TIME' ? 'PERIOD_CHANGE' : periodEventType as 'MATCH_START' | 'MATCH_END';
                    const toastMessage = periodEventType === 'MATCH_START'
                        ? `Match started: ${homeTeam?.name || 'Home'} vs ${awayTeam?.name || 'Away'}`
                        : periodEventType === 'HALF_TIME'
                            ? `Half time: ${current.homeScore ?? 0}-${current.awayScore ?? 0}`
                            : `Full time: ${current.homeScore ?? 0}-${current.awayScore ?? 0}`;
                    await broadcastGlobalNotification({
                        type: toastType,
                        message: toastMessage,
                        matchId,
                        homeTeamId: current.homeTeamId,
                        awayTeamId: current.awayTeamId,
                    });
                } catch (error) {
                    console.error('Error sending period notification:', error);
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Match updated successfully',
        });
    } catch (error) {
        console.error('Error updating match:', error);
        return NextResponse.json(
            { error: 'Failed to update match' },
            { status: 500 }
        );
    }
}

/**
 * DELETE match (Admin only)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: matchId } = await params;

        // Check if match exists
        const [existing] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId));

        if (!existing) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Handle constraint: bracketNodes - clear foreign key
        await db
            .update(bracketNodes)
            .set({ matchId: null })
            .where(eq(bracketNodes.matchId, matchId));

        // Handle constraint: headToHead - clear foreign key
        await db
            .update(headToHead)
            .set({ lastMatchId: null })
            .where(eq(headToHead.lastMatchId, matchId));

        // Handle constraint: teamForm - delete related records
        await db
            .delete(teamForm)
            .where(eq(teamForm.matchId, matchId));

        // Delete match (events, reminders, ratings, poll_votes, etc. will be cascade deleted)
        await db
            .delete(matches)
            .where(eq(matches.id, matchId));

        return NextResponse.json({
            success: true,
            message: 'Match deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting match:', error);
        return NextResponse.json(
            { error: 'Failed to delete match' },
            { status: 500 }
        );
    }
}
