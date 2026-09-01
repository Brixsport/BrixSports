import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { inArray } from 'drizzle-orm';

export interface RatingConfig {
    baseRating: number;
    maxRating: number;
    minRating: number;
    eyePointWeight: number;
}

// Matches admin/settings' own DEFAULT_SETTINGS (src/app/api/admin/settings/route.ts)
// -- used when a key's system_settings row doesn't exist yet
// (initializeDefaultSettings() only runs as a side effect of that route's GET,
// BACKLOG-155) or the DB read fails.
const FALLBACK: RatingConfig = {
    baseRating: 7.0,
    maxRating: 10.0,
    minRating: 1.0,
    eyePointWeight: 0.5,
};

const KEYS = {
    baseRating: 'algorithm.rating.baseline',
    maxRating: 'algorithm.rating.max',
    minRating: 'algorithm.rating.min',
    eyePointWeight: 'algorithm.eyepoint.weight',
} as const;

const CACHE_TTL_MS = 60 * 1000;
let cached: { config: RatingConfig; expiresAt: number } | null = null;

/**
 * BACKLOG-318: RatingCalculator previously hardcoded these instead of reading
 * /admin/settings' "Algorithm Configuration" section, which silently did
 * nothing no matter what an admin saved there. Cached (60s) because this is
 * read on the live per-event rating-calculation path (BACKLOG-159/255's own
 * note on that path's latency contribution) -- not re-queried on every event.
 *
 * Server-only (imports `db`) -- deliberately kept out of ratingCalculator.ts
 * itself, which admin/match-ratings/[id]/page.tsx imports client-side.
 *
 * NOT wired here: `algorithm.time.decay`. Confirmed (BACKLOG-318's own
 * investigation, unchanged by this fix) -- no corresponding mechanic exists
 * anywhere in RatingCalculator's logic, and its intended semantics were never
 * documented. Inventing one now would be new feature work, not a wiring fix.
 */
export async function getRatingConfig(): Promise<RatingConfig> {
    const now = Date.now();
    if (cached && now < cached.expiresAt) {
        return cached.config;
    }

    try {
        const rows = await db
            .select()
            .from(systemSettings)
            .where(inArray(systemSettings.key, Object.values(KEYS)));

        const byKey = new Map(rows.map((r) => [r.key, r.value]));
        const num = (key: string, fallback: number) => {
            const raw = byKey.get(key);
            const parsed = raw !== undefined ? Number(raw) : NaN;
            return Number.isFinite(parsed) ? parsed : fallback;
        };

        const config: RatingConfig = {
            baseRating: num(KEYS.baseRating, FALLBACK.baseRating),
            maxRating: num(KEYS.maxRating, FALLBACK.maxRating),
            minRating: num(KEYS.minRating, FALLBACK.minRating),
            eyePointWeight: num(KEYS.eyePointWeight, FALLBACK.eyePointWeight),
        };

        cached = { config, expiresAt: now + CACHE_TTL_MS };
        return config;
    } catch (err) {
        console.error('[ratingConfig] Failed to read algorithm settings, using fallback:', err);
        return FALLBACK;
    }
}
