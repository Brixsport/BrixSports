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

    // Helper to determine side from string or coordinate
    function getSide(str: string, x?: number): 'L' | 'R' | 'C' {
        const s = str.toLowerCase();
        if (s.includes('l') && !s.includes('c') && !s.includes('r')) return 'L'; // e.g. LB, LW
        if (s.includes('r') && !s.includes('c') && !s.includes('l')) return 'R'; // e.g. RB, RW
        if (s.startsWith('l') || s.endsWith('l')) return 'L'; // LCB, LCM
        if (s.startsWith('r') || s.endsWith('r')) return 'R'; // RCB, RCM

        // Fallback to coordinates
        if (x !== undefined) {
            if (x < 35) return 'L';
            if (x > 65) return 'R';
        }
        return 'C';
    }

    function getPositionScore(player: Player, slot: FormationPosition): number {
        let score = 0;
        const pPos = player.position.toUpperCase();
        const sPos = slot.position.toUpperCase();
        const sId = slot.id.toLowerCase();

        // 1. Exact Match (Highest Priority)
        // e.g. 'CDM' == 'CDM'
        if (pPos === sPos) score += 100;

        // 2. Partial Match
        // e.g. 'CDM' in 'LCDM' slot? or 'CB' in 'LCB'?
        // Usually slot.position is just 'CB'.
        // So this check is covered by 1 mostly.

        // 3. Side Agreement (Crucial for LCB vs RCB)
        const pSide = getSide(player.position); // e.g. LCB -> L
        const sSide = getSide(slot.id, slot.x); // e.g. lcb -> L, x=30 -> L

        if (pSide === sSide) {
            score += 50;
        } else if (pSide !== 'C' && sSide !== 'C') {
            // Explicit Mismatch (L vs R)
            score -= 50;
        }

        // 4. Center Bias checking
        // If player is 'C' (e.g. CDM) and slot is 'C' (x=50), bonus
        if (pSide === 'C' && sSide === 'C') score += 25;

        return score;
    }

    function fillSlots(zone: 'GK' | 'DEF' | 'MID' | 'FWD') {
        const availableSlots = slots.filter(s => s.zone === zone);
        let availablePlayers = [...pool[zone]];

        // We want to find the BEST match for each slot globally, or greedily?
        // Greedy approach: Calculate all scores, pick best pair, remove, repeat.

        // Calculate all possible pair scores
        interface MatchParams {
            slotIndex: number;
            playerIndex: number;
            score: number;
        }

        const matches: MatchParams[] = [];

        availableSlots.forEach((slot, sIdx) => {
            availablePlayers.forEach((player, pIdx) => {
                matches.push({
                    slotIndex: sIdx,
                    playerIndex: pIdx,
                    score: getPositionScore(player, slot)
                });
            });
        });

        // Sort by Score Descending
        matches.sort((a, b) => b.score - a.score);

        const assignedSlotIndices = new Set<number>();
        const assignedPlayerIndices = new Set<number>();

        // Assign best matches
        for (const match of matches) {
            if (assignedSlotIndices.has(match.slotIndex) || assignedPlayerIndices.has(match.playerIndex)) {
                continue;
            }

            const slot = availableSlots[match.slotIndex];
            const player = availablePlayers[match.playerIndex];

            mapPlayerToSlot(player, slot);

            assignedSlotIndices.add(match.slotIndex);
            assignedPlayerIndices.add(match.playerIndex);
        }

        // Handle leftovers (highly unlikely in standard formations if numbers match)
        // If there are unassigned slots and unassigned players, fall back to simple fill?
        if (assignedSlotIndices.size < availableSlots.length && assignedPlayerIndices.size < availablePlayers.length) {
            // Get unassigned items
            const remainingSlots = availableSlots.filter((_, idx) => !assignedSlotIndices.has(idx)).sort((a, b) => a.x - b.x);
            const remainingPlayers = availablePlayers.filter((_, idx) => !assignedPlayerIndices.has(idx)); // Order?

            // Just zip them up left-to-right
            for (let i = 0; i < Math.min(remainingSlots.length, remainingPlayers.length); i++) {
                mapPlayerToSlot(remainingPlayers[i], remainingSlots[i]);
            }
        }

        function mapPlayerToSlot(player: Player, slot: FormationPosition) {
            let finalX = slot.x; // 0-100
            let finalY = slot.y; // 0-100

            if (isHomeTeam) {
                finalY = 50 + (finalY / 2);
            } else {
                finalY = (100 - finalY) / 2;
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

    fillSlots('GK');
    fillSlots('DEF');
    fillSlots('MID');
    fillSlots('FWD');

    return assignedPlayers;
}
