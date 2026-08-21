import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loggers, matches } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getLoggerMatches } from '@/lib/match-logger-helpers';
import { env } from '@/lib/env';

// In-memory rate limit — resets on Vercel cold start.
// Acceptable for MVP; replace with Redis/Upstash for full prod hardening (BUG-053).
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}

// POST /api/loggers/auth - Authenticate a logger
export async function POST(request: NextRequest) {
    try {
        const ip = getClientIp(request);
        const now = Date.now();
        const attempt = loginAttempts.get(ip);

        if (attempt && now < attempt.resetAt && attempt.count >= RATE_LIMIT_MAX) {
            return NextResponse.json(
                { error: 'Too many login attempts. Try again in 15 minutes.' },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { email, password } = body; // 'email' here contains the input (username or email)

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Identifier and password are required' },
                { status: 400 }
            );
        }

        // Find logger by email OR name
        const logger = await db
            .select()
            .from(loggers)
            .where(or(eq(loggers.email, email), eq(loggers.name, email)))
            .limit(1);

        if (logger.length === 0) {
            const cur = loginAttempts.get(ip);
            loginAttempts.set(ip, {
                count: (cur && now < cur.resetAt ? cur.count : 0) + 1,
                resetAt: cur && now < cur.resetAt ? cur.resetAt : now + RATE_LIMIT_WINDOW_MS,
            });
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Check password using bcrypt
        const isPasswordValid = await bcrypt.compare(password, logger[0].password || '');
        if (!isPasswordValid) {
            const cur = loginAttempts.get(ip);
            loginAttempts.set(ip, {
                count: (cur && now < cur.resetAt ? cur.count : 0) + 1,
                resetAt: cur && now < cur.resetAt ? cur.resetAt : now + RATE_LIMIT_WINDOW_MS,
            });
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Successful login — clear rate limit entry for this IP
        loginAttempts.delete(ip);

        // Get assigned matches using the new multi-logger helper
        const assignedMatches = await getLoggerMatches(logger[0].id);

        // Generate JWT token
        if (!env.jwtSecret) {
            return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
        }
        const token = jwt.sign(
            {
                id: logger[0].id,
                email: logger[0].email,
                role: logger[0].role,
            },
            env.jwtSecret,
            { expiresIn: '7d' }
        );

        const response = NextResponse.json({
            logger: {
                id: logger[0].id,
                name: logger[0].name,
                email: logger[0].email,
                role: logger[0].role,
            },
            assignedMatches,
            token,
        });

        // Set authToken cookie so getAuthUser() can authenticate logger API requests
        response.cookies.set('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60, // 7 days — matches JWT expiry
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Error authenticating logger:', error);
        return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 500 }
        );
    }
}
