/**
 * Daily counters (table `metrics_daily`).
 *
 * - incrMetric: low-volume product events, upserted straight to the database.
 * - incrAbuseMetric: high-frequency or attacker-driven events (failed logins,
 *   rate-limit trips). Counted in Redis only, so an attack cannot turn into a
 *   database write per request. Falls back to a no-op when Redis is not set.
 *
 * Both are best-effort: they never throw and never block the caller's result.
 */

import { Redis } from '@upstash/redis';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { metricsDaily } from '@/db/schema';
import { env } from '@/lib/env';

export type DbMetric = 'signup' | 'login_ok' | 'push_subscribe' | 'cron_heartbeat';
export type AbuseMetric = 'login_fail' | 'ratelimit_trip';

const ABUSE_TTL_SECONDS = 8 * 24 * 60 * 60;

const redis =
    env.upstashRedisUrl && env.upstashRedisToken
        ? new Redis({ url: env.upstashRedisUrl, token: env.upstashRedisToken })
        : null;

export function lagosDay(date: Date = new Date()): string {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(date);
}

export async function incrMetric(metric: DbMetric, dimension = '', by = 1): Promise<void> {
    try {
        await db
            .insert(metricsDaily)
            .values({ day: lagosDay(), metric, dimension, value: by })
            .onConflictDoUpdate({
                target: [metricsDaily.day, metricsDaily.metric, metricsDaily.dimension],
                set: { value: sql`${metricsDaily.value} + ${by}` },
            });
    } catch (err) {
        console.error('[metrics] incrMetric failed:', metric, err);
    }
}

export async function incrAbuseMetric(metric: AbuseMetric, dimension = ''): Promise<void> {
    if (!redis) return;
    try {
        const key = `m:${lagosDay()}:${metric}:${dimension}`;
        await redis.incr(key);
        await redis.expire(key, ABUSE_TTL_SECONDS);
    } catch (err) {
        console.error('[metrics] incrAbuseMetric failed:', metric, err);
    }
}
