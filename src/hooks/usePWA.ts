'use client';

import { useState, useEffect } from 'react';
import { registerServiceWorker } from '@/lib/pwa';

export function usePWA(swPath: string, scope?: string, appType: 'user' | 'admin' = 'user') {
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        // Don't register user SW on admin/logger paths — sw-admin.js owns those
        if (swPath.includes('sw-user') &&
            (window.location.pathname.startsWith('/admin') ||
             window.location.pathname.startsWith('/logger'))) {
            return;
        }
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

// BUG-244 follow-up: a stale bundle reference anywhere in the app (not just
// the SW-precached /offline document that BUG-244 itself covered) throws
// "Loading chunk N failed" the moment a deploy removes/renames the chunk a
// still-open tab is trying to lazy-load. Previously this crashed to a raw
// error with no recovery -- the only existing handling was the manual
// "Reload Page" button in components/admin/ErrorBoundary.tsx, which requires
// the user to notice and act. This is the standard mitigation: detect the
// specific chunk-load signature (both the thrown-error and unhandled-
// rejection forms, since dynamic `import()` failures surface as the latter)
// and reload once. Capped to one reload per tab session via sessionStorage
// so a genuinely-offline user (reload will just fail the same way) doesn't
// get stuck in a reload loop -- they fall through to the SW's own
// network-first-with-/offline-fallback behavior instead.
const CHUNK_ERROR_PATTERN = /Loading (chunk|CSS chunk) [\w.-]+ failed|ChunkLoadError/i;
const CHUNK_RELOAD_SESSION_KEY = 'brix-chunk-reload-at';
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

export function useChunkLoadErrorRecovery() {
    useEffect(() => {
        const reloadOnce = () => {
            const last = sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY);
            const now = Date.now();
            if (last && now - parseInt(last, 10) < CHUNK_RELOAD_COOLDOWN_MS) return;
            sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, String(now));
            window.location.reload();
        };

        const handleError = (event: ErrorEvent) => {
            if (CHUNK_ERROR_PATTERN.test(event.message || '')) reloadOnce();
        };
        const handleRejection = (event: PromiseRejectionEvent) => {
            const message = event.reason?.message || String(event.reason || '');
            if (CHUNK_ERROR_PATTERN.test(message)) reloadOnce();
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);
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
