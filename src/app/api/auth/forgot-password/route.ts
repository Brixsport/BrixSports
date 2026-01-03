import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// In-memory store for password reset tokens (in production, use Redis or database)
const resetTokens = new Map<string, { userId: string; expiresAt: Date }>();

// POST /api/auth/forgot-password - Request password reset
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email } = body;

        // Validate input
        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        // Find user by email
        const user = await db
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .get();

        // Always return success to prevent email enumeration
        // Don't reveal if the email exists or not
        const response = {
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.',
        };

        if (!user) {
            // Return success even if user doesn't exist (security best practice)
            return NextResponse.json(response);
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

        // Store token (in production, store in database with expiry)
        resetTokens.set(resetToken, {
            userId: user.id,
            expiresAt,
        });

        // In production, send email with reset link
        // For now, we'll return the token in development mode
        const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

        console.log('Password reset link:', resetLink);
        console.log('Token expires at:', expiresAt);

        // TODO: Send email with reset link
        // await sendPasswordResetEmail(user.email, resetLink);

        return NextResponse.json({
            ...response,
            // Only include token in development
            ...(process.env.NODE_ENV === 'development' && {
                resetToken,
                resetLink,
                expiresAt,
            }),
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json(
            { error: 'Failed to process password reset request' },
            { status: 500 }
        );
    }
}

// GET /api/auth/forgot-password - Verify reset token
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json(
                { error: 'Reset token is required' },
                { status: 400 }
            );
        }

        const tokenData = resetTokens.get(token);

        if (!tokenData) {
            return NextResponse.json(
                { error: 'Invalid or expired reset token' },
                { status: 400 }
            );
        }

        if (new Date() > tokenData.expiresAt) {
            resetTokens.delete(token);
            return NextResponse.json(
                { error: 'Reset token has expired' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Token is valid',
        });
    } catch (error) {
        console.error('Token verification error:', error);
        return NextResponse.json(
            { error: 'Failed to verify reset token' },
            { status: 500 }
        );
    }
}

// PATCH /api/auth/forgot-password - Reset password with token
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { token, newPassword } = body;

        if (!token || !newPassword) {
            return NextResponse.json(
                { error: 'Token and new password are required' },
                { status: 400 }
            );
        }

        // Validate password strength
        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        const tokenData = resetTokens.get(token);

        if (!tokenData) {
            return NextResponse.json(
                { error: 'Invalid or expired reset token' },
                { status: 400 }
            );
        }

        if (new Date() > tokenData.expiresAt) {
            resetTokens.delete(token);
            return NextResponse.json(
                { error: 'Reset token has expired' },
                { status: 400 }
            );
        }

        // Hash new password
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password
        await db
            .update(users)
            .set({
                password: hashedPassword,
                updatedAt: new Date(),
            })
            .where(eq(users.id, tokenData.userId));

        // Delete used token
        resetTokens.delete(token);

        return NextResponse.json({
            success: true,
            message: 'Password has been reset successfully',
        });
    } catch (error) {
        console.error('Password reset error:', error);
        return NextResponse.json(
            { error: 'Failed to reset password' },
            { status: 500 }
        );
    }
}
