import { describe, it, expect } from 'vitest';
import {
    matchListCacheControl,
    isMatchHot,
    LIVE_LIST_CACHE_CONTROL,
    QUIET_LIST_CACHE_CONTROL,
} from '@/lib/public-list-cache';

const NOW = Date.parse('2026-11-28T15:00:00Z');
const min = (n: number) => n * 60 * 1000;
const at = (offsetMs: number) => new Date(NOW + offsetMs);

describe('matchListCacheControl', () => {
    it('uses the short window for an empty list (a match may be about to appear)', () => {
        expect(matchListCacheControl([], NOW)).toBe(LIVE_LIST_CACHE_CONTROL);
    });

    it('uses the short window when any match is LIVE', () => {
        const list = [{ status: 'FINISHED', startTime: at(-min(300)) }, { status: 'LIVE', startTime: at(-min(20)) }];
        expect(matchListCacheControl(list, NOW)).toBe(LIVE_LIST_CACHE_CONTROL);
    });

    it('is case-insensitive about the status', () => {
        expect(matchListCacheControl([{ status: 'live', startTime: at(-min(5)) }], NOW)).toBe(LIVE_LIST_CACHE_CONTROL);
    });

    it('uses the short window for a kickoff inside the 30 minute lookahead', () => {
        expect(matchListCacheControl([{ status: 'UPCOMING', startTime: at(min(20)) }], NOW)).toBe(LIVE_LIST_CACHE_CONTROL);
    });

    it('flips to the long window just outside the lookahead (kickoff boundary)', () => {
        expect(matchListCacheControl([{ status: 'UPCOMING', startTime: at(min(30)) }], NOW)).toBe(LIVE_LIST_CACHE_CONTROL);
        expect(matchListCacheControl([{ status: 'UPCOMING', startTime: at(min(31)) }], NOW)).toBe(QUIET_LIST_CACHE_CONTROL);
    });

    it('keeps the short window for a match past its start time that is not marked live yet', () => {
        expect(matchListCacheControl([{ status: 'UPCOMING', startTime: at(-min(10)) }], NOW)).toBe(LIVE_LIST_CACHE_CONTROL);
    });

    it('ignores a long-stale unstarted row instead of pinning the list short forever', () => {
        expect(matchListCacheControl([{ status: 'UPCOMING', startTime: at(-min(60 * 8)) }], NOW)).toBe(QUIET_LIST_CACHE_CONTROL);
    });

    it('uses the long window for finished matches and distant fixtures only', () => {
        const list = [
            { status: 'FINISHED', startTime: at(-min(60 * 30)) },
            { status: 'CANCELLED', startTime: at(min(10)) },
            { status: 'UPCOMING', startTime: at(min(60 * 26)) },
        ];
        expect(matchListCacheControl(list, NOW)).toBe(QUIET_LIST_CACHE_CONTROL);
    });

    it('stays short when the start time is unknown on a non-terminal match', () => {
        expect(matchListCacheControl([{ status: 'UPCOMING', startTime: null }], NOW)).toBe(LIVE_LIST_CACHE_CONTROL);
    });

    it('accepts ISO strings and epoch numbers for the start time', () => {
        expect(isMatchHot({ status: 'UPCOMING', startTime: new Date(NOW + min(10)).toISOString() }, NOW)).toBe(true);
        expect(isMatchHot({ status: 'UPCOMING', startTime: NOW + min(500) }, NOW)).toBe(false);
    });
});
