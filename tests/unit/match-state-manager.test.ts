// Phase 2 (TESTING_STRATEGY_2026-09-18.md): pure in-memory state-transition
// logic in src/lib/match-state-manager.ts -- no DB, no network. Each test
// constructs its own MatchStateManager directly (bypassing the module-level
// getMatchStateManager() singleton registry) with a unique matchId, so tests
// never collide with each other's registry entry.
import { describe, it, expect, afterEach } from 'vitest';
import { MatchStateManager, type MatchPeriod } from '@/lib/match-state-manager';

let manager: MatchStateManager | null = null;

function freshManager(overrides?: ConstructorParameters<typeof MatchStateManager>[1]) {
    const id = `unit-test-${Math.random().toString(36).slice(2)}`;
    manager = new MatchStateManager(id, overrides);
    return manager;
}

afterEach(() => {
    // startClock() sets a real setInterval -- destroy() clears it. Without
    // this, transitionStatus('FIRST_HALF') tests would leak a live timer
    // per test run.
    manager?.destroy();
    manager = null;
});

describe('MatchStateManager — initial state', () => {
    it('starts NOT_STARTED, 0-0, with the configured half duration', () => {
        const m = freshManager({ homeTeamId: 'home-1', awayTeamId: 'away-1', halfDuration: 40 });
        const state = m.getState();
        expect(state.clock.period).toBe('NOT_STARTED');
        expect(state.score).toEqual({ home: 0, away: 0 });
        expect(state.halfDuration).toBe(40);
        expect(m.canRecordEvent()).toBe(false);
        expect(m.isLive()).toBe(false);
    });

    it('defaults halfDuration to 45 when not supplied', () => {
        const m = freshManager();
        expect(m.getState().halfDuration).toBe(45);
    });
});

describe('MatchStateManager — status transition table', () => {
    const validSequence: MatchPeriod[] = ['FIRST_HALF', 'HALF_TIME', 'SECOND_HALF', 'FINISHED'];

    it('walks the standard match lifecycle without throwing', () => {
        const m = freshManager();
        for (const period of validSequence) {
            expect(() => m.transitionStatus(period)).not.toThrow();
            expect(m.getState().clock.period).toBe(period);
        }
    });

    it('rejects skipping straight from NOT_STARTED to SECOND_HALF', () => {
        const m = freshManager();
        expect(() => m.transitionStatus('SECOND_HALF')).toThrow(/Invalid status transition/);
        // Rejected transition must not mutate state.
        expect(m.getState().clock.period).toBe('NOT_STARTED');
    });

    it('rejects going backwards from FINISHED to FIRST_HALF', () => {
        const m = freshManager();
        m.transitionStatus('FIRST_HALF');
        m.transitionStatus('HALF_TIME');
        m.transitionStatus('SECOND_HALF');
        m.transitionStatus('FINISHED');
        expect(() => m.transitionStatus('FIRST_HALF')).toThrow(/Invalid status transition/);
    });

    it('allows FINISHED -> EXTRA_TIME_1 (knockout progression from full time)', () => {
        const m = freshManager();
        m.transitionStatus('FIRST_HALF');
        m.transitionStatus('HALF_TIME');
        m.transitionStatus('SECOND_HALF');
        m.transitionStatus('FINISHED');
        expect(() => m.transitionStatus('EXTRA_TIME_1')).not.toThrow();
        expect(m.getState().clock.period).toBe('EXTRA_TIME_1');
    });

    it('ABANDONED is a dead end -- no valid transition out of it', () => {
        const m = freshManager();
        m.transitionStatus('FIRST_HALF');
        m.transitionStatus('SUSPENDED');
        m.transitionStatus('ABANDONED');
        expect(() => m.transitionStatus('FIRST_HALF')).toThrow(/Invalid status transition/);
        expect(() => m.transitionStatus('FINISHED')).toThrow(/Invalid status transition/);
    });

    it('SECOND_HALF resumes the clock exactly at halfDuration, not 0', () => {
        const m = freshManager({ halfDuration: 40 });
        m.transitionStatus('FIRST_HALF');
        m.transitionStatus('HALF_TIME');
        m.transitionStatus('SECOND_HALF');
        expect(m.getState().clock.absoluteMinute).toBe(40);
    });

    it('completePeriodTransition clears announced stoppage and transitions', () => {
        const m = freshManager();
        m.transitionStatus('FIRST_HALF');
        m.setAnnouncedStoppage(4);
        expect(m.getAnnouncedStoppage()).toBe(4);
        m.completePeriodTransition('HALF_TIME');
        expect(m.getState().clock.period).toBe('HALF_TIME');
        expect(m.getAnnouncedStoppage()).toBeNull();
    });
});

describe('MatchStateManager — canRecordEvent / isLive gating', () => {
    it('blocks event recording outside live play periods', () => {
        const m = freshManager();
        expect(m.canRecordEvent()).toBe(false); // NOT_STARTED
        m.transitionStatus('FIRST_HALF');
        expect(m.canRecordEvent()).toBe(true);
        m.transitionStatus('HALF_TIME');
        expect(m.canRecordEvent()).toBe(false); // BACKLOG-153: no logging during HT
        m.transitionStatus('SECOND_HALF');
        expect(m.canRecordEvent()).toBe(true);
        m.transitionStatus('FINISHED');
        expect(m.canRecordEvent()).toBe(false);
    });

    it('allows recording during penalty shootout', () => {
        const m = freshManager();
        m.transitionStatus('FIRST_HALF');
        m.transitionStatus('HALF_TIME');
        m.transitionStatus('SECOND_HALF');
        m.transitionStatus('FINISHED');
        m.transitionStatus('EXTRA_TIME_1');
        m.transitionStatus('EXTRA_TIME_2');
        m.transitionStatus('PENALTY_SHOOTOUT');
        expect(m.canRecordEvent()).toBe(true);
        expect(m.isLive()).toBe(true);
    });
});

describe('MatchStateManager — clock display and added time', () => {
    it('formats time as absoluteMinute:SS, zero-padded seconds', () => {
        const m = freshManager();
        m.setTime(38, 5);
        expect(m.getFormattedTime()).toBe('38:05');
        m.setTime(93, 22);
        expect(m.getFormattedTime()).toBe('93:22');
    });

    it('getElapsedAddedTime is 0 within regulation, positive beyond it', () => {
        const m = freshManager({ halfDuration: 45 });
        m.transitionStatus('FIRST_HALF');
        m.setTime(40, 0);
        expect(m.getElapsedAddedTime()).toBe(0);
        expect(m.isInAddedTime()).toBe(false);
        m.setTime(48, 0);
        expect(m.getElapsedAddedTime()).toBe(3);
        expect(m.isInAddedTime()).toBe(true);
    });

    it('getElapsedAddedTime accounts for halfDuration*2 in the second half', () => {
        const m = freshManager({ halfDuration: 45 });
        m.transitionStatus('FIRST_HALF');
        m.transitionStatus('HALF_TIME');
        m.transitionStatus('SECOND_HALF');
        m.setTime(93, 0);
        expect(m.getElapsedAddedTime()).toBe(3);
    });
});
