/**
 * Public WebSocket payloads.
 *
 * Match rooms are joined by anonymous viewers (`match:subscribe` has no auth), so anything the
 * server broadcasts into a room is public. CLAUDE.md bans loggerId / approvedBy / approvalStatus /
 * managerNotes (and, by the same NDPR reasoning as the REST responses, loggerName) from public
 * responses; the REST routes strip them, and these helpers apply the same rule to the broadcast
 * path so the two cannot drift.
 *
 * Multi-logger conflict detection does NOT depend on these fields in the broadcast: it reads other
 * loggers' identity from the authenticated `GET /api/matches/[id]/events` (src/hooks/useMultiLogger.ts).
 */

/** Fields the match-page and live hooks read from `match:updated` (useWebSocket.tsx, MatchDetailClient.tsx). */
const PUBLIC_MATCH_UPDATE_FIELDS = [
    'status',
    'currentPeriod',
    'homeScore',
    'awayScore',
    'shootoutHomeScore',
    'shootoutAwayScore',
    'minute',
    'extraTime',
] as const;

/** `event:new` payload: the inserted event without logger identity. */
export function toPublicMatchEvent<T extends Record<string, any>>(event: T): Omit<T, 'loggerId' | 'loggerName'> {
    const { loggerId: _loggerId, loggerName: _loggerName, ...rest } = event;
    return rest;
}

/** `match:updated` payload: allow-list, so new or admin-only update fields can never leak by default. */
export function toPublicMatchUpdate(matchId: string, updateData: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = { matchId };
    for (const key of PUBLIC_MATCH_UPDATE_FIELDS) {
        if (updateData[key] !== undefined) out[key] = updateData[key];
    }
    return out;
}
