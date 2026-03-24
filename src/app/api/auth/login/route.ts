import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { generateToken, normalizeUserRole } from '@/lib/auth';

// POST /api/auth/login - Authenticate user
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                {
                    error: 'Email and password are required',
                    code: 'AUTH_MISSING_CREDENTIALS'
                },
                { status: 400 }
            );
        }

        // Find user by email
        const user = await db
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .get();

        if (!user) {
            return NextResponse.json(
                {
                    error: 'Invalid email or password',
                    code: 'AUTH_INVALID_CREDENTIALS'
                },
                { status: 401 }
            );
        }

        // Check if user has a password (might be OAuth user)
        if (!user.password) {
            return NextResponse.json(
                {
                    error: 'Please use social login for this account',
                    code: 'AUTH_SOCIAL_LOGIN_REQUIRED'
                },
                { status: 401 }
            );
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return NextResponse.json(
                {
                    error: 'Invalid email or password',
                    code: 'AUTH_INVALID_CREDENTIALS'
                },
                { status: 401 }
            );
        }

        // Generate JWT token
        const normalizedRole = normalizeUserRole(user.role);
        const token = generateToken(user.id, user.email, normalizedRole);

        const response = NextResponse.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: normalizedRole,
                avatar: user.avatar,
                bio: user.bio,
                favoriteTeamId: user.favoriteTeamId,
            },
            token,
        });

        // Set auth token in cookie
        // For production on brixsports.com, ensure cookie works across the domain
        const cookieOptions: any = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        };

        // In production, explicitly set domain for brixsports.com
        if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
            cookieOptions.domain = process.env.COOKIE_DOMAIN;
        }

        response.cookies.set('authToken', token, cookieOptions);

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            {
                error: 'Login failed. Please try again.',
                code: 'AUTH_INTERNAL_ERROR'
            },
            { status: 500 }
        );
    }
}
