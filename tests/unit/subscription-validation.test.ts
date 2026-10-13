import { describe, it, expect } from 'vitest';
import {
    isAllowedPushEndpoint,
    validatePushSubscription,
    isValidDeviceId,
    shouldKeepExistingOwner,
} from '@/lib/notifications/subscription-validation';

// 65 bytes / 16 bytes of base64url, the shape PushSubscription.toJSON() produces.
const P256DH = Buffer.alloc(65, 7).toString('base64url');
const AUTH = Buffer.alloc(16, 9).toString('base64url');
const GOOD_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123:APA91bExample';

describe('isAllowedPushEndpoint', () => {
    it('accepts the known push services', () => {
        for (const e of [
            GOOD_ENDPOINT,
            'https://updates.push.services.mozilla.com/wpush/v2/abc',
            'https://updates-autopush.push.services.mozilla.com/wpush/v2/abc',
            'https://wns2-par02p.notify.windows.com/w/?token=abc',
            'https://web.push.apple.com/QAbc',
            'https://api.push.apple.com/3/device/abc',
        ]) {
            expect(isAllowedPushEndpoint(e), e).toBe(true);
        }
    });

    it('rejects non-https, unknown hosts, lookalikes and internal targets', () => {
        for (const e of [
            'http://fcm.googleapis.com/fcm/send/abc',
            'https://evil.example.com/push',
            'https://fcm.googleapis.com.evil.example.com/x',
            'https://evilfcm.googleapis.com/x',
            'https://notify.windows.com/x',
            'https://evil-notify.windows.com/x',
            'https://push.apple.com/x',
            'https://localhost/x',
            'https://127.0.0.1/x',
            'https://169.254.169.254/latest/meta-data',
            'https://user:pass@fcm.googleapis.com/x',
            'https://fcm.googleapis.com:8443/x',
            'ftp://fcm.googleapis.com/x',
            'not a url',
            '',
        ]) {
            expect(isAllowedPushEndpoint(e), e).toBe(false);
        }
    });

    it('rejects non-strings and oversized endpoints', () => {
        expect(isAllowedPushEndpoint(undefined)).toBe(false);
        expect(isAllowedPushEndpoint(null)).toBe(false);
        expect(isAllowedPushEndpoint(42)).toBe(false);
        expect(isAllowedPushEndpoint(`https://fcm.googleapis.com/${'a'.repeat(2100)}`)).toBe(false);
    });
});

describe('validatePushSubscription', () => {
    const good = { endpoint: GOOD_ENDPOINT, keys: { p256dh: P256DH, auth: AUTH } };

    it('accepts a well-formed subscription', () => {
        expect(validatePushSubscription(good)).toEqual({ ok: true });
    });

    it('rejects missing or malformed pieces', () => {
        expect(validatePushSubscription(null).ok).toBe(false);
        expect(validatePushSubscription('x').ok).toBe(false);
        expect(validatePushSubscription({ endpoint: GOOD_ENDPOINT }).ok).toBe(false);
        expect(validatePushSubscription({ ...good, endpoint: 'https://evil.example.com/x' }).ok).toBe(false);
        expect(validatePushSubscription({ ...good, keys: { p256dh: P256DH } }).ok).toBe(false);
        expect(validatePushSubscription({ ...good, keys: { p256dh: P256DH, auth: 42 } }).ok).toBe(false);
    });

    it('rejects keys of the wrong length or alphabet', () => {
        expect(validatePushSubscription({ ...good, keys: { p256dh: 'short', auth: AUTH } }).ok).toBe(false);
        expect(validatePushSubscription({ ...good, keys: { p256dh: P256DH, auth: 'short' } }).ok).toBe(false);
        expect(validatePushSubscription({ ...good, keys: { p256dh: P256DH + 'AA', auth: AUTH } }).ok).toBe(false);
        expect(validatePushSubscription({ ...good, keys: { p256dh: P256DH.slice(0, -1) + '+', auth: AUTH } }).ok).toBe(false);
        expect(validatePushSubscription({ ...good, keys: { p256dh: `${P256DH}==`, auth: AUTH } }).ok).toBe(false);
    });
});

describe('isValidDeviceId', () => {
    it('accepts a normal id and rejects empty, non-string and oversized ids', () => {
        expect(isValidDeviceId('3f2b8c1e-0d1a-4c7e-9a52-1f0e5d6b7a88')).toBe(true);
        expect(isValidDeviceId('')).toBe(false);
        expect(isValidDeviceId(123)).toBe(false);
        expect(isValidDeviceId('a'.repeat(129))).toBe(false);
    });
});

describe('shouldKeepExistingOwner', () => {
    const anonymousUserId = 'anonymous-push-subscriber';

    it('keeps a real user as owner when the caller is anonymous', () => {
        expect(shouldKeepExistingOwner({ isAnonymous: true, existingUserId: 'user-1', anonymousUserId })).toBe(true);
    });

    it('lets an anonymous caller refresh an anonymous row', () => {
        expect(shouldKeepExistingOwner({ isAnonymous: true, existingUserId: anonymousUserId, anonymousUserId })).toBe(false);
    });

    it('does not block signed-in callers', () => {
        expect(shouldKeepExistingOwner({ isAnonymous: false, existingUserId: 'user-1', anonymousUserId })).toBe(false);
        expect(shouldKeepExistingOwner({ isAnonymous: false, existingUserId: anonymousUserId, anonymousUserId })).toBe(false);
    });

    it('treats a missing existing row as nothing to keep', () => {
        expect(shouldKeepExistingOwner({ isAnonymous: true, existingUserId: undefined, anonymousUserId })).toBe(false);
    });
});
