'use client';

import { Player } from '@/types';
// Import explicitly to ensure type availability (though dynamic import is used below for component)
import type { PitchPlayer } from './lineup/ResponsivePitch';
// We'll use a dynamic import for the component inside the render to match previous pattern if needed, 
// but standard import is better for type safety. Let's use standard import.
import { ResponsivePitch } from './lineup/ResponsivePitch';

interface FullPitchLineupsProps {
    homeTeam: {
        name: string;
        logo: string;
        color: string;
        formation?: string;
    };
    awayTeam: {
        name: string;
        logo: string;
        color: string;
        formation?: string;
    };
    homePlayers: Record<string, Player>;
    awayPlayers: Record<string, Player>;
    homeLineup: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean; isStarter?: boolean; isMotM?: boolean }>;
    awayLineup: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean; isStarter?: boolean; isMotM?: boolean }>;
    homeSubs?: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean; isMotM?: boolean }>;
    awaySubs?: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean; isMotM?: boolean }>;
    onPlayerClick: (player: Player) => void;
    sport?: string; // 'Football' or 'Basketball'
    variant?: '11-a-side' | '5-a-side' | 'basketball' | '3x3';
    events?: any[]; // Match events for goal/assist tracking
}

// ========== FORMATION CONFIGURATION ==========
// X: 0-100 (Left->Right)
// Y: 0-100 (Home Perspective: 0=GK line, 100=Striker line) -> We will map this to 0-50/50-100 later.
// Note: We use a "Home Bottom" standard for defining these.
// 0 = Keeper, 10-30 = Defense, 40-60 = Midfield, 70-90 = Attack.

type FormationSlot = {
    x: number;
    y: number; // 0-100 relative to hal-pitch depth (will be scaled)
    role: string; // 'GK', 'DEF', 'MID', 'FW', etc. used for bucket matching
};

type FormationTemplate = FormationSlot[];

const FORMATION_TEMPLATES: Record<string, FormationTemplate> = {
    // === 11-a-side Formations ===
    '4-4-2': [
        { x: 50, y: 5, role: 'GK' },
        { x: 15, y: 25, role: 'DEF' }, { x: 38, y: 25, role: 'DEF' }, { x: 62, y: 25, role: 'DEF' }, { x: 85, y: 25, role: 'DEF' },
        { x: 15, y: 55, role: 'MID' }, { x: 38, y: 55, role: 'MID' }, { x: 62, y: 55, role: 'MID' }, { x: 85, y: 55, role: 'MID' },
        { x: 35, y: 85, role: 'FW' }, { x: 65, y: 85, role: 'FW' }
    ],
    '4-3-3': [
        { x: 50, y: 5, role: 'GK' },
        { x: 15, y: 25, role: 'DEF' }, { x: 38, y: 25, role: 'DEF' }, { x: 62, y: 25, role: 'DEF' }, { x: 85, y: 25, role: 'DEF' },
        { x: 30, y: 50, role: 'MID' }, { x: 50, y: 45, role: 'MID' }, { x: 70, y: 50, role: 'MID' }, // Triangle usually
        { x: 15, y: 80, role: 'FW' }, { x: 50, y: 85, role: 'FW' }, { x: 85, y: 80, role: 'FW' }
    ],
    '4-2-3-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 10, y: 25, role: 'DEF' }, { x: 36, y: 25, role: 'DEF' }, { x: 64, y: 25, role: 'DEF' }, { x: 90, y: 25, role: 'DEF' },
        { x: 35, y: 45, role: 'DM' }, { x: 65, y: 45, role: 'DM' },
        { x: 15, y: 65, role: 'AM' }, { x: 50, y: 65, role: 'AM' }, { x: 85, y: 65, role: 'AM' },
        { x: 50, y: 88, role: 'FW' }
    ],
    '3-4-3': [
        { x: 50, y: 5, role: 'GK' },
        { x: 20, y: 25, role: 'DEF' }, { x: 50, y: 25, role: 'DEF' }, { x: 80, y: 25, role: 'DEF' },
        { x: 10, y: 50, role: 'MID' }, { x: 35, y: 50, role: 'MID' }, { x: 65, y: 50, role: 'MID' }, { x: 90, y: 50, role: 'MID' },
        { x: 20, y: 80, role: 'FW' }, { x: 50, y: 85, role: 'FW' }, { x: 80, y: 80, role: 'FW' }
    ],
    '3-5-2': [
        { x: 50, y: 5, role: 'GK' },
        { x: 20, y: 25, role: 'DEF' }, { x: 50, y: 25, role: 'DEF' }, { x: 80, y: 25, role: 'DEF' },
        { x: 10, y: 50, role: 'MID' }, { x: 30, y: 50, role: 'MID' }, { x: 50, y: 45, role: 'MID' }, { x: 70, y: 50, role: 'MID' }, { x: 90, y: 50, role: 'MID' },
        { x: 35, y: 85, role: 'FW' }, { x: 65, y: 85, role: 'FW' }
    ],
    '5-3-2': [
        { x: 50, y: 5, role: 'GK' },
        { x: 5, y: 28, role: 'DEF' }, { x: 27, y: 28, role: 'DEF' }, { x: 50, y: 28, role: 'DEF' }, { x: 73, y: 28, role: 'DEF' }, { x: 95, y: 28, role: 'DEF' },
        { x: 25, y: 55, role: 'MID' }, { x: 50, y: 50, role: 'MID' }, { x: 75, y: 55, role: 'MID' },
        { x: 35, y: 85, role: 'FW' }, { x: 65, y: 85, role: 'FW' }
    ],
    '5-4-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 5, y: 28, role: 'DEF' }, { x: 27, y: 28, role: 'DEF' }, { x: 50, y: 28, role: 'DEF' }, { x: 73, y: 28, role: 'DEF' }, { x: 95, y: 28, role: 'DEF' },
        { x: 12, y: 58, role: 'MID' }, { x: 37, y: 58, role: 'MID' }, { x: 63, y: 58, role: 'MID' }, { x: 88, y: 58, role: 'MID' },
        { x: 50, y: 85, role: 'FW' }
    ],
    '3-4-2-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 20, y: 25, role: 'DEF' }, { x: 50, y: 25, role: 'DEF' }, { x: 80, y: 25, role: 'DEF' },
        { x: 10, y: 50, role: 'MID' }, { x: 40, y: 50, role: 'MID' }, { x: 60, y: 50, role: 'MID' }, { x: 90, y: 50, role: 'MID' },
        { x: 35, y: 70, role: 'AM' }, { x: 65, y: 70, role: 'AM' },
        { x: 50, y: 88, role: 'FW' }
    ],
    '4-1-4-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 10, y: 25, role: 'DEF' }, { x: 36, y: 25, role: 'DEF' }, { x: 64, y: 25, role: 'DEF' }, { x: 90, y: 25, role: 'DEF' },
        { x: 50, y: 40, role: 'DM' },
        { x: 10, y: 60, role: 'MID' }, { x: 35, y: 60, role: 'MID' }, { x: 65, y: 60, role: 'MID' }, { x: 90, y: 60, role: 'MID' },
        { x: 50, y: 85, role: 'FW' }
    ],
    '4-4-1-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 10, y: 25, role: 'DEF' }, { x: 35, y: 25, role: 'DEF' }, { x: 65, y: 25, role: 'DEF' }, { x: 90, y: 25, role: 'DEF' },
        { x: 10, y: 50, role: 'MID' }, { x: 35, y: 50, role: 'MID' }, { x: 65, y: 50, role: 'MID' }, { x: 90, y: 50, role: 'MID' },
        { x: 50, y: 70, role: 'AM' },
        { x: 50, y: 88, role: 'FW' }
    ],
    '4-1-2-1-2': [ // Diamond
        { x: 50, y: 5, role: 'GK' },
        { x: 15, y: 25, role: 'DEF' }, { x: 38, y: 25, role: 'DEF' }, { x: 62, y: 25, role: 'DEF' }, { x: 85, y: 25, role: 'DEF' },
        { x: 50, y: 40, role: 'DM' },
        { x: 30, y: 55, role: 'MID' }, { x: 70, y: 55, role: 'MID' }, // Wide CMs
        { x: 50, y: 70, role: 'AM' }, // CAM
        { x: 35, y: 85, role: 'FW' }, { x: 65, y: 85, role: 'FW' }
    ],
    '3-2-4-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 20, y: 25, role: 'DEF' }, { x: 50, y: 25, role: 'DEF' }, { x: 80, y: 25, role: 'DEF' },
        { x: 35, y: 45, role: 'DM' }, { x: 65, y: 45, role: 'DM' },
        { x: 10, y: 65, role: 'MID' }, { x: 35, y: 65, role: 'AM' }, { x: 65, y: 65, role: 'AM' }, { x: 90, y: 65, role: 'MID' },
        { x: 50, y: 88, role: 'FW' }
    ],

    // === 5-a-side Formations ===
    '1-2-1': [ // Diamond
        { x: 50, y: 5, role: 'GK' },
        { x: 50, y: 30, role: 'DEF' },
        { x: 20, y: 50, role: 'MID' }, { x: 80, y: 50, role: 'MID' },
        { x: 50, y: 75, role: 'FW' }
    ],
    '2-1-1': [ // Box / 2-1-1
        { x: 50, y: 5, role: 'GK' },
        { x: 30, y: 30, role: 'DEF' }, { x: 70, y: 30, role: 'DEF' },
        { x: 50, y: 55, role: 'MID' },
        { x: 50, y: 80, role: 'FW' }
    ],
    '2-2': [ // Box / Square (Legacy ID)
        { x: 50, y: 5, role: 'GK' },
        { x: 30, y: 30, role: 'DEF' }, { x: 70, y: 30, role: 'DEF' },
        { x: 30, y: 70, role: 'FW' }, { x: 70, y: 70, role: 'FW' }
    ],
    '1-1-2': [ // Y / Attacking
        { x: 50, y: 5, role: 'GK' },
        { x: 50, y: 30, role: 'DEF' },
        { x: 50, y: 55, role: 'MID' },
        { x: 30, y: 80, role: 'FW' }, { x: 70, y: 80, role: 'FW' }
    ],
    '3-1': [ // Pyramid / Defensive
        { x: 50, y: 5, role: 'GK' },
        { x: 20, y: 30, role: 'DEF' }, { x: 50, y: 30, role: 'DEF' }, { x: 80, y: 30, role: 'DEF' },
        { x: 50, y: 75, role: 'FW' }
    ],
    '1-3': [ // All Out Attack
        { x: 50, y: 5, role: 'GK' },
        { x: 50, y: 30, role: 'DEF' },
        { x: 20, y: 70, role: 'FW' }, { x: 50, y: 75, role: 'FW' }, { x: 80, y: 70, role: 'FW' }
    ],

    // === Basketball Formations ===
    'basketball': [
        { x: 50, y: 85, role: 'PG' }, // Point Guard
        { x: 20, y: 65, role: 'SG' }, // Shooting Guard
        { x: 80, y: 65, role: 'SF' }, // Small Forward
        { x: 35, y: 40, role: 'PF' }, // Power Forward
        { x: 65, y: 40, role: 'C' }  // Center
    ],
    '3x3': [
        { x: 50, y: 75, role: 'G' }, // Guard
        { x: 25, y: 45, role: 'F' }, // Forward
        { x: 75, y: 45, role: 'C' }  // Center
    ]
};

// Default fallback
const DEFAULT_FORMATION = '4-4-2';
const DEFAULT_FORMATION_5ASIDE = '1-2-1';
const DEFAULT_FORMATION_BASKETBALL = 'basketball';
const DEFAULT_FORMATION_3x3 = '3x3';

// Helper to normalize position string to broad buckets for slot filling
const parsePositionToBucket = (pos: string): string => {
    const p = pos.toLowerCase().trim();
    // Basketball roles
    if (p === 'pg' || p.includes('point guard')) return 'PG';
    if (p === 'sg' || p.includes('shooting guard')) return 'SG';
    if (p === 'sf' || p.includes('small forward')) return 'SF';
    if (p === 'pf' || p.includes('power forward')) return 'PF';
    if (p === 'c' || p === 'center') return 'C';
    if (p === 'g' || p === 'guard') return 'G';
    if (p === 'f' || p === 'forward') return 'F';

    // Football roles
    if (p.includes('gk') || p.includes('goalkeeper') || p.includes('goal keeper') ||
        p === 'g' || p.includes('goalie') || p.includes('keeper')) return 'GK';
    // Check for defensive midfielder
    if (p.includes('dm') || p.includes('defensive mid') || p.includes('cdm')) return 'DM';
    // Check for attacking midfielder
    if (p.includes('am') || p.includes('attacking mid') || p.includes('cam')) return 'AM';
    // Check for defenders
    if (p.includes('def') || p.includes('back') || p.includes('cb') || p.includes('lb') || p.includes('rb') || p.includes('wb') || p.includes('fix')) return 'DEF';
    // Check for midfielders (check this before forwards to avoid confusion)
    if (p.includes('mid') || p.includes('wing') || p.includes('lm') || p.includes('rm') || p.includes('cm') || p.includes('ala')) return 'MID';
    // Check for forwards
    if (p.includes('fw') || p.includes('st') || p.includes('cf') || p.includes('striker') || p.includes('forward') || p.includes('pivot')) return 'FW';
    return 'MID'; // Fallback
};

export function FullPitchLineups({
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    homeSubs: propHomeSubs,
    awaySubs: propAwaySubs,
    onPlayerClick,
    sport = 'Football',
    variant,
    events = []
}: FullPitchLineupsProps) {
    const isBasketball = sport === 'Basketball';

    // Calculate goals and assists per player from events
    const playerStats = new Map<string, { goals: number; assists: number }>();

    events.forEach((event: any) => {
        if (!event.playerId) return;

        const stats = playerStats.get(event.playerId) || { goals: 0, assists: 0 };

        // Count goals
        if (event.type === 'Goal') {
            stats.goals++;
        }

        // Count assists (check both assistPlayerId and relatedPlayerId)
        const assisterId = event.assistPlayerId || event.relatedPlayerId;
        if (assisterId && event.type === 'Goal') {
            const assisterStats = playerStats.get(assisterId) || { goals: 0, assists: 0 };
            assisterStats.assists++;
            playerStats.set(assisterId, assisterStats);
        }

        playerStats.set(event.playerId, stats);
    });

    // *** FOOTBALL LOGIC: Formation Slot Mapping ***
    const processLineupForPitch = (players: Record<string, Player>, lineup: any[], isHome: boolean, formation: string): PitchPlayer[] => {
        if (isBasketball) {
            // ... Keep existing basketball logic simplifed or return early ...
            // For now, let's keep a minimal fallback if sport is basketball, 
            // but the prompt is specifically about Football refactor.
            // Retaining simple basketball logic from before just in case.
            return processBasketballLineup(players, lineup, isHome);
        }

        const fallback = variant === '5-a-side' ? DEFAULT_FORMATION_5ASIDE : DEFAULT_FORMATION;
        const cleanFormation = (formation && Object.keys(FORMATION_TEMPLATES).includes(formation)) ? formation : fallback;
        const template = FORMATION_TEMPLATES[cleanFormation];

        // 1. Prepare Players with Metadata
        const availablePlayers = lineup
            .map(entry => ({
                ...entry,
                player: players[entry.playerId],
                bucket: parsePositionToBucket(entry.position || players[entry.playerId]?.position || '')
            }))
            .filter(p => p.player && p.isStarter !== false);

        // 2. Bucket Players to match Template Roles
        // We need to fill the template slots.
        // Strategy: 
        // - Sort template slots by role (GK, DEF, DM, MID, AM, FW)
        // - Sort available players by role
        // - Match best visual fit? 
        //
        // BETTER STRATEGY: 
        // Group available players by bucket.
        // Group template slots by bucket.
        // Fill slots.
        // If overflow/underflow, spill over to adjacent buckets (DEF->DM->MID->AM->FW).

        const rolesOrder = ['GK', 'DEF', 'DM', 'MID', 'AM', 'FW'];
        const playersByRole: Record<string, typeof availablePlayers> = {};
        const slotsByRole: Record<string, FormationSlot[]> = {};

        rolesOrder.forEach(r => {
            playersByRole[r] = [];
            slotsByRole[r] = [];
        });

        // Distribute players into buckets
        availablePlayers.forEach(p => {
            // Basic sort key to keep L->R order if provided in API which usually lists LB before RB
            // If not provided, we rely on array order.
            const bucket = p.bucket;
            if (playersByRole[bucket]) playersByRole[bucket].push(p);
            else playersByRole['MID'].push(p); // Fallback
        });

        // Distribute slots into buckets
        if (template) {
            template.forEach(slot => {
                if (slotsByRole[slot.role]) slotsByRole[slot.role].push(slot);
                else if (slotsByRole['MID']) slotsByRole['MID'].push(slot); // Fallback
            });
        } else {
            console.warn(`Formation template not found for ${cleanFormation}, defaulting...`);
            // Fallback logic if somehow template is missing
        }

        // Sort slots by X to ensure Left-to-Right filling
        Object.values(slotsByRole).forEach(slots => slots.sort((a, b) => a.x - b.x));

        // 3. Assign Players to Slots by Role
        // NEW APPROACH: Match players to slots within their role groups
        // This ensures defenders go to defender slots, forwards to forward slots, etc.
        const pitchPlayers: PitchPlayer[] = [];

        // Process each role in order
        rolesOrder.forEach(role => {
            const rolePlayers = playersByRole[role];
            const roleSlots = slotsByRole[role];

            // Assign players to slots within this role
            roleSlots.forEach((slot, slotIndex) => {
                const playerEntry = rolePlayers[slotIndex];

                if (!playerEntry) {
                    // If we don't have enough players for this role, try to find from adjacent roles
                    // This handles cases like 4-2-3-1 where DM/AM might be labeled as MID
                    const adjacentRoles = getAdjacentRoles(role);
                    for (const adjRole of adjacentRoles) {
                        const adjPlayers = playersByRole[adjRole];
                        if (adjPlayers.length > slotsByRole[adjRole].length) {
                            // This role has extra players, borrow one
                            const borrowedPlayer = adjPlayers[slotsByRole[adjRole].length];
                            if (borrowedPlayer) {
                                assignPlayerToSlot(borrowedPlayer, slot, isHome, pitchPlayers, playerStats);
                                break;
                            }
                        }
                    }
                    return;
                }

                assignPlayerToSlot(playerEntry, slot, isHome, pitchPlayers, playerStats);
            });
        });

        return pitchPlayers;
    };

    // Helper function to get adjacent roles for flexible assignment
    const getAdjacentRoles = (role: string): string[] => {
        const adjacencyMap: Record<string, string[]> = {
            'GK': [], // GK is strict
            'DEF': ['DM', 'MID'], // Defenders can cover DM if needed
            'DM': ['DEF', 'MID'], // DM can be filled by DEF or MID
            'MID': ['DM', 'AM', 'DEF', 'FW'], // MID can be filled by almost anything in 5-a-side
            'AM': ['MID', 'FW'], // AM can be filled by MID or FW
            'FW': ['AM', 'MID'], // FW can be covered by AM or MID
        };
        return adjacencyMap[role] || [];
    };

    // Helper function to assign a player to a slot
    const assignPlayerToSlot = (
        playerEntry: any,
        slot: FormationSlot,
        isHome: boolean,
        pitchPlayers: PitchPlayer[],
        playerStats: Map<string, { goals: number; assists: number }>
    ) => {
        let finalX = slot.x;
        let finalY = 0;

        if (isHome) {
            // Home: Bottom Half (50 -> 100)
            finalY = 100 - (slot.y / 100 * 52);
        } else {
            // Away: Top Half (0 -> 50)
            finalY = (slot.y / 100 * 48);
            // Mirror X for Away team
            finalX = 100 - slot.x;
        }

        // Get player stats
        const stats = playerStats.get(playerEntry.playerId) || { goals: 0, assists: 0 };

        pitchPlayers.push({
            player: playerEntry.player,
            position: { x: finalX, y: finalY },
            rating: playerEntry.rating || 0,
            isCaptain: !!playerEntry.isCaptain,
            isMotM: !!playerEntry.isMotM,
            goals: stats.goals,
            assists: stats.assists,
        });
    };

    // Minimal fallback for non-football (not the focus of refactor)
    const processBasketballLineup = (players: Record<string, Player>, lineup: any[], isHome: boolean) => {
        // [Existing logic wrapper or simplified]
        return lineup.map((entry, i) => ({
            player: players[entry.playerId],
            position: { x: 20 + (i % 3) * 30, y: isHome ? 70 : 30 }, // Dummy placement
            rating: entry.rating || 0
        })).filter(p => p.player) as PitchPlayer[];
    };

    const getFallbackFormation = () => {
        if (variant === '3x3') return DEFAULT_FORMATION_3x3;
        if (variant === 'basketball') return DEFAULT_FORMATION_BASKETBALL;
        if (variant === '5-a-side') return DEFAULT_FORMATION_5ASIDE;
        return DEFAULT_FORMATION;
    };

    const homePitchPlayers = processLineupForPitch(homePlayers, homeLineup, true, homeTeam.formation || getFallbackFormation());
    const awayPitchPlayers = processLineupForPitch(awayPlayers, awayLineup, false, awayTeam.formation || getFallbackFormation());

    const allPitchPlayers = [...homePitchPlayers, ...awayPitchPlayers];

    // Helper to get subs (unchanged logic)
    const getSubstitutes = (players: Record<string, Player>, lineup: any[], propSubs?: any[]) => {
        if (propSubs && propSubs.length > 0) {
            return propSubs.map(entry => {
                const player = players[entry.playerId];
                if (!player) return null;
                return {
                    player,
                    rating: entry.rating || 0,
                    position: entry.position || player.position || 'SUB',
                    teamColor: ''
                };
            }).filter((p): p is NonNullable<typeof p> => p !== null);
        }
        return lineup
            .filter(entry => entry.isStarter === false)
            .map(entry => {
                const player = players[entry.playerId];
                if (!player) return null;
                return {
                    player,
                    rating: entry.rating || 0,
                    position: entry.position || player.position || 'SUB',
                    teamColor: ''
                };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);
    };

    const homeSubs = getSubstitutes(homePlayers, homeLineup, propHomeSubs);
    const awaySubs = getSubstitutes(awayPlayers, awayLineup, propAwaySubs);

    return (
        <div className="w-full space-y-4 md:space-y-6">
            {/* Team Headers */}
            <div className="hidden md:flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <img src={homeTeam.logo} alt={homeTeam.name} className="w-10 h-10 object-contain" />
                    <div>
                        <span className="font-bold text-lg">{homeTeam.name}</span>
                        <div className="text-sm text-white/60">{homeTeam.formation || getFallbackFormation()}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <span className="font-bold text-lg">{awayTeam.name}</span>
                        <div className="text-sm text-white/60">{awayTeam.formation || getFallbackFormation()}</div>
                    </div>
                    <img src={awayTeam.logo} alt={awayTeam.name} className="w-10 h-10 object-contain" />
                </div>
            </div>

            {/* Responsive Pitch Component - Full Width */}
            <div className="w-full max-w-none mx-auto px-0 py-2 sm:py-3 lg:py-4">
                <div
                    className={`
                        relative
                        w-full
                        ${variant === '5-a-side' || variant === '3x3'
                            ? 'aspect-[1/2] max-w-[400px] mx-auto'
                            : variant === 'basketball'
                                ? 'aspect-[2/3] max-w-[500px] mx-auto'
                                : 'aspect-[7/10] sm:aspect-[3/5] lg:aspect-[3/4]'}
                    `}
                >
                    <ResponsivePitch
                        players={allPitchPlayers}
                        homeTeamColor={homeTeam.color}
                        awayTeamColor={awayTeam.color}
                        onPlayerClick={onPlayerClick}
                        orientation="vertical"
                        variant={variant}
                    />
                </div>
            </div>

            {/* Bench Section */}
            {(homeSubs.length > 0 || awaySubs.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
                    {/* Home Bench */}
                    {homeSubs.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                                <img src={homeTeam.logo} alt={homeTeam.name} className="w-6 h-6 object-contain" />
                                <span className="font-bold text-sm">Valid Substitutes</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {homeSubs.map((sub) => (
                                    <BenchPlayer
                                        key={sub.player.id}
                                        player={sub.player}
                                        rating={sub.rating}
                                        position={sub.position}
                                        teamColor={homeTeam.color}
                                        onClick={() => onPlayerClick(sub.player)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Away Bench */}
                    {awaySubs.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 border-b border-white/10 pb-2 justify-end md:justify-start">
                                <img src={awayTeam.logo} alt={awayTeam.name} className="w-6 h-6 object-contain order-first md:order-last" />
                                <span className="font-bold text-sm">Valid Substitutes</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {awaySubs.map((sub) => (
                                    <BenchPlayer
                                        key={sub.player.id}
                                        player={sub.player}
                                        rating={sub.rating}
                                        position={sub.position}
                                        teamColor={awayTeam.color}
                                        onClick={() => onPlayerClick(sub.player)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface BenchPlayerProps {
    player: Player;
    rating: number;
    position: string;
    teamColor: string;
    onClick: () => void;
}

function BenchPlayer({ player, rating, position, teamColor, onClick }: BenchPlayerProps) {
    const getRatingColor = (rating: number) => {
        if (rating === 0) return 'bg-white/10 text-white/40';
        if (rating >= 7.0) return 'bg-green-500/20 text-green-400';
        if (rating >= 6.0) return 'bg-yellow-500/20 text-yellow-400';
        return 'bg-red-500/20 text-red-400';
    };

    return (
        <div
            onClick={onClick}
            className="flex-shrink-0 flex items-center gap-1.5 sm:gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
        >
            {/* Jersey number */}
            <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold"
                style={{ backgroundColor: teamColor + '40', color: '#fff' }}
            >
                {player.number}
            </div>

            {/* Player info */}
            <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-white truncate max-w-[150px]">
                    {player.jerseyName || player.name.split(' ').pop()}
                </div>
                <div className="text-[9px] sm:text-[10px] text-white/60">{position}</div>
            </div>

            {/* Rating */}
            {rating > 0 && (
                <div className={`ml-auto px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${getRatingColor(rating)}`}>
                    {rating.toFixed(1)}
                </div>
            )}
        </div>
    );
}
