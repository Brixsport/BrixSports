import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

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

        // Get user from database
        const user = await db.query.users.findFirst({
            where: eq(users.id, payload.userId as string),
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Generate new token with extended expiry
        const newToken = await new SignJWT({
            userId: user.id,
            email: user.email,
            role: user.role
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d') // 7 days
            .sign(JWT_SECRET);

        // Create response
        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
            },
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
