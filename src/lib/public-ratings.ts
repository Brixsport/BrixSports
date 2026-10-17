// Allow-list shaping for public rating responses. Routes used to return whole players/teams
// rows, which carried contact details, the cross-sport profile id, raw attributes and
// organization ownership.

type Row = Record<string, unknown>;

export function toPublicRatedPlayer(p: Row | null | undefined) {
    if (!p) return null;
    return {
        id: p.id,
        name: p.name,
        jerseyName: p.jerseyName,
        number: p.number,
        position: p.position,
        image: p.image,
        teamId: p.teamId,
        teamName: p.teamName,
    };
}

export function toPublicRatedTeam(t: Row | null | undefined) {
    if (!t) return null;
    return {
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        logo: t.logo,
    };
}

// One row of a match's public rating list: the rating columns viewers see plus the player's
// public identity, from a flat joined row. Adjustment audit fields (adjustedBy,
// adjustmentNotes) stay out.
export function toPublicMatchRating(r: Row) {
    return {
        playerId: r.playerId,
        teamId: r.teamId,
        name: r.name ?? null,
        jerseyName: r.jerseyName ?? null,
        number: r.number ?? null,
        position: r.position ?? null,
        image: r.image ?? null,
        autoRating: r.autoRating,
        finalRating: r.finalRating,
        isMotM: r.isMotM,
    };
}

// Match header for the rating-adjustment screen: scores and team identity only, without the
// raw match row (approval state, manager notes, logger id, lineups, stats).
export function toRatingsMatchDto(m: Row & { homeTeam?: Row | null; awayTeam?: Row | null }) {
    const team = (t: Row | null | undefined) =>
        t ? { id: t.id, name: t.name, shortName: t.shortName, logo: t.logo, color: t.color } : null;
    return {
        id: m.id,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        startTime: m.startTime,
        competition: m.competition,
        homeTeam: team(m.homeTeam),
        awayTeam: team(m.awayTeam),
    };
}
