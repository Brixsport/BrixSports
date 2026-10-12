import { describe, it, expect } from 'vitest';
import { isStartWithinWindow, collectAcrossPages } from '@/lib/notifications/reminder-window';

const NOW = new Date('2026-10-12T12:00:00.000Z');
const MIN = 60 * 1000;

describe('isStartWithinWindow', () => {
    it('accepts a kickoff inside the window (ISO with zone)', () => {
        expect(isStartWithinWindow('2026-10-12T12:20:00.000Z', NOW, 30 * MIN)).toBe(true);
    });

    it('accepts the window edges', () => {
        expect(isStartWithinWindow('2026-10-12T12:00:00.000Z', NOW, 30 * MIN)).toBe(true);
        expect(isStartWithinWindow('2026-10-12T12:30:00.000Z', NOW, 30 * MIN)).toBe(true);
    });

    it('rejects kickoffs that are past or beyond the window', () => {
        expect(isStartWithinWindow('2026-10-12T11:59:00.000Z', NOW, 30 * MIN)).toBe(false);
        expect(isStartWithinWindow('2026-10-12T12:31:00.000Z', NOW, 30 * MIN)).toBe(false);
    });

    it('rejects unparseable start times', () => {
        expect(isStartWithinWindow('', NOW, 30 * MIN)).toBe(false);
        expect(isStartWithinWindow('not a date', NOW, 30 * MIN)).toBe(false);
    });
});

describe('collectAcrossPages', () => {
    const all = Array.from({ length: 1200 }, (_, i) => i);
    const fetchPage = async (offset: number, size: number) => all.slice(offset, offset + size);

    it('finds a matching row that sits beyond the first page', async () => {
        const { rows, truncated } = await collectAcrossPages(fetchPage, (n) => n === 1150, 500, 20);
        expect(rows).toEqual([1150]);
        expect(truncated).toBe(false);
    });

    it('reports truncation when the page cap is hit', async () => {
        const { rows, truncated } = await collectAcrossPages(fetchPage, (n) => n % 100 === 0, 500, 2);
        expect(truncated).toBe(true);
        expect(rows.length).toBe(10);
    });

    it('stops after a short page', async () => {
        let calls = 0;
        const counted = async (offset: number, size: number) => { calls++; return all.slice(offset, offset + size); };
        await collectAcrossPages(counted, () => true, 500, 20);
        expect(calls).toBe(3);
    });
});
