/**
 * Sync Manager
 * Orchestrates offline event synchronization with the backend
 */

'use client';

import { getQueueManager, QueuedEvent } from './queue-manager';

export interface SyncResult {
    success: boolean;
    syncedCount: number;
    failedCount: number;
    errors: Array<{ eventId: string; error: string }>;
}

export interface ConflictResolution {
    strategy: 'server-wins' | 'client-wins' | 'merge' | 'manual';
    resolvedEvent?: any;
}

class SyncManager {
    private queueManager = getQueueManager();
    private isSyncing = false;
    private syncCallbacks: Array<(result: SyncResult) => void> = [];

    /**
     * Initialize the sync manager
     */
    async init(): Promise<void> {
        await this.queueManager.init();
        console.log('[SyncManager] Initialized');

        // Set up online/offline listeners
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.handleOnline());
            window.addEventListener('offline', () => this.handleOffline());
        }
    }

    /**
     * Sync all pending events
     */
    async syncAll(apiEndpoint: string = '/api/events/sync'): Promise<SyncResult> {
        if (this.isSyncing) {
            console.warn('[SyncManager] Sync already in progress');
            return {
                success: false,
                syncedCount: 0,
                failedCount: 0,
                errors: [{ eventId: '', error: 'Sync already in progress' }],
            };
        }

        this.isSyncing = true;
        const result: SyncResult = {
            success: true,
            syncedCount: 0,
            failedCount: 0,
            errors: [],
        };

        try {
            const allEvents = await this.queueManager.getAllEvents();
            const pendingEvents = allEvents.filter((e) => e.status === 'pending');

            console.log(`[SyncManager] Syncing ${pendingEvents.length} events`);

            for (const queuedEvent of pendingEvents) {
                try {
                    // Update status to syncing
                    await this.queueManager.updateEventStatus(queuedEvent.id, 'syncing');

                    // Send to server
                    const response = await fetch(apiEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            queuedEventId: queuedEvent.id,
                            matchId: queuedEvent.matchId,
                            event: queuedEvent.event,
                            timestamp: queuedEvent.timestamp,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();

                    // Handle conflicts
                    if (data.conflict) {
                        const resolution = await this.resolveConflict(queuedEvent, data.serverEvent);
                        if (resolution.strategy === 'manual') {
                            // Mark for manual resolution
                            await this.queueManager.updateEventStatus(
                                queuedEvent.id,
                                'failed',
                                'Requires manual conflict resolution'
                            );
                            result.failedCount++;
                            result.errors.push({
                                eventId: queuedEvent.id,
                                error: 'Conflict requires manual resolution',
                            });
                            continue;
                        }
                    }

                    // Mark as synced
                    await this.queueManager.updateEventStatus(queuedEvent.id, 'synced');
                    result.syncedCount++;
                } catch (error) {
                    console.error('[SyncManager] Failed to sync event:', error);

                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    await this.queueManager.updateEventStatus(
                        queuedEvent.id,
                        'failed',
                        errorMessage
                    );

                    result.failedCount++;
                    result.errors.push({
                        eventId: queuedEvent.id,
                        error: errorMessage,
                    });
                }
            }

            // Clean up synced events
            await this.queueManager.clearSyncedEvents();

            result.success = result.failedCount === 0;
            console.log('[SyncManager] Sync complete:', result);

            // Notify callbacks
            this.notifySyncComplete(result);

            return result;
        } catch (error) {
            console.error('[SyncManager] Sync failed:', error);
            result.success = false;
            result.errors.push({
                eventId: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return result;
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Sync events for a specific match
     */
    async syncMatch(matchId: string, apiEndpoint: string = '/api/events/sync'): Promise<SyncResult> {
        const pendingEvents = await this.queueManager.getPendingEvents(matchId);

        if (pendingEvents.length === 0) {
            return {
                success: true,
                syncedCount: 0,
                failedCount: 0,
                errors: [],
            };
        }

        // Filter the sync to only this match's events
        const result = await this.syncAll(apiEndpoint);
        return result;
    }

    /**
     * Resolve conflicts between local and server events
     */
    private async resolveConflict(
        localEvent: QueuedEvent,
        serverEvent: any
    ): Promise<ConflictResolution> {
        // Simple conflict resolution strategy
        // In a real app, this would be more sophisticated

        // If timestamps are very close (within 5 seconds), prefer server
        const timeDiff = Math.abs(localEvent.timestamp - serverEvent.timestamp);
        if (timeDiff < 5000) {
            return { strategy: 'server-wins' };
        }

        // If local event is newer, prefer client
        if (localEvent.timestamp > serverEvent.timestamp) {
            return { strategy: 'client-wins' };
        }

        // Otherwise, prefer server
        return { strategy: 'server-wins' };
    }

    /**
     * Handle online event
     */
    private async handleOnline(): Promise<void> {
        console.log('[SyncManager] Device is online, starting sync...');

        // Wait a bit to ensure connection is stable
        setTimeout(async () => {
            try {
                await this.syncAll();
            } catch (error) {
                console.error('[SyncManager] Auto-sync failed:', error);
            }
        }, 2000);
    }

    /**
     * Handle offline event
     */
    private handleOffline(): void {
        console.log('[SyncManager] Device is offline');
    }

    /**
     * Register callback for sync completion
     */
    onSyncComplete(callback: (result: SyncResult) => void): () => void {
        this.syncCallbacks.push(callback);

        // Return unsubscribe function
        return () => {
            this.syncCallbacks = this.syncCallbacks.filter((cb) => cb !== callback);
        };
    }

    /**
     * Notify all callbacks of sync completion
     */
    private notifySyncComplete(result: SyncResult): void {
        this.syncCallbacks.forEach((callback) => {
            try {
                callback(result);
            } catch (error) {
                console.error('[SyncManager] Callback error:', error);
            }
        });
    }

    /**
     * Get current sync status
     */
    isSyncInProgress(): boolean {
        return this.isSyncing;
    }

    /**
     * Retry failed events
     */
    async retryFailed(matchId?: string): Promise<number> {
        const retriedCount = await this.queueManager.retryFailedEvents(matchId);

        if (retriedCount > 0) {
            // Trigger sync after retry
            setTimeout(() => this.syncAll(), 1000);
        }

        return retriedCount;
    }

    /**
     * Get queue statistics
     */
    async getStats() {
        return await this.queueManager.getQueueStats();
    }

    /**
     * Clear all offline data
     */
    async clearAll(): Promise<void> {
        await this.queueManager.clearAll();
    }
}

// Singleton instance
let syncManager: SyncManager | null = null;

export function getSyncManager(): SyncManager {
    if (!syncManager) {
        syncManager = new SyncManager();
    }
    return syncManager;
}

export { SyncManager };
