import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, teams, playerTeamAffiliations } from '@/db/schema';
import { eq, desc, inArray, and } from 'drizzle-orm';

// BACKLOG-260: explicit allow-list. This route has exactly one page consumer
// (src/app/football/page.tsx, grep-confirmed) plus one component consumer via
// its ?teamId= filter (src/components/TeamProfileOverlay.tsx, which does its
// own independent fetch rather than reusing a parent payload). Fields here
// cover both: the list/grid row (id, name, number, position, rating,
// eyePoints), AND src/components/PlayerProfileOverlay.tsx, which both callers
// feed the raw player object into directly with no refetch for these fields
// (only `team` and parsed `attributes` get a playerData fallback there) --
// reads age/height/nationality/attributes on top of the list fields.
const FOOTBALL_PLAYER_FIELDS = {
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

// team.sport covers PlayerProfileOverlay's `sport || team?.sport` fallback
// (defensive -- this route's own callers always pass an explicit sport prop,
// but the component is shared).
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

        // Fetch all football teams first to identify ids
        const footballTeams = await db
            .select({ id: teams.id })
            .from(teams)
            .where(eq(teams.sport, 'Football'))
            .all();

        const footballTeamIds = footballTeams.map(t => t.id);

        if (footballTeamIds.length === 0) {
            return NextResponse.json({
                success: true,
                players: [],
                count: 0,
            });
        }

        // Build query with conditional sorting
        const orderByClause = sortBy === 'rating' ? desc(players.rating) :
            sortBy === 'eyePoints' ? desc(players.eyePoints) :
                desc(players.rating);

        let query = db
            .select({ player: FOOTBALL_PLAYER_FIELDS, team: PLAYER_TEAM_FIELDS })
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
            conditions.push(inArray(playerTeamAffiliations.teamId, footballTeamIds));
        }

        query = query.where(and(...conditions)) as any;

        // BACKLOG-260: was unbounded -- no consumer needs more than the 30
        // rendered (football/page.tsx does players.slice(0, 30)).
        const footballPlayers = await query
            .orderBy(orderByClause)
            .limit(100)
            .all();

        const transformedPlayers = footballPlayers.map(({ player, team }) => ({
            ...player,
            team,
        }));

        return NextResponse.json({
            success: true,
            players: transformedPlayers,
            count: transformedPlayers.length,
        });
    } catch (error) {
        console.error('Error fetching football players:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch football players' },
            { status: 500 }
        );
    }
}
