import { db } from '@/db';
import { playerRatings, teamRatings } from '@/db/schema-ratings';
import { matches, players, matchEvents } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { RatingCalculator } from '@/lib/ratingCalculator';

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

    // BACKLOG-146/159: this function's entire stat-extraction model below (goals,
    // tackles, corners, dribbles, offsides) is football-shaped -- it has zero
    // basketball-aware event mapping (Field Goal/Three Pointer/Free Throw/Rebound/
    // Assist/Steal/Block/Turnover). It never ran for basketball before tonight only
    // because match.lineups was always empty (BACKLOG-146's original blocker,
    // resolved by BACKLOG-141's real lineup persistence, session 47E). Without this
    // guard, basketball matches would now silently compute and write near-meaningless
    // ratings (almost every football-specific stat reads as 0, only 'Foul' happens
    // to coincidentally match) the moment a lineup is confirmed -- worse than the
    // previous "throws, does nothing" state, since it looks like real data. Real fix
    // needs basketball-aware stat extraction (own scope, tracked in BACKLOG-159's
    // "two disconnected rating pipelines" finding), not built here.
    const sport = (match[0].sport ?? 'Football').toLowerCase();
    if (!sport.includes('football')) {
        throw new Error(`calculateAndSaveRatings: no rating model exists for sport "${match[0].sport}" yet (BACKLOG-159)`);
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

        if (teamLineup.starters || teamLineup.bench) {
            return [
                ...(teamLineup.starters || []),
                ...(teamLineup.bench || [])
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

    const playerStats = new Map();

    for (const lineupEntry of allPlayers) {
        const playerId = lineupEntry.playerId;
        if (!playerId) continue;

        const player = playersMap.get(playerId);
        if (!player) continue;

        const playerEvents = events.filter(e => e.playerId === playerId);

        const countByType = (type: string) => playerEvents.filter(e => e.type === type).length;
        const countByDetail = (detailKeyword: string) => playerEvents.filter(e => e.detail?.toLowerCase().includes(detailKeyword.toLowerCase())).length;

        const stats = {
            playerId,
            teamId: lineupEntry.team === 'home' ? match[0].homeTeamId : match[0].awayTeamId,
            position: lineupEntry.position || player.position || 'CM',

            goals: countByType('Goal'),
            assists: countByDetail('assist'),
            shotsOnTarget: countByType('Shot') + countByDetail('on target'),
            shotsOffTarget: countByDetail('off target') + countByDetail('missed'),

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
            penaltiesScored: countByDetail('penalty scored'),
            penaltiesMissed: countByDetail('penalty missed'),
            penaltiesSaved: countByDetail('penalty saved'),

            eyePoints: playerEvents.filter(e => e.isEyePoint).length,
            isSubstituted: playerEvents.some(e => e.type === 'Substitution' && e.detail?.includes('out')),
            minutesPlayed: 90
        };

        playerStats.set(playerId, stats);
    }

    const updatedRatings = [];
    const teamPlayerRatings = new Map<string, { total: number; count: number; goals: number }>();

    for (const [playerId, stats] of playerStats.entries()) {
        const { rating, breakdown } = RatingCalculator.calculateAutoRating(stats);

        if (!teamPlayerRatings.has(stats.teamId)) {
            teamPlayerRatings.set(stats.teamId, { total: 0, count: 0, goals: 0 });
        }
        const teamStats = teamPlayerRatings.get(stats.teamId)!;
        teamStats.total += rating;
        teamStats.count += 1;
        teamStats.goals += stats.goals;

        const existingRating = await db
            .select()
            .from(playerRatings)
            .where(
                and(
                    eq(playerRatings.matchId, matchId),
                    eq(playerRatings.playerId, playerId)
                )
            )
            .limit(1);

        if (existingRating.length > 0) {
            await db
                .update(playerRatings)
                .set({
                    autoRating: rating,
                    ratingBreakdown: breakdown,
                    updatedAt: new Date()
                })
                .where(eq(playerRatings.id, existingRating[0].id));
        } else {
            const ratingId = `rating-${matchId}-${playerId}-${Date.now()}`;

            await db.insert(playerRatings).values({
                id: ratingId,
                matchId,
                playerId,
                teamId: stats.teamId,
                autoRating: rating,
                ratingBreakdown: breakdown
            });
        }

        updatedRatings.push({ playerId, teamId: stats.teamId, rating, breakdown });
    }

    const updatedTeamRatings = [];
    for (const [teamId, stats] of teamPlayerRatings.entries()) {
        const teamRating = stats.count > 0 ? stats.total / stats.count : 6.0;

        const existingTeamRating = await db
            .select()
            .from(teamRatings)
            .where(
                and(
                    eq(teamRatings.matchId, matchId),
                    eq(teamRatings.teamId, teamId)
                )
            )
            .limit(1);

        if (existingTeamRating.length > 0) {
            await db
                .update(teamRatings)
                .set({
                    rating: Math.round(teamRating * 10) / 10,
                    playerCount: stats.count,
                    totalPlayerRating: stats.total,
                    goals: stats.goals,
                    updatedAt: new Date()
                })
                .where(eq(teamRatings.id, existingTeamRating[0].id));
        } else {
            const teamRatingId = `team-rating-${matchId}-${teamId}-${Date.now()}`;
            await db.insert(teamRatings).values({
                id: teamRatingId,
                matchId,
                teamId,
                rating: Math.round(teamRating * 10) / 10,
                playerCount: stats.count,
                totalPlayerRating: stats.total,
                goals: stats.goals
            });
        }

        updatedTeamRatings.push({
            teamId,
            rating: Math.round(teamRating * 10) / 10,
            playerCount: stats.count,
            goals: stats.goals
        });
    }

    return {
        ratingsUpdated: updatedRatings.length,
        teamRatingsUpdated: updatedTeamRatings.length,
        ratings: updatedRatings,
        teamRatings: updatedTeamRatings
    };
}
