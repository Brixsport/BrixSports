import { describe, it, expect } from 'vitest';
import {
    toPublicNewsArticle,
    toPublicNewsListItem,
    toPublicNewsRelatedPlayer,
    toPublicNewsRelatedTeam,
    toPublicNewsRelatedCompetition,
} from '@/lib/public-news';

const article = {
    id: 'n1', title: 'T', slug: 't-1', content: 'body', excerpt: 'e', imageUrl: null, category: 'general', tags: '[]',
    isBreaking: false, isFeatured: true, authorId: 'staff-1', authorName: 'Desk', views: 3, likes: 1,
    sendPushNotification: true, pushNotificationSent: false, pushNotificationSentAt: null,
    status: 'published', publishedAt: 1, createdAt: 2, updatedAt: 3,
};

describe('public news shaping', () => {
    it('drops the staff author id and push bookkeeping', () => {
        const dto = toPublicNewsArticle(article);
        for (const k of ['authorId', 'sendPushNotification', 'pushNotificationSent', 'pushNotificationSentAt']) expect(dto).not.toHaveProperty(k);
        expect(dto).toMatchObject({ id: 'n1', content: 'body', authorName: 'Desk', status: 'published' });
    });

    it('list items omit the body as well', () => {
        const dto = toPublicNewsListItem(article);
        expect(dto).not.toHaveProperty('content');
        expect(dto).not.toHaveProperty('authorId');
        expect(dto).toMatchObject({ id: 'n1', slug: 't-1' });
    });

    it('related entities keep public fields only', () => {
        expect(toPublicNewsRelatedPlayer({ id: 'p', name: 'N', jerseyName: 'J', number: 1, position: 'GK', image: null, email: 'a@b.c', profileId: 'x' }))
            .not.toHaveProperty('email');
        expect(toPublicNewsRelatedTeam({ id: 't', name: 'N', shortName: 'N', logo: 'l', ownerOrganizationId: 'o' })).not.toHaveProperty('ownerOrganizationId');
        const comp = toPublicNewsRelatedCompetition({ id: 'c', name: 'N', sport: 'Football', season: '26', logo: null, status: 'live', rules: 'r', entryFee: '5' });
        expect(comp).not.toHaveProperty('entryFee');
        expect(comp).toMatchObject({ id: 'c', status: 'live' });
    });
});
