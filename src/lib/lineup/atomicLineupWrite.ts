import { db } from '@/db';
import { matches } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export type MatchLineupsBlob = Record<string, any>;

interface AtomicWriteResult {
    ok: boolean;
    lineups: MatchLineupsBlob;
}

/**
 * Compare-and-swap update of matches.lineups. BACKLOG-220: every write route
 * for this column did a plain read -> in-memory merge -> full-column
 * overwrite with no guard, so two concurrent writers (e.g. publishing home
 * and away lineups at once, now the normal case post-BACKLOG-323) can race --
 * the second UPDATE silently clobbers whatever the first one just wrote,
 * dropping that write entirely rather than erroring.
 *
 * Guarding the final UPDATE's WHERE clause on the exact raw column value read
 * at the top of the request makes the write a no-op (0 rows affected) if
 * anything changed the row in between, instead of blindly overwriting.
 * Callers should treat `ok: false` as a 409 and let the client retry against
 * fresh data -- this only detects the race, it doesn't attempt to merge.
 *
 * `next` is the caller's already-computed new blob (built from its own read
 * of the same raw value passed here) -- this function doesn't re-derive it,
 * it only guards the write.
 */
export async function writeMatchLineupsAtomic(
    matchId: string,
    rawLineupsAtRead: string | null,
    next: MatchLineupsBlob,
): Promise<AtomicWriteResult> {
    const result = await db.update(matches)
        .set({ lineups: JSON.stringify(next), updatedAt: new Date() })
        .where(and(
            eq(matches.id, matchId),
            rawLineupsAtRead === null ? isNull(matches.lineups) : eq(matches.lineups, rawLineupsAtRead),
        ))
        .returning({ id: matches.id });

    return { ok: result.length > 0, lineups: next };
}

export const CONCURRENT_MODIFICATION_RESPONSE = {
    error: 'This lineup was changed by someone else at the same time. Reload and try again.',
    code: 'CONCURRENT_MODIFICATION',
} as const;
