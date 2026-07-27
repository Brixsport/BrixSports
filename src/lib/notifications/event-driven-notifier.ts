/**
 * Event-Driven Notification Service
 * 
 * Handles match event notifications with:
 * - Deduplication (persisted across refreshes)
 * - Event-driven triggers (not UI-driven)
 * - Background/foreground handling
 * - Retry logic
 * 
 * @version 2.0.0
 */

import { MatchEvent } from '@/lib/match-state-manager';

type PeriodEventType = 'MATCH_START' | 'HALF_TIME' | 'MATCH_END';

interface NotificationQueueItem {
    matchId: string;
    homeTeamId: string;
    awayTeamId: string;
    // Either a match event (goal, card, etc.) or a period transition
    event?: MatchEvent;
    periodEventType?: PeriodEventType;
    score: { home: number; away: number };
    attempts: number;
    lastAttempt: number;
}

export class EventDrivenNotifier {
    private sentNotifications = new Map<string, number>();
    private queue: NotificationQueueItem[] = [];
    private isProcessing = false;
    private maxRetries = 3;
    private retryDelay = 5000; // 5 seconds

    constructor() {
        this.loadSentNotifications();
        this.listenForEvents();
        this.handleVisibilityChange();
        this.startQueueProcessor();
    }

    // ========== PERSISTENCE ==========

    private loadSentNotifications(): void {
        if (typeof window === 'undefined') return;

        try {
            const saved = localStorage.getItem('sent_notifications');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Old format was a flat array of strings (Set); those entries carry no
                // timestamp and dedup never worked while they were written, so discard them.
                if (Array.isArray(parsed) && parsed.every((entry: unknown) => Array.isArray(entry) && entry.length === 2)) {
                    this.sentNotifications = new Map(parsed);
                }
            }
        } catch (error) {
            console.error('Failed to load sent notifications:', error);
        }
    }

    private persistSentNotifications(): void {
        if (typeof window === 'undefined') return;

        try {
            const array = Array.from(this.sentNotifications.entries());
            localStorage.setItem('sent_notifications', JSON.stringify(array));
        } catch (error) {
            console.error('Failed to persist sent notifications:', error);
        }
    }

    /**
     * Clear old notifications (older than 7 days)
     */
    private cleanupOldNotifications(): void {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        this.sentNotifications.forEach((timestamp, key) => {
            if (timestamp < sevenDaysAgo) {
                this.sentNotifications.delete(key);
            }
        });

        this.persistSentNotifications();
    }

    // ========== EVENT LISTENING ==========

    private listenForEvents(): void {
        if (typeof window === 'undefined') return;

        console.log('[EventDrivenNotifier] Starting event listener...');

        window.addEventListener('MATCH_NOTIFICATION_TRIGGER', (event: any) => {
            const detail = event.detail;
            console.log('[EventDrivenNotifier] MATCH_NOTIFICATION_TRIGGER received:', detail);
            if (detail.periodEventType) {
                this.handlePeriodEvent(detail);
            } else {
                this.handleEvent(detail);
            }
        });

        // Cleanup old notifications daily
        setInterval(() => {
            this.cleanupOldNotifications();
        }, 24 * 60 * 60 * 1000);
    }

    // ========== NOTIFICATION HANDLING ==========

    private async handlePeriodEvent(detail: {
        matchId: string;
        homeTeamId: string;
        awayTeamId: string;
        periodEventType: PeriodEventType;
        score: { home: number; away: number };
    }): Promise<void> {
        const { matchId, homeTeamId, awayTeamId, periodEventType, score } = detail;

        const notificationKey = `${matchId}_${periodEventType}`;
        if (this.sentNotifications.has(notificationKey)) return;

        this.queue.push({
            matchId,
            homeTeamId,
            awayTeamId,
            periodEventType,
            score,
            attempts: 0,
            lastAttempt: 0,
        });

        this.sentNotifications.set(notificationKey, Date.now());
        this.persistSentNotifications();
        this.processQueue();
    }

    private async handleEvent(detail: {
        matchId: string;
        homeTeamId: string;
        awayTeamId: string;
        event: MatchEvent;
        score: { home: number; away: number };
    }): Promise<void> {
        const { matchId, homeTeamId, awayTeamId, event, score } = detail;

        // Deduplication key — timestamp tracked separately (see sentNotifications) for cleanup only
        const notificationKey = `${matchId}_${event.id}`;

        // Check if already sent
        if (this.sentNotifications.has(notificationKey)) {
            console.log('✓ Notification already sent for event:', event.id);
            return;
        }

        // Determine notification type
        const notificationType = this.getNotificationType(event.type);
        if (!notificationType) return;

        // Add to queue
        this.queue.push({
            matchId,
            homeTeamId,
            awayTeamId,
            event,
            score,
            attempts: 0,
            lastAttempt: 0,
        });

        // Mark as sent immediately (optimistic)
        this.sentNotifications.set(notificationKey, Date.now());
        this.persistSentNotifications();

        // Process queue
        this.processQueue();
    }

    private getNotificationType(eventType: string): 'GOAL' | 'RED_CARD' | 'YELLOW_CARD' | 'PENALTY_SAVED' | 'PENALTY_MISSED' | null {
        switch (eventType) {
            case 'Goal':
            case 'Penalty':
                return 'GOAL';
            case 'Red Card':
                return 'RED_CARD';
            case 'Yellow Card':
                return 'YELLOW_CARD';
            case 'Penalty Saved':
                return 'PENALTY_SAVED';
            case 'Penalty Missed':
                return 'PENALTY_MISSED';
            default:
                return null;
        }
    }

    // ========== QUEUE PROCESSING ==========

    private startQueueProcessor(): void {
        // Process queue every 2 seconds
        setInterval(() => {
            this.processQueue();
        }, 2000);
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;

        try {
            const now = Date.now();
            const itemsToProcess = this.queue.filter(item => {
                // Retry after delay
                return item.attempts === 0 || (now - item.lastAttempt) >= this.retryDelay;
            });

            for (const item of itemsToProcess) {
                await this.sendNotification(item);
            }

            // Remove successfully sent or max-retried items
            this.queue = this.queue.filter(item => {
                return item.attempts < this.maxRetries;
            });
        } finally {
            this.isProcessing = false;
        }
    }

    private async sendNotification(item: NotificationQueueItem): Promise<void> {
        const { matchId, homeTeamId, awayTeamId, event, periodEventType, score } = item;

        item.attempts++;
        item.lastAttempt = Date.now();

        console.log(`[EventDrivenNotifier] Sending notification (attempt ${item.attempts}):`, { matchId, periodEventType, eventType: event?.type, player: event?.playerSnapshot?.name });

        try {
            let payload: Record<string, unknown>;

            if (periodEventType) {
                payload = {
                    matchId,
                    homeTeamId,
                    awayTeamId,
                    eventType: periodEventType,
                    homeScore: score.home,
                    awayScore: score.away,
                };
            } else if (event) {
                const notificationType = this.getNotificationType(event.type);
                if (!notificationType) {
                    console.log('[EventDrivenNotifier] Not a notifiable event type:', event.type);
                    return;
                }
                payload = {
                    matchId,
                    homeTeamId,
                    awayTeamId,
                    eventType: notificationType,
                    playerName: event.playerSnapshot?.name,
                    teamName: event.playerSnapshot?.name,
                    minute: event.displayMinute,
                    homeScore: score.home,
                    awayScore: score.away,
                };
            } else {
                return;
            }
            console.log('[EventDrivenNotifier] POST /api/notifications/match-event:', payload);

            const response = await fetch('/api/notifications/match-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                console.log(`[EventDrivenNotifier] ✅ Notification sent for ${periodEventType ?? event?.type} by ${event?.playerSnapshot?.name ?? 'n/a'}`);

                // Remove from queue
                const index = this.queue.indexOf(item);
                if (index !== -1) {
                    this.queue.splice(index, 1);
                }
            } else {
                console.warn(`⚠️ Notification failed (attempt ${item.attempts}/${this.maxRetries}):`, await response.text());
            }
        } catch (error) {
            console.error(`❌ Notification error (attempt ${item.attempts}/${this.maxRetries}):`, error);
        }
    }

    // ========== VISIBILITY HANDLING ==========

    /**
     * Handle app going to background/foreground
     * Ensures notifications are sent even when app is backgrounded
     */
    private handleVisibilityChange(): void {
        if (typeof document === 'undefined') return;

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // App came to foreground, process any pending notifications
                console.log('App visible, processing pending notifications...');
                this.processQueue();
            }
        });
    }

    // ========== PUBLIC API ==========

    /**
     * Manually trigger notification (for testing)
     */
    triggerNotification(
        matchId: string,
        homeTeamId: string,
        awayTeamId: string,
        event: MatchEvent,
        score: { home: number; away: number }
    ): void {
        this.handleEvent({ matchId, homeTeamId, awayTeamId, event, score });
    }

    /**
     * Check if notification was sent for an event
     */
    wasNotificationSent(matchId: string, eventId: string): boolean {
        return this.sentNotifications.has(`${matchId}_${eventId}`);
    }

    /**
     * Clear all sent notifications (for testing)
     */
    clearSentNotifications(): void {
        this.sentNotifications.clear();
        this.persistSentNotifications();
    }

    /**
     * Get queue status (for debugging)
     */
    getQueueStatus(): {
        queueLength: number;
        sentCount: number;
        isProcessing: boolean;
    } {
        return {
            queueLength: this.queue.length,
            sentCount: this.sentNotifications.size,
            isProcessing: this.isProcessing,
        };
    }
}

// ========== SINGLETON INSTANCE ==========

let notifierInstance: EventDrivenNotifier | null = null;

export function getNotifier(): EventDrivenNotifier {
    if (typeof window === 'undefined') {
        throw new Error('EventDrivenNotifier can only be used in browser');
    }

    if (!notifierInstance) {
        notifierInstance = new EventDrivenNotifier();
    }

    return notifierInstance;
}

// Auto-initialize on import (browser only)
if (typeof window !== 'undefined') {
    getNotifier();
}
