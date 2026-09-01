import { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';

/**
 * Per-IP rate limiter. Upstash-backed (shared across all instances) when
 * UPSTASH_REDIS_REST_URL/_TOKEN are set (BACKLOG-080); falls back to an
 * in-memory, per-instance Map otherwise (local dev, or if Upstash errors).
 *
 * The in-memory fallback has the same known weakness the old pure-Map
 * implementation always had: each warm Vercel instance keeps its own Map,
 * so it under-counts against a burst spread across multiple instances
 * (confirmed session 53, 2026-08-20). That's why Upstash is the real fix —
 * the fallback exists only so local dev and a Redis outage don't hard-fail.
 */

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

const DEFAULT_MAX = 120;
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute

const redis =
    env.upstashRedisUrl && env.upstashRedisToken
        ? new Redis({ url: env.upstashRedisUrl, token: env.upstashRedisToken })
        : null;

// One Ratelimit instance per distinct (max, windowMs) pair, since the SDK bakes
// the algorithm's config into the instance rather than accepting it per call.
const limiters = new Map<string, Ratelimit>();

function getLimiter(max: number, windowMs: number): Ratelimit {
    const key = `${max}:${windowMs}`;
    let limiter = limiters.get(key);
    if (!limiter) {
        limiter = new Ratelimit({
            redis: redis!,
            limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
            prefix: 'brixsports-rl',
        });
        limiters.set(key, limiter);
    }
    return limiter;
}

// Route path, not just ip+config -- two DIFFERENT routes calling this with the
// same (max, windowMs) shape (e.g. login and forgot-password both 5/15min)
// would otherwise share one counter. Confirmed live on staging 2026-09-01:
// exhausting login's budget also 429'd forgot-password, which nothing had
// even called yet, before this was added.
function getPathname(request: NextRequest | Request): string {
    try {
        return new URL(request.url).pathname;
    } catch {
        return 'unknown-path';
    }
}

// Keyed by path + ip + the specific (max, windowMs) config, not just ip --
// otherwise two routes with different limits calling this on the same
// visitor IP would share one counter (the original in-memory-only version
// had this bug).
const buckets = new Map<string, { count: number; resetAt: number }>();

function checkInMemory(bucketKey: string, max: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const cur = buckets.get(bucketKey);
    if (cur && now < cur.resetAt) {
        if (cur.count >= max) {
            return { limited: true, retryAfterSeconds: Math.ceil((cur.resetAt - now) / 1000) };
        }
        cur.count += 1;
        return { limited: false };
    }
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { limited: false };
}

export async function checkRateLimit(
    request: NextRequest | Request,
    opts?: { max?: number; windowMs?: number }
): Promise<RateLimitResult> {
    const max = opts?.max ?? DEFAULT_MAX;
    const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
    const ip = getClientIp(request);
    // Method too, not just path -- forgot-password's POST (request reset) and
    // PATCH (apply reset) share a path but are distinct actions; sharing a
    // budget would let requesting a reset burn the attempts needed to apply it.
    const bucketKey = `${request.method}:${getPathname(request)}:${ip}:${max}:${windowMs}`;

    if (!redis) {
        return checkInMemory(bucketKey, max, windowMs);
    }

    try {
        const result = await getLimiter(max, windowMs).limit(bucketKey);
        if (!result.success) {
            const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
            return { limited: true, retryAfterSeconds };
        }
        return { limited: false };
    } catch (err) {
        // Redis unreachable -- fail open to the in-memory limiter rather than
        // blocking every request or letting every request through unchecked.
        console.error('[rate-limit] Upstash error, falling back to in-memory:', err);
        return checkInMemory(bucketKey, max, windowMs);
    }
}
