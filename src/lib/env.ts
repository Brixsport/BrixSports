/**
 * Centralised environment variable access.
 *
 * Rules:
 * - Never read process.env directly in application code.
 * - Always import from this file.
 * - Add new env vars here first, then document in .env.example.
 *
 * This file is the single source of truth for env config.
 * Full Zod validation is deferred to TD-001 once all 29 vars
 * are mapped — for now we use explicit reads with typed fallbacks.
 *
 * See also: TD-001 in BACKLOG.md
 */

export const env = {
    // Auth
    jwtSecret: process.env.JWT_SECRET ?? '',

    // Database
    tursoUrl: process.env.TURSO_CONNECTION_URL ?? '',
    tursoToken: process.env.TURSO_AUTH_TOKEN ?? '',

    // Application
    appEnv: (process.env.NEXT_PUBLIC_ENV ?? 'development') as
        'development' | 'staging' | 'production',
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? '',

    // Monitoring
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
    gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '',

    // Media
    cloudinaryCloud: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
    cloudinaryPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '',

    // Rate limiting (BACKLOG-080) — optional; absent in local dev, falls back
    // to the in-memory limiter. Not in validateEnv()'s required list on purpose.
    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL ?? '',
    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',

    // Convenience booleans
    isStaging: process.env.NEXT_PUBLIC_ENV === 'staging',
    isProduction: process.env.NEXT_PUBLIC_ENV === 'production',
    isDevelopment: process.env.NEXT_PUBLIC_ENV === 'development',
} as const;

/**
 * Call at application startup (e.g. in instrumentation.ts or a
 * server component root) to fail fast if required vars are absent.
 *
 * Does NOT run in Edge middleware — keep this server-only.
 */
export function validateEnv(): void {
    const required = [
        'JWT_SECRET',
        'TURSO_CONNECTION_URL',
        'TURSO_AUTH_TOKEN',
        'NEXT_PUBLIC_APP_URL',
    ] as const;

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            'Check .env.example for the full list of required vars.'
        );
    }
}
