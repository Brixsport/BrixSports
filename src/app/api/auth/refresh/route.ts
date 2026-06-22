import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, loggers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
}
const JWT_SECRET = new TextEncoder().encode(env.jwtSecret);

// POST /api/auth/refresh - Refresh user session
export async function POST(request: NextRequest) {
    try {
        // Get token from cookie
        const token = request.cookies.get('authToken')?.value;

        if (!token) {
            return NextResponse.json(
                { error: 'No token provided' },
                { status: 401 }
            );
        }

        // Verify existing token
        let payload;
        try {
            const verified = await jwtVerify(token, JWT_SECRET);
            payload = verified.payload;
        } catch (error) {
            return NextResponse.json(
                { error: 'Invalid or expired token' },
                { status: 401 }
            );
        }

        // Logger JWTs use { id } not { userId } — normalise before DB lookup
        const actorId = (payload.userId ?? payload.id) as string | undefined;
        const actorRole = payload.role as string | undefined;

        if (!actorId) {
            return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
        }

        let newToken: string;
        let responseUser: Record<string, unknown>;

        if (actorRole === 'logger') {
            const logger = await db.query.loggers.findFirst({
                where: eq(loggers.id, actorId),
            });
            if (!logger) {
                return NextResponse.json({ error: 'Logger not found' }, { status: 404 });
            }
            // Logger tokens use { id } to match what /api/loggers/auth signs
            newToken = await new SignJWT({ id: logger.id, email: logger.email, role: logger.role })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('7d')
                .sign(JWT_SECRET);
            responseUser = { id: logger.id, name: logger.name, email: logger.email, role: logger.role };
        } else {
            const user = await db.query.users.findFirst({
                where: eq(users.id, actorId),
            });
            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
            newToken = await new SignJWT({ userId: user.id, email: user.email, role: user.role })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('7d')
                .sign(JWT_SECRET);
            responseUser = { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role };
        }

        // Create response — include token in body so logger pages can store in localStorage
        const response = NextResponse.json({
            success: true,
            token: newToken,
            user: responseUser,
        });

        // Set new token in cookie
        response.cookies.set('authToken', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Session refresh error:', error);
        return NextResponse.json(
            { error: 'Session refresh failed' },
            { status: 500 }
        );
    }
}
