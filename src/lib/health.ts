// Readiness decision for /api/health/ready. Pure, so the response rules can be unit tested.

export interface CheckResult {
    ok: boolean;
    latencyMs: number;
}

export interface ReadinessReport {
    status: 'ok' | 'down';
    httpStatus: 200 | 503;
    checks: { database: CheckResult };
}

/** The service is ready only when the database answered. */
export function evaluateReadiness(database: CheckResult): ReadinessReport {
    const ok = database.ok;
    return {
        status: ok ? 'ok' : 'down',
        httpStatus: ok ? 200 : 503,
        checks: { database },
    };
}

/**
 * Runs a check with a time limit. A rejection or a timeout counts as not ok; the error
 * itself is never returned to the caller.
 */
export async function timedCheck(run: () => Promise<unknown>, timeoutMs: number): Promise<CheckResult> {
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            run(),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
            }),
        ]);
        return { ok: true, latencyMs: Date.now() - startedAt };
    } catch {
        return { ok: false, latencyMs: Date.now() - startedAt };
    } finally {
        if (timer) clearTimeout(timer);
    }
}
