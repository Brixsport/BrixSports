// Core type definitions for the application

export type SportType = 'Football' | 'Basketball' | 'Volleyball' | 'Track' | 'Table Tennis' | 'Badminton';

export interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    color: string;
    sport?: SportType;
    college?: string;
    stats?: {
        played: number;
        won: number;
        drawn: number;
        lost: number;
        goalsFor: number;
        goalsAgainst: number;
        goalDifference: number;
        points: number;
    };
}

export interface Player {
    id: string;
    name: string;
    number: number;
    position: string;
    teamId: string;
    sport?: SportType;
    avatar?: string;
    stats?: {
        appearances: number;
        goals?: number;
        assists?: number;
        points?: number;
        rebounds?: number;
        steals?: number;
        blocks?: number;
        rating?: number;
    };
    jerseyName?: string;
    college?: string;
    department?: string;
    memberships?: Array<{ affiliation?: { isPrimary?: boolean }; team?: { id: string; name: string } | null }>;
}

export type MatchStatus = 'UPCOMING' | 'LIVE' | 'FINISHED';

export interface Match {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    // BACKLOG-105: undefined means "no shootout," never "0-0 so far."
    shootoutHomeScore?: number;
    shootoutAwayScore?: number;
    status: MatchStatus;
    startTime: string;
    venue: string;
    competition: string;
    round?: string | null;
    sport: SportType;
    matchType?: string;
    homeTeam?: Team;
    awayTeam?: Team;
    events: MatchEvent[];
    stats?: MatchStats;
    lineups?: {
        home: LineupEntry[];
        away: LineupEntry[];
    };
    currentPeriod?: string | null;
    isStreaming?: boolean;
    streamUrl?: string;
    streamType?: 'youtube' | 'twitch' | 'facebook' | 'hls' | 'dash' | 'custom';
}

export interface MatchEvent {
    id: string;
    matchId: string;
    type: 'Goal' | 'Yellow Card' | 'Red Card' | 'Substitution' | 'Eye Point' | 'Assist' | 'Foul';
    minute: number;
    teamId: string;
    playerId?: string;
    detail: string;
    isEyePoint?: boolean;
}

export interface MatchStats {
    possession?: [number, number];
    shots?: [number, number];
    shotsOnTarget?: [number, number];
    corners?: [number, number];
    fouls?: [number, number];
    yellowCards?: [number, number];
    redCards?: [number, number];
    // Football-specific stats
    expectedGoals?: [number, number]; // xG for home and away
    winProbability?: [number, number, number]; // [home%, draw%, away%]
    // Basketball-specific stats
    fieldGoalPercentage?: [number, number];
    threePointPercentage?: [number, number];
    freeThrowPercentage?: [number, number];
    [key: string]: any; // Allow additional stats
}

export interface LineupEntry {
    playerId: string;
    rating: number;
    position?: string;
    isStarter?: boolean;
    isCaptain?: boolean;
    isMotM?: boolean; // Man of the Match - highest rated player
}
