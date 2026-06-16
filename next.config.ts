import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from '@sentry/nextjs';

const LOADER = path.resolve(__dirname, 'src/visual-edits/component-tagger-loader.js');

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
  turbopack: {
    rules: {
      "*.{jsx,tsx}": {
        loaders: [LOADER]
      }
    }
  },

  async headers() {
    return [
      {
        // Apply to all pages
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'all',
          },
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
