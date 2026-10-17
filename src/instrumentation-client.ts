import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent } from './lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // BACKLOG-469 item 4: default to 'development', not 'production'. Only
  // NEXT_PUBLIC_* vars are inlined into the browser bundle, so SENTRY_ENVIRONMENT
  // (server-only) is deliberately not part of this chain.
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_ENV ||
    'development',

  // Replay 10% of sessions, 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Traces — 10% in production, 100% locally for debugging
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Scrub the ?oauth_token= session JWT (and token=/authorization values)
  // from URLs, headers, breadcrumbs and transaction/span names.
  beforeSend: (event) => scrubEvent(event),
  beforeSendTransaction: (event) => scrubEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),

  debug: false,

  integrations: [
    Sentry.replayIntegration(),
  ],
});

// Hook into App Router navigation transitions so client-side route changes
// produce tracing spans (this project already enables tracesSampleRate above).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
