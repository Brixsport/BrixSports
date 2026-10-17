import { describe, it, expect } from 'vitest';
import {
    authSetCookieHeader,
    authClearCookieHeaders,
    serializeCookie,
    AUTH_COOKIE_MAX_AGE_SECONDS,
} from '@/lib/auth-cookie';

describe('auth cookie helpers', () => {
    it('sets the session cookie with httpOnly, lax, path and the 7 day lifetime', () => {
        const header = authSetCookieHeader('tok.en', { secure: true });
        expect(header).toContain('authToken=tok.en');
        expect(header).toContain('Path=/');
        expect(header).toContain(`Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}`);
        expect(header).toContain('HttpOnly');
        expect(header).toContain('Secure');
        expect(header).toContain('SameSite=Lax');
        expect(header).not.toContain('Domain=');
    });

    it('includes the Domain only when one is given', () => {
        expect(authSetCookieHeader('t', { secure: false, domain: 'brixsports.com' })).toContain(
            'Domain=brixsports.com'
        );
        expect(authSetCookieHeader('t', { secure: false })).not.toContain('Secure');
    });

    it('clears both the domain-scoped and the host-only variant when a domain is configured', () => {
        const headers = authClearCookieHeaders({ secure: true, domain: 'brixsports.com' });
        expect(headers).toHaveLength(2);
        expect(headers.every((h) => h.includes('Max-Age=0') && h.startsWith('authToken=;'))).toBe(true);
        expect(headers.some((h) => h.includes('Domain=brixsports.com'))).toBe(true);
        expect(headers.some((h) => !h.includes('Domain='))).toBe(true);
    });

    it('clears only the host-only cookie when no domain is configured', () => {
        const headers = authClearCookieHeaders({ secure: false });
        expect(headers).toHaveLength(1);
        expect(headers[0]).not.toContain('Domain=');
    });

    it('can omit HttpOnly for cookies the client script must read', () => {
        expect(serializeCookie('x', 'y', { maxAge: 60, secure: false, httpOnly: false })).not.toContain('HttpOnly');
    });
});
