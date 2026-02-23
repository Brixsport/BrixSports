import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/lib/auth';

// POST /api/auth/register - Register new user
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, name, role = 'user' } = body;

        // Validate input
        if (!email || !password || !name) {
            return NextResponse.json(
                {
                    error: 'Email, password, and name are required',
                    code: 'AUTH_MISSING_CREDENTIALS'
                },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                {
                    error: 'Invalid email format',
                    code: 'AUTH_INVALID_EMAIL'
                },
                { status: 400 }
            );
        }

        // Validate password strength
        if (password.length < 6) {
            return NextResponse.json(
                {
                    error: 'Password must be at least 6 characters',
                    code: 'AUTH_WEAK_PASSWORD'
                },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .get();

        if (existingUser) {
            return NextResponse.json(
                {
                    error: 'User with this email already exists',
                    code: 'AUTH_USER_EXISTS'
                },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const userId = nanoid();
        const newUser = {
            id: userId,
            email: email.toLowerCase(),
            password: hashedPassword,
            name,
            role,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.insert(users).values(newUser);

        // Generate JWT token
        const token = generateToken(userId, email.toLowerCase(), role);

        const response = NextResponse.json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: userId,
                email: email.toLowerCase(),
                name,
                role,
            },
            token,
        }, { status: 201 });

        // Set auth token in cookie (same as login)
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
        console.error('Registration error:', error);
        return NextResponse.json(
            {
                error: 'Registration failed. Please try again.',
                code: 'AUTH_INTERNAL_ERROR'
            },
            { status: 500 }
        );
    }
}
