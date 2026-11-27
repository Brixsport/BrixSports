import { describe, it, expect, vi, beforeEach } from 'vitest';

const sharedDb = vi.hoisted(() => ({
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock('@/db', () => ({ db: sharedDb }));
vi.mock('@/lib/rosterService', () => ({ getCurrentSeason: vi.fn(async () => '2026/2027') }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

import { incrementPlayerStats, decrementPlayerStats } from '@/lib/playerStatsService';

function fakeExecutor(existingRow: { id: string } | undefined) {
    const calls = { insert: 0, update: 0, conflict: 0, transaction: 0 };
    const insertChain = {
        values: () => ({
            onConflictDoUpdate: async () => { calls.conflict++; },
            then: (res: (v: unknown) => void) => { calls.insert++; res(undefined); },
        }),
    };
    const updateChain = { set: () => ({ where: async () => { calls.update++; } }) };
    const selectChain = { from: () => ({ where: () => ({ limit: () => ({ get: async () => existingRow }) }) }) };
    const executor = {
        insert: () => insertChain,
        update: () => updateChain,
        select: () => selectChain,
        transaction: async () => { calls.transaction++; },
    };
    return { executor: executor as never, calls };
}

beforeEach(() => vi.clearAllMocks());

describe('stats helpers write through a passed executor', () => {
    it('upserts via the executor for a real competition and never touches the shared db', async () => {
        const { executor, calls } = fakeExecutor(undefined);
        await incrementPlayerStats('Football', 'p1', { season: '2026/2027', competitionId: 'c1' }, { goals: 1 }, executor);
        expect(calls.conflict).toBe(1);
        expect(sharedDb.insert).not.toHaveBeenCalled();
        expect(sharedDb.transaction).not.toHaveBeenCalled();
    });

    it('does not open a nested transaction for a null-competition row', async () => {
        const { executor, calls } = fakeExecutor({ id: 'row1' });
        await incrementPlayerStats('Football', 'p1', { season: '2026/2027', competitionId: null }, { goals: 1 }, executor);
        expect(calls.update).toBe(1);
        expect(calls.transaction).toBe(0);
        expect(sharedDb.transaction).not.toHaveBeenCalled();
    });

    it('decrements through the executor', async () => {
        const { executor, calls } = fakeExecutor(undefined);
        await decrementPlayerStats('Football', 'p1', { season: '2026/2027', competitionId: 'c1' }, { goals: 1 }, executor);
        expect(calls.update).toBe(1);
        expect(sharedDb.update).not.toHaveBeenCalled();
    });
});
