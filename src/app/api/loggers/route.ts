import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loggers, matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// GET /api/loggers - Get all loggers
export async function GET(request: NextRequest) {
    try {
        const allLoggers = await db.select().from(loggers).limit(200);

        // Fetch all active assignments
        // Dynamically import to avoid circular dependency issues if any, though schema is already imported
        const { matchLoggerAssignments } = await import('@/db/schema');
        const assignments = await db.select().from(matchLoggerAssignments).where(eq(matchLoggerAssignments.status, 'active'));

        // Get unique match IDs from assignments
        const matchIds = [...new Set(assignments.map(a => a.matchId))];

        // Fetch match details
        let matchDetails: any[] = [];
        if (matchIds.length > 0) {
            const { inArray } = await import('drizzle-orm');
            matchDetails = await db.select().from(matches).where(inArray(matches.id, matchIds));
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
                    id: match.id,
                    sport: match.sport,
                    homeTeamId: match.homeTeamId,
                    awayTeamId: match.awayTeamId,
                    status: match.status,
                    startTime: match.startTime,
                    competition: match.competition,
                    role: a.role // Include role info
                });
            }
        });

        // Combine data
        const loggersWithMatches = allLoggers.map(logger => {
            // Also check legacy loggerId if no assignments found in new table (backward compatibility)
            // But for now, we prioritize the new table.
            // If you want to merge both, you'd need to fetch matches where loggerId matches too.
            // Assuming migration is done, we rely on assignment table. 

            const assignedMatches = assignmentsByLogger.get(logger.id) || [];

            return {
                ...logger,
                password: undefined, // Don't send password to client
                status: logger.status,
                isAvailable: logger.isAvailable,
                assignedMatches
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

// POST /api/loggers - Create a new logger
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, email, password, role = 'logger' } = body;

        if (!name || !email || !password) {
            return NextResponse.json(
                { error: 'Name, email, and password are required' },
                { status: 400 }
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

        return NextResponse.json(
            {
                ...newLogger[0],
                password: undefined, // Don't send password back
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating logger:', error);
        return NextResponse.json(
            { error: 'Failed to create logger' },
            { status: 500 }
        );
    }
}
