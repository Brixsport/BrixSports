/**
 * Competition Player Eligibility Helpers
 * Utility functions for filtering players by institutional data based on competition level
 * 
 * PLAYER PROFILE TYPES:
 * 
 * 1. INTERNAL PLAYERS (e.g., Bells University students)
 *    - Full profile: university + college + department + club team(s)
 *    - Can compete in: departmental, college, university, inter-university
 *    - Example: John (Bells Univ > Engineering > CS > Joga Bonito FC)
 * 
 * 2. EXTERNAL PLAYERS (e.g., from other universities)
 *    - Partial profile: university + school team ONLY
 *    - NO college/department data (data not available or not applicable)
 *    - Can compete in: inter-university ONLY
 *    - Example: Ahmed (Covenant University > Covenant FC)
 * 
 * The system must handle both gracefully without errors.
 */

import { Player, Team } from '@/db/schema';

export type CompetitionLevel = 'departmental' | 'college' | 'university' | 'busa-league' | 'inter-university' | 'external';

/**
 * Checks if a player is eligible for a competition based on the competition level
 * and the player's institutional data.
 * 
 * FILTERING LOGIC:
 * - Departmental: Requires player.department (internal players only)
 * - College: Requires player.college (internal players only)
 * - University/BUSA: Requires player.university (both internal and external)
 * - Inter-University: NO filtering needed (accepts all universities)
 *   External players without college/department can compete at this level
 */
export function isPlayerEligible(
    player: Player,
    team: Team | null,
    level: CompetitionLevel
): boolean {
    // Get institutional data from player, fallback to team
    const playerUniversity = player.university || team?.university;
    const playerCollege = player.college;
    const playerDepartment = player.department;

    switch (level) {
        case 'departmental':
            // Player MUST have department data
            // External players (without departments) are NOT eligible
            return !!(playerDepartment && playerDepartment.trim().length > 0);

        case 'college':
            // Player MUST have college data
            // External players (without colleges) are NOT eligible
            return !!(playerCollege && playerCollege.trim().length > 0);

        case 'university':
        case 'busa-league':
            // Player MUST have university data
            // Both internal and external players are eligible if they have university
            return !!(playerUniversity && playerUniversity.trim().length > 0);

        case 'inter-university':
        case 'external':
            // ALL players are eligible, regardless of college/department
            // External players with only university + team are valid
            return true;

        default:
            return true;
    }
}

/**
 * Filters a list of players by institutional eligibility for a competition
 */
export function filterPlayersByCompetitionLevel(
    players: (Player & { team?: Team | null })[],
    level: CompetitionLevel
): (Player & { team?: Team | null })[] {
    return players.filter(player =>
        isPlayerEligible(player, player.team || null, level)
    );
}

/**
 * Normalizes competition level string to standard format
 */
export function normalizeCompetitionLevel(level?: string | null): CompetitionLevel {
    if (!level) return 'inter-university';

    const normalized = level.toLowerCase().trim();

    if (normalized.includes('department')) return 'departmental';
    if (normalized.includes('college')) return 'college';
    if (normalized.includes('university') && !normalized.includes('inter')) return 'university';
    if (normalized.includes('busa')) return 'busa-league';
    if (normalized.includes('inter')) return 'inter-university';
    if (normalized.includes('external')) return 'external';

    return 'inter-university';
}

/**
 * Gets the filtering criteria info for a competition level
 */
export function getCompetitionLevelInfo(level: CompetitionLevel): {
    name: string;
    description: string;
    filterField: keyof Pick<Player, 'department' | 'college' | 'university'> | null;
} {
    switch (level) {
        case 'departmental':
            return {
                name: 'Departmental',
                description: 'Players from the same department',
                filterField: 'department',
            };
        case 'college':
            return {
                name: 'College',
                description: 'Players from the same college',
                filterField: 'college',
            };
        case 'university':
            return {
                name: 'University',
                description: 'Players from the same university',
                filterField: 'university',
            };
        case 'busa-league':
            return {
                name: 'BUSA League',
                description: 'Players from participating universities',
                filterField: 'university',
            };
        case 'inter-university':
            return {
                name: 'Inter-University',
                description: 'Players from any university',
                filterField: null,
            };
        case 'external':
            return {
                name: 'External/Open',
                description: 'All players welcome',
                filterField: null,
            };
        default:
            return {
                name: 'Inter-University',
                description: 'Players from any university',
                filterField: null,
            };
    }
}
