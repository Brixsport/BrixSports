'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { isOffline, getNetworkInfo } from '@/lib/pwa';

export function OfflineIndicator() {
    const [offline, setOffline] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const [justCameOnline, setJustCameOnline] = useState(false);

    useEffect(() => {
        // Initial check
        setOffline(isOffline());

        const handleOnline = () => {
            setOffline(false);
            setJustCameOnline(true);
            setShowBanner(true);

            // Hide "back online" banner after 3 seconds
            setTimeout(() => {
                setShowBanner(false);
                setJustCameOnline(false);
            }, 3000);
        };

        const handleOffline = () => {
            setOffline(true);
            setShowBanner(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleReload = () => {
        window.location.reload();
    };

    return (
        <AnimatePresence>
            {showBanner && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-50"
                >
                    <div
                        className={`${offline
                                ? 'bg-gradient-to-r from-orange-500/90 to-red-500/90'
                                : 'bg-gradient-to-r from-green-500/90 to-emerald-500/90'
                            } backdrop-blur-xl shadow-lg`}
                    >
                        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {offline ? (
                                    <WifiOff className="text-white" size={20} />
                                ) : (
                                    <Wifi className="text-white" size={20} />
                                )}
                                <div>
                                    <p className="text-white font-bold text-sm">
                                        {offline ? 'You are offline' : 'Back online!'}
                                    </p>
                                    <p className="text-white/80 text-xs">
                                        {offline
                                            ? 'Some features may be limited. Changes will sync when you reconnect.'
                                            : 'Connection restored. Syncing your data...'}
                                    </p>
                                </div>
                            </div>

                            {offline && (
                                <button
                                    onClick={handleReload}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-bold uppercase tracking-widest transition-colors"
                                >
                                    <RefreshCw size={14} />
                                    Retry
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export function OfflineBadge() {
    const [offline, setOffline] = useState(false);
    const [networkInfo, setNetworkInfo] = useState<ReturnType<typeof getNetworkInfo> | null>(null);

    useEffect(() => {
        const updateStatus = () => {
            setOffline(isOffline());
            setNetworkInfo(getNetworkInfo());
        };

        updateStatus();

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);

        // Update network info periodically
        const interval = setInterval(updateStatus, 5000);

        return () => {
            window.removeEventListener('online', updateStatus);
            window.removeEventListener('offline', updateStatus);
            clearInterval(interval);
        };
    }, []);

    if (!offline) {
        return null;
    }

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-24 right-4 z-40"
        >
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-2 backdrop-blur-xl shadow-lg flex items-center gap-2">
                <WifiOff className="text-orange-500" size={16} />
                <span className="text-orange-500 text-xs font-bold uppercase tracking-widest">
                    Offline Mode
                </span>
            </div>
        </motion.div>
    );
}
