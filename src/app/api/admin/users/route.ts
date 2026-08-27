/**
 * Admin Users Management API
 * Provides user listing and role management for access control
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // BACKLOG-283: this previously had zero .limit() clause -- an
        // unbounded full-table scan, the exact anti-pattern CLAUDE.md
        // flags. Clamp pattern matches the rest of the codebase (BACKLOG-169).
        const { searchParams } = new URL(request.url);
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50), 200);
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
        const role = searchParams.get('role');

        const countQuery = db.select({ count: sql<number>`count(*)` }).from(users);
        const [{ count: totalCount }] = role
            ? await countQuery.where(eq(users.role, role))
            : await countQuery;

        let listQuery = db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            avatar: users.avatar,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
        }).from(users);
        if (role) {
            listQuery = listQuery.where(eq(users.role, role)) as typeof listQuery;
        }
        const pagedUsers = await listQuery.limit(limit).offset(offset);

        return NextResponse.json({
            users: pagedUsers,
            total: totalCount,
            timestamp: new Date().toISOString(),
        }, {
            headers: {
                'X-Total-Count': String(totalCount),
                'X-Limit': String(limit),
                'X-Offset': String(offset),
            },
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
