/**
 * Visibility-aware polling for viewer pages.
 *
 * - Polls with a jittered interval (default +-20%) so a stadium of viewers does not hit the origin in
 *   lockstep (a kickoff or a WS outage used to line every client up on the same tick).
 * - Pauses while the tab is hidden: a backgrounded tab is throttled by the browser anyway, and its polls
 *   only cost origin load for a screen nobody is looking at.
 * - Fetches immediately when the tab becomes visible again, then resumes.
 * - `intervalMs` may be a function so the cadence can adapt (fast while a match is live, slow otherwise).
 */
export interface VisiblePollDeps {
    isVisible: () => boolean;
    /** Subscribe to visibility changes; returns an unsubscribe function. */
    onVisibilityChange: (cb: () => void) => () => void;
    random: () => number;
}

export interface VisiblePollOptions {
    /** Fraction of the interval to randomise, 0 to 1 (default 0.2). */
    jitter?: number;
    deps?: Partial<VisiblePollDeps>;
}

function defaultDeps(): VisiblePollDeps {
    return {
        isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
        onVisibilityChange: (cb) => {
            if (typeof document === 'undefined') return () => {};
            document.addEventListener('visibilitychange', cb);
            return () => document.removeEventListener('visibilitychange', cb);
        },
        random: Math.random,
    };
}

export function startVisiblePolling(
    tick: () => void,
    intervalMs: number | (() => number),
    options: VisiblePollOptions = {}
): () => void {
    const deps: VisiblePollDeps = { ...defaultDeps(), ...options.deps };
    const jitter = Math.min(Math.max(options.jitter ?? 0.2, 0), 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const nextDelay = () => {
        const base = typeof intervalMs === 'function' ? intervalMs() : intervalMs;
        const factor = 1 + (deps.random() * 2 - 1) * jitter;
        return Math.max(250, Math.round(base * factor));
    };

    const clear = () => {
        if (timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
        }
    };

    const schedule = () => {
        clear();
        if (stopped || !deps.isVisible()) return;
        timer = setTimeout(() => {
            timer = undefined;
            if (stopped) return;
            if (deps.isVisible()) tick();
            schedule();
        }, nextDelay());
    };

    const unsubscribe = deps.onVisibilityChange(() => {
        if (stopped) return;
        if (deps.isVisible()) {
            tick();
            schedule();
        } else {
            clear();
        }
    });

    schedule();

    return () => {
        stopped = true;
        clear();
        unsubscribe();
    };
}
