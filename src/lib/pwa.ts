/**
 * PWA Utilities
 * Helper functions for PWA functionality
 */

export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Register service worker
 */
export async function registerServiceWorker(
    swPath: string,
    options: { scope?: string } = {}
): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register(swPath, {
            scope: options.scope || '/',
        });

        console.log('Service Worker registered:', swPath);

        // Check for updates periodically
        setInterval(() => {
            registration.update();
        }, 60 * 60 * 1000); // Check every hour

        return registration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
    }
}

/**
 * Unregister service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            const success = await registration.unregister();
            console.log('Service Worker unregistered:', success);
            return success;
        }
        return false;
    } catch (error) {
        console.error('Service Worker unregistration failed:', error);
        return false;
    }
}

/**
 * Check if app is installed
 */
export function isAppInstalled(): boolean {
    // Check if running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }

    // Check if running as PWA on iOS
    if ((window.navigator as any).standalone === true) {
        return true;
    }

    return false;
}

/**
 * Check if app is running offline
 */
export function isOffline(): boolean {
    return !navigator.onLine;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
    registration: ServiceWorkerRegistration,
    vapidPublicKey: string
): Promise<PushSubscription | null> {
    try {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });

        console.log('Push subscription created:', subscription);
        return subscription;
    } catch (error) {
        console.error('Push subscription failed:', error);
        return null;
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(
    registration: ServiceWorkerRegistration
): Promise<boolean> {
    try {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            const success = await subscription.unsubscribe();
            console.log('Push unsubscribed:', success);
            return success;
        }
        return false;
    } catch (error) {
        console.error('Push unsubscription failed:', error);
        return false;
    }
}

/**
 * Get push subscription
 */
export async function getPushSubscription(
    registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
    try {
        return await registration.pushManager.getSubscription();
    } catch (error) {
        console.error('Failed to get push subscription:', error);
        return null;
    }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return 'denied';
    }

    if (Notification.permission === 'granted') {
        return 'granted';
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission;
    }

    return Notification.permission;
}

/**
 * Show local notification
 */
export async function showNotification(
    title: string,
    options?: NotificationOptions
): Promise<void> {
    const permission = await requestNotificationPermission();

    if (permission === 'granted') {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            await registration.showNotification(title, {
                icon: '/icons/icon-192x192.png',
                badge: '/icons/badge-96x96.png',
                ...options,
            });
        } else {
            new Notification(title, options);
        }
    }
}

/**
 * Clear cache by name
 */
export async function clearCache(cacheName?: string): Promise<boolean> {
    if (!('caches' in window)) {
        return false;
    }

    try {
        if (cacheName) {
            return await caches.delete(cacheName);
        } else {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
            return true;
        }
    } catch (error) {
        console.error('Failed to clear cache:', error);
        return false;
    }
}

/**
 * Get cache size
 */
export async function getCacheSize(): Promise<number> {
    if (!('caches' in window)) {
        return 0;
    }

    try {
        const cacheNames = await caches.keys();
        let totalSize = 0;

        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();

            for (const request of requests) {
                const response = await cache.match(request);
                if (response) {
                    const blob = await response.blob();
                    totalSize += blob.size;
                }
            }
        }

        return totalSize;
    } catch (error) {
        console.error('Failed to get cache size:', error);
        return 0;
    }
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Convert VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

/**
 * Check for service worker updates
 */
export function checkForUpdates(
    registration: ServiceWorkerRegistration,
    onUpdateFound?: () => void
): void {
    registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        if (newWorker) {
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available
                    console.log('New service worker available');
                    onUpdateFound?.();
                }
            });
        }
    });
}

/**
 * Skip waiting and reload
 */
export function skipWaitingAndReload(registration: ServiceWorkerRegistration): void {
    if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });

        // Reload page when new service worker takes control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }
}

/**
 * Get network information
 */
export function getNetworkInfo(): {
    online: boolean;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
} {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    return {
        online: navigator.onLine,
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt,
    };
}

/**
 * Add to home screen prompt
 */
export function setupInstallPrompt(
    onPromptAvailable?: (prompt: BeforeInstallPromptEvent) => void
): () => void {
    let deferredPrompt: BeforeInstallPromptEvent | null = null;

    const handler = (e: Event) => {
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
        onPromptAvailable?.(deferredPrompt);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Return cleanup function
    return () => {
        window.removeEventListener('beforeinstallprompt', handler);
    };
}

/**
 * Show install prompt
 */
export async function showInstallPrompt(
    prompt: BeforeInstallPromptEvent
): Promise<'accepted' | 'dismissed'> {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome;
}
