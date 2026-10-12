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
