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

const GATED_KEYS = [
    'features.ads.enabled',
    'features.lineupbuilder.enabled',
    'features.usermanagement.enabled',
    'features.news.enabled',
    'features.transfers.enabled',
];

export async function GET() {
    try {
        const rows = await db.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings);
        const byKey = new Map(rows.map(r => [r.key, r.value]));

        const flags: Record<string, boolean> = {};
        for (const key of GATED_KEYS) {
            // Same fail-open default as isFeatureEnabled() -- an unconfigured key
            // (e.g. before initializeDefaultSettings() has ever run) must not read
            // as "disabled" and hide a feature nobody meant to gate.
            flags[key] = byKey.has(key) ? byKey.get(key) === 'true' : true;
        }

        return NextResponse.json({ flags });
    } catch (error) {
        console.error('[feature-flags] Failed to read flags, failing open:', error);
        const flags: Record<string, boolean> = {};
        for (const key of GATED_KEYS) flags[key] = true;
        return NextResponse.json({ flags });
    }
}
