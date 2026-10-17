import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent } from './src/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // BACKLOG-469 item 4: default to 'development', not 'production'.
  environment:
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_ENV ||
    'development',

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Scrub the ?oauth_token= session JWT (and token=/authorization values)
  // from URLs, headers, breadcrumbs and transaction/span names.
  beforeSend: (event) => scrubEvent(event),
  beforeSendTransaction: (event) => scrubEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),

  debug: false,
});
