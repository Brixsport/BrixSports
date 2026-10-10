import { cn } from '@/lib/utils';

/**
 * Canonical "NEW" pill. Consolidates three previously-inline copies
 * (desktop nav, mobile menu, bottom nav) that had drifted into slightly
 * different colors/shapes — this is the one visual language going forward.
 * Positioning (absolute corner vs. inline-after-label) stays with the
 * caller since that varies by layout, not by the badge itself.
 */
export function NewFeatureBadge({
    label = 'NEW',
    className,
}: {
    label?: string;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'bg-primary text-primary-foreground text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap',
                className
            )}
        >
            {label}
        </span>
    );
}
