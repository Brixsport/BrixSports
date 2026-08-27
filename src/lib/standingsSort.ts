// Pure comparator, no DB imports — safe for both server and client ('use client')
// consumers. Must stay in exact sync with standingsService.ts's STANDINGS_ORDER_BY
// (Drizzle order-by array), which encodes the same chain for DB-level sorting.
// Chain: Points -> GD -> Goals For -> Yellow Cards (fewer better) -> Red Cards
// (fewer better) -> teamId (total order, prevents position flicker on a full tie).
export interface StandingsSortable {
    points: number;
    goalDifference: number;
    goalsFor: number;
    yellowCards?: number | null;
    redCards?: number | null;
    teamId: string;
}

export function compareStandings(a: StandingsSortable, b: StandingsSortable): number {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    const ay = a.yellowCards ?? 0, by = b.yellowCards ?? 0;
    if (ay !== by) return ay - by;
    const ar = a.redCards ?? 0, br = b.redCards ?? 0;
    if (ar !== br) return ar - br;
    if (a.teamId < b.teamId) return -1;
    if (a.teamId > b.teamId) return 1;
    return 0;
}
