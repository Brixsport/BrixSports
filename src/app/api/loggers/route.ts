import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loggers, matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// GET /api/loggers - Get all loggers
export async function GET(request: NextRequest) {
    try {
        const allLoggers = await db.select().from(loggers);

        // Get assigned matches for each logger
        const loggersWithMatches = await Promise.all(
            allLoggers.map(async (logger) => {
                const assignedMatches = await db
                    .select()
                    .from(matches)
                    .where(eq(matches.loggerId, logger.id));

                return {
                    ...logger,
                    password: undefined, // Don't send password to client
                    status: logger.status,
                    isAvailable: logger.isAvailable,
                    assignedMatches: assignedMatches.map(m => ({
                        id: m.id,
                        sport: m.sport,
                        homeTeamId: m.homeTeamId,
                        awayTeamId: m.awayTeamId,
                        status: m.status,
                        startTime: m.startTime,
                        competition: m.competition,
                    })),
                };
            })
        );

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
