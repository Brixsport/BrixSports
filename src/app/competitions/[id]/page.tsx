import CompetitionDetailClient from './CompetitionDetailClient';

// This route used to be a single 'use client' page. A dynamic segment with no
// generateStaticParams is rendered on every request (Cache-Control: private,
// no-store), so each visit cost a full function invocation. The empty
// generateStaticParams below opts the route into on-demand ISR: the first visit
// to an id renders once, then the CDN serves it for an hour. All data and per-user
// state still load client-side inside CompetitionDetailClient, so the cached
// HTML is identical for every visitor.
export async function generateStaticParams() {
    return [];
}

export const revalidate = 3600;

export default function CompetitionHubRoute() {
    return <CompetitionDetailClient />;
}
