import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { evaluateReadiness, timedCheck } from '@/lib/health';

const DATABASE_TIMEOUT_MS = 4000;

/**
 * Readiness check for an external uptime monitor. Unlike /api/health (process liveness only)
 * this reads one row from the database and answers 503 when the database does not respond,
 * so a monitor pointed here reports the outage a fan would actually see. Only ok flags and
 * latencies are returned: no error text, hostnames or counts.
 */
export async function GET() {
    const database = await timedCheck(
        () => db.select({ id: users.id }).from(users).limit(1),
        DATABASE_TIMEOUT_MS
    );
    const report = evaluateReadiness(database);
    if (!database.ok) console.error('[health] database check failed');

    return NextResponse.json(
        { status: report.status, checks: report.checks, timestamp: new Date().toISOString() },
        { status: report.httpStatus, headers: { 'Cache-Control': 'no-store' } }
    );
}
