/**
 * Admin Users Management API
 * Provides user listing and role management for access control
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const allUsers = await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            avatar: users.avatar,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
        }).from(users);

        return NextResponse.json({
            users: allUsers,
            total: allUsers.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { userId, role } = body;

        if (!userId || !role) {
            return NextResponse.json(
                { error: 'Missing userId or role' },
                { status: 400 }
            );
        }

        // Validate role
        const validRoles = ['user', 'admin', 'logger'];
        if (!validRoles.includes(role)) {
            return NextResponse.json(
                { error: 'Invalid role. Must be one of: user, admin, logger' },
                { status: 400 }
            );
        }

        // Update user role
        await db.update(users)
            .set({
                role,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

        return NextResponse.json({
            success: true,
            message: 'User role updated successfully',
            userId,
            newRole: role,
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        return NextResponse.json(
            { error: 'Failed to update user role' },
            { status: 500 }
        );
    }
}
