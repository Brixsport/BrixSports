// The public competitions list is edge-cached and shared by every visitor, so it
// returns an explicit whitelist of fields instead of the raw database row. Internal
// fields (organisation ids, entry fee, rules, squad settings, archive flag, draw
// state, stored final standings) never leave the server on this path.

type CompetitionRow = Record<string, unknown> & { id: string; name: string };

const PUBLIC_FIELDS = [
  'id',
  'name',
  'sport',
  'isMultiSport',
  'format',
  'structure',
  'season',
  'logo',
  'startDate',
  'endDate',
  'description',
  'level',
  'gender',
  'numberOfTeams',
  'numberOfGroups',
  'teamsPerGroup',
  'registrationOpen',
  'registrationDeadline',
  'status',
  'winnerId',
  'runnerUpId',
  'thirdPlaceId',
  'completedAt',
  'highlights',
  'isFeatured',
  'followersCount',
  'hostOrganization',
  'createdAt',
] as const;

export function toPublicCompetition(row: CompetitionRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    if (key in row) out[key] = row[key];
  }
  return out;
}

export interface CompetitionGroupLike {
  groupKey: string;
  name: string;
  sport: unknown;
  latest: CompetitionRow;
  seasons: CompetitionRow[];
}

export function toPublicGroup(group: CompetitionGroupLike) {
  return {
    groupKey: group.groupKey,
    name: group.name,
    sport: group.sport,
    latest: toPublicCompetition(group.latest),
    seasons: group.seasons.map(toPublicCompetition),
  };
}
