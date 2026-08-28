import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { news, newsLikes, users } from '@/db/schema';
import { eq, desc, and, like, or, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/news - Get all news articles with filters
export async function GET(request: NextRequest) {
    try {
        const rl = checkRateLimit(request);
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const category = searchParams.get('category');
        const tag = searchParams.get('tag');
        const search = searchParams.get('search');
        const featured = searchParams.get('featured');
        const breaking = searchParams.get('breaking');
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20), 100);
        const offset = parseInt(searchParams.get('offset') || '0');
        const status = searchParams.get('status') || 'published'; // Only show published by default

        // Build query conditions
        const conditions = [];

        // Status filter (admin can see drafts)
        conditions.push(eq(news.status, status));

        if (category) {
            conditions.push(eq(news.category, category));
        }

        if (featured === 'true') {
            conditions.push(eq(news.isFeatured, true));
        }

        if (breaking === 'true') {
            conditions.push(eq(news.isBreaking, true));
        }

        if (search) {
            conditions.push(
                or(
                    like(news.title, `%${search}%`),
                    like(news.content, `%${search}%`),
                    like(news.excerpt, `%${search}%`)
                )
            );
        }

        // Fetch news articles
        const newsArticles = await db
            .select()
            .from(news)
            .where(and(...conditions))
            .orderBy(desc(sql`published_at`), desc(sql`created_at`))
            .limit(limit)
            .offset(offset);

        // Get total count
        const totalCount = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(news)
            .where(and(...conditions));

        // BACKLOG-261: omit the full article body from the LIST response for
        // non-admin callers -- src/app/news/page.tsx's own NewsArticle type
        // never reads `content`. Kept for admins: src/app/admin/news/page.tsx's
        // handleEdit() populates the edit form straight from this list response
        // (article.content), with no separate by-id fetch -- omitting it
        // unconditionally would have silently broken every admin edit. Public
        // detail route (/api/news/[id]) is untouched and keeps content for
        // everyone, as before.
        const authUser = await getAuthUser(request).catch(() => null);
        const isAdmin = authUser?.role === 'admin';
        const responseArticles = isAdmin
            ? newsArticles
            : newsArticles.map(({ content, ...rest }) => rest);

        return NextResponse.json({
            news: responseArticles,
            pagination: {
                total: totalCount[0]?.count || 0,
                limit,
                offset,
                hasMore: (offset + limit) < (totalCount[0]?.count || 0),
            },
        });
    } catch (error) {
        console.error('[News API] Error fetching news:', error);
        return NextResponse.json(
            { error: 'Failed to fetch news articles' },
            { status: 500 }
        );
    }
}

// POST /api/news - Create new news article (Admin only)
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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

        // Validate required fields
        if (!title || !content || !category) {
            return NextResponse.json(
                { error: 'Missing required fields: title, content, category' },
                { status: 400 }
            );
        }

        // Generate slug from title
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') + '-' + Date.now();

        // Create news article
        const newsId = `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // authorId/authorName always come from the verified session, never the request body
        const newNews = await db.insert(news).values({
            id: newsId,
            title,
            slug,
            content,
            excerpt: excerpt || content.substring(0, 200) + '...',
            imageUrl: imageUrl || null,
            category,
            tags: tags ? JSON.stringify(tags) : null,
            isBreaking: isBreaking || false,
            isFeatured: isFeatured || false,
            authorId: authUser.id,
            authorName: authUser.name || 'Admin',
            sendPushNotification: sendPushNotification || false,
            status: status || 'draft',
            publishedAt: status === 'published' ? new Date() : null,
        }).returning();

        // If sendPushNotification is true and status is published, trigger notification
        // Send push notification if requested and status is published
        if (sendPushNotification && status === 'published') {
            try {
                console.log('[News API] Sending push notification...');
                const notificationResponse = await fetch(`${request.nextUrl.origin}/api/notifications/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // Forward the caller's auth cookie -- /api/notifications/send is
                        // admin-gated (BUG-147), and this is a server-to-server call made
                        // on behalf of the already-verified admin who hit this route.
                        cookie: request.headers.get('cookie') || '',
                    },
                    body: JSON.stringify({
                        type: 'news',
                        newsId,
                        title: isBreaking ? `🚨 BREAKING: ${title}` : title,
                        body: excerpt || content.substring(0, 100),
                        icon: imageUrl,
                        url: `/news/${slug}`,
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
                    .where(eq(news.id, newsId));
            } catch (err) {
                console.error('[News API] Failed to send push notification:', err);
                // Don't fail the news creation if notification fails
            }
        }

        return NextResponse.json({
            success: true,
            news: newNews[0],
        }, { status: 201 });
    } catch (error) {
        console.error('[News API] Error creating news:', error);
        // Log more details for debugging
        if (error instanceof Error) {
            console.error('[News API] Error stack:', error.stack);
            console.error('[News API] Error name:', error.name);
            // Log the full error object for inspection
            console.error('[News API] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
        return NextResponse.json(
            { error: 'Failed to create news article' },
            { status: 500 }
        );
    }
}
