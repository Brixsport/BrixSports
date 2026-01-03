/**
 * Competition Templates
 * Predefined templates for common competition formats
 */

export interface CompetitionTemplate {
    id: string;
    name: string;
    description: string;
    sport: string;
    format: 'league' | 'knockout' | 'group_knockout';
    numberOfTeams: number;
    numberOfGroups?: number;
    teamsPerGroup?: number;
    level: string;
    scope: 'internal' | 'external';
    rules: any;
}

export const COMPETITION_TEMPLATES: CompetitionTemplate[] = [
    // Football Templates
    {
        id: 'football-league-8',
        name: 'Football League (8 Teams)',
        description: 'Standard league format with 8 teams playing home and away',
        sport: 'Football',
        format: 'league',
        numberOfTeams: 8,
        level: 'inter-university',
        scope: 'internal',
        rules: {
            matchDuration: 90,
            pointsForWin: 3,
            pointsForDraw: 1,
            pointsForLoss: 0,
            homeAndAway: true,
            totalRounds: 14,
        },
    },
    {
        id: 'football-knockout-16',
        name: 'Football Knockout Cup (16 Teams)',
        description: 'Single elimination knockout tournament',
        sport: 'Football',
        format: 'knockout',
        numberOfTeams: 16,
        level: 'inter-university',
        scope: 'internal',
        rules: {
            matchDuration: 90,
            extraTime: true,
            penalties: true,
            rounds: ['Round of 16', 'Quarter Finals', 'Semi Finals', 'Final'],
        },
    },
    {
        id: 'football-group-knockout-16',
        name: 'Football Group Stage + Knockout (16 Teams)',
        description: 'Group stage followed by knockout rounds (Champions League style)',
        sport: 'Football',
        format: 'group_knockout',
        numberOfTeams: 16,
        numberOfGroups: 4,
        teamsPerGroup: 4,
        level: 'inter-university',
        scope: 'internal',
        rules: {
            matchDuration: 90,
            groupStage: {
                pointsForWin: 3,
                pointsForDraw: 1,
                pointsForLoss: 0,
                teamsToAdvance: 2,
            },
            knockout: {
                extraTime: true,
                penalties: true,
                rounds: ['Quarter Finals', 'Semi Finals', 'Final'],
            },
        },
    },

    // Basketball Templates
    {
        id: 'basketball-league-6',
        name: 'Basketball League (6 Teams)',
        description: 'Round-robin basketball league',
        sport: 'Basketball',
        format: 'league',
        numberOfTeams: 6,
        level: 'inter-university',
        scope: 'internal',
        rules: {
            matchDuration: 40,
            quarters: 4,
            quarterDuration: 10,
            pointsForWin: 2,
            pointsForLoss: 0,
            overtime: true,
            overtimeDuration: 5,
        },
    },
    {
        id: 'basketball-knockout-8',
        name: 'Basketball Knockout (8 Teams)',
        description: 'Single elimination basketball tournament',
        sport: 'Basketball',
        format: 'knockout',
        numberOfTeams: 8,
        level: 'inter-university',
        scope: 'internal',
        rules: {
            matchDuration: 40,
            quarters: 4,
            quarterDuration: 10,
            overtime: true,
            overtimeDuration: 5,
            rounds: ['Quarter Finals', 'Semi Finals', 'Final'],
        },
    },
    {
        id: 'basketball-group-knockout-12',
        name: 'Basketball Group + Playoffs (12 Teams)',
        description: 'Group stage followed by playoff bracket',
        sport: 'Basketball',
        format: 'group_knockout',
        numberOfTeams: 12,
        numberOfGroups: 3,
        teamsPerGroup: 4,
        level: 'inter-university',
        scope: 'internal',
        rules: {
            matchDuration: 40,
            quarters: 4,
            quarterDuration: 10,
            groupStage: {
                pointsForWin: 2,
                pointsForLoss: 0,
                teamsToAdvance: 2,
            },
            playoffs: {
                overtime: true,
                overtimeDuration: 5,
                rounds: ['Quarter Finals', 'Semi Finals', 'Final'],
            },
        },
    },

    // BUSA League Templates
    {
        id: 'busa-football-league',
        name: 'BUSA Football League',
        description: 'British Universities & Colleges Sport Football League',
        sport: 'Football',
        format: 'league',
        numberOfTeams: 10,
        level: 'busa-league',
        scope: 'external',
        rules: {
            matchDuration: 90,
            pointsForWin: 3,
            pointsForDraw: 1,
            pointsForLoss: 0,
            homeAndAway: true,
            totalRounds: 18,
        },
    },
    {
        id: 'busa-basketball-league',
        name: 'BUSA Basketball League',
        description: 'British Universities & Colleges Sport Basketball League',
        sport: 'Basketball',
        format: 'league',
        numberOfTeams: 8,
        level: 'busa-league',
        scope: 'external',
        rules: {
            matchDuration: 40,
            quarters: 4,
            quarterDuration: 10,
            pointsForWin: 2,
            pointsForLoss: 0,
            overtime: true,
            overtimeDuration: 5,
        },
    },

    // College/Department Level
    {
        id: 'college-football-cup',
        name: 'Inter-College Football Cup',
        description: 'Knockout tournament between college teams',
        sport: 'Football',
        format: 'knockout',
        numberOfTeams: 8,
        level: 'college',
        scope: 'internal',
        rules: {
            matchDuration: 70,
            extraTime: false,
            penalties: true,
            rounds: ['Quarter Finals', 'Semi Finals', 'Final'],
        },
    },
    {
        id: 'department-basketball-league',
        name: 'Inter-Department Basketball League',
        description: 'League competition between department teams',
        sport: 'Basketball',
        format: 'league',
        numberOfTeams: 6,
        level: 'department',
        scope: 'internal',
        rules: {
            matchDuration: 32,
            quarters: 4,
            quarterDuration: 8,
            pointsForWin: 2,
            pointsForLoss: 0,
            overtime: true,
            overtimeDuration: 4,
        },
    },

    // Year Level
    {
        id: 'freshers-football-tournament',
        name: 'Freshers Football Tournament',
        description: 'Tournament for first-year students',
        sport: 'Football',
        format: 'group_knockout',
        numberOfTeams: 12,
        numberOfGroups: 3,
        teamsPerGroup: 4,
        level: 'year-level',
        scope: 'internal',
        rules: {
            matchDuration: 60,
            groupStage: {
                pointsForWin: 3,
                pointsForDraw: 1,
                pointsForLoss: 0,
                teamsToAdvance: 1,
            },
            knockout: {
                extraTime: false,
                penalties: true,
                rounds: ['Semi Finals', 'Final'],
            },
        },
    },
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): CompetitionTemplate | undefined {
    return COMPETITION_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by sport
 */
export function getTemplatesBySport(sport: string): CompetitionTemplate[] {
    return COMPETITION_TEMPLATES.filter(t => t.sport === sport);
}

/**
 * Get templates by format
 */
export function getTemplatesByFormat(format: string): CompetitionTemplate[] {
    return COMPETITION_TEMPLATES.filter(t => t.format === format);
}

/**
 * Get templates by level
 */
export function getTemplatesByLevel(level: string): CompetitionTemplate[] {
    return COMPETITION_TEMPLATES.filter(t => t.level === level);
}
