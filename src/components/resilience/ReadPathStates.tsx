'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

// Shown when a viewer page has never loaded its data. Deliberately distinct from
// each page's "not found" state: a failed fetch is not proof the thing is gone.
export function LoadFailedState({
    title = "Couldn't load this right now",
    onRetry,
}: {
    title?: string;
    onRetry: () => void;
}) {
    return (
        <div className="py-20 text-center" role="alert">
            <WifiOff size={64} className="mx-auto text-foreground/10 mb-4" />
            <h2 className="text-2xl font-bold mb-2">{title}</h2>
            <p className="text-foreground/40">Check your connection and try again.</p>
            <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors"
            >
                <RefreshCw size={16} />
                Try again
            </button>
        </div>
    );
}

// Shown while previously loaded data stays on screen after a failed refresh.
export function StaleDataBanner() {
    return (
        <div
            role="status"
            className="mb-6 flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-muted text-sm text-foreground/70"
        >
            <WifiOff size={16} className="shrink-0" />
            <span>Showing saved data — reconnecting automatically</span>
        </div>
    );
}
