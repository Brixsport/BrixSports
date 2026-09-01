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
    //   /api/auth/*         — login endpoints must remain accessible
    //   /login              — the login page itself (avoids redirect loop)
    //   /_next/*            — Next.js internals (handled by matcher exclusion)
    //   /api/reminders/check — cron-authenticated (Bearer CRON_SECRET, checked
    //     by the route itself), never carries a session cookie. Missing this
    //     exemption meant Railway's real 5-minute reminder poller had been
    //     silently redirected to /login on every single call since this
    //     feature shipped -- confirmed live via Railway's own deploy logs
    //     repeatedly showing "Unexpected end of JSON input" (a redirect
    //     response, not the expected JSON), and zero match_reminders rows
    //     ever marked notification_sent across the DB's entire history.
    //     Any future CRON_SECRET-authenticated route needs the same exemption.
    if (env.isStaging) {
        const isStagingExempt =
            pathname.startsWith('/api/auth/') ||
            pathname.startsWith('/api/loggers/auth') ||
            pathname === '/login' ||
            pathname === '/logger' ||
            pathname === '/api/reminders/check' ||
            // Sentry tunnel (next.config.ts withSentryConfig tunnelRoute) — carries
            // client error/replay events from anonymous public viewers too; a redirect
            // here silently drops those events before they reach Sentry.
            pathname === '/monitoring';

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
        // BACKLOG-223: this only checked the cookie, while every /api/admin/*
        // route handler's own getAuthUser() (src/lib/auth.ts) accepts a Bearer
        // token first and falls back to the cookie -- a valid Bearer-only request
        // got a false 401 here before the route handler (which would have
        // accepted it) ever ran. Same precedence as getAuthUser() now. Confirmed
        // live, session 53: an existing, unmodified admin route rejected a real
        // admin JWT sent as Bearer, accepted the identical token as a cookie.
        const authHeader = request.headers.get('authorization');
        const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const token = bearerToken || request.cookies.get('authToken')?.value;

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

            // logger_manager's only real surface is /admin/manager (see
            // src/app/admin/manager/page.tsx) -- it fetches /api/matches and
            // /api/loggers, both gated separately and never under /api/admin/*.
            // Previously this check let logger_manager through the ENTIRE
            // /admin/** and /api/admin/** tree, not just its own page.
            const isAdmin = payload.role === 'admin';
            const isScopedLoggerManager =
                payload.role === 'logger_manager' &&
                (pathname === '/admin/manager' || pathname.startsWith('/admin/manager/'));

            // BACKLOG-306 follow-up: a real logger's dashboard (src/app/logger/
            // page.tsx) links "Adjust Ratings" to /admin/match-ratings/[id] --
            // that page, and all 3 API routes it calls
            // (matches/[id]/ratings/route.ts, .../adjust, .../initialize),
            // already explicitly check for `role === 'admin' || role === 'logger'`.
            // This blanket /admin/** gate never got the matching carve-out, so a
            // real logger clicking that link was silently redirected to `/`
            // before the page (or its already-permissive API calls) ever ran --
            // same shape as the logger_manager gap this file already fixed once.
            const isScopedRatingsLogger =
                payload.role === 'logger' &&
                (pathname === '/admin/match-ratings' || pathname.startsWith('/admin/match-ratings/'));

            if (!isAdmin && !isScopedLoggerManager && !isScopedRatingsLogger) {
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

    // BACKLOG-317: admin/layout.tsx runs its own independent server-side auth
    // check (defense-in-depth, CLAUDE.md's own rule -- middleware is a first
    // layer only) and has no way to know the current pathname on its own
    // (App Router layouts don't receive it as a prop). Thread it through via
    // header so that layout can apply the same scoped logger carve-out this
    // file just gained, instead of only ever allowing admin/logger_manager.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-pathname', pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
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
