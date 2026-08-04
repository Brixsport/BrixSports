'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share, Plus, Smartphone } from 'lucide-react';

export function IOSInstallPrompt({ appType = 'user' }: { appType?: 'user' | 'admin' }) {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if device is iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIOSDevice);

        // Check if already installed
        const isStandalone = (window.navigator as any).standalone === true;
        setIsInstalled(isStandalone);

        // BACKLOG-131: was un-namespaced ('ios-install-dismissed'), same bug
        // class as InstallPrompt.tsx's own dismiss key.
        const dismissed = localStorage.getItem(`brix-${appType}-ios-install-dismissed`);
        if (dismissed) {
            const dismissedTime = parseInt(dismissed);
            const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

            // Show again after 7 days
            if (daysSinceDismissed < 7) {
                return;
            }
        }

        // Check if any part of the app is already installed (persisted flag)
        const persistentInstall = localStorage.getItem(`brix-${appType}-installed`) === 'true';
        if (persistentInstall) {
            setIsInstalled(true);
            return;
        }

        // Show prompt after 30 seconds for iOS users who haven't installed
        if (isIOSDevice && !isStandalone) {
            setTimeout(() => {
                setShowPrompt(true);
            }, 30000);
        }
    }, [appType]);

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem(`brix-${appType}-ios-install-dismissed`, Date.now().toString());
    };

    // Only show for iOS devices that haven't installed
    if (!isIOS || isInstalled || !showPrompt) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-[420px] z-50"
            >
                <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-3xl p-6 backdrop-blur-xl shadow-2xl shadow-primary/20">
                    <button
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center flex-shrink-0">
                            <Smartphone className="text-black" size={24} />
                        </div>
                        <div>
                            <h3 className="font-display text-xl italic uppercase tracking-tight text-white mb-1">
                                Install Brixsport
                            </h3>
                            <p className="text-sm text-white/60">
                                Add to your home screen for the best experience
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-blue-400 font-bold text-sm">1</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-white text-sm font-medium mb-1">
                                    Tap the Share button
                                </p>
                                <div className="flex items-center gap-2 text-white/60 text-xs">
                                    <Share size={16} className="text-blue-400" />
                                    <span>Look for the share icon in Safari</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-blue-400 font-bold text-sm">2</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-white text-sm font-medium mb-1">
                                    Select "Add to Home Screen"
                                </p>
                                <div className="flex items-center gap-2 text-white/60 text-xs">
                                    <Plus size={16} className="text-blue-400" />
                                    <span>Scroll down in the share menu</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-blue-400 font-bold text-sm">3</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-white text-sm font-medium mb-1">
                                    Tap "Add" to confirm
                                </p>
                                <p className="text-white/60 text-xs">
                                    The app will appear on your home screen
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <p className="text-xs text-white/60 text-center">
                            <span className="text-primary font-bold">Pro tip:</span> Once installed, you'll get faster load times, offline access, and push notifications for live matches!
                        </p>
                    </div>

                    <button
                        onClick={handleDismiss}
                        className="w-full mt-4 px-4 py-3 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                        Got it, thanks!
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export function IOSInstallBanner({ appType = 'user' }: { appType?: 'user' | 'admin' }) {
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if device is iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIOSDevice);

        // Check if already installed
        const isStandalone = (window.navigator as any).standalone === true;
        setIsInstalled(isStandalone);

        // BACKLOG-131: was un-namespaced ('ios-banner-dismissed'), same bug
        // class as the other two dismiss keys in this file/InstallPrompt.tsx.
        const bannerDismissed = localStorage.getItem(`brix-${appType}-ios-banner-dismissed`);

        // Check if any part of the app is already installed (persisted flag)
        const persistentInstall = localStorage.getItem(`brix-${appType}-installed`) === 'true';

        // Show banner for iOS users who haven't installed
        if (isIOSDevice && !isStandalone && !bannerDismissed && !persistentInstall) {
            setShowBanner(true);
        }
    }, [appType]);

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem(`brix-${appType}-ios-banner-dismissed`, 'true');
    };

    if (!isIOS || isInstalled || !showBanner) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                className="fixed top-0 left-0 right-0 z-50"
            >
                <div className="bg-gradient-to-r from-primary/90 to-purple-600/90 backdrop-blur-xl shadow-lg">
                    <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                            <Smartphone className="text-white flex-shrink-0" size={20} />
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-sm">
                                    Install Brixsport
                                </p>
                                <p className="text-white/80 text-xs truncate">
                                    Tap <Share size={12} className="inline" /> then "Add to Home Screen"
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleDismiss}
                            className="text-white/80 hover:text-white transition-colors flex-shrink-0"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
