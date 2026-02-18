import { db } from '../index';
import { players } from '../schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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
