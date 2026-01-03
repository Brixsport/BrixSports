import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsComments } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/news/[id]/comments/[commentId]/replies - Get replies to a comment
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string; commentId: string } }
) {
    try {
        const { commentId } = params;

        // Get all replies to this comment
        const replies = await db
            .select()
            .from(newsComments)
            .where(eq(newsComments.parentId, commentId))
            .orderBy(desc(newsComments.createdAt));

        return NextResponse.json({
            replies,
            total: replies.length,
        });
    } catch (error) {
        console.error('[Comment Replies API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch replies' },
            { status: 500 }
        );
    }
}
