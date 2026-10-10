import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { env } from '@/lib/env';

// BACKLOG-324: a server-issued, signed anonymous identity for public features
// that allow saving without login (e.g. the public lineup builder). Reuses
// the same jsonwebtoken/env.jwtSecret primitive as real auth (src/lib/auth.ts)
// but carries no role claim -- it identifies "this device's saves", nothing
// more. The client never sets or passes this id; it only ever round-trips an
// httpOnly cookie.

const COOKIE_NAME = 'anonId';
const TOKEN_TYPE = 'anon-xi';
// Long-lived by design -- this is a device identity, not a session.
const EXPIRES_IN = '365d';

interface AnonymousTokenPayload {
    sub: string;
    type: typeof TOKEN_TYPE;
}

function verifyAnonymousToken(token: string): string | null {
    try {
        const decoded = jwt.verify(token, env.jwtSecret) as AnonymousTokenPayload;
        if (decoded.type !== TOKEN_TYPE || !decoded.sub) return null;
        return decoded.sub;
    } catch {
        return null;
    }
}

/**
 * Reads the caller's anonymous id from their signed cookie, if present and valid.
 * Never creates one -- use getOrCreateAnonymousId when a new id may need issuing.
 */
export function readAnonymousId(request: NextRequest): string | null {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyAnonymousToken(token);
}

/**
 * Resolves the caller's anonymous id, minting and attaching a new signed
 * cookie to `response` if none exists yet or the existing one didn't verify.
 * Call this only on the response that will actually reach the browser.
 */
export function getOrCreateAnonymousId(request: NextRequest, response: NextResponse): string {
    const existing = readAnonymousId(request);
    if (existing) return existing;

    const anonId = randomUUID();
    const token = jwt.sign({ sub: anonId, type: TOKEN_TYPE }, env.jwtSecret, { expiresIn: EXPIRES_IN });

    response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
    });

    return anonId;
}
