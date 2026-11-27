// BACKLOG-155: public, unauthenticated, read-only. Client-component pages (the
// gated admin panels, all of which are 'use client' and fetch their own data via
// useEffect) can't call src/lib/featureFlags.ts's server-only isFeatureEnabled()
// directly -- this is the thin read surface they hit instead. No auth needed:
// these are booleans describing what's turned on, not sensitive data, and every
// gated page is still independently auth-checked by its own existing logic same
// as before this fix.

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';

// Keys that read as DISABLED when no row exists (and when the read fails).
const CLOSED_BY_DEFAULT = new Set(['features.ratings.enabled', 'features.livestream.enabled']);

const GATED_KEYS = [
    'features.ads.enabled',
    'features.lineupbuilder.enabled',
    'features.usermanagement.enabled',
    'features.news.enabled',
    'features.transfers.enabled',
    'features.ratings.enabled',
    'features.livestream.enabled',
    // Fan Account Blueprint Phase 3 -- kill switch for the /favourites
    // first-run coachmark tour. Same fail-open default as every other key
    // here: unconfigured reads as enabled, never silently hides the tour.
    'features.onboarding.tour.enabled',
];

// Identity-independent booleans that change on an admin toggle (about monthly):
// cache 60s at the edge + 5 min stale-while-revalidate. A flipped flag reaches
// viewers within ~1-6 minutes. The fail-open fallback below is NOT cached, so a
// transient DB failure can never get pinned at the edge as "everything enabled".
const PUBLIC_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET() {
    try {
        const rows = await db.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings);
        const byKey = new Map(rows.map(r => [r.key, r.value]));

        const flags: Record<string, boolean> = {};
        for (const key of GATED_KEYS) {
            // Same fail-open default as isFeatureEnabled() -- an unconfigured key
            // (e.g. before initializeDefaultSettings() has ever run) must not read
            // as "disabled" and hide a feature nobody meant to gate.
            flags[key] = byKey.has(key) ? byKey.get(key) === 'true' : !CLOSED_BY_DEFAULT.has(key);
        }

        return NextResponse.json({ flags }, { headers: PUBLIC_CACHE_HEADERS });
    } catch (error) {
        console.error('[feature-flags] Failed to read flags, failing open:', error);
        const flags: Record<string, boolean> = {};
        for (const key of GATED_KEYS) flags[key] = !CLOSED_BY_DEFAULT.has(key);
        return NextResponse.json({ flags }, { headers: NO_STORE_HEADERS });
    }
}
