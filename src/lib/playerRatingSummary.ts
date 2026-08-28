import { db } from '@/db';
import { playerRatings } from '@/db/schema-ratings';
import { inArray, sql } from 'drizzle-orm';

// BACKLOG-253 (Ratings Redesign Phase 3): the one place the
// COALESCE(finalRating, autoRating)/AVG logic lives, sourced from
// playerRatings -- pattern proven at players/stats/leaders/route.ts:32.
// Batched (accepts an array of playerIds) to avoid N+1 from list endpoints.
export interface PlayerRatingSummary {
    averageRating: number | null; // null = not yet rated, never a fabricated default
    matchesRated: number;
    motmCount: number;
}

const EMPTY_SUMMARY: PlayerRatingSummary = { averageRating: null, matchesRated: 0, motmCount: 0 };

export async function getPlayerRatingSummaries(playerIds: string[]): Promise<Map<string, PlayerRatingSummary>> {
    const map = new Map<string, PlayerRatingSummary>();
    if (playerIds.length === 0) return map;

    const rows = await db
        .select({
            playerId: playerRatings.playerId,
            averageRating: sql<number | null>`AVG(COALESCE(${playerRatings.finalRating}, ${playerRatings.autoRating}))`,
            matchesRated: sql<number>`COUNT(DISTINCT ${playerRatings.matchId})`,
            motmCount: sql<number>`SUM(CASE WHEN ${playerRatings.isMotM} = 1 THEN 1 ELSE 0 END)`,
        })
        .from(playerRatings)
        .where(inArray(playerRatings.playerId, playerIds))
        .groupBy(playerRatings.playerId);

    for (const row of rows) {
        map.set(row.playerId, {
            averageRating: row.averageRating !== null ? Number(Number(row.averageRating).toFixed(2)) : null,
            matchesRated: Number(row.matchesRated || 0),
            motmCount: Number(row.motmCount || 0),
        });
    }

    return map;
}

export async function getPlayerRatingSummary(playerId: string): Promise<PlayerRatingSummary> {
    const map = await getPlayerRatingSummaries([playerId]);
    return map.get(playerId) ?? EMPTY_SUMMARY;
}
