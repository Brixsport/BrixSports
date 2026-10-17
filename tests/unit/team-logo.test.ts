// Phase 2 (TESTING_STRATEGY_2026-09-18.md): pure logic in team-logo.tsx.
// getInitials and hashColor were module-private -- exported (1-line change
// each, no behavior change) specifically so they're directly unit-testable
// instead of only reachable through rendering the <TeamLogo> component.
import { describe, it, expect } from 'vitest';
import { isValidLogo, getInitials, hashColor } from '@/lib/utils/team-logo';

describe('isValidLogo', () => {
    it('rejects null, undefined, empty, and placeholder logos', () => {
        expect(isValidLogo(null)).toBe(false);
        expect(isValidLogo(undefined)).toBe(false);
        expect(isValidLogo('')).toBe(false);
        expect(isValidLogo('   ')).toBe(false);
        expect(isValidLogo('https://example.com/placeholder.png')).toBe(false);
    });

    it('accepts a real-looking logo URL', () => {
        expect(isValidLogo('https://res.cloudinary.com/brixsports/team-logo.png')).toBe(true);
    });
});

describe('getInitials', () => {
    it('takes the first letter of the first two words, uppercased', () => {
        expect(getInitials('Busa Wolves')).toBe('BW');
    });

    it('strips punctuation instead of grabbing it as a "word"', () => {
        expect(getInitials('BUSALYMPICS (FOOTBALL)')).toBe('BF');
    });

    it('handles a single-word name', () => {
        expect(getInitials('Arsenal')).toBe('A');
    });

    it('returns empty string for a name with no alphanumeric characters', () => {
        expect(getInitials('---')).toBe('');
    });
});

describe('hashColor', () => {
    it('is deterministic -- same name always produces the same color', () => {
        expect(hashColor('Busa Wolves')).toBe(hashColor('Busa Wolves'));
    });

    it('produces a valid hsl() string with hue in [0, 360)', () => {
        const color = hashColor('Any Team Name');
        const match = color.match(/^hsl\((\d+), 45%, 38%\)$/);
        expect(match).not.toBeNull();
        const hue = Number(match![1]);
        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThan(360);
    });

    it('gives different names different colors in the common case', () => {
        // Not a mathematical guarantee (hash collisions are possible), but a
        // real regression (e.g. always returning hue 0) would fail this.
        expect(hashColor('Busa Wolves')).not.toBe(hashColor('Joga United'));
    });
});
