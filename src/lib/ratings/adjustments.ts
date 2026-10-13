// Helpers for the post-match rating adjustment flow. Pure, so the admin page and
// the adjust endpoint apply the same rules.

export const MAX_ADJUSTMENT_NOTES_LENGTH = 500;

// Ratings move in 0.1 steps, so anything closer than this is the same rating.
const RATING_EPSILON = 0.005;

export interface StoredRating {
    autoRating: number;
    finalRating: number | null;
    adjustmentNotes: string | null;
    isMotM: boolean | null;
}

export interface SubmittedAdjustment {
    playerId: string;
    finalRating: number;
    notes?: string | null;
    isMotM?: boolean | null;
}

/**
 * True when a submitted adjustment would change nothing about the stored rating.
 * The rating shown to an admin is the final rating when there is one, otherwise
 * the automatic rating, so that is what a submitted value is compared against.
 */
export function isUnchangedAdjustment(stored: StoredRating, submitted: SubmittedAdjustment): boolean {
    if (typeof submitted.finalRating !== 'number' || !Number.isFinite(submitted.finalRating)) return false;

    const shownRating = stored.finalRating ?? stored.autoRating;
    if (Math.abs(submitted.finalRating - shownRating) >= RATING_EPSILON) return false;

    const storedNotes = stored.adjustmentNotes ?? '';
    const submittedNotes = typeof submitted.notes === 'string' ? submitted.notes : '';
    if (storedNotes !== submittedNotes) return false;

    return Boolean(stored.isMotM) === (submitted.isMotM === true);
}

/** Keeps only the submitted adjustments that differ from what is stored. */
export function selectChangedAdjustments<T extends SubmittedAdjustment>(
    submitted: T[],
    storedByPlayerId: Map<string, StoredRating>
): T[] {
    return submitted.filter((adjustment) => {
        const stored = storedByPlayerId.get(adjustment.playerId);
        return !stored || !isUnchangedAdjustment(stored, adjustment);
    });
}

export type NotesResult = { ok: true; value: string | null } | { ok: false; error: string };

/** Notes are optional free text, capped so a client cannot store arbitrary amounts. */
export function normalizeAdjustmentNotes(notes: unknown): NotesResult {
    if (notes === undefined || notes === null || notes === '') return { ok: true, value: null };
    if (typeof notes !== 'string') return { ok: false, error: 'Notes must be text' };
    if (notes.length > MAX_ADJUSTMENT_NOTES_LENGTH) {
        return { ok: false, error: `Notes must be ${MAX_ADJUSTMENT_NOTES_LENGTH} characters or fewer` };
    }
    return { ok: true, value: notes };
}
