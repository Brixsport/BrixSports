import { describe, it, expect } from 'vitest';
import { resolveRatingBounds } from '@/lib/ratings/bounds';

const fallback = { minRating: 1, maxRating: 10 };

describe('resolveRatingBounds', () => {
    it('keeps a valid range', () => {
        expect(resolveRatingBounds(2, 9, fallback)).toEqual({ minRating: 2, maxRating: 9 });
    });

    it('falls back when min equals max', () => {
        expect(resolveRatingBounds(5, 5, fallback)).toEqual(fallback);
    });

    it('falls back when min is above max', () => {
        expect(resolveRatingBounds(9, 3, fallback)).toEqual(fallback);
    });

    it('falls back on non-finite values', () => {
        expect(resolveRatingBounds(NaN, 10, fallback)).toEqual(fallback);
        expect(resolveRatingBounds(1, Infinity, fallback)).toEqual(fallback);
    });
});
