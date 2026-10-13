import { describe, it, expect } from 'vitest';
import { clockCheckpoint } from '@/lib/clock-checkpoint';

describe('clockCheckpoint', () => {
    it('keeps the 45/90 behaviour for 45-minute halves', () => {
        expect(clockCheckpoint('FIRST_HALF', 47, 45)).toEqual({ minute: 45, extraTime: 2 });
        expect(clockCheckpoint('SECOND_HALF', 93, 45)).toEqual({ minute: 90, extraTime: 3 });
        expect(clockCheckpoint('FIRST_HALF', 30, 45)).toEqual({ minute: 30, extraTime: 0 });
    });

    it('uses the configured half length for 35-minute halves', () => {
        expect(clockCheckpoint('FIRST_HALF', 38, 35)).toEqual({ minute: 35, extraTime: 3 });
        expect(clockCheckpoint('SECOND_HALF', 72, 35)).toEqual({ minute: 70, extraTime: 2 });
        expect(clockCheckpoint('SECOND_HALF', 50, 35)).toEqual({ minute: 50, extraTime: 0 });
    });

    it('uses the configured half length for 20-minute halves', () => {
        expect(clockCheckpoint('FIRST_HALF', 22, 20)).toEqual({ minute: 20, extraTime: 2 });
        expect(clockCheckpoint('SECOND_HALF', 41, 20)).toEqual({ minute: 40, extraTime: 1 });
    });

    it('does not cap other periods and falls back to 45 for a bad half length', () => {
        expect(clockCheckpoint('EXTRA_TIME_1', 96, 45)).toEqual({ minute: 96, extraTime: 0 });
        expect(clockCheckpoint('FIRST_HALF', 47, 0)).toEqual({ minute: 45, extraTime: 2 });
    });
});
