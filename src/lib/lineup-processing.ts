import { Player } from '@/types';
import { footballFormations, getFormationById, FormationPosition } from './formations';

export interface ProcessedPitchPlayer {
    player: Player;
    x: number;
    y: number;
    role: string;
}

/**
 * Normalizes a position string to a broad zone/bucket for better matching.
 */
function normalizePosition(pos: string): 'GK' | 'DEF' | 'MID' | 'FWD' {
    const p = pos.toUpperCase().trim();
    if (['GK', 'GOALKEEPER'].includes(p)) return 'GK';
    if (['CB', 'LB', 'RB', 'LWB', 'RWB', 'SW', 'DEFINDER', 'BACK'].some(s => p.includes(s))) return 'DEF';
    if (['CM', 'CDM', 'CAM', 'LM', 'RM', 'MIDFIELDER', 'WING'].some(s => p.includes(s))) return 'MID';
    if (['ST', 'CF', 'LW', 'RW', 'FORWARD', 'ATTACKER'].some(s => p.includes(s))) return 'FWD';
    return 'MID'; // Default fallback
}

/**
 * Processes a lineup of players against a specific formation.
 * Ensures players are mapped to the correct visual coordinates.
 */
export function processLineup(
    players: Player[],
    formationId: string,
    isHomeTeam: boolean = true
): ProcessedPitchPlayer[] {
    const formation = getFormationById(formationId, 'Football') || footballFormations.find(f => f.id === '4-4-2')!;

    // 1. Group players by standardized zones
    const pool = {
        GK: [] as Player[],
        DEF: [] as Player[],
        MID: [] as Player[],
        FWD: [] as Player[]
    };

    // Sort players by ID to ensure deterministic order mostly, 
    // but ideally we respect lineup order if it implies position.
    // Assuming 'players' array is passed in order (GK, Defenders, Midfielders, Forwards)
    players.forEach(p => {
        const zone = normalizePosition(p.position);
        pool[zone].push(p);
    });

    // 2. Identify slots to fill
    const slots = [...formation.positions];
    const assignedPlayers: ProcessedPitchPlayer[] = [];

    // Helper to fill a set of slots with a set of players
    function fillSlots(zone: 'GK' | 'DEF' | 'MID' | 'FWD') {
        const zoneSlots = slots.filter(s => s.zone === zone).sort((a, b) => a.x - b.x); // Left to right
        const zonePlayers = pool[zone];

        // Map 1:1 as best as possible
        // If we have more slots than players, some slots remain empty.
        // If we have more players than slots, we need to spill over or overload.

        // Strategy: Fill Left-to-Right slots with Left-to-Right players?
        // Usually, lineup arrays are list: LB, CB, CB, RB.
        // Slots sorted X: 15(LB), 38(LCB), 62(RCB), 85(RB).
        // Matches perfectly.

        for (let i = 0; i < zoneSlots.length; i++) {
            if (i < zonePlayers.length) {
                const player = zonePlayers[i];
                const slot = zoneSlots[i];

                // Calculate Coordinates
                // For Home Team (Bottom 50-100% usually, or full pitch 0-100 where 100 is bottom/defense?)
                // User spec: "0=attack/top, 100=defense/bottom"
                // If this is for a full pitch view where Home is at bottom:
                // GK is at 95 (Bottom). FWD is at 15 (Top).
                // Wait, if 0 is attack (top) and 100 is defense (bottom), then:
                // GK at 95 is correct (near own goal at bottom).
                // FWD at 15 is correct (near opponent goal at top).

                // HOWEVER, typically Home attacks UP (GK at bottom) or Away attacks DOWN (GK at top).
                // If we want both teams on one pitch:
                // Home Team: GK at Bottom (y=95).
                // Away Team: GK at Top (y=5).

                // So if isHomeTeam: Use coords as is.
                // If !isHomeTeam: Mirror coords (x becomes 100-x, y becomes 100-y).
                // Wait, if Away GK is at Top (0-5), and template says y=95 for GK...
                // Then Away Y = 100 - TemplateY. (100-95 = 5).
                // Away FWD (Template 15) -> 100 - 15 = 85 (near Home goal). Correct.

                let finalX = slot.x; // 0-100
                let finalY = slot.y; // 0-100 (Where 100 is Goal Line, 0 is High Press)

                // COMPRESSION LOGIC: "FotMob Style" Lineup View
                // Each team stays in their own half (Home Bottom, Away Top)
                // They do NOT cross the halfway line (50%)

                if (isHomeTeam) {
                    // Home defends Bottom (100). 
                    // Map 0->100 range to 50->100 range.
                    // y=92 (GK) -> 50 + 46 = 96.
                    // y=15 (ST) -> 50 + 7.5 = 57.5.
                    finalY = 50 + (finalY / 2);
                    finalX = finalX; // Keep X as is
                } else {
                    // Away defends Top (0).
                    // Map 0->100 range to 0->50 range, BUT mirrored vertically.
                    // We want GK (template 92) to be at Top (near 0).
                    // We want ST (template 15) to be at Center (near 50).
                    // Formula: (100 - y) / 2
                    // y=92 -> 8 / 2 = 4.
                    // y=15 -> 85 / 2 = 42.5.
                    finalY = (100 - finalY) / 2;

                    // Mirror X for Away team (Left Winger becomes Screen Right)
                    finalX = 100 - finalX;
                }

                assignedPlayers.push({
                    player,
                    x: finalX,
                    y: finalY,
                    role: slot.position
                });
            }
        }

        // Handle overflow (players without slots) - unlikely in strict 11v11 but possible
        const remaining = zonePlayers.slice(zoneSlots.length);
        if (remaining.length > 0) {
            // Find nearest zone or just dump in middle? 
            // For now, ignore or log. In a real app we might put them on the sideline or generic positions.
            console.warn(`Unassigned players in zone ${zone}:`, remaining.map(p => p.name));
        }
    }

    fillSlots('GK');
    fillSlots('DEF');
    fillSlots('MID');
    fillSlots('FWD');

    return assignedPlayers;
}
