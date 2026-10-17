import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { nanoid } from 'nanoid';
import { sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

/**
 * POST /api/matches/[id]/assign-logger
 * Assign a logger to a match (admin only)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: matchId } = await params;
        const { loggerId, role = 'primary' } = await request.json();

        if (!loggerId) {
            return NextResponse.json(
                { error: 'Logger ID is required' },
                { status: 400 }
            );
        }

        // BACKLOG-452: the previous version of this guard ran the dedup SELECT
        // and the INSERT as two statements inside db.transaction(), on the
        // assumption Turso's transaction gives read-blocks-on-uncommitted-write
        // isolation the way a local SQLite file connection would. It doesn't
        // (proven by BACKLOG-436's events/route.ts finding) -- two concurrent
        // assign-logger calls for the same (matchId, loggerId) could both pass
        // the SELECT before either committed. Fixed the same way: one atomic
        // INSERT ... SELECT ... WHERE NOT EXISTS statement.
        const newId = nanoid();
        const assignedAtSeconds = Math.floor(Date.now() / 1000);
        const result: any = await db.run(sql`
            INSERT INTO match_logger_assignments (id, match_id, logger_id, role, assigned_at, assigned_by, status)
            SELECT ${newId}, ${matchId}, ${loggerId}, ${role}, ${assignedAtSeconds}, ${authUser.id}, 'active'
            WHERE NOT EXISTS (
                SELECT 1 FROM match_logger_assignments
                WHERE match_id = ${matchId} AND logger_id = ${loggerId} AND status = 'active'
            )
        `);

        const assignment = (result.rowsAffected ?? 0) > 0
            ? {
                id: newId,
                matchId,
                loggerId,
                role,
                assignedAt: new Date(assignedAtSeconds * 1000),
                assignedBy: authUser.id,
                status: 'active',
            }
            : null;

        if (!assignment) {
            return NextResponse.json(
                { error: 'This logger is already assigned to this match' },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            assignment,
        });
    } catch (error) {
        console.error('Error assigning logger:', error);
        return NextResponse.json(
            { error: 'Failed to assign logger' },
            { status: 500 }
        );
    }
}
