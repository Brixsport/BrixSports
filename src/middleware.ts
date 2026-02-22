import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Protect /admin routes
    if (pathname.startsWith('/admin')) {
        const token = request.cookies.get('authToken')?.value;

        // Log for debugging (remove in production)
        console.log('[Middleware] Admin route accessed:', pathname);
        console.log('[Middleware] Token present:', !!token);
        console.log('[Middleware] JWT_SECRET configured:', !!process.env.JWT_SECRET);

        if (!token) {
            console.log('[Middleware] No token found, redirecting to login');
            const url = new URL('/login', request.url);
            url.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(url);
        }

        try {
            // Verify JWT signature using jose (Edge-compatible)
            const secret = new TextEncoder().encode(
                process.env.JWT_SECRET || 'your-secret-key-change-in-production'
            );

            const { payload } = await jwtVerify(token, secret);
            console.log('[Middleware] Token verified, role:', payload.role);

            if (payload.role !== 'admin' && payload.role !== 'logger_manager') {
                console.log('[Middleware] User is not authorized for admin area, redirecting to home');
                return NextResponse.redirect(new URL('/', request.url));
            }

            console.log('[Middleware] Admin access granted');
        } catch (error) {
            // Token invalid or expired
            console.error('[Middleware] Token verification failed:', error);
            const url = new URL('/login', request.url);
            url.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/api/admin/:path*'],
};
