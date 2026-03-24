/**
 * Migration: Add player organization affiliations and competition governance
 *
 * Phase 3 goals:
 * - Create player_organization_affiliations table
 * - Add governing_organization_id to competitions
 * - Backfill Bells/BUSA hierarchy and player institutional affiliations
 * - Distinguish competition host from competition governing body
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
    parentOrganizationId: string | null;
}

interface PlayerInstitutionRow {
    id: string;
    university: string | null;
    college: string | null;
    department: string | null;
    createdAt: number | null;
}

interface ExistingPlayerOrganizationAffiliationRow {
    playerId: string;
    organizationId: string;
}

interface CompetitionGovernanceRow {
    id: string;
    name: string;
    hostOrganizationId: string | null;
    governingOrganizationId: string | null;
}

function normalizeWhitespace(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function titleCase(value: string): string {
    return value
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeInstitutionValue(value: string | null | undefined): string {
    return normalizeWhitespace(value);
}

function normalizeCollegeValue(value: string | null | undefined): string {
    const cleaned = normalizeWhitespace(value);
    return cleaned ? cleaned.toUpperCase() : '';
}

function normalizeDepartmentValue(value: string | null | undefined): string {
    const cleaned = normalizeWhitespace(value);
    if (!cleaned) {
        return '';
    }

    if (/^[A-Z0-9/&-]+$/.test(cleaned)) {
        return cleaned.toUpperCase();
    }

    return titleCase(cleaned);
}

function slugify(value: string): string {
    return normalizeWhitespace(value)
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

async function runWithRetry<T>(operation: () => Promise<T>, attempts = 4, delayMs = 750): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt === attempts) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        }
    }

    throw lastError;
}

async function runStatement(query: Parameters<typeof db.run>[0]) {
    return runWithRetry(() => db.run(query));
}

async function allRows<T>(query: Parameters<typeof db.all>[0]) {
    return runWithRetry(() => db.all<T>(query));
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const columns = await allRows<TableColumnRow>(sql.raw(`PRAGMA table_info(${tableName})`));
    return columns.some((column) => column.name === columnName);
}

async function ensurePlayerOrganizationAffiliationsTable() {
    await runStatement(sql`
        CREATE TABLE IF NOT EXISTS player_organization_affiliations (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            affiliation_type TEXT NOT NULL,
            role TEXT DEFAULT 'member',
            status TEXT DEFAULT 'active',
            is_primary INTEGER DEFAULT 0,
            start_date INTEGER,
            end_date INTEGER,
            metadata TEXT,
            created_at INTEGER,
            FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )
    `);

    await runStatement(sql`
        CREATE INDEX IF NOT EXISTS idx_player_org_affiliations_player_id
        ON player_organization_affiliations(player_id)
    `);

    await runStatement(sql`
        CREATE INDEX IF NOT EXISTS idx_player_org_affiliations_org_id
        ON player_organization_affiliations(organization_id)
    `);
}

async function ensureGoverningOrganizationColumn() {
    if (!(await columnExists('competitions', 'governing_organization_id'))) {
        await runStatement(sql.raw(`
            ALTER TABLE competitions
            ADD COLUMN governing_organization_id TEXT REFERENCES organizations(id)
        `));
    }

    await runStatement(sql`
        CREATE INDEX IF NOT EXISTS idx_competitions_governing_organization_id
        ON competitions(governing_organization_id)
    `);
}

export async function addOrganizationAffiliationsAndGovernance() {
    console.log('Starting organization affiliations and governance migration...');

    try {
        await ensurePlayerOrganizationAffiliationsTable();
        await ensureGoverningOrganizationColumn();

        const existingOrganizations = await allRows<ExistingOrganizationRow>(sql`
            SELECT
                id,
                slug,
                name,
                parent_organization_id AS parentOrganizationId
            FROM organizations
        `);

        const organizationsBySlug = new Map(
            existingOrganizations.map((organization) => [organization.slug, organization])
        );

        let organizationsCreated = 0;
        let playerAffiliationsCreated = 0;
        let competitionsUpdated = 0;

        const upsertOrganization = async (params: {
            name: string;
            type: string;
            parentOrganizationId?: string | null;
            isInternalUnit?: boolean;
            displayName?: string | null;
        }): Promise<string> => {
            const normalizedName = normalizeWhitespace(params.name);
            const slugBase = params.parentOrganizationId
                ? `${params.parentOrganizationId}-${slugify(normalizedName)}`
                : slugify(normalizedName);
            const slug = slugBase || `org-${nanoid(8)}`;

            const existing = organizationsBySlug.get(slug);
            if (existing) {
                if (params.parentOrganizationId && existing.parentOrganizationId !== params.parentOrganizationId) {
                    await runStatement(sql`
                        UPDATE organizations
                        SET parent_organization_id = ${params.parentOrganizationId}
                        WHERE id = ${existing.id}
                    `);
                    existing.parentOrganizationId = params.parentOrganizationId;
                }
                return existing.id;
            }

            const id = `org_${slug}`;
            const now = Date.now();

            await runStatement(sql`
                INSERT INTO organizations (
                    id,
                    name,
                    slug,
                    type,
                    display_name,
                    parent_organization_id,
                    is_internal_unit,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (
                    ${id},
                    ${normalizedName},
                    ${slug},
                    ${params.type},
                    ${params.displayName || normalizedName},
                    ${params.parentOrganizationId || null},
                    ${params.isInternalUnit ?? false},
                    ${'active'},
                    ${now},
                    ${now}
                )
            `);

            organizationsBySlug.set(slug, {
                id,
                slug,
                name: normalizedName,
                parentOrganizationId: params.parentOrganizationId || null,
            });
            organizationsCreated++;
            return id;
        };

        const bellsOrganizationId =
            organizationsBySlug.get('bells-university')?.id ||
            organizationsBySlug.get('bells-university-of-technology')?.id ||
            await upsertOrganization({
                name: 'Bells University',
                type: 'university',
            });

        const busaOrganizationId = await upsertOrganization({
            name: 'BUSA',
            type: 'student_association',
            parentOrganizationId: bellsOrganizationId,
            isInternalUnit: true,
            displayName: 'Bells University Student Association',
        });

        const npugaOrganizationId = await upsertOrganization({
            name: 'NPUGA',
            type: 'governing_body',
        });

        const nugaOrganizationId = await upsertOrganization({
            name: 'NUGA',
            type: 'governing_body',
        });

        const existingAffiliations = await allRows<ExistingPlayerOrganizationAffiliationRow>(sql`
            SELECT
                player_id AS playerId,
                organization_id AS organizationId
            FROM player_organization_affiliations
        `);

        const existingAffiliationKeys = new Set(
            existingAffiliations.map((affiliation) => `${affiliation.playerId}:${affiliation.organizationId}`)
        );

        const players = await allRows<PlayerInstitutionRow>(sql`
            SELECT
                id,
                university,
                college,
                department,
                created_at AS createdAt
            FROM players
        `);

        for (const player of players) {
            const universityName = normalizeInstitutionValue(player.university);
            const collegeName = normalizeCollegeValue(player.college);
            const departmentName = normalizeDepartmentValue(player.department);

            const affiliationTimestamp = player.createdAt ?? Date.now();

            let universityOrganizationId: string | null = null;
            if (universityName) {
                universityOrganizationId = universityName === 'Bells University'
                    ? bellsOrganizationId
                    : await upsertOrganization({
                        name: universityName,
                        type: universityName === 'Bells University' ? 'university' : 'university',
                    });

                const universityAffiliationKey = `${player.id}:${universityOrganizationId}`;
                if (!existingAffiliationKeys.has(universityAffiliationKey)) {
                    await runStatement(sql`
                        INSERT INTO player_organization_affiliations (
                            id,
                            player_id,
                            organization_id,
                            affiliation_type,
                            role,
                            status,
                            is_primary,
                            start_date,
                            created_at
                        )
                        VALUES (
                            ${nanoid()},
                            ${player.id},
                            ${universityOrganizationId},
                            ${'university'},
                            ${'student'},
                            ${'active'},
                            ${true},
                            ${affiliationTimestamp},
                            ${affiliationTimestamp}
                        )
                    `);
                    existingAffiliationKeys.add(universityAffiliationKey);
                    playerAffiliationsCreated++;
                }
            }

            let collegeOrganizationId: string | null = null;
            if (collegeName && universityOrganizationId) {
                collegeOrganizationId = await upsertOrganization({
                    name: collegeName,
                    type: 'college',
                    parentOrganizationId: universityOrganizationId,
                    isInternalUnit: true,
                });

                const collegeAffiliationKey = `${player.id}:${collegeOrganizationId}`;
                if (!existingAffiliationKeys.has(collegeAffiliationKey)) {
                    await runStatement(sql`
                        INSERT INTO player_organization_affiliations (
                            id,
                            player_id,
                            organization_id,
                            affiliation_type,
                            role,
                            status,
                            is_primary,
                            start_date,
                            created_at
                        )
                        VALUES (
                            ${nanoid()},
                            ${player.id},
                            ${collegeOrganizationId},
                            ${'college'},
                            ${'student_member'},
                            ${'active'},
                            ${false},
                            ${affiliationTimestamp},
                            ${affiliationTimestamp}
                        )
                    `);
                    existingAffiliationKeys.add(collegeAffiliationKey);
                    playerAffiliationsCreated++;
                }
            }

            if (departmentName && universityOrganizationId) {
                const departmentOrganizationId = await upsertOrganization({
                    name: departmentName,
                    type: 'department',
                    parentOrganizationId: collegeOrganizationId || universityOrganizationId,
                    isInternalUnit: true,
                });

                const departmentAffiliationKey = `${player.id}:${departmentOrganizationId}`;
                if (!existingAffiliationKeys.has(departmentAffiliationKey)) {
                    await runStatement(sql`
                        INSERT INTO player_organization_affiliations (
                            id,
                            player_id,
                            organization_id,
                            affiliation_type,
                            role,
                            status,
                            is_primary,
                            start_date,
                            created_at
                        )
                        VALUES (
                            ${nanoid()},
                            ${player.id},
                            ${departmentOrganizationId},
                            ${'department'},
                            ${'student_member'},
                            ${'active'},
                            ${false},
                            ${affiliationTimestamp},
                            ${affiliationTimestamp}
                        )
                    `);
                    existingAffiliationKeys.add(departmentAffiliationKey);
                    playerAffiliationsCreated++;
                }
            }
        }

        const competitions = await allRows<CompetitionGovernanceRow>(sql`
            SELECT
                id,
                name,
                host_organization_id AS hostOrganizationId,
                governing_organization_id AS governingOrganizationId
            FROM competitions
        `);

        for (const competition of competitions) {
            const upperName = normalizeWhitespace(competition.name).toUpperCase();
            let governingOrganizationId: string | null = null;
            let hostOrganizationId = competition.hostOrganizationId;

            if (upperName.includes('BUSA')) {
                governingOrganizationId = busaOrganizationId;
                if (!hostOrganizationId) {
                    hostOrganizationId = bellsOrganizationId;
                }
            } else if (upperName.includes('NPUGA')) {
                governingOrganizationId = npugaOrganizationId;
            } else if (upperName.includes('NUGA')) {
                governingOrganizationId = nugaOrganizationId;
            }

            if (!governingOrganizationId && !hostOrganizationId) {
                continue;
            }

            if (
                competition.governingOrganizationId !== governingOrganizationId ||
                competition.hostOrganizationId !== hostOrganizationId
            ) {
                await runStatement(sql`
                    UPDATE competitions
                    SET
                        host_organization_id = ${hostOrganizationId},
                        governing_organization_id = ${governingOrganizationId}
                    WHERE id = ${competition.id}
                `);
                competitionsUpdated++;
            }
        }

        console.log('Organization affiliations and governance migration completed successfully.');
        console.log(`  Organizations created: ${organizationsCreated}`);
        console.log(`  Player organization affiliations created: ${playerAffiliationsCreated}`);
        console.log(`  Competitions updated: ${competitionsUpdated}`);
    } catch (error) {
        console.error('Organization affiliations and governance migration failed:', error);
        throw error;
    }
}

if (require.main === module) {
    addOrganizationAffiliationsAndGovernance()
        .then(() => {
            console.log('Organization affiliations and governance migration script completed.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Organization affiliations and governance migration script failed:', error);
            process.exit(1);
        });
}
