/**
 * Offline Queue Manager using IndexedDB
 * Handles offline event storage and synchronization
 */

'use client';

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { MatchEvent } from '@/db/schema';

interface BrixsportDB extends DBSchema {
    eventQueue: {
        key: string;
        value: QueuedEvent;
        indexes: { 'by-match': string; 'by-timestamp': number };
    };
    syncStatus: {
        key: string;
        value: SyncStatusRecord;
    };
}

export interface QueuedEvent {
    id: string;
    matchId: string;
    event: Partial<MatchEvent>;
    timestamp: number;
    retryCount: number;
    status: 'pending' | 'syncing' | 'failed' | 'synced';
    error?: string;
}

export interface SyncStatusRecord {
    matchId: string;
    lastSyncTime: number;
    pendingCount: number;
    failedCount: number;
}

export interface QueueStats {
    total: number;
    pending: number;
    syncing: number;
    failed: number;
    synced: number;
}

class OfflineQueueManager {
    private db: IDBPDatabase<BrixsportDB> | null = null;
    private readonly DB_NAME = 'brixsport-offline';
    private readonly DB_VERSION = 1;
    private readonly MAX_RETRY_COUNT = 3;

    /**
     * Initialize IndexedDB
     */
    async init(): Promise<void> {
        if (this.db) return;

        try {
            this.db = await openDB<BrixsportDB>(this.DB_NAME, this.DB_VERSION, {
                upgrade(db) {
                    // Create event queue store
                    if (!db.objectStoreNames.contains('eventQueue')) {
                        const eventStore = db.createObjectStore('eventQueue', {
                            keyPath: 'id',
                        });
                        eventStore.createIndex('by-match', 'matchId');
                        eventStore.createIndex('by-timestamp', 'timestamp');
                    }

                    // Create sync status store
                    if (!db.objectStoreNames.contains('syncStatus')) {
                        db.createObjectStore('syncStatus', {
                            keyPath: 'matchId',
                        });
                    }
                },
            });

            console.log('[OfflineQueue] IndexedDB initialized');
        } catch (error) {
            console.error('[OfflineQueue] Failed to initialize IndexedDB:', error);
            throw error;
        }
    }

    /**
     * Add event to queue
     */
    async addEvent(matchId: string, event: Partial<MatchEvent>): Promise<string> {
        if (!this.db) await this.init();

        const queuedEvent: QueuedEvent = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            matchId,
            event,
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending',
        };

        try {
            await this.db!.add('eventQueue', queuedEvent);
            await this.updateSyncStatus(matchId);
            console.log('[OfflineQueue] Event added to queue:', queuedEvent.id);
            return queuedEvent.id;
        } catch (error) {
            console.error('[OfflineQueue] Failed to add event:', error);
            throw error;
        }
    }

    /**
     * Get all pending events for a match
     */
    async getPendingEvents(matchId: string): Promise<QueuedEvent[]> {
        if (!this.db) await this.init();

        try {
            const index = this.db!.transaction('eventQueue').store.index('by-match');
            const allEvents = await index.getAll(matchId);
            return allEvents.filter((e) => e.status === 'pending');
        } catch (error) {
            console.error('[OfflineQueue] Failed to get pending events:', error);
            return [];
        }
    }

    /**
     * Get all events (for debugging)
     */
    async getAllEvents(): Promise<QueuedEvent[]> {
        if (!this.db) await this.init();

        try {
            return await this.db!.getAll('eventQueue');
        } catch (error) {
            console.error('[OfflineQueue] Failed to get all events:', error);
            return [];
        }
    }

    /**
     * Update event status
     */
    async updateEventStatus(
        eventId: string,
        status: QueuedEvent['status'],
        error?: string
    ): Promise<void> {
        if (!this.db) await this.init();

        try {
            const event = await this.db!.get('eventQueue', eventId);
            if (!event) {
                console.warn('[OfflineQueue] Event not found:', eventId);
                return;
            }

            event.status = status;
            if (error) event.error = error;
            if (status === 'failed') event.retryCount++;

            await this.db!.put('eventQueue', event);
            await this.updateSyncStatus(event.matchId);
        } catch (error) {
            console.error('[OfflineQueue] Failed to update event status:', error);
        }
    }

    /**
     * Remove event from queue
     */
    async removeEvent(eventId: string): Promise<void> {
        if (!this.db) await this.init();

        try {
            const event = await this.db!.get('eventQueue', eventId);
            if (event) {
                await this.db!.delete('eventQueue', eventId);
                await this.updateSyncStatus(event.matchId);
                console.log('[OfflineQueue] Event removed:', eventId);
            }
        } catch (error) {
            console.error('[OfflineQueue] Failed to remove event:', error);
        }
    }

    /**
     * Clear all synced events
     */
    async clearSyncedEvents(): Promise<number> {
        if (!this.db) await this.init();

        try {
            const allEvents = await this.db!.getAll('eventQueue');
            const syncedEvents = allEvents.filter((e) => e.status === 'synced');

            for (const event of syncedEvents) {
                await this.db!.delete('eventQueue', event.id);
            }

            console.log('[OfflineQueue] Cleared synced events:', syncedEvents.length);
            return syncedEvents.length;
        } catch (error) {
            console.error('[OfflineQueue] Failed to clear synced events:', error);
            return 0;
        }
    }

    /**
     * Get queue statistics
     */
    async getQueueStats(): Promise<QueueStats> {
        if (!this.db) await this.init();

        try {
            const allEvents = await this.db!.getAll('eventQueue');

            return {
                total: allEvents.length,
                pending: allEvents.filter((e) => e.status === 'pending').length,
                syncing: allEvents.filter((e) => e.status === 'syncing').length,
                failed: allEvents.filter((e) => e.status === 'failed').length,
                synced: allEvents.filter((e) => e.status === 'synced').length,
            };
        } catch (error) {
            console.error('[OfflineQueue] Failed to get queue stats:', error);
            return { total: 0, pending: 0, syncing: 0, failed: 0, synced: 0 };
        }
    }

    /**
     * Update sync status for a match
     */
    private async updateSyncStatus(matchId: string): Promise<void> {
        if (!this.db) return;

        try {
            const events = await this.getPendingEvents(matchId);
            const allMatchEvents = await this.db!.transaction('eventQueue').store.index('by-match').getAll(matchId);

            const status: SyncStatusRecord = {
                matchId,
                lastSyncTime: Date.now(),
                pendingCount: events.length,
                failedCount: allMatchEvents.filter((e) => e.status === 'failed').length,
            };

            await this.db!.put('syncStatus', status);
        } catch (error) {
            console.error('[OfflineQueue] Failed to update sync status:', error);
        }
    }

    /**
     * Get sync status for a match
     */
    async getSyncStatus(matchId: string): Promise<SyncStatusRecord | null> {
        if (!this.db) await this.init();

        try {
            return (await this.db!.get('syncStatus', matchId)) || null;
        } catch (error) {
            console.error('[OfflineQueue] Failed to get sync status:', error);
            return null;
        }
    }

    /**
     * Retry failed events
     */
    async retryFailedEvents(matchId?: string): Promise<number> {
        if (!this.db) await this.init();

        try {
            const allEvents = await this.db!.getAll('eventQueue');
            let failedEvents = allEvents.filter(
                (e) => e.status === 'failed' && e.retryCount < this.MAX_RETRY_COUNT
            );

            if (matchId) {
                failedEvents = failedEvents.filter((e) => e.matchId === matchId);
            }

            for (const event of failedEvents) {
                event.status = 'pending';
                await this.db!.put('eventQueue', event);
            }

            console.log('[OfflineQueue] Retrying failed events:', failedEvents.length);
            return failedEvents.length;
        } catch (error) {
            console.error('[OfflineQueue] Failed to retry events:', error);
            return 0;
        }
    }

    /**
     * Clear all data (use with caution)
     */
    async clearAll(): Promise<void> {
        if (!this.db) await this.init();

        try {
            await this.db!.clear('eventQueue');
            await this.db!.clear('syncStatus');
            console.log('[OfflineQueue] All data cleared');
        } catch (error) {
            console.error('[OfflineQueue] Failed to clear all data:', error);
        }
    }
}

// Singleton instance
let queueManager: OfflineQueueManager | null = null;

export function getQueueManager(): OfflineQueueManager {
    if (!queueManager) {
        queueManager = new OfflineQueueManager();
    }
    return queueManager;
}

export { OfflineQueueManager };
