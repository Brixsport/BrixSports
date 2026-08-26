import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { playerTeamAffiliations, players, teams } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CurrentTeam {
    teamId: string;
    teamName: string;
    shortName: string;
    sport: string;
    isPrimary: boolean;
    affiliationType: string;
}

interface PlayerResult {
    id: string;
    name: string;
    jerseyName: string | null;
    position: string;
    college: string | null;
    university: string;
    currentTeams: CurrentTeam[];
    matchedOn: 'name' | 'jerseyName' | 'nickname';
}

// ─── GET /api/players/search ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const excludeTeamId = searchParams.get('excludeTeamId') ?? null;
    const limitParam = parseInt(searchParams.get('limit') ?? '20', 10);
    const limit = Math.min(isNaN(limitParam) ? 20 : Math.max(1, limitParam), 50);

    if (q.length < 2) {
        return NextResponse.json(
            { error: 'q must be at least 2 characters' },
            { status: 422 },
        );
    }

    const qLower = q.toLowerCase();
    const pattern = `%${q}%`;

    // ── 1. Name / jerseyName search ───────────────────────────────────────────

    const nameMatches = await db
        .select({
            id: players.id,
            name: players.name,
            jerseyName: players.jerseyName,
            position: players.position,
            college: players.college,
            university: players.university,
        })
        .from(players)
        .where(
            or(
                sql`LOWER(${players.name}) LIKE LOWER(${pattern})`,
                sql`LOWER(${players.jerseyName}) LIKE LOWER(${pattern})`,
            ),
        )
        .limit(limit)
        .all();

    // Track which players matched on which field
    const matchedOnMap = new Map<string, 'name' | 'jerseyName' | 'nickname'>();
    for (const p of nameMatches) {
        const nameLower = p.name.toLowerCase();
        const jerseyLower = (p.jerseyName ?? '').toLowerCase();
        if (nameLower.includes(qLower)) {
            matchedOnMap.set(p.id, 'name');
        } else if (jerseyLower.includes(qLower)) {
            matchedOnMap.set(p.id, 'jerseyName');
        }
    }

    // ── 2. Nickname search across player_team_affiliations ────────────────────
    // Search the raw JSON column string for the query term (case-insensitive via LOWER).
    // Rows where nicknames is the default '[]' are skipped.

    const nicknameRows = await db
        .select({
            playerId: playerTeamAffiliations.playerId,
            nicknames: playerTeamAffiliations.nicknames,
        })
        .from(playerTeamAffiliations)
        .where(
            and(
                sql`${playerTeamAffiliations.nicknames} != '[]'`,
                sql`LOWER(${playerTeamAffiliations.nicknames}) LIKE LOWER(${pattern})`,
            ),
        )
        .all();

    // Validate each row: parse JSON and confirm the query actually matches a nickname entry
    const nicknameMatchedPlayerIds = new Set<string>();
    for (const row of nicknameRows) {
        try {
            const nicknames: string[] = JSON.parse(row.nicknames ?? '[]');
            if (nicknames.some((n) => n.toLowerCase().includes(qLower))) {
                nicknameMatchedPlayerIds.add(row.playerId);
            }
        } catch {
            // malformed JSON — skip
        }
    }

    // Fetch player rows for nickname-matched IDs not already in nameMatches
    const alreadyFetched = new Set(nameMatches.map((p) => p.id));
    const newNicknameIds = [...nicknameMatchedPlayerIds].filter((id) => !alreadyFetched.has(id));

    const nicknameMatchPlayers = newNicknameIds.length > 0
        ? await db
            .select({
                id: players.id,
                name: players.name,
                jerseyName: players.jerseyName,
                position: players.position,
                college: players.college,
                university: players.university,
            })
            .from(players)
            .where(inArray(players.id, newNicknameIds))
            .all()
        : [];

    for (const p of nicknameMatchPlayers) {
        matchedOnMap.set(p.id, 'nickname');
    }

    // ── 3. Merge all candidate players ───────────────────────────────────────

    const allCandidates = [...nameMatches, ...nicknameMatchPlayers];
    const allIds = allCandidates.map((p) => p.id);

    if (allIds.length === 0) {
        return NextResponse.json({ players: [], total: 0, query: q });
    }

    // ── 4. Fetch affiliations for all candidates ──────────────────────────────

    const affiliationRows = await db
        .select({
            playerId: playerTeamAffiliations.playerId,
            teamId: playerTeamAffiliations.teamId,
            teamName: teams.name,
            shortName: teams.shortName,
            sport: teams.sport,
            isPrimary: playerTeamAffiliations.isPrimary,
            affiliationType: playerTeamAffiliations.affiliationType,
            isActive: playerTeamAffiliations.isActive,
        })
        .from(playerTeamAffiliations)
        .innerJoin(teams, eq(playerTeamAffiliations.teamId, teams.id))
        .where(inArray(playerTeamAffiliations.playerId, allIds))
        .all();

    // Group affiliations by playerId
    const affiliationsByPlayer = new Map<string, typeof affiliationRows>();
    for (const row of affiliationRows) {
        const existing = affiliationsByPlayer.get(row.playerId) ?? [];
        existing.push(row);
        affiliationsByPlayer.set(row.playerId, existing);
    }

    // ── 5. Apply excludeTeamId filter ─────────────────────────────────────────

    const excludedPlayerIds = new Set<string>();
    if (excludeTeamId) {
        for (const [playerId, affils] of affiliationsByPlayer) {
            if (affils.some((a) => a.teamId === excludeTeamId && a.isActive)) {
                excludedPlayerIds.add(playerId);
            }
        }
    }

    // ── 6. Shape response ─────────────────────────────────────────────────────

    const results: PlayerResult[] = [];

    for (const p of allCandidates) {
        if (excludedPlayerIds.has(p.id)) continue;

        const affils = affiliationsByPlayer.get(p.id) ?? [];
        // BACKLOG-227 follow-up, session 56: affiliationsByPlayer intentionally
        // holds both active and past rows (the excludeTeamId check above needs
        // both), but "currentTeams" means current -- past/closed affiliations
        // (e.g. a player's old club after a roster transfer) must not appear
        // here, only in the admin-only affiliationHistory/careerHistory fields.
        const currentTeams: CurrentTeam[] = affils.filter((a) => a.isActive).map((a) => ({
            teamId: a.teamId,
            teamName: a.teamName,
            shortName: a.shortName,
            sport: a.sport,
            isPrimary: !!a.isPrimary,
            affiliationType: a.affiliationType,
        }));

        results.push({
            id: p.id,
            name: p.name,
            jerseyName: p.jerseyName,
            position: p.position,
            college: p.college,
            university: p.university,
            currentTeams,
            matchedOn: matchedOnMap.get(p.id) ?? 'name',
        });
    }

    return NextResponse.json({ players: results, total: results.length, query: q });
}
