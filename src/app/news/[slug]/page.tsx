import type { Metadata } from 'next';
import { db } from '@/db';
import { news } from '@/db/schema';
import { eq } from 'drizzle-orm';
import NewsDetailClient from './NewsDetailClient';

// BACKLOG-189: same fix as matches/[id] -- was a 'use client' page with no
// generateMetadata, so every article shared the generic site-wide title
// instead of its own headline. Thin server wrapper, original UI unchanged.
async function getArticle(slug: string) {
    const [article] = await db.select().from(news).where(eq(news.slug, slug)).limit(1);
    return article ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const article = await getArticle(slug);
    if (!article) {
        return { title: 'News', description: 'Latest Nigerian university sports news on BRIXSPORTS.' };
    }

    const description = article.excerpt || article.content.slice(0, 160).replace(/\s+/g, ' ').trim();

    return {
        title: article.title,
        description,
        openGraph: {
            title: article.title,
            description,
            type: 'article',
            images: article.imageUrl ? [article.imageUrl] : undefined,
            publishedTime: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
        },
        twitter: {
            card: 'summary_large_image',
            title: article.title,
            description,
        },
    };
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const article = await getArticle(slug);

    const schema = article
        ? {
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: article.title,
            description: article.excerpt || undefined,
            image: article.imageUrl || undefined,
            datePublished: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
            dateModified: article.updatedAt ? new Date(article.updatedAt).toISOString() : undefined,
            author: article.authorName ? { '@type': 'Person', name: article.authorName } : { '@type': 'Organization', name: 'BRIXSPORTS' },
            publisher: { '@type': 'Organization', name: 'BRIXSPORTS' },
            mainEntityOfPage: `https://brixsports.com/news/${slug}`,
        }
        : null;

    return (
        <>
            {schema && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />
            )}
            <NewsDetailClient />
        </>
    );
}
