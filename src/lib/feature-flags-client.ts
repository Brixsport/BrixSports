// Shared, de-duplicated client read of GET /api/feature-flags.
//
// Before this, useFeatureFlags, FeatureGate and the favourites page each fetched
// the endpoint on every mount -- N components on one page meant N origin calls.
// This keeps ONE in-flight/recent promise per tab, so a page load costs at most
// one request (and that one is usually answered by the CDN, see the route's
// Cache-Control). A failed fetch is not remembered, so the next caller retries.

// Keys that read as DISABLED until the API explicitly says they are on. Every
// other key fails open (unknown or still loading reads as enabled). Keep this in
// step with CLOSED_BY_DEFAULT in src/app/api/feature-flags/route.ts.
export const CLIENT_CLOSED_BY_DEFAULT: ReadonlySet<string> = new Set([
    'features.ratings.enabled',
    // Livestream is not in use: the Live Now section must not even mount (and
    // fire its first fetch) before the flags have arrived.
    'features.livestream.enabled',
]);

export function resolveFlag(flags: Record<string, boolean>, flagKey: string): boolean {
    return CLIENT_CLOSED_BY_DEFAULT.has(flagKey) ? flags[flagKey] === true : flags[flagKey] !== false;
}

const CLIENT_TTL_MS = 60_000;

let cached: { at: number; promise: Promise<Record<string, boolean>> } | null = null;

export function fetchFeatureFlags(): Promise<Record<string, boolean>> {
    const now = Date.now();
    if (cached && now - cached.at < CLIENT_TTL_MS) return cached.promise;

    const promise = fetch('/api/feature-flags')
        .then((res) => {
            if (!res.ok) throw new Error(`feature-flags ${res.status}`);
            return res.json();
        })
        .then((data) => (data?.flags ?? {}) as Record<string, boolean>)
        .catch((err) => {
            // Don't pin a failure: let the next caller try again.
            if (cached?.promise === promise) cached = null;
            throw err;
        });

    cached = { at: now, promise };
    return promise;
}
