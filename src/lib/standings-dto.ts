import type { standings, teams } from '@/db/schema';
import { compareStandings } from '@/lib/standingsSort';

type StandingRow = typeof standings.$inferSelect;
type TeamRow = typeof teams.$inferSelect;

// Public standings payload: explicit fields only, so DB-internal columns
// (e.g. teams.ownerOrganizationId, team-level aggregate stats) never leak.
export interface PublicStandingTeamDTO {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    university: string;
    color: string;
    sport: string;
    gender: string | null;
}

export interface PublicStandingDTO {
    id: string;
    teamId: string;
    sport: string;
    competition: string;
    competitionId: string | null;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    yellowCards: number;
    redCards: number;
    groupName: string | null;
    team: PublicStandingTeamDTO | null;
}

export function toPublicStandingTeamDTO(team: TeamRow | null | undefined): PublicStandingTeamDTO | null {
    if (!team) return null;
    return {
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        logo: team.logo,
        university: team.university,
        color: team.color,
        sport: team.sport,
        gender: team.gender,
    };
}

export function toPublicStandingDTO(row: StandingRow, team: TeamRow | null | undefined): PublicStandingDTO {
    return {
        id: row.id,
        teamId: row.teamId,
        sport: row.sport,
        competition: row.competition,
        competitionId: row.competitionId,
        played: row.played ?? 0,
        won: row.won ?? 0,
        drawn: row.drawn ?? 0,
        lost: row.lost ?? 0,
        goalsFor: row.goalsFor ?? 0,
        goalsAgainst: row.goalsAgainst ?? 0,
        goalDifference: row.goalDifference ?? 0,
        points: row.points ?? 0,
        yellowCards: row.yellowCards ?? 0,
        redCards: row.redCards ?? 0,
        groupName: row.groupName,
        team: toPublicStandingTeamDTO(team),
    };
}

/**
 * Group order (nulls first, as the SQL ORDER BY gives), then the shared
 * standings chain including the team-name tiebreak. The DB query can only
 * break a full tie on teamId; the name needs the joined team.
 */
export function sortStandingDTOs(rows: PublicStandingDTO[]): PublicStandingDTO[] {
    return [...rows].sort((a, b) => {
        const ag = a.groupName ?? '';
        const bg = b.groupName ?? '';
        if (ag !== bg) return ag < bg ? -1 : 1;
        return compareStandings({ ...a, teamName: a.team?.name }, { ...b, teamName: b.team?.name });
    });
}
