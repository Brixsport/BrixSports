import * as Sentry from '@sentry/nextjs';

// BACKLOG-469 item 2: warn mode. Env problems are logged and reported to
// Sentry but NEVER rethrown -- a missing optional var must not crash a
// production cold start. Variable names only, never values.
async function checkEnvWarnOnly() {
  try {
    const { validateEnv, validateProductionEnv } = await import('./lib/env');

    try {
      validateEnv();
    } catch (error) {
      console.error('[env] startup validation failed:', error instanceof Error ? error.message : error);
      Sentry.captureException(error);
    }

    const missingInProduction = validateProductionEnv();
    if (missingInProduction.length > 0) {
      const message = `[env] production environment is missing: ${missingInProduction.join(', ')}`;
      console.error(message);
      Sentry.captureMessage(message, 'error');
    }
  } catch (error) {
    console.error('[env] startup validation could not run:', error instanceof Error ? error.message : error);
    Sentry.captureException(error);
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');

    // Skipped during `next build` (page-data collection loads this module
    // too) so build logs/Sentry are not spammed with runtime-only env names.
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      await checkEnvWarnOnly();
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// Automatically captures unhandled server-side request errors (route handlers,
// server actions, server components) — requires @sentry/nextjs >= 8.28.0.
export const onRequestError = Sentry.captureRequestError;
