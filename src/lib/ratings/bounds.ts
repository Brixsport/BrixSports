// An admin-edited rating range is only usable when the minimum is below the
// maximum. Otherwise every rating would clamp to one value and no adjustment
// could validate, so the fallback range is used instead.
export function resolveRatingBounds(
    minRating: number,
    maxRating: number,
    fallback: { minRating: number; maxRating: number }
): { minRating: number; maxRating: number } {
    if (Number.isFinite(minRating) && Number.isFinite(maxRating) && minRating < maxRating) {
        return { minRating, maxRating };
    }
    return { minRating: fallback.minRating, maxRating: fallback.maxRating };
}
