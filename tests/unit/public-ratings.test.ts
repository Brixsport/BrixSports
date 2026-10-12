import { describe, it, expect } from 'vitest';
import { toPublicRatedPlayer, toPublicRatedTeam } from '@/lib/public-ratings';

const BANNED = ['email', 'profileId', 'attributes', 'age', 'height', 'weight', 'ownerOrganizationId', 'marketValue'];

describe('public ratings shaping', () => {
    it('keeps only public player fields', () => {
        const dto = toPublicRatedPlayer({
            id: 'p1', name: 'A B', jerseyName: 'AB', number: 9, position: 'ST', image: 'i', teamId: 't1', teamName: 'T',
            email: 'a@b.c', profileId: 'x', attributes: '{}', age: 20, height: '180', weight: '70', ownerOrganizationId: 'o', marketValue: '1',
        });
        for (const k of BANNED) expect(dto).not.toHaveProperty(k);
        expect(dto).toMatchObject({ id: 'p1', name: 'A B', teamName: 'T' });
        expect(toPublicRatedPlayer(null)).toBeNull();
    });

    it('keeps only public team fields', () => {
        const dto = toPublicRatedTeam({ id: 't', name: 'N', shortName: 'N', logo: 'l', ownerOrganizationId: 'o', points: 3 });
        expect(dto).not.toHaveProperty('ownerOrganizationId');
        expect(dto).not.toHaveProperty('points');
        expect(dto).toMatchObject({ id: 't', logo: 'l' });
        expect(toPublicRatedTeam(undefined)).toBeNull();
    });
});

import { toPublicMatchRating } from '@/lib/public-ratings';

describe('public match rating shaping', () => {
    it('drops adjustment audit fields and player contact data', () => {
        const dto = toPublicMatchRating({
            playerId: 'p1', teamId: 't1', autoRating: 6.5, finalRating: 7, isMotM: true, name: 'A', jerseyName: 'A', number: 4, position: 'DF', image: null,
            adjustedBy: 'staff-1', adjustmentNotes: 'note', email: 'a@b.c', profileId: 'x', id: 'r1', matchId: 'm1', ratingBreakdown: {},
        });
        for (const k of ['adjustedBy', 'adjustmentNotes', 'email', 'profileId', 'id', 'matchId', 'ratingBreakdown']) expect(dto).not.toHaveProperty(k);
        expect(dto).toMatchObject({ playerId: 'p1', teamId: 't1', autoRating: 6.5, finalRating: 7, isMotM: true, name: 'A' });
    });
});
