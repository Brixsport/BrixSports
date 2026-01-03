import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsComments, pollCommentLikes } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// POST /api/news/[id]/comments/[commentId]/like - Toggle like on a comment
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string; commentId: string } }
) {
    try {
        const { commentId } = params;
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

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
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string; commentId: string } }
) {
    try {
        const { commentId } = params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

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

        // Check if current user liked
        let isLiked = false;
        if (userId) {
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
