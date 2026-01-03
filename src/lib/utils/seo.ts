/**
 * SEO utilities for blog articles
 */

export interface SEOMetadata {
    title: string;
    description: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogType?: string;
    twitterCard?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
    canonical?: string;
    keywords?: string[];
}

/**
 * Generate SEO-friendly meta title
 * @param title - Article title
 * @param siteName - Site name to append
 * @param maxLength - Maximum character length (default: 60)
 */
export function generateMetaTitle(
    title: string,
    siteName: string = 'Brix Sport',
    maxLength: number = 60
): string {
    const fullTitle = `${title} | ${siteName}`;

    if (fullTitle.length <= maxLength) {
        return fullTitle;
    }

    // Truncate title if too long
    const availableLength = maxLength - siteName.length - 3; // 3 for " | "
    const truncatedTitle = title.substring(0, availableLength).trim() + '...';
    return `${truncatedTitle} | ${siteName}`;
}

/**
 * Generate SEO-friendly meta description
 * @param content - Article content or excerpt
 * @param maxLength - Maximum character length (default: 160)
 */
export function generateMetaDescription(
    content: string,
    maxLength: number = 160
): string {
    // Strip HTML tags
    const plainText = content.replace(/<[^>]*>/g, '').trim();

    if (plainText.length <= maxLength) {
        return plainText;
    }

    // Truncate at last complete word before maxLength
    const truncated = plainText.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    return truncated.substring(0, lastSpace) + '...';
}

/**
 * Extract keywords from content
 * @param content - Article content
 * @param maxKeywords - Maximum number of keywords (default: 10)
 */
export function extractKeywords(
    content: string,
    maxKeywords: number = 10
): string[] {
    // Strip HTML and convert to lowercase
    const plainText = content.replace(/<[^>]*>/g, '').toLowerCase();

    // Common stop words to filter out
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these',
        'those', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who',
        'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
        'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
        'own', 'same', 'so', 'than', 'too', 'very'
    ]);

    // Extract words
    const words = plainText
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));

    // Count word frequency
    const wordCount = new Map<string, number>();
    words.forEach(word => {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Sort by frequency and return top keywords
    return Array.from(wordCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKeywords)
        .map(([word]) => word);
}

/**
 * Generate slug from title
 * @param title - Article title
 */
export function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Validate and sanitize slug
 */
export function validateSlug(slug: string): { valid: boolean; sanitized: string; errors: string[] } {
    const errors: string[] = [];
    let sanitized = slug.toLowerCase().trim();

    // Check for invalid characters
    if (/[^a-z0-9-]/.test(sanitized)) {
        errors.push('Slug contains invalid characters. Only lowercase letters, numbers, and hyphens are allowed.');
        sanitized = sanitized.replace(/[^a-z0-9-]/g, '-');
    }

    // Check for multiple consecutive hyphens
    if (/--+/.test(sanitized)) {
        errors.push('Slug contains multiple consecutive hyphens.');
        sanitized = sanitized.replace(/-+/g, '-');
    }

    // Check for leading/trailing hyphens
    if (/^-|-$/.test(sanitized)) {
        errors.push('Slug cannot start or end with a hyphen.');
        sanitized = sanitized.replace(/^-+|-+$/g, '');
    }

    // Check minimum length
    if (sanitized.length < 3) {
        errors.push('Slug must be at least 3 characters long.');
    }

    // Check maximum length
    if (sanitized.length > 100) {
        errors.push('Slug must be less than 100 characters.');
        sanitized = sanitized.substring(0, 100);
    }

    return {
        valid: errors.length === 0,
        sanitized,
        errors,
    };
}

/**
 * Generate Open Graph metadata
 */
export function generateOGMetadata(article: {
    title: string;
    excerpt: string;
    imageUrl?: string | null;
    authorName: string;
    publishedAt?: string | null;
}): Record<string, string> {
    const metadata: Record<string, string> = {
        'og:type': 'article',
        'og:title': article.title,
        'og:description': generateMetaDescription(article.excerpt),
    };

    if (article.imageUrl) {
        metadata['og:image'] = article.imageUrl;
        metadata['og:image:alt'] = article.title;
    }

    if (article.publishedAt) {
        metadata['article:published_time'] = new Date(article.publishedAt).toISOString();
    }

    metadata['article:author'] = article.authorName;

    return metadata;
}

/**
 * Generate Twitter Card metadata
 */
export function generateTwitterMetadata(article: {
    title: string;
    excerpt: string;
    imageUrl?: string | null;
}): Record<string, string> {
    const metadata: Record<string, string> = {
        'twitter:card': article.imageUrl ? 'summary_large_image' : 'summary',
        'twitter:title': article.title,
        'twitter:description': generateMetaDescription(article.excerpt, 200),
    };

    if (article.imageUrl) {
        metadata['twitter:image'] = article.imageUrl;
    }

    return metadata;
}

/**
 * Generate structured data (Schema.org) for article
 */
export function generateArticleSchema(article: {
    title: string;
    excerpt: string;
    content: string;
    imageUrl?: string | null;
    authorName: string;
    publishedAt?: string | null;
    updatedAt?: string | null;
    slug: string;
}) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsport.com';

    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.excerpt,
        image: article.imageUrl || undefined,
        author: {
            '@type': 'Person',
            name: article.authorName,
        },
        publisher: {
            '@type': 'Organization',
            name: 'Brix Sport',
            logo: {
                '@type': 'ImageObject',
                url: `${baseUrl}/logo.png`,
            },
        },
        datePublished: article.publishedAt || undefined,
        dateModified: article.updatedAt || article.publishedAt || undefined,
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `${baseUrl}/news/${article.slug}`,
        },
    };
}
