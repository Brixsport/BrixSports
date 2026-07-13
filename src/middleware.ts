import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { env } from '@/lib/env';

if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
}
const JWT_SECRET = new TextEncoder().encode(env.jwtSecret);

async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload;
    } catch {
        return null;
    }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ── Staging-wide auth gate ─────────────────────────────────────────────
    // When NEXT_PUBLIC_ENV === 'staging', every route requires a valid JWT
    // session. This keeps the staging deployment private from the public
    // while still being fully functional for internal testing.
    //
    // Exceptions:
    //   /api/auth/*  — login endpoints must remain accessible
    //   /login       — the login page itself (avoids redirect loop)
    //   /_next/*     — Next.js internals (handled by matcher exclusion)
    if (env.isStaging) {
        const isStagingExempt =
            pathname.startsWith('/api/auth/') ||
            pathname.startsWith('/api/loggers/auth') ||
            pathname === '/login' ||
            pathname === '/logger';

        if (!isStagingExempt) {
            const token = request.cookies.get('authToken')?.value;
            if (!token) {
                return NextResponse.redirect(new URL('/login', request.url));
            }
            const payload = await verifyToken(token);
            if (!payload) {
                return NextResponse.redirect(new URL('/login', request.url));
            }
        }
    }

    // ── Admin route protection (all environments) ──────────────────────────
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        const token = request.cookies.get('authToken')?.value;

        if (!token) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const url = new URL('/login', request.url);
            url.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(url);
        }

        try {
            const { payload } = await jwtVerify(token, JWT_SECRET);

            if (payload.role !== 'admin' && payload.role !== 'logger_manager') {
                if (pathname.startsWith('/api/')) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                return NextResponse.redirect(new URL('/', request.url));
            }
        } catch {
            // Token invalid or expired
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const url = new URL('/login', request.url);
            url.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // Admin routes — always protected regardless of environment
        '/admin/:path*',
        '/api/admin/:path*',
        // All other routes — staging gate applies when NEXT_PUBLIC_ENV === 'staging'
        // Excludes Next.js static internals to avoid intercepting asset requests
        '/((?!_next/static|_next/image|favicon\\.ico).*)',
    ],
};
