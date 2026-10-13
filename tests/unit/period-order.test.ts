import { describe, it, expect } from 'vitest';
import { isPeriodRegression, periodRank } from '@/lib/period-order';

describe('isPeriodRegression (football)', () => {
    const f = (from: string, to: string) => isPeriodRegression('Football', from, to);

    it('allows moving forward through the match', () => {
        expect(f('NOT_STARTED', 'FIRST_HALF')).toBe(false);
        expect(f('FIRST_HALF', 'HALF_TIME')).toBe(false);
        expect(f('HALF_TIME', 'SECOND_HALF')).toBe(false);
        expect(f('SECOND_HALF', 'FINISHED')).toBe(false);
        expect(f('SECOND_HALF', 'EXTRA_TIME_1')).toBe(false);
        expect(f('EXTRA_TIME_1', 'EXTRA_TIME_BREAK')).toBe(false);
        expect(f('EXTRA_TIME_BREAK', 'EXTRA_TIME_2')).toBe(false);
        expect(f('EXTRA_TIME_2', 'PENALTY_SHOOTOUT')).toBe(false);
        expect(f('PENALTY_SHOOTOUT', 'FINISHED')).toBe(false);
    });

    it('treats the same period as a no-op', () => {
        expect(f('SECOND_HALF', 'SECOND_HALF')).toBe(false);
        expect(f('FINISHED', 'FINISHED')).toBe(false);
    });

    it('rejects going back', () => {
        expect(f('SECOND_HALF', 'FIRST_HALF')).toBe(true);
        expect(f('HALF_TIME', 'FIRST_HALF')).toBe(true);
        expect(f('FIRST_HALF', 'NOT_STARTED')).toBe(true);
        expect(f('EXTRA_TIME_2', 'SECOND_HALF')).toBe(true);
        expect(f('PENALTY_SHOOTOUT', 'EXTRA_TIME_1')).toBe(true);
    });

    it('allows FINISHED at the end of regular time to continue into extra time or penalties', () => {
        expect(f('FINISHED', 'EXTRA_TIME_1')).toBe(false);
        expect(f('FINISHED', 'PENALTY_SHOOTOUT')).toBe(false);
    });

    it('rejects going back from FINISHED to a regular-time period', () => {
        expect(f('FINISHED', 'FIRST_HALF')).toBe(true);
        expect(f('FINISHED', 'SECOND_HALF')).toBe(true);
        expect(f('FINISHED', 'NOT_STARTED')).toBe(true);
    });

    it('allows SUSPENDED and leaving SUSPENDED', () => {
        expect(f('SECOND_HALF', 'SUSPENDED')).toBe(false);
        expect(f('SUSPENDED', 'SECOND_HALF')).toBe(false);
        expect(f('SUSPENDED', 'FIRST_HALF')).toBe(false);
    });

    it('does not judge a missing or unknown period', () => {
        expect(isPeriodRegression('Football', null, 'FIRST_HALF')).toBe(false);
        expect(isPeriodRegression('Football', undefined, 'FIRST_HALF')).toBe(false);
        expect(f('SOMETHING_ELSE', 'FIRST_HALF')).toBe(false);
        expect(f('SECOND_HALF', 'SOMETHING_ELSE')).toBe(false);
    });
});

describe('isPeriodRegression (basketball)', () => {
    const b = (from: string, to: string) => isPeriodRegression('Basketball', from, to);

    it('allows moving forward through quarters and overtimes', () => {
        expect(b('NOT_STARTED', 'Q1')).toBe(false);
        expect(b('Q1', 'Q2')).toBe(false);
        expect(b('Q2', 'HALF_TIME')).toBe(false);
        expect(b('HALF_TIME', 'Q3')).toBe(false);
        expect(b('Q4', 'OT1')).toBe(false);
        expect(b('OT1', 'OT2')).toBe(false);
        expect(b('OT9', 'OT10')).toBe(false);
        expect(b('OT2', 'FINISHED')).toBe(false);
        expect(b('FINISHED', 'OT1')).toBe(false);
    });

    it('rejects going back', () => {
        expect(b('Q3', 'Q2')).toBe(true);
        expect(b('Q4', 'Q1')).toBe(true);
        expect(b('OT2', 'OT1')).toBe(true);
        expect(b('OT1', 'Q4')).toBe(true);
        expect(b('Q3', 'HALF_TIME')).toBe(true);
        expect(b('Q2', 'NOT_STARTED')).toBe(true);
        expect(b('FINISHED', 'Q4')).toBe(true);
    });

    it('allows the same period and SUSPENDED', () => {
        expect(b('Q2', 'Q2')).toBe(false);
        expect(b('Q2', 'SUSPENDED')).toBe(false);
        expect(b('SUSPENDED', 'Q1')).toBe(false);
    });
});

describe('periodRank', () => {
    it('does not rank periods of another sport', () => {
        expect(periodRank('Basketball', 'FIRST_HALF')).toBeNull();
        expect(periodRank('Football', 'Q1')).toBeNull();
        expect(periodRank('Chess', 'FIRST_HALF')).toBeNull();
    });
});
