/**
 * FPL Points Calculation System
 * Based on standard Fantasy Premier League scoring rules
 */

export interface PlayerPerformance {
    position: 'GK' | 'DEF' | 'MID' | 'FWD';
    minutesPlayed: number;
    goalsScored: number;
    assists: number;
    cleanSheet: boolean;
    goalsConceded: number;
    ownGoals: number;
    penaltiesSaved: number;
    penaltiesMissed: number;
    yellowCards: number;
    redCards: number;
    saves: number;
    bonus: number;
}

export interface PointsBreakdown {
    minutesPlayed: number;
    goals: number;
    assists: number;
    cleanSheet: number;
    goalsConceded: number;
    ownGoals: number;
    penaltiesSaved: number;
    penaltiesMissed: number;
    yellowCards: number;
    redCards: number;
    saves: number;
    bonus: number;
    total: number;
}

/**
 * Calculate FPL points for a player's performance
 */
export function calculateFPLPoints(performance: PlayerPerformance): PointsBreakdown {
    const breakdown: PointsBreakdown = {
        minutesPlayed: 0,
        goals: 0,
        assists: 0,
        cleanSheet: 0,
        goalsConceded: 0,
        ownGoals: 0,
        penaltiesSaved: 0,
        penaltiesMissed: 0,
        yellowCards: 0,
        redCards: 0,
        saves: 0,
        bonus: 0,
        total: 0,
    };

    // Minutes played
    if (performance.minutesPlayed >= 60) {
        breakdown.minutesPlayed = 2;
    } else if (performance.minutesPlayed > 0) {
        breakdown.minutesPlayed = 1;
    }

    // Goals scored (position-dependent)
    if (performance.goalsScored > 0) {
        let pointsPerGoal = 0;
        switch (performance.position) {
            case 'GK':
            case 'DEF':
                pointsPerGoal = 6;
                break;
            case 'MID':
                pointsPerGoal = 5;
                break;
            case 'FWD':
                pointsPerGoal = 4;
                break;
        }
        breakdown.goals = performance.goalsScored * pointsPerGoal;
    }

    // Assists
    breakdown.assists = performance.assists * 3;

    // Clean sheet (position-dependent)
    if (performance.cleanSheet && performance.minutesPlayed >= 60) {
        switch (performance.position) {
            case 'GK':
            case 'DEF':
                breakdown.cleanSheet = 4;
                break;
            case 'MID':
                breakdown.cleanSheet = 1;
                break;
            case 'FWD':
                breakdown.cleanSheet = 0;
                break;
        }
    }

    // Goals conceded (GK and DEF only)
    if ((performance.position === 'GK' || performance.position === 'DEF') && performance.goalsConceded > 0) {
        // -1 point for every 2 goals conceded
        breakdown.goalsConceded = -Math.floor(performance.goalsConceded / 2);
    }

    // Own goals
    breakdown.ownGoals = performance.ownGoals * -2;

    // Penalties saved (GK only)
    if (performance.position === 'GK') {
        breakdown.penaltiesSaved = performance.penaltiesSaved * 5;
    }

    // Penalties missed
    breakdown.penaltiesMissed = performance.penaltiesMissed * -2;

    // Yellow cards
    breakdown.yellowCards = performance.yellowCards * -1;

    // Red cards
    breakdown.redCards = performance.redCards * -3;

    // Saves (GK only) - 1 point for every 3 saves
    if (performance.position === 'GK' && performance.saves > 0) {
        breakdown.saves = Math.floor(performance.saves / 3);
    }

    // Bonus points
    breakdown.bonus = performance.bonus;

    // Calculate total
    breakdown.total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    return breakdown;
}

/**
 * Calculate Bonus Points System (BPS)
 * This is a simplified version - in reality, BPS is more complex
 */
export function calculateBPS(performance: PlayerPerformance): number {
    let bps = 0;

    // Minutes played
    if (performance.minutesPlayed >= 60) bps += 3;

    // Goals (position-dependent)
    switch (performance.position) {
        case 'GK':
        case 'DEF':
            bps += performance.goalsScored * 24;
            break;
        case 'MID':
            bps += performance.goalsScored * 18;
            break;
        case 'FWD':
            bps += performance.goalsScored * 12;
            break;
    }

    // Assists
    bps += performance.assists * 9;

    // Clean sheet
    if (performance.cleanSheet) {
        if (performance.position === 'GK' || performance.position === 'DEF') {
            bps += 12;
        } else if (performance.position === 'MID') {
            bps += 6;
        }
    }

    // Saves (GK only)
    if (performance.position === 'GK') {
        bps += performance.saves * 2;
    }

    // Penalties saved
    bps += performance.penaltiesSaved * 15;

    // Penalties missed
    bps -= performance.penaltiesMissed * 6;

    // Yellow cards
    bps -= performance.yellowCards * 3;

    // Red cards
    bps -= performance.redCards * 9;

    // Own goals
    bps -= performance.ownGoals * 6;

    // Goals conceded (GK and DEF)
    if (performance.position === 'GK' || performance.position === 'DEF') {
        bps -= performance.goalsConceded * 2;
    }

    return Math.max(0, bps);
}

/**
 * Determine bonus points (1, 2, or 3) based on BPS ranking
 */
export function assignBonusPoints(playerBPS: { playerId: string; bps: number }[]): Map<string, number> {
    const bonusMap = new Map<string, number>();

    // Sort by BPS descending
    const sorted = [...playerBPS].sort((a, b) => b.bps - a.bps);

    if (sorted.length === 0) return bonusMap;

    // Assign 3 points to highest BPS
    bonusMap.set(sorted[0].playerId, 3);

    // Assign 2 points to second highest (if different BPS)
    if (sorted.length > 1 && sorted[1].bps < sorted[0].bps) {
        bonusMap.set(sorted[1].playerId, 2);
    } else if (sorted.length > 1 && sorted[1].bps === sorted[0].bps) {
        bonusMap.set(sorted[1].playerId, 3); // Tie for first
    }

    // Assign 1 point to third highest (if different BPS)
    if (sorted.length > 2 && sorted[2].bps < sorted[1].bps) {
        bonusMap.set(sorted[2].playerId, 1);
    } else if (sorted.length > 2 && sorted[2].bps === sorted[1].bps) {
        const secondBPS = sorted[1].bps;
        if (secondBPS === sorted[0].bps) {
            bonusMap.set(sorted[2].playerId, 3); // Three-way tie for first
        } else {
            bonusMap.set(sorted[2].playerId, 2); // Tie for second
        }
    }

    return bonusMap;
}

/**
 * Calculate team points for a gameweek
 */
export function calculateTeamPoints(
    selections: {
        playerId: string;
        position: number; // 1-15
        isCaptain: boolean;
        isViceCaptain: boolean;
        multiplier: number;
        points: number;
    }[]
): { totalPoints: number; autosubs: { out: string; in: string }[] } {
    let totalPoints = 0;
    const autosubs: { out: string; in: string }[] = [];

    // Sort by position (starting XI first)
    const starting = selections.filter(s => s.position <= 11).sort((a, b) => a.position - b.position);
    const bench = selections.filter(s => s.position > 11).sort((a, b) => a.position - b.position);

    // Check for players who didn't play (0 points)
    const nonPlayers = starting.filter(s => s.points === 0);

    // Auto-substitute from bench
    for (const nonPlayer of nonPlayers) {
        for (const benchPlayer of bench) {
            // Check if bench player can substitute (basic validation)
            if (benchPlayer.points > 0 && !autosubs.find(a => a.in === benchPlayer.playerId)) {
                autosubs.push({ out: nonPlayer.playerId, in: benchPlayer.playerId });
                break;
            }
        }
    }

    // Calculate points for starting XI (with autosubs)
    for (const player of starting) {
        const autosubbed = autosubs.find(a => a.out === player.playerId);
        if (autosubbed) {
            const subPlayer = bench.find(b => b.playerId === autosubbed.in);
            if (subPlayer) {
                totalPoints += subPlayer.points * (player.isCaptain ? player.multiplier : 1);
            }
        } else {
            totalPoints += player.points * (player.isCaptain ? player.multiplier : 1);
        }
    }

    return { totalPoints, autosubs };
}

/**
 * Calculate player price change based on transfers
 */
export function calculatePriceChange(
    currentPrice: number,
    transfersIn: number,
    transfersOut: number,
    selectedBy: number
): number {
    const netTransfers = transfersIn - transfersOut;
    const threshold = Math.max(100, selectedBy * 0.01); // 1% of ownership or minimum 100

    if (netTransfers >= threshold) {
        // Price increase by £0.1m
        return Math.round((currentPrice + 0.1) * 10) / 10;
    } else if (netTransfers <= -threshold) {
        // Price decrease by £0.1m
        return Math.max(4.0, Math.round((currentPrice - 0.1) * 10) / 10);
    }

    return currentPrice;
}

/**
 * Calculate player form (average points over last 5 games)
 */
export function calculateForm(recentPoints: number[]): number {
    if (recentPoints.length === 0) return 0;
    const sum = recentPoints.reduce((a, b) => a + b, 0);
    return Math.round((sum / recentPoints.length) * 10) / 10;
}

/**
 * Calculate ICT Index (Influence, Creativity, Threat)
 */
export function calculateICTIndex(influence: number, creativity: number, threat: number): number {
    return Math.round((influence + creativity + threat) * 10) / 10;
}

/**
 * Validate team formation
 */
export function validateFormation(
    players: { position: 'GK' | 'DEF' | 'MID' | 'FWD' }[]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const gk = players.filter(p => p.position === 'GK').length;
    const def = players.filter(p => p.position === 'DEF').length;
    const mid = players.filter(p => p.position === 'MID').length;
    const fwd = players.filter(p => p.position === 'FWD').length;

    // Squad must have exactly 15 players
    if (players.length !== 15) {
        errors.push(`Squad must have 15 players (currently ${players.length})`);
    }

    // Must have 2 GK
    if (gk !== 2) {
        errors.push(`Must have 2 goalkeepers (currently ${gk})`);
    }

    // Must have 5 DEF
    if (def !== 5) {
        errors.push(`Must have 5 defenders (currently ${def})`);
    }

    // Must have 5 MID
    if (mid !== 5) {
        errors.push(`Must have 5 midfielders (currently ${mid})`);
    }

    // Must have 3 FWD
    if (fwd !== 3) {
        errors.push(`Must have 3 forwards (currently ${fwd})`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate starting XI formation
 */
export function validateStartingXI(
    players: { position: 'GK' | 'DEF' | 'MID' | 'FWD' }[]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const gk = players.filter(p => p.position === 'GK').length;
    const def = players.filter(p => p.position === 'DEF').length;
    const mid = players.filter(p => p.position === 'MID').length;
    const fwd = players.filter(p => p.position === 'FWD').length;

    // Must have exactly 11 players
    if (players.length !== 11) {
        errors.push(`Starting XI must have 11 players (currently ${players.length})`);
    }

    // Must have 1 GK
    if (gk !== 1) {
        errors.push(`Must have 1 goalkeeper (currently ${gk})`);
    }

    // Must have at least 3 DEF
    if (def < 3) {
        errors.push(`Must have at least 3 defenders (currently ${def})`);
    }

    // Must have at least 2 MID
    if (mid < 2) {
        errors.push(`Must have at least 2 midfielders (currently ${mid})`);
    }

    // Must have at least 1 FWD
    if (fwd < 1) {
        errors.push(`Must have at least 1 forward (currently ${fwd})`);
    }

    return { valid: errors.length === 0, errors };
}
