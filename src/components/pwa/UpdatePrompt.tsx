'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';

export function UpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) {
            return;
        }

        navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg) {
                setRegistration(reg);

                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;

                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (
                                newWorker.state === 'installed' &&
                                navigator.serviceWorker.controller
                            ) {
                                // New service worker available
                                setShowPrompt(true);
                            }
                        });
                    }
                });
            }
        });
    }, []);

    const handleUpdate = () => {
        if (registration?.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });

            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
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
                    className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
                >
                    <div className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent border border-blue-500/30 rounded-3xl p-6 backdrop-blur-xl shadow-2xl shadow-blue-500/20">
                        <button
                            onClick={handleDismiss}
                            className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
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
                                className="flex-1 bg-blue-500 text-white font-black uppercase tracking-widest text-xs py-3 px-4 rounded-xl hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Update Now
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-4 py-3 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                            >
                                Later
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
