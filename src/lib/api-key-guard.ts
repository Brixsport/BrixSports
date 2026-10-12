import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time shared-secret check that FAILS CLOSED: an unset or empty configured key rejects
 * every request (comparing with `!==` against an unset variable accepts a request that sends no
 * header, because `undefined !== undefined` is false).
 *
 * Both sides are hashed first so timingSafeEqual always compares equal-length buffers.
 */
export function isAuthorizedApiKey(
    provided: string | null | undefined,
    expected: string | null | undefined
): boolean {
    if (typeof expected !== 'string' || expected.length === 0) return false;
    if (typeof provided !== 'string' || provided.length === 0) return false;
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    return timingSafeEqual(a, b);
}
