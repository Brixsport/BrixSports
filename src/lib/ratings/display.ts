// A player with no rating yet must render as "not rated", never as 0.0. Missing
// ratings arrive as null, undefined or 0 depending on the source, so anything that
// is not a positive finite number is treated as not rated.
export function ratingOrUndefined(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}
