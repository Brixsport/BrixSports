import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { squadPlayers, players, competitions, teams } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';

// GET /api/squads?teamId=xxx&competitionId=xxx - Get squad for a team in a competition
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const competitionId = searchParams.get('competitionId');

        if (!teamId || !competitionId) {
            return NextResponse.json(
                { error: 'teamId and competitionId are required' },
                { status: 400 }
            );
        }

        // Get squad with player details
        const squad = await db
            .select({
                squadPlayer: squadPlayers,
                player: {
                    id: players.id,
                    name: players.name,
                    number: players.number,
                    position: players.position,
                    avatar: players.avatar,
                    nationality: players.nationality,
                }
            })
            .from(squadPlayers)
            .where(
                and(
                    eq(squadPlayers.teamId, teamId),
                    eq(squadPlayers.competitionId, competitionId)
                )
            )
            .leftJoin(players, eq(squadPlayers.playerId, players.id))
            .all();

        return NextResponse.json({
            success: true,
            squad: squad.map(s => ({
                ...s.squadPlayer,
                player: s.player,
            })),
            count: squad.length,
        });
    } catch (error) {
        console.error('[Squad] Error fetching squad:', error);
        return NextResponse.json(
            { error: 'Failed to fetch squad' },
            { status: 500 }
        );
    }
}

// POST /api/squads - Add player to squad
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { teamId, competitionId, playerId, squadNumber, role, notes } = body;

        if (!teamId || !competitionId || !playerId) {
            return NextResponse.json(
                { error: 'teamId, competitionId, and playerId are required' },
                { status: 400 }
            );
        }

        // Check if player already in squad for this competition
        const existing = await db
            .select()
            .from(squadPlayers)
            .where(
                and(
                    eq(squadPlayers.teamId, teamId),
                    eq(squadPlayers.competitionId, competitionId),
                    eq(squadPlayers.playerId, playerId)
                )
            )
            .all();

        if (existing.length > 0) {
            return NextResponse.json(
                { error: 'Player already in squad for this competition' },
                { status: 409 }
            );
        }

        // Add player to squad
        const squadPlayerId = nanoid();
        await db.insert(squadPlayers).values({
            id: squadPlayerId,
            teamId,
            competitionId,
            playerId,
            squadNumber,
            role: role || 'player',
            notes,
            status: 'active',
        });

        return NextResponse.json({
            success: true,
            message: 'Player added to squad',
            squadPlayerId,
        });
    } catch (error) {
        console.error('[Squad] Error adding player to squad:', error);
        return NextResponse.json(
            { error: 'Failed to add player to squad' },
            { status: 500 }
        );
    }
}

// DELETE /api/squads?id=xxx - Remove player from squad
export async function DELETE(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const squadPlayerId = searchParams.get('id');

        if (!squadPlayerId) {
            return NextResponse.json(
                { error: 'Squad player id is required' },
                { status: 400 }
            );
        }

        await db
            .delete(squadPlayers)
            .where(eq(squadPlayers.id, squadPlayerId));

        return NextResponse.json({
            success: true,
            message: 'Player removed from squad',
        });
    } catch (error) {
        console.error('[Squad] Error removing player from squad:', error);
        return NextResponse.json(
            { error: 'Failed to remove player from squad' },
            { status: 500 }
        );
    }
}

// PATCH /api/squads?id=xxx - Update squad player (number, role, status, notes)
export async function PATCH(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const squadPlayerId = searchParams.get('id');
        
        if (!squadPlayerId) {
            return NextResponse.json(
                { error: 'Squad player id is required' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { squadNumber, role, status, notes } = body;

        const updateData: any = {
            updatedAt: new Date(),
        };
        if (squadNumber !== undefined) updateData.squadNumber = squadNumber;
        if (role) updateData.role = role;
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;

        await db
            .update(squadPlayers)
            .set(updateData)
            .where(eq(squadPlayers.id, squadPlayerId));

        return NextResponse.json({
            success: true,
            message: 'Squad player updated',
        });
    } catch (error) {
        console.error('[Squad] Error updating squad player:', error);
        return NextResponse.json(
            { error: 'Failed to update squad player' },
            { status: 500 }
        );
    }
}
