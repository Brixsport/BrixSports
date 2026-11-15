// BACKLOG-155: the admin Settings page's Feature Flags panel genuinely writes to
// systemSettings, but nothing anywhere else in the codebase ever read a flag back
// -- toggling one changed a DB row with zero effect on anything a user or admin
// actually experienced. This is the real read side, server-only (queries the DB
// directly), meant to be called from Server Components and API route handlers.
//
// Fail-open by design: an unrecognized/unconfigured key returns true. A flag this
// function has never heard of should never be the reason a feature silently
// disappears -- that would be a worse failure mode than the inert-flag bug this
// fixes. New high-volatility flags are given an explicit `false` default in
// DEFAULT_SETTINGS (src/app/api/admin/settings/route.ts) specifically so they gate
// closed before Saturday's match without relying on this fallback.

import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function isFeatureEnabled(key: string, fallback = true): Promise<boolean> {
    try {
        const [row] = await db
            .select({ value: systemSettings.value })
            .from(systemSettings)
            .where(eq(systemSettings.key, key))
            .limit(1);

        if (!row) return fallback;
        return row.value === 'true';
    } catch (error) {
        // A DB error here must never take down the feature it's gating -- fail open,
        // same reasoning as the unrecognized-key case above. A flag that is closed
        // by default passes `fallback = false` and stays closed instead.
        console.error(`[featureFlags] Failed to read "${key}", using fallback ${fallback}:`, error);
        return fallback;
    }
}

// Ratings are not ready for production (semi-automated, cannot be edited
// reliably, auto-recalculates on FINISHED). Closed by default: a missing row
// or a DB error reads as DISABLED, so it stays hidden without anyone having
// to create the setting first.
export const RATINGS_FLAG = 'features.ratings.enabled';
export function isRatingsEnabled(): Promise<boolean> {
    return isFeatureEnabled(RATINGS_FLAG, false);
}
