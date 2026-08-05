/**
 * Sentinel "anonymous" user row that anonymous push subscriptions point their
 * userId FK at, per BACKLOG-150 -- see schema.ts's pushSubscriptions comment
 * for why this exists instead of a nullable userId column.
 */
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const ANONYMOUS_PUSH_USER_ID = 'anonymous-push-subscriber';

export async function ensureAnonymousPushUser(): Promise<void> {
    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, ANONYMOUS_PUSH_USER_ID))
        .limit(1);

    if (existing.length === 0) {
        await db.insert(users).values({
            id: ANONYMOUS_PUSH_USER_ID,
            email: 'anonymous-push-subscriber@brixsports.internal',
            name: 'Anonymous Push Subscriber',
            role: 'anonymous',
        });
    }
}
