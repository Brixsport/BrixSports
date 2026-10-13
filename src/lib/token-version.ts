// Session revocation by token version.
//
// Every user JWT carries a `tv` claim. The users table stores the current
// version; a password change or reset bumps it, which invalidates every token
// signed before the bump. A token with no `tv` claim (signed before this
// existed) counts as version 0, so existing sessions stay valid until the first
// bump for that account.

/** Version a token claims. Missing means 0; a malformed claim never matches. */
export function tokenVersionFromClaim(claim: unknown): number {
    if (claim === undefined || claim === null) return 0;
    if (typeof claim === 'number' && Number.isInteger(claim) && claim >= 0) return claim;
    return -1;
}

/** True when the token's version equals the version currently stored for the user. */
export function isTokenVersionCurrent(claim: unknown, stored: number | null | undefined): boolean {
    return tokenVersionFromClaim(claim) === (stored ?? 0);
}

export type EmailVerifyingEvent = 'google_sign_in' | 'password_reset';

/**
 * Both events prove the person controls the mailbox (Google vouches for the
 * address, the reset link was delivered to it), so they set the flag. Nothing
 * here ever clears it.
 */
export function nextEmailVerified(_current: boolean | null | undefined, _event: EmailVerifyingEvent): boolean {
    return true;
}
