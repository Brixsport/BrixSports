'use client';

import Head from 'next/head';
import { generateArticleSchema, generateOGMetadata, generateTwitterMetadata } from '@/lib/utils/seo';

interface ArticleSEOProps {
    article: {
        title: string;
        excerpt: string;
        content: string;
        imageUrl?: string | null;
        authorName: string;
        publishedAt?: string | null;
        updatedAt?: string | null;
        slug: string;
        category: string;
        tags?: string | null;
    };
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
}

export default function ArticleSEO({ article, metaTitle, metaDescription, canonicalUrl }: ArticleSEOProps) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsport.com';
    const articleUrl = `${baseUrl}/news/${article.slug}`;

    // Generate metadata
    const ogMetadata = generateOGMetadata(article);
    const twitterMetadata = generateTwitterMetadata(article);
    const schema = generateArticleSchema(article);

    // Parse tags
    const tags = article.tags ? JSON.parse(article.tags) : [];
    const keywords = [article.category, ...tags, 'sports', 'university sports', 'NUGA'].join(', ');

    return (
        <Head>
            {/* Primary Meta Tags */}
            <title>{metaTitle || `${article.title} | Brix Sport`}</title>
            <meta name="title" content={metaTitle || article.title} />
            <meta name="description" content={metaDescription || article.excerpt} />
            <meta name="keywords" content={keywords} />
            <meta name="author" content={article.authorName} />

            {/* Canonical URL */}
            <link rel="canonical" href={canonicalUrl || articleUrl} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={ogMetadata['og:type']} />
            <meta property="og:url" content={articleUrl} />
            <meta property="og:title" content={ogMetadata['og:title']} />
            <meta property="og:description" content={ogMetadata['og:description']} />
            {ogMetadata['og:image'] && (
                <>
                    <meta property="og:image" content={ogMetadata['og:image']} />
                    <meta property="og:image:alt" content={ogMetadata['og:image:alt']} />
                    <meta property="og:image:width" content="1200" />
                    <meta property="og:image:height" content="630" />
                </>
            )}
            <meta property="og:site_name" content="Brix Sport" />
            {ogMetadata['article:published_time'] && (
                <meta property="article:published_time" content={ogMetadata['article:published_time']} />
            )}
            <meta property="article:author" content={ogMetadata['article:author']} />
            <meta property="article:section" content={article.category} />
            {tags.map((tag: string) => (
                <meta key={tag} property="article:tag" content={tag} />
            ))}

            {/* Twitter */}
            <meta name="twitter:card" content={twitterMetadata['twitter:card']} />
            <meta name="twitter:url" content={articleUrl} />
            <meta name="twitter:title" content={twitterMetadata['twitter:title']} />
            <meta name="twitter:description" content={twitterMetadata['twitter:description']} />
            {twitterMetadata['twitter:image'] && (
                <meta name="twitter:image" content={twitterMetadata['twitter:image']} />
            )}

            {/* Additional Meta Tags */}
            <meta name="robots" content="index, follow" />
            <meta name="language" content="English" />
            <meta name="revisit-after" content="7 days" />

            {/* Schema.org JSON-LD */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
        </Head>
    );
}
