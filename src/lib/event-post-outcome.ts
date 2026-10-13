// BACKLOG-466 item 4/7: what a logger should do with the HTTP status of a live
// POST /api/matches/[id]/events. Pure so it is unit-testable; the loggers act on it.
//
//   saved         2xx (incl. the server's idempotent-replay 200)
//   refresh-auth  401 -> try /api/auth/refresh once, then re-POST
//   queue         408 / 429 / 5xx -> transient: treat like a network failure
//                 (offline queue; the client event id makes the replay idempotent)
//   rejected      any other 4xx -> the server will never accept it as-is; surface it

export type EventPostAction = 'saved' | 'refresh-auth' | 'queue' | 'rejected';

export function classifyEventPostStatus(status: number): EventPostAction {
    if (status >= 200 && status < 300) return 'saved';
    if (status === 401) return 'refresh-auth';
    if (status === 408 || status === 429 || status >= 500) return 'queue';
    return 'rejected';
}

/** The machine-readable code of an error response body: body.code, else body.error. */
export function extractErrorCode(body: unknown): string {
    const b = body as { code?: unknown; error?: unknown } | null | undefined;
    if (b && typeof b.code === 'string') return b.code;
    if (b && typeof b.error === 'string') return b.error;
    return '';
}

/** User-facing text for a non-retryable rejection (shown in the persistent banner). */
export function describeEventRejection(status: number, eventType: string, code?: string): string {
    if (status === 401) return `Session expired - "${eventType}" was NOT saved. Please log in again, then re-log it.`;
    if (status === 403) return `Not authorised to log events for this match - "${eventType}" was NOT saved. Contact admin.`;
    if (status === 409 && code && code.includes('MATCH_NOT_LIVE')) return `The match is not live - "${eventType}" was NOT saved.`;
    if (status === 409) return `Match is finished - "${eventType}" was NOT saved.`;
    return `"${eventType}" was NOT saved (error ${status}). Check it and re-log if needed.`;
}

/** Events that did not (yet) reach the server cleanly. */
export interface UnsettledEvents {
    pending: number;   // queued for replay
    failed: number;    // refused on replay (permanently)
    rejected: number;  // refused on the live POST this session
}

/**
 * Score fields for the final-whistle PATCH. The client tally includes events the
 * server may not hold, so it is only sent when every event was accepted. Otherwise
 * the fields are omitted and the server's own derived score stands.
 */
export function scoresForFinalization(
    homeScore: number,
    awayScore: number,
    unsettled: UnsettledEvents
): { homeScore: number; awayScore: number } | Record<string, never> {
    if (unsettled.pending > 0 || unsettled.failed > 0 || unsettled.rejected > 0) return {};
    return { homeScore, awayScore };
}
