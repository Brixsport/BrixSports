'use client';

import { useState, useEffect } from 'react';
import { registerServiceWorker } from '@/lib/pwa';

export function usePWA(swPath: string, scope?: string, appType: 'user' | 'admin' = 'user') {
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        registerServiceWorker(swPath, { scope })
            .then((reg) => {
                if (reg) {
                    setRegistration(reg);
                    setIsRegistered(true);

                    // Check if running in standalone mode and persist this info
                    // This helps suppress prompts on the user side if already installed
                    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone === true;

                    if (isStandalone) {
                        localStorage.setItem(`brix-${appType}-installed`, 'true');
                    }
                }
            })
            .catch((err) => {
                setError(err);
            });
    }, [swPath, scope, appType]);

    return { registration, isRegistered, error };
}

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        setIsOnline(navigator.onLine);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}

export function useNetworkStatus() {
    const [networkStatus, setNetworkStatus] = useState({
        online: true,
        effectiveType: 'unknown',
        downlink: 0,
        rtt: 0,
    });

    useEffect(() => {
        const updateNetworkStatus = () => {
            const connection = (navigator as any).connection ||
                (navigator as any).mozConnection ||
                (navigator as any).webkitConnection;

            setNetworkStatus({
                online: navigator.onLine,
                effectiveType: connection?.effectiveType || 'unknown',
                downlink: connection?.downlink || 0,
                rtt: connection?.rtt || 0,
            });
        };

        updateNetworkStatus();

        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);

        const connection = (navigator as any).connection ||
            (navigator as any).mozConnection ||
            (navigator as any).webkitConnection;

        if (connection) {
            connection.addEventListener('change', updateNetworkStatus);
        }

        return () => {
            window.removeEventListener('online', updateNetworkStatus);
            window.removeEventListener('offline', updateNetworkStatus);

            if (connection) {
                connection.removeEventListener('change', updateNetworkStatus);
            }
        };
    }, []);

    return networkStatus;
}

export function useBeforeInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const promptInstall = async () => {
        if (!deferredPrompt) {
            return null;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        setDeferredPrompt(null);
        setIsInstallable(false);

        return outcome;
    };

    return { isInstallable, promptInstall };
}

export function useAppInstalled() {
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if running in standalone mode
        const checkInstalled = () => {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            const isIOSStandalone = (window.navigator as any).standalone === true;
            setIsInstalled(isStandalone || isIOSStandalone);
        };

        checkInstalled();

        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
        });
    }, []);

    return isInstalled;
}
