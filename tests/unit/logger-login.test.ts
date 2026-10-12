import { describe, it, expect } from 'vitest';
import { isLoggerStatusActive, pickLoggerCandidate } from '@/lib/logger-login';

describe('isLoggerStatusActive', () => {
    it('treats unset status as active for legacy rows', () => {
        expect(isLoggerStatusActive(null)).toBe(true);
        expect(isLoggerStatusActive(undefined)).toBe(true);
        expect(isLoggerStatusActive('')).toBe(true);
    });

    it('allows active and on_break', () => {
        expect(isLoggerStatusActive('active')).toBe(true);
        expect(isLoggerStatusActive('on_break')).toBe(true);
    });

    it('rejects inactive and unknown values', () => {
        expect(isLoggerStatusActive('inactive')).toBe(false);
        expect(isLoggerStatusActive('suspended')).toBe(false);
    });
});

describe('pickLoggerCandidate', () => {
    it('prefers the unique email match', () => {
        expect(pickLoggerCandidate(['by-email'], ['a', 'b'])).toBe('by-email');
    });

    it('accepts a name only when it identifies exactly one logger', () => {
        expect(pickLoggerCandidate([], ['only'])).toBe('only');
        expect(pickLoggerCandidate([], ['a', 'b'])).toBeNull();
        expect(pickLoggerCandidate([], [])).toBeNull();
    });
});
