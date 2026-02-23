'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X, Loader2 } from 'lucide-react';

export function UpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    const checkRegistration = useCallback((reg: ServiceWorkerRegistration) => {
        setRegistration(reg);

        // 1. Check if there's already a waiting worker
        if (reg.waiting) {
            console.log('[UpdatePrompt] Waiting worker found on mount');
            setShowPrompt(true);
            return;
        }

        // 2. Listen for a new worker being installed
        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            console.log('[UpdatePrompt] New worker installing');
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[UpdatePrompt] New worker installed and waiting');
                    setShowPrompt(true);
                }
            });
        });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            return;
        }

        // Get current registration
        navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg) {
                checkRegistration(reg);
            }
        });

        // Also listen for controller change to reload
        const handleControllerChange = () => {
            console.log('[UpdatePrompt] Controller changed, reloading...');
            window.location.reload();
        };

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        return () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, [checkRegistration]);

    const handleUpdate = async () => {
        if (!registration) {
            console.error('[UpdatePrompt] No registration found');
            // Try to get it again as a fallback
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg?.waiting) {
                setIsUpdating(true);
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            } else {
                // If all else fails, just reload
                window.location.reload();
            }
            return;
        }

        if (registration.waiting) {
            console.log('[UpdatePrompt] Sending SKIP_WAITING message');
            setIsUpdating(true);
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
            console.warn('[UpdatePrompt] No waiting worker found during update click');
            // If it disappeared but we think there's an update, maybe it already activated?
            // Or maybe it's still installing? Let's check reg.installing
            if (registration.installing) {
                setIsUpdating(true);
                // Wait for it to install
                registration.installing.addEventListener('statechange', (e: any) => {
                    if (e.target.state === 'installed') {
                        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            } else {
                // Last ditch effort
                window.location.reload();
            }
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
    };

    return (
        <AnimatePresence>
            {showPrompt && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] pointer-events-auto"
                >
                    <div className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent border border-blue-500/30 rounded-3xl p-6 backdrop-blur-xl shadow-2xl shadow-blue-500/20 pointer-events-auto relative overflow-hidden">
                        {isUpdating && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-20 flex items-center justify-center">
                                <Loader2 className="text-white animate-spin" size={32} />
                            </div>
                        )}

                        <button
                            onClick={handleDismiss}
                            disabled={isUpdating}
                            className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors cursor-pointer z-10 disabled:opacity-0"
                            type="button"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <RefreshCw className="text-white" size={24} />
                            </div>
                            <div>
                                <h3 className="font-display text-xl italic uppercase tracking-tight text-white mb-1">
                                    Update Available
                                </h3>
                                <p className="text-sm text-white/60">
                                    A new version of Brixsport is ready. Update now for the latest features and improvements.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleUpdate}
                                disabled={isUpdating}
                                type="button"
                                className="flex-1 bg-blue-500 text-white font-black uppercase tracking-widest text-xs py-3 px-4 rounded-xl hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100"
                            >
                                {isUpdating ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={16} />
                                        Update Now
                                    </>
                                )}
                            </button>
                            {!isUpdating && (
                                <button
                                    onClick={handleDismiss}
                                    type="button"
                                    className="px-4 py-3 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                                >
                                    Later
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

