// Lineup types and interfaces

export interface LineupPlayer {
    playerId: string;
    position: string;
    jerseyNumber: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
    // Player details (populated from API)
    name?: string;
    jerseyName?: string;
    rating?: number;
}

export interface TeamLineup {
    formation: string;
    starters: LineupPlayer[];
    substitutes: LineupPlayer[];
    status: 'draft' | 'published';
    publishedAt?: string;
    updatedAt?: string;
}

export interface MatchLineups {
    home?: TeamLineup;
    away?: TeamLineup;
}

export interface LineupValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export const validateLineup = (lineup: TeamLineup, sport: 'Football' | 'Basketball'): LineupValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check number of starters
    const requiredStarters = sport === 'Basketball' ? 5 : 11;
    if (!lineup.starters || lineup.starters.length !== requiredStarters) {
        errors.push(`Must have exactly ${requiredStarters} starters`);
    }

    // Check for captain
    const captainCount = lineup.starters.filter(p => p.isCaptain).length;
    if (captainCount === 0) {
        errors.push('Must have a captain');
    } else if (captainCount > 1) {
        errors.push('Can only have one captain');
    }

    // Check for vice-captain
    const viceCaptainCount = lineup.starters.filter(p => p.isViceCaptain).length;
    if (viceCaptainCount > 1) {
        errors.push('Can only have one vice-captain');
    }

    // Check for duplicate players
    const allPlayerIds = [
        ...lineup.starters.map(p => p.playerId),
        ...(lineup.substitutes || []).map(p => p.playerId)
    ];
    const uniquePlayerIds = new Set(allPlayerIds);
    if (allPlayerIds.length !== uniquePlayerIds.size) {
        errors.push('Cannot have duplicate players');
    }

    // Check for duplicate jersey numbers
    const allJerseyNumbers = [
        ...lineup.starters.map(p => p.jerseyNumber),
        ...(lineup.substitutes || []).map(p => p.jerseyNumber)
    ];
    const uniqueJerseyNumbers = new Set(allJerseyNumbers);
    if (allJerseyNumbers.length !== uniqueJerseyNumbers.size) {
        errors.push('Cannot have duplicate jersey numbers');
    }

    // Warnings
    if (!lineup.substitutes || lineup.substitutes.length === 0) {
        warnings.push('No substitutes selected');
    }

    if (!viceCaptainCount) {
        warnings.push('No vice-captain selected');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};

export const createEmptyLineup = (formation: string, sport: 'Football' | 'Basketball'): TeamLineup => {
    return {
        formation,
        starters: [],
        substitutes: [],
        status: 'draft'
    };
};
