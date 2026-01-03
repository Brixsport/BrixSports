import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/matches/[id]/lineup - Get lineup for a match
export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const matchId = params.id;

        const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

        if (!match || match.length === 0) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        const lineups = match[0].lineups ? JSON.parse(match[0].lineups) : null;

        return NextResponse.json({
            success: true,
            lineups,
            matchId,
            status: match[0].status
        });
    } catch (error) {
        console.error('Error fetching lineup:', error);
        return NextResponse.json({ error: 'Failed to fetch lineup' }, { status: 500 });
    }
}

// POST /api/matches/[id]/lineup - Create/update lineup (draft)
export async function POST(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const matchId = params.id;
        const body = await request.json();
        const { team, lineup } = body; // team: 'home' | 'away'

        if (!team || !lineup) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
            return NextResponse.json({ error: 'Cannot edit lineup for live or finished matches' }, { status: 400 });
        }

        // Get existing lineups or create new object
        const existingLineups = match[0].lineups ? JSON.parse(match[0].lineups) : {};

        // Update the specific team's lineup
        existingLineups[team] = {
            ...lineup,
            status: lineup.status || 'draft',
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
            message: 'Lineup saved successfully',
            lineups: existingLineups
        });
    } catch (error) {
        console.error('Error saving lineup:', error);
        return NextResponse.json({ error: 'Failed to save lineup' }, { status: 500 });
    }
}

// DELETE /api/matches/[id]/lineup - Delete lineup
export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const matchId = params.id;
        const { searchParams } = new URL(request.url);
        const team = searchParams.get('team'); // 'home' | 'away'

        if (!team) {
            return NextResponse.json({ error: 'Team parameter required' }, { status: 400 });
        }

        // Get current match
        const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

        if (!match || match.length === 0) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Get existing lineups
        const existingLineups = match[0].lineups ? JSON.parse(match[0].lineups) : {};

        // Delete the specific team's lineup
        delete existingLineups[team];

        // Save back to database
        await db.update(matches)
            .set({
                lineups: JSON.stringify(existingLineups),
                updatedAt: new Date()
            })
            .where(eq(matches.id, matchId));

        return NextResponse.json({
            success: true,
            message: 'Lineup deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting lineup:', error);
        return NextResponse.json({ error: 'Failed to delete lineup' }, { status: 500 });
    }
}
