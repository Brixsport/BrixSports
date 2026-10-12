// Clamped limit/offset parsing for list endpoints. Garbage, zero or negative input falls back to
// the default, and a request can never ask for more than maxLimit rows.
export function parseListPaging(
    searchParams: URLSearchParams,
    { defaultLimit, maxLimit }: { defaultLimit: number; maxLimit: number }
) {
    const rawLimit = parseInt(searchParams.get('limit') ?? '', 10);
    const rawOffset = parseInt(searchParams.get('offset') ?? '', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, maxLimit) : defaultLimit;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
    return { limit, offset };
}
