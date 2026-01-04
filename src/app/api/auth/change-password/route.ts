import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify Authentication
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: 'Current and new passwords are required' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: 'New password must be at least 6 characters long' },
                { status: 400 }
            );
        }

        // 2. Get user with password hash
        const dbUser = await db
            .select()
            .from(users)
            .where(eq(users.id, user.id))
            .get();

        if (!dbUser) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // 3. Check if user uses password auth
        if (!dbUser.password) {
            return NextResponse.json(
                { error: 'You are logged in with a social account. You cannot change password.' },
                { status: 400 }
            );
        }

        // 4. Verify current password
        const isMatch = await bcrypt.compare(currentPassword, dbUser.password);
        if (!isMatch) {
            return NextResponse.json(
                { error: 'Incorrect current password' },
                { status: 400 }
            );
        }

        // 5. Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 6. Update database
        await db
            .update(users)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(eq(users.id, user.id));

        return NextResponse.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        return NextResponse.json(
            { error: 'Failed to update password' },
            { status: 500 }
        );
    }
}
