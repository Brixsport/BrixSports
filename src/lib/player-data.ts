import 'server-only';

import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/db';
import {
    organizations,
    playerOrganizationAffiliations,
    playerTeamAffiliations,
    players,
    teams,
} from '@/db/schema';

type PlayerRow = typeof players.$inferSelect;
type TeamRow = typeof teams.$inferSelect;
type OrganizationRow = typeof organizations.$inferSelect;
type PlayerTeamAffiliationRow = typeof playerTeamAffiliations.$inferSelect;
type PlayerOrganizationAffiliationRow = typeof playerOrganizationAffiliations.$inferSelect;

export type EnrichedPlayerMembership = {
    affiliation: PlayerTeamAffiliationRow;
    team: TeamRow;
};

export type EnrichedPlayerOrganizationAffiliation = {
    affiliation: PlayerOrganizationAffiliationRow;
    organization: OrganizationRow;
};

export type EnrichedPlayer = PlayerRow & {
    team: TeamRow | null;
    memberships: EnrichedPlayerMembership[];
    organizationAffiliations: EnrichedPlayerOrganizationAffiliation[];
};

// CLAUDE.md banned public fields, player-shaped: email/profileId are on the
// players row itself; memberships/organizationAffiliations are the nested
// admin-only relations enrichPlayersWithAffiliations() attaches. Mirrors the
// strip already proven correct on the single-player detail route
// (BUG-098/101, src/app/api/players/[id]/route.ts) -- this is the same shape
// applied consistently everywhere else that returns player data (BACKLOG-167).
export function toPublicPlayer<T extends { email?: unknown; profileId?: unknown; memberships?: unknown; organizationAffiliations?: unknown }>(
    player: T,
    isAdmin: boolean
): T {
    if (isAdmin) return player;
    const { email: _email, profileId: _profileId, memberships: _memberships, organizationAffiliations: _organizationAffiliations, ...pub } = player;
    return pub as T;
}

function slugifyOrganizationName(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'organization';
}

async function getUniqueOrganizationSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 2;

    while (true) {
        const existing = await db
            .select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.slug, slug))
            .get();

        if (!existing) {
            return slug;
        }

        slug = `${baseSlug}-${counter}`;
        counter += 1;
    }
}

async function findExistingOrganization(
    name: string,
    type: 'university' | 'college' | 'department',
    parentOrganizationId?: string | null
): Promise<OrganizationRow | null> {
    const trimmedName = name.trim();
    const slug = slugifyOrganizationName(trimmedName);

    const exactMatch = await db
        .select()
        .from(organizations)
        .where(and(
            eq(organizations.type, type),
            or(
                eq(organizations.name, trimmedName),
                eq(organizations.shortName, trimmedName),
                eq(organizations.slug, slug)
            ),
            ...(parentOrganizationId ? [eq(organizations.parentOrganizationId, parentOrganizationId)] : [])
        ))
        .get();

    if (exactMatch) {
        return exactMatch ?? null;
    }

    return (await db
        .select()
        .from(organizations)
        .where(and(
            eq(organizations.type, type),
            or(
                eq(organizations.name, trimmedName),
                eq(organizations.shortName, trimmedName),
                eq(organizations.slug, slug)
            )
        ))
        .get()) ?? null;
}

export async function ensureOrganizationEntity(
    name: string | null | undefined,
    type: 'university' | 'college' | 'department',
    parentOrganizationId?: string | null
): Promise<OrganizationRow | null> {
    const trimmedName = name?.trim();
    if (!trimmedName) {
        return null;
    }

    const existingOrganization = await findExistingOrganization(trimmedName, type, parentOrganizationId);
    if (existingOrganization) {
        return existingOrganization;
    }

    const slug = await getUniqueOrganizationSlug(slugifyOrganizationName(trimmedName));
    const looksLikeCode = /^[A-Z0-9/& -]{2,20}$/.test(trimmedName);

    const created = await db
        .insert(organizations)
        .values({
            id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: trimmedName,
            slug,
            type,
            shortName: looksLikeCode ? trimmedName : null,
            displayName: looksLikeCode ? null : trimmedName,
            parentOrganizationId: parentOrganizationId ?? null,
            isInternalUnit: type !== 'university',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        .returning();

    return created[0] ?? null;
}

export async function enrichPlayersWithAffiliations(playerRows: PlayerRow[]): Promise<EnrichedPlayer[]> {
    if (playerRows.length === 0) {
        return [];
    }

    const playerIds = Array.from(new Set(playerRows.map((player) => player.id)));

    const memberships = await db
        .select({
            playerId: playerTeamAffiliations.playerId,
            affiliation: playerTeamAffiliations,
            team: teams,
        })
        .from(playerTeamAffiliations)
        .innerJoin(teams, eq(playerTeamAffiliations.teamId, teams.id))
        .where(and(
            inArray(playerTeamAffiliations.playerId, playerIds),
            eq(playerTeamAffiliations.isActive, true)
        ))
        .orderBy(desc(playerTeamAffiliations.isPrimary), desc(playerTeamAffiliations.createdAt));

    const organizationAffiliations = await db
        .select({
            playerId: playerOrganizationAffiliations.playerId,
            affiliation: playerOrganizationAffiliations,
            organization: organizations,
        })
        .from(playerOrganizationAffiliations)
        .innerJoin(organizations, eq(playerOrganizationAffiliations.organizationId, organizations.id))
        .where(inArray(playerOrganizationAffiliations.playerId, playerIds))
        .orderBy(desc(playerOrganizationAffiliations.isPrimary), desc(playerOrganizationAffiliations.createdAt));

    const fallbackTeamIds = Array.from(new Set(
        playerRows
            .map((player) => player.teamId)
            .filter((teamId): teamId is string => Boolean(teamId))
    ));

    const fallbackTeams = fallbackTeamIds.length > 0
        ? await db
            .select()
            .from(teams)
            .where(inArray(teams.id, fallbackTeamIds))
        : [];

    const membershipsByPlayerId = new Map<string, EnrichedPlayerMembership[]>();
    for (const membership of memberships) {
        const list = membershipsByPlayerId.get(membership.playerId) ?? [];
        list.push({
            affiliation: membership.affiliation,
            team: membership.team,
        });
        membershipsByPlayerId.set(membership.playerId, list);
    }

    const organizationsByPlayerId = new Map<string, EnrichedPlayerOrganizationAffiliation[]>();
    for (const organizationAffiliation of organizationAffiliations) {
        const list = organizationsByPlayerId.get(organizationAffiliation.playerId) ?? [];
        list.push({
            affiliation: organizationAffiliation.affiliation,
            organization: organizationAffiliation.organization,
        });
        organizationsByPlayerId.set(organizationAffiliation.playerId, list);
    }

    const fallbackTeamsById = new Map(fallbackTeams.map((team) => [team.id, team]));

    return playerRows.map((player) => {
        const playerMemberships = membershipsByPlayerId.get(player.id) ?? [];
        const primaryMembership = playerMemberships.find((membership) => membership.affiliation.isPrimary) ?? playerMemberships[0];
        const fallbackTeam = player.teamId ? fallbackTeamsById.get(player.teamId) ?? null : null;
        const primaryTeam = primaryMembership?.team ?? fallbackTeam ?? null;

        return {
            ...player,
            teamId: primaryTeam?.id ?? player.teamId,
            team: primaryTeam,
            memberships: playerMemberships,
            organizationAffiliations: organizationsByPlayerId.get(player.id) ?? [],
        };
    });
}

export async function syncPlayerOrganizationAffiliations(
    playerId: string,
    values: Pick<PlayerRow, 'university' | 'college' | 'department'>
): Promise<void> {
    const universityOrganization = await ensureOrganizationEntity(values.university, 'university');
    const collegeOrganization = await ensureOrganizationEntity(values.college, 'college', universityOrganization?.id);
    const departmentOrganization = await ensureOrganizationEntity(values.department, 'department', collegeOrganization?.id);

    await db
        .delete(playerOrganizationAffiliations)
        .where(and(
            eq(playerOrganizationAffiliations.playerId, playerId),
            or(
                eq(playerOrganizationAffiliations.affiliationType, 'university'),
                eq(playerOrganizationAffiliations.affiliationType, 'college'),
                eq(playerOrganizationAffiliations.affiliationType, 'department')
            )
        ));

    const createdAt = new Date();
    const nextAffiliations: typeof playerOrganizationAffiliations.$inferInsert[] = [];

    if (universityOrganization) {
        nextAffiliations.push({
            id: `${playerId}-university-affiliation`,
            playerId,
            organizationId: universityOrganization.id,
            affiliationType: 'university',
            role: 'student',
            status: 'active',
            isPrimary: true,
            startDate: createdAt,
            createdAt,
        });
    }

    if (collegeOrganization) {
        nextAffiliations.push({
            id: `${playerId}-college-affiliation`,
            playerId,
            organizationId: collegeOrganization.id,
            affiliationType: 'college',
            role: 'student',
            status: 'active',
            isPrimary: false,
            startDate: createdAt,
            createdAt,
        });
    }

    if (departmentOrganization) {
        nextAffiliations.push({
            id: `${playerId}-department-affiliation`,
            playerId,
            organizationId: departmentOrganization.id,
            affiliationType: 'department',
            role: 'student',
            status: 'active',
            isPrimary: false,
            startDate: createdAt,
            createdAt,
        });
    }

    if (nextAffiliations.length > 0) {
        await db.insert(playerOrganizationAffiliations).values(nextAffiliations);
    }
}
