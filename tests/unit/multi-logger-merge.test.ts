// Phase 2 (TESTING_STRATEGY_2026-09-18.md): the strategy doc originally
// pointed at "events/route.ts's dedup-key logic" as a pure-function unit
// target. It isn't one -- POST /api/matches/[id]/events's BUG-196 dedup
// (matchId+type+minute+playerId within a 10s window) runs as a SQL WHERE
// clause inside a db.transaction(), and only a real concurrent-request test
// against a real DB (tests/smoke/dual-logger-race.test.ts, Phase 1) can prove
// it actually holds under real concurrency. The genuinely pure, zero-DB dedup
// logic BACKLOG-151 itself names is client-side: mergeEvents' exact-ID
// dedup + detectConflicts (src/lib/multiLogger.ts) -- this is that unit test.
import { describe, it, expect } from 'vitest';
import { mergeEvents, detectConflicts, getLoggerReliability, autoResolveConflicts, type SyncEvent } from '@/lib/multiLogger';

function event(overrides: Partial<SyncEvent>): SyncEvent {
    return {
        id: overrides.id ?? 'evt-1',
        type: 'Goal',
        minute: 10,
        second: 0,
        teamId: 'team-home',
        detail: '',
        loggerId: 'logger-1',
        loggerName: 'Logger One',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        synced: true,
        ...overrides,
    };
}

describe('mergeEvents — exact-ID dedup (BACKLOG-151 poll-merge path)', () => {
    it('collapses the same event id appearing in both local and remote lists', () => {
        const shared = event({ id: 'evt-shared' });
        const { merged } = mergeEvents([shared], [{ ...shared, synced: true }]);
        expect(merged).toHaveLength(1);
    });

    it('keeps distinct ids even if every other field matches', () => {
        const a = event({ id: 'evt-a', loggerId: 'logger-1' });
        const b = event({ id: 'evt-b', loggerId: 'logger-2' });
        const { merged } = mergeEvents([a], [b]);
        expect(merged).toHaveLength(2);
    });

    it('sorts merged events by minute then second then timestamp', () => {
        const late = event({ id: 'e1', minute: 20, second: 0, timestamp: new Date('2026-01-01T00:00:10Z') });
        const early = event({ id: 'e2', minute: 5, second: 30, timestamp: new Date('2026-01-01T00:00:05Z') });
        const { merged } = mergeEvents([late], [early]);
        expect(merged.map(e => e.id)).toEqual(['e2', 'e1']);
    });
});

describe('detectConflicts — cross-logger duplicate/contradiction detection', () => {
    it('flags two different loggers logging the same goal within the same 5s window as duplicate', () => {
        const e1 = event({ id: 'e1', loggerId: 'logger-1', minute: 10, second: 1, playerId: 'p1', type: 'Goal' });
        const e2 = event({ id: 'e2', loggerId: 'logger-2', minute: 10, second: 3, playerId: 'p1', type: 'Goal' });
        const conflicts = detectConflicts([e1, e2]);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].conflictType).toBe('duplicate');
    });

    it('does not flag the same logger logging twice as a conflict', () => {
        const e1 = event({ id: 'e1', loggerId: 'logger-1', minute: 10, second: 1, playerId: 'p1', type: 'Goal' });
        const e2 = event({ id: 'e2', loggerId: 'logger-1', minute: 10, second: 2, playerId: 'p1', type: 'Goal' });
        expect(detectConflicts([e1, e2])).toHaveLength(0);
    });

    it('flags contradictory events (Goal vs Save) from different loggers at the same time as high severity', () => {
        const goal = event({ id: 'e1', loggerId: 'logger-1', minute: 10, second: 1, type: 'Goal' });
        const save = event({ id: 'e2', loggerId: 'logger-2', minute: 10, second: 2, type: 'Save' });
        const conflicts = detectConflicts([goal, save]);
        expect(conflicts.some(c => c.conflictType === 'contradictory' && c.severity === 'high')).toBe(true);
    });

    it('does not flag events more than 5 seconds apart', () => {
        const e1 = event({ id: 'e1', loggerId: 'logger-1', minute: 10, second: 0, playerId: 'p1', type: 'Goal' });
        const e2 = event({ id: 'e2', loggerId: 'logger-2', minute: 10, second: 40, playerId: 'p1', type: 'Goal' });
        expect(detectConflicts([e1, e2])).toHaveLength(0);
    });
});

describe('getLoggerReliability', () => {
    it('is 0 for a logger with no events', () => {
        expect(getLoggerReliability('ghost-logger', [])).toBe(0);
    });

    it('scores a fully-synced logger higher than a partially-synced one', () => {
        const events: SyncEvent[] = [
            event({ id: 'e1', loggerId: 'reliable', synced: true }),
            event({ id: 'e2', loggerId: 'reliable', synced: true }),
            event({ id: 'e3', loggerId: 'flaky', synced: true }),
            event({ id: 'e4', loggerId: 'flaky', synced: false }),
        ];
        expect(getLoggerReliability('reliable', events)).toBeGreaterThan(getLoggerReliability('flaky', events));
    });
});

describe('autoResolveConflicts', () => {
    it('auto-resolves a duplicate conflict by keeping the more reliable logger\'s event', () => {
        const events: SyncEvent[] = [
            event({ id: 'e1', loggerId: 'reliable', synced: true }),
            event({ id: 'e2', loggerId: 'flaky', synced: false }),
        ];
        const conflicts = detectConflicts(
            events.map((e, i) => ({ ...e, minute: 10, second: i, playerId: 'p1', type: 'Goal' }))
        );
        const resolved = autoResolveConflicts(conflicts, events);
        expect(resolved[0].resolved).toBe(true);
        expect(resolved[0].resolution).toBe('keep-first');
    });

    it('leaves a contradictory conflict unresolved for manual review', () => {
        const goal = event({ id: 'e1', loggerId: 'logger-1', minute: 10, second: 1, type: 'Goal' });
        const save = event({ id: 'e2', loggerId: 'logger-2', minute: 10, second: 2, type: 'Save' });
        const conflicts = detectConflicts([goal, save]);
        const resolved = autoResolveConflicts(conflicts, [goal, save]);
        expect(resolved.every(c => c.conflictType !== 'contradictory' || !c.resolved)).toBe(true);
    });
});
