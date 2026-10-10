import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsComments, pollCommentLikes } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getAuthUser, resolveEffectiveUserId } from '@/lib/auth';

// POST /api/news/[id]/comments/[commentId]/like - Toggle like on a comment
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string; commentId: string } }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        // Session identity only -- any userId in the body is ignored.
        const userId = await resolveEffectiveUserId(authUser);

        const { commentId } = params;

        // Check if user already liked this comment
        const existingLike = await db
            .select()
            .from(pollCommentLikes)
            .where(
                and(
                    eq(pollCommentLikes.commentId, commentId),
                    eq(pollCommentLikes.userId, userId)
                )
            )
            .limit(1);

        if (existingLike && existingLike.length > 0) {
            // Unlike - remove the like
            await db
                .delete(pollCommentLikes)
                .where(
                    and(
                        eq(pollCommentLikes.commentId, commentId),
                        eq(pollCommentLikes.userId, userId)
                    )
                );

            // Decrement like count
            await db
                .update(newsComments)
                .set({ likes: sql`${newsComments.likes} - 1` })
                .where(eq(newsComments.id, commentId));

            return NextResponse.json({
                success: true,
                liked: false,
                message: 'Comment unliked',
            });
        } else {
            // Like - add the like
            await db.insert(pollCommentLikes).values({
                id: `like-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                commentId,
                userId,
                createdAt: new Date(),
            });

            // Increment like count
            await db
                .update(newsComments)
                .set({ likes: sql`${newsComments.likes} + 1` })
                .where(eq(newsComments.id, commentId));

            return NextResponse.json({
                success: true,
                liked: true,
                message: 'Comment liked',
            });
        }
    } catch (error) {
        console.error('[Comment Like API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to toggle like' },
            { status: 500 }
        );
    }
}

// GET /api/news/[id]/comments/[commentId]/like - Get like status
// The like count is public; `isLiked` is only resolved for an authenticated
// session (anonymous readers always get isLiked: false). No userId param is read.
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string; commentId: string } }
) {
    try {
        const { commentId } = params;

        // Get comment with like count
        const comment = await db
            .select()
            .from(newsComments)
            .where(eq(newsComments.id, commentId))
            .limit(1);

        if (!comment || comment.length === 0) {
            return NextResponse.json(
                { error: 'Comment not found' },
                { status: 404 }
            );
        }

        // Check if current (session) user liked
        let isLiked = false;
        const authUser = await getAuthUser(request);
        if (authUser) {
            const userId = await resolveEffectiveUserId(authUser);
            const userLike = await db
                .select()
                .from(pollCommentLikes)
                .where(
                    and(
                        eq(pollCommentLikes.commentId, commentId),
                        eq(pollCommentLikes.userId, userId)
                    )
                )
                .limit(1);

            isLiked = userLike && userLike.length > 0;
        }

        return NextResponse.json({
            likes: comment[0].likes || 0,
            isLiked,
        });
    } catch (error) {
        console.error('[Comment Like API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get like status' },
            { status: 500 }
        );
    }
}
