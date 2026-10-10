// BACKLOG-408 (Later-bucket item 13). Mirrors BACKSCOPE.md. Every path under a listed
// prefix 404s -- pages and APIs alike, current and future routes alike -- enforced in
// src/middleware.ts. Reinstating a feature = delete its entry here in the same commit
// that removes the page's own notFound() (see BACKSCOPE.md's "Reinstate when" line).
//
// Deliberately NOT DB-backed and NOT the fail-open featureFlags.ts pattern: these
// features don't exist yet, so the correct default is dead, and a DB hiccup must never
// be the reason a route that's supposed to be dead comes back alive. A code change plus
// redeploy is the right weight here, matching how BACKSCOPE.md itself is maintained.
export const BACKSCOPED_FEATURES = [
    { key: 'fpl', prefixes: ['/fpl', '/api/fpl'], ref: 'BACKLOG-028' },
    { key: 'predictions', prefixes: ['/predictions', '/api/predictions'], ref: 'BACKLOG-028' },
    { key: 'polls', prefixes: ['/api/polls'], ref: 'BACKLOG-028' },
    { key: 'scouts', prefixes: ['/scouts'], ref: 'BACKLOG-028' },
    { key: 'nesa', prefixes: ['/nesa-registration'], ref: 'BACKLOG-028' },
] as const;

// Exact match or a real path segment boundary -- `/fpl` must not swallow a future
// `/fplayers`, and `/api/polls` must not swallow `/api/pollsters`.
export function isBackscopedPath(pathname: string): boolean {
    return BACKSCOPED_FEATURES.some((feature) =>
        feature.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    );
}
