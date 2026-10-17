import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/db';
import { users, passwordResetTokens } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { sendPasswordResetEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';
import { checkRateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { generateResetToken, hashResetToken } from '@/lib/reset-token';
import { nextEmailVerified } from '@/lib/token-version';

// POST /api/auth/forgot-password - Request password reset
export async function POST(request: NextRequest) {
    try {
        // Prevents email-bombing a victim and throttles the user-existence
        // enumeration surface (timing/response-shape attacks).
        const rl = await checkRateLimit(request, { max: 5, windowMs: 15 * 60 * 1000, distributed: true });
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        const body = await request.json();
        const { email } = body;

        // Validate input
        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        // Links are built from the configured app URL only. The Origin header is
        // attacker-controlled, and a reset link pointing at another host leaks the token.
        const baseUrl = env.appUrl.replace(/\/+$/, '');
        if (!baseUrl) {
            console.error('[ForgotPassword] NEXT_PUBLIC_APP_URL is not configured; cannot build a reset link');
            return NextResponse.json(
                { error: 'Failed to process password reset request' },
                { status: 500 }
            );
        }

        // Find user by email (case-insensitive, same as login)
        const userResult = await db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = ${String(email).trim().toLowerCase()}`)
            .limit(1);

        const user = userResult[0];

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

        // Generate reset token. Only its hash is stored; the raw value goes in the email.
        const resetToken = generateResetToken();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

        // A new request replaces any link still outstanding for this account.
        await db.transaction(async (tx) => {
            await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
            await tx.insert(passwordResetTokens).values({
                id: nanoid(),
                userId: user.id,
                token: hashResetToken(resetToken),
                expiresAt,
            });
        });

        const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

        // Send after the response so existing and unknown addresses respond alike
        // in time; a slow or failing mail server must not change what the caller sees.
        after(async () => {
            try {
                const emailResult = await sendPasswordResetEmail(user.email, resetLink, baseUrl);
                if (emailResult.success) {
                    console.log(`[ForgotPassword] Reset email sent to: ${user.email}, messageId: ${emailResult.messageId}`);
                } else {
                    console.error(`[ForgotPassword] Email failed to send to ${user.email}:`, emailResult.error);
                }
            } catch (emailError) {
                console.error(`[ForgotPassword] Exception sending email to ${user.email}:`, emailError);
            }
        });

        return NextResponse.json({
            ...response,
            // Only include debug info in development
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
        // Throttles reset-token guessing attempts.
        const rl = await checkRateLimit(request, { max: 20, windowMs: 15 * 60 * 1000, distributed: true });
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json(
                { error: 'Reset token is required' },
                { status: 400 }
            );
        }

        const tokenDataResult = await db
            .select()
            .from(passwordResetTokens)
            .where(
                and(
                    eq(passwordResetTokens.token, hashResetToken(token)),
                    gte(passwordResetTokens.expiresAt, new Date())
                )
            )
            .limit(1);

        const tokenData = tokenDataResult[0];

        if (!tokenData) {
            return NextResponse.json(
                { error: 'Invalid or expired reset token' },
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
        // Throttles reset-token guessing / brute-force on this write path.
        const rl = await checkRateLimit(request, { max: 5, windowMs: 15 * 60 * 1000, distributed: true });
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

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

        const tokenHash = hashResetToken(String(token));

        // Hash before opening the transaction so it stays short.
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Claim the token and change the password as one unit. The DELETE ... RETURNING
        // is the claim: two concurrent requests with the same token cannot both get a
        // row back, so a link works once, and a failed password update puts it back.
        const resetUserId = await db.transaction(async (tx) => {
            const claimed = await tx
                .delete(passwordResetTokens)
                .where(
                    and(
                        eq(passwordResetTokens.token, tokenHash),
                        gte(passwordResetTokens.expiresAt, new Date())
                    )
                )
                .returning({ userId: passwordResetTokens.userId });

            if (!claimed[0]) return null;

            await tx
                .update(users)
                .set({
                    password: hashedPassword,
                    // Every session signed with the old password ends with the reset.
                    tokenVersion: sql`${users.tokenVersion} + 1`,
                    // The link was delivered to the mailbox, so the address is proven.
                    emailVerified: nextEmailVerified(false, 'password_reset'),
                    updatedAt: new Date(),
                })
                .where(eq(users.id, claimed[0].userId));

            // Any other link still outstanding for this account dies with the reset.
            await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, claimed[0].userId));

            return claimed[0].userId;
        });

        if (!resetUserId) {
            return NextResponse.json(
                { error: 'Invalid or expired reset token' },
                { status: 400 }
            );
        }

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
