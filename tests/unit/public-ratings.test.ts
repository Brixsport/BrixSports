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
