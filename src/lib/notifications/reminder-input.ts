/**
 * Validation for POST /api/reminders. Pure so the rules can be unit tested.
 */

export const MIN_REMINDER_MINUTES = 1;
export const MAX_REMINDER_MINUTES = 1440;

export type ReminderCheck =
    | { ok: true; minutesBefore: number }
    | { ok: false; error: string };

export function validateReminderRequest(input: {
    minutesBefore: unknown;
    matchStatus: string | null | undefined;
    matchStartTime: string;
    now: Date;
}): ReminderCheck {
    const { minutesBefore, matchStatus, matchStartTime, now } = input;

    if (
        typeof minutesBefore !== 'number' ||
        !Number.isInteger(minutesBefore) ||
        minutesBefore < MIN_REMINDER_MINUTES ||
        minutesBefore > MAX_REMINDER_MINUTES
    ) {
        return { ok: false, error: `minutesBefore must be a whole number between ${MIN_REMINDER_MINUTES} and ${MAX_REMINDER_MINUTES}` };
    }

    if (matchStatus !== 'UPCOMING') {
        return { ok: false, error: 'Reminders can only be set for upcoming matches' };
    }

    const start = new Date(matchStartTime);
    if (isNaN(start.getTime()) || start.getTime() <= now.getTime()) {
        return { ok: false, error: 'This match has already started' };
    }

    return { ok: true, minutesBefore };
}
