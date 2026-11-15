'use client';

// D3/BACKLOG-155: shared client-side read of GET /api/feature-flags, so nav
// components can hide a link the same way FeatureGate.tsx hides a page's
// content -- one fetch, one fail-open policy, instead of duplicating the
// fetch/state boilerplate at every nav call site.
import { useEffect, useState } from 'react';

export function useFeatureFlags() {
    const [flags, setFlags] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let cancelled = false;
        fetch('/api/feature-flags')
            .then((res) => res.json())
            .then((data) => {
                if (!cancelled) setFlags(data?.flags ?? {});
            })
            .catch(() => {
                // Fail open, same reasoning as FeatureGate.tsx and the API route
                // itself -- a check that can't complete must never be the reason
                // a nav link disappears.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Fail open: an unknown/not-yet-loaded key reads as enabled, only an
    // explicit `false` hides anything.
    // Closed-by-default keys (ratings) are the exception: hidden until the API
    // says they are on, so a slow or failed fetch never flashes them open.
    return (flagKey: string) =>
        flagKey === 'features.ratings.enabled' ? flags[flagKey] === true : flags[flagKey] !== false;
}
