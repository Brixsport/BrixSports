// BACKLOG-466 item 1: client-generated event id used as an idempotency key for
// POST /api/matches/[id]/events. match_events.id is a text PRIMARY KEY, so a
// client-supplied id gives the replay path (offline queue / lost response) a
// unique key with no schema change.

const CLIENT_EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** True only for ids safe to adopt as a match_events primary key. */
export function isValidClientEventId(value: unknown): value is string {
    return typeof value === 'string' && CLIENT_EVENT_ID_PATTERN.test(value);
}

/** Collision-resistant client-side id (matches the validator above). */
export function generateClientEventId(prefix = 'evt'): string {
    const rand =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID().replace(/-/g, '')
            : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${Date.now().toString(36)}_${rand}`.slice(0, 64);
}
