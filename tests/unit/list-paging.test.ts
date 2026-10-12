import { describe, it, expect } from 'vitest';
import { parseListPaging } from '@/lib/list-paging';

const OPTS = { defaultLimit: 100, maxLimit: 200 };
const parse = (qs: string) => parseListPaging(new URLSearchParams(qs), OPTS);

describe('parseListPaging', () => {
    it('keeps the old behaviour when no paging params are sent', () => {
        expect(parse('')).toEqual({ limit: 100, offset: 0 });
        expect(parse('status=LIVE')).toEqual({ limit: 100, offset: 0 });
    });

    it('honours valid values', () => {
        expect(parse('limit=25&offset=50')).toEqual({ limit: 25, offset: 50 });
    });

    it('clamps to the max', () => {
        expect(parse('limit=5000')).toEqual({ limit: 200, offset: 0 });
    });

    it('falls back on zero, negative and non numeric input', () => {
        expect(parse('limit=0&offset=-5')).toEqual({ limit: 100, offset: 0 });
        expect(parse('limit=abc&offset=xyz')).toEqual({ limit: 100, offset: 0 });
        expect(parse('limit=-3')).toEqual({ limit: 100, offset: 0 });
    });
});
