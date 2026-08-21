import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loggers, matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getAuthUser } from '@/lib/auth';

// Loggers are their own identity table, separate from `users` — real admin accounts
// live in `users`, never in `loggers`. 'admin' is deliberately excluded here so this
// endpoint can never mint a logger row whose role claim reads as a platform admin.
const ALLOWED_LOGGER_ROLES = ['logger', 'logger_manager'];

// GET /api/loggers - Get all loggers (admin/logger_manager only)
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'logger_manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const allLoggers = await db.select().from(loggers).limit(200);

        // Fetch all active assignments
        const { matchLoggerAssignments } = await import('@/db/schema');
        const assignments = await db.select().from(matchLoggerAssignments).where(eq(matchLoggerAssignments.status, 'active'));

        // Get unique match IDs from assignments
        const matchIds = [...new Set(assignments.map(a => a.matchId))];

        // Fetch match details — narrow projection, no stats/lineups blobs needed here
        const matchColumns = {
            id: matches.id,
            sport: matches.sport,
            homeTeamId: matches.homeTeamId,
            awayTeamId: matches.awayTeamId,
            status: matches.status,
            startTime: matches.startTime,
            competition: matches.competition,
        };
        let matchDetails: any[] = [];
        if (matchIds.length > 0) {
            const { inArray } = await import('drizzle-orm');
            matchDetails = await db
                .select(matchColumns)
                .from(matches)
                .where(inArray(matches.id, matchIds));
        }

        // Create match map
        const matchMap = new Map(matchDetails.map(m => [m.id, m]));

        // Group assignments by loggerId
        const assignmentsByLogger = new Map<string, any[]>();
        assignments.forEach(a => {
            if (!assignmentsByLogger.has(a.loggerId)) {
                assignmentsByLogger.set(a.loggerId, []);
            }
            const match = matchMap.get(a.matchId);
            if (match) {
                assignmentsByLogger.get(a.loggerId)?.push({
                    ...match,
                    role: a.role, // Include role info
                });
            }
        });

        // Combine data — explicit exclude of password (spreading `{...logger, password: undefined}`
        // does not reliably strip the key from every serializer, per this project's own known-issues.md)
        const loggersWithMatches = allLoggers.map(logger => {
            const { password: _password, ...loggerPublic } = logger;
            const assignedMatches = assignmentsByLogger.get(logger.id) || [];

            return {
                ...loggerPublic,
                assignedMatches,
            };
        });

        return NextResponse.json(loggersWithMatches);
    } catch (error) {
        console.error('Error fetching loggers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch loggers' },
            { status: 500 }
        );
    }
}

// POST /api/loggers - Create a new logger (admin/logger_manager only)
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'logger_manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, email, password, role = 'logger' } = body;

        if (!name || !email || !password) {
            return NextResponse.json(
                { error: 'Name, email, and password are required' },
                { status: 400 }
            );
        }

        if (!ALLOWED_LOGGER_ROLES.includes(role)) {
            return NextResponse.json(
                { error: `Invalid role. Must be one of: ${ALLOWED_LOGGER_ROLES.join(', ')}` },
                { status: 422 }
            );
        }

        // Check if email already exists
        const existingLogger = await db
            .select()
            .from(loggers)
            .where(eq(loggers.email, email))
            .limit(1);

        if (existingLogger.length > 0) {
            return NextResponse.json(
                { error: 'Email already exists' },
                { status: 409 }
            );
        }

        // Hash password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        const newLogger = await db
            .insert(loggers)
            .values({
                id: `logger_${Date.now()}`,
                name,
                email,
                password: hashedPassword,
                role,
            })
            .returning();

        const { password: _password, ...createdLoggerPublic } = newLogger[0];

        return NextResponse.json(createdLoggerPublic, { status: 201 });
    } catch (error) {
        console.error('Error creating logger:', error);
        return NextResponse.json(
            { error: 'Failed to create logger' },
            { status: 500 }
        );
    }
}
