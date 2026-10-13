import { randomBytes, timingSafeEqual } from 'crypto';
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

export const OAUTH_STATE_COOKIE = 'oauth_state';
export const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

// One-time handoff of the session token to client script after a Google sign-in.
// Short-lived and readable by script on purpose: the server redirect can set the
// httpOnly session cookie but cannot write localStorage. AuthContext reads it
// once and deletes it.
export const OAUTH_HANDOFF_COOKIE = 'oauth_handoff';
export const OAUTH_HANDOFF_MAX_AGE_SECONDS = 60;

export function generateOAuthState(): string {
    return randomBytes(24).toString('hex');
}

// Constant-time comparison of the state returned by Google against the one the
// browser was given when the flow started. Both must be present.
export function oauthStatesMatch(fromQuery: string | null | undefined, fromCookie: string | null | undefined): boolean {
    if (!fromQuery || !fromCookie) return false;
    const a = Buffer.from(fromQuery);
    const b = Buffer.from(fromCookie);
    return a.length === b.length && timingSafeEqual(a, b);
}

// Registration does not verify email ownership, so anyone can pre-register a
// victim's address with a password they know. When a Google sign-in (which does
// prove ownership) lands on an existing account that has a password, that
// password must stop working before the account is merged, otherwise the
// pre-registrant keeps access. Accounts without a password are left alone, and
// so are accounts whose email is already verified (a password reset link or an
// earlier Google sign-in proved ownership, so that password belongs to the owner).
export function shouldDropPasswordOnGoogleMerge(
    existing: { password: string | null; emailVerified?: boolean | null } | undefined | null
): boolean {
    return !!existing && !!existing.password && !existing.emailVerified;
}
