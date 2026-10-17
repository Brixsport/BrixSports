import { defineConfig } from 'vitest/config';
import path from 'path';

// Phase 3 (TESTING_STRATEGY_2026-09-18.md): API integration tests against the
// real STAGING Turso DB, over real HTTP to a deployed environment
// (API_BASE_URL env var, defaults to staging.brixsports.com -- see
// tests/integration/helpers.ts; named API_BASE_URL rather than BASE_URL
// specifically to avoid colliding with Vite/Vitest's own reserved BASE_URL).
// Requires .env.local (TURSO_CONNECTION_URL, TURSO_AUTH_TOKEN, JWT_SECRET) --
// per this project's own convention, .env.local points at staging, never prod.
// Not run on every commit -- `npm run test:integration`, manually or pre-promotion.
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'node',
        include: ['tests/integration/**/*.test.ts'],
        setupFiles: ['tests/integration/setup.ts'],
        testTimeout: 20_000,
        hookTimeout: 20_000,
        // Real DB rows are shared, throwaway state -- concurrent test files
        // stepping on each other's cleanup is a worse failure mode than a
        // slower serial run for a solo-dev suite this size.
        fileParallelism: false,
    },
});
