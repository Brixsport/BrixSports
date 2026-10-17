import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { organizations, teams, players, playerTeamAffiliations, systemSettings } from '@/db/schema';

// BACKLOG-126 / BACKLOG-228 (session 56): single source of truth for "the
// season new roster writes belong to." Originally a hardcoded constant —
// changing it required a code edit + redeploy. Now DB-backed via the existing
// admin Settings infra (system_settings, key 'system.season.current'), so an
// admin can roll the season forward from /admin/settings without a deploy.
// FALLBACK_SEASON is only used if that setting row doesn't exist yet (matches
// /api/admin/settings' own seed-default-on-first-read pattern) — keep it in
// sync with that route's DEFAULT_SETTINGS entry.
const SEASON_SETTING_KEY = 'system.season.current';
const FALLBACK_SEASON = '2026/2027';
const SEASON_CACHE_TTL_MS = 60_000;
let cachedSeason: { value: string; expiresAt: number } | null = null;

export async function getCurrentSeason(): Promise<string> {
    if (cachedSeason && cachedSeason.expiresAt > Date.now()) {
        return cachedSeason.value;
    }
    const row = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, SEASON_SETTING_KEY),
        columns: { value: true },
    });
    const value = row?.value || FALLBACK_SEASON;
    cachedSeason = { value, expiresAt: Date.now() + SEASON_CACHE_TTL_MS };
    return value;
}

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
    const currentSeason = await getCurrentSeason();

    // pta_player_team_season_unique is (playerId, teamId, season) — check for a
    // pre-existing row on this exact triple (e.g. rejoining a team left earlier
    // this same season) before deciding insert vs. reactivate.
    const existingSeasonRow = await db
        .select({ id: playerTeamAffiliations.id, isActive: playerTeamAffiliations.isActive })
        .from(playerTeamAffiliations)
        .where(and(
            eq(playerTeamAffiliations.playerId, playerId),
            eq(playerTeamAffiliations.teamId, newTeamId),
            eq(playerTeamAffiliations.season, currentSeason),
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

    // BUG-235 (cross-session sweep, MEDIUM): these two writes used to be independent,
    // non-transactional statements with no try/catch of their own -- a failure between
    // closing the old affiliation and writing the new one left a player with zero
    // active affiliation of that type, silently, and no rollback path existed.
    // Same fix shape as BUG-121's transaction around the score-race path.
    let newAffiliationId: string;
    if (existingSeasonRow) {
        newAffiliationId = existingSeasonRow.id;
    } else {
        newAffiliationId = nanoid();
    }

    await db.transaction(async (tx) => {
        if (currentAffiliation && currentAffiliation.teamId !== newTeamId) {
            await tx
                .update(playerTeamAffiliations)
                .set({ isActive: false, endDate: now })
                .where(eq(playerTeamAffiliations.id, currentAffiliation.id));
        }

        if (existingSeasonRow) {
            await tx
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
            await tx.insert(playerTeamAffiliations).values({
                id: newAffiliationId,
                playerId,
                teamId: newTeamId,
                affiliationType,
                isPrimary: true,
                isActive: true,
                startDate: now,
                season: currentSeason,
                jerseyNumber: options.jerseyNumber ?? null,
                position: options.position ?? null,
                nicknames: '[]',
                createdAt: now,
            });
        }
    });

    return {
        success: true,
        playerId,
        playerName: player.name,
        fromTeamId: currentAffiliation?.teamId ?? null,
        toTeamId: newTeamId,
        toTeamName: newTeam.name,
        affiliationType,
        season: currentSeason,
        newAffiliationId,
    };
}
