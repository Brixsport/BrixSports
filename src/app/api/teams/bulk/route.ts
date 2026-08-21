/**
 * Bulk Team Creation API
 * POST /api/teams/bulk
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { teams: teamsToCreate } = body;

        if (!Array.isArray(teamsToCreate) || teamsToCreate.length === 0) {
            return NextResponse.json(
                { error: 'Invalid request: Expected an array of teams' },
                { status: 400 }
            );
        }

        const newTeams = teamsToCreate.map(team => ({
            id: nanoid(),
            name: team.name,
            shortName: team.shortName,
            logo: team.logo || '',
            university: team.university,
            color: team.color || '#000000',
            sport: team.sport || 'Football',
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0,
            createdAt: new Date(),
        }));

        // Batch insert
        const inserted = await db.insert(teams).values(newTeams).returning();

        return NextResponse.json({
            success: true,
            totalInserted: inserted.length,
            teams: inserted
        }, { status: 201 });

    } catch (error) {
        console.error('Error in bulk team creation:', error);
        return NextResponse.json(
            { error: 'Failed to create teams in bulk' },
            { status: 500 }
        );
    }
}
