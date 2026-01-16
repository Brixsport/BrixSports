import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loggers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getLoggerMatches } from '@/lib/match-logger-helpers';

// GET /api/loggers/[id] - Get a specific logger
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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

        // Get assigned matches using the new multi-logger helper
        const assignedMatches = await getLoggerMatches(id);

        return NextResponse.json({
            ...logger,
            password: undefined,
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

// PATCH /api/loggers/[id] - Update a logger
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, email, password, role, status, isAvailable } = body;

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

        return NextResponse.json({
            ...updatedLogger[0],
            password: undefined,
        });
    } catch (error) {
        console.error('Error updating logger:', error);
        return NextResponse.json(
            { error: 'Failed to update logger' },
            { status: 500 }
        );
    }
}

// DELETE /api/loggers/[id] - Delete a logger
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Note: The foreign key constraint with ON DELETE CASCADE 
        // will automatically remove assignments when the logger is deleted
        // But we can also explicitly update the status to 'removed' if needed

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
