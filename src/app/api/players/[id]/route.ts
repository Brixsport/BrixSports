/**
 * Player Detail API
 * GET /api/players/[id] - Get complete player information
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, teams, matchEvents, matches, playerStats, basketballPlayerStats, footballPlayerStats, playerTeamAffiliations, playerOrganizationAffiliations, organizations } from '@/db/schema';
import { eq, desc, and, sql, ne, inArray } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { enrichPlayersWithAffiliations, syncPlayerOrganizationAffiliations } from '@/lib/player-data';
import { getCurrentSeason } from '@/lib/rosterService';
import { getPlayerRatingSummaries } from '@/lib/playerRatingSummary';
import { playerRatings } from '@/db/schema-ratings';

interface RouteParams {
    params: {
        id: string;
    };
}

export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const authUser = await getAuthUser(request).catch(() => null);
        const isAdmin = authUser?.role === 'admin';

        const { id } = await params;

        // Get player details
        const [player] = await db
            .select()
            .from(players)
            .where(eq(players.id, id));

        if (!player) {
            return NextResponse.json(
                { error: 'Player not found' },
                { status: 404 }
            );
        }

        // BACKLOG-253: real career rating, sourced from playerRatings via the
        // shared accessor -- players.rating is a frozen/legacy default (7.0),
        // never updated by the real ratings pipeline.
        const ownRatingSummary = (await getPlayerRatingSummaries([id])).get(id) ?? null;

        // Get player's active memberships and primary team
        let team = null;
        const memberships = await db
            .select({
                affiliation: playerTeamAffiliations,
                team: teams,
            })
            .from(playerTeamAffiliations)
            .innerJoin(teams, eq(playerTeamAffiliations.teamId, teams.id))
            .where(
                and(
                    eq(playerTeamAffiliations.playerId, id),
                    eq(playerTeamAffiliations.isActive, true)
                )
            )
            .orderBy(desc(playerTeamAffiliations.isPrimary), desc(playerTeamAffiliations.createdAt));

        const organizationAffiliations = await db
            .select({
                affiliation: playerOrganizationAffiliations,
                organization: organizations,
            })
            .from(playerOrganizationAffiliations)
            .innerJoin(organizations, eq(playerOrganizationAffiliations.organizationId, organizations.id))
            .where(eq(playerOrganizationAffiliations.playerId, id))
            .orderBy(desc(playerOrganizationAffiliations.isPrimary), desc(playerOrganizationAffiliations.createdAt));

        // BACKLOG-126: full transfer/employment history -- every past affiliation is
        // preserved (a transfer closes the old row via endDate/isActive rather than
        // deleting it), but `memberships` above only ever surfaced the active one.
        // Admin-only, same as memberships.
        const affiliationHistory = await db
            .select({
                affiliation: playerTeamAffiliations,
                team: teams,
            })
            .from(playerTeamAffiliations)
            .innerJoin(teams, eq(playerTeamAffiliations.teamId, teams.id))
            .where(eq(playerTeamAffiliations.playerId, id))
            .orderBy(desc(playerTeamAffiliations.startDate), desc(playerTeamAffiliations.createdAt));

        if (memberships.length > 0) {
            team = memberships[0].team;
        } else if (player.teamId) {
            [team] = await db
                .select()
                .from(teams)
                .where(eq(teams.id, player.teamId));
        }

        // Get player's match events (goals, assists, cards, etc.)
        // Projection is deliberately narrow: excludes heavy unused match blobs
        // (lineups, stats) and fields banned from public responses in CLAUDE.md
        // (loggerId, approvalStatus, managerNotes, approvedBy) - nothing on
        // /players/[id] or the admin player page reads any of these.
        const playerEvents = await db
            .select({
                event: {
                    id: matchEvents.id,
                    matchId: matchEvents.matchId,
                    type: matchEvents.type,
                    minute: matchEvents.minute,
                    second: matchEvents.second,
                    period: matchEvents.period,
                    teamId: matchEvents.teamId,
                    playerId: matchEvents.playerId,
                    relatedPlayerId: matchEvents.relatedPlayerId,
                    detail: matchEvents.detail,
                    isEyePoint: matchEvents.isEyePoint,
                    value: matchEvents.value,
                    createdAt: matchEvents.createdAt,
                },
                match: {
                    id: matches.id,
                    sport: matches.sport,
                    homeTeamId: matches.homeTeamId,
                    awayTeamId: matches.awayTeamId,
                    homeScore: matches.homeScore,
                    awayScore: matches.awayScore,
                    status: matches.status,
                    startTime: matches.startTime,
                    venue: matches.venue,
                    competition: matches.competition,
                    competitionId: matches.competitionId,
                    round: matches.round,
                    matchday: matches.matchday,
                    groupName: matches.groupName,
                },
            })
            .from(matchEvents)
            .leftJoin(matches, eq(matchEvents.matchId, matches.id))
            .where(eq(matchEvents.playerId, id))
            .orderBy(desc(matches.startTime))
            .limit(50);

        // Event type strings are stored Title Case ("Goal", "Yellow Card") — normalize before comparing
        const normalizeType = (t: string) => t.toUpperCase().replace(/\s+/g, '_');

        // Calculate player statistics
        const goals = playerEvents.filter(e => normalizeType(e.event.type) === 'GOAL').length;
        const assists = playerEvents.filter(e => normalizeType(e.event.type) === 'ASSIST').length;
        const yellowCards = playerEvents.filter(e => normalizeType(e.event.type) === 'YELLOW_CARD').length;
        const redCards = playerEvents.filter(e => normalizeType(e.event.type) === 'RED_CARD').length;

        // Get matches the player participated in
        const primaryTeamId = team?.id || player.teamId;
        const playerMatches = primaryTeamId
            ? await db
                .select()
                .from(matches)
                .where(
                    and(
                        eq(matches.homeTeamId, primaryTeamId),
                        eq(matches.status, 'FINISHED')
                    )
                )
                .orderBy(desc(matches.startTime))
                .limit(10)
            : [];

        // Get recent form (last 5 distinct matches, each with its own events sorted chronologically)
        const seenMatchIds = new Set<string>();
        const recentMatchesWithEvents: { match: typeof playerEvents[number]['match']; events: typeof playerEvents[number]['event'][] }[] = [];
        for (const pe of playerEvents) {
            const matchId = pe.match?.id;
            if (!matchId || seenMatchIds.has(matchId)) continue;
            seenMatchIds.add(matchId);
            const eventsForMatch = playerEvents
                .filter(e => e.match?.id === matchId)
                .map(e => e.event)
                .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || (a.second ?? 0) - (b.second ?? 0));
            recentMatchesWithEvents.push({ match: pe.match, events: eventsForMatch });
            if (recentMatchesWithEvents.length >= 5) break;
        }

        // Resolve home/away team names for the recent-matches cards (admin and
        // public "recent performances" both need real team names, not just IDs)
        const recentTeamIds = [...new Set(recentMatchesWithEvents.flatMap(m => [m.match?.homeTeamId, m.match?.awayTeamId]).filter((id): id is string => !!id))];
        const recentTeams = recentTeamIds.length > 0
            ? await db.select({ id: teams.id, name: teams.name, shortName: teams.shortName }).from(teams).where(inArray(teams.id, recentTeamIds))
            : [];
        const teamById = new Map(recentTeams.map(t => [t.id, t]));

        // BACKLOG-254: PlayerProfileOverlay.tsx's per-match "recent performances"
        // badge had no per-match rating source at all and was showing the frozen
        // career-wide players.rating (BACKLOG-253) for every row. Real per-match
        // ratings, batched over just these <=5 matches.
        const recentMatchIds = [...seenMatchIds];
        const recentMatchRatings = recentMatchIds.length > 0
            ? await db
                .select({
                    matchId: playerRatings.matchId,
                    finalRating: playerRatings.finalRating,
                    autoRating: playerRatings.autoRating,
                })
                .from(playerRatings)
                .where(and(eq(playerRatings.playerId, id), inArray(playerRatings.matchId, recentMatchIds)))
            : [];
        const ratingByMatchId = new Map(recentMatchRatings.map(r => [r.matchId, r.finalRating ?? r.autoRating]));

        const recentMatchesWithTeams = recentMatchesWithEvents.map(m => ({
            ...m,
            rating: m.match?.id ? ratingByMatchId.get(m.match.id) ?? null : null,
            match: m.match ? {
                ...m.match,
                homeTeam: m.match.homeTeamId ? teamById.get(m.match.homeTeamId) ?? null : null,
                awayTeam: m.match.awayTeamId ? teamById.get(m.match.awayTeamId) ?? null : null,
            } : m.match,
        }));

        // Get player stats from specialized tables or generic table
        // Determine sport from team or matches
        const basketballTeamNames = ['TBK', 'Titans', 'Storm', 'Rim Reapers', 'Vikings', 'Siberia'];
        let playerSport = (team && basketballTeamNames.includes(team.name)) ? 'Basketball' : (team?.sport || 'Football');

        if (!playerSport || (playerSport === 'Football' && !team?.sport)) {
            if (playerEvents.length > 0 && playerEvents[0].match) {
                playerSport = playerEvents[0].match.sport || 'Football';
            }
        }

        // A player has one row per (season, competition), so an unfiltered .get()
        // would return an arbitrary row the moment a second season's stats exist.
        // Prefer CURRENT_SEASON rows -- but real data doesn't reliably have that
        // value yet (football_player_stats.season is still the literal schema
        // default '2024' on every real row; basketball's real rows are all
        // '2025/2026', a season CURRENT_SEASON has already moved past for roster
        // purposes) -- so an unconditional eq(season, CURRENT_SEASON) filter
        // would silently return empty stats for every real player today, a
        // regression caught by checking real data before trusting the first
        // version of this fix. Falls back to whichever season the most recently
        // updated row belongs to, rather than going empty or blending seasons.
        const currentSeason = await getCurrentSeason();
        function pickEffectiveSeasonRows<T extends { season: string; updatedAt: Date | null }>(rows: T[]): T[] {
            if (rows.length === 0) return [];
            const currentSeasonRows = rows.filter((r) => r.season === currentSeason);
            if (currentSeasonRows.length > 0) return currentSeasonRows;
            const latestSeason = [...rows].sort(
                (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
            )[0].season;
            return rows.filter((r) => r.season === latestSeason);
        }

        let basketballSeasonStats: any = null;
        if (playerSport === 'Basketball') {
            const allRows = await db
                .select()
                .from(basketballPlayerStats)
                .where(eq(basketballPlayerStats.playerId, id));
            const rows = pickEffectiveSeasonRows(allRows);
            if (rows.length > 0) {
                basketballSeasonStats = rows.reduce((acc, r) => ({
                    gamesPlayed: (acc.gamesPlayed || 0) + (r.gamesPlayed || 0),
                    minutesPlayed: (acc.minutesPlayed || 0) + (r.minutesPlayed || 0),
                    totalPoints: (acc.totalPoints || 0) + (r.totalPoints || 0),
                    fieldGoalsMade: (acc.fieldGoalsMade || 0) + (r.fieldGoalsMade || 0),
                    threePointersMade: (acc.threePointersMade || 0) + (r.threePointersMade || 0),
                    freeThrowsMade: (acc.freeThrowsMade || 0) + (r.freeThrowsMade || 0),
                    offensiveRebounds: (acc.offensiveRebounds || 0) + (r.offensiveRebounds || 0),
                    defensiveRebounds: (acc.defensiveRebounds || 0) + (r.defensiveRebounds || 0),
                    totalRebounds: (acc.totalRebounds || 0) + (r.totalRebounds || 0),
                    assists: (acc.assists || 0) + (r.assists || 0),
                    turnovers: (acc.turnovers || 0) + (r.turnovers || 0),
                    steals: (acc.steals || 0) + (r.steals || 0),
                    blocks: (acc.blocks || 0) + (r.blocks || 0),
                    personalFouls: (acc.personalFouls || 0) + (r.personalFouls || 0),
                }), {} as any);
            }
        }

        // Football-specific stats from specialized table -- same season-selection fix.
        let footballSeasonStats: any = null;
        if (playerSport === 'Football') {
            const allRows = await db
                .select()
                .from(footballPlayerStats)
                .where(eq(footballPlayerStats.playerId, id));
            const rows = pickEffectiveSeasonRows(allRows);
            if (rows.length > 0) {
                footballSeasonStats = rows.reduce((acc, r) => ({
                    appearances: (acc.appearances || 0) + (r.appearances || 0),
                    minutesPlayed: (acc.minutesPlayed || 0) + (r.minutesPlayed || 0),
                    goals: (acc.goals || 0) + (r.goals || 0),
                    assists: (acc.assists || 0) + (r.assists || 0),
                    yellowCards: (acc.yellowCards || 0) + (r.yellowCards || 0),
                    redCards: (acc.redCards || 0) + (r.redCards || 0),
                }), {} as any);
            }
        }

        // Get player stats from generic player_stats table (for fallback/legacy)
        const dbPlayerStats = await db
            .select()
            .from(playerStats)
            .where(eq(playerStats.playerId, id));

        // Calculate total stats across all competitions from legacy table
        const totalStats = dbPlayerStats.reduce((acc, stat) => ({
            totalPoints: acc.totalPoints + (stat.goals || 0),
            totalAssists: acc.totalAssists + (stat.assists || 0),
            totalAppearances: acc.totalAppearances + (stat.appearances || 0),
            totalMinutes: acc.totalMinutes + (stat.minutesPlayed || 0),
        }), { totalPoints: 0, totalAssists: 0, totalAppearances: 0, totalMinutes: 0 });

        // Basketball-specific stats from events (secondary source)
        const basketballEventsStats = {
            twoPointers: playerEvents.filter(e => e.event.type === 'BASKET_2PT').length,
            threePointers: playerEvents.filter(e => e.event.type === 'BASKET_3PT').length,
            freeThrows: playerEvents.filter(e => e.event.type === 'FREE_THROW').length,
            steals: playerEvents.filter(e => e.event.type === 'STEAL').length,
            blocks: playerEvents.filter(e => e.event.type === 'BLOCK').length,
            rebounds: playerEvents.filter(e => e.event.type === 'REBOUND').length,
            assists: playerEvents.filter(e => e.event.type === 'ASSIST').length,
        };

        // Combine all possible sources for the most accurate season stats
        const seasonStats = {
            // Priority 1: Basketball Specialized table
            totalPoints: basketballSeasonStats ? (basketballSeasonStats.totalPoints || 0) : (footballSeasonStats ? (footballSeasonStats.goals || 0) : totalStats.totalPoints),
            totalAssists: basketballSeasonStats ? (basketballSeasonStats.assists || 0) : (footballSeasonStats ? (footballSeasonStats.assists || 0) : totalStats.totalAssists),
            appearances: basketballSeasonStats ? (basketballSeasonStats.gamesPlayed || 0) : (footballSeasonStats ? (footballSeasonStats.appearances || 0) : (totalStats.totalAppearances || playerMatches.length)),
            minutesPlayed: basketballSeasonStats ? (basketballSeasonStats.minutesPlayed || 0) : (footballSeasonStats ? (footballSeasonStats.minutesPlayed || 0) : totalStats.totalMinutes),

            // Basketball-specific breakdown
            twoPointers: basketballSeasonStats ? ((basketballSeasonStats.fieldGoalsMade || 0) - (basketballSeasonStats.threePointersMade || 0)) : basketballEventsStats.twoPointers,
            threePointers: basketballSeasonStats ? (basketballSeasonStats.threePointersMade || 0) : basketballEventsStats.threePointers,
            freeThrows: basketballSeasonStats ? (basketballSeasonStats.freeThrowsMade || 0) : basketballEventsStats.freeThrows,
            steals: basketballSeasonStats ? (basketballSeasonStats.steals || 0) : basketballEventsStats.steals,
            blocks: basketballSeasonStats ? (basketballSeasonStats.blocks || 0) : basketballEventsStats.blocks,
            rebounds: basketballSeasonStats ? (basketballSeasonStats.totalRebounds || 0) : basketballEventsStats.rebounds,
            offensiveRebounds: basketballSeasonStats ? (basketballSeasonStats.offensiveRebounds || 0) : 0,
            defensiveRebounds: basketballSeasonStats ? (basketballSeasonStats.defensiveRebounds || 0) : 0,
            turnovers: basketballSeasonStats ? (basketballSeasonStats.turnovers || 0) : 0,
            personalFouls: basketballSeasonStats ? (basketballSeasonStats.personalFouls || 0) : 0,

            // Football-specific
            goals: playerSport === 'Basketball' ? (basketballSeasonStats?.totalPoints || totalStats.totalPoints) : (footballSeasonStats ? (footballSeasonStats.goals || 0) : goals),
            assists: playerSport === 'Basketball' ? (basketballSeasonStats?.assists || totalStats.totalAssists) : (footballSeasonStats ? (footballSeasonStats.assists || 0) : assists),
            yellowCards: footballSeasonStats ? (footballSeasonStats.yellowCards || 0) : yellowCards,
            redCards: footballSeasonStats ? (footballSeasonStats.redCards || 0) : redCards,

            // Calculated averages
            rating: ownRatingSummary?.averageRating ?? null,
            matchesRated: ownRatingSummary?.matchesRated ?? 0,
            motmCount: ownRatingSummary?.motmCount ?? 0,
            pointsPerGame: basketballSeasonStats
                ? ((basketballSeasonStats.gamesPlayed || 0) > 0 ? ((basketballSeasonStats.totalPoints || 0) / basketballSeasonStats.gamesPlayed).toFixed(1) : '0.0')
                : (totalStats.totalAppearances > 0 ? (totalStats.totalPoints / totalStats.totalAppearances).toFixed(1) : '0.0'),
            assistsPerGame: basketballSeasonStats
                ? ((basketballSeasonStats.gamesPlayed || 0) > 0 ? ((basketballSeasonStats.assists || 0) / basketballSeasonStats.gamesPlayed).toFixed(1) : '0.0')
                : (totalStats.totalAppearances > 0 ? (totalStats.totalAssists / totalStats.totalAppearances).toFixed(1) : '0.0'),
        };

        // Competition-specific stats
        const competitionStats = dbPlayerStats.map(stat => ({
            competition: stat.competition,
            sport: stat.sport,
            points: stat.goals || 0,
            assists: stat.assists || 0,
            appearances: stat.appearances || 0,
            minutesPlayed: stat.minutesPlayed || 0,
            averageRating: stat.averageRating || 0,
            pointsPerGame: stat.appearances ? ((stat.goals || 0) / stat.appearances).toFixed(1) : '0.0',
            assistsPerGame: stat.appearances ? ((stat.assists || 0) / stat.appearances).toFixed(1) : '0.0',
        }));

        // Group events by type for timeline
        const eventsByType = {
            goals: playerEvents.filter(e => normalizeType(e.event.type) === 'GOAL'),
            assists: playerEvents.filter(e => normalizeType(e.event.type) === 'ASSIST'),
            cards: playerEvents.filter(e => {
                const t = normalizeType(e.event.type);
                return t === 'YELLOW_CARD' || t === 'RED_CARD';
            }),
        };

        // Check for related profiles (Multi-sport)
        const relatedProfiles = [];
        if (player.profileId) {
            const relatedPlayersRaw = await db
                .select({
                    id: players.id,
                    name: players.name,
                    position: players.position,
                    teamName: teams.name,
                    teamId: teams.id,
                    sport: teams.sport
                })
                .from(players)
                .leftJoin(teams, eq(players.teamId, teams.id))
                .where(
                    and(
                        eq(players.profileId, player.profileId),
                        ne(players.id, id) // Exclude current profile
                    )
                );

            // BACKLOG-253: real rating per related profile, same accessor as
            // the main player above -- batched, not one query per profile.
            const relatedRatingSummaries = await getPlayerRatingSummaries(relatedPlayersRaw.map((p) => p.id));
            const relatedPlayers = relatedPlayersRaw.map((p) => ({
                ...p,
                rating: relatedRatingSummaries.get(p.id)?.averageRating ?? null,
            }));

            relatedProfiles.push(...relatedPlayers);
        }

        const { email: _email, profileId: _profileId, ...playerPublic } = player;
        const playerPayload = isAdmin ? player : playerPublic;

        // Public, curated subset of affiliationHistory -- team, sport, season,
        // and date range only. No role/status/nicknames/internal affiliation id
        // (those stay admin-only via the raw affiliationHistory field below).
        // Deliberately public per Richard's call, session 56: nothing in this
        // shape is on CLAUDE.md's banned-fields list -- it's the same "which
        // club, which season" info a fixture card already shows.
        const careerHistory = affiliationHistory.map((h) => ({
            teamId: h.team.id,
            teamName: h.team.name,
            sport: h.team.sport,
            affiliationType: h.affiliation.affiliationType,
            season: h.affiliation.season,
            startDate: h.affiliation.startDate,
            endDate: h.affiliation.endDate,
            isActive: h.affiliation.isActive,
        }));

        return NextResponse.json({
            player: {
                ...playerPayload,
                team: {
                    ...team,
                    sport: playerSport,
                },
                careerHistory,
                // memberships, organizationAffiliations, and the raw
                // affiliationHistory (role/status/nicknames included) stay
                // admin-only (CLAUDE.md banned public fields)
                ...(isAdmin ? { memberships, organizationAffiliations, affiliationHistory } : {}),
                relatedProfiles,
            },
            stats: seasonStats,
            competitionStats,
            recentMatches: recentMatchesWithTeams,
            events: eventsByType,
            allEvents: playerEvents.slice(0, 20).map(pe => ({
                ...pe.event,
                match: pe.match,
            })),
        });
    } catch (error) {
        console.error('Error fetching player details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch player details' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const user = await getAuthUser(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        // Whitelist only valid players table columns to avoid passing unknown fields to Drizzle
        // (players table has no updatedAt column — only createdAt)
        // BACKLOG-248/253: 'rating' removed -- players.rating is a frozen
        // legacy field, real rating now lives in playerRatings (see
        // playerRatingSummary.ts). An admin edit here used to silently write
        // a value every real reader now ignores.
        const allowedFields = [
            'name', 'jerseyName', 'number', 'teamId', 'position',
            'eyePoints', 'age', 'height', 'weight',
            'nationality', 'college', 'department', 'university',
            'image', 'marketValue', 'profileId', 'email', 'attributes',
        ] as const;

        const updateData: Partial<typeof players.$inferInsert> = {};
        const requestBody = body as Record<string, unknown>;
        for (const field of allowedFields) {
            if (field in requestBody && requestBody[field] !== undefined) {
                (updateData as Record<string, unknown>)[field] = requestBody[field];
            }
        }

        if (body.teamId && !updateData.university) {
            const selectedTeam = await db
                .select()
                .from(teams)
                .where(eq(teams.id, body.teamId))
                .get();

            if (selectedTeam?.university) {
                updateData.university = selectedTeam.university;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const updated = await db
            .update(players)
            .set(updateData)
            .where(eq(players.id, id))
            .returning();

        if (updated.length === 0) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        if (body.teamId) {
            await db
                .update(playerTeamAffiliations)
                .set({ isPrimary: false })
                .where(eq(playerTeamAffiliations.playerId, id));

            const existingAffiliation = await db
                .select()
                .from(playerTeamAffiliations)
                .where(
                    and(
                        eq(playerTeamAffiliations.playerId, id),
                        eq(playerTeamAffiliations.teamId, body.teamId)
                    )
                )
                .get();

            if (existingAffiliation) {
                await db
                    .update(playerTeamAffiliations)
                    .set({
                        role: 'player',
                        status: 'active',
                        isPrimary: true,
                        isActive: true,
                        jerseyNumber: updated[0].number,
                        position: updated[0].position,
                    })
                    .where(eq(playerTeamAffiliations.id, existingAffiliation.id));
            } else {
                await db.insert(playerTeamAffiliations).values({
                    id: `aff-${id}-${body.teamId}`,
                    playerId: id,
                    teamId: body.teamId,
                    affiliationType: 'team',
                    role: 'player',
                    status: 'active',
                    isPrimary: true,
                    isActive: true,
                    startDate: updated[0].createdAt || new Date(),
                    jerseyNumber: updated[0].number,
                    position: updated[0].position,
                    season: await getCurrentSeason(),
                    createdAt: updated[0].createdAt || new Date(),
                });
            }
        }

        await syncPlayerOrganizationAffiliations(id, {
            university: updated[0].university,
            college: updated[0].college,
            department: updated[0].department,
        });

        const [enrichedPlayer] = await enrichPlayersWithAffiliations(updated);
        return NextResponse.json(enrichedPlayer);
    } catch (error) {
        console.error('Error updating player:', error);
        return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const user = await getAuthUser(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const deleted = await db
            .delete(players)
            .where(eq(players.id, id))
            .returning();

        if (deleted.length === 0) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Player deleted successfully', deleted: deleted[0] });
    } catch (error) {
        console.error('Error deleting player:', error);
        return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
    }
}
