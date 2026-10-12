/**
 * Match detail read path shared by GET /api/matches/[id] (session aware) and
 * GET /api/matches/[id]/public (cookie free, edge cacheable).
 *
 * Statement budget per request: one round trip for the match (with both teams) and the
 * events (with player and related player) together, then at most one more for the stored
 * ratings. The ratings read starts as soon as it is known that lineups will exist, so it
 * overlaps the basketball per-player rating summary read.
 */

import { db } from '@/db';
import { matches, teams, matchEvents, players } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { playerRatings } from '@/db/schema-ratings';
import { getPlayerRatingSummaries } from '@/lib/playerRatingSummary';
import { toEventDto, gateLineups, toMatchDto } from '@/lib/match-detail-shape';

const teamFields = <T extends Record<'id' | 'name' | 'shortName' | 'logo' | 'university' | 'color', any>>(t: T) => ({
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    logo: t.logo,
    university: t.university,
    color: t.color,
});

const playerFields = <T extends Record<'id' | 'name' | 'jerseyName' | 'number' | 'position', any>>(p: T) => ({
    id: p.id,
    name: p.name,
    jerseyName: p.jerseyName,
    number: p.number,
    position: p.position,
});

function fetchMatchRatings(matchId: string) {
    return db
        .select({
            playerId: playerRatings.playerId,
            finalRating: playerRatings.finalRating,
            autoRating: playerRatings.autoRating,
            isMotM: playerRatings.isMotM,
        })
        .from(playerRatings)
        .where(eq(playerRatings.matchId, matchId))
        .limit(100)
        .then(
            (rows) => rows,
            (err) => {
                console.error('Error merging ratings:', err);
                return [];
            }
        );
}

/**
 * Loads the match detail payload. `isStaff` may be a pending promise: it is only awaited once
 * the database reads have been issued, so resolving the session never delays them.
 * Returns null when the match does not exist.
 */
export async function loadMatchDetail(matchId: string, isStaffInput: boolean | Promise<boolean>) {
    const awayTeams = alias(teams, 'away_team');
    const relatedPlayers = alias(players, 'related_player');

    const [matchRows, eventsData] = await Promise.all([
        db
            .select({
                match: matches,
                homeTeam: teamFields(teams),
                awayTeam: teamFields(awayTeams),
            })
            .from(matches)
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .leftJoin(awayTeams, eq(matches.awayTeamId, awayTeams.id))
            .where(eq(matches.id, matchId))
            .limit(1),
        db
            .select({
                event: matchEvents,
                player: playerFields(players),
                relatedPlayer: playerFields(relatedPlayers),
            })
            .from(matchEvents)
            .leftJoin(players, eq(matchEvents.playerId, players.id))
            .leftJoin(relatedPlayers, eq(matchEvents.relatedPlayerId, relatedPlayers.id))
            .where(eq(matchEvents.matchId, matchId))
            .orderBy(desc(matchEvents.minute), desc(matchEvents.second))
            .limit(500),
    ]);

    const [matchRow] = matchRows;
    if (!matchRow) return null;

    const isStaff = await isStaffInput;
    const match = { match: matchRow.match, homeTeam: matchRow.homeTeam };
    const awayTeam = matchRow.awayTeam?.id ? matchRow.awayTeam : undefined;

    // Competition is stored as text field in matches table
    const competition = match.match.competition;

    const events = eventsData.map((row) => toEventDto(row as any, isStaff));

    // Parse lineups if available
    let lineups: any = null;
    if (match.match.lineups) {
        try {
            lineups = JSON.parse(match.match.lineups);
        } catch (e) {
            console.error('Error parsing lineups:', e);
        }
    }

    lineups = gateLineups(lineups, isStaff);

    // The stored ratings are merged into whatever lineups end up in the response, so the read
    // starts as soon as it is known that lineups will exist.
    const willHaveLineups = !!lineups || (match.match.sport === 'Basketball' && events.length > 0);
    const ratingsPromise = willHaveLineups ? fetchMatchRatings(matchId) : null;

    // If lineups are not available for basketball, generate from events
    if (!lineups && match.match.sport === 'Basketball' && events.length > 0) {
        console.log('ðŸ€ Generating lineups from', events.length, 'events');
        const homePlayerStats: any = {};
        const awayPlayerStats: any = {};

        // real (career-average) rating instead of the frozen
        // players.rating default -- batched once here, not per-event, to
        // avoid N+1 inside the forEach below. Career-wide rather than
        // strictly this-match-scoped (playerRatings has no per-match
        // fallback-lineup consumer today); still a real improvement over
        // a hardcoded 7.0 for every player with no rating history at all.
        const eventPlayerIds = Array.from(new Set(events.map((e: any) => e.playerId).filter(Boolean)));
        const eventPlayerRatings = await getPlayerRatingSummaries(eventPlayerIds);

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
                    rating: eventPlayerRatings.get(event.playerId)?.averageRating ?? null,
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

            // this switch matched on '2PT_MADE'/'3PT_MADE'/'FREE_THROW'/
            // 'REBOUND'/'ASSIST'/'STEAL'/'BLOCK' -- the same dead case-label bug
            // the team-stats fix already covered in the team-stats block below. Real event
            // types (both live and backfilled) are 'Field Goal'/'Three Pointer'/
            // 'Free Throw'/'Rebound'/'Assist'/'Steal'/'Block'. Every case here was
            // dead on arrival, so every player's points/rebounds/assists/steals/
            // blocks in this fallback lineup were always 0. Same made/miss shape
            // handling as the team-stats block just above (live: numeric; backfilled:
            // raw 'made'/'missed' string).
            const made = typeof event.value === 'string' ? event.value === 'made' : Number(event.value) > 0;

            switch (event.type) {
                case 'Field Goal':
                    if (made) playerStats.points += 2;
                    break;
                case 'Three Pointer':
                    if (made) playerStats.points += 3;
                    break;
                case 'Free Throw':
                    if (made) playerStats.points += 1;
                    break;
                case 'Rebound':
                    playerStats.rebounds++;
                    break;
                case 'Assist':
                    playerStats.assists++;
                    break;
                case 'Steal':
                    playerStats.steals++;
                    break;
                case 'Block':
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
    // goals-only backfilled matches (no team logsheet) only ever write
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
    // this switch previously matched on '2PT_MADE'/'3PT_MADE'/'FREE_THROW'/
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
            // event.value's shape depends on the event's source, not just
            // its type -- live-logged events carry a real JSON number (2/3/1 on a make,
            // 0 on a miss, per BasketballLogger.tsx's own convention), but box-score
            // backfilled events (dev/generate-basketball-events-from-boxscores.mjs)
            // carry the raw string 'made'/'missed'/null (safeParseEventValue falls back
            // to the raw string since it isn't valid JSON). `Number(event.value) > 0`
            // only ever handled the live shape -- Number('made') is NaN, so every
            // backfilled make silently counted as a miss.
            const made = typeof event.value === 'string' ? event.value === 'made' : Number(event.value) > 0;

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

        // the actual originally-filed gap -- percentage fields were never
        // computed at all, so BasketballMatchOverlay.tsx's Field Goal %/3-Point %/Free
        // Throw % bars always rendered a flat 0% regardless of the (now-fixed) counters
        // above.
        const pct = (made: number, attempted: number) => attempted > 0 ? Math.round((made / attempted) * 100) : 0;
        stats.fieldGoalPercentage = [pct(stats.homeFieldGoalsMade, stats.homeFieldGoalsAttempted), pct(stats.awayFieldGoalsMade, stats.awayFieldGoalsAttempted)];
        stats.threePointPercentage = [pct(stats.homeThreePointersMade, stats.homeThreePointersAttempted), pct(stats.awayThreePointersMade, stats.awayThreePointersAttempted)];
        stats.freeThrowPercentage = [pct(stats.homeFreeThrowsMade, stats.homeFreeThrowsAttempted), pct(stats.awayFreeThrowsMade, stats.awayFreeThrowsAttempted)];
    }


    // Merge updated ratings into lineups
    if (lineups) {
        try {
            const updatedRatings = ratingsPromise ? await ratingsPromise : [];

            if (updatedRatings.length > 0) {
                const ratingMap = new Map<string, { rating: number; isMotM: boolean }>();
                updatedRatings.forEach(r => {
                    ratingMap.set(r.playerId, { rating: r.finalRating ?? r.autoRating, isMotM: !!r.isMotM });
                });

                // Found while wiring the ratings display:
                // saved lineups (Lineup Builder / admin/match-lineups) are stored
                // as { formation, starters: [...], substitutes: [...], ... }, not
                // a bare array -- the old `Array.isArray(players)` guard silently
                // no-op'd on every real lineup, so this merge never actually ran.
                // Also keyed off `p.id`, which lineup entries never carry (only
                // `p.playerId`) -- so even a bare-array shape would have matched
                // nothing. Confirmed live: player_ratings had real rows for a
                // finished match whose lineup showed no ratings at all.
                //
                // isMotM was never merged in here either -- the pitch
                // marker (PitchPlayer.tsx) and lineup card (ResponsivePlayerCard.tsx)
                // components already have real gold-highlight/badge rendering for a
                // real isMotM=true prop, but the actual value never reached them from
                // this route, so a real admin-designated Man of the Match never
                // visibly showed up anywhere on a real match page.
                const applyRatings = (arr: any[]) =>
                    arr.map((p: any) => {
                        const pid = p.playerId ?? p.id;
                        const entry = ratingMap.get(pid);
                        return {
                            ...p,
                            rating: entry ? entry.rating : (p.rating ?? 0),
                            isMotM: entry ? entry.isMotM : (p.isMotM ?? false),
                        };
                    });

                const updatePlayerRatings = (entry: any) => {
                    if (Array.isArray(entry)) return applyRatings(entry);
                    if (entry && typeof entry === 'object') {
                        return {
                            ...entry,
                            starters: Array.isArray(entry.starters) ? applyRatings(entry.starters) : entry.starters,
                            substitutes: Array.isArray(entry.substitutes) ? applyRatings(entry.substitutes) : entry.substitutes,
                        };
                    }
                    return entry;
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

    return {
        match: {
            ...toMatchDto(match.match),
            homeTeam: match.homeTeam,
            awayTeam,
            competition,
            lineups,
            stats,
        },
        events,
    };
}
