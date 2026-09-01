import { db } from '@/db';
import { playerRatings, teamRatings } from '@/db/schema-ratings';
import { matches, players, matchEvents } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { RatingCalculator, type PlayerStats } from '@/lib/ratingCalculator';
import { getRatingConfig } from '@/lib/ratingConfig';
import { calculateBasketballStatsFromEvents, calculateBasketballRating, type BasketballPlayerStats } from '@/lib/ratings/basketball';

// BACKLOG-124: this was previously only reachable via events/route.ts making an
// internal HTTP self-fetch to POST /api/matches/[id]/ratings -- which forwarded no
// Cookie/Authorization header, so it 401'd (silently swallowed) on every single
// live event, meaning auto-ratings had never actually run live since this feature
// was written. Separately, that same self-fetch was also the exact trigger for a
// local-dev hang: NEXT_PUBLIC_APP_URL points at a real deployed URL locally, so a
// LIVE-status event logged in local dev made a genuine outbound HTTPS request from
// within the same process handling the original request. Extracting the logic here
// removes the HTTP round-trip (and both bugs) structurally -- events/route.ts calls
// this directly since it has already verified the caller is admin/logger before
// this code ever runs, so there's no auth to forward or re-check. The public GET
// fallback in ratings/route.ts (which correctly forwards the viewer's own cookie
// through its own self-fetch) is intentionally untouched -- different security
// shape, out of this bug's scope.
export async function calculateAndSaveRatings(matchId: string) {
    const match = await db
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);

    if (match.length === 0) {
        throw new Error('Match not found');
    }

    // BACKLOG-146/159/255: sport dispatcher. Football and basketball each get their
    // own stat-extraction model below (football's keyword-matched `detail` parsing
    // vs basketball's typed event/value model in src/lib/ratings/basketball.ts) --
    // their event vocabularies share almost nothing. Track & field is explicitly
    // not implemented: its only plausible data source (a `Finish` event carrying
    // `{position, time}`) isn't produced by any live logger, so there's nothing
    // real to build a rating model against yet (BACKLOG-255).
    const sport = (match[0].sport ?? 'Football').toLowerCase();
    const isBasketball = sport.includes('basketball');
    if (!sport.includes('football') && !isBasketball) {
        throw new Error(`calculateAndSaveRatings: no rating model exists for sport "${match[0].sport}" yet (BACKLOG-255)`);
    }

    const events = await db
        .select()
        .from(matchEvents)
        .where(eq(matchEvents.matchId, matchId));

    const lineups = match[0].lineups ? JSON.parse(match[0].lineups) : null;

    if (!lineups) {
        throw new Error('No lineups found for this match');
    }

    const getPlayersFromTeam = (teamLineup: any) => {
        if (!teamLineup) return [];

        if (Array.isArray(teamLineup)) {
            return teamLineup;
        }

        if (teamLineup.starters || teamLineup.substitutes) {
            // BACKLOG-306: same fix as ratings/initialize/route.ts -- real
            // published lineups key the second array `substitutes`, never
            // `bench`.
            return [
                ...(teamLineup.starters || []),
                ...(teamLineup.substitutes || [])
            ];
        }

        return [];
    };

    const homePlayers = getPlayersFromTeam(lineups.home).map((p: any) => ({ ...p, team: 'home' }));
    const awayPlayers = getPlayersFromTeam(lineups.away).map((p: any) => ({ ...p, team: 'away' }));
    const allPlayers = [...homePlayers, ...awayPlayers];

    const playerIds = allPlayers.map(p => p.playerId).filter(Boolean);
    const playersList = playerIds.length > 0
        ? await db
            .select()
            .from(players)
            .where(sql`${players.id} IN (${sql.join(playerIds.map(id => sql`${id}`), sql`, `)})`)
        : [];

    const playersMap = new Map(playersList.map(p => [p.id, p]));

    const playerStats = new Map<string, { teamId: string; footballStats?: PlayerStats; basketballStats?: BasketballPlayerStats }>();

    for (const lineupEntry of allPlayers) {
        const playerId = lineupEntry.playerId;
        if (!playerId) continue;

        const player = playersMap.get(playerId);
        if (!player) continue;

        const teamId = lineupEntry.team === 'home' ? match[0].homeTeamId : match[0].awayTeamId;

        if (isBasketball) {
            // events passed unfiltered -- calculateBasketballStatsFromEvents needs
            // the full match event list to credit assists via relatedPlayerId on a
            // teammate's shot event, not just this player's own events.
            const basketballStats = calculateBasketballStatsFromEvents(playerId, events);
            playerStats.set(playerId, { teamId, basketballStats });
            continue;
        }

        const playerEvents = events.filter(e => e.playerId === playerId);

        const countByType = (type: string) => playerEvents.filter(e => e.type === type).length;
        const countByDetail = (detailKeyword: string) => playerEvents.filter(e => e.detail?.toLowerCase().includes(detailKeyword.toLowerCase())).length;

        // Code review finding (football-side pass, following the basketball-side review):
        // three of this block's fields never matched any real event FootballLogger.tsx
        // actually produces -- confirmed against its real event-creation code, not
        // assumed. Goals/shots/substitution detection below are fixed; every other
        // countByDetail(...) keyword here is unverified against real data and may have
        // the same class of bug (tracked separately, not blocking this fix).
        const subOutEvent = playerEvents.find(e => e.type === 'Substitution');

        const footballStats = {
            playerId,
            position: lineupEntry.position || player.position || 'CM',

            // A converted penalty logs type: 'Penalty', never 'Goal' (confirmEvent
            // in FootballLogger.tsx) -- was silently excluded from both the goal
            // count and the team's scoreMetric.
            goals: countByType('Goal') + countByType('Penalty'),
            assists: countByDetail('assist'),
            // Real event types are 'Shot on Target'/'Shot off Target' -- bare 'Shot'
            // is never emitted, so countByType('Shot') was always 0. detail on these
            // events is just the player's name (no override exists), so the
            // countByDetail() half was equally dead.
            shotsOnTarget: countByType('Shot on Target'),
            shotsOffTarget: countByType('Shot off Target'),

            saves: countByType('Save'),
            tackles: countByType('Tackle'),
            tacklesMissed: countByDetail('missed tackle'),
            interceptions: countByType('Interception'),
            clearances: countByType('Clearance'),
            blocks: countByType('Block'),

            passesCompleted: countByDetail('completed') + countByDetail('successful pass'),
            passesFailed: countByDetail('failed pass') + countByDetail('incomplete'),
            dribblesCompleted: countByDetail('successful dribble') + countByDetail('beat'),
            dribblesFailed: countByDetail('failed dribble') + countByDetail('tackled'),

            cornersWon: countByType('Corner') + countByDetail('won'),
            cornersConceded: countByDetail('conceded corner'),
            freeKicksWon: countByType('Free Kick') + countByDetail('fouled') + countByDetail('won free kick'),
            freeKicksConceded: countByDetail('conceded free kick') + countByDetail('foul'),

            yellowCards: countByType('Yellow Card'),
            redCards: countByType('Red Card'),
            fouls: countByType('Foul'),
            offsides: countByType('Offside'),

            ownGoals: countByType('Own Goal'),
            // detail on Penalty/Penalty Missed/Penalty Saved events is just the
            // taker's name (no keyword override exists) -- countByDetail() could
            // never match any of these. penaltiesSaved specifically credits the
            // GOALKEEPER (ratingCalculator.ts's "GK bonus"), and the keeper is the
            // event's relatedPlayerId, not playerId (confirmEvent('Penalty Saved',
            // takerId, keeperId)) -- must check the unfiltered `events` list, not
            // this player's own playerEvents, or it silently credits the taker instead.
            penaltiesScored: countByType('Penalty'),
            penaltiesMissed: countByType('Penalty Missed'),
            penaltiesSaved: events.filter(e => e.type === 'Penalty Saved' && e.relatedPlayerId === playerId).length,

            eyePoints: playerEvents.filter(e => e.isEyePoint).length,
            // Substitution's real detail shape is "<incoming> IN for <outgoing>"
            // (FootballLogger.tsx) -- never contains "out", so the old
            // e.detail?.includes('out') check could never match. playerId on a
            // Substitution row is the player going OUT, so any such row on this
            // player's own events means they were subbed off. minutesPlayed was
            // hardcoded to 90 for every player in every match -- now derived from
            // the real event minute when a sub-off occurred.
            isSubstituted: !!subOutEvent,
            minutesPlayed: subOutEvent ? subOutEvent.minute : 90
        };

        playerStats.set(playerId, { teamId, footballStats });
    }

    // BACKLOG-318: fetched once per match-event, not per player -- this loop runs
    // on the live per-event hot path (see BACKLOG-159/255's note on its latency
    // contribution), and getRatingConfig() is itself cached (60s) on top of that.
    const ratingConfig = await getRatingConfig();

    const updatedRatings: { playerId: string; teamId: string; rating: number; breakdown: unknown }[] = [];
    // `goals` doubles as basketball's "points scored" for the team-total metric --
    // the teamRatings table has no separate points column, and this field was never
    // read anywhere outside this file (grep-confirmed), so reusing it is safe. Still
    // named `goals` because the DB column is.
    const teamPlayerRatings = new Map<string, { total: number; count: number; goals: number }>();
    const updatedTeamRatings: { teamId: string; rating: number; playerCount: number; goals: number }[] = [];

    // Code-review finding (BACKLOG-255 follow-up): this used to be SELECT-then-
    // branch (UPDATE if found, else INSERT) per player/team, with no DB-level
    // uniqueness on (matchId, playerId)/(matchId, teamId) and no transaction
    // around the loop. Two concurrent calls for the same match (confirmed live:
    // the new FINISHED-transition trigger racing the pre-existing GET-route
    // auto-calc fallback, which MatchOverlay.tsx fires the instant it observes
    // FINISHED status) could both see "not found" and both INSERT -- confirmed
    // on real staging data (84 duplicate player_ratings rows, 4 duplicate
    // team_ratings rows found and cleaned up, migration
    // dev/migrate-backlog255-ratings-unique-index.mjs). Now a real atomic
    // upsert against that unique index, and the whole write phase runs in one
    // transaction so a mid-loop failure can't leave a partial rating set with
    // no rollback (CLAUDE.md: "Write operations that affect match state must
    // be atomic or handle partial failure explicitly").
    await db.transaction(async (tx) => {
        for (const [playerId, entry] of playerStats.entries()) {
            const { teamId } = entry;
            const { rating, breakdown, scoreMetric } = isBasketball
                ? { ...calculateBasketballRating(entry.basketballStats!, ratingConfig), scoreMetric: entry.basketballStats!.points }
                : { ...RatingCalculator.calculateAutoRating(entry.footballStats!, ratingConfig), scoreMetric: entry.footballStats!.goals };

            if (!teamPlayerRatings.has(teamId)) {
                teamPlayerRatings.set(teamId, { total: 0, count: 0, goals: 0 });
            }
            const teamStats = teamPlayerRatings.get(teamId)!;
            teamStats.total += rating;
            teamStats.count += 1;
            teamStats.goals += scoreMetric;

            const ratingId = `rating-${matchId}-${playerId}-${Date.now()}`;
            await tx
                .insert(playerRatings)
                .values({
                    id: ratingId,
                    matchId,
                    playerId,
                    teamId,
                    autoRating: rating,
                    ratingBreakdown: breakdown as any
                })
                .onConflictDoUpdate({
                    target: [playerRatings.matchId, playerRatings.playerId],
                    set: {
                        autoRating: rating,
                        ratingBreakdown: breakdown as any,
                        updatedAt: new Date()
                    }
                });

            updatedRatings.push({ playerId, teamId, rating, breakdown });
        }

        for (const [teamId, stats] of teamPlayerRatings.entries()) {
            const teamRating = stats.count > 0 ? stats.total / stats.count : 6.0;
            const roundedRating = Math.round(teamRating * 10) / 10;

            const teamRatingId = `team-rating-${matchId}-${teamId}-${Date.now()}`;
            await tx
                .insert(teamRatings)
                .values({
                    id: teamRatingId,
                    matchId,
                    teamId,
                    rating: roundedRating,
                    playerCount: stats.count,
                    totalPlayerRating: stats.total,
                    goals: stats.goals
                })
                .onConflictDoUpdate({
                    target: [teamRatings.matchId, teamRatings.teamId],
                    set: {
                        rating: roundedRating,
                        playerCount: stats.count,
                        totalPlayerRating: stats.total,
                        goals: stats.goals,
                        updatedAt: new Date()
                    }
                });

            updatedTeamRatings.push({
                teamId,
                rating: roundedRating,
                playerCount: stats.count,
                goals: stats.goals
            });
        }
    });

    return {
        ratingsUpdated: updatedRatings.length,
        teamRatingsUpdated: updatedTeamRatings.length,
        ratings: updatedRatings,
        teamRatings: updatedTeamRatings
    };
}
