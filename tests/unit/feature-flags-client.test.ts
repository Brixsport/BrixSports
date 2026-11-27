import { describe, it, expect } from 'vitest';
import { resolveFlag, CLIENT_CLOSED_BY_DEFAULT } from '@/lib/feature-flags-client';

describe('resolveFlag', () => {
    it('fails open for an unknown or still-loading ordinary key', () => {
        expect(resolveFlag({}, 'features.ads.enabled')).toBe(true);
    });

    it('hides an ordinary key only when it is explicitly false', () => {
        expect(resolveFlag({ 'features.ads.enabled': false }, 'features.ads.enabled')).toBe(false);
        expect(resolveFlag({ 'features.ads.enabled': true }, 'features.ads.enabled')).toBe(true);
    });

    it('keeps closed-by-default keys closed until the API says true', () => {
        for (const key of CLIENT_CLOSED_BY_DEFAULT) {
            expect(resolveFlag({}, key)).toBe(false); // flags not loaded yet
            expect(resolveFlag({ [key]: false }, key)).toBe(false);
            expect(resolveFlag({ [key]: true }, key)).toBe(true);
        }
    });

    it('treats livestream and ratings as closed by default', () => {
        expect(CLIENT_CLOSED_BY_DEFAULT.has('features.livestream.enabled')).toBe(true);
        expect(CLIENT_CLOSED_BY_DEFAULT.has('features.ratings.enabled')).toBe(true);
    });
});
