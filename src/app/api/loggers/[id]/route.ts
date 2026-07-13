import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loggers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getLoggerMatches } from '@/lib/match-logger-helpers';
import { getAuthUser } from '@/lib/auth';

// Loggers are their own identity table, separate from `users` — real admin accounts
// live in `users`, never in `loggers`. 'admin' is deliberately excluded here so this
// endpoint can never mint a logger row whose role claim reads as a platform admin.
const ALLOWED_LOGGER_ROLES = ['logger', 'logger_manager'];

// GET /api/loggers/[id] - Get a specific logger (admin/logger_manager only)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'logger_manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const [logger] = await db
            .select()
            .from(loggers)
            .where(eq(loggers.id, id))
            .limit(1);

        if (!logger) {
            return NextResponse.json(
                { error: 'Logger not found' },
                { status: 404 }
            );
        }

        // Get assigned matches using the multi-logger helper (already narrowed —
        // no stats/lineups blobs, see src/lib/match-logger-helpers.ts)
        const assignedMatches = await getLoggerMatches(id);

        // Explicit exclude — `{...logger, password: undefined}` does not reliably
        // strip the key from every serializer, per this project's known-issues.md.
        const { password: _password, ...loggerPublic } = logger;

        return NextResponse.json({
            ...loggerPublic,
            assignedMatches,
        });
    } catch (error) {
        console.error('Error fetching logger:', error);
        return NextResponse.json(
            { error: 'Failed to fetch logger' },
            { status: 500 }
        );
    }
}

// PATCH /api/loggers/[id] - Update a logger (admin/logger_manager only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'logger_manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, email, password, role, status, isAvailable } = body;

        if (role !== undefined && !ALLOWED_LOGGER_ROLES.includes(role)) {
            return NextResponse.json(
                { error: `Invalid role. Must be one of: ${ALLOWED_LOGGER_ROLES.join(', ')}` },
                { status: 422 }
            );
        }

        const updateData: any = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (password) {
            // Hash password before updating
            updateData.password = await bcrypt.hash(password, 10);
        }
        if (role) updateData.role = role;
        if (status) updateData.status = status;
        if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

        const updatedLogger = await db
            .update(loggers)
            .set(updateData)
            .where(eq(loggers.id, id))
            .returning();

        if (updatedLogger.length === 0) {
            return NextResponse.json(
                { error: 'Logger not found' },
                { status: 404 }
            );
        }

        const { password: _password, ...updatedLoggerPublic } = updatedLogger[0];

        return NextResponse.json(updatedLoggerPublic);
    } catch (error) {
        console.error('Error updating logger:', error);
        return NextResponse.json(
            { error: 'Failed to update logger' },
            { status: 500 }
        );
    }
}

// DELETE /api/loggers/[id] - Delete a logger (admin/logger_manager only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'logger_manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Note: The foreign key constraint with ON DELETE CASCADE
        // will automatically remove assignments when the logger is deleted

        const deletedLogger = await db
            .delete(loggers)
            .where(eq(loggers.id, id))
            .returning();

        if (deletedLogger.length === 0) {
            return NextResponse.json(
                { error: 'Logger not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ message: 'Logger deleted successfully' });
    } catch (error) {
        console.error('Error deleting logger:', error);
        return NextResponse.json(
            { error: 'Failed to delete logger' },
            { status: 500 }
        );
    }
}
