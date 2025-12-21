export type SportType = 'Football' | 'Basketball' | 'Volleyball' | 'Track';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  university: string;
  color: string;
  stats?: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    pts: number;
  };
}

export interface Player {
  id: string;
  name: string;
  number: number;
  teamId: string;
  position: string;
  rating: number;
  eyePoints: number;
  age?: number;
  height?: string;
  weight?: string;
  nationality?: string;
  image?: string;
  marketValue?: string;
  attributes?: {
    speed: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defense: number;
    physical: number;
  };
}

export interface MatchEvent {
  id: string;
  type: 'Goal' | 'Yellow Card' | 'Red Card' | 'Substitution' | 'Eye Point' | 'Period Start' | 'Period End' | 'Corner' | 'Free Kick' | 'Penalty' | 'Save' | 'Foul' | 'Shot' | 'Possession Change';
  minute: number;
  teamId?: string;
  playerId?: string;
  relatedPlayerId?: string; // e.g., for substitution: outgoing player
  detail?: string;
  isEyePoint?: boolean;
  value?: any; // For measurements, etc.
}

export interface Logger {
  id: string;
  name: string;
  assignedMatches: string[];
}

export interface MatchStats {
  possession: [number, number]; // [home, away]
  shots: [number, number];
  shotsOnTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
  yellowCards: [number, number];
  redCards: [number, number];
  saves?: [number, number];
}

export interface Match {
  id: string;
  sport: SportType;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  status: 'LIVE' | 'FINISHED' | 'UPCOMING' | 'HALF_TIME';
  startTime: string;
  venue: string;
  competition: string;
  events: MatchEvent[];
  stats: MatchStats;
  lineups?: {
    home: { playerId: string; rating: number; position: string; status: 'playing' | 'bench' }[];
    away: { playerId: string; rating: number; position: string; status: 'playing' | 'bench' }[];
  };
  loggerId?: string;
}

export const LOGGERS: Logger[] = [
  { id: 'l1', name: 'John Logger', assignedMatches: ['m1', 'm2'] }
];

export const TEAMS: Team[] = [
  {
    id: 'unilag',
    name: 'UNILAG Marines',
    shortName: 'LAG',
    logo: '🌊',
    university: 'University of Lagos',
    color: '#003366',
    stats: { played: 5, won: 4, drawn: 1, lost: 0, gf: 12, ga: 3, pts: 13 }
  },
  {
    id: 'uniben',
    name: 'UNIBEN Royals',
    shortName: 'BEN',
    logo: '🦁',
    university: 'University of Benin',
    color: '#990000',
    stats: { played: 5, won: 3, drawn: 1, lost: 1, gf: 8, ga: 5, pts: 10 }
  },
  {
    id: 'ui',
    name: 'UI Pioneers',
    shortName: 'UI',
    logo: '🎓',
    university: 'University of Ibadan',
    color: '#FFD700',
    stats: { played: 5, won: 2, drawn: 2, lost: 1, gf: 6, ga: 6, pts: 8 }
  },
  {
    id: 'oau',
    name: 'OAU Ife Giants',
    shortName: 'OAU',
    logo: '🐘',
    university: 'Obafemi Awolowo University',
    color: '#000080',
    stats: { played: 5, won: 1, drawn: 2, lost: 2, gf: 4, ga: 7, pts: 5 }
  }
];

export const PLAYERS: Player[] = [
  { 
    id: 'p1', 
    name: 'Tunde Adeyemi', 
    number: 10, 
    teamId: 'unilag', 
    position: 'ST', 
    rating: 8.5, 
    eyePoints: 12,
    age: 21,
    height: '185cm',
    nationality: 'Nigeria',
    attributes: { speed: 88, shooting: 92, passing: 78, dribbling: 85, defense: 45, physical: 80 }
  },
  { 
    id: 'p2', 
    name: 'Emeka Obi', 
    number: 7, 
    teamId: 'uniben', 
    position: 'CM', 
    rating: 7.8, 
    eyePoints: 8,
    age: 22,
    attributes: { speed: 75, shooting: 70, passing: 88, dribbling: 82, defense: 72, physical: 75 }
  },
  { 
    id: 'p3', 
    name: 'Segun Bello', 
    number: 9, 
    teamId: 'unilag', 
    position: 'LW', 
    rating: 8.2, 
    eyePoints: 15,
    age: 20,
    attributes: { speed: 94, shooting: 80, passing: 75, dribbling: 90, defense: 30, physical: 65 }
  },
  {
    id: 'p4',
    name: 'Chisom Oke',
    number: 4,
    teamId: 'unilag',
    position: 'CB',
    rating: 7.5,
    eyePoints: 3,
    age: 23,
    attributes: { speed: 70, shooting: 40, passing: 65, dribbling: 50, defense: 92, physical: 95 }
  }
];

export const MATCHES: Match[] = [
  {
    id: 'm1',
    sport: 'Football',
    homeTeamId: 'unilag',
    awayTeamId: 'uniben',
    homeScore: 2,
    awayScore: 1,
    status: 'LIVE',
    startTime: '2024-03-20T16:00:00Z',
    venue: 'UNILAG Sports Center',
    competition: 'NUGA Games 2024',
    stats: {
      possession: [58, 42],
      shots: [12, 7],
      shotsOnTarget: [5, 3],
      corners: [6, 2],
      fouls: [8, 11],
      yellowCards: [1, 2],
      redCards: [0, 0]
    },
    lineups: {
      home: [
        { playerId: 'p1', rating: 8.5, position: 'ST', status: 'playing' },
        { playerId: 'p3', rating: 7.9, position: 'LW', status: 'playing' },
        { playerId: 'p4', rating: 7.2, position: 'CB', status: 'playing' }
      ],
      away: [
        { playerId: 'p2', rating: 7.8, position: 'CM', status: 'playing' }
      ]
    },
    loggerId: 'l1',
    events: [
      { id: 'e1', type: 'Goal', minute: 15, teamId: 'unilag', playerId: 'p1', detail: 'Tunde Adeyemi' },
      { id: 'e2', type: 'Goal', minute: 42, teamId: 'uniben', playerId: 'p2', detail: 'Emeka Obi' },
      { id: 'e3', type: 'Substitution', minute: 60, teamId: 'uniben', playerId: 'p2', relatedPlayerId: 'p5', detail: 'Tactical change' },
      { id: 'e4', type: 'Goal', minute: 68, teamId: 'unilag', playerId: 'p3', detail: 'Segun Bello' },
      { id: 'e5', type: 'Eye Point', minute: 75, teamId: 'unilag', playerId: 'p1', detail: 'Exceptional Hustle', isEyePoint: true },
    ],
  },
  {
    id: 'm2',
    sport: 'Track',
    homeTeamId: 'unilag',
    awayTeamId: 'ui',
    homeScore: 0,
    awayScore: 0,
    status: 'UPCOMING',
    startTime: '2024-03-21T10:00:00Z',
    venue: 'UNILAG Track',
    competition: 'NUGA Track Finals',
    stats: {
      possession: [0, 0],
      shots: [0, 0],
      shotsOnTarget: [0, 0],
      corners: [0, 0],
      fouls: [0, 0],
      yellowCards: [0, 0],
      redCards: [0, 0]
    },
    loggerId: 'l1',
    events: []
  }
];
