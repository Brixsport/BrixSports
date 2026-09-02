// Placement resolution for BACKLOG-323: the explicit-coordinate path
// (resolveSlot/toPitchCoords/isV2Lineup) for the new placementVersion:2
// lineup shape, plus inferPlacementLegacy() -- the original read-time
// role-bucket-inference heuristic from FullPitchLineups.tsx, moved here
// verbatim (BACKLOG-322's four fixes preserved byte-identical) to serve
// as the permanent fallback for any lineup without stored coordinates
// (pre-migration data, seeded data, a stale client).
//
// inferPlacementLegacy deliberately does NOT read from ./formations.ts's
// canonical registry -- it carries its own frozen copy of the original
// FORMATION_TEMPLATES so adding formations to the canonical registry
// later (e.g. a new admin-only formation) can never change legacy
// inference's behavior for lineups that still rely on it.

import { Player } from '@/types';
import type { PitchPlayer } from '@/components/lineup/ResponsivePitch';
import type { PlacementEntry } from '@/components/lineup/useLineupPlacement';
import { FORMATIONS, type FormationSlot as RegistrySlot } from './formations';

// ============================================================================
// V2 (explicit-coordinate) path
// ============================================================================

export interface StoredLineupEntry {
    playerId: string;
    slotId?: string;
    x?: number;
    y?: number;
    position?: string;
    isStarter?: boolean;
    [key: string]: unknown;
}

export interface TeamLineupData {
    formation?: string;
    placementVersion?: number;
    starters?: StoredLineupEntry[];
    substitutes?: StoredLineupEntry[];
    status?: string;
    [key: string]: unknown;
}

/** A team's stored lineup is V2 iff every starter carries the marker AND a slotId. */
export function isV2Lineup(team: TeamLineupData | null | undefined): boolean {
    if (!team || team.placementVersion !== 2) return false;
    const starters = team.starters || [];
    if (starters.length === 0) return false;
    return starters.every((s) => typeof s.slotId === 'string' && s.slotId.length > 0);
}

export function resolveSlot(formationId: string, slotId: string): RegistrySlot | undefined {
    return FORMATIONS[formationId]?.slots.find((s) => s.id === slotId);
}

/**
 * Maps a canonical own-half slot (or a stored raw x/y snapshot) onto full-pitch
 * render space for one side. Same half-mapping + mirror math as the legacy
 * assignPlayerToSlot below, so a V2 lineup and a legacy-inferred one render
 * through the same visual convention.
 */
export function toPitchCoords(
    slot: { x: number; y: number },
    isHome: boolean,
): { x: number; y: number } {
    if (isHome) {
        return { x: slot.x, y: 100 - (slot.y / 100) * 52 };
    }
    return { x: 100 - slot.x, y: (slot.y / 100) * 48 };
}

// ============================================================================
// Legacy (role-bucket-inference) path -- BACKLOG-322, preserved verbatim
// ============================================================================

type LegacyFormationSlot = { x: number; y: number; role: string };
type LegacyFormationTemplate = LegacyFormationSlot[];

// Frozen copy of FullPitchLineups.tsx's original FORMATION_TEMPLATES at the
// time of extraction (BACKLOG-323 step 3). Do not add new formations here --
// add them to ./formations.ts's canonical registry instead, which the V2
// path above reads from. This table exists only to keep legacy inference's
// behavior frozen for lineups that predate stored coordinates.
const LEGACY_FORMATION_TEMPLATES: Record<string, LegacyFormationTemplate> = {
    '4-4-2': [
        { x: 50, y: 5, role: 'GK' },
        { x: 15, y: 25, role: 'DEF' }, { x: 38, y: 25, role: 'DEF' }, { x: 62, y: 25, role: 'DEF' }, { x: 85, y: 25, role: 'DEF' },
        { x: 15, y: 55, role: 'MID' }, { x: 38, y: 55, role: 'MID' }, { x: 62, y: 55, role: 'MID' }, { x: 85, y: 55, role: 'MID' },
        { x: 35, y: 85, role: 'FW' }, { x: 65, y: 85, role: 'FW' },
    ],
    '4-3-3': [
        { x: 50, y: 5, role: 'GK' },
        { x: 15, y: 25, role: 'DEF' }, { x: 38, y: 25, role: 'DEF' }, { x: 62, y: 25, role: 'DEF' }, { x: 85, y: 25, role: 'DEF' },
        { x: 20, y: 50, role: 'MID' }, { x: 50, y: 45, role: 'MID' }, { x: 80, y: 50, role: 'MID' },
        { x: 20, y: 82, role: 'FW' }, { x: 50, y: 87, role: 'FW' }, { x: 80, y: 82, role: 'FW' },
    ],
    '4-2-3-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 10, y: 25, role: 'DEF' }, { x: 36, y: 25, role: 'DEF' }, { x: 64, y: 25, role: 'DEF' }, { x: 90, y: 25, role: 'DEF' },
        { x: 35, y: 45, role: 'DM' }, { x: 65, y: 45, role: 'DM' },
        { x: 15, y: 65, role: 'AM' }, { x: 50, y: 65, role: 'AM' }, { x: 85, y: 65, role: 'AM' },
        { x: 50, y: 88, role: 'FW' },
    ],
    '3-4-3': [
        { x: 50, y: 5, role: 'GK' },
        { x: 20, y: 25, role: 'DEF' }, { x: 50, y: 25, role: 'DEF' }, { x: 80, y: 25, role: 'DEF' },
        { x: 10, y: 50, role: 'MID' }, { x: 35, y: 50, role: 'MID' }, { x: 65, y: 50, role: 'MID' }, { x: 90, y: 50, role: 'MID' },
        { x: 20, y: 80, role: 'FW' }, { x: 50, y: 85, role: 'FW' }, { x: 80, y: 80, role: 'FW' },
    ],
    '3-5-2': [
        { x: 50, y: 5, role: 'GK' },
        { x: 20, y: 25, role: 'DEF' }, { x: 50, y: 25, role: 'DEF' }, { x: 80, y: 25, role: 'DEF' },
        { x: 10, y: 50, role: 'MID' }, { x: 30, y: 50, role: 'MID' }, { x: 50, y: 45, role: 'MID' }, { x: 70, y: 50, role: 'MID' }, { x: 90, y: 50, role: 'MID' },
        { x: 35, y: 85, role: 'FW' }, { x: 65, y: 85, role: 'FW' },
    ],
    '5-3-2': [
        { x: 50, y: 5, role: 'GK' },
        { x: 5, y: 28, role: 'DEF' }, { x: 27, y: 28, role: 'DEF' }, { x: 50, y: 28, role: 'DEF' }, { x: 73, y: 28, role: 'DEF' }, { x: 95, y: 28, role: 'DEF' },
        { x: 25, y: 55, role: 'MID' }, { x: 50, y: 50, role: 'MID' }, { x: 75, y: 55, role: 'MID' },
        { x: 35, y: 85, role: 'FW' }, { x: 65, y: 85, role: 'FW' },
    ],
    '5-4-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 5, y: 28, role: 'DEF' }, { x: 27, y: 28, role: 'DEF' }, { x: 50, y: 28, role: 'DEF' }, { x: 73, y: 28, role: 'DEF' }, { x: 95, y: 28, role: 'DEF' },
        { x: 12, y: 58, role: 'MID' }, { x: 37, y: 58, role: 'MID' }, { x: 63, y: 58, role: 'MID' }, { x: 88, y: 58, role: 'MID' },
        { x: 50, y: 85, role: 'FW' },
    ],
    '3-4-2-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 20, y: 25, role: 'DEF' }, { x: 50, y: 25, role: 'DEF' }, { x: 80, y: 25, role: 'DEF' },
        { x: 10, y: 50, role: 'MID' }, { x: 40, y: 50, role: 'MID' }, { x: 60, y: 50, role: 'MID' }, { x: 90, y: 50, role: 'MID' },
        { x: 35, y: 70, role: 'AM' }, { x: 65, y: 70, role: 'AM' },
        { x: 50, y: 88, role: 'FW' },
    ],
    '4-1-4-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 10, y: 25, role: 'DEF' }, { x: 36, y: 25, role: 'DEF' }, { x: 64, y: 25, role: 'DEF' }, { x: 90, y: 25, role: 'DEF' },
        { x: 50, y: 40, role: 'DM' },
        { x: 10, y: 60, role: 'MID' }, { x: 35, y: 60, role: 'MID' }, { x: 65, y: 60, role: 'MID' }, { x: 90, y: 60, role: 'MID' },
        { x: 50, y: 85, role: 'FW' },
    ],
    '4-4-1-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 10, y: 25, role: 'DEF' }, { x: 35, y: 25, role: 'DEF' }, { x: 65, y: 25, role: 'DEF' }, { x: 90, y: 25, role: 'DEF' },
        { x: 10, y: 50, role: 'MID' }, { x: 35, y: 50, role: 'MID' }, { x: 65, y: 50, role: 'MID' }, { x: 90, y: 50, role: 'MID' },
        { x: 50, y: 70, role: 'AM' },
        { x: 50, y: 88, role: 'FW' },
    ],
    '4-1-2-1-2': [
        { x: 50, y: 5, role: 'GK' },
        { x: 15, y: 25, role: 'DEF' }, { x: 38, y: 25, role: 'DEF' }, { x: 62, y: 25, role: 'DEF' }, { x: 85, y: 25, role: 'DEF' },
        { x: 50, y: 40, role: 'DM' },
        { x: 30, y: 55, role: 'MID' }, { x: 70, y: 55, role: 'MID' },
        { x: 50, y: 70, role: 'AM' },
        { x: 35, y: 85, role: 'FW' }, { x: 65, y: 85, role: 'FW' },
    ],
    '3-2-4-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 20, y: 25, role: 'DEF' }, { x: 50, y: 25, role: 'DEF' }, { x: 80, y: 25, role: 'DEF' },
        { x: 35, y: 45, role: 'DM' }, { x: 65, y: 45, role: 'DM' },
        { x: 10, y: 65, role: 'MID' }, { x: 35, y: 65, role: 'AM' }, { x: 65, y: 65, role: 'AM' }, { x: 90, y: 65, role: 'MID' },
        { x: 50, y: 88, role: 'FW' },
    ],
    '1-2-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 50, y: 30, role: 'DEF' },
        { x: 20, y: 50, role: 'MID' }, { x: 80, y: 50, role: 'MID' },
        { x: 50, y: 75, role: 'FW' },
    ],
    '2-1-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 30, y: 30, role: 'DEF' }, { x: 70, y: 30, role: 'DEF' },
        { x: 50, y: 55, role: 'MID' },
        { x: 50, y: 80, role: 'FW' },
    ],
    '2-2': [
        { x: 50, y: 5, role: 'GK' },
        { x: 30, y: 30, role: 'DEF' }, { x: 70, y: 30, role: 'DEF' },
        { x: 30, y: 70, role: 'FW' }, { x: 70, y: 70, role: 'FW' },
    ],
    '1-1-2': [
        { x: 50, y: 5, role: 'GK' },
        { x: 50, y: 30, role: 'DEF' },
        { x: 50, y: 55, role: 'MID' },
        { x: 30, y: 80, role: 'FW' }, { x: 70, y: 80, role: 'FW' },
    ],
    '3-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 20, y: 30, role: 'DEF' }, { x: 50, y: 30, role: 'DEF' }, { x: 80, y: 30, role: 'DEF' },
        { x: 50, y: 75, role: 'FW' },
    ],
    '1-3': [
        { x: 50, y: 5, role: 'GK' },
        { x: 50, y: 30, role: 'DEF' },
        { x: 20, y: 70, role: 'FW' }, { x: 50, y: 75, role: 'FW' }, { x: 80, y: 70, role: 'FW' },
    ],
    'basketball': [
        { x: 50, y: 85, role: 'PG' },
        { x: 20, y: 65, role: 'SG' },
        { x: 80, y: 65, role: 'SF' },
        { x: 35, y: 40, role: 'PF' },
        { x: 65, y: 40, role: 'C' },
    ],
    '3x3': [
        { x: 50, y: 75, role: 'G' },
        { x: 25, y: 45, role: 'F' },
        { x: 75, y: 45, role: 'C' },
    ],
};

const LEGACY_DEFAULT_FORMATION = '4-4-2';
const LEGACY_DEFAULT_FORMATION_5ASIDE = '1-2-1';

type PlayerStatsMap = Map<string, { goals: number; assists: number; card?: 'yellow' | 'red'; penalty?: boolean }>;

/** Verbatim from FullPitchLineups.tsx's parsePositionToBucket. */
function parsePositionToBucket(pos: string): string {
    const p = pos.toLowerCase().trim();
    if (p === 'pg' || p.includes('point guard')) return 'PG';
    if (p === 'sg' || p.includes('shooting guard')) return 'SG';
    if (p === 'sf' || p.includes('small forward')) return 'SF';
    if (p === 'pf' || p.includes('power forward')) return 'PF';
    if (p === 'c' || p === 'center') return 'C';
    if (p === 'g' || p === 'guard') return 'G';
    if (p === 'f' || p === 'forward') return 'F';

    if (p.includes('gk') || p.includes('goalkeeper') || p.includes('goal keeper') ||
        p === 'g' || p.includes('goalie') || p.includes('keeper')) return 'GK';
    if (p.includes('dm') || p.includes('defensive mid') || p.includes('cdm')) return 'DM';
    if (p.includes('am') || p.includes('attacking mid') || p.includes('cam')) return 'AM';
    if (p.includes('def') || p.includes('back') || p.includes('cb') || p.includes('lb') || p.includes('rb') || p.includes('wb') || p.includes('fix')) return 'DEF';
    if (p.includes('mid') || p.includes('wing') || p.includes('lm') || p.includes('rm') || p.includes('cm') || p.includes('ala')) return 'MID';
    if (p.includes('fw') || p.includes('st') || p.includes('cf') || p.includes('striker') || p.includes('forward') || p.includes('pivot')) return 'FW';
    return 'MID';
}

/** Verbatim from FullPitchLineups.tsx's getAdjacentRoles. */
function getAdjacentRoles(role: string): string[] {
    const adjacencyMap: Record<string, string[]> = {
        GK: [],
        DEF: ['DM', 'MID'],
        DM: ['DEF', 'MID'],
        MID: ['DM', 'AM', 'DEF', 'FW'],
        AM: ['MID', 'FW'],
        FW: ['AM', 'MID'],
    };
    return adjacencyMap[role] || [];
}

/** Verbatim from FullPitchLineups.tsx's assignPlayerToSlot. */
function assignPlayerToSlot(
    playerEntry: any,
    slot: LegacyFormationSlot,
    isHome: boolean,
    pitchPlayers: PitchPlayer[],
    playerStats: PlayerStatsMap,
) {
    let finalX = slot.x;
    let finalY = 0;

    if (isHome) {
        finalY = 100 - (slot.y / 100) * 52;
    } else {
        finalY = (slot.y / 100) * 48;
        finalX = 100 - slot.x;
    }

    const stats = playerStats.get(playerEntry.playerId) || { goals: 0, assists: 0 };

    pitchPlayers.push({
        player: playerEntry.player,
        position: { x: finalX, y: finalY },
        rating: playerEntry.rating || 0,
        isCaptain: !!playerEntry.isCaptain,
        isMotM: !!playerEntry.isMotM,
        goals: stats.goals,
        assists: stats.assists,
        card: stats.card,
        penalty: stats.penalty,
        isSubstituted: !!playerEntry.isSubstituted,
        subMinute: playerEntry.subMinute,
    });
}

/** Verbatim from FullPitchLineups.tsx's processBasketballLineup -- dummy placement, untouched by this pass. */
function inferBasketballPlacementLegacy(
    players: Record<string, Player>,
    lineup: any[],
): PitchPlayer[] {
    return lineup.map((entry, i) => ({
        player: players[entry.playerId],
        position: { x: 20 + (i % 3) * 30, y: 70 },
        rating: entry.rating || 0,
    })).filter((p) => p.player) as PitchPlayer[];
}

/**
 * The BACKLOG-322 role-bucket-inference heuristic, moved verbatim from
 * FullPitchLineups.tsx's processLineupForPitch. Logic is unchanged -- only
 * the surrounding module structure differs (standalone function taking
 * explicit params instead of closing over component props/state).
 */
export function inferPlacementLegacy(
    players: Record<string, Player>,
    lineup: any[],
    isHome: boolean,
    formation: string,
    isBasketball: boolean,
    variant: '11-a-side' | '5-a-side' | 'basketball' | '3x3' | undefined,
    playerStats: PlayerStatsMap,
): PitchPlayer[] {
    if (isBasketball) {
        return inferBasketballPlacementLegacy(players, lineup);
    }

    const fallback = variant === '5-a-side' ? LEGACY_DEFAULT_FORMATION_5ASIDE : LEGACY_DEFAULT_FORMATION;
    const cleanFormation = (formation && Object.keys(LEGACY_FORMATION_TEMPLATES).includes(formation)) ? formation : fallback;
    const template = LEGACY_FORMATION_TEMPLATES[cleanFormation];

    const availablePlayers = lineup
        .map((entry) => ({
            ...entry,
            player: players[entry.playerId],
            bucket: parsePositionToBucket(entry.position || players[entry.playerId]?.position || ''),
        }))
        .filter((p) => p.player && p.isStarter !== false);

    const rolesOrder = ['GK', 'DEF', 'DM', 'MID', 'AM', 'FW'];
    const playersByRole: Record<string, typeof availablePlayers> = {};
    const slotsByRole: Record<string, LegacyFormationSlot[]> = {};

    rolesOrder.forEach((r) => {
        playersByRole[r] = [];
        slotsByRole[r] = [];
    });

    availablePlayers.forEach((p) => {
        const bucket = p.bucket;
        if (playersByRole[bucket]) playersByRole[bucket].push(p);
        else playersByRole['MID'].push(p);
    });

    if (template) {
        template.forEach((slot) => {
            if (slotsByRole[slot.role]) slotsByRole[slot.role].push(slot);
            else if (slotsByRole['MID']) slotsByRole['MID'].push(slot);
        });
    } else {
        console.warn(`Formation template not found for ${cleanFormation}, defaulting...`);
    }

    Object.values(slotsByRole).forEach((slots) => slots.sort((a, b) => a.x - b.x));

    const pitchPlayers: PitchPlayer[] = [];
    const usedSlots = new Set<LegacyFormationSlot>();

    rolesOrder.forEach((role) => {
        const rolePlayers = playersByRole[role];
        const roleSlots = slotsByRole[role];

        roleSlots.forEach((slot, slotIndex) => {
            const playerEntry = rolePlayers[slotIndex];

            if (!playerEntry) {
                const adjacentRoles = getAdjacentRoles(role);
                for (const adjRole of adjacentRoles) {
                    const adjPlayers = playersByRole[adjRole];
                    if (adjPlayers.length > slotsByRole[adjRole].length) {
                        const borrowedPlayer = adjPlayers.splice(slotsByRole[adjRole].length, 1)[0];
                        if (borrowedPlayer) {
                            assignPlayerToSlot(borrowedPlayer, slot, isHome, pitchPlayers, playerStats);
                            usedSlots.add(slot);
                            break;
                        }
                    }
                }
                return;
            }

            assignPlayerToSlot(playerEntry, slot, isHome, pitchPlayers, playerStats);
            usedSlots.add(slot);
        });
    });

    const assignedIds = new Set(pitchPlayers.map((p) => p.player.id));
    const unassigned = availablePlayers.filter((p) => !assignedIds.has(p.player.id));
    const leftoverSlots = (template || []).filter((slot) => !usedSlots.has(slot));
    unassigned.forEach((playerEntry, i) => {
        const slot = leftoverSlots[i];
        if (slot) {
            assignPlayerToSlot(playerEntry, slot, isHome, pitchPlayers, playerStats);
            usedSlots.add(slot);
        }
    });

    return pitchPlayers;
}

// ============================================================================
// Legacy-to-slot seeding -- for editing an EXISTING lineup that predates
// stored coordinates (i.e. every real published lineup as of BACKLOG-323
// step 6; the backfill migration that would give them real slotId/x/y is
// step 9, a separate deliberate later migration). Without this, opening an
// already-published match in the rebuilt admin builder would show an empty
// pitch even though a real lineup exists -- a real risk of an admin
// re-publishing what looks like a wiped lineup. This is intentionally a
// simpler one-pass bucket match (no adjacent-role borrowing) since it only
// seeds the initial edit state; the admin can freely correct any slot by
// hand afterward, unlike inferPlacementLegacy which must render correctly
// with zero human intervention on every page load.
// ============================================================================

export function seedPlacementsFromLegacy(
    starters: Array<{ playerId: string; position?: string; isCaptain?: boolean; isViceCaptain?: boolean }>,
    formationId: string,
): PlacementEntry[] {
    const formation = FORMATIONS[formationId];
    if (!formation) return [];

    const availableSlots = [...formation.slots];
    const placements: PlacementEntry[] = [];

    const takeSlot = (predicate: (slot: RegistrySlot) => boolean): RegistrySlot | undefined => {
        const index = availableSlots.findIndex(predicate);
        if (index === -1) return undefined;
        return availableSlots.splice(index, 1)[0];
    };

    starters.forEach((starter) => {
        const bucket = parsePositionToBucket(starter.position || '');
        const slot = takeSlot((s) => s.role === bucket) || takeSlot(() => true);
        if (!slot) return; // more starters than formation slots -- shouldn't happen for a valid lineup, drop rather than guess
        placements.push({
            slotId: slot.id,
            playerId: starter.playerId,
            isCaptain: starter.isCaptain,
            isViceCaptain: starter.isViceCaptain,
        });
    });

    return placements;
}
