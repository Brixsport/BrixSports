import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { competitions } from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

/**
 * GET /api/competitions/organized
 * Returns competitions organized by status for homepage and other views
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const includeArchived = searchParams.get('includeArchived') === 'true';

        // Fetch all competitions with team details
        const allCompetitions = await db.query.competitions.findMany({
            with: {
                winner: true,
                runnerUp: true,
                thirdPlace: true,
            },
            orderBy: [
                asc(competitions.displayOrder),
                desc(competitions.startDate),
            ],
        });

        // Filter out archived if needed
        const filteredCompetitions = includeArchived
            ? allCompetitions
            : allCompetitions.filter(c => !c.isArchived);

        // Organize by status
        const organized = {
            featured: filteredCompetitions.filter(c => c.isFeatured && c.status !== 'completed'),
            upcoming: filteredCompetitions.filter(c =>
                c.status === 'upcoming' &&
                !c.isFeatured &&
                c.registrationOpen
            ),
            ongoing: filteredCompetitions.filter(c => c.status === 'ongoing'),
            registrationClosed: filteredCompetitions.filter(c =>
                c.status === 'upcoming' &&
                !c.registrationOpen
            ),
            completed: filteredCompetitions.filter(c => c.status === 'completed'),
            archived: allCompetitions.filter(c => c.isArchived),
        };

        // Get statistics
        const stats = {
            total: allCompetitions.length,
            active: organized.ongoing.length,
            upcoming: organized.upcoming.length,
            completed: organized.completed.length,
            openForRegistration: organized.upcoming.length,
        };

        return NextResponse.json({
            competitions: organized,
            stats,
        });
    } catch (error) {
        console.error('Error fetching organized competitions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch competitions' },
            { status: 500 }
        );
    }
}
