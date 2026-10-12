import { describe, it, expect } from 'vitest';
import { findProductionEnvProblems, isProductionLikeEnv } from '@/lib/env';

const complete = {
    NEXT_PUBLIC_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://example.com',
    NEXT_PUBLIC_WS_URL: 'https://ws.example.com',
    WS_SERVER_URL: 'https://ws.example.com',
    WS_API_KEY: 'k',
    VAPID_PRIVATE_KEY: 'k',
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'k',
    CRON_SECRET: 'k',
    JWT_SECRET: 'k',
    NEXTAUTH_SECRET: 'k',
    COOKIE_DOMAIN: 'example.com',
    CLOUDINARY_CLOUD_NAME: 'c',
    CLOUDINARY_API_KEY: 'k',
    CLOUDINARY_API_SECRET: 'k',
    SENTRY_DSN: 'https://key@o0.ingest.sentry.io/1',
    EMAIL_PASS: 'p',
};

describe('isProductionLikeEnv', () => {
    it('is true for NEXT_PUBLIC_ENV=production or VERCEL_ENV=production', () => {
        expect(isProductionLikeEnv({ NEXT_PUBLIC_ENV: 'production' })).toBe(true);
        expect(isProductionLikeEnv({ VERCEL_ENV: 'production' })).toBe(true);
    });

    it('is false for development, staging and preview', () => {
        expect(isProductionLikeEnv({})).toBe(false);
        expect(isProductionLikeEnv({ NEXT_PUBLIC_ENV: 'staging', VERCEL_ENV: 'preview' })).toBe(false);
    });
});

describe('findProductionEnvProblems', () => {
    it('returns nothing outside production-style deployments', () => {
        expect(findProductionEnvProblems({})).toEqual([]);
        expect(findProductionEnvProblems({ NEXT_PUBLIC_ENV: 'staging' })).toEqual([]);
    });

    it('returns nothing when everything is set', () => {
        expect(findProductionEnvProblems(complete)).toEqual([]);
    });

    it('runs when only VERCEL_ENV is production', () => {
        const problems = findProductionEnvProblems({ VERCEL_ENV: 'production' });
        expect(problems).toContain('CRON_SECRET');
        expect(problems).toContain('CLOUDINARY_API_SECRET');
        expect(problems).toContain('NEXTAUTH_SECRET');
        expect(problems).toContain('COOKIE_DOMAIN');
    });

    it('reports each missing variable by name and treats blank as missing', () => {
        const problems = findProductionEnvProblems({ ...complete, WS_API_KEY: '   ', CRON_SECRET: undefined });
        expect(problems).toEqual(['WS_API_KEY', 'CRON_SECRET']);
    });

    it('rejects a trailing slash on NEXT_PUBLIC_APP_URL', () => {
        expect(findProductionEnvProblems({ ...complete, NEXT_PUBLIC_APP_URL: 'https://example.com/' })).toEqual([
            'NEXT_PUBLIC_APP_URL (must not end with a slash)',
        ]);
    });

    it('accepts either Sentry DSN', () => {
        const { SENTRY_DSN: _dsn, ...rest } = complete;
        expect(findProductionEnvProblems({ ...rest, NEXT_PUBLIC_SENTRY_DSN: 'https://key@o0.ingest.sentry.io/1' })).toEqual([]);
        expect(findProductionEnvProblems(rest)).toEqual(['SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN']);
    });

    it('needs one complete email provider', () => {
        const { EMAIL_PASS: _pass, ...rest } = complete;
        const message = 'EMAIL_PASS or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY';
        expect(findProductionEnvProblems(rest)).toEqual([message]);
        expect(findProductionEnvProblems({ ...rest, AWS_ACCESS_KEY_ID: 'a' })).toEqual([message]);
        expect(findProductionEnvProblems({ ...rest, AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 's' })).toEqual([]);
    });

    it('never includes variable values in its output', () => {
        const problems = findProductionEnvProblems({ ...complete, JWT_SECRET: '', NEXT_PUBLIC_APP_URL: 'https://secret-host.test/' });
        expect(problems.join(' ')).not.toContain('secret-host');
    });
});
