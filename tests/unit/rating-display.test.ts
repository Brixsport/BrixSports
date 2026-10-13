import { describe, it, expect } from 'vitest';
import { ratingOrUndefined } from '@/lib/ratings/display';

describe('ratingOrUndefined', () => {
    it('keeps a real rating', () => {
        expect(ratingOrUndefined(7.4)).toBe(7.4);
    });

    it('treats missing and zero ratings as not rated', () => {
        expect(ratingOrUndefined(undefined)).toBeUndefined();
        expect(ratingOrUndefined(null)).toBeUndefined();
        expect(ratingOrUndefined(0)).toBeUndefined();
    });

    it('treats invalid values as not rated', () => {
        expect(ratingOrUndefined(NaN)).toBeUndefined();
        expect(ratingOrUndefined('7.4')).toBeUndefined();
        expect(ratingOrUndefined(-1)).toBeUndefined();
    });
});
