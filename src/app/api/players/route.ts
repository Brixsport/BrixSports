import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { playerTeamAffiliations, players, teams } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { enrichPlayersWithAffiliations, toPublicPlayer, type EnrichedPlayer, syncPlayerOrganizationAffiliations } from '@/lib/player-data';
import { getPrimaryTeam, getResolvedInstitutionalData, playerMatchesInstitutionFilters } from '@/lib/player-affiliation-utils';
import { getCurrentSeason } from '@/lib/rosterService';
import { checkRateLimit } from '@/lib/rate-limit';

function playerMatchesSearch(player: EnrichedPlayer, query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return true;
    }

    const primaryTeam = getPrimaryTeam(player);
    const institutionalData = getResolvedInstitutionalData(player, primaryTeam);
    const searchableTerms = [
        player.name,
        player.jerseyName,
        player.id,
        player.email,
        institutionalData.university,
        institutionalData.college,
        institutionalData.department,
        primaryTeam?.name,
        primaryTeam?.shortName,
        primaryTeam?.university,
        ...(player.memberships ?? []).flatMap((membership) => [
            membership.team.name,
            membership.team.shortName,
            membership.team.university,
            membership.team.sport,
        ]),
        ...(player.organizationAffiliations ?? []).flatMap((affiliation) => [
            affiliation.organization.name,
            affiliation.organization.shortName,
            affiliation.organization.displayName,
        ]),
    ].filter((value): value is string => Boolean(value));

    return searchableTerms.some((term) => term.toLowerCase().includes(normalizedQuery));
}

export async function GET(request: Request) {
    try {
        const rl = checkRateLimit(request);
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        const authUser = await getAuthUser(request as any).catch(() => null);
        const isAdmin = authUser?.role === 'admin';

        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const ids = searchParams.get('ids');
        const search = searchParams.get('search');
        const department = searchParams.get('department');
        const college = searchParams.get('college');
        const university = searchParams.get('university');
        // BACKLOG-283: default stays 500 (the pre-existing safety cap), NOT
        // 50 -- admin/past-matches/import/page.tsx calls this bare expecting
        // the full 309-player roster, and other pages may too. Only a caller
        // that explicitly passes `limit` opts into a smaller page. Only
        // applies to the general listing branch below (ids/teamId are
        // targeted lookups, already bounded by their own query).
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '500', 10) || 500), 500);
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

        if (ids) {
            const playerIds = ids.split(',').map((id) => id.trim()).filter(Boolean);
            if (playerIds.length === 0) {
                return NextResponse.json({ success: true, players: [] });
            }

            const foundPlayers = await db.select().from(players).where(inArray(players.id, playerIds));
            const enriched = await enrichPlayersWithAffiliations(foundPlayers);
            return NextResponse.json({
                success: true,
                players: enriched.map((p) => toPublicPlayer(p, isAdmin)),
            });
        }

        if (teamId) {
            const affiliatedRows = await db
                .select({ player: players })
                .from(playerTeamAffiliations)
                .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                .where(
                    and(
                        eq(playerTeamAffiliations.teamId, teamId),
                        eq(playerTeamAffiliations.isActive, true)
                    )
                );

            const legacyRows = await db
                .select()
                .from(players)
                .where(eq(players.teamId, teamId));

            const combinedMap = new Map<string, typeof players.$inferSelect>();
            for (const row of affiliatedRows) {
                combinedMap.set(row.player.id, row.player);
            }
            for (const row of legacyRows) {
                combinedMap.set(row.id, row);
            }

            const enrichedTeamPlayers = await enrichPlayersWithAffiliations(Array.from(combinedMap.values()));
            return NextResponse.json({
                success: true,
                players: enrichedTeamPlayers.map((p) => toPublicPlayer(p, isAdmin)),
            });
        }

        // Safety cap — prevents unbounded full-table scan. Raise if player count genuinely exceeds 500.
        const allPlayers = await db.select().from(players).limit(500);
        let enrichedPlayers = await enrichPlayersWithAffiliations(allPlayers);

        if (department || college || university) {
            enrichedPlayers = enrichedPlayers.filter((player) => playerMatchesInstitutionFilters(player, {
                university: university ?? undefined,
                college: college ?? undefined,
                department: department ?? undefined,
            }));
        }

        if (search) {
            // Matched against email/memberships/etc. BEFORE the public strip below —
            // search must still work over fields a non-admin caller never sees in the
            // response (BACKLOG-167). Stripping happens only at the return boundary.
            enrichedPlayers = enrichedPlayers.filter((player) => playerMatchesSearch(player, search));
        }

        const total = enrichedPlayers.length;
        const pagedPlayers = enrichedPlayers.slice(offset, offset + limit);

        return NextResponse.json({
            success: true,
            players: pagedPlayers.map((p) => toPublicPlayer(p, isAdmin)),
            total,
        }, {
            headers: {
                'X-Total-Count': String(total),
                'X-Limit': String(limit),
                'X-Offset': String(offset),
            },
        });
    } catch (error) {
        console.error('Error fetching players:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch players' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getAuthUser(request as any);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        let inferredUniversity = typeof body.university === 'string' ? body.university : '';

        if (body.teamId && !inferredUniversity) {
            const selectedTeam = await db
                .select()
                .from(teams)
                .where(eq(teams.id, body.teamId))
                .get();

            inferredUniversity = selectedTeam?.university ?? '';
        }

        if (!body.name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        if (!body.teamId && !inferredUniversity && !body.college && !body.department) {
            return NextResponse.json({
                error: 'Player must have either a Team ID or institutional affiliation (university, college, or department)',
            }, { status: 400 });
        }

        const playerId = body.id || `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newPlayer = await db.insert(players).values({
            ...body,
            id: playerId,
            teamId: body.teamId || null,
            number: body.number ?? 0,
            university: inferredUniversity || body.university || 'Unknown',
        }).returning();

        if (body.teamId) {
            await db.insert(playerTeamAffiliations).values({
                id: `aff-${playerId}-${body.teamId}`,
                playerId,
                teamId: body.teamId,
                affiliationType: 'team',
                role: 'player',
                status: 'active',
                isPrimary: true,
                isActive: true,
                startDate: newPlayer[0].createdAt || new Date(),
                jerseyNumber: newPlayer[0].number,
                position: newPlayer[0].position,
                season: await getCurrentSeason(),
                createdAt: newPlayer[0].createdAt || new Date(),
            });
        }

        await syncPlayerOrganizationAffiliations(playerId, {
            university: newPlayer[0].university,
            college: newPlayer[0].college,
            department: newPlayer[0].department,
        });

        const [enrichedPlayer] = await enrichPlayersWithAffiliations(newPlayer);
        return NextResponse.json(enrichedPlayer, { status: 201 });
    } catch (error) {
        console.error('Error creating player:', error);
        return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
    }
}
