import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadMatchDetail = vi.fn();
const checkRateLimit = vi.fn();

vi.mock('@/lib/match-detail', () => ({ loadMatchDetail: (...a: unknown[]) => loadMatchDetail(...a) }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
// The public route must stay session free: importing the auth module would make it fail loudly.
vi.mock('@/lib/auth', () => {
    throw new Error('public match route must not import the auth module');
});

import { GET } from '@/app/api/matches/[id]/public/route';

const call = (id = 'm1') =>
    GET(new Request(`http://localhost/api/matches/${id}/public`, { headers: { cookie: 'authToken=abc' } }), {
        params: Promise.resolve({ id }),
    });

describe('GET /api/matches/[id]/public', () => {
    beforeEach(() => {
        loadMatchDetail.mockReset();
        checkRateLimit.mockReset();
        checkRateLimit.mockResolvedValue({ limited: false });
    });

    it('serves an anonymous detail payload with a short shared-cache lifetime', async () => {
        loadMatchDetail.mockResolvedValue({ match: { id: 'm1' }, events: [] });
        const res = await call();
        expect(res.status).toBe(200);
        expect(loadMatchDetail).toHaveBeenCalledWith('m1', false);
        const cc = res.headers.get('cache-control') ?? '';
        expect(cc).toContain('public');
        const sMax = Number(/s-maxage=(\d+)/.exec(cc)?.[1]);
        const swr = Number(/stale-while-revalidate=(\d+)/.exec(cc)?.[1]);
        expect(sMax).toBeLessThanOrEqual(2);
        expect(swr).toBeLessThanOrEqual(3);
        expect(await res.json()).toEqual({ match: { id: 'm1' }, events: [] });
    });

    it('does not cache a 404', async () => {
        loadMatchDetail.mockResolvedValue(null);
        const res = await call('nope');
        expect(res.status).toBe(404);
        expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('does not cache a server error and hides its detail', async () => {
        loadMatchDetail.mockRejectedValue(new Error('SQLITE_BUSY secret'));
        const res = await call();
        expect(res.status).toBe(500);
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(JSON.stringify(await res.json())).not.toContain('SQLITE');
    });

    it('does not cache a rate limited response', async () => {
        checkRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 7 });
        const res = await call();
        expect(res.status).toBe(429);
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(res.headers.get('retry-after')).toBe('7');
        expect(loadMatchDetail).not.toHaveBeenCalled();
    });
});
