'use client';

import { Component, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, RotateCcw, ListRestart } from 'lucide-react';

interface Props {
    children: ReactNode;
    // Escape hatch back to the match list -- login/session state stays intact
    // in localStorage (src/app/logger/page.tsx), so this doesn't log the
    // logger out, it just drops the crashed match-logging subtree.
    onExitMatch: () => void;
}

interface State {
    error: Error | null;
}

// BACKLOG-310: /logger had no scoped error boundary -- any client-side throw
// inside the active sport logger (FootballLogger/BasketballLogger/etc.) fell
// straight through to the app-wide error.tsx, hard-blocking the entire page
// for a live match logger. This boundary confines a crash to the logging
// subtree: the logger keeps their session, can retry the same match, or back
// out to the match list without losing anything CLAUDE.md's PWA rules
// guarantee (no page refresh required to keep logging).
export class LoggerErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[LoggerErrorBoundary] caught:', error, info.componentStack);
        Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    }

    private retry = () => this.setState({ error: null });

    private exitMatch = () => {
        this.setState({ error: null });
        this.props.onExitMatch();
    };

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white/5 border border-amber-500/20 rounded-[32px] p-6 md:p-10 text-center">
                    <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <AlertTriangle className="text-amber-500" size={24} />
                    </div>
                    <h1 className="font-display text-xl tracking-tight italic uppercase mb-2">
                        Logging Interface Hit a Snag
                    </h1>
                    <p className="text-sm text-white/50 mb-2">
                        Your session is still active. The match feed and any events already saved are safe --
                        this only affects the current screen.
                    </p>
                    <p className="text-xs text-red-300/70 font-mono break-all mb-8 bg-red-500/5 border border-red-500/10 rounded-xl p-3">
                        {error.message}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={this.retry}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all active:scale-95"
                        >
                            <RotateCcw size={14} />
                            Try Again
                        </button>
                        <button
                            onClick={this.exitMatch}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all active:scale-95"
                        >
                            <ListRestart size={14} />
                            Choose Different Match
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
