// Allow-list shaping for the public head-to-head response. The route used to return raw
// database rows, which carried staff-only match columns (approval state, manager notes,
// approver, logger id) and every column of the teams table.

type Row = Record<string, unknown>;

export function toPublicH2HMatch(m: Row) {
    return {
        id: m.id,
        sport: m.sport,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        startTime: m.startTime,
        competition: m.competition,
        competitionId: m.competitionId,
        venue: m.venue,
    };
}

export function toPublicH2HTeam(t: Row | undefined) {
    if (!t) return t;
    return {
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        logo: t.logo,
        university: t.university,
        color: t.color,
        sport: t.sport,
    };
}
