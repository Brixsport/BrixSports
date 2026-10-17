/**
 * match_events.value is a TEXT column, not guaranteed to hold valid JSON.
 * Live-logged events store real JSON (numbers, objects); basketball box-score
 * events backfilled via bulk import store a raw unquoted string (e.g. `made`) --
 * BACKLOG-312. JSON.parse throws on that shape. Never JSON.parse this column
 * directly; always go through this so a malformed row degrades to its raw
 * string instead of 500ing the caller.
 */
export function safeParseEventValue(raw: string | null | undefined): unknown {
    if (raw == null || raw === '') return null;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}
