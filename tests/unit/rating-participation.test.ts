import { describe, it, expect } from 'vitest';
import { getEnteredPlayerIds, didPlayerPlay } from '@/lib/ratings/participation';

const starters = Array.from({ length: 11 }, (_, i) => ({ playerId: `s${i + 1}`, isSubstitute: false }));
const subs = Array.from({ length: 7 }, (_, i) => ({ playerId: `b${i + 1}`, isSubstitute: true }));
const lineup = [...starters, ...subs];

describe('getEnteredPlayerIds', () => {
    it('credits the player coming on, not the player going off', () => {
        const entered = getEnteredPlayerIds([
            { type: 'Substitution', playerId: 's3', relatedPlayerId: 'b1' },
        ]);
        expect(entered.has('b1')).toBe(true);
    });

    it('counts a player with an event of their own', () => {
        const entered = getEnteredPlayerIds([{ type: 'Goal', playerId: 'b2' }]);
        expect(entered.has('b2')).toBe(true);
    });

    it('does not credit relatedPlayerId on events that are not substitutions', () => {
        const entered = getEnteredPlayerIds([
            { type: 'Field Goal', playerId: 's1', relatedPlayerId: 'b4' },
        ]);
        expect(entered.has('b4')).toBe(false);
    });

    it('returns an empty set for no events', () => {
        expect(getEnteredPlayerIds([]).size).toBe(0);
    });
});

describe('didPlayerPlay', () => {
    it('rates only the starters and the substitutes who came on', () => {
        const events = [
            { type: 'Substitution', playerId: 's11', relatedPlayerId: 'b1' },
            { type: 'Yellow Card', playerId: 'b2' },
            { type: 'Goal', playerId: 's9' },
        ];
        const entered = getEnteredPlayerIds(events);
        const rated = lineup.filter((p) => didPlayerPlay(p, entered)).map((p) => p.playerId);

        expect(rated).toHaveLength(13);
        expect(rated).toContain('b1');
        expect(rated).toContain('b2');
        expect(rated).not.toContain('b3');
        expect(starters.every((s) => rated.includes(s.playerId))).toBe(true);
    });

    it('keeps a substituted-off starter', () => {
        const entered = getEnteredPlayerIds([
            { type: 'Substitution', playerId: 's5', relatedPlayerId: 'b1' },
        ]);
        expect(didPlayerPlay({ playerId: 's5', isSubstitute: false }, entered)).toBe(true);
    });

    it('rates no substitute when nobody came on', () => {
        const entered = getEnteredPlayerIds([]);
        const rated = lineup.filter((p) => didPlayerPlay(p, entered));
        expect(rated).toHaveLength(11);
    });
});
