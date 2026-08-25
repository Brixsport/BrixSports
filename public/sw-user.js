/**
 * User PWA Service Worker
 * Handles caching, offline support, and push notifications for users
 */

// BUG-244: CACHE_VERSION is stamped with the Vercel commit SHA by
// scripts/inject-sw-cache-version.mjs (see package.json "build") so every
// deploy is a genuinely different SW script and precache can't go stale
// again from a forgotten manual bump. This literal is the local-dev
// fallback value only -- production always overwrites it at build time.
const CACHE_VERSION = 'brixsport-user-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/live',
    '/news',
    '/offline',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
];

// Maximum cache sizes
const MAX_DYNAMIC_CACHE_SIZE = 50;
const MAX_IMAGE_CACHE_SIZE = 60;
const MAX_API_CACHE_SIZE = 30;

// Cache size limiter
const limitCacheSize = async (cacheName, maxSize) => {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxSize) {
        await cache.delete(keys[0]);
        await limitCacheSize(cacheName, maxSize);
    }
};

// BACKLOG-060: per-route API caching strategy. The fetch handler used to treat
// every /api/* GET identically (network-first, cache-fallback, no staleness
// check) -- fine for near-static data, actively wrong for a live match's
// events/config, and wasteful for auth checks that must never read stale.
const NEVER_CACHE_API_PATTERNS = [
    /^\/api\/matches\/[^/]+\/events(\/|$|\?)/,
    /^\/api\/matches\/[^/]+\/config(\/|$|\?)/,
    /^\/api\/auth\//,
];
const SHORT_TTL_API_PATTERNS = [
    /^\/api\/matches(\/|$|\?)/,
    // Live-verified gap: the homepage's actual live-match list calls these
    // sport-specific list endpoints (src/app/page.tsx), not a bare
    // /api/matches -- confirmed via a real Cache Storage read that they were
    // falling through to the generic bucket (no 30s staleness check) instead.
    /^\/api\/(basketball|football|other)\/matches(\/|$|\?)/,
    /^\/api\/competitions(\/|$|\?)/,
];
const STALE_WHILE_REVALIDATE_API_PATTERNS = [
    /^\/api\/players(\/|$|\?)/,
    /^\/api\/teams(\/|$|\?)/,
];
const SHORT_API_TTL_MS = 30 * 1000;

const isNeverCacheApi = (pathname) => NEVER_CACHE_API_PATTERNS.some((re) => re.test(pathname));
// Order matters: check NEVER_CACHE_API_PATTERNS first at the call site --
// `/api/matches/[id]/events`/`/config` also match the broader
// `/api/matches` short-TTL pattern below, and must be excluded from it.
const isShortTtlApi = (pathname) => SHORT_TTL_API_PATTERNS.some((re) => re.test(pathname));
const isStaleWhileRevalidateApi = (pathname) => STALE_WHILE_REVALIDATE_API_PATTERNS.some((re) => re.test(pathname));

// A cached Response's own `Date` header (set by the original fetch, not by
// this SW) is used as its staleness clock -- avoids needing a separate
// timestamp metadata store just to answer "how old is this."
const isFreshEnough = (cachedResponse, maxAgeMs) => {
    if (!cachedResponse) return false;
    const dateHeader = cachedResponse.headers.get('date');
    if (!dateHeader) return false;
    return (Date.now() - new Date(dateHeader).getTime()) <= maxAgeMs;
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW User] Installing Service Worker');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW User] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW User] Activating Service Worker');
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys
                        .filter((key) => key.startsWith('brixsport-user-') && key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== IMAGE_CACHE && key !== API_CACHE)
                        .map((key) => caches.delete(key))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip unsupported URL schemes (chrome-extension, etc.)
    if (!url.protocol.startsWith('http')) {
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

    // API requests - per-route TTL strategy (BACKLOG-060). Volatile live-match
    // data was previously cached identically to near-static data (teams,
    // players), and a stale cache read on a match's live events/config could
    // show a logger or viewer minutes-old state with no way to tell.
    if (url.pathname.startsWith('/api/')) {
        // Never cache: always hit the network, no fallback read from cache.
        // A stale read here is actively wrong, not just outdated -- auth state
        // and a match's live config must reflect the current request, not a
        // cached one, and event data is handled by its own dedicated logger
        // offline-queue path (BUG-142/BUG-193), not this generic API cache.
        if (isNeverCacheApi(url.pathname)) {
            event.respondWith(fetch(request));
            return;
        }

        // Stale-while-revalidate: near-static reference data (teams, players).
        // Serve the cached copy instantly if present, refresh it in the
        // background for next time; only hit the network directly on a cold
        // cache.
        if (isStaleWhileRevalidateApi(url.pathname)) {
            event.respondWith(
                caches.open(API_CACHE).then(async (cache) => {
                    const cached = await cache.match(request);
                    const networkFetch = fetch(request).then((response) => {
                        if (response.status === 200) {
                            cache.put(request, response.clone());
                            limitCacheSize(API_CACHE, MAX_API_CACHE_SIZE);
                        }
                        return response;
                    });
                    if (cached) {
                        event.waitUntil(networkFetch.catch(() => {}));
                        return cached;
                    }
                    return networkFetch.catch(() => cached);
                })
            );
            return;
        }

        // Short-TTL network-first (matches, competitions): prefer a live
        // network read; on failure, only serve a cached response if it's
        // still within SHORT_API_TTL_MS -- otherwise this is genuinely wrong
        // data for a livescore page, not just "a bit old."
        if (isShortTtlApi(url.pathname)) {
            event.respondWith(
                fetch(request)
                    .then((response) => {
                        const responseClone = response.clone();
                        if (response.status === 200) {
                            caches.open(API_CACHE).then((cache) => {
                                cache.put(request, responseClone);
                                limitCacheSize(API_CACHE, MAX_API_CACHE_SIZE);
                            });
                        }
                        return response;
                    })
                    .catch(async () => {
                        const cached = await caches.match(request);
                        return isFreshEnough(cached, SHORT_API_TTL_MS) ? cached : undefined;
                    })
            );
            return;
        }

        // Everything else under /api/ -- unchanged prior behavior (network
        // first, cache fallback with no staleness check).
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseClone = response.clone();
                    if (response.status === 200) {
                        caches.open(API_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                            limitCacheSize(API_CACHE, MAX_API_CACHE_SIZE);
                        });
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Cloudinary-hosted images are served from Cloudinary's own CDN with its
    // own caching/optimization -- intercepting them through the SW only wastes
    // Cache Storage quota and adds a redundant caching layer on top of one
    // that already exists. Let the browser handle these requests natively.
    if (url.hostname.endsWith('res.cloudinary.com')) {
        return;
    }

    // Image requests - Cache first, network fallback
    if (request.destination === 'image') {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    return fetch(request).then((response) => {
                        const responseClone = response.clone();
                        caches.open(IMAGE_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                            limitCacheSize(IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE);
                        });
                        return response;
                    });
                })
        );
        return;
    }

    // Static assets - Cache first, network fallback
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    return cachedResponse || fetch(request);
                })
        );
        return;
    }

    // All other requests - Network first, cache fallback
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

// Push notification event
self.addEventListener('push', (event) => {
    console.log('[SW User] Push received:', event);
    console.log('[SW User] Page visibility:', self.clients && self.clients.matchAll ? 'clients available' : 'no clients');
    console.log('[SW User] Push data raw:', event.data ? event.data.text() : 'no data');

    if (!event.data) {
        console.log('[SW User] No data in push event');
        // Show default notification
        event.waitUntil(
            self.registration.showNotification('Brixsport', {
                body: 'New update available',
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                tag: 'brixsport-default',
            })
        );
        return;
    }

    let data;
    try {
        data = event.data.json();
        console.log('[SW User] Push data parsed:', data);
    } catch (error) {
        console.error('[SW User] Error parsing push data:', error);
        return;
    }

    const title = data.title || 'Brixsport';
    const options = {
        body: data.body || '',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/icon-192x192.png',
        image: data.image,
        data: {
            url: data.data?.url || data.url || '/',
            matchId: data.data?.matchId || data.matchId,
            type: data.data?.type || data.type,
            eventType: data.data?.eventType || data.eventType,
        },
        tag: data.tag || 'brixsport-notification',
        requireInteraction: data.requireInteraction || false,
        vibrate: data.vibrate || [200, 100, 200],
        actions: data.actions || [],
        silent: false, // Ensure notification makes sound on mobile
    };

    console.log('[SW User] Showing notification:', { title, options });

    // Customize notification based on event type (check both type and eventType)
    const eventType = data.eventType || data.type;
    if (eventType === 'GOAL') {
        options.vibrate = [300, 100, 300, 100, 300];
        options.requireInteraction = true;
        options.actions = [
            { action: 'view', title: 'View Match' },
            { action: 'close', title: 'Close' },
        ];
    } else if (eventType === 'MATCH_START') {
        options.actions = [
            { action: 'view', title: 'Watch Live' },
            { action: 'close', title: 'Dismiss' },
        ];
    } else if (eventType === 'RED_CARD') {
        options.vibrate = [500, 200, 500];
        options.requireInteraction = true;
    }

    event.waitUntil(
        self.registration.showNotification(title, options)
            .then(() => {
                console.log('[SW User] Notification shown successfully');
            })
            .catch((error) => {
                console.error('[SW User] Error showing notification:', error);
            })
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('[SW User] Notification clicked');

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
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
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

// Background sync event
self.addEventListener('sync', (event) => {
    console.log('[SW User] Background sync:', event.tag);

    if (event.tag === 'sync-favorites') {
        event.waitUntil(syncFavorites());
    } else if (event.tag === 'sync-profile') {
        event.waitUntil(syncProfile());
    }
});

// Sync favorites
async function syncFavorites() {
    try {
        // Get pending favorites from IndexedDB
        const db = await openDB();
        const pendingFavorites = await db.getAll('pendingFavorites');

        for (const favorite of pendingFavorites) {
            await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(favorite),
            });
            await db.delete('pendingFavorites', favorite.id);
        }

        console.log('[SW User] Favorites synced');
    } catch (error) {
        console.error('[SW User] Error syncing favorites:', error);
    }
}

// Sync profile
async function syncProfile() {
    try {
        const db = await openDB();
        const pendingProfile = await db.get('pendingProfile', 'profile');

        if (pendingProfile) {
            await fetch('/api/users/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pendingProfile),
            });
            await db.delete('pendingProfile', 'profile');
        }

        console.log('[SW User] Profile synced');
    } catch (error) {
        console.error('[SW User] Error syncing profile:', error);
    }
}

// Open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BrixsportDB', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pendingFavorites')) {
                db.createObjectStore('pendingFavorites', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('pendingProfile')) {
                db.createObjectStore('pendingProfile');
            }
        };
    });
}

// Message event
self.addEventListener('message', (event) => {
    console.log('[SW User] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    // Handle test push message
    if (event.data && event.data.type === 'TEST_PUSH') {
        console.log('[SW User] Test push message received:', event.data.data);
        
        // Show a test notification immediately
        const title = event.data.data.title || 'Test Notification';
        const options = {
            body: event.data.data.body || 'This is a test notification',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            tag: 'test-notification',
        };
        
        self.registration.showNotification(title, options)
            .then(() => {
                console.log('[SW User] Test notification shown successfully');
            })
            .catch((error) => {
                console.error('[SW User] Error showing test notification:', error);
            });
    }
});
