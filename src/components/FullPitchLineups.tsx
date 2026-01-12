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
}

// ========== FORMATION CONFIGURATION ==========
// X: 0-100 (Left->Right)
// Y: 0-100 (Home Perspective: 0=GK line, 100=Striker line) -> We will map this to 0-50/50-100 later.
// Note: We use a "Home Bottom" standard for defining these.
// 0 = Keeper, 10-30 = Defense, 40-60 = Midfield, 70-90 = Attack.

type FormationSlot = {
    x: number;
    y: number; // 0-100 relative to half-pitch depth (will be scaled)
    role: string; // 'GK', 'DEF', 'MID', 'FW', etc. used for bucket matching
};

type FormationTemplate = FormationSlot[];

const FORMATION_TEMPLATES: Record<string, FormationTemplate> = {
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
        { x: 10, y: 25, role: 'DEF' }, { x: 30, y: 25, role: 'DEF' }, { x: 50, y: 25, role: 'DEF' }, { x: 70, y: 25, role: 'DEF' }, { x: 90, y: 25, role: 'DEF' },
        { x: 30, y: 55, role: 'MID' }, { x: 50, y: 55, role: 'MID' }, { x: 70, y: 55, role: 'MID' },
        { x: 35, y: 85, role: 'FW' }, { x: 65, y: 85, role: 'FW' }
    ],
    '5-4-1': [
        { x: 50, y: 5, role: 'GK' },
        { x: 10, y: 30, role: 'DEF' }, { x: 30, y: 30, role: 'DEF' }, { x: 50, y: 30, role: 'DEF' }, { x: 70, y: 30, role: 'DEF' }, { x: 90, y: 30, role: 'DEF' },
        { x: 15, y: 60, role: 'MID' }, { x: 38, y: 60, role: 'MID' }, { x: 62, y: 60, role: 'MID' }, { x: 85, y: 60, role: 'MID' },
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
    ]
};

// Default fallback
const DEFAULT_FORMATION = '4-4-2';

// Helper to normalize position string to broad buckets for slot filling
const parsePositionToBucket = (pos: string): string => {
    const p = pos.toLowerCase().trim();
    if (p.includes('gk') || p.includes('goalkeeper')) return 'GK';
    if (p.includes('dm') || p.includes('defensive mid') || p.includes('cdm')) return 'DM';
    if (p.includes('am') || p.includes('attacking mid') || p.includes('cam')) return 'AM';
    if (p.includes('def') || p.includes('back') || p.includes('cb') || p.includes('lb') || p.includes('rb')) return 'DEF';
    if (p.includes('mid') || p.includes('wing') || p.includes('lm') || p.includes('rm')) return 'MID';
    if (p.includes('fw') || p.includes('st') || p.includes('cf')) return 'FW';
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
    sport = 'Football'
}: FullPitchLineupsProps) {
    const isBasketball = sport === 'Basketball';

    // *** FOOTBALL LOGIC: Formation Slot Mapping ***
    const processLineupForPitch = (players: Record<string, Player>, lineup: any[], isHome: boolean, formation: string): PitchPlayer[] => {
        if (isBasketball) {
            // ... Keep existing basketball logic simplifed or return early ...
            // For now, let's keep a minimal fallback if sport is basketball, 
            // but the prompt is specifically about Football refactor.
            // Retaining simple basketball logic from before just in case.
            return processBasketballLineup(players, lineup, isHome);
        }

        const cleanFormation = (Object.keys(FORMATION_TEMPLATES).includes(formation)) ? formation : DEFAULT_FORMATION;
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
        template.forEach(slot => {
            if (slotsByRole[slot.role]) slotsByRole[slot.role].push(slot);
            else if (slotsByRole['MID']) slotsByRole['MID'].push(slot); // Fallback
        });

        // Sort slots by X to ensure Left-to-Right filling
        Object.values(slotsByRole).forEach(slots => slots.sort((a, b) => a.x - b.x));

        // 3. Assign Players to Slots
        const pitchPlayers: PitchPlayer[] = [];

        // We iterate through the roles. 
        // If mapped exact role exists, use it.
        // If not, we might have mismatch (e.g. Formation has DM, Player has MID).
        // Resolving this dynamically.

        // ALTERNATIVE: 
        // Just fill slots in order (GK, DEF, MID, FW) and players in order (GK, DEF, MID, FW).
        // If 4-2-3-1: Slots are [GK], [4 DEF], [2 DM], [3 AM], [1 FW]. Total 11.
        // Players are [GK], [4 DEF], [5 MID/AM?], [1 FW].
        // We just map the lists index-to-index.

        const sortedTemplate = [...template].sort((a, b) => {
            if (Math.abs(a.y - b.y) > 10) return a.y - b.y; // Sort by line (depth)
            return a.x - b.x; // Sort by L->R
        });

        // Sort players by "Line Depth" then "Order"
        // We assign a depth score to player buckets
        const bucketDepth: Record<string, number> = { 'GK': 0, 'DEF': 1, 'DM': 2, 'MID': 3, 'AM': 4, 'FW': 5 };

        const sortedPlayers = [...availablePlayers].sort((a, b) => {
            const depthA = bucketDepth[parsePositionToBucket(a.position || '')] || 3;
            const depthB = bucketDepth[parsePositionToBucket(b.position || '')] || 3;
            if (depthA !== depthB) return depthA - depthB;
            // Stable sort otherwise (rely on lineup order)
            return 0;
        });

        // Now we have 11 slots (usually) and 11 players.
        // Map 1:1.
        // This handles "Formation driven layout" perfectly. 
        // If the formation is 4-2-3-1, we simply fill the 11 slots (GK->DEF->DM->AM->FW) with the 11 players (GK->DEF->MID...->FW).
        // This assumes the API returns players in roughly the correct tactical order or grouped by line, which is standard.

        sortedTemplate.forEach((slot, index) => {
            const playerEntry = sortedPlayers[index];
            if (!playerEntry) return;

            // Calculate Final Position
            // Home (Bottom): Y is normal (0-100 where 0=GK is wrong... 
            // In our template, 5=GK, 85=FW. 
            // But visually, Bottom is 100%. 
            // FotMob Home is Bottom. So GK should be at ~90%.
            // Our Template: 0=GK, 100=FW? 
            // Let's redefine Template Y: 0 = Goal Line (GK), 100 = Halfway Line.
            // Home Team (Bottom): GK at Y=95, FW at Y=50.
            // Away Team (Top): GK at Y=5, FW at Y=50.

            // Wait, standard Pitch Y is 0 (Top) to 100 (Bottom).
            // Home Team (occupies 50-100):
            // GK at 95. FW at 55.
            // Template Y (0-100 relative to half): 
            // Slot.y = 5 (GK). 
            // Home Y = 100 - (Slot.y / 100 * 50). -> 100 - 2.5 = 97.5. 
            // If Slot.y = 85 (FW) -> 100 - (85/100 * 50) = 100 - 42.5 = 57.5.

            // Away Team (occupies 0-50):
            // GK at 5. FW at 45.
            // Away Y = Slot.y / 100 * 50. -> 2.5 (GK).
            // If Slot.y = 85 (FW) -> 42.5.

            let finalX = slot.x;
            let finalY = 0;

            if (isHome) {
                // Home: Bottom Half (50 -> 100)
                // Expanded slightly per FotMob logic
                finalY = 100 - (slot.y / 100 * 52);
            } else {
                // Away: Top Half (0 -> 50)
                // Compressed slightly per FotMob logic
                finalY = (slot.y / 100 * 48);

                // Mirror X for Away team to match broadcast perspective
                // (Right Back on screen right for Away team)
                finalX = 100 - slot.x;
            }

            pitchPlayers.push({
                player: playerEntry.player,
                position: { x: finalX, y: finalY },
                rating: playerEntry.rating || 0,
                isCaptain: !!playerEntry.isCaptain,
                isMotM: !!playerEntry.isMotM,
            });
        });

        return pitchPlayers;
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

    const homePitchPlayers = processLineupForPitch(homePlayers, homeLineup, true, homeTeam.formation || DEFAULT_FORMATION);
    const awayPitchPlayers = processLineupForPitch(awayPlayers, awayLineup, false, awayTeam.formation || DEFAULT_FORMATION);

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
                        <div className="text-sm text-white/60">{homeTeam.formation || '4-4-2'}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <span className="font-bold text-lg">{awayTeam.name}</span>
                        <div className="text-sm text-white/60">{awayTeam.formation || '4-4-2'}</div>
                    </div>
                    <img src={awayTeam.logo} alt={awayTeam.name} className="w-10 h-10 object-contain" />
                </div>
            </div>

            {/* Responsive Pitch Component - Full Width */}
            <div className="w-full max-w-none mx-auto px-0 py-2 sm:py-3 lg:py-4">
                <div
                    className="
                        relative
                        w-full
                        aspect-[9/16]
                        sm:aspect-[3/5]
                        lg:aspect-[3/4]
                    "
                >
                    <ResponsivePitch
                        players={allPitchPlayers}
                        homeTeamColor={homeTeam.color}
                        awayTeamColor={awayTeam.color}
                        onPlayerClick={onPlayerClick}
                        orientation="vertical"
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
