import { describe, it, expect } from 'vitest';
import { appendUnseenRemoteEvents } from '@/lib/logger-event-merge';

describe('appendUnseenRemoteEvents', () => {
    const local = [
        { id: 'a', type: 'Field Goal', period: 'Q2', made: true, assistPlayerId: 'p9', createdAt: new Date('2026-01-01T10:00:00Z') },
    ];

    it('keeps local events untouched, including fields the remote copy lacks', () => {
        const next = appendUnseenRemoteEvents(local, [{ id: 'a', type: 'Field Goal', relatedPlayerId: null }]);
        expect(next).toBe(local);
        expect(next[0].period).toBe('Q2');
        expect(next[0].made).toBe(true);
        expect(next[0].assistPlayerId).toBe('p9');
    });

    it('appends only events with unseen ids and maps them to the local shape', () => {
        const next = appendUnseenRemoteEvents(local as any[], [
            { id: 'a', type: 'Field Goal' },
            { id: 'b', type: 'Rebound', relatedPlayerId: 'p3', timestamp: '2026-01-01T10:05:00Z', playerId: 'p1' },
        ]);
        expect(next).toHaveLength(2);
        expect(next[0]).toBe(local[0]);
        expect(next[1]).toMatchObject({ id: 'b', type: 'Rebound', playerId: 'p1', assistPlayerId: 'p3' });
        expect(next[1].createdAt).toEqual(new Date('2026-01-01T10:05:00Z'));
    });

    it('does not duplicate an id that appears twice in the remote list', () => {
        const next = appendUnseenRemoteEvents([] as any[], [{ id: 'x' }, { id: 'x' }]);
        expect(next).toHaveLength(1);
    });

    it('does not drop an event logged locally while the sync request was in flight', () => {
        // The functional update runs against the CURRENT list, not a snapshot from before the await.
        const current = [...local, { id: 'c', type: 'Rebound', period: 'Q2' } as any];
        const next = appendUnseenRemoteEvents(current, [{ id: 'a' }, { id: 'b' }]);
        expect(next.map(e => e.id)).toEqual(['a', 'c', 'b']);
    });
});
