import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { generateToken, normalizeUserRole } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { sendWelcomeEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';

// POST /api/auth/register - Register new user
export async function POST(request: NextRequest) {
    try {
        // BACKLOG-080: prevents bulk/scripted account-creation spam.
        const rl = await checkRateLimit(request, { max: 5, windowMs: 15 * 60 * 1000, distributed: true });
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many attempts. Please try again shortly.', code: 'AUTH_RATE_LIMITED' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        const body = await request.json();
        let { email, password, name } = body;
        const role = normalizeUserRole('user');
        
        if (email) email = email.trim();
        if (password) password = password.trim();
        if (name) name = name.trim();

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
        const existingUserResult = await db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
            .all();

        const existingUser = existingUserResult[0];

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

        // Send welcome email (non-blocking - don't fail registration if email fails)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (request.headers.get('origin') || 'http://localhost:3000');
        try {
            const emailResult = await sendWelcomeEmail(email.toLowerCase(), name, baseUrl);
            if (emailResult.success) {
                console.log(`[Register] Welcome email sent to: ${email}`);
            } else {
                console.error(`[Register] Welcome email failed for ${email}:`, emailResult.error);
            }
        } catch (emailError) {
            console.error(`[Register] Exception sending welcome email to ${email}:`, emailError);
        }

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
