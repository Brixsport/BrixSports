import { describe, it, expect } from 'vitest';
import { isLoggerScopedAdminPath } from '@/lib/logger-admin-paths';

describe('isLoggerScopedAdminPath', () => {
    it('lets a logger reach the ratings page and the lineup publish API only', () => {
        expect(isLoggerScopedAdminPath('logger', '/admin/match-ratings/abc')).toBe(true);
        expect(isLoggerScopedAdminPath('logger', '/api/admin/match-lineups/m1')).toBe(true);
    });

    it('does not let a logger reach any other admin page or API', () => {
        expect(isLoggerScopedAdminPath('logger', '/admin')).toBe(false);
        expect(isLoggerScopedAdminPath('logger', '/admin/users')).toBe(false);
        expect(isLoggerScopedAdminPath('logger', '/admin/match-lineups')).toBe(false);
        expect(isLoggerScopedAdminPath('logger', '/api/admin/assigned-matches')).toBe(false);
        expect(isLoggerScopedAdminPath('logger', '/api/admin/settings')).toBe(false);
        expect(isLoggerScopedAdminPath('logger', '/api/admin/users')).toBe(false);
    });

    it('does not match look-alike prefixes', () => {
        expect(isLoggerScopedAdminPath('logger', '/admin/match-ratings-secret')).toBe(false);
        expect(isLoggerScopedAdminPath('logger', '/api/admin/match-lineups-x/1')).toBe(false);
        // page paths are not valid for API prefixes and vice versa
        expect(isLoggerScopedAdminPath('logger', '/api/admin/match-ratings/1')).toBe(false);
        expect(isLoggerScopedAdminPath('logger', '/admin/assigned-matches')).toBe(false);
    });

    it('never applies to non-logger roles', () => {
        for (const role of ['viewer', 'fan', 'user', 'logger_manager', 'admin', undefined, null, '']) {
            expect(isLoggerScopedAdminPath(role, '/admin/match-lineups')).toBe(false);
            expect(isLoggerScopedAdminPath(role, '/api/admin/match-lineups/m1')).toBe(false);
        }
    });
});

import { decideLineupPost, isFootballFamilySport, canOverwritePublishedLineup } from '@/lib/lineup/logger-lineup-permission';

describe('decideLineupPost', () => {
    it('allows an assigned logger before kick-off', () => {
        expect(decideLineupPost({ role: 'logger', isAssigned: true, matchStatus: 'UPCOMING' })).toEqual({ allow: true });
    });
    it('rejects an unassigned logger with 403', () => {
        expect(decideLineupPost({ role: 'logger', isAssigned: false, matchStatus: 'UPCOMING' })).toMatchObject({ allow: false, status: 403 });
    });
    it('rejects an assigned logger once the match has started', () => {
        for (const s of ['LIVE', 'HALF_TIME', 'FINISHED']) {
            expect(decideLineupPost({ role: 'logger', isAssigned: true, matchStatus: s })).toMatchObject({ allow: false, status: 403 });
        }
    });
    it('lets an admin through regardless of status or assignment', () => {
        expect(decideLineupPost({ role: 'admin', isAssigned: false, matchStatus: 'LIVE' })).toEqual({ allow: true });
    });
    it('rejects viewers/fans with 403 and anonymous with 401', () => {
        for (const role of ['user', 'fan', 'viewer', 'logger_manager']) {
            expect(decideLineupPost({ role, isAssigned: true, matchStatus: 'UPCOMING' })).toMatchObject({ allow: false, status: 403 });
        }
        expect(decideLineupPost({ role: null, isAssigned: false, matchStatus: 'UPCOMING' })).toMatchObject({ allow: false, status: 401 });
    });
});

describe('isFootballFamilySport', () => {
    it('matches the football logger sports only', () => {
        for (const s of ['Football', 'Five-a-side', '5-a-side', '5-aside', 'Futsal']) expect(isFootballFamilySport(s)).toBe(true);
        for (const s of ['Basketball', 'Track & Field', '', null, undefined]) expect(isFootballFamilySport(s)).toBe(false);
    });
});

describe('canOverwritePublishedLineup', () => {
    const pub = (publishedByRole: string, unlocked = false) => ({ status: 'published', publishedByRole, unlocked });
    it('allows writing when nothing is published or it is a draft', () => {
        expect(canOverwritePublishedLineup({ callerRole: 'logger', existing: undefined })).toBe(true);
        expect(canOverwritePublishedLineup({ callerRole: 'logger', existing: { status: 'draft' } })).toBe(true);
    });
    it('lets a logger correct a lineup a logger published', () => {
        expect(canOverwritePublishedLineup({ callerRole: 'logger', existing: pub('logger') })).toBe(true);
    });
    it('keeps an admin-published lineup locked against loggers until unlocked', () => {
        expect(canOverwritePublishedLineup({ callerRole: 'logger', existing: pub('admin') })).toBe(false);
        expect(canOverwritePublishedLineup({ callerRole: 'logger', existing: pub('admin', true) })).toBe(true);
    });
    it('lets an admin correct any published lineup', () => {
        expect(canOverwritePublishedLineup({ callerRole: 'admin', existing: pub('admin') })).toBe(true);
        expect(canOverwritePublishedLineup({ callerRole: 'admin', existing: pub('logger') })).toBe(true);
    });
});
