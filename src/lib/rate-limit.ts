import { NextRequest } from 'next/server';

/**
 * In-memory, per-IP fixed-window rate limiter for public GET endpoints.
 * Same tradeoff as loggers/auth/route.ts's own rate limit (BUG-053): resets on
 * Vercel cold start, not shared across instances -- acceptable for MVP, would
 * need Redis/Upstash for real distributed enforcement. Deliberately generous
 * (see DEFAULT_MAX below): this app's real audience shares campus WiFi NAT,
 * so many real students can share one public IP concurrently. The goal is
 * stopping obvious scraping/DoS, not throttling normal browsing.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_MAX = 120;
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute

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
