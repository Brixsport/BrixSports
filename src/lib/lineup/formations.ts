// Canonical formation registry for BACKLOG-323 / BACKLOG-325.
//
// Merges three previously-divergent formation tables into one source of
// truth: src/lib/formations.ts (admin builder), FullPitchLineups.tsx's
// inline FORMATION_TEMPLATES (public renderer), and /xi/page.tsx's inline
// FORMATIONS. Where the same formation id existed in both the builder and
// the renderer tables, the renderer's coordinates win -- those are the
// live-rendered, FotMob-calibrated values (see FullPitchLineups.tsx's own
// 4-3-3 comment). The two builder-only formations (3-1-4-2, 4-5-1) are
// converted into this registry's coordinate space below.
//
// Coordinate space (own-half, per team, pre-mirroring): x 0-100 left-to-right,
// y 0 (own goal line) -> 100 (halfway line). A consumer rendering a team on
// the pitch applies its own home/away half-mapping and, for the away side,
// an x-mirror -- this registry stores one canonical per-team layout only.

export type FormationSport = 'Football' | 'Basketball';

// Bucket vocabulary used by the legacy inference heuristic (parsePositionToBucket
// in FullPitchLineups.tsx, preserved verbatim as inferPlacementLegacy). Slots
// carry a role so a future explicit-placement consumer can still group/filter
// by role without re-deriving it.
export type FormationRole =
    | 'GK' | 'DEF' | 'DM' | 'MID' | 'AM' | 'FW' // football
    | 'PG' | 'SG' | 'SF' | 'PF' | 'C' | 'G' | 'F'; // basketball

export interface FormationSlot {
    /** Stable identity for this slot within its formation -- survives coordinate retuning. */
    id: string;
    x: number;
    y: number;
    role: FormationRole;
}

export interface FormationDefinition {
    id: string;
    label: string;
    sport: FormationSport;
    /** '11-a-side' | '5-a-side' for football; undefined for basketball. */
    variant?: '11-a-side' | '5-a-side';
    slots: FormationSlot[];
}

// ============================================================================
// Football -- 11-a-side
// ============================================================================
// Ids present in FullPitchLineups.tsx's original FORMATION_TEMPLATES verbatim
// (renderer wins on shared ids, per BACKLOG-325's resolution).

const FOOTBALL_11: FormationDefinition[] = [
    {
        id: '4-4-2', label: '4-4-2', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lb', x: 15, y: 25, role: 'DEF' }, { id: 'lcb', x: 38, y: 25, role: 'DEF' }, { id: 'rcb', x: 62, y: 25, role: 'DEF' }, { id: 'rb', x: 85, y: 25, role: 'DEF' },
            { id: 'lm', x: 15, y: 55, role: 'MID' }, { id: 'lcm', x: 38, y: 55, role: 'MID' }, { id: 'rcm', x: 62, y: 55, role: 'MID' }, { id: 'rm', x: 85, y: 55, role: 'MID' },
            { id: 'lst', x: 35, y: 85, role: 'FW' }, { id: 'rst', x: 65, y: 85, role: 'FW' },
        ],
    },
    {
        id: '4-3-3', label: '4-3-3', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lb', x: 15, y: 25, role: 'DEF' }, { id: 'lcb', x: 38, y: 25, role: 'DEF' }, { id: 'rcb', x: 62, y: 25, role: 'DEF' }, { id: 'rb', x: 85, y: 25, role: 'DEF' },
            { id: 'lcm', x: 20, y: 50, role: 'MID' }, { id: 'cm', x: 50, y: 45, role: 'MID' }, { id: 'rcm', x: 80, y: 50, role: 'MID' },
            { id: 'lw', x: 20, y: 82, role: 'FW' }, { id: 'st', x: 50, y: 87, role: 'FW' }, { id: 'rw', x: 80, y: 82, role: 'FW' },
        ],
    },
    {
        id: '4-2-3-1', label: '4-2-3-1', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lb', x: 10, y: 25, role: 'DEF' }, { id: 'lcb', x: 36, y: 25, role: 'DEF' }, { id: 'rcb', x: 64, y: 25, role: 'DEF' }, { id: 'rb', x: 90, y: 25, role: 'DEF' },
            { id: 'lcdm', x: 35, y: 45, role: 'DM' }, { id: 'rcdm', x: 65, y: 45, role: 'DM' },
            { id: 'lam', x: 15, y: 65, role: 'AM' }, { id: 'cam', x: 50, y: 65, role: 'AM' }, { id: 'ram', x: 85, y: 65, role: 'AM' },
            { id: 'st', x: 50, y: 88, role: 'FW' },
        ],
    },
    {
        id: '3-4-3', label: '3-4-3', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lcb', x: 20, y: 25, role: 'DEF' }, { id: 'cb', x: 50, y: 25, role: 'DEF' }, { id: 'rcb', x: 80, y: 25, role: 'DEF' },
            { id: 'lm', x: 10, y: 50, role: 'MID' }, { id: 'lcm', x: 35, y: 50, role: 'MID' }, { id: 'rcm', x: 65, y: 50, role: 'MID' }, { id: 'rm', x: 90, y: 50, role: 'MID' },
            { id: 'lw', x: 20, y: 80, role: 'FW' }, { id: 'st', x: 50, y: 85, role: 'FW' }, { id: 'rw', x: 80, y: 80, role: 'FW' },
        ],
    },
    {
        id: '3-5-2', label: '3-5-2', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lcb', x: 20, y: 25, role: 'DEF' }, { id: 'cb', x: 50, y: 25, role: 'DEF' }, { id: 'rcb', x: 80, y: 25, role: 'DEF' },
            { id: 'lm', x: 10, y: 50, role: 'MID' }, { id: 'lcm', x: 30, y: 50, role: 'MID' }, { id: 'cm', x: 50, y: 45, role: 'MID' }, { id: 'rcm', x: 70, y: 50, role: 'MID' }, { id: 'rm', x: 90, y: 50, role: 'MID' },
            { id: 'lst', x: 35, y: 85, role: 'FW' }, { id: 'rst', x: 65, y: 85, role: 'FW' },
        ],
    },
    {
        id: '5-3-2', label: '5-3-2', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lwb', x: 5, y: 28, role: 'DEF' }, { id: 'lcb', x: 27, y: 28, role: 'DEF' }, { id: 'cb', x: 50, y: 28, role: 'DEF' }, { id: 'rcb', x: 73, y: 28, role: 'DEF' }, { id: 'rwb', x: 95, y: 28, role: 'DEF' },
            { id: 'lcm', x: 25, y: 55, role: 'MID' }, { id: 'cm', x: 50, y: 50, role: 'MID' }, { id: 'rcm', x: 75, y: 55, role: 'MID' },
            { id: 'lst', x: 35, y: 85, role: 'FW' }, { id: 'rst', x: 65, y: 85, role: 'FW' },
        ],
    },
    {
        id: '5-4-1', label: '5-4-1', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lwb', x: 5, y: 28, role: 'DEF' }, { id: 'lcb', x: 27, y: 28, role: 'DEF' }, { id: 'cb', x: 50, y: 28, role: 'DEF' }, { id: 'rcb', x: 73, y: 28, role: 'DEF' }, { id: 'rwb', x: 95, y: 28, role: 'DEF' },
            { id: 'lm', x: 12, y: 58, role: 'MID' }, { id: 'lcm', x: 37, y: 58, role: 'MID' }, { id: 'rcm', x: 63, y: 58, role: 'MID' }, { id: 'rm', x: 88, y: 58, role: 'MID' },
            { id: 'st', x: 50, y: 85, role: 'FW' },
        ],
    },
    {
        id: '3-4-2-1', label: '3-4-2-1', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lcb', x: 20, y: 25, role: 'DEF' }, { id: 'cb', x: 50, y: 25, role: 'DEF' }, { id: 'rcb', x: 80, y: 25, role: 'DEF' },
            { id: 'lm', x: 10, y: 50, role: 'MID' }, { id: 'lcm', x: 40, y: 50, role: 'MID' }, { id: 'rcm', x: 60, y: 50, role: 'MID' }, { id: 'rm', x: 90, y: 50, role: 'MID' },
            { id: 'lam', x: 35, y: 70, role: 'AM' }, { id: 'ram', x: 65, y: 70, role: 'AM' },
            { id: 'st', x: 50, y: 88, role: 'FW' },
        ],
    },
    {
        id: '4-1-4-1', label: '4-1-4-1', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lb', x: 10, y: 25, role: 'DEF' }, { id: 'lcb', x: 36, y: 25, role: 'DEF' }, { id: 'rcb', x: 64, y: 25, role: 'DEF' }, { id: 'rb', x: 90, y: 25, role: 'DEF' },
            { id: 'cdm', x: 50, y: 40, role: 'DM' },
            { id: 'lm', x: 10, y: 60, role: 'MID' }, { id: 'lcm', x: 35, y: 60, role: 'MID' }, { id: 'rcm', x: 65, y: 60, role: 'MID' }, { id: 'rm', x: 90, y: 60, role: 'MID' },
            { id: 'st', x: 50, y: 85, role: 'FW' },
        ],
    },
    {
        id: '4-4-1-1', label: '4-4-1-1', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lb', x: 10, y: 25, role: 'DEF' }, { id: 'lcb', x: 35, y: 25, role: 'DEF' }, { id: 'rcb', x: 65, y: 25, role: 'DEF' }, { id: 'rb', x: 90, y: 25, role: 'DEF' },
            { id: 'lm', x: 10, y: 50, role: 'MID' }, { id: 'lcm', x: 35, y: 50, role: 'MID' }, { id: 'rcm', x: 65, y: 50, role: 'MID' }, { id: 'rm', x: 90, y: 50, role: 'MID' },
            { id: 'am', x: 50, y: 70, role: 'AM' },
            { id: 'st', x: 50, y: 88, role: 'FW' },
        ],
    },
    {
        id: '4-1-2-1-2', label: '4-1-2-1-2 (Diamond)', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lb', x: 15, y: 25, role: 'DEF' }, { id: 'lcb', x: 38, y: 25, role: 'DEF' }, { id: 'rcb', x: 62, y: 25, role: 'DEF' }, { id: 'rb', x: 85, y: 25, role: 'DEF' },
            { id: 'cdm', x: 50, y: 40, role: 'DM' },
            { id: 'lcm', x: 30, y: 55, role: 'MID' }, { id: 'rcm', x: 70, y: 55, role: 'MID' },
            { id: 'cam', x: 50, y: 70, role: 'AM' },
            { id: 'lst', x: 35, y: 85, role: 'FW' }, { id: 'rst', x: 65, y: 85, role: 'FW' },
        ],
    },
    {
        id: '3-2-4-1', label: '3-2-4-1', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'lcb', x: 20, y: 25, role: 'DEF' }, { id: 'cb', x: 50, y: 25, role: 'DEF' }, { id: 'rcb', x: 80, y: 25, role: 'DEF' },
            { id: 'lcdm', x: 35, y: 45, role: 'DM' }, { id: 'rcdm', x: 65, y: 45, role: 'DM' },
            { id: 'lm', x: 10, y: 65, role: 'MID' }, { id: 'lam', x: 35, y: 65, role: 'AM' }, { id: 'ram', x: 65, y: 65, role: 'AM' }, { id: 'rm', x: 90, y: 65, role: 'MID' },
            { id: 'st', x: 50, y: 88, role: 'FW' },
        ],
    },
    // Builder-only ids (src/lib/formations.ts), converted into own-half space
    // (y' = 100 - y) since that source used full-pitch-single-team space
    // (GK near y=92, forwards near y=15) -- the inverse of this registry's
    // convention. Not previously reachable from the public renderer at all
    // (BACKLOG-325 finding #1): a match built in either of these silently
    // rendered as the 4-4-2 fallback.
    {
        id: '3-1-4-2', label: '3-1-4-2', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 8, role: 'GK' },
            { id: 'lcb', x: 30, y: 20, role: 'DEF' }, { id: 'cb', x: 50, y: 18, role: 'DEF' }, { id: 'rcb', x: 70, y: 20, role: 'DEF' },
            { id: 'cdm', x: 50, y: 35, role: 'DM' },
            { id: 'lm', x: 15, y: 55, role: 'MID' }, { id: 'lcm', x: 35, y: 50, role: 'MID' }, { id: 'rcm', x: 65, y: 50, role: 'MID' }, { id: 'rm', x: 85, y: 55, role: 'MID' },
            { id: 'lst', x: 35, y: 85, role: 'FW' }, { id: 'rst', x: 65, y: 85, role: 'FW' },
        ],
    },
    {
        id: '4-5-1', label: '4-5-1', sport: 'Football', variant: '11-a-side',
        slots: [
            { id: 'gk', x: 50, y: 8, role: 'GK' },
            { id: 'lb', x: 15, y: 25, role: 'DEF' }, { id: 'lcb', x: 38, y: 20, role: 'DEF' }, { id: 'rcb', x: 62, y: 20, role: 'DEF' }, { id: 'rb', x: 85, y: 25, role: 'DEF' },
            { id: 'lm', x: 15, y: 55, role: 'MID' }, { id: 'lcm', x: 35, y: 50, role: 'MID' }, { id: 'cm', x: 50, y: 45, role: 'MID' }, { id: 'rcm', x: 65, y: 50, role: 'MID' }, { id: 'rm', x: 85, y: 55, role: 'MID' },
            { id: 'st', x: 50, y: 85, role: 'FW' },
        ],
    },
];

// ============================================================================
// Football -- 5-a-side
// ============================================================================

const FOOTBALL_5: FormationDefinition[] = [
    {
        id: '1-2-1', label: '5-Aside Diamond', sport: 'Football', variant: '5-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'def', x: 50, y: 30, role: 'DEF' },
            { id: 'lm', x: 20, y: 50, role: 'MID' }, { id: 'rm', x: 80, y: 50, role: 'MID' },
            { id: 'st', x: 50, y: 75, role: 'FW' },
        ],
    },
    {
        id: '2-1-1', label: '5-Aside Box', sport: 'Football', variant: '5-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'ldef', x: 30, y: 30, role: 'DEF' }, { id: 'rdef', x: 70, y: 30, role: 'DEF' },
            { id: 'mid', x: 50, y: 55, role: 'MID' },
            { id: 'st', x: 50, y: 80, role: 'FW' },
        ],
    },
    {
        id: '2-2', label: '5-Aside Square', sport: 'Football', variant: '5-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'ldef', x: 30, y: 30, role: 'DEF' }, { id: 'rdef', x: 70, y: 30, role: 'DEF' },
            { id: 'lst', x: 30, y: 70, role: 'FW' }, { id: 'rst', x: 70, y: 70, role: 'FW' },
        ],
    },
    {
        id: '1-1-2', label: '5-Aside Y / Attacking', sport: 'Football', variant: '5-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'def', x: 50, y: 30, role: 'DEF' },
            { id: 'mid', x: 50, y: 55, role: 'MID' },
            { id: 'lst', x: 30, y: 80, role: 'FW' }, { id: 'rst', x: 70, y: 80, role: 'FW' },
        ],
    },
    {
        id: '3-1', label: '5-Aside Pyramid / Defensive', sport: 'Football', variant: '5-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'ldef', x: 20, y: 30, role: 'DEF' }, { id: 'cdef', x: 50, y: 30, role: 'DEF' }, { id: 'rdef', x: 80, y: 30, role: 'DEF' },
            { id: 'st', x: 50, y: 75, role: 'FW' },
        ],
    },
    {
        id: '1-3', label: '5-Aside All-Out Attack', sport: 'Football', variant: '5-a-side',
        slots: [
            { id: 'gk', x: 50, y: 5, role: 'GK' },
            { id: 'def', x: 50, y: 30, role: 'DEF' },
            { id: 'lst', x: 20, y: 70, role: 'FW' }, { id: 'cst', x: 50, y: 75, role: 'FW' }, { id: 'rst', x: 80, y: 70, role: 'FW' },
        ],
    },
];

// ============================================================================
// Basketball
// ============================================================================
// Carried over from src/lib/formations.ts (the admin builder's source),
// converted from that file's full-pitch space (y' = 100 - y) into this
// registry's convention for consistency. NOT yet wired into the renderer --
// FullPitchLineups.tsx's processBasketballLineup() still uses a dummy grid
// (BACKLOG-323 explicitly scopes basketball placement out of this pass).

const BASKETBALL: FormationDefinition[] = [
    {
        id: '1-2-2', label: '1-2-2 (Standard)', sport: 'Basketball',
        slots: [
            { id: 'pg', x: 50, y: 20, role: 'PG' },
            { id: 'sg', x: 75, y: 40, role: 'SG' },
            { id: 'sf', x: 25, y: 40, role: 'SF' },
            { id: 'pf', x: 70, y: 70, role: 'PF' },
            { id: 'c', x: 30, y: 70, role: 'C' },
        ],
    },
    {
        id: '2-3', label: '2-3 (Big Lineup)', sport: 'Basketball',
        slots: [
            { id: 'pg', x: 40, y: 20, role: 'PG' },
            { id: 'sg', x: 60, y: 20, role: 'SG' },
            { id: 'sf', x: 25, y: 50, role: 'SF' },
            { id: 'pf', x: 75, y: 50, role: 'PF' },
            { id: 'c', x: 50, y: 75, role: 'C' },
        ],
    },
];

// ============================================================================
// Registry + per-consumer allowlists
// ============================================================================

export const FORMATIONS: Record<string, FormationDefinition> = Object.fromEntries(
    [...FOOTBALL_11, ...FOOTBALL_5, ...BASKETBALL].map((f) => [f.id, f]),
);

/** The public /xi builder's curated set -- matches its pre-existing 3-formation UI, not the full admin set. */
export const XI_FORMATION_IDS: readonly string[] = ['4-4-2', '4-3-3', '3-5-2'];

/** The admin builder's full football set (11-a-side + 5-a-side). */
export const ADMIN_FOOTBALL_FORMATION_IDS: readonly string[] = [...FOOTBALL_11, ...FOOTBALL_5].map((f) => f.id);

export const BASKETBALL_FORMATION_IDS: readonly string[] = BASKETBALL.map((f) => f.id);

export function getFormation(id: string): FormationDefinition | undefined {
    return FORMATIONS[id];
}

export function getFormationsForXi(): FormationDefinition[] {
    return XI_FORMATION_IDS.map((id) => FORMATIONS[id]).filter(Boolean);
}

export function getFormationsForAdmin(sport: FormationSport): FormationDefinition[] {
    const ids = sport === 'Basketball' ? BASKETBALL_FORMATION_IDS : ADMIN_FOOTBALL_FORMATION_IDS;
    return ids.map((id) => FORMATIONS[id]).filter(Boolean);
}

export const DEFAULT_FORMATION_11 = '4-4-2';
export const DEFAULT_FORMATION_5 = '1-2-1';
export const DEFAULT_FORMATION_BASKETBALL = '1-2-2';
