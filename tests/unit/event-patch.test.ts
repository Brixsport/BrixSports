import { describe, it, expect } from 'vitest';
import { validateEventPatch, isScoringEvent, SCORING_EDIT_MESSAGE } from '@/lib/event-patch';

const football = { homeTeamId: 'home-1', awayTeamId: 'away-1', sport: 'Football' };
const basketball = { homeTeamId: 'home-1', awayTeamId: 'away-1', sport: 'Basketball' };

const goal = { type: 'Goal', teamId: 'home-1', value: null };
const yellow = { type: 'Yellow Card', teamId: 'home-1', value: null };
const madeShot = { type: 'Field Goal', teamId: 'home-1', value: '2' };
const missedShot = { type: 'Field Goal', teamId: 'home-1', value: '0' };

describe('isScoringEvent', () => {
    it('recognises football scoring types', () => {
        expect(isScoringEvent('Football', 'Goal', null)).toBe(true);
        expect(isScoringEvent('Football', 'own goal', null)).toBe(true);
        expect(isScoringEvent('Football', 'Yellow Card', null)).toBe(false);
    });

    it('treats a basketball shot as scoring only when it was made', () => {
        expect(isScoringEvent('Basketball', 'Field Goal', 2)).toBe(true);
        expect(isScoringEvent('Basketball', 'Field Goal', 0)).toBe(false);
        expect(isScoringEvent('Basketball', 'Rebound', 2)).toBe(false);
    });
});

describe('validateEventPatch', () => {
    it('allows editing minute, detail and period of a goal', () => {
        expect(validateEventPatch({ minute: 44, detail: 'header', period: 'FIRST_HALF' }, goal, football)).toBeNull();
    });

    it('allows changing the scorer of a goal (the team and the score do not change)', () => {
        expect(validateEventPatch({ playerId: 'p2' }, goal, football)).toBeNull();
    });

    it('rejects turning a goal into a yellow card', () => {
        expect(validateEventPatch({ type: 'Yellow Card' }, goal, football)).toBe(SCORING_EDIT_MESSAGE);
    });

    it('rejects flipping the team of a goal but accepts resending the same team', () => {
        expect(validateEventPatch({ teamId: 'away-1' }, goal, football)).toBe(SCORING_EDIT_MESSAGE);
        expect(validateEventPatch({ teamId: 'home-1', minute: 12 }, goal, football)).toBeNull();
    });

    it('accepts resending the same type in another case', () => {
        expect(validateEventPatch({ type: 'GOAL' }, goal, football)).toBeNull();
    });

    it('rejects turning a non-scoring event into a scoring one', () => {
        expect(validateEventPatch({ type: 'Goal' }, yellow, football)).toBe(SCORING_EDIT_MESSAGE);
    });

    it('allows re-typing between non-scoring types and moving them to the other team', () => {
        expect(validateEventPatch({ type: 'Red Card' }, yellow, football)).toBeNull();
        expect(validateEventPatch({ teamId: 'away-1' }, yellow, football)).toBeNull();
    });

    it('rejects changing the made flag or value of a made basketball shot', () => {
        expect(validateEventPatch({ made: false }, madeShot, basketball)).toBe(SCORING_EDIT_MESSAGE);
        expect(validateEventPatch({ value: 3 }, madeShot, basketball)).toBe(SCORING_EDIT_MESSAGE);
        expect(validateEventPatch({ value: 2, made: true, minute: 3 }, madeShot, basketball)).toBeNull();
    });

    it('lets a missed shot be edited freely apart from becoming another shot type', () => {
        expect(validateEventPatch({ minute: 5, teamId: 'away-1' }, missedShot, basketball)).toBeNull();
        expect(validateEventPatch({ type: 'Three Pointer' }, missedShot, basketball)).toBe(SCORING_EDIT_MESSAGE);
    });

    it('rejects invalid fields the same way creation does', () => {
        expect(validateEventPatch({ minute: -5 }, yellow, football)).toMatch(/minute/);
        expect(validateEventPatch({ type: 5 }, yellow, football)).toMatch(/type/);
        expect(validateEventPatch({ teamId: 'someone-else' }, yellow, football)).toMatch(/teamId/);
        expect(validateEventPatch({ detail: 'x'.repeat(1001) }, yellow, football)).toMatch(/detail/);
        expect(validateEventPatch({ playerId: 12 }, yellow, football)).toMatch(/playerId/);
        expect(validateEventPatch({ period: 'x'.repeat(40) }, yellow, football)).toMatch(/period/);
    });

    it('does not judge the stored minute of a backfilled event when the minute is not edited', () => {
        expect(validateEventPatch({ detail: 'note' }, { ...yellow }, football)).toBeNull();
    });
});
