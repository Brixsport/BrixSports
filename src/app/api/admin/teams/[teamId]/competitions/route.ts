import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { competitions, competitionTeamEntries, teams } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';

// ─── GET /api/admin/teams/[teamId]/competitions ───────────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: { teamId: string } },
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { teamId } = params;

        const teamExists = await db.query.teams.findFirst({
            where: eq(teams.id, teamId),
            columns: { id: true },
        });
        if (!teamExists) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        const rows = await db
            .select({
                id: competitions.id,
                name: competitions.name,
                sport: competitions.sport,
                status: competitions.status,
                season: competitions.season,
                isArchived: competitions.isArchived,
            })
            .from(competitionTeamEntries)
            .innerJoin(competitions, eq(competitionTeamEntries.competitionId, competitions.id))
            .where(eq(competitionTeamEntries.teamId, teamId))
            .all();

        const result = rows
            .filter((r) => !r.isArchived)
            .map((r) => ({
                id: r.id,
                name: r.name,
                sport: r.sport,
                status: r.status,
                season: r.season,
            }));

        return NextResponse.json({ competitions: result });
    } catch (error) {
        console.error('Error fetching team competitions:', error);
        return NextResponse.json({ error: 'Failed to fetch competitions' }, { status: 500 });
    } finally {
        // no resources to release
    }
}
