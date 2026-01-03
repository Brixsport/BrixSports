/**
 * Admin & Logger PWA Service Worker
 * Handles caching, offline support, and real-time sync for admin and logger
 */

const CACHE_VERSION = 'brixsport-admin-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets to cache immediately
const STATIC_ASSETS = [
    '/admin',
    '/logger',
    '/admin/matches',
    '/admin/news',
    '/admin/loggers',
    '/offline',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
];

// Maximum cache sizes
const MAX_DYNAMIC_CACHE_SIZE = 30;
const MAX_API_CACHE_SIZE = 50;

// Cache size limiter
const limitCacheSize = async (cacheName, maxSize) => {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxSize) {
        await cache.delete(keys[0]);
        await limitCacheSize(cacheName, maxSize);
    }
};

// Install event
self.addEventListener('install', (event) => {
    console.log('[SW Admin] Installing Service Worker');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW Admin] Caching static assets');
                return cache.addAll(STATIC_ASSETS).catch((err) => {
                    console.warn('[SW Admin] Some assets failed to cache:', err);
                });
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[SW Admin] Activating Service Worker');
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys
                        .filter((key) => key.startsWith('brixsport-admin-') && key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE)
                        .map((key) => caches.delete(key))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - optimized for admin/logger operations
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests for caching (but allow them to pass through)
    if (request.method !== 'GET') {
        return;
    }

    // API requests - Network first with short cache fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Only cache GET requests with successful responses
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(API_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                            limitCacheSize(API_CACHE, MAX_API_CACHE_SIZE);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached version if network fails
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Return offline response for critical endpoints
                        return new Response(
                            JSON.stringify({ error: 'Offline', offline: true }),
                            {
                                status: 503,
                                headers: { 'Content-Type': 'application/json' }
                            }
                        );
                    });
                })
        );
        return;
    }

    // Static assets - Cache first
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    return cachedResponse || fetch(request);
                })
        );
        return;
    }

    // All other requests - Network first
    event.respondWith(
        fetch(request)
            .then((response) => {
                const responseClone = response.clone();
                caches.open(DYNAMIC_CACHE).then((cache) => {
                    cache.put(request, responseClone);
                    limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
                });
                return response;
            })
            .catch(() => {
                return caches.match(request).then((cachedResponse) => {
                    return cachedResponse || caches.match('/offline');
                });
            })
    );
});

// Background sync for logger events
self.addEventListener('sync', (event) => {
    console.log('[SW Admin] Background sync:', event.tag);

    if (event.tag === 'sync-match-events') {
        event.waitUntil(syncMatchEvents());
    } else if (event.tag === 'sync-admin-changes') {
        event.waitUntil(syncAdminChanges());
    }
});

// Sync match events (for logger)
async function syncMatchEvents() {
    try {
        const db = await openDB();
        const pendingEvents = await db.getAll('pendingMatchEvents');

        for (const event of pendingEvents) {
            const response = await fetch(`/api/matches/${event.matchId}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event.data),
            });

            if (response.ok) {
                await db.delete('pendingMatchEvents', event.id);
                console.log('[SW Admin] Match event synced:', event.id);
            }
        }

        // Notify all clients that sync is complete
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                tag: 'sync-match-events',
            });
        });

        console.log('[SW Admin] All match events synced');
    } catch (error) {
        console.error('[SW Admin] Error syncing match events:', error);
        throw error; // Retry sync
    }
}

// Sync admin changes
async function syncAdminChanges() {
    try {
        const db = await openDB();
        const pendingChanges = await db.getAll('pendingAdminChanges');

        for (const change of pendingChanges) {
            const response = await fetch(change.url, {
                method: change.method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(change.data),
            });

            if (response.ok) {
                await db.delete('pendingAdminChanges', change.id);
                console.log('[SW Admin] Admin change synced:', change.id);
            }
        }

        // Notify all clients
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                tag: 'sync-admin-changes',
            });
        });

        console.log('[SW Admin] All admin changes synced');
    } catch (error) {
        console.error('[SW Admin] Error syncing admin changes:', error);
        throw error;
    }
}

// Open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BrixsportAdminDB', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('pendingMatchEvents')) {
                const store = db.createObjectStore('pendingMatchEvents', { keyPath: 'id', autoIncrement: true });
                store.createIndex('matchId', 'matchId', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }

            if (!db.objectStoreNames.contains('pendingAdminChanges')) {
                const store = db.createObjectStore('pendingAdminChanges', { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }

            if (!db.objectStoreNames.contains('offlineMatches')) {
                db.createObjectStore('offlineMatches', { keyPath: 'id' });
            }
        };
    });
}

// Push notifications for admin alerts
self.addEventListener('push', (event) => {
    console.log('[SW Admin] Push received');

    if (!event.data) {
        return;
    }

    let data;
    try {
        data = event.data.json();
    } catch (error) {
        console.error('[SW Admin] Error parsing push data:', error);
        return;
    }

    const title = data.title || 'Brixsport Admin';
    const options = {
        body: data.body || '',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-96x96.png',
        data: {
            url: data.url || '/admin',
            type: data.type,
        },
        tag: data.tag || 'admin-notification',
        requireInteraction: data.requireInteraction || false,
        vibrate: [200, 100, 200],
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[SW Admin] Notification clicked');
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/admin';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (self.clients.openWindow) {
                    return self.clients.openWindow(urlToOpen);
                }
            })
    );
});

// Message event
self.addEventListener('message', (event) => {
    console.log('[SW Admin] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data && event.data.type === 'CACHE_MATCH_DATA') {
        // Cache match data for offline logging
        cacheMatchData(event.data.match);
    }
});

// Cache match data for offline logging
async function cacheMatchData(match) {
    try {
        const db = await openDB();
        const tx = db.transaction('offlineMatches', 'readwrite');
        const store = tx.objectStore('offlineMatches');
        await store.put(match);
        console.log('[SW Admin] Match data cached for offline use:', match.id);
    } catch (error) {
        console.error('[SW Admin] Error caching match data:', error);
    }
}
