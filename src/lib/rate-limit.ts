import { NextRequest } from 'next/server';

/**
 * In-memory, per-IP fixed-window rate limiter for public GET endpoints.
 * Same tradeoff as loggers/auth/route.ts's own rate limit (BUG-053).
 *
 * WEAKER IN PRACTICE THAN IT LOOKS -- confirmed empirically, not just a
 * theoretical caveat (session 53, 2026-08-20): a clean sequential test
 * against a route Vercel had already scaled to multiple warm instances (from
 * an earlier burst test) got load-balanced across that whole warm pool --
 * each instance keeps its own separate `buckets` Map, so no single instance's
 * counter ever approached the limit, and 70 sequential requests against a
 * 60/min ceiling all returned 200. The identical BUG-053 pattern DID
 * correctly 429 in the same session, but only on a route that hadn't been
 * burst-tested yet and so had very few warm instances. In other words: this
 * degrades exactly under the burst/scale traffic pattern it exists to catch,
 * not just on a cold start. It still raises the bar against a naive
 * single-connection scraper, but do not treat it as real protection against
 * a parallel-capable attacker or a real traffic spike -- that needs a shared
 * external store (Redis/Upstash), not module-level memory.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_MAX = 120;
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute

// Vercel's edge network always overwrites client-supplied x-forwarded-for before this
// runs, so this is not client-spoofable on this deployment target. If ever deployed
// behind a different proxy/CDN or directly on bare Node, this assumption breaks and
// the limiter becomes trivially bypassable per-request (attacker sets their own XFF).
export function getClientIp(request: NextRequest | Request): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}

export interface RateLimitResult {
    limited: boolean;
    retryAfterSeconds?: number;
}

export function checkRateLimit(
    request: NextRequest | Request,
    opts?: { max?: number; windowMs?: number }
): RateLimitResult {
    const max = opts?.max ?? DEFAULT_MAX;
    const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
    const ip = getClientIp(request);
    const now = Date.now();

    const cur = buckets.get(ip);
    if (cur && now < cur.resetAt) {
        if (cur.count >= max) {
            return { limited: true, retryAfterSeconds: Math.ceil((cur.resetAt - now) / 1000) };
        }
        cur.count += 1;
        return { limited: false };
    }

    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return { limited: false };
}
