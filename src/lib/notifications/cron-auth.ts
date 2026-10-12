import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time check of an `Authorization: Bearer <secret>` header against the
 * configured secret. Fails closed when the secret is unset or empty.
 *
 * Both sides are hashed first so the buffers handed to timingSafeEqual always
 * have equal length, whatever the caller sent.
 */
export function isValidBearerSecret(authHeader: string | null | undefined, secret: string | null | undefined): boolean {
    if (!secret) return false;
    if (!authHeader) return false;
    const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
    const received = createHash('sha256').update(authHeader).digest();
    return timingSafeEqual(expected, received);
}
