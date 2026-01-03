import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// POST /api/loggers/auth - Authenticate a logger
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        // Find user by email (loggers are users with role='logger' or 'admin')
        const user = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (user.length === 0) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Check if user has logger or admin role
        if (user[0].role !== 'logger' && user[0].role !== 'admin') {
            return NextResponse.json(
                { error: 'Access denied. Logger credentials required.' },
                { status: 403 }
            );
        }

        // Check password using bcrypt
        const isPasswordValid = await bcrypt.compare(password, user[0].password || '');
        if (!isPasswordValid) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Get assigned matches (for now, return all matches - you can filter by loggerId later)
        const assignedMatches = await db
            .select()
            .from(matches)
            .where(eq(matches.loggerId, user[0].id));

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user[0].id,
                email: user[0].email,
                role: user[0].role,
            },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '7d' }
        );

        // In production, generate JWT token here
        return NextResponse.json({
            logger: {
                id: user[0].id,
                name: user[0].name,
                email: user[0].email,
                role: user[0].role,
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
