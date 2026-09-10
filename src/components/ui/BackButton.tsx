'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppInstalled } from '@/hooks/usePWA';

interface BackButtonProps {
    /**
     * Fallback destination for screens with no reliable browser history to
     * return to (deep links, email links, share targets -- e.g. /login,
     * /reset-password, /livestream/[id]). Omit on screens only ever reached
     * via in-app navigation, where router.back() alone is safe (matches the
     * existing pattern already used on /competitions, /teams/[id], etc.).
     */
    fallbackHref?: string;
    className?: string;
    label?: string;
    /**
     * Richard's scope: near-universal in installed/standalone (PWA) mode,
     * but browser-mode is case-by-case, not a blanket add -- the browser
     * already has its own back button there. Default hides in browser mode;
     * set true only for a screen where browser-mode judgment says it earns
     * its place too (e.g. a deep-link-heavy page like /livestream/[id]).
     */
    forceShow?: boolean;
}

// A tab that landed here cold (deep link, email link, a fresh share-target
// open) has no real app history to go back to -- history.length is 1 (just
// this page) or 2 (browser's own about:blank/initial entry + this page).
// Anything higher means the user actually navigated here within the app, so
// router.back() is the correct, more precise behaviour.
function hasNoAppHistory(): boolean {
    return window.history.length <= 2;
}

export function BackButton({ fallbackHref, className, label = 'Back', forceShow = false }: BackButtonProps) {
    const router = useRouter();
    const isStandalone = useAppInstalled();

    if (!isStandalone && !forceShow) return null;

    const handleClick = () => {
        if (fallbackHref && hasNoAppHistory()) {
            router.push(fallbackHref);
        } else {
            router.back();
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label={label}
            className={cn(
                'shrink-0 p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white',
                className
            )}
        >
            <ArrowLeft size={20} />
        </button>
    );
}
