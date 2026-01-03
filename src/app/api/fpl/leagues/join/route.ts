import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fplLeagues, fplLeagueMembers, fplTeams } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/fpl/leagues/join - Join a league
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { leagueCode, teamId, userId } = body;

        if (!leagueCode || !teamId || !userId) {
            return NextResponse.json(
                { error: 'League code, team ID, and user ID are required' },
                { status: 400 }
            );
        }

        // Find league by code
        const league = await db.query.fplLeagues.findFirst({
            where: eq(fplLeagues.code, leagueCode),
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // Check if league is full
        if ((league.currentMembers ?? 0) >= (league.maxMembers ?? 50)) {
            return NextResponse.json({ error: 'League is full' }, { status: 400 });
        }

        // Check if team exists
        const team = await db.query.fplTeams.findFirst({
            where: eq(fplTeams.id, teamId),
        });

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        // Check if team belongs to user
        if (team.userId !== userId) {
            return NextResponse.json({ error: 'Team does not belong to user' }, { status: 403 });
        }

        // Check if already a member
        const existingMember = await db.query.fplLeagueMembers.findFirst({
            where: and(
                eq(fplLeagueMembers.leagueId, league.id),
                eq(fplLeagueMembers.teamId, teamId)
            ),
        });

        if (existingMember) {
            return NextResponse.json(
                { error: 'Team is already in this league' },
                { status: 400 }
            );
        }

        // Add member
        const memberId = `fpl_member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(fplLeagueMembers).values({
            id: memberId,
            leagueId: league.id,
            teamId,
            userId,
            totalPoints: team.totalPoints,
        });

        // Update league member count
        await db.update(fplLeagues)
            .set({
                currentMembers: (league.currentMembers ?? 0) + 1,
                updatedAt: new Date(),
            })
            .where(eq(fplLeagues.id, league.id));

        const member = await db.query.fplLeagueMembers.findFirst({
            where: eq(fplLeagueMembers.id, memberId),
            with: {
                league: true,
                team: {
                    with: {
                        user: true,
                    },
                },
            },
        });

        return NextResponse.json({
            member,
            message: `Successfully joined ${league.name}`,
        }, { status: 201 });
    } catch (error) {
        console.error('Error joining league:', error);
        return NextResponse.json({ error: 'Failed to join league' }, { status: 500 });
    }
}

// DELETE /api/fpl/leagues/join - Leave a league
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueId = searchParams.get('leagueId');
        const teamId = searchParams.get('teamId');

        if (!leagueId || !teamId) {
            return NextResponse.json(
                { error: 'League ID and team ID are required' },
                { status: 400 }
            );
        }

        const member = await db.query.fplLeagueMembers.findFirst({
            where: and(
                eq(fplLeagueMembers.leagueId, leagueId),
                eq(fplLeagueMembers.teamId, teamId)
            ),
        });

        if (!member) {
            return NextResponse.json({ error: 'Not a member of this league' }, { status: 404 });
        }

        const league = await db.query.fplLeagues.findFirst({
            where: eq(fplLeagues.id, leagueId),
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // Delete membership
        await db.delete(fplLeagueMembers)
            .where(eq(fplLeagueMembers.id, member.id));

        // Update league member count
        await db.update(fplLeagues)
            .set({
                currentMembers: Math.max(0, (league.currentMembers ?? 0) - 1),
                updatedAt: new Date(),
            })
            .where(eq(fplLeagues.id, leagueId));

        return NextResponse.json({ message: 'Successfully left the league' });
    } catch (error) {
        console.error('Error leaving league:', error);
        return NextResponse.json({ error: 'Failed to leave league' }, { status: 500 });
    }
}
