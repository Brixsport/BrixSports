import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// POST /api/matches/[id]/lineup/unlock - Unlock published lineup (Admin only)
export async function POST(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const matchId = params.id;
        const body = await request.json();
        const { team } = body; // 'home' | 'away'

        // Admin authentication check
        const token = request.headers.get('cookie')?.split('authToken=')[1]?.split(';')[0];

        if (!token) {
            return NextResponse.json(
                { error: 'Unauthorized - No authentication token' },
                { status: 401 }
            );
        }

        let decoded: { id: string; email: string; role: string; name?: string };
        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET || 'your-secret-key-change-in-production'
            ) as { id: string; email: string; role: string; name?: string };

            if (decoded.role !== 'admin') {
                return NextResponse.json(
                    { error: 'Forbidden - Admin access required to unlock lineups' },
                    { status: 403 }
                );
            }
        } catch (error) {
            return NextResponse.json(
                { error: 'Unauthorized - Invalid token' },
                { status: 401 }
            );
        }

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
            unlockedBy: decoded.id,
            unlockedByName: decoded.name || decoded.email,
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
