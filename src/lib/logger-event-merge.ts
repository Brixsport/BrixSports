// Merging events other loggers have saved into this logger's local event list.

type RemoteEvent = {
    id: string;
    relatedPlayerId?: string | null;
    timestamp?: Date | string | number;
    [key: string]: unknown;
};

/**
 * Appends only the remote events whose id the local list has not seen, mapped to the
 * local event shape. Local events are never replaced, so fields the remote copy does
 * not carry (period, made, assistPlayerId, createdAt) survive a sync. Returns the
 * same array when nothing is new so callers can skip a re-render.
 */
export function appendUnseenRemoteEvents<L extends { id: string }>(prev: L[], remote: RemoteEvent[]): L[] {
    const seen = new Set(prev.map(e => e.id));
    const fresh: L[] = [];
    for (const r of remote) {
        if (!r || seen.has(r.id)) continue;
        seen.add(r.id);
        const { relatedPlayerId, timestamp, ...rest } = r;
        fresh.push({
            ...rest,
            assistPlayerId: relatedPlayerId ?? undefined,
            createdAt: timestamp !== undefined ? new Date(timestamp) : undefined,
        } as unknown as L);
    }
    return fresh.length === 0 ? prev : [...prev, ...fresh];
}
