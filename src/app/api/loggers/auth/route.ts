import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loggers, matches } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getLoggerMatches } from '@/lib/match-logger-helpers';

// POST /api/loggers/auth - Authenticate a logger
export async function POST(request: NextRequest) {
    try {
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
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Check password using bcrypt
        const isPasswordValid = await bcrypt.compare(password, logger[0].password || '');
        if (!isPasswordValid) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Get assigned matches using the new multi-logger helper
        const assignedMatches = await getLoggerMatches(logger[0].id);

        // Generate JWT token
        const token = jwt.sign(
            {
                id: logger[0].id,
                email: logger[0].email,
                role: logger[0].role,
            },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '7d' }
        );

        return NextResponse.json({
            logger: {
                id: logger[0].id,
                name: logger[0].name,
                email: logger[0].email,
                role: logger[0].role,
            },
            assignedMatches,
            token,
        });
    } catch (error) {
        console.error('Error authenticating logger:', error);
        return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 500 }
        );
    }
}
