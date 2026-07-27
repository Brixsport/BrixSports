import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  async headers() {
    // BACKLOG-079: CSP is intentionally permissive on script/connect/img rather than
    // maximally strict — this app loads the Cloudinary upload widget (injects its own
    // script + iframe), an env-configured Railway WS endpoint (wss://*.up.railway.app,
    // staging vs prod both live), Google Fonts, and arbitrary remote image hosts
    // (next.config's images.remotePatterns is a wildcard hostname on purpose). A
    // stricter policy would need per-domain nonces/hashes and real live testing across
    // every role (viewer/logger/admin) before shipping — flagged, not attempted here.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://upload-widget.cloudinary.com https://*.cloudinary.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https://*.cloudinary.com",
      "media-src 'self' https:",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'", // matches X-Frame-Options: DENY below
    ].join('; ');

    return [
      {
        // Apply to all pages
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'all',
          },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Service worker files must never be cached by CDN or browser
        // Stale SW files prevent cache invalidation after deploys (BUG-026)
        source: '/sw:path*.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        // Specific headers for llms.txt files
        source: '/llms:suffix*.txt',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/plain; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
          {
            key: 'X-Robots-Tag',
            value: 'all',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organisation / project — set in CI env or Vercel project settings
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source map upload (set as SENTRY_AUTH_TOKEN in CI/Vercel)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppresses source map upload logs during local builds
  silent: !process.env.CI,

  // Upload source maps to Sentry for readable stack traces in production
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger in production builds
  disableLogger: true,

  // Tunnel Sentry requests through the app to avoid ad-blocker interference
  tunnelRoute: '/monitoring',
});
