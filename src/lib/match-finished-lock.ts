// Write-lock for matches that are already FINISHED. A logger may not reopen a
// finished match (status) nor push period/clock values onto it; only an admin may.
// A repeated FINISHED request (a retried finish) stays allowed.

export interface FinishedLockInput {
    role: string;
    currentStatus: string | null | undefined;
    body: {
        status?: unknown;
        currentPeriod?: unknown;
        minute?: unknown;
        extraTime?: unknown;
    };
}

/** True when this PATCH must be rejected with 409 MATCH_FINISHED_LOCKED. */
export function isFinishedLockViolation({ role, currentStatus, body }: FinishedLockInput): boolean {
    if (role === 'admin') return false;
    if (currentStatus !== 'FINISHED') return false;

    if (body.status !== undefined && body.status !== 'FINISHED') return true;
    if (body.currentPeriod !== undefined && body.currentPeriod !== 'FINISHED') return true;
    // Clearing the clock fields (null) is part of finishing; setting a value is not.
    if (body.minute !== undefined && body.minute !== null) return true;
    if (body.extraTime !== undefined && body.extraTime !== null) return true;

    return false;
}
