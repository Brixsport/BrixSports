/**
 * Post-login redirect target: same-origin absolute paths only.
 *
 * A `javascript:` URL, an absolute URL, a protocol-relative `//host` or a `/\host` path in the
 * `callbackUrl` query parameter would run in-origin (the JWT is in localStorage) or send the user
 * off-site, so anything that is not a plain `/path` falls back to the given default.
 */
export function safeCallbackPath(raw: string | null | undefined, fallback = '/'): string {
    if (!raw) return fallback;
    if (!raw.startsWith('/')) return fallback;
    if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
    // Control characters / whitespace tricks that some browsers strip before parsing.
    if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
    return raw;
}
