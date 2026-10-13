import { describe, it, expect } from 'vitest';
import { MAX_BULK_MATCH_IDS, parseBulkMatchUpdate, validateMatchTeams } from '@/lib/match-bulk-input';

describe('parseBulkMatchUpdate', () => {
    it('accepts a valid status change', () => {
        const r = parseBulkMatchUpdate({ ids: ['m1', 'm2'], updates: { status: 'CANCELLED', venue: 'Main Bowl' } });
        expect(r).toEqual({ ok: true, ids: ['m1', 'm2'], update: { status: 'CANCELLED', venue: 'Main Bowl' } });
    });

    it('rejects an unknown status and FINISHED', () => {
        expect(parseBulkMatchUpdate({ ids: ['m1'], updates: { status: 'DONE' } }).ok).toBe(false);
        expect(parseBulkMatchUpdate({ ids: ['m1'], updates: { status: 'FINISHED' } }).ok).toBe(false);
        expect(parseBulkMatchUpdate({ ids: ['m1'], updates: { status: { $ne: 1 } } }).ok).toBe(false);
    });

    it('caps the number of ids', () => {
        const ids = Array.from({ length: MAX_BULK_MATCH_IDS + 1 }, (_, i) => `m${i}`);
        expect(parseBulkMatchUpdate({ ids, updates: { venue: 'X' } }).ok).toBe(false);
        expect(parseBulkMatchUpdate({ ids: ids.slice(0, MAX_BULK_MATCH_IDS), updates: { venue: 'X' } }).ok).toBe(true);
    });

    it('rejects malformed bodies and non-string ids', () => {
        expect(parseBulkMatchUpdate(null).ok).toBe(false);
        expect(parseBulkMatchUpdate({ ids: [], updates: {} }).ok).toBe(false);
        expect(parseBulkMatchUpdate({ ids: [1], updates: { venue: 'X' } }).ok).toBe(false);
        expect(parseBulkMatchUpdate({ ids: ['m1'], updates: [] }).ok).toBe(false);
    });
});

describe('validateMatchTeams', () => {
    it('accepts two different teams', () => {
        expect(validateMatchTeams('a', 'b')).toBeNull();
    });

    it('rejects the same team twice and missing teams', () => {
        expect(validateMatchTeams('a', 'a')).not.toBeNull();
        expect(validateMatchTeams('', 'a')).not.toBeNull();
        expect(validateMatchTeams(undefined, 'a')).not.toBeNull();
        expect(validateMatchTeams('a', 5)).not.toBeNull();
    });
});
