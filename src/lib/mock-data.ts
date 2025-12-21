export type SportType = 'Football' | 'Basketball' | 'Volleyball' | 'Track';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  university: string;
  color: string;
}

export interface Player {
  id: string;
  name: string;
  number: number;
  teamId: string;
  position: string;
  rating: number;
  eyePoints: number;
}

export interface MatchEvent {
  id: string;
  type: string;
  minute: number;
  teamId?: string;
  playerId?: string;
  detail?: string;
  isEyePoint?: boolean;
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
}

export const TEAMS: Team[] = [
  {
    id: 'unilag',
    name: 'UNILAG Marines',
    shortName: 'LAG',
    logo: '🌊',
    university: 'University of Lagos',
    color: '#003366',
  },
  {
    id: 'uniben',
    name: 'UNIBEN Royals',
    shortName: 'BEN',
    logo: '🦁',
    university: 'University of Benin',
    color: '#990000',
  },
  {
    id: 'ui',
    name: 'UI Pioneers',
    shortName: 'UI',
    logo: '🎓',
    university: 'University of Ibadan',
    color: '#FFD700',
  },
  {
    id: 'oau',
    name: 'OAU Ife Giants',
    shortName: 'OAU',
    logo: '🐘',
    university: 'Obafemi Awolowo University',
    color: '#000080',
  },
  {
    id: 'unn',
    name: 'UNN Lions',
    shortName: 'UNN',
    logo: '🦁',
    university: 'University of Nigeria, Nsukka',
    color: '#006400',
  },
  {
    id: 'abu',
    name: 'ABU Zaria Nobles',
    shortName: 'ABU',
    logo: '🏰',
    university: 'Ahmadu Bello University',
    color: '#008080',
  },
];

export const PLAYERS: Player[] = [
  { id: 'p1', name: 'Tunde Adeyemi', number: 10, teamId: 'unilag', position: 'Forward', rating: 8.5, eyePoints: 2 },
  { id: 'p2', name: 'Emeka Obi', number: 7, teamId: 'uniben', position: 'Midfielder', rating: 7.8, eyePoints: 0 },
  { id: 'p3', name: 'Segun Bello', number: 9, teamId: 'unilag', position: 'Forward', rating: 8.2, eyePoints: 1 },
  { id: 'p4', name: 'Chidi Azikiwe', number: 1, teamId: 'uniben', position: 'Goalkeeper', rating: 7.2, eyePoints: 0 },
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
    events: [
      { id: 'e1', type: 'Goal', minute: 15, teamId: 'unilag', detail: 'Tunde Ade' },
      { id: 'e2', type: 'Goal', minute: 42, teamId: 'uniben', detail: 'Emeka Obi' },
      { id: 'e3', type: 'Goal', minute: 68, teamId: 'unilag', detail: 'Segun Bello' },
      { id: 'e4', type: 'Eye Point', minute: 75, teamId: 'unilag', playerId: 'p1', detail: 'Exceptional Hustle', isEyePoint: true },
    ],
  },
  {
    id: 'm2',
    sport: 'Basketball',
    homeTeamId: 'ui',
    awayTeamId: 'oau',
    homeScore: 78,
    awayScore: 75,
    status: 'LIVE',
    startTime: '2024-03-20T18:00:00Z',
    venue: 'UI Indoor Gym',
    competition: 'Inter-Varsity invitational',
    events: [],
  },
  {
    id: 'm3',
    sport: 'Football',
    homeTeamId: 'unn',
    awayTeamId: 'abu',
    homeScore: 0,
    awayScore: 0,
    status: 'UPCOMING',
    startTime: '2024-03-21T10:00:00Z',
    venue: 'UNN Stadium',
    competition: 'NUGA Games 2024',
    events: [],
  },
];
