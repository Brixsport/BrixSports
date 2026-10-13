'use client';

import Script from 'next/script';
import { serializeJsonLd } from '@/lib/json-ld';

interface StructuredDataProps {
    data: Record<string, unknown> | Record<string, unknown>[];
    id?: string;
}

/**
 * StructuredData Component
 * 
 * Injects JSON-LD structured data into the page for SEO and AEO.
 * Use this in client components where you can't export metadata.
 * 
 * @example
 * <StructuredData 
 *   data={generateSportsEventSchema(matchData)} 
 *   id="match-schema"
 * />
 */
export function StructuredData({ data, id = 'structured-data' }: StructuredDataProps) {
    return (
        <Script
            id={id}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
        />
    );
}

/**
 * MultiStructuredData Component
 * 
 * Renders multiple structured data schemas on a single page.
 */
interface MultiStructuredDataProps {
    schemas: Array<{
        data: Record<string, unknown>;
        id: string;
    }>;
}

export function MultiStructuredData({ schemas }: MultiStructuredDataProps) {
    return (
        <>
            {schemas.map((schema) => (
                <Script
                    key={schema.id}
                    id={schema.id}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema.data) }}
                />
            ))}
        </>
    );
}

export default StructuredData;
