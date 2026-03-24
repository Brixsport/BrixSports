export type OrganizationAffiliationType = 'university' | 'college' | 'department';

export interface TeamLike {
    id: string;
    name: string;
    shortName?: string | null;
    sport?: string | null;
    university?: string | null;
}

export interface TeamMembershipLike {
    affiliation?: {
        affiliationType?: string | null;
        isPrimary?: boolean | null;
        isActive?: boolean | null;
        role?: string | null;
        status?: string | null;
    };
    team: TeamLike;
}

export interface OrganizationLike {
    id?: string;
    name: string;
    shortName?: string | null;
    displayName?: string | null;
    type?: string | null;
    parentOrganizationId?: string | null;
}

export interface OrganizationAffiliationLike {
    affiliation?: {
        affiliationType?: string | null;
        isPrimary?: boolean | null;
        role?: string | null;
        status?: string | null;
    };
    organization: OrganizationLike;
}

export interface AffiliationAwarePlayerLike {
    university?: string | null;
    college?: string | null;
    department?: string | null;
    teamId?: string | null;
    team?: TeamLike | null;
    memberships?: TeamMembershipLike[] | null;
    organizationAffiliations?: OrganizationAffiliationLike[] | null;
}

function normalizeText(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
}

function getOrganizationLabel(organization: OrganizationLike): string | null {
    return normalizeText(
        organization.displayName ??
        organization.shortName ??
        organization.name
    );
}

export function getPrimaryTeam<T extends TeamLike = TeamLike>(
    player: AffiliationAwarePlayerLike,
    fallbackTeams: T[] = []
): T | TeamLike | null {
    const memberships = [...(player.memberships ?? [])]
        .filter((membership): membership is TeamMembershipLike => Boolean(membership?.team))
        .sort((left, right) => Number(Boolean(right.affiliation?.isPrimary)) - Number(Boolean(left.affiliation?.isPrimary)));

    if (memberships.length > 0) {
        return memberships[0].team;
    }

    if (player.team) {
        return player.team;
    }

    if (player.teamId) {
        return fallbackTeams.find((team) => team.id === player.teamId) ?? null;
    }

    return null;
}

export function getOrganizationAffiliationNames(
    player: AffiliationAwarePlayerLike,
    type: OrganizationAffiliationType
): string[] {
    const matches = (player.organizationAffiliations ?? [])
        .filter((entry) => {
            const affiliationType = entry.affiliation?.affiliationType ?? entry.organization.type;
            return affiliationType === type || entry.organization.type === type;
        })
        .sort((left, right) => Number(Boolean(right.affiliation?.isPrimary)) - Number(Boolean(left.affiliation?.isPrimary)))
        .map((entry) => getOrganizationLabel(entry.organization))
        .filter((value): value is string => Boolean(value));

    const uniqueMatches = Array.from(new Set(matches));
    if (uniqueMatches.length > 0) {
        return uniqueMatches;
    }

    const fallbackValue = type === 'university'
        ? player.university
        : type === 'college'
            ? player.college
            : player.department;

    return fallbackValue ? [fallbackValue] : [];
}

export function getPrimaryOrganizationAffiliationName(
    player: AffiliationAwarePlayerLike,
    type: OrganizationAffiliationType
): string | null {
    return getOrganizationAffiliationNames(player, type)[0] ?? null;
}

export function getResolvedInstitutionalData(
    player: AffiliationAwarePlayerLike,
    teamOverride?: TeamLike | null
): {
    university: string | null;
    college: string | null;
    department: string | null;
} {
    const team = teamOverride ?? getPrimaryTeam(player);

    return {
        university: getPrimaryOrganizationAffiliationName(player, 'university')
            ?? normalizeText(player.university)
            ?? normalizeText(team?.university)
            ?? null,
        college: getPrimaryOrganizationAffiliationName(player, 'college')
            ?? normalizeText(player.college)
            ?? null,
        department: getPrimaryOrganizationAffiliationName(player, 'department')
            ?? normalizeText(player.department)
            ?? null,
    };
}

export function playerMatchesInstitutionFilters(
    player: AffiliationAwarePlayerLike,
    filters: Partial<Record<OrganizationAffiliationType, string>>,
    teamOverride?: TeamLike | null
): boolean {
    const institutionalData = getResolvedInstitutionalData(player, teamOverride);

    return (!filters.university || institutionalData.university === filters.university)
        && (!filters.college || institutionalData.college === filters.college)
        && (!filters.department || institutionalData.department === filters.department);
}
