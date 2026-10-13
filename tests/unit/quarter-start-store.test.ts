import { describe, it, expect } from 'vitest';
import { saveQuarterStart, loadQuarterStart } from '@/lib/quarter-start-store';

function memoryStorage() {
    const data = new Map<string, string>();
    return {
        getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
        setItem: (k: string, v: string) => { data.set(k, v); },
    };
}

describe('quarter start store', () => {
    it('restores the saved start for the same period', () => {
        const s = memoryStorage();
        saveQuarterStart('m1', 'Q3', 1_000, s);
        expect(loadQuarterStart('m1', 'Q3', 5_000, s)).toBe(1_000);
    });

    it('ignores a start saved for a different period or match', () => {
        const s = memoryStorage();
        saveQuarterStart('m1', 'Q2', 1_000, s);
        expect(loadQuarterStart('m1', 'Q3', 5_000, s)).toBeNull();
        expect(loadQuarterStart('m2', 'Q2', 5_000, s)).toBeNull();
    });

    it('ignores a start in the future (clock change) and unparsable data', () => {
        const s = memoryStorage();
        saveQuarterStart('m1', 'Q1', 9_000, s);
        expect(loadQuarterStart('m1', 'Q1', 5_000, s)).toBeNull();
        s.setItem('bb_quarter_start_m1', '{not json');
        expect(loadQuarterStart('m1', 'Q1', 5_000, s)).toBeNull();
    });

    it('never throws when storage is unavailable or throws', () => {
        expect(() => saveQuarterStart('m1', 'Q1', 1, null)).not.toThrow();
        expect(loadQuarterStart('m1', 'Q1', 5, null)).toBeNull();
        const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
        expect(() => saveQuarterStart('m1', 'Q1', 1, bad)).not.toThrow();
        expect(loadQuarterStart('m1', 'Q1', 5, bad)).toBeNull();
    });
});
