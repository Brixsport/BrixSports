import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loggers, matchEvents, matchLoggerAssignments } from '@/db/schema';
import { eq, count, countDistinct } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);

        if (!authUser || authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const [logger] = await db
            .select()
            .from(loggers)
            .where(eq(loggers.id, authUser.id))
            .limit(1);

        if (!logger) {
            return NextResponse.json({ error: 'Logger not found' }, { status: 404 });
        }

        const [eventsRow] = await db
            .select({ total: count() })
            .from(matchEvents)
            .where(eq(matchEvents.loggerId, authUser.id));

        const [assignmentsRow] = await db
            .select({ total: count() })
            .from(matchLoggerAssignments)
            .where(eq(matchLoggerAssignments.loggerId, authUser.id));

        const { password, ...safeLogger } = logger;

        return NextResponse.json({
            ...safeLogger,
            stats: {
                totalEvents: eventsRow?.total ?? 0,
                loggedMatches: assignmentsRow?.total ?? 0,
            },
        });
    } catch (error) {
        console.error('Error fetching logger profile:', error);
        return NextResponse.json({ error: 'Failed to fetch logger profile' }, { status: 500 });
    }
}
