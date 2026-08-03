// Shared offline-queue helpers for logger event writes -- read by sw-admin.js's
// syncMatchEvents(), written by FootballLogger.tsx/BasketballLogger.tsx.
//
// Extracted from FootballLogger.tsx (BACKLOG-058) rather than left inline so
// BasketballLogger.tsx (BUG-142) doesn't become a third ad-hoc copy of this same
// contract -- this project's own audits have repeatedly flagged "N parallel
// implementations of the same thing" as a maintenance trap (BACKLOG-153's three
// dead offline-queue implementations, two RatingCalculator classes, four
// match-status-styling implementations). The DB name, store name, and row shape
// here are a real cross-file contract: sw-admin.js's schema and read logic must
// stay in exact sync with whatever writes here, in both loggers.
//
// FootballLogger.tsx still has its own inline copy, intentionally untouched --
// it's proven, live-tested code (BACKLOG-058's Live Test 3 evidence). Migrating
// it to import from here instead is safe follow-up work, not done in this pass.

const REQUIRED_STORES = ['pendingMatchEvents', 'pendingAdminChanges'];

function createStores(db: IDBDatabase) {
    // Mirror sw-admin.js schema so both sides agree on store shape -- whichever
    // side (this module or the SW) opens the DB first is the one that actually
    // runs this, so both must create the same stores.
    if (!db.objectStoreNames.contains('pendingMatchEvents')) {
        const store = db.createObjectStore('pendingMatchEvents', { keyPath: 'id', autoIncrement: true });
        store.createIndex('matchId', 'matchId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
    }
    if (!db.objectStoreNames.contains('pendingAdminChanges')) {
        const store = db.createObjectStore('pendingAdminChanges', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
    }
}

export function openAdminDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('BrixsportAdminDB', 1);
        req.onerror = () => reject(req.error);
        req.onupgradeneeded = (e) => createStores((e.target as IDBOpenDBRequest).result);
        req.onsuccess = () => {
            const db = req.result as IDBDatabase;
            const missingStores = REQUIRED_STORES.some((s) => !db.objectStoreNames.contains(s));
            if (!missingStores) {
                resolve(db);
                return;
            }
            // BUG-193: if anything else (a stray script, a stale SW version from
            // before these stores existed) ever opened 'BrixsportAdminDB' at
            // version 1 without defining the schema, it stays permanently
            // stamped at v1 with no stores -- onupgradeneeded never fires again
            // for the same version, so every future write throws NotFoundError
            // forever, with the queue silently unable to save anything. Recover
            // by deleting and recreating the DB from scratch; any rows in a
            // broken DB are unreachable anyway, since reading them would hit the
            // same NotFoundError.
            console.warn('[admin-offline-queue] BrixsportAdminDB missing expected stores, recreating');
            db.close();
            const delReq = indexedDB.deleteDatabase('BrixsportAdminDB');
            delReq.onerror = () => reject(delReq.error);
            delReq.onblocked = () => reject(new Error('BrixsportAdminDB recovery blocked — close other tabs and retry'));
            delReq.onsuccess = () => {
                const reopenReq = indexedDB.open('BrixsportAdminDB', 1);
                reopenReq.onerror = () => reject(reopenReq.error);
                reopenReq.onupgradeneeded = (e) => createStores((e.target as IDBOpenDBRequest).result);
                reopenReq.onsuccess = () => resolve(reopenReq.result as IDBDatabase);
            };
        };
    });
}

export async function queueOfflineEvent(matchId: string, data: object, token: string): Promise<void> {
    const db = await openAdminDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pendingMatchEvents', 'readwrite');
        const store = tx.objectStore('pendingMatchEvents');
        // Row shape must match what syncMatchEvents() in sw-admin.js reads back:
        // { matchId, data, token, timestamp }
        const req = store.add({ matchId, data, token, timestamp: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// BUG-142 (period-transition PATCH / undo DELETE queueing): a generic queue for
// any authenticated write that isn't an event POST. sw-admin.js's syncAdminChanges()
// already existed to drain this store but nothing ever wrote to it -- confirmed
// zero references anywhere in src/ before this. Fixed a real bug found while
// activating it: syncAdminChanges() never sent an Authorization header at all, so
// every retry would have 401'd -- token is now required at queue-write time, same
// convention queueOfflineEvent already uses.
export async function queueAdminChange(url: string, method: 'PATCH' | 'DELETE', data: object, token: string): Promise<void> {
    const db = await openAdminDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pendingAdminChanges', 'readwrite');
        const store = tx.objectStore('pendingAdminChanges');
        const req = store.add({ url, method, data, token, timestamp: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Returns remaining token lifetime in seconds, or 0 if unreadable / already expired.
// JWT TTL is 7 days (src/lib/auth.ts). Threshold for queueing: 30 min (1800s).
export function jwtSecondsRemaining(token: string): number {
    try {
        const payloadB64 = token.split('.')[1];
        if (!payloadB64) return 0;
        const decoded = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
        if (typeof decoded.exp !== 'number') return 0;
        return decoded.exp - Math.floor(Date.now() / 1000);
    } catch {
        return 0;
    }
}
