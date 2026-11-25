import { describe, it, expect } from 'vitest';
import { isDisallowedDraw, requiresDecisiveResult } from '@/lib/matchRules';

describe('isDisallowedDraw', () => {
    it('blocks a level score when draws are not allowed', () => {
        expect(isDisallowedDraw(false, 54, 54)).toBe(true);
    });
    it('allows a level score when draws are allowed', () => {
        expect(isDisallowedDraw(true, 1, 1)).toBe(false);
    });
    it('allows a decisive score', () => {
        expect(isDisallowedDraw(false, 55, 54)).toBe(false);
    });
});

describe('requiresDecisiveResult', () => {
    it('is true for knockout rounds only', () => {
        expect(requiresDecisiveResult('QUARTER_FINAL')).toBe(true);
        expect(requiresDecisiveResult('Match Day 1')).toBe(false);
        expect(requiresDecisiveResult(null)).toBe(false);
    });
});
