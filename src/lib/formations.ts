// Formation definitions for different sports

export interface FormationPosition {
    id: string;
    position: string;
    x: number; // 0-100 (percentage of pitch width)
    y: number; // 0-100 (percentage of pitch height)
    zone: 'GK' | 'DEF' | 'MID' | 'FWD' | 'GUARD' | 'FORWARD' | 'CENTER';
}

export interface Formation {
    id: string;
    name: string;
    sport: 'Football' | 'Basketball';
    positions: FormationPosition[];
    description: string;
}

// Football Formations
export const footballFormations: Formation[] = [
    {
        id: '4-3-3',
        name: '4-3-3',
        sport: 'Football',
        description: 'Balanced formation with strong wings',
        positions: [
            // Goalkeeper
            { id: 'gk', position: 'GK', x: 50, y: 95, zone: 'GK' },
            // Defenders
            { id: 'lb', position: 'LB', x: 20, y: 75, zone: 'DEF' },
            { id: 'lcb', position: 'CB', x: 40, y: 80, zone: 'DEF' },
            { id: 'rcb', position: 'CB', x: 60, y: 80, zone: 'DEF' },
            { id: 'rb', position: 'RB', x: 80, y: 75, zone: 'DEF' },
            // Midfielders
            { id: 'cdm', position: 'CDM', x: 50, y: 60, zone: 'MID' },
            { id: 'lcm', position: 'CM', x: 35, y: 50, zone: 'MID' },
            { id: 'rcm', position: 'CM', x: 65, y: 50, zone: 'MID' },
            // Forwards
            { id: 'lw', position: 'LW', x: 20, y: 25, zone: 'FWD' },
            { id: 'st', position: 'ST', x: 50, y: 15, zone: 'FWD' },
            { id: 'rw', position: 'RW', x: 80, y: 25, zone: 'FWD' },
        ]
    },
    {
        id: '4-4-2',
        name: '4-4-2',
        sport: 'Football',
        description: 'Classic balanced formation',
        positions: [
            // Goalkeeper
            { id: 'gk', position: 'GK', x: 50, y: 95, zone: 'GK' },
            // Defenders
            { id: 'lb', position: 'LB', x: 20, y: 75, zone: 'DEF' },
            { id: 'lcb', position: 'CB', x: 40, y: 80, zone: 'DEF' },
            { id: 'rcb', position: 'CB', x: 60, y: 80, zone: 'DEF' },
            { id: 'rb', position: 'RB', x: 80, y: 75, zone: 'DEF' },
            // Midfielders
            { id: 'lm', position: 'LM', x: 20, y: 50, zone: 'MID' },
            { id: 'lcm', position: 'CM', x: 40, y: 55, zone: 'MID' },
            { id: 'rcm', position: 'CM', x: 60, y: 55, zone: 'MID' },
            { id: 'rm', position: 'RM', x: 80, y: 50, zone: 'MID' },
            // Forwards
            { id: 'lst', position: 'ST', x: 40, y: 20, zone: 'FWD' },
            { id: 'rst', position: 'ST', x: 60, y: 20, zone: 'FWD' },
        ]
    },
    {
        id: '3-5-2',
        name: '3-5-2',
        sport: 'Football',
        description: 'Attacking formation with wing-backs',
        positions: [
            // Goalkeeper
            { id: 'gk', position: 'GK', x: 50, y: 95, zone: 'GK' },
            // Defenders
            { id: 'lcb', position: 'CB', x: 30, y: 80, zone: 'DEF' },
            { id: 'cb', position: 'CB', x: 50, y: 82, zone: 'DEF' },
            { id: 'rcb', position: 'CB', x: 70, y: 80, zone: 'DEF' },
            // Midfielders
            { id: 'lwb', position: 'LWB', x: 15, y: 60, zone: 'MID' },
            { id: 'lcm', position: 'CM', x: 35, y: 55, zone: 'MID' },
            { id: 'cm', position: 'CM', x: 50, y: 50, zone: 'MID' },
            { id: 'rcm', position: 'CM', x: 65, y: 55, zone: 'MID' },
            { id: 'rwb', position: 'RWB', x: 85, y: 60, zone: 'MID' },
            // Forwards
            { id: 'lst', position: 'ST', x: 40, y: 20, zone: 'FWD' },
            { id: 'rst', position: 'ST', x: 60, y: 20, zone: 'FWD' },
        ]
    },
    {
        id: '4-2-3-1',
        name: '4-2-3-1',
        sport: 'Football',
        description: 'Modern attacking formation',
        positions: [
            // Goalkeeper
            { id: 'gk', position: 'GK', x: 50, y: 95, zone: 'GK' },
            // Defenders
            { id: 'lb', position: 'LB', x: 20, y: 75, zone: 'DEF' },
            { id: 'lcb', position: 'CB', x: 40, y: 80, zone: 'DEF' },
            { id: 'rcb', position: 'CB', x: 60, y: 80, zone: 'DEF' },
            { id: 'rb', position: 'RB', x: 80, y: 75, zone: 'DEF' },
            // Defensive Midfielders
            { id: 'lcdm', position: 'CDM', x: 40, y: 60, zone: 'MID' },
            { id: 'rcdm', position: 'CDM', x: 60, y: 60, zone: 'MID' },
            // Attacking Midfielders
            { id: 'lam', position: 'LAM', x: 25, y: 35, zone: 'MID' },
            { id: 'cam', position: 'CAM', x: 50, y: 40, zone: 'MID' },
            { id: 'ram', position: 'RAM', x: 75, y: 35, zone: 'MID' },
            // Forward
            { id: 'st', position: 'ST', x: 50, y: 15, zone: 'FWD' },
        ]
    }
];

// Basketball Formations
export const basketballFormations: Formation[] = [
    {
        id: '1-2-2',
        name: '1-2-2 (Standard)',
        sport: 'Basketball',
        description: 'Traditional basketball lineup',
        positions: [
            { id: 'pg', position: 'PG', x: 50, y: 80, zone: 'GUARD' },
            { id: 'sg', position: 'SG', x: 75, y: 60, zone: 'GUARD' },
            { id: 'sf', position: 'SF', x: 25, y: 60, zone: 'FORWARD' },
            { id: 'pf', position: 'PF', x: 70, y: 30, zone: 'FORWARD' },
            { id: 'c', position: 'C', x: 30, y: 30, zone: 'CENTER' },
        ]
    },
    {
        id: '2-3',
        name: '2-3 (Big Lineup)',
        sport: 'Basketball',
        description: 'Two guards, three big men',
        positions: [
            { id: 'pg', position: 'PG', x: 40, y: 80, zone: 'GUARD' },
            { id: 'sg', position: 'SG', x: 60, y: 80, zone: 'GUARD' },
            { id: 'sf', position: 'SF', x: 25, y: 50, zone: 'FORWARD' },
            { id: 'pf', position: 'PF', x: 75, y: 50, zone: 'FORWARD' },
            { id: 'c', position: 'C', x: 50, y: 25, zone: 'CENTER' },
        ]
    }
];

export const getFormationsBySport = (sport: 'Football' | 'Basketball'): Formation[] => {
    return sport === 'Football' ? footballFormations : basketballFormations;
};

export const getFormationById = (formationId: string, sport: 'Football' | 'Basketball'): Formation | undefined => {
    const formations = getFormationsBySport(sport);
    return formations.find(f => f.id === formationId);
};
