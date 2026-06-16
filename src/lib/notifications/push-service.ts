/**
 * Push Notification Service
 * Handles Web Push API integration for browser notifications
 */

'use client';

interface PushSubscriptionData {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

class PushNotificationService {
    private registration: ServiceWorkerRegistration | null = null;
    private vapidPublicKey: string = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

    /**
     * Initialize service worker and check notification support
     */
    async init(): Promise<boolean> {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Workers not supported');
            return false;
        }

        if (!('PushManager' in window)) {
            console.warn('Push notifications not supported');
            return false;
        }

        try {
            // Check existing registrations
            const registrations = await navigator.serviceWorker.getRegistrations();
            console.log('[PushService] Existing SW registrations:', registrations.length);
            
            // Register service worker
            this.registration = await navigator.serviceWorker.getRegistration('/') ?? null;
            if (!this.registration) {
                console.warn('[PushService] No active SW registration found — PWAProvider must register first');
                return false;
            }
            console.log('[PushService] Service Worker registered:', this.registration.scope);
            
            // Wait for the service worker to be active
            if (this.registration.installing) {
                console.log('[PushService] Service Worker installing...');
                await new Promise((resolve) => {
                    this.registration!.addEventListener('controllerchange', resolve, { once: true });
                });
            }
            
            // Check if service worker is active
            if (this.registration.active) {
                console.log('[PushService] Service Worker is active');
            } else {
                console.log('[PushService] Service Worker not yet active');
            }
            
            return true;
        } catch (error) {
            console.error('[PushService] Service Worker registration failed:', error);
            return false;
        }
    }

    /**
     * Check current notification permission
     */
    getPermission(): NotificationPermission {
        return Notification.permission;
    }

    /**
     * Request notification permission from user
     */
    async requestPermission(): Promise<NotificationPermission> {
        if (!('Notification' in window)) {
            console.warn('Notifications not supported');
            return 'denied';
        }

        const permission = await Notification.requestPermission();
        console.log('[PushService] Permission:', permission);
        return permission;
    }

    /**
     * Subscribe to push notifications
     */
    async subscribe(userId: string): Promise<PushSubscriptionData | null> {
        if (!this.registration) {
            await this.init();
        }

        if (!this.registration) {
            console.error('[PushService] No service worker registration');
            return null;
        }

        try {
            // Check if already subscribed
            let subscription = await this.registration.pushManager.getSubscription();

            if (!subscription) {
                // Create new subscription
                subscription = await this.registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey) as BufferSource,
                });
            }

            // Convert subscription to JSON
            const subscriptionJson = subscription.toJSON();

            const subscriptionData: PushSubscriptionData = {
                endpoint: subscriptionJson.endpoint!,
                keys: {
                    p256dh: subscriptionJson.keys!.p256dh!,
                    auth: subscriptionJson.keys!.auth!,
                },
            };

            // Send subscription to server
            await this.saveSubscription(userId, subscriptionData);

            console.log('[PushService] Subscribed successfully');
            return subscriptionData;
        } catch (error) {
            console.error('[PushService] Subscription failed:', error);
            return null;
        }
    }

    /**
     * Unsubscribe from push notifications
     */
    async unsubscribe(userId: string): Promise<boolean> {
        if (!this.registration) {
            return false;
        }

        try {
            const subscription = await this.registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();
                await this.removeSubscription(userId);
                console.log('[PushService] Unsubscribed successfully');
                return true;
            }

            return false;
        } catch (error) {
            console.error('[PushService] Unsubscribe failed:', error);
            return false;
        }
    }

    /**
     * Check if user is subscribed
     */
    async isSubscribed(): Promise<boolean> {
        if (!this.registration) {
            await this.init();
        }

        if (!this.registration) {
            return false;
        }

        try {
            const subscription = await this.registration.pushManager.getSubscription();
            return subscription !== null;
        } catch (error) {
            console.error('[PushService] Error checking subscription:', error);
            return false;
        }
    }

    /**
     * Show local notification (for testing)
     */
    async showNotification(title: string, options?: NotificationOptions): Promise<void> {
        if (!this.registration) {
            await this.init();
        }

        if (!this.registration) {
            console.error('[PushService] No service worker registration');
            return;
        }

        try {
            await this.registration.showNotification(title, {
                badge: '/icons/icon-192x192.png',
                icon: '/icons/icon-192x192.png',
                ...options,
            });
        } catch (error) {
            console.error('[PushService] Show notification failed:', error);
        }
    }

    /**
     * Save subscription to server
     */
    private async saveSubscription(userId: string, subscription: PushSubscriptionData): Promise<void> {
        try {
            const requestBody = {
                userId,
                subscription,
            };
            
            console.log('[PushService] Sending subscription request:', requestBody);

            const response = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log('[PushService] Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[PushService] Error response:', errorData);
                throw new Error(errorData.error || 'Failed to save subscription');
            }

            console.log('[PushService] Subscription saved to server');
        } catch (error) {
            console.error('[PushService] Error saving subscription:', error);
            throw error;
        }
    }

    /**
     * Remove subscription from server
     */
    private async removeSubscription(userId: string): Promise<void> {
        try {
            const response = await fetch('/api/notifications/subscribe', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId }),
            });

            if (!response.ok) {
                throw new Error('Failed to remove subscription');
            }

            console.log('[PushService] Subscription removed from server');
        } catch (error) {
            console.error('[PushService] Error removing subscription:', error);
            throw error;
        }
    }

    /**
     * Convert VAPID key from base64 to Uint8Array
     */
    private urlBase64ToUint8Array(base64String: string): Uint8Array {
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
}

// Singleton instance
let pushService: PushNotificationService | null = null;

export function getPushService(): PushNotificationService {
    if (!pushService) {
        pushService = new PushNotificationService();
    }
    return pushService;
}

export { PushNotificationService };
export type { PushSubscriptionData };
