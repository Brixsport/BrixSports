import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { news, newsRelations, newsLikes, teams, players, competitions } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
// Note: newsRelations is the news_relations table, not a Drizzle relations object
import { eq, and, sql, or } from 'drizzle-orm';


// GET /api/news/[id] - Get single news article with related entities
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Fetch news article (by ID or slug)
        const newsArticle = await db
            .select()
            .from(news)
            .where(or(eq(news.id, id), eq(news.slug, id)))
            .limit(1);

        if (!newsArticle || newsArticle.length === 0) {
            return NextResponse.json(
                { error: 'News article not found' },
                { status: 404 }
            );
        }

        const article = newsArticle[0];

        // Increment view count
        await db
            .update(news)
            .set({ views: sql`${news.views} + 1` })
            .where(eq(news.id, article.id));

        // Fetch related entities (teams, players, competitions)
        const relations = await db
            .select()
            .from(newsRelations)
            .where(eq(newsRelations.newsId, article.id));

        // Fetch actual related data
        const relatedData: any = {
            teams: [],
            players: [],
            competitions: [],
            matches: [],
        };

        for (const relation of relations) {
            if (relation.relationType === 'team') {
                const team = await db
                    .select()
                    .from(teams)
                    .where(eq(teams.id, relation.relationId))
                    .limit(1);
                if (team[0]) relatedData.teams.push(team[0]);
            } else if (relation.relationType === 'player') {
                const player = await db
                    .select()
                    .from(players)
                    .where(eq(players.id, relation.relationId))
                    .limit(1);
                if (player[0]) relatedData.players.push(player[0]);
            } else if (relation.relationType === 'competition') {
                const competition = await db
                    .select()
                    .from(competitions)
                    .where(eq(competitions.id, relation.relationId))
                    .limit(1);
                if (competition[0]) relatedData.competitions.push(competition[0]);
            }
        }

        return NextResponse.json({
            ...article,
            views: (article.views || 0) + 1, // Return updated view count
            related: relatedData,
        });
    } catch (error) {
        console.error('[News API] Error fetching news article:', error);
        return NextResponse.json(
            { error: 'Failed to fetch news article' },
            { status: 500 }
        );
    }
}

// PATCH /api/news/[id] - Update news article (Admin only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        const {
            title,
            content,
            excerpt,
            imageUrl,
            category,
            tags,
            isBreaking,
            isFeatured,
            sendPushNotification,
            status,
        } = body;

        // Build update object
        const updateData: any = {
            updatedAt: new Date(),
        };

        if (title) {
            updateData.title = title;
            // Update slug if title changed
            updateData.slug = title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '') + '-' + Date.now();
        }
        if (content !== undefined) updateData.content = content;
        if (excerpt !== undefined) updateData.excerpt = excerpt;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (category) updateData.category = category;
        if (tags !== undefined) updateData.tags = JSON.stringify(tags);
        if (isBreaking !== undefined) updateData.isBreaking = isBreaking;
        if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
        if (status) {
            updateData.status = status;
            if (status === 'published' && !updateData.publishedAt) {
                updateData.publishedAt = new Date();
            }
        }

        // Update news article
        const updated = await db
            .update(news)
            .set(updateData)
            .where(eq(news.id, id))
            .returning();

        if (!updated || updated.length === 0) {
            return NextResponse.json(
                { error: 'News article not found' },
                { status: 404 }
            );
        }

        // Send push notification if requested and status is published
        if (sendPushNotification && status === 'published') {
            try {
                const article = updated[0];

                console.log('[News API] Sending push notification...');
                const notificationResponse = await fetch(`${request.nextUrl.origin}/api/notifications/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // /api/notifications/send is admin-gated (BUG-147); forward the
                        // already-verified admin's cookie for this server-to-server call.
                        cookie: request.headers.get('cookie') || '',
                    },
                    body: JSON.stringify({
                        type: 'news',
                        newsId: article.id,
                        title: article.isBreaking ? `🚨 BREAKING: ${article.title}` : article.title,
                        body: article.excerpt || article.content.substring(0, 100),
                        icon: article.imageUrl,
                        url: `/news/${article.slug}`,
                    }),
                });

                if (!notificationResponse.ok) {
                    const errorData = await notificationResponse.json().catch(() => ({}));
                    console.error('[News API] Push notification failed:', {
                        status: notificationResponse.status,
                        error: errorData.error || 'Unknown error'
                    });
                } else {
                    const result = await notificationResponse.json();
                    console.log('[News API] Push notification sent successfully:', result);
                }

                // Update notification sent status
                await db.update(news)
                    .set({
                        pushNotificationSent: true,
                        pushNotificationSentAt: new Date(),
                    })
                    .where(eq(news.id, id));
            } catch (err) {
                console.error('[News API] Failed to send push notification:', err);
                // Don't fail the news update if notification fails
            }
        }

        return NextResponse.json({
            success: true,
            news: updated[0],
        });
    } catch (error) {
        console.error('[News API] Error updating news:', error);
        // Log more details for debugging
        if (error instanceof Error) {
            console.error('[News API] Error stack:', error.stack);
        }
        return NextResponse.json(
            { error: 'Failed to update news article' },
            { status: 500 }
        );
    }
}

// DELETE /api/news/[id] - Delete news article (Admin only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;

        // Delete news article (cascades to relations, likes, comments)
        const deleted = await db
            .delete(news)
            .where(eq(news.id, id))
            .returning();

        if (!deleted || deleted.length === 0) {
            return NextResponse.json(
                { error: 'News article not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'News article deleted successfully',
        });
    } catch (error) {
        console.error('[News API] Error deleting news:', error);
        return NextResponse.json(
            { error: 'Failed to delete news article' },
            { status: 500 }
        );
    }
}
