import { toPublicH2HTeam } from '@/lib/public-h2h';

// Allow-list shaping for a single public transfer. Same fields as the transfers list: the
// staff author id, push-notification bookkeeping and the player's contact/profile columns
// never leave the server.

type Row = Record<string, unknown>;

export function toPublicTransfer(
    t: Row,
    player: Row | null | undefined,
    fromTeam: Row | null | undefined,
    toTeam: Row | null | undefined
) {
    return {
        id: t.id,
        playerId: t.playerId,
        fromTeamId: t.fromTeamId,
        toTeamId: t.toTeamId,
        transferType: t.transferType,
        fee: t.fee,
        status: t.status,
        reliability: t.reliability,
        source: t.source,
        description: t.description,
        imageUrl: t.imageUrl,
        season: t.season,
        announcedAt: t.announcedAt,
        completedAt: t.completedAt,
        createdAt: t.createdAt,
        player: player
            ? {
                  id: player.id,
                  name: player.name,
                  jerseyName: player.jerseyName,
                  number: player.number,
                  position: player.position,
                  image: player.image,
              }
            : null,
        fromTeam: fromTeam ? toPublicH2HTeam(fromTeam) : null,
        toTeam: toTeam ? toPublicH2HTeam(toTeam) : null,
    };
}
