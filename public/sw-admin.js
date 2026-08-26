/**
 * Admin & Logger PWA Service Worker
 * Handles caching, offline support, and real-time sync for admin and logger
 */

// BUG-244: CACHE_VERSION is stamped at build time -- see sw-user.js's comment
// and scripts/inject-sw-cache-version.mjs. This literal is the local-dev fallback.
const CACHE_VERSION = 'brixsport-admin-v3';
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

// BACKLOG-060: per-route API caching strategy, mirroring sw-user.js exactly
// (both files must agree -- see the DB-schema-drift lesson from BUG-193's own
// follow-up fix this session). Every /api/* GET used to be treated
// identically here too -- worse for admin/logger, since a stale read on a
// match's live config or events is actively wrong, not just outdated.
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
];
// BACKLOG-226 (session 55): kept in sync with sw-user.js's identical move --
// /api/competitions is near-static (name/logo/settings), not live-scoring
// data, so it belongs under the SWR policy, not the 30s live-data TTL.
const STALE_WHILE_REVALIDATE_API_PATTERNS = [
    /^\/api\/players(\/|$|\?)/,
    /^\/api\/teams(\/|$|\?)/,
    /^\/api\/competitions(\/|$|\?)/,
    // Session 56, Richard's call: standings recompute on every match FINISH
    // (BACKLOG-097), so like players/teams this is "changes occasionally, not
    // every second" -- not Tier 0 live-score data, which stays on the 30s TTL.
    /^\/api\/(football\/|basketball\/)?standings(\/|$|\?)/,
];
const SHORT_API_TTL_MS = 30 * 1000;

const isNeverCacheApi = (pathname) => NEVER_CACHE_API_PATTERNS.some((re) => re.test(pathname));
// Order matters: check NEVER_CACHE_API_PATTERNS first at the call site --
// `/api/matches/[id]/events`/`/config` also match the broader
// `/api/matches` short-TTL pattern below, and must be excluded from it.
const isShortTtlApi = (pathname) => SHORT_TTL_API_PATTERNS.some((re) => re.test(pathname));
const isStaleWhileRevalidateApi = (pathname) => STALE_WHILE_REVALIDATE_API_PATTERNS.some((re) => re.test(pathname));

const isFreshEnough = (cachedResponse, maxAgeMs) => {
    if (!cachedResponse) return false;
    const dateHeader = cachedResponse.headers.get('date');
    if (!dateHeader) return false;
    return (Date.now() - new Date(dateHeader).getTime()) <= maxAgeMs;
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

    // HTML documents: network-first, cache the response for this specific
    // page so a previously-visited admin/logger page (dashboard shell, logger
    // entry/assignment list, read-only lists) is still reachable offline
    // (BACKLOG-226) -- mirrors sw-user.js's identical fix. Only falls back to
    // the generic /offline document when this exact URL was never visited.
    // Safe post-BUG-244: CACHE_VERSION is build-id-scoped, so a stale
    // document from a prior deploy can't survive into the current deploy's
    // cache namespace -- the whole cache is wiped on activate.
    //
    // Cache write wrapped in event.waitUntil() -- confirmed live against a
    // real staging deploy (session 55) that without it, the write silently
    // never happens (SW can be suspended right after respondWith() resolves,
    // racing the un-awaited cache.put()). Same class as this project's own
    // BUG-119.
    if (request.destination === 'document') {
        const fetchPromise = fetch(request).then((response) => {
            if (response.status === 200) {
                const responseClone = response.clone();
                event.waitUntil(
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                        return limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
                    })
                );
            }
            return response;
        });
        event.respondWith(
            fetchPromise.catch(async () => {
                const cached = await caches.match(request);
                return cached || caches.match('/offline');
            })
        );
        return;
    }

    // API requests - per-route TTL strategy (BACKLOG-060), same rules as
    // sw-user.js.
    if (url.pathname.startsWith('/api/')) {
        const offlineJsonResponse = () => new Response(
            JSON.stringify({ error: 'Offline', offline: true }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );

        // Never cache: auth checks and a match's live events/config must
        // always reflect the current request, never a cached one.
        if (isNeverCacheApi(url.pathname)) {
            event.respondWith(fetch(request));
            return;
        }

        // Stale-while-revalidate: near-static reference data (teams, players).
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
                    return networkFetch.catch(offlineJsonResponse);
                })
            );
            return;
        }

        // Short-TTL network-first (live match/score data only -- competitions
        // moved to SWR above, session 55): only serve a cached response on
        // network failure if it's still within SHORT_API_TTL_MS.
        if (isShortTtlApi(url.pathname)) {
            event.respondWith(
                fetch(request)
                    .then((response) => {
                        if (response.status === 200) {
                            const responseClone = response.clone();
                            event.waitUntil(
                                caches.open(API_CACHE).then((cache) => {
                                    cache.put(request, responseClone);
                                    return limitCacheSize(API_CACHE, MAX_API_CACHE_SIZE);
                                })
                            );
                        }
                        return response;
                    })
                    .catch(async () => {
                        const cached = await caches.match(request);
                        return isFreshEnough(cached, SHORT_API_TTL_MS) ? cached : offlineJsonResponse();
                    })
            );
            return;
        }

        // Everything else under /api/ -- unchanged prior behavior.
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        event.waitUntil(
                            caches.open(API_CACHE).then((cache) => {
                                cache.put(request, responseClone);
                                return limitCacheSize(API_CACHE, MAX_API_CACHE_SIZE);
                            })
                        );
                    }
                    return response;
                })
                .catch(() => caches.match(request).then((cachedResponse) => cachedResponse || offlineJsonResponse()))
        );
        return;
    }

    // Cloudinary-hosted images are served from Cloudinary's own CDN with its
    // own caching/optimization -- intercepting them through the SW only
    // wastes Cache Storage quota. Let the browser handle these natively.
    if (url.hostname.endsWith('res.cloudinary.com')) {
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
                event.waitUntil(
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                        return limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
                    })
                );
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

const ADMIN_DB_REQUIRED_STORES = ['pendingMatchEvents', 'pendingAdminChanges', 'offlineMatches'];

function createAdminDBStores(db) {
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
}

// Open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BrixsportAdminDB', 1);

        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (event) => createAdminDBStores(event.target.result);
        request.onsuccess = () => {
            const db = request.result;
            const missingStores = ADMIN_DB_REQUIRED_STORES.some((s) => !db.objectStoreNames.contains(s));
            if (!missingStores) {
                resolve(db);
                return;
            }
            // BUG-193: if the DB was ever stamped at version 1 without these stores
            // (e.g. by src/lib/admin-offline-queue.ts's own openAdminDB() before its
            // matching fix, or any other stray opener), onupgradeneeded never fires
            // again for the same version -- every queued write/read then throws
            // NotFoundError forever. Recover by deleting and recreating; a DB
            // missing its stores has no readable rows to lose.
            console.warn('[SW Admin] BrixsportAdminDB missing expected stores, recreating');
            db.close();
            const delReq = indexedDB.deleteDatabase('BrixsportAdminDB');
            delReq.onerror = () => reject(delReq.error);
            delReq.onblocked = () => reject(new Error('BrixsportAdminDB recovery blocked'));
            delReq.onsuccess = () => {
                const reopenReq = indexedDB.open('BrixsportAdminDB', 1);
                reopenReq.onerror = () => reject(reopenReq.error);
                reopenReq.onupgradeneeded = (event) => createAdminDBStores(event.target.result);
                reopenReq.onsuccess = () => resolve(reopenReq.result);
            };
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
