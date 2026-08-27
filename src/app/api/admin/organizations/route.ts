import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
    organizations,
    playerOrganizationAffiliations,
    teams,
} from '@/db/schema';
import { getAuthUser } from '@/lib/auth';

const ALLOWED_ORGANIZATION_TYPES = new Set([
    'organization',
    'university',
    'college',
    'department',
    'club',
    'academy',
    'association',
    'student_association',
    'governing_body',
]);

function slugify(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'organization';
}

async function getUniqueSlug(baseSlug: string) {
    let slug = baseSlug;
    let counter = 2;

    while (true) {
        const existing = await db
            .select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.slug, slug))
            .get();

        if (!existing) {
            return slug;
        }

        slug = `${baseSlug}-${counter}`;
        counter += 1;
    }
}

async function requireAdmin(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user || user.role !== 'admin') {
        return null;
    }

    return user;
}

export async function GET(request: NextRequest) {
    try {
        const user = await requireAdmin(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // BACKLOG-283: these three queries previously had zero .limit() clause
        // -- an unbounded full-table scan, the exact anti-pattern CLAUDE.md
        // flags. Safety caps below (raise if any of these genuinely exceed the
        // cap); the response itself is separately paginated below via
        // limit/offset since parent/count relationships need the full set to
        // resolve correctly, not just the current page.
        const { searchParams } = new URL(request.url);
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50), 200);
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

        const [organizationRows, teamRows, affiliationRows] = await Promise.all([
            db.select().from(organizations).orderBy(asc(organizations.name)).limit(500),
            db.select({
                id: teams.id,
                ownerOrganizationId: teams.ownerOrganizationId,
            }).from(teams).limit(500),
            db.select({
                id: playerOrganizationAffiliations.id,
                organizationId: playerOrganizationAffiliations.organizationId,
            }).from(playerOrganizationAffiliations).limit(5000),
        ]);

        const organizationsById = new Map(organizationRows.map((organization) => [organization.id, organization]));

        const childCountByOrganizationId = new Map<string, number>();
        for (const organization of organizationRows) {
            if (!organization.parentOrganizationId) {
                continue;
            }

            childCountByOrganizationId.set(
                organization.parentOrganizationId,
                (childCountByOrganizationId.get(organization.parentOrganizationId) ?? 0) + 1
            );
        }

        const teamCountByOrganizationId = new Map<string, number>();
        for (const team of teamRows) {
            if (!team.ownerOrganizationId) {
                continue;
            }

            teamCountByOrganizationId.set(
                team.ownerOrganizationId,
                (teamCountByOrganizationId.get(team.ownerOrganizationId) ?? 0) + 1
            );
        }

        const playerAffiliationCountByOrganizationId = new Map<string, number>();
        for (const affiliation of affiliationRows) {
            playerAffiliationCountByOrganizationId.set(
                affiliation.organizationId,
                (playerAffiliationCountByOrganizationId.get(affiliation.organizationId) ?? 0) + 1
            );
        }

        const enrichedOrganizations = organizationRows.map((organization) => ({
            ...organization,
            parent: organization.parentOrganizationId
                ? organizationsById.get(organization.parentOrganizationId) ?? null
                : null,
            counts: {
                childOrganizations: childCountByOrganizationId.get(organization.id) ?? 0,
                ownedTeams: teamCountByOrganizationId.get(organization.id) ?? 0,
                playerAffiliations: playerAffiliationCountByOrganizationId.get(organization.id) ?? 0,
            },
        }));

        const total = enrichedOrganizations.length;
        const pagedOrganizations = enrichedOrganizations.slice(offset, offset + limit);

        return NextResponse.json({
            success: true,
            organizations: pagedOrganizations,
            total,
        }, {
            headers: {
                'X-Total-Count': String(total),
                'X-Limit': String(limit),
                'X-Offset': String(offset),
            },
        });
    } catch (error) {
        console.error('Error fetching organizations:', error);
        return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await requireAdmin(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const type = typeof body.type === 'string' ? body.type.trim() : 'organization';
        const shortName = typeof body.shortName === 'string' ? body.shortName.trim() : null;
        const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : null;
        const parentOrganizationId = typeof body.parentOrganizationId === 'string' && body.parentOrganizationId.trim()
            ? body.parentOrganizationId.trim()
            : null;
        const location = typeof body.location === 'string' ? body.location.trim() : null;
        const status = typeof body.status === 'string' && body.status.trim() ? body.status.trim() : 'active';
        const isInternalUnit = Boolean(body.isInternalUnit);

        if (!name) {
            return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
        }

        if (!ALLOWED_ORGANIZATION_TYPES.has(type)) {
            return NextResponse.json({ error: 'Invalid organization type' }, { status: 400 });
        }

        if (parentOrganizationId) {
            const parent = await db
                .select({ id: organizations.id })
                .from(organizations)
                .where(eq(organizations.id, parentOrganizationId))
                .get();

            if (!parent) {
                return NextResponse.json({ error: 'Selected parent organization was not found' }, { status: 400 });
            }
        }

        const existingOrganization = await db
            .select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.name, name))
            .get();

        if (existingOrganization) {
            return NextResponse.json({ error: 'An organization with this name already exists' }, { status: 409 });
        }

        const baseSlug = slugify(displayName || shortName || name);
        const slug = await getUniqueSlug(baseSlug);
        const organizationId = `org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const createdRows = await db
            .insert(organizations)
            .values({
                id: organizationId,
                name,
                slug,
                type,
                shortName: shortName || null,
                displayName: displayName || null,
                parentOrganizationId,
                isInternalUnit,
                status,
                location: location || null,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning();

        return NextResponse.json({
            success: true,
            organization: createdRows[0] ?? null,
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating organization:', error);
        return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
    }
}
