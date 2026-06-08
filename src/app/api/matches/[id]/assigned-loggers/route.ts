import { NextRequest, NextResponse } from 'next/server';
import { getMatchLoggers } from '@/lib/match-logger-helpers';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/matches/[id]/assigned-loggers
 * Get all loggers assigned to a specific match (from assignments table, not active sessions)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin' && authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const loggers = await getMatchLoggers(id);

        return NextResponse.json({
            loggers,
            count: loggers.length
        });
    } catch (error) {
        console.error('Error fetching match assigned loggers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch assigned loggers' },
            { status: 500 }
        );
    }
}
