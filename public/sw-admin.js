/**
 * Admin & Logger PWA Service Worker
 * Handles caching, offline support, and real-time sync for admin and logger
 */

const CACHE_VERSION = 'brixsport-admin-v2';
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

    // HTML documents: always network-first, never cache
    // Stale HTML after a deploy causes missing JS chunk errors (BUG-026)
    if (request.destination === 'document') {
        event.respondWith(
            fetch(request).catch(() => caches.match('/offline'))
        );
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
        const pendingEvents = await idbGetAll(db, 'pendingMatchEvents');

        for (const event of pendingEvents) {
            // token is stored at queue-write time by FootballLogger (BACKLOG-058).
            // SW background sync fires outside any browser session — no cookie available.
            if (!event.token) {
                // No token means the write side (BACKLOG-058) hasn't stored one yet.
                // Skip rather than POST — a tokenless request will 401, throw, and
                // trigger an infinite retry storm for every event in the queue.
                console.warn('[SW Admin] Skipping event', event.id, '— no token stored, will retry on next sync');
                continue;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${event.token}`,
            };

            const response = await fetch(`/api/matches/${event.matchId}/events`, {
                method: 'POST',
                headers,
                body: JSON.stringify(event.data),
            });

            if (response.ok) {
                await idbDelete(db, 'pendingMatchEvents', event.id);
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

// Sync admin changes -- this store/drain existed but nothing ever wrote to it
// (confirmed: zero references anywhere in src/ before BUG-142's period-transition/
// undo scope). Fixed a real bug found while activating it: no Authorization header
// was ever sent, same class of gap BACKLOG-058 fixed for pendingMatchEvents --
// a background sync fires with no browser session/cookie, so every retry would
// have 401'd. token is now required at queue-write time, same convention as
// pendingMatchEvents.
async function syncAdminChanges() {
    try {
        const db = await openDB();
        const pendingChanges = await idbGetAll(db, 'pendingAdminChanges');

        for (const change of pendingChanges) {
            if (!change.token) {
                console.warn('[SW Admin] Skipping admin change', change.id, '— no token stored, will retry on next sync');
                continue;
            }

            const response = await fetch(change.url, {
                method: change.method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${change.token}`,
                },
                body: JSON.stringify(change.data),
            });

            if (response.ok) {
                await idbDelete(db, 'pendingAdminChanges', change.id);
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

// Raw IDB helpers — IDBDatabase has no .getAll()/.delete(); must go through a transaction → objectStore
function idbGetAll(db, storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function idbDelete(db, storeName, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
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
                // Row shape: { id (auto), matchId, data (event payload), token (JWT — stored at write time), timestamp }
                // token is required for Authorization header in syncMatchEvents() — see BACKLOG-058 for write-side wiring
                const store = db.createObjectStore('pendingMatchEvents', { keyPath: 'id', autoIncrement: true });
                store.createIndex('matchId', 'matchId', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }

            if (!db.objectStoreNames.contains('pendingAdminChanges')) {
                // Row shape: { id (auto), url, method, data, token (JWT — required, see syncAdminChanges), timestamp }
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
    } else if (event.data && event.data.type === 'DRAIN_MATCH_EVENTS') {
        // iOS fallback — Background Sync API is not supported on iOS.
        // FootballLogger posts this message on 'online' and 'visibilitychange'
        // so the SW drains the queue directly from the page context (BACKLOG-107).
        event.waitUntil(syncMatchEvents());
    } else if (event.data && event.data.type === 'DRAIN_ADMIN_CHANGES') {
        // Same iOS fallback as DRAIN_MATCH_EVENTS above, for the pendingAdminChanges
        // queue (period-transition PATCH / undo DELETE retries, BUG-142).
        event.waitUntil(syncAdminChanges());
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
