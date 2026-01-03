'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';
import { BeforeInstallPromptEvent, setupInstallPrompt, showInstallPrompt, isAppInstalled } from '@/lib/pwa';

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (isAppInstalled()) {
            setIsInstalled(true);
            return;
        }

        // Check if user dismissed the prompt before
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const dismissedTime = parseInt(dismissed);
            const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

            // Show again after 7 days
            if (daysSinceDismissed < 7) {
                return;
            }
        }

        // Setup install prompt listener
        const cleanup = setupInstallPrompt((prompt) => {
            setDeferredPrompt(prompt);
            // Show prompt after 30 seconds
            setTimeout(() => {
                setShowPrompt(true);
            }, 5000);
        });

        return cleanup;
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        const outcome = await showInstallPrompt(deferredPrompt);

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
            setIsInstalled(true);
        }

        setShowPrompt(false);
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    };

    if (isInstalled || !showPrompt) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
            >
                <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-3xl p-6 backdrop-blur-xl shadow-2xl shadow-primary/20">
                    <button
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center flex-shrink-0">
                            <Smartphone className="text-black" size={24} />
                        </div>
                        <div>
                            <h3 className="font-display text-xl italic uppercase tracking-tight text-white mb-1">
                                Install Brixsport
                            </h3>
                            <p className="text-sm text-white/60">
                                Get instant access to live scores, faster load times, and offline support
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleInstall}
                            className="flex-1 bg-primary text-black font-black uppercase tracking-widest text-xs py-3 px-4 rounded-xl hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                        >
                            <Download size={16} />
                            Install App
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-4 py-3 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                        >
                            Not Now
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
