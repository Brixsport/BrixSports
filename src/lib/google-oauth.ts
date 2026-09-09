import { env } from '@/lib/env';

// Shared by both the initiate route (src/app/api/auth/google/route.ts) and
// the callback route (src/app/api/auth/callback/google/route.ts) -- Google
// requires the redirect_uri sent at each step to match byte-for-byte, so
// this must be the one place that builds it, not two copies that can drift.
// Live-confirmed on staging that env.appUrl (NEXT_PUBLIC_APP_URL) carries a
// trailing slash there -- an un-normalized `${appUrl}/api/...` produced a
// real "vercel.app//api/..." double slash and a genuine redirect_uri_mismatch
// from Google, independent of the path itself being correct.
export function getGoogleRedirectUri(fallbackOrigin: string): string {
    const base = (env.appUrl || fallbackOrigin).replace(/\/+$/, '');
    return `${base}/api/auth/callback/google`;
}
