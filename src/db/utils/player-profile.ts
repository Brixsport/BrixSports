import { db } from '../index';
import { players } from '../schema';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class LinkProfileError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

/**
 * Helper to get or create a profile ID for a player.
 * 
 * Strategy:
 * 1. If email is provided, checking if any existing player has that email.
 * 2. If match found, return their profileId.
 * 3. If no match (or no email), generate a new profileId.
 * 
 * @param email Optional email to match against existing records
 * @returns Promise<string> The profile ID to use
 */
export async function getPlayerProfileId(email?: string): Promise<string> {
    // If no email provided, we can't link, so generate new ID
    if (!email) {
        return nanoid();
    }

    try {
        // Check for existing player with this email
        // We only need one match to get the profileId
        const existingPlayer = await db.query.players.findFirst({
            where: eq(players.email, email),
            columns: {
                profileId: true
            }
        });

        if (existingPlayer && existingPlayer.profileId) {
            console.log(`   🔗 Found existing profile for ${email}`);
            return existingPlayer.profileId;
        }
    } catch (error) {
        console.warn('Error checking for existing profile:', error);
        // Fallback to new ID on error
    }

    // No match found, generate new ID
    return nanoid();
}

/**
 * BACKLOG-120: admin-facing "link these two player rows as the same
 * multi-sport athlete" action -- independent of the email-match path above,
 * which is structurally unreachable for backfill-created players (no email).
 *
 * Reuses either row's existing profileId if exactly one has one; generates a
 * fresh one via nanoid() if neither does; is idempotent if both already
 * share the same one. Refuses to silently overwrite two DIFFERENT existing
 * profileIds -- that's a real duplicate-identity merge (re-pointing
 * matchEvents/playerStats/etc to one canonical row), a bigger, destructive
 * operation tracked separately as BACKLOG-042, not this action's job.
 */
export async function linkPlayerProfiles(playerId1: string, playerId2: string): Promise<{ profileId: string }> {
    if (playerId1 === playerId2) {
        throw new LinkProfileError('Cannot link a player to themselves', 422);
    }

    let rows: { id: string; profileId: string | null }[];
    try {
        rows = await db
            .select({ id: players.id, profileId: players.profileId })
            .from(players)
            .where(inArray(players.id, [playerId1, playerId2]));
    } catch (error) {
        console.error('Error reading players for profile link:', error);
        throw new LinkProfileError('Failed to look up players', 500);
    }

    const player1 = rows.find((r) => r.id === playerId1);
    const player2 = rows.find((r) => r.id === playerId2);
    if (!player1 || !player2) {
        throw new LinkProfileError('One or both players were not found', 404);
    }

    if (player1.profileId && player2.profileId) {
        if (player1.profileId === player2.profileId) {
            return { profileId: player1.profileId }; // already linked -- no-op
        }
        throw new LinkProfileError(
            'Both players already belong to different profiles. This looks like a duplicate-identity merge, not a link -- see BACKLOG-042.',
            409
        );
    }

    const profileId = player1.profileId || player2.profileId || nanoid();

    try {
        await db.transaction(async (tx) => {
            await tx.update(players).set({ profileId }).where(inArray(players.id, [playerId1, playerId2]));
        });
    } catch (error) {
        console.error('Error writing profile link:', error);
        throw new LinkProfileError('Failed to link player profiles', 500);
    }

    return { profileId };
}
