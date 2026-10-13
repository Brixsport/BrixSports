import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { generateToken, normalizeUserRole } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { isFailureLimited, recordFailure, clearFailures, ipSubject, emailSubject } from '@/lib/rate-limit';
import { setAuthCookie } from '@/lib/auth-cookie';

// Only failed attempts count. Budgets are per client IP (generous, because many
// students share one campus NAT address) and per account (tighter, because that
// is the key a password-guessing attacker cannot rotate).
const IP_FAILURES = { max: 20, windowMs: 15 * 60 * 1000, distributed: true };
const EMAIL_FAILURES = { max: 10, windowMs: 60 * 60 * 1000, distributed: true };

// Valid bcrypt hash of a random string nobody knows. Compared against when the
// email does not exist so a missing account costs the same time as a wrong password.
const DUMMY_PASSWORD_HASH = '$2b$10$VHu2MSpXwJtMTk7dXew8Ku39Qlm2DSkSNtXFih6DDkfPHS/Xz/s.e';

const INVALID_CREDENTIALS = {
    error: 'Incorrect email or password. Please try again.',
    code: 'AUTH_INVALID_CREDENTIALS',
};

function tooManyAttempts(retryAfterSeconds: number | undefined) {
    return NextResponse.json(
        { error: 'Too many login attempts. Please try again shortly.', code: 'AUTH_RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds ?? 60) } }
    );
}

// POST /api/auth/login - Authenticate user
export async function POST(request: NextRequest) {
    try {
        const ipLimit = await isFailureLimited('login', ipSubject(request), IP_FAILURES);
        if (ipLimit.limited) return tooManyAttempts(ipLimit.retryAfterSeconds);

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

        const emailLimit = await isFailureLimited('login', emailSubject(email), EMAIL_FAILURES);
        if (emailLimit.limited) return tooManyAttempts(emailLimit.retryAfterSeconds);

        const recordLoginFailure = async () => {
            await recordFailure('login', ipSubject(request), IP_FAILURES);
            await recordFailure('login', emailSubject(email), EMAIL_FAILURES);
        };

        const userResult = await db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = ${email}`)
            .all();

        const user = userResult[0];

        if (!user) {
            await bcrypt.compare(String(password), DUMMY_PASSWORD_HASH);
            await recordLoginFailure();
            console.log('[Login] Failed login: no matching account');
            return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
        }

        // Check if user has a password (might be OAuth user)
        if (!user.password) {
            await recordLoginFailure();
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
        const isValidPassword = await bcrypt.compare(String(password), user.password);

        if (!isValidPassword) {
            await recordLoginFailure();
            console.log(`[Login] Invalid password for user: ${email}`);
            return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
        }

        await clearFailures('login', emailSubject(email), EMAIL_FAILURES);

        console.log(`[Login] Successful login for: ${email}`);
        
        // Generate JWT token
        const normalizedRole = normalizeUserRole(user.role);
        const token = generateToken(user.id, user.email, normalizedRole, user.tokenVersion);

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

        setAuthCookie(response, request, token);

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
