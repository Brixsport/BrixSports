import { describe, it, expect } from 'vitest';
import { validateEventInput } from '@/lib/event-input';

const football = { homeTeamId: 'home-1', awayTeamId: 'away-1', sport: 'Football' };
const basketball = { homeTeamId: 'home-1', awayTeamId: 'away-1', sport: 'Basketball' };

describe('validateEventInput', () => {
    it('accepts a normal goal with a match team', () => {
        expect(validateEventInput({ type: 'Goal', minute: 12, teamId: 'home-1' }, football)).toBeNull();
        expect(validateEventInput({ type: 'Goal', minute: '45', second: 30, teamId: 'away-1' }, football)).toBeNull();
    });

    it('accepts non-scoring events without a team or with an empty team id', () => {
        expect(validateEventInput({ type: 'Corner', minute: 3 }, football)).toBeNull();
        expect(validateEventInput({ type: 'Foul', minute: 3, teamId: '' }, football)).toBeNull();
        expect(validateEventInput({ type: 'Foul', minute: 3, teamId: null, detail: null }, football)).toBeNull();
    });

    it('rejects a non-string or empty or oversized type', () => {
        expect(validateEventInput({ type: 5, minute: 1 }, football)).toMatch(/type/);
        expect(validateEventInput({ type: { a: 1 }, minute: 1 }, football)).toMatch(/type/);
        expect(validateEventInput({ type: '   ', minute: 1 }, football)).toMatch(/type/);
        expect(validateEventInput({ type: 'x'.repeat(65), minute: 1 }, football)).toMatch(/type/);
    });

    it('rejects bad minutes and seconds', () => {
        expect(validateEventInput({ type: 'Foul', minute: 'abc' }, football)).toMatch(/minute/);
        expect(validateEventInput({ type: 'Foul', minute: -1 }, football)).toMatch(/minute/);
        expect(validateEventInput({ type: 'Foul', minute: 401 }, football)).toMatch(/minute/);
        expect(validateEventInput({ type: 'Foul', minute: null }, football)).toMatch(/minute/);
        expect(validateEventInput({ type: 'Foul', minute: true }, football)).toMatch(/minute/);
        expect(validateEventInput({ type: 'Foul', minute: 10, second: -5 }, football)).toMatch(/second/);
        expect(validateEventInput({ type: 'Foul', minute: 10, second: 'x' }, football)).toMatch(/second/);
    });

    it('rejects a non-string or oversized detail', () => {
        expect(validateEventInput({ type: 'Foul', minute: 1, detail: { a: 1 } }, football)).toMatch(/detail/);
        expect(validateEventInput({ type: 'Foul', minute: 1, detail: 'x'.repeat(1001) }, football)).toMatch(/detail/);
        expect(validateEventInput({ type: 'Foul', minute: 1, detail: 'x'.repeat(1000) }, football)).toBeNull();
    });

    it('rejects a team id that is not one of the two match teams (it used to credit the away side)', () => {
        expect(validateEventInput({ type: 'Goal', minute: 1, teamId: 'someone-else' }, football)).toMatch(/teamId/);
        expect(validateEventInput({ type: 'Foul', minute: 1, teamId: 7 }, football)).toMatch(/teamId/);
    });

    it('requires a team for events that change the score', () => {
        expect(validateEventInput({ type: 'Goal', minute: 1 }, football)).toMatch(/teamId is required/);
        expect(validateEventInput({ type: 'Own Goal', minute: 1, teamId: '' }, football)).toMatch(/teamId is required/);
        expect(validateEventInput({ type: 'Penalty', minute: 1 }, football)).toMatch(/teamId is required/);
    });

    it('requires a team for a made basketball shot but not for a miss', () => {
        expect(validateEventInput({ type: 'Three Pointer', minute: 5, made: true }, basketball)).toMatch(/teamId is required/);
        expect(validateEventInput({ type: 'Three Pointer', minute: 5, made: false }, basketball)).toBeNull();
        expect(validateEventInput({ type: 'Free Throw', minute: 5, made: true, teamId: 'home-1' }, basketball)).toBeNull();
    });
});
