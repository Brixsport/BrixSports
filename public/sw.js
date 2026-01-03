/**
 * Service Worker for Push Notifications
 * Handles background push events and displays notifications
 */

// Service Worker version
const CACHE_VERSION = 'brixsport-v1';

// Install event
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker');
    event.waitUntil(self.clients.claim());
});

// Push event - receive push notification
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');

    if (!event.data) {
        console.log('[SW] No data in push event');
        return;
    }

    let data;
    try {
        data = event.data.json();
    } catch (error) {
        console.error('[SW] Error parsing push data:', error);
        return;
    }

    const title = data.title || 'Brixsport';
    const options = {
        body: data.body || '',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/badge-96x96.png',
        image: data.image,
        data: {
            url: data.url || '/',
            matchId: data.matchId,
            type: data.type,
        },
        tag: data.tag || 'brixsport-notification',
        requireInteraction: data.requireInteraction || false,
        vibrate: data.vibrate || [200, 100, 200],
        actions: data.actions || [],
    };

    // Customize notification based on type
    if (data.type === 'GOAL') {
        options.vibrate = [300, 100, 300, 100, 300];
        options.requireInteraction = true;
        options.actions = [
            { action: 'view', title: 'View Match' },
            { action: 'close', title: 'Close' },
        ];
    } else if (data.type === 'MATCH_START') {
        options.actions = [
            { action: 'view', title: 'Watch Live' },
            { action: 'close', title: 'Dismiss' },
        ];
    } else if (data.type === 'RED_CARD') {
        options.vibrate = [500, 200, 500];
        options.requireInteraction = true;
    }

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    // Handle action buttons
    if (event.action === 'close') {
        return;
    }

    // Open or focus the app
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if app is already open
                for (const client of clientList) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }

                // Open new window if app is not open
                if (self.clients.openWindow) {
                    return self.clients.openWindow(urlToOpen);
                }
            })
    );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed');

    // Track notification dismissal (optional analytics)
    const data = event.notification.data;
    if (data && data.type) {
        // Could send analytics here
        console.log('[SW] Notification dismissed:', data.type);
    }
});

// Message event - receive messages from clients
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Fetch event - for offline support (optional)
self.addEventListener('fetch', (event) => {
    // For now, just pass through to network
    // Can add caching strategy here later for offline support
    event.respondWith(fetch(event.request));
});
