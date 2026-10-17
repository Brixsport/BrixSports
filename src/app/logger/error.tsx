'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorPageProps {
    error: Error & { digest?: string };
    reset: () => void;
}

// BACKLOG-310: route-scoped fallback for /logger so a crash here doesn't
// fall through to the app-wide error.tsx's full-page "Houston, we have a
// problem" screen -- that's a jarring, marketing-styled dead-end for a live
// match logger mid-match. Most crashes inside an active match are already
// caught closer to the source by LoggerErrorBoundary (see page.tsx), which
// keeps the login/match-list state around it intact; this is the outer
// safety net for anything above that (login screen, match list, hook
// errors). reset() re-mounts the page, which rehydrates login + the
// selected match from localStorage (page.tsx's own persistence), so this
// recovers the logger's session rather than losing it.
export default function LoggerError({ error, reset }: ErrorPageProps) {
    useEffect(() => {
        console.error('[/logger error boundary]', error);
        Sentry.captureException(error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white/5 border border-amber-500/20 rounded-[32px] p-6 md:p-10 text-center">
                <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="text-amber-500" size={24} />
                </div>
                <h1 className="font-display text-xl tracking-tight italic uppercase mb-2">
                    Logger Session Interrupted
                </h1>
                <p className="text-sm text-white/50 mb-2">
                    Something went wrong loading the logger. Your login and match selection are saved --
                    retrying should pick up right where you left off.
                </p>
                <p className="text-xs text-red-300/70 font-mono break-all mb-8 bg-red-500/5 border border-red-500/10 rounded-xl p-3">
                    {error.message}
                </p>
                <button
                    onClick={reset}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all active:scale-95"
                >
                    <RotateCcw size={14} />
                    Try Again
                </button>
            </div>
        </div>
    );
}
