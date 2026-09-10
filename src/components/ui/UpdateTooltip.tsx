'use client';

import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

/**
 * Lighter-weight sibling to Coachmark (src/components/onboarding/Coachmark.tsx).
 * Coachmark is a one-time, dismiss-and-persist callout (fan_tour_dismissals) for
 * a genuinely non-obvious control. This is for "here's what this new/changed
 * thing does" on hover/focus — recurring every time, no dismissal state, no
 * API call. Desktop-only in practice (hover-driven); don't wire it to
 * touch-only surfaces (bottom nav, mobile menu) where there's no hover.
 */
export function UpdateTooltip({
    message,
    children,
}: {
    message: string;
    children: React.ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent>{message}</TooltipContent>
        </Tooltip>
    );
}
