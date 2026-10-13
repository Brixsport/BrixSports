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
    // Shared secret between this app and the standalone ws-server (server-side only).
    wsApiKey: process.env.WS_API_KEY ?? '',
    // Optional explicit ws-server room environment ('prod' | 'staging'); see src/lib/ws-env.ts.
    wsEnv: process.env.WS_ENV ?? '',

    // Monitoring
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
    gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '',

    // Media
    cloudinaryCloud: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
    cloudinaryPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '',

    // OAuth
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',

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

type EnvVars = Record<string, string | undefined>;

const PRODUCTION_REQUIRED_VARS = [
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_WS_URL',
    'WS_SERVER_URL',
    'WS_API_KEY',
    'VAPID_PRIVATE_KEY',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    'CRON_SECRET',
    'JWT_SECRET',
    'NEXTAUTH_SECRET',
    'COOKIE_DOMAIN',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
] as const;

function isSet(value: string | undefined): boolean {
    return typeof value === 'string' && value.trim() !== '';
}

/**
 * True when this deployment runs with production settings. Vercel reports
 * VERCEL_ENV === 'production' for any project's production environment, and
 * the staging project also deploys its branch as that environment, so this
 * is not proof of a real production deployment. Callers must only warn.
 */
export function isProductionLikeEnv(vars: EnvVars): boolean {
    return vars.NEXT_PUBLIC_ENV === 'production' || vars.VERCEL_ENV === 'production';
}

/**
 * Pure check behind validateProductionEnv(): given a set of variables, returns
 * the names (never values) that are unset or malformed for a production-style
 * deployment. Returns [] when the variables do not describe one.
 */
export function findProductionEnvProblems(vars: EnvVars): string[] {
    if (!isProductionLikeEnv(vars)) return [];

    const problems: string[] = PRODUCTION_REQUIRED_VARS.filter((key) => !isSet(vars[key]));

    if (isSet(vars.NEXT_PUBLIC_APP_URL) && vars.NEXT_PUBLIC_APP_URL!.trim().endsWith('/')) {
        problems.push('NEXT_PUBLIC_APP_URL (must not end with a slash)');
    }

    // Either DSN counts: the server/edge configs read SENTRY_DSN, the browser
    // config reads NEXT_PUBLIC_SENTRY_DSN.
    if (!isSet(vars.SENTRY_DSN) && !isSet(vars.NEXT_PUBLIC_SENTRY_DSN)) {
        problems.push('SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN');
    }

    // At least one email provider: AWS SES (both keys) or Gmail (EMAIL_PASS).
    const hasSes = isSet(vars.AWS_ACCESS_KEY_ID) && isSet(vars.AWS_SECRET_ACCESS_KEY);
    if (!hasSes && !isSet(vars.EMAIL_PASS)) {
        problems.push('EMAIL_PASS or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY');
    }

    return problems;
}

/**
 * Names of variables that should be set when this deployment runs with
 * production settings (NEXT_PUBLIC_ENV or VERCEL_ENV is 'production') but are
 * NOT hard-required by validateEnv(): a missing one degrades a feature, it must
 * never stop a cold start. The staging Vercel project also reports
 * VERCEL_ENV === 'production', so the caller must warn only and must not word
 * the message as a misconfiguration of a specific environment.
 *
 * Side-effect free on purpose (no Sentry import: this module is also imported
 * by client components). Returns variable NAMES only, never values. The caller
 * (src/instrumentation.ts) is responsible for logging and must not throw.
 */
export function validateProductionEnv(): string[] {
    return findProductionEnvProblems(process.env);
}
