import { defineConfig } from 'vitest/config';
import path from 'path';

// Phase 2 (TESTING_STRATEGY_2026-09-18.md): pure-logic unit tests only.
// Zero DB, zero network -- safe to run on every commit, no .env.local needed.
// Integration tests against real staging live in vitest.integration.config.ts.
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'node',
        include: ['tests/unit/**/*.test.ts'],
        setupFiles: ['tests/unit/setup.ts'],
        testTimeout: 5000,
    },
});
