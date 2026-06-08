import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? 'production',

  // Traces — 10% in production, 100% locally for debugging
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  debug: false,
});
