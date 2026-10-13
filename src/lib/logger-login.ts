// Pure decisions behind logger sign-in, kept free of DB and request types so
// they can be unit tested.

// loggers.status is free text set from the admin panel: 'active', 'inactive' or
// 'on_break'. Rows created before the column existed (and any row with it unset)
// are treated as active. 'on_break' only marks a logger as unavailable for new
// assignments, it does not remove access to matches they are already logging, so
// it stays allowed. 'inactive' (and any unrecognised value) is a disabled account.
export function isLoggerStatusActive(status: string | null | undefined): boolean {
    if (status === null || status === undefined || status === '') return true;
    return status === 'active' || status === 'on_break';
}

// A logger signs in with an email or a display name. Email is unique so it wins
// outright. Names are not unique: a name is only accepted when it identifies
// exactly one logger, otherwise the attempt is rejected like any other bad
// credential (never "which of these did you mean").
export function pickLoggerCandidate<T>(byEmail: T[], byName: T[]): T | null {
    if (byEmail.length > 0) return byEmail[0];
    if (byName.length === 1) return byName[0];
    return null;
}
