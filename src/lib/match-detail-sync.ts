/**
 * Pure decision helpers for the match detail page, which merges three sources into one state: the first
 * load, background polls, and live WebSocket messages. Keeping the rules here makes them testable without a
 * browser or a socket.
 */

// ---- Poll sequencing -------------------------------------------------------------------------------------

export interface PollApplyInput {
    /** Sequence number given to this request when it was started. */
    requestSeq: number;
    /** Highest sequence number whose response has already been applied. */
    lastAppliedSeq: number;
    /** When this request was started (ms). */
    startedAt: number;
    /** When a WebSocket message last changed the match state (ms), 0 if never. */
    lastWsMutationAt: number;
    /** Silent = a background poll; false = the first load or a user retry. */
    silent: boolean;
    /** The page switched to another match while this request was running. */
    matchChanged: boolean;
}

/**
 * Whether a finished request may replace the match state.
 * - The match changed: never.
 * - A response from a later request was already applied: never (this one is older data).
 * - A silent poll that started before a WebSocket message changed the state: never, it would roll that
 *   message back. The next poll starts after the message and carries it.
 * First loads and retries are only subject to the first two rules.
 */
export function shouldApplyMatchResponse(input: PollApplyInput): boolean {
    if (input.matchChanged) return false;
    if (input.requestSeq < input.lastAppliedSeq) return false;
    if (input.silent && input.startedAt < input.lastWsMutationAt) return false;
    return true;
}

/** Poll cadence for a live match: fast when the socket is down, slow reconciliation when it is up. */
export const DISCONNECTED_POLL_MS = 4000;
export const CONNECTED_RECONCILE_POLL_MS = 25000;

export function matchPollIntervalMs(isSocketConnected: boolean): number {
    return isSocketConnected ? CONNECTED_RECONCILE_POLL_MS : DISCONNECTED_POLL_MS;
}

// ---- Live events -----------------------------------------------------------------------------------------

interface WithId {
    id?: string | null;
}

/**
 * Events from the socket hook's list that have not been handled yet, oldest first. Two messages that land in
 * the same render both show up here, which a "latest event only" effect would miss. Events without an id
 * cannot be told apart and are skipped.
 */
export function selectUnseenLiveEvents<T extends WithId>(
    live: T[],
    seen: ReadonlySet<string>
): { fresh: T[]; seen: Set<string> } {
    const nextSeen = new Set(seen);
    const fresh: T[] = [];
    for (const e of live) {
        if (!e || !e.id || nextSeen.has(e.id)) continue;
        nextSeen.add(e.id);
        fresh.push(e);
    }
    return { fresh, seen: nextSeen };
}

/**
 * Adds events to a newest-first list, keyed by id only (a legitimate repeat of the same type, minute, player
 * and team is a different event). Returns the same array when nothing is new.
 */
export function prependNewEvents<T extends WithId>(existing: T[], fresh: T[]): T[] {
    if (fresh.length === 0) return existing;
    const have = new Set(existing.map((e) => e.id));
    const toAdd = fresh.filter((e) => !have.has(e.id));
    if (toAdd.length === 0) return existing;
    return [...toAdd.reverse(), ...existing];
}

// ---- Period / timer --------------------------------------------------------------------------------------

export interface DisplayPeriodInput {
    status: string | null | undefined;
    currentPeriod: string | null | undefined;
    timerPeriod: string | null | undefined;
    timerIsStale: boolean;
}

/**
 * The period label to show. A finished match is always FINISHED, whatever the live timer last said. Otherwise
 * a fresh timer value wins, then the stored period, then the status.
 */
export function resolveDisplayPeriod(input: DisplayPeriodInput): string {
    if (input.status === 'FINISHED') return 'FINISHED';
    if (!input.timerIsStale && input.timerPeriod) return input.timerPeriod;
    return input.currentPeriod ?? input.status ?? '';
}

export interface TimerTick {
    minute: number;
    extraTime: number;
    period?: string;
}

/**
 * Writes a live timer tick into the match. A finished match is left alone: a late tick must neither move its
 * clock nor push a live period into its status.
 */
export function applyTimerToMatch<M extends { status?: string }>(match: M, tick: TimerTick): M {
    if (match.status === 'FINISHED') return match;
    return {
        ...match,
        minute: tick.minute,
        extraTime: tick.extraTime,
        status: tick.period || match.status,
    };
}
