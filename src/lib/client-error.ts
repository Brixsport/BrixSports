/**
 * Converts a caught fetch/parse error into a message safe to show a user.
 * A real `Error` thrown deliberately (e.g. `throw new Error(data.error)` after
 * a non-ok response) is server-authored and already sanitized — show it as-is.
 * A raw `TypeError`/`SyntaxError` from `fetch()`/`.json()` itself is a network
 * or parse failure — never show its message, it's not written for users.
 * Extracted from the working pattern in `src/contexts/AuthContext.tsx`.
 */
export function getClientErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof TypeError || error instanceof SyntaxError) {
        return 'Network error. Please check your connection and try again.';
    }
    if (error instanceof Error) {
        return error.message;
    }
    return fallback;
}
