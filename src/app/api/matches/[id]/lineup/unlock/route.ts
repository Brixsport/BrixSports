import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

// POST /api/matches/[id]/lineup/unlock - Unlock published lineup (Admin only)
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        // BACKLOG-168: was a hand-rolled jwt.verify() against the raw token role
        // claim -- a demoted/deactivated admin's already-issued token kept working
        // here for its full lifetime since it never re-checked the current DB row.
        // getAuthUser() re-reads the user's current role on every request, same
        // pattern used at 90+ other admin-gated call sites in this codebase.
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized - No authentication token' },
                { status: 401 }
            );
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required to unlock lineups' },
                { status: 403 }
            );
        }
        const params = await props.params;
        const matchId = params.id;
        const body = await request.json();
        const { team } = body; // 'home' | 'away'

        if (!team) {
            return NextResponse.json({ error: 'Team parameter required' }, { status: 400 });
        }

        if (team !== 'home' && team !== 'away') {
            return NextResponse.json({ error: 'Invalid team value' }, { status: 400 });
        }

        // Get current match
        const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

        if (!match || match.length === 0) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Get existing lineups
        const existingLineups = match[0].lineups ? JSON.parse(match[0].lineups) : {};

        if (!existingLineups[team]) {
            return NextResponse.json({ error: 'No lineup found for this team' }, { status: 404 });
        }

        if (existingLineups[team].status !== 'published') {
            return NextResponse.json({ error: 'Lineup is not published' }, { status: 400 });
        }

        // Unlock the lineup
        existingLineups[team] = {
            ...existingLineups[team],
            unlocked: true,
            unlockedBy: authUser.id,
            unlockedByName: authUser.name || authUser.email,
            unlockedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save back to database
        await db.update(matches)
            .set({
                lineups: JSON.stringify(existingLineups),
                updatedAt: new Date()
            })
            .where(eq(matches.id, matchId));

        return NextResponse.json({
            success: true,
            message: 'Lineup unlocked successfully. It can now be edited and republished.',
            lineups: existingLineups
        });
    } catch (error) {
        console.error('Error unlocking lineup:', error);
        return NextResponse.json({ error: 'Failed to unlock lineup' }, { status: 500 });
    }
}
