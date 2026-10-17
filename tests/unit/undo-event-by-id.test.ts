import { describe, it, expect, afterEach } from 'vitest';
import { MatchStateManager, type FootballEventType } from '@/lib/match-state-manager';

let manager: MatchStateManager | null = null;

afterEach(() => {
    manager?.destroy();
    manager = null;
});

function liveManager() {
    manager = new MatchStateManager(`undo-by-id-${Math.random().toString(36).slice(2)}`, {
        homeTeamId: 'home',
        awayTeamId: 'away',
    });
    manager.transitionStatus('FIRST_HALF');
    return manager;
}

function record(m: MatchStateManager, type: FootballEventType, teamId: string) {
    return m.recordEvent({
        matchId: m.getState().matchId,
        type,
        playerId: null,
        playerSnapshot: null,
        relatedPlayerId: null,
        relatedPlayerSnapshot: null,
        teamId,
        detail: '',
        loggerId: 'logger-1',
    });
}

describe('undoEventById', () => {
    it('removes a goal that is not the latest event and reverts only its score', () => {
        const m = liveManager();
        const homeGoal = record(m, 'Goal', 'home');
        record(m, 'Goal', 'away');
        record(m, 'Corner', 'home');
        expect(m.getState().score).toEqual({ home: 1, away: 1 });

        const removed = m.undoEventById(homeGoal.id);

        expect(removed?.id).toBe(homeGoal.id);
        expect(m.getState().score).toEqual({ home: 0, away: 1 });
        expect(m.getState().events.map(e => e.type)).toEqual(['Goal', 'Corner']);
    });

    it('returns null and changes nothing for an unknown id', () => {
        const m = liveManager();
        record(m, 'Goal', 'home');
        expect(m.undoEventById('nope')).toBeNull();
        expect(m.getState().score).toEqual({ home: 1, away: 0 });
        expect(m.getState().events).toHaveLength(1);
    });

    it('undoLastEvent still removes the most recent event', () => {
        const m = liveManager();
        record(m, 'Goal', 'home');
        const last = record(m, 'Goal', 'home');
        expect(m.undoLastEvent()?.id).toBe(last.id);
        expect(m.getState().score).toEqual({ home: 1, away: 0 });
    });
});
