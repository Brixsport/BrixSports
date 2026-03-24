/**
 * Migration: Backfill player team memberships
 *
 * Phase 2 goals:
 * - Enrich player_team_affiliations so it can act as the real membership table
 * - Backfill memberships from players.team_id
 * - Keep players.team_id for backward compatibility during transition
 */

import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../index';

interface TableColumnRow {
    name: string;
}

interface LegacyPlayerMembershipRow {
    id: string;
    teamId: string | null;
    number: number | null;
    position: string | null;
    createdAt: number | null;
}

interface ExistingAffiliationRow {
    id: string;
    playerId: string;
    teamId: string;
    isPrimary: number | null;
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const columns = await db.all<TableColumnRow>(sql.raw(`PRAGMA table_info(${tableName})`));
    return columns.some((column) => column.name === columnName);
}

async function ensureMembershipColumns() {
    const columnDefinitions: Array<[string, string]> = [
        ['role', "TEXT DEFAULT 'player'"],
        ['status', "TEXT DEFAULT 'active'"],
        ['is_primary', 'INTEGER DEFAULT 1'],
        ['start_date', 'INTEGER'],
        ['end_date', 'INTEGER'],
        ['jersey_number', 'INTEGER'],
        ['position', 'TEXT'],
    ];

    for (const [columnName, definition] of columnDefinitions) {
        if (!(await columnExists('player_team_affiliations', columnName))) {
            await db.run(sql.raw(`
                ALTER TABLE player_team_affiliations
                ADD COLUMN ${columnName} ${definition}
            `));
        }
    }

    await db.run(sql`
        CREATE INDEX IF NOT EXISTS idx_player_team_affiliations_player_id
        ON player_team_affiliations(player_id)
    `);

    await db.run(sql`
        CREATE INDEX IF NOT EXISTS idx_player_team_affiliations_team_id
        ON player_team_affiliations(team_id)
    `);

    await db.run(sql`
        CREATE INDEX IF NOT EXISTS idx_player_team_affiliations_active
        ON player_team_affiliations(is_active)
    `);

    await db.run(sql`
        CREATE INDEX IF NOT EXISTS idx_player_team_affiliations_primary
        ON player_team_affiliations(is_primary)
    `);
}

export async function backfillPlayerTeamMemberships() {
    console.log('Starting player team membership migration...');

    try {
        await ensureMembershipColumns();

        const legacyPlayers = await db.all<LegacyPlayerMembershipRow>(sql`
            SELECT
                id,
                team_id AS teamId,
                number,
                position,
                created_at AS createdAt
            FROM players
            WHERE team_id IS NOT NULL
        `);

        const existingAffiliations = await db.all<ExistingAffiliationRow>(sql`
            SELECT
                id,
                player_id AS playerId,
                team_id AS teamId,
                is_primary AS isPrimary
            FROM player_team_affiliations
        `);

        const existingPairs = new Map(
            existingAffiliations.map((affiliation) => [`${affiliation.playerId}:${affiliation.teamId}`, affiliation])
        );

        const playersWithPrimary = new Set(
            existingAffiliations
                .filter((affiliation) => Boolean(affiliation.isPrimary))
                .map((affiliation) => affiliation.playerId)
        );

        let membershipsCreated = 0;
        let membershipsUpdated = 0;

        for (const player of legacyPlayers) {
            if (!player.teamId) {
                continue;
            }

            const pairKey = `${player.id}:${player.teamId}`;
            const existing = existingPairs.get(pairKey);
            const shouldBePrimary = !playersWithPrimary.has(player.id);

            if (!existing) {
                await db.run(sql`
                    INSERT INTO player_team_affiliations (
                        id,
                        player_id,
                        team_id,
                        affiliation_type,
                        role,
                        status,
                        is_primary,
                        is_active,
                        start_date,
                        jersey_number,
                        position,
                        created_at
                    )
                    VALUES (
                        ${nanoid()},
                        ${player.id},
                        ${player.teamId},
                        ${'team'},
                        ${'player'},
                        ${'active'},
                        ${shouldBePrimary},
                        ${true},
                        ${player.createdAt},
                        ${player.number},
                        ${player.position},
                        ${player.createdAt}
                    )
                `);

                if (shouldBePrimary) {
                    playersWithPrimary.add(player.id);
                }

                membershipsCreated++;
                continue;
            }

            await db.run(sql`
                UPDATE player_team_affiliations
                SET
                    role = COALESCE(role, ${'player'}),
                    status = COALESCE(status, ${'active'}),
                    is_primary = CASE
                        WHEN is_primary IS NULL THEN ${shouldBePrimary}
                        ELSE is_primary
                    END,
                    start_date = COALESCE(start_date, ${player.createdAt}),
                    jersey_number = COALESCE(jersey_number, ${player.number}),
                    position = COALESCE(position, ${player.position})
                WHERE id = ${existing.id}
            `);

            if (shouldBePrimary) {
                playersWithPrimary.add(player.id);
            }

            membershipsUpdated++;
        }

        console.log('Player team membership migration completed successfully.');
        console.log(`  Memberships created: ${membershipsCreated}`);
        console.log(`  Memberships updated: ${membershipsUpdated}`);
        console.log('  players.team_id remains in place for backward compatibility.');
    } catch (error) {
        console.error('Player team membership migration failed:', error);
        throw error;
    }
}

if (require.main === module) {
    backfillPlayerTeamMemberships()
        .then(() => {
            console.log('Player team membership migration script completed.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Player team membership migration script failed:', error);
            process.exit(1);
        });
}
