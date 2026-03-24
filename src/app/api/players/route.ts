import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { playerTeamAffiliations, players, teams } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { enrichPlayersWithAffiliations, type EnrichedPlayer, syncPlayerOrganizationAffiliations } from '@/lib/player-data';
import { getPrimaryTeam, getResolvedInstitutionalData, playerMatchesInstitutionFilters } from '@/lib/player-affiliation-utils';

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
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const ids = searchParams.get('ids');
        const search = searchParams.get('search');
        const department = searchParams.get('department');
        const college = searchParams.get('college');
        const university = searchParams.get('university');

        if (ids) {
            const playerIds = ids.split(',').map((id) => id.trim()).filter(Boolean);
            if (playerIds.length === 0) {
                return NextResponse.json({ success: true, players: [] });
            }

            const foundPlayers = await db.select().from(players).where(inArray(players.id, playerIds));
            return NextResponse.json({
                success: true,
                players: await enrichPlayersWithAffiliations(foundPlayers),
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

            return NextResponse.json({
                success: true,
                players: await enrichPlayersWithAffiliations(Array.from(combinedMap.values())),
            });
        }

        const allPlayers = await db.select().from(players);
        let enrichedPlayers = await enrichPlayersWithAffiliations(allPlayers);

        if (department || college || university) {
            enrichedPlayers = enrichedPlayers.filter((player) => playerMatchesInstitutionFilters(player, {
                university: university ?? undefined,
                college: college ?? undefined,
                department: department ?? undefined,
            }));
        }

        if (search) {
            enrichedPlayers = enrichedPlayers.filter((player) => playerMatchesSearch(player, search));
        }

        return NextResponse.json({ success: true, players: enrichedPlayers });
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

        if (!body.name || !body.position) {
            return NextResponse.json({ error: 'Name and Position are required' }, { status: 400 });
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
