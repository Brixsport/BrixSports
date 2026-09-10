'use client';

import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Fan Account Blueprint Phase 3 -- a single first-run callout, anchored to a
 * real element via `anchorRef`. Deliberately not a multi-step tour library
 * (driver.js/shepherd/react-joyride): ADR-001 Decision 2 scoped this to the
 * existing Radix Popover primitive unless a real cross-page sequenced need
 * shows up, and none does yet -- this is one page, one genuinely non-obvious
 * control (the per-team alert toggle), not a sequence.
 *
 * Gated on two things, both checked by the caller before this ever mounts:
 * the `features.onboarding.tour.enabled` flag, and whether this fan has
 * already dismissed `tourId` (fan_tour_dismissals). This component itself
 * only handles the "show it, let them dismiss it" mechanics -- it does not
 * re-check the flag, so it can't become the kind of dead wiring this project
 * has hit before (BACKLOG-155): there is nowhere else the check could live,
 * since the caller controls whether this component renders at all.
 */
export function Coachmark({
    tourId,
    anchorRef,
    title,
    body,
    onDismissed,
}: {
    tourId: string;
    anchorRef: React.RefObject<HTMLElement | null>;
    title: string;
    body: string;
    onDismissed?: () => void;
}) {
    const { user, isAuthenticated } = useAuth();
    const [open, setOpen] = useState(true);
    const [dismissing, setDismissing] = useState(false);

    // Radix's PopoverAnchor needs a live element, not a ref object passed
    // straight through -- re-render once the anchor mounts so positioning
    // has a real target on first paint instead of anchoring to nothing.
    const [, forceRender] = useState(0);
    useEffect(() => {
        forceRender((n) => n + 1);
    }, []);

    const dismiss = async () => {
        setOpen(false);
        onDismissed?.();

        if (!isAuthenticated || !user?.id) return;
        setDismissing(true);
        try {
            const token = localStorage.getItem('authToken');
            await fetch(`/api/users/${user.id}/tours`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ tourId }),
            });
        } catch (error) {
            console.error('[Coachmark] Failed to persist dismissal:', error);
        } finally {
            setDismissing(false);
        }
    };

    if (!anchorRef.current) return null;

    return (
        <Popover open={open}>
            {/* Guarded by the `if (!anchorRef.current) return null` above --
                anchorRef.current is never null once this renders. Radix's own
                virtualRef type (Measurable) just doesn't include null, so a
                cast is needed here even though the runtime guard covers it. */}
            <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
            <PopoverContent
                side="top"
                align="center"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onEscapeKeyDown={dismiss}
                onPointerDownOutside={(e) => e.preventDefault()}
                className="w-64 bg-primary text-black border-primary"
            >
                <h4 className="font-bold text-sm mb-1">{title}</h4>
                <p className="text-xs mb-3">{body}</p>
                <Button size="sm" disabled={dismissing} onClick={dismiss} className="w-full bg-black text-white hover:bg-black/80">
                    Got it
                </Button>
            </PopoverContent>
        </Popover>
    );
}
