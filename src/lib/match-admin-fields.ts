import { matches } from '@/db/schema';

// Explicit column projection for admin bulk responses: every match column except
// the approval fields, the legacy loggerId and the lineups blob. A column added to
// the table later is absent here until someone lists it on purpose.
export const MATCH_BULK_RESPONSE_FIELDS = {
    id: matches.id,
    sport: matches.sport,
    homeTeamId: matches.homeTeamId,
    awayTeamId: matches.awayTeamId,
    homeScore: matches.homeScore,
    awayScore: matches.awayScore,
    status: matches.status,
    startTime: matches.startTime,
    venue: matches.venue,
    competition: matches.competition,
    competitionId: matches.competitionId,
    matchType: matches.matchType,
    competitionLevel: matches.competitionLevel,
    friendlyType: matches.friendlyType,
    friendlyDescription: matches.friendlyDescription,
    stats: matches.stats,
    round: matches.round,
    matchday: matches.matchday,
    groupName: matches.groupName,
    currentPeriod: matches.currentPeriod,
    minute: matches.minute,
    extraTime: matches.extraTime,
    createdAt: matches.createdAt,
    updatedAt: matches.updatedAt,
};
