/**
 * Validation for incoming push subscriptions. Every later push is a server-side
 * POST to the stored endpoint, so an endpoint must belong to a known push
 * service; anything else would let a caller aim the server at arbitrary hosts.
 */

// Known web push services (FCM for Chrome/Edge/Brave/Samsung, Mozilla autopush
// for Firefox, WNS for legacy Edge/Windows, Apple web push for Safari).
export const PUSH_HOSTS_EXACT: readonly string[] = [
    'fcm.googleapis.com',
    'updates.push.services.mozilla.com',
    'web.push.apple.com',
];

// Matched against the hostname as a strict subdomain (a leading dot is required).
export const PUSH_HOST_SUFFIXES: readonly string[] = [
    '.push.services.mozilla.com',
    '.notify.windows.com',
    '.push.apple.com',
];

export const MAX_ENDPOINT_LENGTH = 2048;
export const MAX_DEVICE_ID_LENGTH = 128;
export const MAX_SUBSCRIPTIONS_PER_DEVICE = 5;

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const P256DH_BYTES = 65; // uncompressed P-256 public key
const AUTH_BYTES = 16;

export function isAllowedPushEndpoint(endpoint: unknown): boolean {
    if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > MAX_ENDPOINT_LENGTH) {
        return false;
    }
    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    if (url.port) return false; // default https port only
    const host = url.hostname.toLowerCase();
    if (PUSH_HOSTS_EXACT.includes(host)) return true;
    return PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

function isBase64urlOfLength(value: unknown, bytes: number): boolean {
    if (typeof value !== 'string' || !BASE64URL.test(value)) return false;
    return Buffer.from(value, 'base64url').length === bytes;
}

export function isValidDeviceId(deviceId: unknown): boolean {
    return typeof deviceId === 'string' && deviceId.length > 0 && deviceId.length <= MAX_DEVICE_ID_LENGTH;
}

export type SubscriptionCheck = { ok: true } | { ok: false; error: string };

export function validatePushSubscription(subscription: unknown): SubscriptionCheck {
    if (!subscription || typeof subscription !== 'object') {
        return { ok: false, error: 'Invalid subscription format' };
    }
    const sub = subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null };

    if (!isAllowedPushEndpoint(sub.endpoint)) {
        return { ok: false, error: 'Subscription endpoint is not a supported push service' };
    }
    if (!sub.keys || typeof sub.keys !== 'object') {
        return { ok: false, error: 'Invalid subscription keys' };
    }
    if (!isBase64urlOfLength(sub.keys.p256dh, P256DH_BYTES) || !isBase64urlOfLength(sub.keys.auth, AUTH_BYTES)) {
        return { ok: false, error: 'Invalid subscription keys' };
    }
    return { ok: true };
}

/**
 * An anonymous caller must never take over a subscription row that already
 * belongs to a real user: the row keeps its owner and keys, and the caller may
 * only add a match link to it.
 */
export function shouldKeepExistingOwner(input: {
    isAnonymous: boolean;
    existingUserId: string | null | undefined;
    anonymousUserId: string;
}): boolean {
    return input.isAnonymous && !!input.existingUserId && input.existingUserId !== input.anonymousUserId;
}
