import { safeParseEventValue } from '@/lib/eventValue';

// Pure shaping for the match detail payload. Kept free of database imports so it can be unit tested.

/**
 * Event DTO. loggerId is never returned; loggerName identifies the same person and is
 * returned to staff (admin or logger sessions) only.
 */
export function toEventDto(
    row: { event: Record<string, any>; player: { id?: string | null } | null; relatedPlayer: { id?: string | null } | null },
    isStaff: boolean
) {
    const { loggerId: _l, loggerName: _ln, ...publicEvent } = row.event;
    return {
        ...publicEvent,
        ...(isStaff ? { loggerName: _ln } : {}),
        player: row.player?.id ? row.player : null,
        relatedPlayer: row.relatedPlayer?.id ? row.relatedPlayer : null,
        value: safeParseEventValue(row.event.value),
    };
}

/**
 * Non-staff callers only see published lineups, without publish and unlock authorship
 * (those names can be an admin's email).
 */
export function gateLineups(lineups: any, isStaff: boolean): any {
    if (!lineups || typeof lineups !== 'object' || isStaff) return lineups;
    return Object.fromEntries(
        Object.entries(lineups)
            .filter(([, teamLineup]) => (teamLineup as any)?.status === 'published')
            .map(([side, teamLineup]) => {
                const { publishedBy, publishedByName, publishedByRole, unlockedBy, unlockedByName, ...rest } = teamLineup as any;
                return [side, rest];
            })
    );
}

/** Drops staff-only and audit columns from a match row. */
export function toMatchDto<T extends Record<string, any>>(row: T) {
    const { loggerId, approvalStatus, managerNotes, approvedBy, approvedAt, ...publicMatch } = row;
    return publicMatch;
}

