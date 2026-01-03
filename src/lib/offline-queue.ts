/**
 * Offline Queue Manager
 * Handles offline event storage and synchronization using IndexedDB
 */

'use client';

import { MatchEvent } from '@/db/schema';

export interface OfflineEvent {
    id: string;
    matchId: string;
    event: Partial<MatchEvent>;
    timestamp: number;
    synced: boolean;
    retryCount: number;
}

export class OfflineQueueManager {
    private dbName = 'brixsport-offline';
    private storeName = 'events';
    private db: IDBDatabase | null = null;

    /**
     * Initialize IndexedDB
     */
    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof window === 'undefined') {
                reject(new Error('IndexedDB not available in server environment'));
                return;
            }

            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('matchId', 'matchId', { unique: false });
                    store.createIndex('synced', 'synced', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    /**
     * Add event to offline queue
     */
    async addEvent(matchId: string, event: Partial<MatchEvent>): Promise<string> {
        if (!this.db) await this.init();

        const offlineEvent: OfflineEvent = {
            id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            matchId,
            event,
            timestamp: Date.now(),
            synced: false,
            retryCount: 0,
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(offlineEvent);

            request.onsuccess = () => resolve(offlineEvent.id);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all unsynced events
     */
    async getUnsyncedEvents(): Promise<OfflineEvent[]> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('synced');
            const request = index.getAll(IDBKeyRange.only(0)); // 0 for false in IndexedDB

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get unsynced events for a specific match
     */
    async getUnsyncedEventsByMatch(matchId: string): Promise<OfflineEvent[]> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('matchId');
            const request = index.getAll(matchId);

            request.onsuccess = () => {
                const events = request.result.filter(e => !e.synced);
                resolve(events);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Mark event as synced
     */
    async markAsSynced(eventId: string): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const getRequest = store.get(eventId);

            getRequest.onsuccess = () => {
                const event = getRequest.result;
                if (event) {
                    event.synced = true;
                    const updateRequest = store.put(event);
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve();
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Delete synced events (cleanup)
     */
    async deleteSyncedEvents(): Promise<number> {
        if (!this.db) await this.init();

        const syncedEvents = await this.getSyncedEvents();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            let deleted = 0;
            syncedEvents.forEach(event => {
                const request = store.delete(event.id);
                request.onsuccess = () => deleted++;
            });

            transaction.oncomplete = () => resolve(deleted);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Get all synced events
     */
    private async getSyncedEvents(): Promise<OfflineEvent[]> {
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('synced');
            const request = index.getAll(IDBKeyRange.only(1)); // 1 for true in IndexedDB

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Increment retry count for an event
     */
    async incrementRetryCount(eventId: string): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const getRequest = store.get(eventId);

            getRequest.onsuccess = () => {
                const event = getRequest.result;
                if (event) {
                    event.retryCount++;
                    const updateRequest = store.put(event);
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve();
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Delete event from queue
     */
    async deleteEvent(eventId: string): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(eventId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get queue statistics
     */
    async getQueueStats(): Promise<{
        total: number;
        unsynced: number;
        synced: number;
        oldestTimestamp: number | null;
    }> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const events = request.result;
                const unsynced = events.filter(e => !e.synced);
                const synced = events.filter(e => e.synced);

                const timestamps = events.map(e => e.timestamp);
                const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : null;

                resolve({
                    total: events.length,
                    unsynced: unsynced.length,
                    synced: synced.length,
                    oldestTimestamp,
                });
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all events from queue
     */
    async clearAll(): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

/**
 * Sync manager for handling offline queue synchronization
 */
export class SyncManager {
    private queueManager: OfflineQueueManager;
    private maxRetries = 3;
    private syncInProgress = false;

    constructor() {
        this.queueManager = new OfflineQueueManager();
    }

    /**
     * Initialize sync manager
     */
    async init(): Promise<void> {
        await this.queueManager.init();
    }

    /**
     * Sync all unsynced events
     */
    async syncAll(apiEndpoint: string = '/api/events/sync'): Promise<{
        success: number;
        failed: number;
        errors: Array<{ eventId: string; error: string }>;
    }> {
        if (this.syncInProgress) {
            throw new Error('Sync already in progress');
        }

        this.syncInProgress = true;

        try {
            const unsyncedEvents = await this.queueManager.getUnsyncedEvents();

            // Sort by timestamp (oldest first)
            unsyncedEvents.sort((a, b) => a.timestamp - b.timestamp);

            let success = 0;
            let failed = 0;
            const errors: Array<{ eventId: string; error: string }> = [];

            for (const offlineEvent of unsyncedEvents) {
                try {
                    // Skip if max retries exceeded
                    if (offlineEvent.retryCount >= this.maxRetries) {
                        failed++;
                        errors.push({
                            eventId: offlineEvent.id,
                            error: 'Max retries exceeded',
                        });
                        continue;
                    }

                    // Send to backend
                    const response = await fetch(apiEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            matchId: offlineEvent.matchId,
                            event: offlineEvent.event,
                            timestamp: offlineEvent.timestamp,
                        }),
                    });

                    if (response.ok) {
                        await this.queueManager.markAsSynced(offlineEvent.id);
                        success++;
                    } else {
                        await this.queueManager.incrementRetryCount(offlineEvent.id);
                        failed++;
                        errors.push({
                            eventId: offlineEvent.id,
                            error: `HTTP ${response.status}: ${response.statusText}`,
                        });
                    }
                } catch (error) {
                    await this.queueManager.incrementRetryCount(offlineEvent.id);
                    failed++;
                    errors.push({
                        eventId: offlineEvent.id,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }

            // Cleanup synced events
            await this.queueManager.deleteSyncedEvents();

            return { success, failed, errors };
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Check if sync is needed
     */
    async needsSync(): Promise<boolean> {
        const stats = await this.queueManager.getQueueStats();
        return stats.unsynced > 0;
    }

    /**
     * Get sync status
     */
    getSyncStatus(): boolean {
        return this.syncInProgress;
    }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(): SyncManager {
    if (!syncManagerInstance) {
        syncManagerInstance = new SyncManager();
    }
    return syncManagerInstance;
}
