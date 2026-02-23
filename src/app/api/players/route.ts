import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, teams } from '@/db/schema';
import { eq, inArray, or, like } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const ids = searchParams.get('ids');
        const search = searchParams.get('search');
        const department = searchParams.get('department');
        const college = searchParams.get('college');
        const university = searchParams.get('university');

        // Fetch by multiple IDs
        if (ids) {
            const playerIds = ids.split(',').map(id => id.trim()).filter(Boolean);
            if (playerIds.length === 0) {
                return NextResponse.json({ success: true, players: [] });
            }
            const foundPlayers = await db.select().from(players).where(inArray(players.id, playerIds));
            return NextResponse.json({ success: true, players: foundPlayers });
        }

        // Hierarchy filters (Department, College, University)
        // For university, we also check the team's university field because BUSA teams
        // (e.g. Kings FC) store the university on the team row, not on each player row.
        if (department || college || university) {
            if (university && !department && !college) {
                // JOIN teams so we can match either player.university or team.university
                const results = await db
                    .select({
                        id: players.id, name: players.name, jerseyName: players.jerseyName,
                        number: players.number, teamId: players.teamId, position: players.position,
                        rating: players.rating, eyePoints: players.eyePoints, age: players.age,
                        height: players.height, weight: players.weight, nationality: players.nationality,
                        college: players.college, department: players.department, university: players.university,
                        image: players.image, marketValue: players.marketValue, profileId: players.profileId,
                        email: players.email, attributes: players.attributes, createdAt: players.createdAt,
                    })
                    .from(players)
                    .leftJoin(teams, eq(players.teamId, teams.id))
                    .where(
                        or(
                            eq(players.university, university),
                            eq(teams.university, university)
                        )
                    );
                return NextResponse.json({ success: true, players: results });
            }

            let query = db.select().from(players);
            const conditions = [];

            if (department) conditions.push(eq(players.department, department));
            if (college) conditions.push(eq(players.college, college));
            if (university) conditions.push(eq(players.university, university));

            const results = await query.where(conditions.length > 1 ? or(...conditions) : conditions[0]);
            return NextResponse.json({ success: true, players: results });
        }

        // Fetch by team ID
        if (teamId) {
            const teamPlayers = await db.select().from(players).where(eq(players.teamId, teamId));
            return NextResponse.json({ success: true, players: teamPlayers });
        }

        // Search by name
        if (search) {
            const searchResults = await db.select().from(players).where(
                or(
                    like(players.name, `%${search}%`),
                    like(players.jerseyName, `%${search}%`)
                )
            );
            return NextResponse.json({ success: true, players: searchResults });
        }

        // Fetch all players
        const allPlayers = await db.select().from(players);
        return NextResponse.json({ success: true, players: allPlayers });
    } catch (error) {
        console.error('Error fetching players:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch players' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getAuthUser(request as any);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Basic validation - only name and position are required
        // teamId is optional (player can exist without a team but must have institutional data)
        if (!body.name || !body.position) {
            return NextResponse.json({ error: 'Name and Position are required' }, { status: 400 });
        }

        // Validate that player has either a team OR institutional affiliation
        if (!body.teamId && !body.university && !body.college && !body.department) {
            return NextResponse.json({
                error: 'Player must have either a Team ID or institutional affiliation (university, college, or department)',
            }, { status: 400 });
        }

        const playerId = body.id || `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newPlayer = await db.insert(players).values({
            ...body,
            id: playerId,
        }).returning();

        return NextResponse.json(newPlayer[0], { status: 201 });
    } catch (error) {
        console.error('Error creating player:', error);
        return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
    }
}
