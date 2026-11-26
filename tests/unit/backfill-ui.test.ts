import { describe, it, expect } from 'vitest';
import { searchRoster, playerLabel, rowsToPayload, scorerOptions, scoreFromRows, type EventRow, type RosterPlayer } from '@/lib/backfill-ui';

const roster: RosterPlayer[] = [
    { playerId: 'a', name: 'Olatunde Adeyemi', jerseyName: 'Olatee', jerseyNumber: 9, nicknames: ['Tee'] },
    { playerId: 'b', name: 'Chidi Okafor', jerseyName: 'Chidi Okafor', jerseyNumber: 10, nicknames: [] },
    { playerId: 'c', name: 'Tobi Adebayo', jerseyName: 'Tobi', jerseyNumber: 7, nicknames: ['Blacko'] },
];

describe('searchRoster', () => {
    it('finds by nickname, jersey name, number and name part', () => {
        expect(searchRoster(roster, 'blacko')[0].playerId).toBe('c');
        expect(searchRoster(roster, 'olatee')[0].playerId).toBe('a');
        expect(searchRoster(roster, '10')[0].playerId).toBe('b');
        expect(searchRoster(roster, 'okaf')[0].playerId).toBe('b');
    });
    it('ranks an exact nickname above a substring hit', () => {
        const r = searchRoster(roster, 'tee');
        expect(r[0].playerId).toBe('a');
    });
    it('requires every word to match and returns the roster for an empty query', () => {
        expect(searchRoster(roster, 'tobi chidi')).toEqual([]);
        expect(searchRoster(roster, '  ').length).toBe(3);
    });
});

describe('playerLabel', () => {
    it('shows the jersey name only when it differs, plus the number', () => {
        expect(playerLabel(roster[0])).toBe('Olatunde Adeyemi (Olatee) #9');
        expect(playerLabel(roster[1])).toBe('Chidi Okafor #10');
    });
});

const row = (over: Partial<EventRow>): EventRow => ({ key: 'k', type: 'Goal', side: 'home', playerId: '', relatedPlayerId: '', ...over });

describe('rowsToPayload', () => {
    const teams = { home: 'H', away: 'A' };
    it('maps sides to team ids and allows a goal with no scorer', () => {
        const { events, problems } = rowsToPayload([row({ side: 'away' }), row({ type: 'Assist', playerId: 'b', relatedPlayerId: 'a' })], teams);
        expect(problems).toEqual([]);
        expect(events[0]).toMatchObject({ type: 'Goal', teamId: 'A', playerId: null });
        expect(events[1]).toMatchObject({ type: 'Assist', teamId: 'H', relatedPlayerId: 'a' });
    });
    it('reports missing players and an assist with no scorer', () => {
        const { problems } = rowsToPayload([row({ type: 'Yellow Card' }), row({ type: 'Assist', playerId: 'b' })], teams);
        expect(problems).toHaveLength(2);
    });
});

describe('scorerOptions and scoreFromRows', () => {
    const rows = [
        row({ playerId: 'a' }),
        row({ type: 'Penalty', playerId: 'b' }),
        row({ playerId: '' }),
        row({ side: 'away', playerId: 'c' }),
        row({ type: 'Own Goal', side: 'away', playerId: 'x' }),
    ];
    it('lists distinct known scorers for one side', () => {
        expect(scorerOptions(rows, 'home')).toEqual(['a', 'b']);
        expect(scorerOptions(rows, 'away')).toEqual(['c']);
    });
    it('adds an own goal to the other side', () => {
        expect(scoreFromRows(rows)).toEqual({ home: 4, away: 1 });
    });
});
