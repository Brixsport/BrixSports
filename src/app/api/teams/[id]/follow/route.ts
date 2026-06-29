/**
 * Team Follow API
 * POST /api/teams/[id]/follow - Follow a team
 * DELETE /api/teams/[id]/follow - Unfollow a team
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userFollows, teams } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser, resolveEffectiveUserId } from '@/lib/auth';

/**
 * Follow a team
 */
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const teamId = params.id;

        // Get authenticated user
        const user = await getAuthUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const effectiveId = await resolveEffectiveUserId(user);

        // Check if team exists
        const team = await db
            .select()
            .from(teams)
            .where(eq(teams.id, teamId))
            .limit(1);

        if (!team || team.length === 0) {
            return NextResponse.json(
                { error: 'Team not found' },
                { status: 404 }
            );
        }

        // Check if already following
        const existing = await db
            .select()
            .from(userFollows)
            .where(
                and(
                    eq(userFollows.userId, effectiveId),
                    eq(userFollows.followType, 'team'),
                    eq(userFollows.followId, teamId)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            // Already following, just ensure notifications are enabled
            await db
                .update(userFollows)
                .set({
                    notificationsEnabled: true,
                })
                .where(eq(userFollows.id, existing[0].id));

            return NextResponse.json({
                success: true,
                message: 'Already following team',
                alreadyFollowing: true,
            });
        }

        // Create new follow
        const followId = `follow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(userFollows).values({
            id: followId,
            userId: effectiveId,
            followType: 'team',
            followId: teamId,
            notificationsEnabled: true,
        });

        return NextResponse.json({
            success: true,
            message: 'Team followed successfully',
            followId,
        });
    } catch (error) {
        console.error('[TeamFollow] Error following team:', error);
        return NextResponse.json(
            { error: 'Failed to follow team' },
            { status: 500 }
        );
    }
}

/**
 * Unfollow a team
 */
export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const teamId = params.id;

        // Get authenticated user
        const user = await getAuthUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const effectiveId = await resolveEffectiveUserId(user);

        // Delete follow
        await db
            .delete(userFollows)
            .where(
                and(
                    eq(userFollows.userId, effectiveId),
                    eq(userFollows.followType, 'team'),
                    eq(userFollows.followId, teamId)
                )
            );

        return NextResponse.json({
            success: true,
            message: 'Team unfollowed successfully',
        });
    } catch (error) {
        console.error('[TeamFollow] Error unfollowing team:', error);
        return NextResponse.json(
            { error: 'Failed to unfollow team' },
            { status: 500 }
        );
    }
}

/**
 * Get follow status
 */
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const teamId = params.id;

        // Get authenticated user
        const user = await getAuthUser(request);

        if (!user) {
            return NextResponse.json({
                following: false,
                notificationsEnabled: false,
            });
        }

        const effectiveId = await resolveEffectiveUserId(user);

        // Check if following
        const follow = await db
            .select()
            .from(userFollows)
            .where(
                and(
                    eq(userFollows.userId, effectiveId),
                    eq(userFollows.followType, 'team'),
                    eq(userFollows.followId, teamId)
                )
            )
            .limit(1);

        if (follow.length === 0) {
            return NextResponse.json({
                following: false,
                notificationsEnabled: false,
            });
        }

        return NextResponse.json({
            following: true,
            notificationsEnabled: follow[0].notificationsEnabled,
            followId: follow[0].id,
        });
    } catch (error) {
        console.error('[TeamFollow] Error getting follow status:', error);
        return NextResponse.json(
            { error: 'Failed to get follow status' },
            { status: 500 }
        );
    }
}
