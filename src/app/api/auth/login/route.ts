import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { generateToken, normalizeUserRole } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// POST /api/auth/login - Authenticate user
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        let { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                {
                    error: 'Email and password are required',
                    code: 'AUTH_MISSING_CREDENTIALS'
                },
                { status: 400 }
            );
        }

        // Find user by email (case-insensitive)
        email = email.trim().toLowerCase();
        const userResult = await db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = ${email}`)
            .all();

        const user = userResult[0];

        if (!user) {
            console.log(`[Login] User not found for email: ${email}`);
            return NextResponse.json(
                {
                    error: 'Email not found. Please check your email or sign up.',
                    code: 'AUTH_USER_NOT_FOUND'
                },
                { status: 401 }
            );
        }

        // Check if user has a password (might be OAuth user)
        if (!user.password) {
            console.log(`[Login] User ${email} has no password (likely OAuth)`);
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
            console.log(`[Login] Invalid password for user: ${email}`);
            return NextResponse.json(
                {
                    error: 'Incorrect password. Please try again.',
                    code: 'AUTH_WRONG_PASSWORD'
                },
                { status: 401 }
            );
        }

        console.log(`[Login] Successful login for: ${email}`);
        
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
        const isSecure = request.headers.get('x-forwarded-proto') === 'https' || 
                         request.url.startsWith('https://') || 
                         process.env.NODE_ENV === 'production';
        
        const cookieOptions: any = {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        };

        // In production, explicitly set domain for brixsports.com
        if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
            cookieOptions.domain = process.env.COOKIE_DOMAIN;
        }

        response.cookies.set('authToken', token, cookieOptions);
        console.log(`[Login] Cookie set with options:`, { secure: cookieOptions.secure, sameSite: cookieOptions.sameSite, path: cookieOptions.path });

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
