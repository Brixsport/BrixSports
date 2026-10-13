import * as Sentry from '@sentry/nextjs';
import { nanoid } from 'nanoid';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { basketballPlayerStats, footballPlayerStats, competitions } from '@/db/schema';
import { getCurrentSeason } from '@/lib/rosterService';
import {
    deriveStatsKey,
    decideStatsWrite,
    type StatDeltas,
    type StatEffect,
    type StatsKey,
} from '@/lib/player-stats-key';

type StatsTable = typeof footballPlayerStats | typeof basketballPlayerStats;

function tableFor(sport: string): StatsTable | null {
    if (sport === 'Basketball') return basketballPlayerStats;
    if (sport === 'Football') return footballPlayerStats;
    return null;
}

/**
 * Season stats are scoped by (playerId, season, competitionId). The season comes from the
 * match's competition, falling back to the current season; rows written before seasons existed
 * are a frozen baseline that is never written to again once a real season is derivable.
 */
export async function resolveStatsKey(competitionId: string | null): Promise<StatsKey> {
    const currentSeason = await getCurrentSeason();
    let competitionSeason: string | null = null;
    if (competitionId) {
        const competition = await db
            .select({ season: competitions.season })
            .from(competitions)
            .where(eq(competitions.id, competitionId))
            .get();
        competitionSeason = competition?.season ?? null;
    }
    return deriveStatsKey({ competitionId, competitionSeason, currentSeason });
}

function keyCondition(table: StatsTable, playerId: string, key: StatsKey) {
    const t = table as any;
    return and(
        eq(t.playerId, playerId),
        eq(t.season, key.season),
        key.competitionId ? eq(t.competitionId, key.competitionId) : isNull(t.competitionId)
    );
}

function incrementSet(table: StatsTable, deltas: StatDeltas): Record<string, unknown> {
    const set: Record<string, unknown> = {};
    for (const [column, delta] of Object.entries(deltas)) {
        set[column] = sql`COALESCE(${(table as any)[column]}, 0) + ${delta}`;
    }
    return set;
}

/**
 * Add deltas to the player's row for this key. A real competition is one atomic upsert on the
 * unique index. With no competition NULL never conflicts in that index, so the row is looked up
 * by (player, season, competition IS NULL) first and updated, or inserted when absent, inside a
 * single transaction instead of inserting a new row per event.
 */
export async function incrementPlayerStats(sport: string, playerId: string, key: StatsKey, deltas: StatDeltas) {
    const table = tableFor(sport);
    if (!table || Object.keys(deltas).length === 0) return;
    const t = table as any;

    const insertValues = {
        id: `stats_${nanoid()}`,
        playerId,
        season: key.season,
        competitionId: key.competitionId,
        ...deltas,
    };

    if (key.competitionId) {
        await db
            .insert(t)
            .values(insertValues)
            .onConflictDoUpdate({
                target: [t.playerId, t.season, t.competitionId],
                set: incrementSet(table, deltas),
            });
        return;
    }

    await db.transaction(async (tx) => {
        const existing = await tx
            .select({ id: t.id })
            .from(t)
            .where(keyCondition(table, playerId, key))
            .limit(1)
            .get();
        if (decideStatsWrite(key.competitionId, existing?.id) === 'update-existing') {
            await tx.update(t).set(incrementSet(table, deltas)).where(eq(t.id, existing!.id));
        } else {
            await tx.insert(t).values(insertValues);
        }
    });
}

/**
 * Subtract deltas from the player's row for this exact key only (never another season or
 * competition), floored at zero, as a single atomic statement. A missing row is a no-op.
 */
export async function decrementPlayerStats(sport: string, playerId: string, key: StatsKey, deltas: StatDeltas) {
    const table = tableFor(sport);
    if (!table || Object.keys(deltas).length === 0) return;
    const t = table as any;

    const set: Record<string, unknown> = {};
    for (const [column, delta] of Object.entries(deltas)) {
        set[column] = sql`MAX(COALESCE(${t[column]}, 0) - ${delta}, 0)`;
    }

    let where = keyCondition(table, playerId, key);
    if (!key.competitionId) {
        // Several NULL-competition rows can exist for one key; touch exactly one.
        const row = await db.select({ id: t.id }).from(t).where(where).limit(1).get();
        if (!row) return;
        where = eq(t.id, row.id);
    }
    await db.update(t).set(set).where(where);
}

/** Credit an event's stat effects. Never throws: the event itself is already saved. */
export async function recordEventStats(sport: string, competitionId: string | null, effects: StatEffect[]) {
    if (effects.length === 0) return;
    try {
        const key = await resolveStatsKey(competitionId);
        for (const effect of effects) {
            await incrementPlayerStats(sport, effect.playerId, key, effect.deltas);
        }
    } catch (error) {
        console.error('Error updating player stats:', error);
        Sentry.captureException(error, { tags: { area: 'player-stats' }, extra: { sport, competitionId, players: effects.map(e => e.playerId) } });
    }
}

/** Reverse an event's stat effects. Never throws: the event is already deleted. */
export async function revertEventStats(sport: string, competitionId: string | null, effects: StatEffect[]) {
    if (effects.length === 0) return;
    try {
        const key = await resolveStatsKey(competitionId);
        for (const effect of effects) {
            await decrementPlayerStats(sport, effect.playerId, key, effect.deltas);
        }
    } catch (error) {
        console.error('[revertEventStats] stat reversion failed:', error);
        Sentry.captureException(error, { tags: { area: 'player-stats-revert' }, extra: { sport, competitionId, players: effects.map(e => e.playerId) } });
    }
}
