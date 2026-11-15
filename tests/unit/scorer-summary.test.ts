import { describe, it, expect } from 'vitest';
import { buildScorerSummary, creditedGoal, formatScorerEntry } from '@/lib/scorer-summary';

const H = 'home';
const A = 'away';
const ev = (type: string, teamId: string, minute: number, name: string, detail?: string) => ({
    type, teamId, minute, detail, player: { name, jerseyName: name },
});

describe('creditedGoal', () => {
    it('counts GOAL, Penalty and Own Goal; ignores everything else', () => {
        expect(creditedGoal(ev('Goal', H, 10, 'a'), H, A)).toEqual({ teamId: H, kind: 'goal' });
        expect(creditedGoal(ev('Penalty', H, 51, 'a'), H, A)).toEqual({ teamId: H, kind: 'penalty' });
        expect(creditedGoal(ev('Own Goal', H, 20, 'a'), H, A)).toEqual({ teamId: A, kind: 'own_goal' });
        expect(creditedGoal(ev('Yellow Card', H, 20, 'a'), H, A)).toBeNull();
    });

    it('treats a GOAL whose detail says own goal as an own goal', () => {
        expect(creditedGoal(ev('Goal', A, 30, 'a', 'Own goal'), H, A)).toEqual({ teamId: H, kind: 'own_goal' });
    });
});

describe('buildScorerSummary / formatScorerEntry', () => {
    const events = [
        ev('Goal', H, 12, 'Ade'),
        ev('Penalty', H, 51, 'Animashaun'),
        ev('Goal', H, 70, 'Ade'),
        ev('Own Goal', A, 33, 'Zed'),
        ev('Goal', A, 80, 'Bola'),
        ev('Goal', H, -1, 'Backfill'),
    ];

    it('lists penalties with (P) and groups a scorer\'s minutes', () => {
        const lines = buildScorerSummary(events, H, H, A).map(formatScorerEntry);
        expect(lines).toContain("Animashaun 51' (P)");
        expect(lines).toContain("Ade 12', 70'");
    });

    it('credits an own goal to the opposing team with (OG)', () => {
        const home = buildScorerSummary(events, H, H, A).map(formatScorerEntry);
        const away = buildScorerSummary(events, A, H, A).map(formatScorerEntry);
        expect(home).toContain("Zed (OG) 33'");
        expect(away).toEqual(["Bola 80'"]);
    });

    it('sorts by first minute with unknown minutes last', () => {
        const names = buildScorerSummary(events, H, H, A).map(s => s.name);
        expect(names[names.length - 1]).toBe('Backfill');
        expect(names[0]).toBe('Ade');
    });
});
