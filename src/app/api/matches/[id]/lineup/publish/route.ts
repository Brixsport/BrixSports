import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { eq } from 'drizzle-orm';

// POST /api/matches/[id]/lineup/publish - Publish lineup (lock it)
export async function POST(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
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

        // Check if match has started
        if (match[0].status === 'LIVE' || match[0].status === 'FINISHED') {
            return NextResponse.json({ error: 'Cannot publish lineup for live or finished matches' }, { status: 400 });
        }

        // Get existing lineups
        const existingLineups = match[0].lineups ? JSON.parse(match[0].lineups) : {};

        if (!existingLineups[team]) {
            return NextResponse.json({ error: 'No lineup found for this team' }, { status: 404 });
        }

        // Validate lineup before publishing
        const lineup = existingLineups[team];

        // Check if lineup has required number of starters
        const requiredStarters = match[0].sport === 'Basketball' ? 5 : 11;
        if (!lineup.starters || lineup.starters.length !== requiredStarters) {
            return NextResponse.json({
                error: `Lineup must have exactly ${requiredStarters} starters`
            }, { status: 400 });
        }

        // Check for captain
        const hasCaptain = lineup.starters.some((p: any) => p.isCaptain);
        if (!hasCaptain) {
            return NextResponse.json({ error: 'Lineup must have a captain' }, { status: 400 });
        }

        // Update lineup status to published
        existingLineups[team] = {
            ...lineup,
            status: 'published',
            publishedAt: new Date().toISOString(),
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
            message: 'Lineup published successfully',
            lineups: existingLineups
        });
    } catch (error) {
        console.error('Error publishing lineup:', error);
        return NextResponse.json({ error: 'Failed to publish lineup' }, { status: 500 });
    }
}
