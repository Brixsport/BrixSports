import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, teams, playerTeamAffiliations } from '@/db/schema';
import { eq, desc, inArray, and } from 'drizzle-orm';

// BACKLOG-260: not in the original itemized scope (only football/players was
// named), but found to be an identical twin of that bug -- same full-row
// spread, same missing .limit(), same two consumers (basketball/page.tsx
// directly, and TeamProfileOverlay.tsx's independent ?teamId= fetch), same
// PlayerProfileOverlay downstream. See football/players/route.ts's comment
// for the full field-usage trace; identical here.
const BASKETBALL_PLAYER_FIELDS = {
    id: players.id,
    name: players.name,
    number: players.number,
    position: players.position,
    rating: players.rating,
    eyePoints: players.eyePoints,
    age: players.age,
    height: players.height,
    nationality: players.nationality,
    attributes: players.attributes,
};

const PLAYER_TEAM_FIELDS = {
    id: teams.id,
    shortName: teams.shortName,
    logo: teams.logo,
    sport: teams.sport,
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sortBy = searchParams.get('sortBy') || 'rating';
        const teamId = searchParams.get('teamId');
        const search = searchParams.get('search');

        // Fetch all teams first to identify basketball teams
        // BACKLOG-262 item 3: hardcoded name list, not touched here -- separate,
        // already-filed issue, out of this pass's scope.
        const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams).all();
        const basketballTeamNames = ['TBK', 'Titans', 'Storm', 'Rim Reapers', 'Vikings', 'Siberia'];
        const basketballTeams = allTeams.filter(team =>
            basketballTeamNames.includes(team.name)
        );
        const basketballTeamIds = basketballTeams.map(t => t.id);

        // Build query with conditional sorting
        const orderByClause = sortBy === 'rating' ? desc(players.rating) :
            sortBy === 'eyePoints' ? desc(players.eyePoints) :
                desc(players.rating);

        let query = db
            .select({ player: BASKETBALL_PLAYER_FIELDS, team: PLAYER_TEAM_FIELDS })
            .from(playerTeamAffiliations)
            .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
            .innerJoin(teams, eq(playerTeamAffiliations.teamId, teams.id));

        // Apply filters
        const conditions = [eq(playerTeamAffiliations.isActive, true)];

        if (search) {
            conditions.push(eq(players.name, search));
        }

        if (teamId) {
            conditions.push(eq(playerTeamAffiliations.teamId, teamId));
        } else {
            conditions.push(inArray(playerTeamAffiliations.teamId, basketballTeamIds));
        }

        query = query.where(and(...conditions)) as any;

        const basketballPlayers = await query
            .orderBy(orderByClause)
            .limit(100)
            .all();

        const transformedPlayers = basketballPlayers.map(({ player, team }) => ({
            ...player,
            team,
        }));

        return NextResponse.json({
            success: true,
            players: transformedPlayers,
            count: transformedPlayers.length,
        });
    } catch (error) {
        console.error('Error fetching basketball players:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch basketball players' },
            { status: 500 }
        );
    }
}
