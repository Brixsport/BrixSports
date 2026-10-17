import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { standings } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { STANDINGS_ORDER_BY } from '@/lib/standingsService';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sport = searchParams.get('sport');
        const competition = searchParams.get('competition');
        const competitionId = searchParams.get('competitionId');

        const whereConditions = [];
        if (sport) whereConditions.push(eq(standings.sport, sport));

        // competitionId is authoritative when present -- see BACKLOG-335.
        if (competitionId) {
            whereConditions.push(eq(standings.competitionId, competitionId));
        } else if (competition) {
            whereConditions.push(eq(standings.competition, competition));
        }

        const allStandings = await db.query.standings.findMany({
            where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
            with: {
                team: true
            },
            orderBy: STANDINGS_ORDER_BY,
            limit: 500,
        });

        return NextResponse.json(allStandings);
    } catch (error) {
        console.error('Error fetching standings:', error);
        return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
    }
}

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
        const { entries } = body;

        if (!Array.isArray(entries) || entries.length === 0) {
            return NextResponse.json({ error: 'Invalid request: Expected an array of entries' }, { status: 400 });
        }

        const newEntries = entries.map(entry => ({
            id: entry.id || `std-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            teamId: entry.teamId,
            sport: entry.sport,
            competition: entry.competition,
            competitionId: entry.competitionId || null,
            played: entry.played || 0,
            won: entry.won || 0,
            drawn: entry.drawn || 0,
            lost: entry.lost || 0,
            goalsFor: entry.goalsFor || 0,
            goalsAgainst: entry.goalsAgainst || 0,
            goalDifference: (entry.goalsFor || 0) - (entry.goalsAgainst || 0),
            points: entry.points || 0,
            yellowCards: entry.yellowCards || 0,
            redCards: entry.redCards || 0,
            groupName: entry.groupName || null,
            updatedAt: new Date(),
        }));

        // Use a transaction for bulk insert/replace
        const result = await db.insert(standings).values(newEntries).onConflictDoUpdate({
            target: [standings.teamId, standings.competitionId],
            set: {
                played: sql`excluded.played`,
                won: sql`excluded.won`,
                drawn: sql`excluded.drawn`,
                lost: sql`excluded.lost`,
                goalsFor: sql`excluded.goals_for`,
                goalsAgainst: sql`excluded.goals_against`,
                goalDifference: sql`excluded.goal_difference`,
                points: sql`excluded.points`,
                yellowCards: sql`excluded.yellow_cards`,
                redCards: sql`excluded.red_cards`,
                groupName: sql`excluded.group_name`,
                updatedAt: new Date(),
            }
        }).returning();

        return NextResponse.json({
            success: true,
            totalProcessed: result.length,
            entries: result
        });
    } catch (error) {
        console.error('Error in bulk standings operation:', error);
        return NextResponse.json({ error: 'Failed to process standings' }, { status: 500 });
    }
}

// BACKLOG-271: previously missing entirely -- removing a team from a
// competition via the admin UI updated local state only, with no way to
// actually delete the persisted standings row. Bulk-by-id, matching the
// existing bulk-POST convention.
export async function DELETE(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { ids } = body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Invalid request: Expected an array of ids' }, { status: 400 });
        }

        const result = await db.delete(standings).where(inArray(standings.id, ids)).returning({ id: standings.id });

        return NextResponse.json({
            success: true,
            deletedCount: result.length,
            deletedIds: result.map(r => r.id),
        });
    } catch (error) {
        console.error('Error deleting standings entries:', error);
        return NextResponse.json({ error: 'Failed to delete standings entries' }, { status: 500 });
    }
}
