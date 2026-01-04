export interface FormationTactics {
    name: string;
    description: string;
    strengths: string[];
    weaknesses: string[];
    playStyle: string;
    bestFor: string[];
    difficulty: 'Easy' | 'Medium' | 'Hard';
    offensiveRating: number;
    defensiveRating: number;
    balanceRating: number;
}

export const FORMATION_TACTICS: Record<string, FormationTactics> = {
    '4-3-3': {
        name: '4-3-3',
        description: 'A balanced formation with width in attack and solid defensive structure. Three forwards provide attacking threat while the midfield trio offers control.',
        strengths: [
            'Width in attack with wingers',
            'Strong midfield presence',
            'Good defensive balance',
            'Flexible transitions',
        ],
        weaknesses: [
            'Can be outnumbered in midfield vs 4-4-2',
            'Wingers need to track back',
            'Requires high work rate from wide players',
        ],
        playStyle: 'Possession-based with quick transitions',
        bestFor: [
            'Teams with fast wingers',
            'Possession-oriented play',
            'Counter-attacking football',
        ],
        difficulty: 'Medium',
        offensiveRating: 8,
        defensiveRating: 7,
        balanceRating: 9,
    },
    '4-4-2': {
        name: '4-4-2',
        description: 'The classic formation offering balance and simplicity. Two strikers work in partnership while the midfield four provides width and support.',
        strengths: [
            'Simple and effective structure',
            'Strong in wide areas',
            'Good defensive shape',
            'Two strikers for goal threat',
        ],
        weaknesses: [
            'Can be overrun in central midfield',
            'Less control in possession',
            'Gaps between midfield and attack',
        ],
        playStyle: 'Direct and physical',
        bestFor: [
            'Traditional English football',
            'Teams with strong striker partnerships',
            'Counter-attacking setups',
        ],
        difficulty: 'Easy',
        offensiveRating: 7,
        defensiveRating: 8,
        balanceRating: 8,
    },
    '3-5-2': {
        name: '3-5-2',
        description: 'An attacking formation with wing-backs providing width. Three center-backs offer defensive solidity while the midfield five dominates the center.',
        strengths: [
            'Dominates midfield',
            'Wing-backs provide width',
            'Solid defensive base',
            'Overloads central areas',
        ],
        weaknesses: [
            'Vulnerable to wide attacks',
            'Requires fit wing-backs',
            'Can be exposed on counter-attacks',
        ],
        playStyle: 'Possession-heavy with wing play',
        bestFor: [
            'Teams with strong wing-backs',
            'Possession-dominant sides',
            'Teams facing narrow formations',
        ],
        difficulty: 'Hard',
        offensiveRating: 7,
        defensiveRating: 7,
        balanceRating: 7,
    },
    '4-2-3-1': {
        name: '4-2-3-1',
        description: 'A modern formation with two defensive midfielders protecting the back four, and an attacking trio supporting a lone striker.',
        strengths: [
            'Strong defensive midfield shield',
            'Creative attacking midfield',
            'Flexible attacking options',
            'Good defensive balance',
        ],
        weaknesses: [
            'Lone striker can be isolated',
            'Requires versatile attacking midfielders',
            'Can lack width',
        ],
        playStyle: 'Controlled possession with creative freedom',
        bestFor: [
            'Teams with a strong number 10',
            'Possession-based football',
            'Teams needing defensive stability',
        ],
        difficulty: 'Medium',
        offensiveRating: 8,
        defensiveRating: 8,
        balanceRating: 9,
    },
    '3-4-3': {
        name: '3-4-3',
        description: 'An aggressive formation with three forwards and wing-backs providing width. Requires high fitness levels and tactical discipline.',
        strengths: [
            'Maximum attacking threat',
            'Overloads opposition defense',
            'Wing-backs create overloads',
            'High pressing capability',
        ],
        weaknesses: [
            'Vulnerable to counter-attacks',
            'Requires exceptional fitness',
            'Can be exposed in wide areas',
        ],
        playStyle: 'High-pressing, attacking football',
        bestFor: [
            'Dominant teams',
            'High-pressing systems',
            'Teams with athletic wing-backs',
        ],
        difficulty: 'Hard',
        offensiveRating: 9,
        defensiveRating: 6,
        balanceRating: 6,
    },
    '4-2-2-2': {
        name: '4-2-2-2',
        description: 'A box midfield formation that uses two defensive midfielders and two attacking midfielders to control the center of the pitch.',
        strengths: [
            'Dominates central areas',
            'Strong defensive screen',
            'Good support for strikers',
            'Compact shape',
        ],
        weaknesses: [
            'Lack of natural width',
            'Relies heavily on full-backs',
            'Can become congested vertically',
        ],
        playStyle: 'Narrow, quick passing through the middle',
        bestFor: [
            'Teams with athletic full-backs',
            'Sides with strong technical midfielders',
            'Teams who want to control the center',
        ],
        difficulty: 'Hard',
        offensiveRating: 7,
        defensiveRating: 8,
        balanceRating: 7,
    },
    '3-5-2-dp': {
        name: '3-5-2 (Double Pivot)',
        description: 'A defensive variation of the 3-5-2 with two holding midfielders to provide maximum protection for the back three.',
        strengths: [
            'Exceptional defensive solidity',
            'Difficult to break down',
            'Good for counter-attacking',
            'Protects the back three',
        ],
        weaknesses: [
            'Can lack creativity',
            'Large gap between midfield and attack',
            'Isolated strikers',
        ],
        playStyle: 'Defensive, counter-attacking',
        bestFor: [
            'Underdogs or defensive teams',
            'Protecting a lead',
            'Teams with limited creative midfielders',
        ],
        difficulty: 'Medium',
        offensiveRating: 6,
        defensiveRating: 9,
        balanceRating: 7,
    },
};

export function getFormationTactics(formation: string): FormationTactics | null {
    return FORMATION_TACTICS[formation] || null;
}

export function compareFormations(formation1: string, formation2: string): {
    formation1: FormationTactics;
    formation2: FormationTactics;
    comparison: {
        offensive: string;
        defensive: string;
        balance: string;
    };
} | null {
    const tactics1 = FORMATION_TACTICS[formation1];
    const tactics2 = FORMATION_TACTICS[formation2];

    if (!tactics1 || !tactics2) return null;

    return {
        formation1: tactics1,
        formation2: tactics2,
        comparison: {
            offensive:
                tactics1.offensiveRating > tactics2.offensiveRating
                    ? formation1
                    : tactics1.offensiveRating < tactics2.offensiveRating
                        ? formation2
                        : 'Equal',
            defensive:
                tactics1.defensiveRating > tactics2.defensiveRating
                    ? formation1
                    : tactics1.defensiveRating < tactics2.defensiveRating
                        ? formation2
                        : 'Equal',
            balance:
                tactics1.balanceRating > tactics2.balanceRating
                    ? formation1
                    : tactics1.balanceRating < tactics2.balanceRating
                        ? formation2
                        : 'Equal',
        },
    };
}
