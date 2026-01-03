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
                { error: 'Email, password, and name are required' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Validate password strength
        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
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
                { error: 'User with this email already exists' },
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

        return NextResponse.json({
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
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Registration failed. Please try again.' },
            { status: 500 }
        );
    }
}
