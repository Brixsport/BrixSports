import { describe, it, expect } from 'vitest';
import { toPublicTransfer } from '@/lib/public-transfers';

describe('public transfer shaping', () => {
    it('drops staff ids, push bookkeeping and player contact columns', () => {
        const dto = toPublicTransfer(
            {
                id: 'tr1', playerId: 'p1', fromTeamId: 'a', toTeamId: 'b', transferType: 'permanent', fee: '1', status: 'rumor', reliability: 5,
                source: 's', description: 'd', imageUrl: null, season: '2026', announcedAt: 1, completedAt: null, createdAt: 2,
                createdBy: 'staff-1', sendPushNotification: true, pushNotificationSent: false, updatedAt: 3,
            },
            { id: 'p1', name: 'N', jerseyName: 'J', number: 7, position: 'ST', image: null, email: 'a@b.c', profileId: 'x', attributes: '{}' },
            { id: 'a', name: 'A', shortName: 'A', logo: 'l', university: 'U', color: '#fff', sport: 'Football', ownerOrganizationId: 'org' },
            null
        );
        for (const k of ['createdBy', 'sendPushNotification', 'pushNotificationSent', 'updatedAt']) expect(dto).not.toHaveProperty(k);
        expect(dto.player).not.toHaveProperty('email');
        expect(dto.player).not.toHaveProperty('profileId');
        expect(dto.player).not.toHaveProperty('attributes');
        expect(dto.fromTeam).not.toHaveProperty('ownerOrganizationId');
        expect(dto.toTeam).toBeNull();
        expect(dto).toMatchObject({ id: 'tr1', status: 'rumor', player: { id: 'p1', name: 'N' } });
    });
});
