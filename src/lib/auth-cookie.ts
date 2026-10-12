import type { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

// Single place that decides how the session cookie is written and cleared.
// Login, register, the Google callback, refresh and logger login must all use
// the same attributes (in particular the Domain), otherwise logout cannot clear
// what they set and the browser ends up holding two cookies with one name.

export const AUTH_COOKIE = 'authToken';
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // matches the 7 day JWT lifetime

export interface CookieAttributes {
    maxAge: number;
    secure: boolean;
    httpOnly?: boolean;
    domain?: string;
}

// Plain Set-Cookie serializer. NextResponse.cookies cannot hold two cookies with
// the same name (host-only and domain-scoped), so headers are written directly.
export function serializeCookie(name: string, value: string, attrs: CookieAttributes): string {
    const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', `Max-Age=${attrs.maxAge}`];
    if (attrs.domain) parts.push(`Domain=${attrs.domain}`);
    if (attrs.httpOnly !== false) parts.push('HttpOnly');
    if (attrs.secure) parts.push('Secure');
    parts.push('SameSite=Lax');
    return parts.join('; ');
}

// Set-Cookie header value that installs the session cookie. The host-only
// variant is deliberately NOT expired here: on the apex host a host-only and a
// domain cookie share one identity, so expiring the former would delete the
// cookie just set. Clearing both variants is logout's job.
export function authSetCookieHeader(token: string, opts: { secure: boolean; domain?: string }): string {
    return serializeCookie(AUTH_COOKIE, token, {
        maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
        secure: opts.secure,
        domain: opts.domain,
    });
}

// Set-Cookie header values that clear the session cookie: the domain-scoped
// variant (when configured) and the host-only variant.
export function authClearCookieHeaders(opts: { secure: boolean; domain?: string }): string[] {
    const headers = [serializeCookie(AUTH_COOKIE, '', { maxAge: 0, secure: opts.secure })];
    if (opts.domain) {
        headers.unshift(
            serializeCookie(AUTH_COOKIE, '', { maxAge: 0, secure: opts.secure, domain: opts.domain })
        );
    }
    return headers;
}

export function isSecureRequest(request: NextRequest | Request): boolean {
    return (
        request.headers.get('x-forwarded-proto') === 'https' ||
        request.url.startsWith('https://') ||
        env.isProdBuild
    );
}

// Domain is applied only in production builds, same as the original login route.
export function getCookieDomain(): string | undefined {
    return env.isProdBuild && env.cookieDomain ? env.cookieDomain : undefined;
}

export function setAuthCookie(response: NextResponse, request: NextRequest | Request, token: string): void {
    response.headers.append(
        'Set-Cookie',
        authSetCookieHeader(token, { secure: isSecureRequest(request), domain: getCookieDomain() })
    );
}

export function clearAuthCookie(response: NextResponse, request: NextRequest | Request): void {
    for (const header of authClearCookieHeaders({
        secure: isSecureRequest(request),
        domain: getCookieDomain(),
    })) {
        response.headers.append('Set-Cookie', header);
    }
}
