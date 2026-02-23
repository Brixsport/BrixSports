import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams } from '@/db/schema';

/**
 * GET /api/universities
 * Fetches all unique university names from the teams table
 */
export async function GET() {
    try {
        // Get all teams and extract unique university names
        const allTeams = await db
            .select({ university: teams.university })
            .from(teams);

        // Extract unique university names and filter out null/empty values
        const uniqueUniversities = new Set<string>();
        allTeams.forEach(team => {
            if (team.university && team.university.trim() !== '') {
                uniqueUniversities.add(team.university);
            }
        });

        // Convert to sorted array
        const universityNames = Array.from(uniqueUniversities).sort();

        return NextResponse.json({
            success: true,
            universities: universityNames,
            count: universityNames.length,
        });
    } catch (error) {
        console.error('Error fetching universities:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch universities' },
            { status: 500 }
        );
    }
}
