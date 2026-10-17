import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loggers, matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getLoggerMatches } from '@/lib/match-logger-helpers';
import { env } from '@/lib/env';
import { isFailureLimited, recordFailure, clearFailures, ipSubject, emailSubject } from '@/lib/rate-limit';
import { setAuthCookie } from '@/lib/auth-cookie';
import { isLoggerStatusActive, pickLoggerCandidate } from '@/lib/logger-login';

// Valid bcrypt hash of a random string nobody knows; see the user login route.
const DUMMY_PASSWORD_HASH = '$2b$10$VHu2MSpXwJtMTk7dXew8Ku39Qlm2DSkSNtXFih6DDkfPHS/Xz/s.e';

// Only failed attempts count; a successful login clears the identifier's counter.
// Per IP (stadium wifi is shared, but loggers are few) and per identifier.
const IP_FAILURES = { max: 5, windowMs: 15 * 60 * 1000, distributed: true };
const IDENTIFIER_FAILURES = { max: 10, windowMs: 60 * 60 * 1000, distributed: true };

// POST /api/loggers/auth - Authenticate a logger
export async function POST(request: NextRequest) {
    try {
        const ipLimit = await isFailureLimited('logger-login', ipSubject(request), IP_FAILURES);
        if (ipLimit.limited) {
            return NextResponse.json(
                { error: 'Too many login attempts. Try again in 15 minutes.' },
                { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds ?? 900) } }
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

        const identifier = String(email).trim();
        const identifierSubject = emailSubject(identifier);

        const identifierLimit = await isFailureLimited('logger-login', identifierSubject, IDENTIFIER_FAILURES);
        if (identifierLimit.limited) {
            return NextResponse.json(
                { error: 'Too many login attempts. Try again later.' },
                { status: 429, headers: { 'Retry-After': String(identifierLimit.retryAfterSeconds ?? 3600) } }
            );
        }

        const recordLoginFailure = async () => {
            await recordFailure('logger-login', ipSubject(request), IP_FAILURES);
            await recordFailure('logger-login', identifierSubject, IDENTIFIER_FAILURES);
        };

        // Email is unique; a display name is only accepted when it matches exactly
        // one logger (see pickLoggerCandidate).
        const byEmail = await db.select().from(loggers).where(eq(loggers.email, identifier)).limit(1);
        const byName = byEmail.length > 0
            ? []
            : await db.select().from(loggers).where(eq(loggers.name, identifier)).limit(2);
        const found = pickLoggerCandidate(byEmail, byName);

        // Always run one bcrypt comparison so an unknown identifier takes as long as a wrong password.
        const isPasswordValid = await bcrypt.compare(String(password), found?.password || DUMMY_PASSWORD_HASH);
        if (!found || !found.password || !isPasswordValid) {
            await recordLoginFailure();
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        if (!isLoggerStatusActive(found.status)) {
            return NextResponse.json(
                { error: 'This logger account is disabled. Contact an administrator.' },
                { status: 403 }
            );
        }

        // Successful login: clear this identifier's failures
        await clearFailures('logger-login', identifierSubject, IDENTIFIER_FAILURES);

        // Get assigned matches using the new multi-logger helper
        const assignedMatches = await getLoggerMatches(found.id);

        // Generate JWT token
        if (!env.jwtSecret) {
            return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
        }
        const token = jwt.sign(
            {
                id: found.id,
                email: found.email,
                role: found.role,
            },
            env.jwtSecret,
            { expiresIn: '7d' }
        );

        const response = NextResponse.json({
            logger: {
                id: found.id,
                name: found.name,
                email: found.email,
                role: found.role,
            },
            assignedMatches,
            token,
        });

        // Set authToken cookie so getAuthUser() can authenticate logger API requests
        setAuthCookie(response, request, token);

        return response;
    } catch (error) {
        console.error('Error authenticating logger:', error);
        return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 500 }
        );
    }
}
