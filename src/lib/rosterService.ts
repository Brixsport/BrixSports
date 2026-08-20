import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { organizations, teams, players, playerTeamAffiliations } from '@/db/schema';

// BACKLOG-126: single source of truth for "the season currently being rostered."
// '2026/2027' because every season='2025/2026' competition is already `completed`
// and the one `upcoming` competition is season='2026/2027' (confirmed live,
// session 53 migration). Update this at the start of each new season.
export const CURRENT_SEASON = '2026/2027';

// Shared with src/app/api/admin/teams/[teamId]/roster/route.ts, which had its own
// identical inline copy before this file existed.
export async function resolveAffiliationType(teamId: string): Promise<string> {
    const team = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
        columns: { ownerOrganizationId: true },
    });

    if (!team?.ownerOrganizationId) return 'club';

    const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, team.ownerOrganizationId),
        columns: { type: true },
    });

    if (!org) return 'club';
    if (org.type === 'college') return 'college';
    if (org.type === 'university') return 'university';
    return 'club';
}

export class TransferError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

// BACKLOG-126 step 5: core roster-transfer logic, extracted from the admin route so
// it's directly testable (same pattern as standingsService.ts / ratingsService.ts).
// Closes the player's current active affiliation of the SAME affiliationType as the
// new team and opens a new one — a club transfer deliberately leaves a college/
// university affiliation untouched (schema.ts: "No expiry — university affiliation
// is permanent").
export async function transferPlayerToTeam(
    playerId: string,
    newTeamId: string,
    options: { jerseyNumber?: number; position?: string } = {}
) {
    const player = await db.query.players.findFirst({
        where: eq(players.id, playerId),
        columns: { id: true, name: true },
    });
    if (!player) throw new TransferError('Player not found', 404);

    const newTeam = await db.query.teams.findFirst({
        where: eq(teams.id, newTeamId),
        columns: { id: true, name: true },
    });
    if (!newTeam) throw new TransferError('Team not found', 404);

    const affiliationType = await resolveAffiliationType(newTeamId);

    // pta_player_team_season_unique is (playerId, teamId, season) — check for a
    // pre-existing row on this exact triple (e.g. rejoining a team left earlier
    // this same season) before deciding insert vs. reactivate.
    const existingSeasonRow = await db
        .select({ id: playerTeamAffiliations.id, isActive: playerTeamAffiliations.isActive })
        .from(playerTeamAffiliations)
        .where(and(
            eq(playerTeamAffiliations.playerId, playerId),
            eq(playerTeamAffiliations.teamId, newTeamId),
            eq(playerTeamAffiliations.season, CURRENT_SEASON),
        ))
        .get();

    if (existingSeasonRow?.isActive) {
        throw new TransferError('Player is already actively affiliated with this team', 409);
    }

    const currentAffiliation = await db
        .select({ id: playerTeamAffiliations.id, teamId: playerTeamAffiliations.teamId })
        .from(playerTeamAffiliations)
        .where(and(
            eq(playerTeamAffiliations.playerId, playerId),
            eq(playerTeamAffiliations.affiliationType, affiliationType),
            eq(playerTeamAffiliations.isActive, true),
        ))
        .get();

    const now = new Date();

    if (currentAffiliation && currentAffiliation.teamId !== newTeamId) {
        await db
            .update(playerTeamAffiliations)
            .set({ isActive: false, endDate: now })
            .where(eq(playerTeamAffiliations.id, currentAffiliation.id));
    }

    let newAffiliationId: string;
    if (existingSeasonRow) {
        newAffiliationId = existingSeasonRow.id;
        await db
            .update(playerTeamAffiliations)
            .set({
                isActive: true,
                isPrimary: true,
                endDate: null,
                startDate: now,
                jerseyNumber: options.jerseyNumber ?? null,
                position: options.position ?? null,
            })
            .where(eq(playerTeamAffiliations.id, existingSeasonRow.id));
    } else {
        newAffiliationId = nanoid();
        await db.insert(playerTeamAffiliations).values({
            id: newAffiliationId,
            playerId,
            teamId: newTeamId,
            affiliationType,
            isPrimary: true,
            isActive: true,
            startDate: now,
            season: CURRENT_SEASON,
            jerseyNumber: options.jerseyNumber ?? null,
            position: options.position ?? null,
            nicknames: '[]',
            createdAt: now,
        });
    }

    return {
        success: true,
        playerId,
        playerName: player.name,
        fromTeamId: currentAffiliation?.teamId ?? null,
        toTeamId: newTeamId,
        toTeamName: newTeam.name,
        affiliationType,
        season: CURRENT_SEASON,
        newAffiliationId,
    };
}
