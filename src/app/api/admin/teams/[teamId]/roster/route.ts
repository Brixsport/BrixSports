import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { organizations, playerTeamAffiliations, players, teams } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExistingEntry {
    mode: 'existing';
    playerId: string;
    jerseyNumber?: number;
    position?: string;
    nicknames?: string[];
}

interface NewEntry {
    mode: 'new';
    name: string;
    jerseyName?: string;
    number: number;
    position: string;
    college?: string;
    department?: string;
    university?: string;
    email?: string;
    nicknames?: string[];
}

type RosterEntry = ExistingEntry | NewEntry;

interface EntryResult {
    index: number;
    mode: 'existing' | 'new';
    status: 'inserted' | 'skipped' | 'error';
    reason?: string;
    playerId?: string;
    matchedPlayerId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveAffiliationType(teamId: string): Promise<string> {
    const team = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
        columns: { ownerOrganizationId: true },
    });

    if (!team?.ownerOrganizationId) return 'club';

    const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, team.ownerOrganizationId),
        columns: { type: true },
    });

    if (!org) return 'club';
    if (org.type === 'college') return 'college';
    if (org.type === 'university') return 'university';
    return 'club';
}

// ─── POST /api/admin/teams/[teamId]/roster ────────────────────────────────────

export async function POST(
    request: NextRequest,
    { params }: { params: { teamId: string } },
) {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = params;

    const teamExists = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
        columns: { id: true },
    });
    if (!teamExists) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    let body: { entries: RosterEntry[] };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });
    }

    if (!Array.isArray(body.entries) || body.entries.length === 0) {
        return NextResponse.json({ error: 'entries must be a non-empty array' }, { status: 422 });
    }

    const affiliationType = await resolveAffiliationType(teamId);
    const results: EntryResult[] = [];

    for (let i = 0; i < body.entries.length; i++) {
        const entry = body.entries[i];

        if (entry.mode === 'existing') {
            // 1. Verify player exists
            const player = await db.query.players.findFirst({
                where: eq(players.id, entry.playerId),
                columns: { id: true },
            });
            if (!player) {
                results.push({ index: i, mode: 'existing', status: 'error', reason: 'player_not_found' });
                continue;
            }

            // 2. Check for existing affiliation
            const existing = await db
                .select({ id: playerTeamAffiliations.id })
                .from(playerTeamAffiliations)
                .where(
                    and(
                        eq(playerTeamAffiliations.playerId, entry.playerId),
                        eq(playerTeamAffiliations.teamId, teamId),
                    ),
                )
                .get();

            if (existing) {
                results.push({ index: i, mode: 'existing', status: 'skipped', reason: 'already_affiliated', playerId: entry.playerId });
                continue;
            }

            // 3. Insert affiliation
            await db.insert(playerTeamAffiliations).values({
                id: nanoid(),
                playerId: entry.playerId,
                teamId,
                affiliationType,
                isPrimary: false,
                isActive: true,
                jerseyNumber: entry.jerseyNumber ?? null,
                position: entry.position ?? null,
                nicknames: JSON.stringify(entry.nicknames ?? []),
                startDate: new Date(),
                createdAt: new Date(),
            });

            results.push({ index: i, mode: 'existing', status: 'inserted', playerId: entry.playerId });

        } else if (entry.mode === 'new') {
            if (!entry.name?.trim() || !entry.position?.trim() || entry.number == null) {
                results.push({ index: i, mode: 'new', status: 'error', reason: 'name, number, and position are required' });
                continue;
            }

            // 1. Pre-flight dedup: match on name + college
            const collegeCondition = entry.college
                ? eq(players.college, entry.college)
                : isNull(players.college);

            const duplicate = await db.query.players.findFirst({
                where: and(
                    sql`LOWER(${players.name}) = LOWER(${entry.name.trim()})`,
                    collegeCondition,
                ),
                columns: { id: true },
            });

            if (duplicate) {
                results.push({
                    index: i,
                    mode: 'new',
                    status: 'skipped',
                    reason: 'possible_duplicate',
                    matchedPlayerId: duplicate.id,
                });
                continue;
            }

            // 2. Insert player (no legacy teamId)
            const newPlayerId = nanoid();
            await db.insert(players).values({
                id: newPlayerId,
                name: entry.name.trim(),
                jerseyName: entry.jerseyName?.trim() || entry.name.trim().split(' ').pop()?.toUpperCase() || entry.name.trim(),
                number: entry.number,
                position: entry.position.trim(),
                teamId: null,
                college: entry.college ?? null,
                department: entry.department ?? null,
                university: entry.university ?? 'Bells University of Technology',
                isExternal: false,
                email: entry.email ?? null,
                rating: 7.0,
                eyePoints: 0,
                createdAt: new Date(),
            });

            // 3. Insert affiliation
            await db.insert(playerTeamAffiliations).values({
                id: nanoid(),
                playerId: newPlayerId,
                teamId,
                affiliationType,
                isPrimary: false,
                isActive: true,
                jerseyNumber: entry.number,
                position: entry.position.trim(),
                nicknames: JSON.stringify(entry.nicknames ?? []),
                startDate: new Date(),
                createdAt: new Date(),
            });

            results.push({ index: i, mode: 'new', status: 'inserted', playerId: newPlayerId });

        } else {
            results.push({ index: i, mode: (entry as RosterEntry).mode, status: 'error', reason: 'unknown_mode' });
        }
    }

    const summary = {
        inserted: results.filter((r) => r.status === 'inserted').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        errors: results.filter((r) => r.status === 'error').length,
    };

    return NextResponse.json({ results, summary });
}

// ─── GET /api/admin/teams/[teamId]/roster ─────────────────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: { teamId: string } },
) {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = params;

    const teamExists = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
        columns: { id: true },
    });
    if (!teamExists) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const rows = await db
        .select({
            playerId: playerTeamAffiliations.playerId,
            name: players.name,
            jerseyName: players.jerseyName,
            position: playerTeamAffiliations.position,
            jerseyNumber: playerTeamAffiliations.jerseyNumber,
            affiliationType: playerTeamAffiliations.affiliationType,
            isPrimary: playerTeamAffiliations.isPrimary,
            isActive: playerTeamAffiliations.isActive,
            nicknames: playerTeamAffiliations.nicknames,
            college: players.college,
            university: players.university,
        })
        .from(playerTeamAffiliations)
        .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
        .where(eq(playerTeamAffiliations.teamId, teamId))
        .orderBy(sql`${playerTeamAffiliations.isPrimary} DESC`, players.name)
        .all();

    const roster = rows.map((r) => ({
        ...r,
        nicknames: (() => {
            try { return JSON.parse(r.nicknames ?? '[]'); }
            catch { return []; }
        })(),
    }));

    return NextResponse.json({ teamId, roster, total: roster.length });
}
