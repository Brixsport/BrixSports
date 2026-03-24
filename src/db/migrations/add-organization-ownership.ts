/**
 * Migration: Add organization ownership support
 *
 * Phase 1 goals:
 * - Create organizations table
 * - Add ownerOrganizationId to teams
 * - Add hostOrganizationId to competitions
 * - Backfill organization records from existing team and competition data
 * - Preserve legacy text fields for backward compatibility
 */

import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../index';

interface TableColumnRow {
    name: string;
}

interface ExistingOrganizationRow {
    id: string;
    slug: string;
    name: string;
}

interface TeamOwnershipRow {
    id: string;
    name: string;
    university: string | null;
    ownerOrganizationId: string | null;
}

interface CompetitionHostRow {
    id: string;
    name: string;
    hostOrganization: string | null;
    hostOrganizationId: string | null;
}

function normalizeWhitespace(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function slugify(value: string): string {
    return normalizeWhitespace(value)
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function stripSportSuffix(teamName: string): string {
    return teamName
        .replace(/\s+(Football|Basketball|Chess|Scrabble|Table Tennis)\s*\((M|F)\)$/i, '')
        .replace(/\s+(Football|Basketball|Chess|Scrabble|Table Tennis)$/i, '')
        .trim();
}

function looksLikeLocation(value: string): boolean {
    return value.includes(',') || /\bstate\b/i.test(value) || /\bfct\b/i.test(value);
}

function inferOrganizationType(name: string): string {
    if (/\buniversity\b/i.test(name)) return 'university';
    if (/\bcollege\b/i.test(name)) return 'college';
    if (/\bdepartment\b/i.test(name)) return 'department';
    if (/\bfaculty\b/i.test(name)) return 'faculty';
    if (/\b(fc|club|academy)\b/i.test(name)) return 'club';
    return 'organization';
}

function deriveOwnerOrganization(team: Pick<TeamOwnershipRow, 'name' | 'university'>): {
    name: string;
    type: string;
    location: string | null;
} {
    const teamName = normalizeWhitespace(team.name);
    const baseTeamName = stripSportSuffix(teamName);
    const university = normalizeWhitespace(team.university);

    if (university && !looksLikeLocation(university)) {
        return {
            name: university,
            type: inferOrganizationType(university),
            location: null,
        };
    }

    if (/\b(university|college|department|faculty)\b/i.test(baseTeamName)) {
        return {
            name: baseTeamName,
            type: inferOrganizationType(baseTeamName),
            location: university || null,
        };
    }

    return {
        name: university || baseTeamName,
        type: inferOrganizationType(university || baseTeamName),
        location: looksLikeLocation(university) ? university : null,
    };
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const columns = await db.all<TableColumnRow>(sql.raw(`PRAGMA table_info(${tableName})`));
    return columns.some((column) => column.name === columnName);
}

async function ensureOrganizationsTable() {
    await db.run(sql`
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'organization',
            short_name TEXT,
            display_name TEXT,
            parent_organization_id TEXT,
            is_internal_unit INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            location TEXT,
            metadata TEXT,
            created_at INTEGER,
            updated_at INTEGER,
            FOREIGN KEY (parent_organization_id) REFERENCES organizations(id)
        )
    `);

    await db.run(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_unique
        ON organizations(slug)
    `);

    await db.run(sql`
        CREATE INDEX IF NOT EXISTS idx_organizations_parent
        ON organizations(parent_organization_id)
    `);
}

async function ensureOwnershipColumns() {
    if (!(await columnExists('teams', 'owner_organization_id'))) {
        await db.run(sql.raw(`
            ALTER TABLE teams
            ADD COLUMN owner_organization_id TEXT REFERENCES organizations(id)
        `));
    }

    if (!(await columnExists('competitions', 'host_organization_id'))) {
        await db.run(sql.raw(`
            ALTER TABLE competitions
            ADD COLUMN host_organization_id TEXT REFERENCES organizations(id)
        `));
    }

    await db.run(sql`
        CREATE INDEX IF NOT EXISTS idx_teams_owner_organization_id
        ON teams(owner_organization_id)
    `);

    await db.run(sql`
        CREATE INDEX IF NOT EXISTS idx_competitions_host_organization_id
        ON competitions(host_organization_id)
    `);
}

export async function addOrganizationOwnershipSupport() {
    console.log('Starting organization ownership migration...');

    try {
        await ensureOrganizationsTable();
        await ensureOwnershipColumns();

        const existingOrganizations = await db.all<ExistingOrganizationRow>(sql`
            SELECT id, slug, name
            FROM organizations
        `);

        const organizationsBySlug = new Map(
            existingOrganizations.map((organization) => [organization.slug, organization])
        );

        let organizationsCreated = 0;
        let teamsBackfilled = 0;
        let competitionsBackfilled = 0;

        const upsertOrganization = async (
            organizationName: string,
            type: string,
            location: string | null = null
        ): Promise<string> => {
            const normalizedName = normalizeWhitespace(organizationName);
            const slug = slugify(normalizedName);

            const existing = organizationsBySlug.get(slug);
            if (existing) {
                return existing.id;
            }

            const id = `org_${slug || nanoid(8)}`;
            const now = Date.now();

            await db.run(sql`
                INSERT INTO organizations (
                    id,
                    name,
                    slug,
                    type,
                    display_name,
                    location,
                    created_at,
                    updated_at
                )
                VALUES (
                    ${id},
                    ${normalizedName},
                    ${slug || id},
                    ${type},
                    ${normalizedName},
                    ${location},
                    ${now},
                    ${now}
                )
            `);

            organizationsBySlug.set(slug || id, {
                id,
                slug: slug || id,
                name: normalizedName,
            });
            organizationsCreated++;
            return id;
        };

        const teams = await db.all<TeamOwnershipRow>(sql`
            SELECT
                id,
                name,
                university,
                owner_organization_id AS ownerOrganizationId
            FROM teams
        `);

        for (const team of teams) {
            const owner = deriveOwnerOrganization(team);
            if (!owner.name) {
                continue;
            }

            const organizationId = await upsertOrganization(owner.name, owner.type, owner.location);

            if (!team.ownerOrganizationId) {
                await db.run(sql`
                    UPDATE teams
                    SET owner_organization_id = ${organizationId}
                    WHERE id = ${team.id}
                `);
                teamsBackfilled++;
            }
        }

        const competitions = await db.all<CompetitionHostRow>(sql`
            SELECT
                id,
                name,
                host_organization AS hostOrganization,
                host_organization_id AS hostOrganizationId
            FROM competitions
            WHERE host_organization IS NOT NULL
              AND TRIM(host_organization) != ''
        `);

        for (const competition of competitions) {
            const hostName = normalizeWhitespace(competition.hostOrganization);
            if (!hostName) {
                continue;
            }

            const organizationId = await upsertOrganization(
                hostName,
                inferOrganizationType(hostName)
            );

            if (!competition.hostOrganizationId) {
                await db.run(sql`
                    UPDATE competitions
                    SET host_organization_id = ${organizationId}
                    WHERE id = ${competition.id}
                `);
                competitionsBackfilled++;
            }
        }

        console.log('Organization ownership migration completed successfully.');
        console.log(`  Organizations created: ${organizationsCreated}`);
        console.log(`  Teams backfilled: ${teamsBackfilled}`);
        console.log(`  Competitions backfilled: ${competitionsBackfilled}`);
        console.log('  Legacy text fields were preserved for backward compatibility.');
    } catch (error) {
        console.error('Organization ownership migration failed:', error);
        throw error;
    }
}

if (require.main === module) {
    addOrganizationOwnershipSupport()
        .then(() => {
            console.log('Organization ownership migration script completed.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Organization ownership migration script failed:', error);
            process.exit(1);
        });
}
