import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fplTeams, fplTeamSelections, fplPlayerData, fplGameweeks, players, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { validateFormation } from '@/lib/utils/fpl-points';
import { getAuthUser } from '@/lib/auth';

// Public-safe user columns — never select password/email in any relational join.
const SAFE_USER_COLUMNS = { id: true, name: true, avatar: true } as const;

// GET /api/fpl/teams - Get user's FPL team(s)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const teamId = searchParams.get('teamId');
        const season = searchParams.get('season') || '2024/2025';

        if (teamId) {
            // Get specific team with full details
            const team = await db.query.fplTeams.findFirst({
                where: eq(fplTeams.id, teamId),
                with: {
                    user: { columns: SAFE_USER_COLUMNS },
                },
            });

            if (!team) {
                return NextResponse.json({ error: 'Team not found' }, { status: 404 });
            }

            return NextResponse.json(team);
        }

        if (userId) {
            // Own teams only — a Fan's FPL team is personal (selections, budget), not public.
            const authUser = await getAuthUser(request).catch(() => null);
            if (!authUser) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            if (authUser.id !== userId && authUser.role !== 'admin') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            // Get user's teams
            const teams = await db.query.fplTeams.findMany({
                where: and(
                    eq(fplTeams.userId, userId),
                    eq(fplTeams.season, season)
                ),
                with: {
                    user: { columns: SAFE_USER_COLUMNS },
                },
                orderBy: [desc(fplTeams.createdAt)],
            });

            return NextResponse.json(teams);
        }

        // Get all teams (for leaderboard)
        const allTeams = await db.query.fplTeams.findMany({
            where: eq(fplTeams.season, season),
            with: {
                user: { columns: SAFE_USER_COLUMNS },
            },
            orderBy: [desc(fplTeams.totalPoints)],
            limit: 100,
        });

        return NextResponse.json(allTeams);
    } catch (error) {
        console.error('Error fetching FPL teams:', error);
        return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }
}

// POST /api/fpl/teams - Create new FPL team
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request).catch(() => null);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, season = '2024/2025', initialSquad } = body;
        // Ownership is never client-supplied — always the verified session (CLAUDE.md audit-field rule).
        const userId = authUser.id;

        if (!userId || !name) {
            return NextResponse.json(
                { error: 'User ID and team name are required' },
                { status: 400 }
            );
        }

        // Check if user already has a team for this season
        const existingTeam = await db.query.fplTeams.findFirst({
            where: and(
                eq(fplTeams.userId, userId),
                eq(fplTeams.season, season)
            ),
        });

        if (existingTeam) {
            return NextResponse.json(
                { error: 'You already have a team for this season' },
                { status: 400 }
            );
        }

        // Validate initial squad if provided
        if (initialSquad && initialSquad.length > 0) {
            const squadPositions = initialSquad.map((p: any) => ({ position: p.position }));
            const validation = validateFormation(squadPositions);

            if (!validation.valid) {
                return NextResponse.json(
                    { error: 'Invalid squad formation', details: validation.errors },
                    { status: 400 }
                );
            }

            // Calculate total cost
            let totalCost = 0;
            for (const player of initialSquad) {
                const playerData = await db.query.fplPlayerData.findFirst({
                    where: and(
                        eq(fplPlayerData.playerId, player.playerId),
                        eq(fplPlayerData.season, season)
                    ),
                });

                if (!playerData) {
                    return NextResponse.json(
                        { error: `Player ${player.playerId} not found in FPL data` },
                        { status: 400 }
                    );
                }

                totalCost += playerData.price;
            }

            if (totalCost > 100) {
                return NextResponse.json(
                    { error: `Squad cost (£${totalCost}m) exceeds budget (£100m)` },
                    { status: 400 }
                );
            }
        }

        // Create team
        const teamId = `fpl_team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(fplTeams).values({
            id: teamId,
            userId,
            name,
            season,
            budget: 100.0,
            bankBalance: initialSquad ? 100 - initialSquad.reduce((sum: number, p: any) => sum + p.price, 0) : 100,
            teamValue: 100.0,
        });

        // Add initial squad if provided
        if (initialSquad && initialSquad.length > 0) {
            const currentGameweek = await db.query.fplGameweeks.findFirst({
                where: and(
                    eq(fplGameweeks.season, season),
                    eq(fplGameweeks.isActive, true)
                ),
            });

            if (currentGameweek) {
                for (const player of initialSquad) {
                    const selectionId = `fpl_sel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                    await db.insert(fplTeamSelections).values({
                        id: selectionId,
                        teamId,
                        playerId: player.playerId,
                        gameweekId: currentGameweek.id,
                        position: player.position,
                        isCaptain: player.isCaptain || false,
                        isViceCaptain: player.isViceCaptain || false,
                        multiplier: player.isCaptain ? 2 : 1,
                        purchasePrice: player.price,
                    });
                }
            }
        }

        const newTeam = await db.query.fplTeams.findFirst({
            where: eq(fplTeams.id, teamId),
            with: {
                user: { columns: SAFE_USER_COLUMNS },
            },
        });

        return NextResponse.json(newTeam, { status: 201 });
    } catch (error) {
        console.error('Error creating FPL team:', error);
        return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
    }
}

// PATCH /api/fpl/teams - Update FPL team
export async function PATCH(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request).catch(() => null);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { teamId, name, formation } = body;

        if (!teamId) {
            return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
        }

        const team = await db.query.fplTeams.findFirst({
            where: eq(fplTeams.id, teamId),
        });

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        if (team.userId !== authUser.id && authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const updates: any = {
            updatedAt: new Date(),
        };

        if (name) updates.name = name;
        if (formation) updates.formation = formation;

        await db.update(fplTeams)
            .set(updates)
            .where(eq(fplTeams.id, teamId));

        const updatedTeam = await db.query.fplTeams.findFirst({
            where: eq(fplTeams.id, teamId),
            with: {
                user: { columns: SAFE_USER_COLUMNS },
            },
        });

        return NextResponse.json(updatedTeam);
    } catch (error) {
        console.error('Error updating FPL team:', error);
        return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    }
}
