/**
 * BACKLOG-326/331 shared aggregation: both the Box Score tab (per-player,
 * whole-match) and the Stats tab (per-team, quarter-scoped percentages) derive
 * from the same raw `matchEvents`, per the 2026-09-05 audit in BACKLOG.md --
 * no schema gap, no new event types, same `made` derivation route.ts's own
 * team-stats block already uses (match_events.value is a TEXT column: live
 * events store a real JSON number, box-score-backfilled events store the raw
 * string 'made'/'missed' -- BACKLOG-314).
 */

const isMade = (value: unknown): boolean =>
    typeof value === 'string' ? value === 'made' : Number(value) > 0;

export interface BoxScoreRow {
    playerId: string;
    name: string;
    jerseyName: string | null;
    number: number | null;
    position: string | null;
    teamId: string;
    pts: number;
    ast: number;
    reb: number;
}

export function computeBasketballBoxScore(
    events: any[],
    homeTeamId: string
): { home: BoxScoreRow[]; away: BoxScoreRow[] } {
    const rows = new Map<string, BoxScoreRow>();

    const rowFor = (playerId: string, player: any, teamId: string): BoxScoreRow => {
        let row = rows.get(playerId);
        if (!row) {
            row = {
                playerId,
                name: player?.name ?? 'Unknown',
                jerseyName: player?.jerseyName ?? null,
                number: player?.number ?? null,
                position: player?.position ?? null,
                teamId,
                pts: 0,
                ast: 0,
                reb: 0,
            };
            rows.set(playerId, row);
        }
        return row;
    };

    for (const e of events) {
        const made = isMade(e.value);

        if (e.playerId && e.player) {
            const row = rowFor(e.playerId, e.player, e.teamId);
            switch (e.type) {
                case 'Field Goal':
                    if (made) row.pts += 2;
                    break;
                case 'Three Pointer':
                    if (made) row.pts += 3;
                    break;
                case 'Free Throw':
                    if (made) row.pts += 1;
                    break;
                case 'Rebound':
                    row.reb += 1;
                    break;
                case 'Assist':
                    // BACKLOG-143 fix's standalone-button path -- mirrors
                    // BasketballLogger.tsx's calculateAdvancedStats exactly.
                    row.ast += 1;
                    break;
            }
        }

        // Assist credit via relatedPlayerId on scoring events (the embedded-on-shot
        // path calculateAdvancedStats also counts) -- same match_events column
        // BasketballLogger.tsx maps to `assistPlayerId` client-side, named
        // `relatedPlayerId`/`relatedPlayer` as delivered by GET /api/matches/[id].
        if (
            e.relatedPlayerId &&
            e.relatedPlayer &&
            (e.type === 'Field Goal' || e.type === 'Three Pointer' || e.type === 'Free Throw')
        ) {
            const assistRow = rowFor(e.relatedPlayerId, e.relatedPlayer, e.teamId);
            assistRow.ast += 1;
        }
    }

    const all = Array.from(rows.values()).sort((a, b) => b.pts - a.pts);
    return {
        home: all.filter(r => r.teamId === homeTeamId),
        away: all.filter(r => r.teamId !== homeTeamId),
    };
}

export type BasketballQuarter = 'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface BasketballQuarterStats {
    freeThrows: [number, number];
    threePointers: [number, number];
    twoPointers: [number, number];
    fouls: [number, number];
    rebounds: [number, number];
}

/**
 * BACKLOG-331: Figma's basketball Stats screen is percentage-based (make/attempt
 * splits for shot categories, share-of-combined-total for Fouls/Rebounds),
 * quarter-scoped via `event.period` ('Q1'-'Q4'/'OTn', set on every event by
 * BasketballLogger.tsx's getCurrentPeriod()). "All" includes OT events too;
 * the per-quarter filters intentionally don't (Figma's filter has no OT option).
 */
export function computeBasketballQuarterStats(
    events: any[],
    homeTeamId: string,
    quarter: BasketballQuarter
): BasketballQuarterStats {
    const filtered = quarter === 'ALL' ? events : events.filter(e => e.period === quarter);

    const totals = {
        home: { ftMade: 0, ftAtt: 0, twoMade: 0, twoAtt: 0, threeMade: 0, threeAtt: 0, fouls: 0, rebounds: 0 },
        away: { ftMade: 0, ftAtt: 0, twoMade: 0, twoAtt: 0, threeMade: 0, threeAtt: 0, fouls: 0, rebounds: 0 },
    };

    for (const e of filtered) {
        const side = e.teamId === homeTeamId ? totals.home : totals.away;
        const made = isMade(e.value);

        switch (e.type) {
            case 'Free Throw':
                side.ftAtt++;
                if (made) side.ftMade++;
                break;
            case 'Field Goal':
                side.twoAtt++;
                if (made) side.twoMade++;
                break;
            case 'Three Pointer':
                side.threeAtt++;
                if (made) side.threeMade++;
                break;
            case 'Foul':
            case 'Technical Foul':
                side.fouls++;
                break;
            case 'Rebound':
                side.rebounds++;
                break;
        }
    }

    const pct = (made: number, attempted: number) => (attempted > 0 ? Math.round((made / attempted) * 100) : 0);
    const share = (home: number, away: number): [number, number] => {
        const total = home + away;
        if (total === 0) return [0, 0];
        const homePct = Math.round((home / total) * 100);
        return [homePct, 100 - homePct];
    };

    return {
        freeThrows: [pct(totals.home.ftMade, totals.home.ftAtt), pct(totals.away.ftMade, totals.away.ftAtt)],
        threePointers: [pct(totals.home.threeMade, totals.home.threeAtt), pct(totals.away.threeMade, totals.away.threeAtt)],
        twoPointers: [pct(totals.home.twoMade, totals.home.twoAtt), pct(totals.away.twoMade, totals.away.twoAtt)],
        fouls: share(totals.home.fouls, totals.away.fouls),
        rebounds: share(totals.home.rebounds, totals.away.rebounds),
    };
}
