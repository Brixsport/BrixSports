'use client';

import { useEffect } from 'react';
import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
    // The address bar still holds the real destination URL when the SW serves
    // this document as a fetch fallback (respondWith doesn't navigate), so a
    // reload here retries the original page, not /offline itself. This just
    // removes the need for the user to notice reconnection and tap Try Again.
    useEffect(() => {
        const handleOnline = () => window.location.reload();
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
                <div className="mb-8">
                    <div className="w-24 h-24 bg-orange-500/20 border border-orange-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <WifiOff className="text-orange-500" size={48} />
                    </div>

                    <h1 className="font-display text-4xl italic uppercase tracking-tight mb-3">
                        You're Offline
                    </h1>

                    <p className="text-white/60 text-lg mb-8">
                        It looks like you've lost your internet connection. Some features may be limited.
                    </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-6">
                    <h2 className="text-sm font-black uppercase tracking-widest text-white/40 mb-4">
                        What you can still do:
                    </h2>
                    <ul className="space-y-3 text-left">
                        <li className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                            <span className="text-white/80 text-sm">
                                View previously loaded matches and scores
                            </span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                            <span className="text-white/80 text-sm">
                                Browse cached news articles
                            </span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                            <span className="text-white/80 text-sm">
                                Access your favorite teams and players
                            </span>
                        </li>
                    </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="flex-1 bg-primary text-black font-black uppercase tracking-widest text-xs py-4 px-6 rounded-xl hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={16} />
                        Try Again
                    </button>

                    <Link
                        href="/"
                        className="flex-1 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs py-4 px-6 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                    >
                        <Home size={16} />
                        Go Home
                    </Link>
                </div>

                <p className="text-white/40 text-xs mt-6">
                    Your changes will be synced automatically when you're back online
                </p>
            </div>
        </div>
    );
}
