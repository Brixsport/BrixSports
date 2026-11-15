import { describe, it, expect } from 'vitest';
import { deriveSubstitutions, substitutionMaps } from '@/lib/lineup/substitutions';

const sub = (over: Record<string, any>) => ({
    id: 'e1',
    type: 'Substitution',
    teamId: 'home',
    minute: 60,
    playerId: 'out1',
    relatedPlayerId: 'in1',
    player: { id: 'out1', name: 'Out One', number: 7 },
    relatedPlayer: { id: 'in1', name: 'In One', jerseyName: 'Onee', number: 14 },
    ...over,
});

describe('deriveSubstitutions', () => {
    it('reads playerId as the player off and relatedPlayerId as the player on', () => {
        const [r] = deriveSubstitutions([sub({})]);
        expect(r).toMatchObject({ outId: 'out1', inId: 'in1', outName: 'Out One', inName: 'Onee', outNumber: 7, inNumber: 14, minute: 60 });
    });

    it('ignores other event types and substitutions missing a side', () => {
        const rows = deriveSubstitutions([
            { type: 'Goal', playerId: 'a' },
            sub({ id: 'x', relatedPlayerId: null, relatedPlayer: null }),
            sub({ id: 'y', playerId: null, player: null }),
        ]);
        expect(rows).toEqual([]);
    });

    it('orders by minute, keeps unknown minutes last and null for them', () => {
        const rows = deriveSubstitutions([
            sub({ id: 'late', minute: 80 }),
            sub({ id: 'unknown', minute: -1 }),
            sub({ id: 'early', minute: 46 }),
        ]);
        expect(rows.map((r) => r.id)).toEqual(['early', 'late', 'unknown']);
        expect(rows[2].minute).toBeNull();
    });

    it('is safe on missing input', () => {
        expect(deriveSubstitutions(undefined)).toEqual([]);
        expect(deriveSubstitutions(null)).toEqual([]);
    });
});

describe('substitutionMaps', () => {
    it('maps players off and on to their minute', () => {
        const { off, on } = substitutionMaps(deriveSubstitutions([sub({}), sub({ id: 'b', playerId: 'out2', relatedPlayerId: 'in2', minute: -1 })]));
        expect(off.get('out1')).toBe(60);
        expect(on.get('in1')).toBe(60);
        expect(off.get('out2')).toBeNull();
        expect(on.has('in2')).toBe(true);
    });
});
