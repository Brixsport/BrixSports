/**
 * Public match row shaping.
 *
 * The public sport match lists spread raw `matches` rows into the response. These columns
 * are banned from any public response (NDPR/GDPR -- see CLAUDE.md "Public API"), so they
 * are removed here before the row leaves the server.
 */
export function toPublicMatchRow<T extends Record<string, unknown>>(match: T) {
    const {
        loggerId: _loggerId,
        approvalStatus: _approvalStatus,
        managerNotes: _managerNotes,
        approvedBy: _approvedBy,
        approvedAt: _approvedAt,
        ...rest
    } = match;
    return rest;
}
