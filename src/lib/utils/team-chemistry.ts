interface Player {
    id: string;
    name: string;
    position: string;
    team: string;
    league?: string;
    nationality?: string;
    rating: number;
}

interface ChemistryFactors {
    sameTeam: number;
    sameLeague: number;
    sameNationality: number;
    positionMatch: number;
}

export interface ChemistryResult {
    overall: number;
    breakdown: {
        teamLinks: number;
        leagueLinks: number;
        nationalityLinks: number;
        positionBonus: number;
    };
    rating: 'Poor' | 'Average' | 'Good' | 'Excellent' | 'Perfect';
    color: string;
}

const CHEMISTRY_WEIGHTS: ChemistryFactors = {
    sameTeam: 3,
    sameLeague: 2,
    sameNationality: 1.5,
    positionMatch: 2,
};

const POSITION_GROUPS: Record<string, string[]> = {
    GK: ['GK'],
    DEF: ['LB', 'CB', 'RB', 'LWB', 'RWB'],
    MID: ['LM', 'CM', 'RM', 'CDM', 'CAM'],
    FWD: ['LW', 'ST', 'RW', 'CF'],
};

export function calculateTeamChemistry(players: (Player | null)[]): ChemistryResult {
    const validPlayers = players.filter((p): p is Player => p !== null);

    if (validPlayers.length === 0) {
        return {
            overall: 0,
            breakdown: { teamLinks: 0, leagueLinks: 0, nationalityLinks: 0, positionBonus: 0 },
            rating: 'Poor',
            color: 'text-red-400',
        };
    }

    let teamLinks = 0;
    let leagueLinks = 0;
    let nationalityLinks = 0;
    let positionBonus = 0;

    // Calculate links between adjacent players
    for (let i = 0; i < validPlayers.length; i++) {
        for (let j = i + 1; j < validPlayers.length; j++) {
            const player1 = validPlayers[i];
            const player2 = validPlayers[j];

            // Same team bonus
            if (player1.team === player2.team) {
                teamLinks += CHEMISTRY_WEIGHTS.sameTeam;
            }

            // Same league bonus
            if (player1.league && player2.league && player1.league === player2.league) {
                leagueLinks += CHEMISTRY_WEIGHTS.sameLeague;
            }

            // Same nationality bonus
            if (player1.nationality && player2.nationality && player1.nationality === player2.nationality) {
                nationalityLinks += CHEMISTRY_WEIGHTS.sameNationality;
            }
        }
    }

    // Position match bonus
    validPlayers.forEach((player) => {
        const playerGroup = Object.keys(POSITION_GROUPS).find((group) =>
            POSITION_GROUPS[group].includes(player.position)
        );
        if (playerGroup) {
            positionBonus += CHEMISTRY_WEIGHTS.positionMatch;
        }
    });

    // Calculate overall chemistry (0-100)
    const maxPossibleLinks = (validPlayers.length * (validPlayers.length - 1)) / 2;
    const totalLinks = teamLinks + leagueLinks + nationalityLinks + positionBonus;
    const maxPossibleChemistry = maxPossibleLinks * (CHEMISTRY_WEIGHTS.sameTeam + CHEMISTRY_WEIGHTS.sameLeague + CHEMISTRY_WEIGHTS.sameNationality) + (validPlayers.length * CHEMISTRY_WEIGHTS.positionMatch);

    const overall = Math.min(100, Math.round((totalLinks / maxPossibleChemistry) * 100));

    // Determine rating
    let rating: ChemistryResult['rating'];
    let color: string;

    if (overall >= 90) {
        rating = 'Perfect';
        color = 'text-purple-400';
    } else if (overall >= 75) {
        rating = 'Excellent';
        color = 'text-blue-400';
    } else if (overall >= 60) {
        rating = 'Good';
        color = 'text-cyan-400';
    } else if (overall >= 40) {
        rating = 'Average';
        color = 'text-yellow-400';
    } else {
        rating = 'Poor';
        color = 'text-red-400';
    }

    return {
        overall,
        breakdown: {
            teamLinks: Math.round(teamLinks),
            leagueLinks: Math.round(leagueLinks),
            nationalityLinks: Math.round(nationalityLinks),
            positionBonus: Math.round(positionBonus),
        },
        rating,
        color,
    };
}

export function getPlayerChemistry(player: Player, adjacentPlayers: Player[]): number {
    let chemistry = 0;

    adjacentPlayers.forEach((adjacent) => {
        if (player.team === adjacent.team) chemistry += CHEMISTRY_WEIGHTS.sameTeam;
        if (player.league && adjacent.league && player.league === adjacent.league) chemistry += CHEMISTRY_WEIGHTS.sameLeague;
        if (player.nationality && adjacent.nationality && player.nationality === adjacent.nationality) chemistry += CHEMISTRY_WEIGHTS.sameNationality;
    });

    // Position match bonus
    const playerGroup = Object.keys(POSITION_GROUPS).find((group) =>
        POSITION_GROUPS[group].includes(player.position)
    );
    if (playerGroup) chemistry += CHEMISTRY_WEIGHTS.positionMatch;

    return Math.min(10, Math.round(chemistry / 2));
}

