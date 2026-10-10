/**
 * Shared Sentry scrubbing helpers (BACKLOG-469 item 4 / BACKLOG-464 item 6).
 *
 * The Google OAuth callback redirects to `/?oauth_token=<7-day session JWT>`,
 * so that URL (and any `token=` / `Authorization` value) must never reach
 * Sentry via request URLs, headers, breadcrumbs, transaction names or span
 * names. Used by instrumentation-client.ts, sentry.server.config.ts and
 * sentry.edge.config.ts.
 *
 * Runtime-agnostic on purpose: no Node or DOM APIs, so it is safe in the
 * browser, Node and Edge bundles. Everything here mutates and returns the
 * object it is given; callers must never let a scrubbing bug drop an event,
 * hence every entry point is wrapped in try/catch and returns the input.
 */

export const REDACTED = '[Filtered]';

// Query/fragment parameters whose value is a credential. The `[?&#]` prefix
// means `csrf_token=` is NOT matched by `token=` (only a whole-name match is).
const SENSITIVE_PARAM = /([?&#](?:oauth_token|access_token|id_token|refresh_token|token|authorization)=)[^&#\s"']*/gi;

// Headers whose whole value is a credential.
const SENSITIVE_HEADER = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key)$/i;

type AnyRecord = Record<string, any>;

/** Redacts credential query/fragment params inside a URL or any string containing one. */
export function scrubUrl(value: string): string {
    return value.replace(SENSITIVE_PARAM, `$1${REDACTED}`);
}

function scrubString(value: unknown): unknown {
    return typeof value === 'string' ? scrubUrl(value) : value;
}

function scrubHeaders(headers: AnyRecord): void {
    for (const key of Object.keys(headers)) {
        if (SENSITIVE_HEADER.test(key)) {
            headers[key] = REDACTED;
        } else if (typeof headers[key] === 'string') {
            // e.g. Referer carrying ?oauth_token=...
            headers[key] = scrubUrl(headers[key]);
        }
    }
}

function scrubQueryString(qs: unknown): unknown {
    if (typeof qs === 'string') {
        // query_string has no leading '?', so prefix one for the shared regex.
        return scrubUrl(`?${qs}`).slice(1);
    }
    if (Array.isArray(qs)) {
        return qs.map((pair) =>
            Array.isArray(pair) && /^(oauth_token|access_token|id_token|refresh_token|token|authorization)$/i.test(String(pair[0]))
                ? [pair[0], REDACTED]
                : pair,
        );
    }
    if (qs && typeof qs === 'object') {
        const out: AnyRecord = { ...(qs as AnyRecord) };
        for (const key of Object.keys(out)) {
            if (/^(oauth_token|access_token|id_token|refresh_token|token|authorization)$/i.test(key)) {
                out[key] = REDACTED;
            }
        }
        return out;
    }
    return qs;
}

/** Scrubs a breadcrumb in place: data.url / from / to, plus message. */
export function scrubBreadcrumb<T>(breadcrumb: T): T {
    try {
        const b = breadcrumb as AnyRecord;
        if (!b) return breadcrumb;
        if (typeof b.message === 'string') b.message = scrubUrl(b.message);
        if (b.data && typeof b.data === 'object') {
            for (const key of ['url', 'from', 'to']) {
                if (typeof b.data[key] === 'string') b.data[key] = scrubUrl(b.data[key]);
            }
            if (b.data.headers && typeof b.data.headers === 'object') scrubHeaders(b.data.headers);
        }
    } catch {
        // never let scrubbing drop a breadcrumb
    }
    return breadcrumb;
}

/**
 * Scrubs an error or transaction event in place: request url / query string /
 * headers / cookies, the transaction name, span descriptions and names, the
 * trace context description, and every breadcrumb.
 */
export function scrubEvent<T>(event: T): T {
    try {
        const e = event as AnyRecord;
        if (!e) return event;

        if (e.request && typeof e.request === 'object') {
            const r = e.request;
            if (typeof r.url === 'string') r.url = scrubUrl(r.url);
            if (r.query_string !== undefined) r.query_string = scrubQueryString(r.query_string);
            if (r.headers && typeof r.headers === 'object') scrubHeaders(r.headers);
            if (r.cookies !== undefined) r.cookies = REDACTED;
        }

        if (typeof e.transaction === 'string') e.transaction = scrubUrl(e.transaction);

        if (Array.isArray(e.spans)) {
            for (const span of e.spans) {
                if (!span) continue;
                if (typeof span.description === 'string') span.description = scrubUrl(span.description);
                if (typeof span.name === 'string') span.name = scrubUrl(span.name);
                if (span.data && typeof span.data === 'object') {
                    for (const key of ['url', 'http.url', 'url.full', 'http.query']) {
                        if (typeof span.data[key] === 'string') span.data[key] = scrubUrl(span.data[key]);
                    }
                }
            }
        }

        if (e.contexts?.trace && typeof e.contexts.trace.description === 'string') {
            e.contexts.trace.description = scrubUrl(e.contexts.trace.description);
        }

        if (Array.isArray(e.breadcrumbs)) {
            for (const crumb of e.breadcrumbs) scrubBreadcrumb(crumb);
        }
    } catch {
        // never let scrubbing drop an event
    }
    return event;
}
