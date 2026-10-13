import { describe, it, expect } from 'vitest';
import { calculateBasketballStatsFromEvents } from '@/lib/ratings/basketball';
import type { MatchEvent } from '@/db/schema';

function event(partial: Partial<MatchEvent> & { type: string; playerId: string }): MatchEvent {
    return {
        id: `e-${Math.random()}`,
        matchId: 'm1',
        minute: 1,
        relatedPlayerId: null,
        value: null,
        isEyePoint: false,
        ...partial,
    } as unknown as MatchEvent;
}

describe('calculateBasketballStatsFromEvents assists', () => {
    it('credits an assist embedded on a teammate\'s made shot once', () => {
        const events = [event({ type: 'Field Goal', playerId: 'scorer', relatedPlayerId: 'passer', value: '2' })];
        expect(calculateBasketballStatsFromEvents('passer', events).assists).toBe(1);
    });

    it('credits a standalone Assist event once even when it also carries a related player', () => {
        const events = [event({ type: 'Assist', playerId: 'passer', relatedPlayerId: 'passer' })];
        expect(calculateBasketballStatsFromEvents('passer', events).assists).toBe(1);
    });

    it('does not credit the related player of a standalone Assist event', () => {
        const events = [event({ type: 'Assist', playerId: 'passer', relatedPlayerId: 'scorer' })];
        expect(calculateBasketballStatsFromEvents('scorer', events).assists).toBe(0);
        expect(calculateBasketballStatsFromEvents('passer', events).assists).toBe(1);
    });

    it('ignores an assist attached to a missed shot', () => {
        const events = [event({ type: 'Three Pointer', playerId: 'scorer', relatedPlayerId: 'passer', value: '0' })];
        expect(calculateBasketballStatsFromEvents('passer', events).assists).toBe(0);
    });

    it('ignores related players on events that are not shots', () => {
        const events = [
            event({ type: 'Steal', playerId: 'a', relatedPlayerId: 'passer' }),
            event({ type: 'Foul', playerId: 'a', relatedPlayerId: 'passer' }),
            event({ type: 'Substitution', playerId: 'a', relatedPlayerId: 'passer' }),
        ];
        expect(calculateBasketballStatsFromEvents('passer', events).assists).toBe(0);
    });

    it('counts both paths when they are different baskets', () => {
        const events = [
            event({ type: 'Field Goal', playerId: 'scorer', relatedPlayerId: 'passer', value: '2' }),
            event({ type: 'Assist', playerId: 'passer' }),
        ];
        expect(calculateBasketballStatsFromEvents('passer', events).assists).toBe(2);
    });

    it('reads backfilled made/missed values', () => {
        const events = [
            event({ type: 'Field Goal', playerId: 'scorer', relatedPlayerId: 'passer', value: 'made' }),
            event({ type: 'Field Goal', playerId: 'scorer', relatedPlayerId: 'passer', value: 'missed' }),
        ];
        expect(calculateBasketballStatsFromEvents('passer', events).assists).toBe(1);
    });
});
