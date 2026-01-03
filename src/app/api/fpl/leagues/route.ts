import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fplLeagues, fplLeagueMembers, fplTeams } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET /api/fpl/leagues - Get leagues
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueId = searchParams.get('leagueId');
        const userId = searchParams.get('userId');
        const code = searchParams.get('code');
        const season = searchParams.get('season') || '2024/2025';

        if (leagueId) {
            // Get specific league with members
            const league = await db.query.fplLeagues.findFirst({
                where: eq(fplLeagues.id, leagueId),
                with: {
                    admin: true,
                    members: {
                        with: {
                            team: {
                                with: {
                                    user: true,
                                },
                            },
                        },
                        orderBy: [desc(fplLeagueMembers.totalPoints)],
                    },
                },
            });

            if (!league) {
                return NextResponse.json({ error: 'League not found' }, { status: 404 });
            }

            return NextResponse.json(league);
        }

        if (code) {
            // Find league by code
            const league = await db.query.fplLeagues.findFirst({
                where: and(
                    eq(fplLeagues.code, code),
                    eq(fplLeagues.season, season)
                ),
                with: {
                    admin: true,
                },
            });

            if (!league) {
                return NextResponse.json({ error: 'League not found' }, { status: 404 });
            }

            return NextResponse.json(league);
        }

        if (userId) {
            // Get user's leagues
            const userLeagues = await db.query.fplLeagueMembers.findMany({
                where: eq(fplLeagueMembers.userId, userId),
                with: {
                    league: {
                        with: {
                            admin: true,
                        },
                    },
                },
            });

            return NextResponse.json(userLeagues.map(ul => ul.league));
        }

        // Get public leagues
        const publicLeagues = await db.query.fplLeagues.findMany({
            where: and(
                eq(fplLeagues.isPrivate, false),
                eq(fplLeagues.season, season)
            ),
            with: {
                admin: true,
            },
            orderBy: [desc(fplLeagues.currentMembers)],
            limit: 50,
        });

        return NextResponse.json(publicLeagues);
    } catch (error) {
        console.error('Error fetching leagues:', error);
        return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
    }
}

// POST /api/fpl/leagues - Create new league
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            adminUserId,
            season = '2024/2025',
            leagueType = 'classic',
            isPrivate = true,
            description,
            maxMembers = 50,
            prizeInfo,
        } = body;

        if (!name || !adminUserId) {
            return NextResponse.json(
                { error: 'League name and admin user ID are required' },
                { status: 400 }
            );
        }

        // Generate unique code
        const code = `${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        const leagueId = `fpl_league_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(fplLeagues).values({
            id: leagueId,
            name,
            code,
            season,
            leagueType,
            isPrivate,
            adminUserId,
            description,
            maxMembers,
            prizeInfo: prizeInfo ? JSON.stringify(prizeInfo) : null,
            currentMembers: 0,
        });

        const newLeague = await db.query.fplLeagues.findFirst({
            where: eq(fplLeagues.id, leagueId),
            with: {
                admin: true,
            },
        });

        return NextResponse.json(newLeague, { status: 201 });
    } catch (error) {
        console.error('Error creating league:', error);
        return NextResponse.json({ error: 'Failed to create league' }, { status: 500 });
    }
}

// PATCH /api/fpl/leagues - Update league
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { leagueId, name, description, isPrivate, maxMembers, prizeInfo } = body;

        if (!leagueId) {
            return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
        }

        const league = await db.query.fplLeagues.findFirst({
            where: eq(fplLeagues.id, leagueId),
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        const updates: any = {
            updatedAt: new Date(),
        };

        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (isPrivate !== undefined) updates.isPrivate = isPrivate;
        if (maxMembers !== undefined) updates.maxMembers = maxMembers;
        if (prizeInfo !== undefined) updates.prizeInfo = JSON.stringify(prizeInfo);

        await db.update(fplLeagues)
            .set(updates)
            .where(eq(fplLeagues.id, leagueId));

        const updatedLeague = await db.query.fplLeagues.findFirst({
            where: eq(fplLeagues.id, leagueId),
            with: {
                admin: true,
            },
        });

        return NextResponse.json(updatedLeague);
    } catch (error) {
        console.error('Error updating league:', error);
        return NextResponse.json({ error: 'Failed to update league' }, { status: 500 });
    }
}

// DELETE /api/fpl/leagues - Delete league
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueId = searchParams.get('leagueId');
        const userId = searchParams.get('userId');

        if (!leagueId || !userId) {
            return NextResponse.json(
                { error: 'League ID and user ID are required' },
                { status: 400 }
            );
        }

        const league = await db.query.fplLeagues.findFirst({
            where: eq(fplLeagues.id, leagueId),
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // Check if user is admin
        if (league.adminUserId !== userId) {
            return NextResponse.json(
                { error: 'Only league admin can delete the league' },
                { status: 403 }
            );
        }

        await db.delete(fplLeagues)
            .where(eq(fplLeagues.id, leagueId));

        return NextResponse.json({ message: 'League deleted successfully' });
    } catch (error) {
        console.error('Error deleting league:', error);
        return NextResponse.json({ error: 'Failed to delete league' }, { status: 500 });
    }
}
