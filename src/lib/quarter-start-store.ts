// Remembers when the current basketball period began, per match, so a page refresh
// mid-quarter does not restart the elapsed-time count (which would give every later
// event a lower minute than the ones logged before the refresh).

export interface QuarterStart {
    period: string;
    startedAt: number;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const keyFor = (matchId: string) => `bb_quarter_start_${matchId}`;

function defaultStorage(): StorageLike | null {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
        return null;
    }
}

export function saveQuarterStart(matchId: string, period: string, startedAt: number, storage: StorageLike | null = defaultStorage()): void {
    if (!storage) return;
    try {
        storage.setItem(keyFor(matchId), JSON.stringify({ period, startedAt }));
    } catch {
        // storage full / blocked: the clock then behaves as before (restarts on refresh)
    }
}

/**
 * The saved start for `period`, or null when there is none, it is for a different
 * period, or it is not a usable timestamp (unparsable, or in the future).
 */
export function loadQuarterStart(matchId: string, period: string, now: number = Date.now(), storage: StorageLike | null = defaultStorage()): number | null {
    if (!storage) return null;
    try {
        const raw = storage.getItem(keyFor(matchId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<QuarterStart> | null;
        if (!parsed || parsed.period !== period) return null;
        if (typeof parsed.startedAt !== 'number' || !Number.isFinite(parsed.startedAt) || parsed.startedAt > now) return null;
        return parsed.startedAt;
    } catch {
        return null;
    }
}
