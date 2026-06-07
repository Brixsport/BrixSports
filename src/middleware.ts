import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Protect /admin UI routes and /api/admin/* API routes
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
            // Verify JWT signature using jose (Edge-compatible)
            const secret = new TextEncoder().encode(
                process.env.JWT_SECRET || 'your-secret-key-change-in-production'
            );

            const { payload } = await jwtVerify(token, secret);

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
    matcher: ['/admin/:path*', '/api/admin/:path*'],
};
