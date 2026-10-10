// Lineup types and interfaces

export interface LineupPlayer {
    playerId: string;
    position: string;
    jerseyNumber: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
    // Explicit placement (BACKLOG-323) -- optional so existing position-string-only
    // data keeps validating. slotId is the canonical identity (see
    // src/lib/lineup/formations.ts); x/y are a denormalized render-space snapshot,
    // re-derived server-side from slotId on write, never trusted from the client.
    slotId?: string;
    x?: number;
    y?: number;
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
    // BACKLOG-323: absent or 1 = legacy (position-string, read-time inference);
    // 2 = every starter carries a resolved slotId/x/y (see isV2Lineup()).
    placementVersion?: number;
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

    // BACKLOG-323: if any starter carries a slotId, every starter must have one
    // (a mixed legacy/explicit lineup can't be reliably placed), and no two
    // starters may share the same slot.
    const startersWithSlot = lineup.starters.filter(p => typeof p.slotId === 'string' && p.slotId.length > 0);
    if (startersWithSlot.length > 0 && startersWithSlot.length !== lineup.starters.length) {
        errors.push('All starters must have a slot assigned, or none -- cannot mix explicit placement with unplaced starters');
    } else if (startersWithSlot.length > 0) {
        const slotIds = startersWithSlot.map(p => p.slotId as string);
        const uniqueSlotIds = new Set(slotIds);
        if (slotIds.length !== uniqueSlotIds.size) {
            errors.push('Cannot have two starters in the same formation slot');
        }
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
