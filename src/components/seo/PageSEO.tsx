'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface PageSEOProps {
    title: string;
    description: string;
    keywords?: string[];
    ogImage?: string;
    ogType?: 'website' | 'article' | 'profile';
    twitterCard?: 'summary' | 'summary_large_image';
    canonicalUrl?: string;
    noindex?: boolean;
    article?: {
        publishedTime?: string;
        modifiedTime?: string;
        author?: string;
        section?: string;
        tags?: string[];
    };
}

/**
 * PageSEO Component
 * 
 * Dynamic SEO component for client-side pages that can't export metadata.
 * Updates document head with meta tags for social sharing and search engines.
 * 
 * @example
 * <PageSEO
 *   title="Match Title"
 *   description="Match description"
 *   ogImage="/match-image.jpg"
 * />
 */
export function PageSEO({
    title,
    description,
    keywords = [],
    ogImage = '/assests/Logos/BRIX-SPORT-LOGO.png',
    ogType = 'website',
    twitterCard = 'summary_large_image',
    canonicalUrl,
    noindex = false,
    article,
}: PageSEOProps) {
    const pathname = usePathname();
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsport.com';
    const fullTitle = title.includes('Brixsport') ? title : `${title} | Brixsport`;
    const fullCanonical = canonicalUrl || `${baseUrl}${pathname}`;

    useEffect(() => {
        // Update document title
        document.title = fullTitle;

        // Helper to update or create meta tag
        const setMetaTag = (property: string, content: string, isProperty = false) => {
            const selector = isProperty ? `meta[property="${property}"]` : `meta[name="${property}"]`;
            let meta = document.querySelector(selector) as HTMLMetaElement;
            
            if (!meta) {
                meta = document.createElement('meta');
                if (isProperty) {
                    meta.setAttribute('property', property);
                } else {
                    meta.setAttribute('name', property);
                }
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', content);
        };

        // Update link canonical
        let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
        if (!canonicalLink) {
            canonicalLink = document.createElement('link');
            canonicalLink.setAttribute('rel', 'canonical');
            document.head.appendChild(canonicalLink);
        }
        canonicalLink.setAttribute('href', fullCanonical);

        // Primary meta tags
        setMetaTag('description', description);
        
        if (keywords.length > 0) {
            setMetaTag('keywords', keywords.join(', '));
        }

        // Robots
        setMetaTag('robots', noindex ? 'noindex, nofollow' : 'index, follow');

        // Open Graph
        setMetaTag('og:title', title, true);
        setMetaTag('og:description', description, true);
        setMetaTag('og:type', ogType, true);
        setMetaTag('og:url', fullCanonical, true);
        setMetaTag('og:site_name', 'Brixsport', true);
        
        if (ogImage) {
            const fullImageUrl = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`;
            setMetaTag('og:image', fullImageUrl, true);
            setMetaTag('og:image:alt', title, true);
            setMetaTag('og:image:width', '1200', true);
            setMetaTag('og:image:height', '630', true);
        }

        // Article-specific OG tags
        if (article) {
            if (article.publishedTime) {
                setMetaTag('article:published_time', article.publishedTime, true);
            }
            if (article.modifiedTime) {
                setMetaTag('article:modified_time', article.modifiedTime, true);
            }
            if (article.author) {
                setMetaTag('article:author', article.author, true);
            }
            if (article.section) {
                setMetaTag('article:section', article.section, true);
            }
            if (article.tags) {
                article.tags.forEach(tag => {
                    // Note: We can only set one article:tag, so we'll use keywords instead
                });
            }
        }

        // Twitter Card
        setMetaTag('twitter:card', twitterCard);
        setMetaTag('twitter:title', fullTitle);
        setMetaTag('twitter:description', description);
        setMetaTag('twitter:site', '@brixsport');
        
        if (ogImage) {
            const fullImageUrl = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`;
            setMetaTag('twitter:image', fullImageUrl);
        }

        // Cleanup function to remove dynamically added meta tags on unmount
        return () => {
            // We don't remove the tags to preserve SEO during navigation
        };
    }, [fullTitle, description, keywords, ogImage, ogType, twitterCard, fullCanonical, noindex, article, pathname, baseUrl]);

    return null;
}

export default PageSEO;
