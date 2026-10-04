import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsComments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser, resolveEffectiveUserId } from '@/lib/auth';

// DELETE /api/news/[id]/comments/[commentId] - Delete a comment
export async function DELETE(
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
        // Session identity only -- any userId query param is ignored.
        const userId = await resolveEffectiveUserId(authUser);

        const { id, commentId } = params;

        // Check if comment exists and belongs to user
        const comment = await db
            .select()
            .from(newsComments)
            .where(
                and(
                    eq(newsComments.id, commentId),
                    eq(newsComments.newsId, id)
                )
            )
            .limit(1);

        if (!comment || comment.length === 0) {
            return NextResponse.json(
                { error: 'Comment not found' },
                { status: 404 }
            );
        }

        // Check if the session user owns the comment
        if (comment[0].userId !== userId) {
            return NextResponse.json(
                { error: 'You can only delete your own comments' },
                { status: 403 }
            );
        }

        // Delete comment
        await db
            .delete(newsComments)
            .where(eq(newsComments.id, commentId));

        return NextResponse.json({
            success: true,
            message: 'Comment deleted successfully',
        });
    } catch (error) {
        console.error('[News Comments API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to delete comment' },
            { status: 500 }
        );
    }
}

// PATCH /api/news/[id]/comments/[commentId] - Update a comment
export async function PATCH(
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

        const { id, commentId } = params;
        const body = await request.json();
        const { content } = body;

        if (!content) {
            return NextResponse.json(
                { error: 'Content is required' },
                { status: 400 }
            );
        }

        if (content.trim().length === 0) {
            return NextResponse.json(
                { error: 'Comment cannot be empty' },
                { status: 400 }
            );
        }

        if (content.length > 1000) {
            return NextResponse.json(
                { error: 'Comment is too long (max 1000 characters)' },
                { status: 400 }
            );
        }

        // Check if comment exists and belongs to user
        const comment = await db
            .select()
            .from(newsComments)
            .where(
                and(
                    eq(newsComments.id, commentId),
                    eq(newsComments.newsId, id)
                )
            )
            .limit(1);

        if (!comment || comment.length === 0) {
            return NextResponse.json(
                { error: 'Comment not found' },
                { status: 404 }
            );
        }

        // Check if the session user owns the comment
        if (comment[0].userId !== userId) {
            return NextResponse.json(
                { error: 'You can only edit your own comments' },
                { status: 403 }
            );
        }

        // Update comment
        const updated = await db
            .update(newsComments)
            .set({
                content: content.trim(),
                updatedAt: new Date(),
            })
            .where(eq(newsComments.id, commentId))
            .returning();

        return NextResponse.json({
            success: true,
            comment: updated[0],
        });
    } catch (error) {
        console.error('[News Comments API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update comment' },
            { status: 500 }
        );
    }
}
