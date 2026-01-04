import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { eq } from 'drizzle-orm';

// POST /api/admin/match-lineups/[id] - Publish official lineup
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);

        if (!user || (user.role !== 'admin' && user.role !== 'logger')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            );
        }

        const params = await props.params;
        const matchId = params.id;
        const body = await request.json();
        const { team, lineup } = body;

        if (!team || !lineup) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (team !== 'home' && team !== 'away') {
            return NextResponse.json(
                { error: 'Invalid team value' },
                { status: 400 }
            );
        }

        // Get current match
        const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

        if (!match || match.length === 0) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Check if match has finished
        if (match[0].status === 'FINISHED') {
            return NextResponse.json(
                { error: 'Cannot edit lineup for finished matches' },
                { status: 400 }
            );
        }

        // If logger, verify they're assigned to this match
        if (user.role === 'logger' && match[0].loggerId !== user.id) {
            return NextResponse.json(
                { error: 'Not assigned to this match' },
                { status: 403 }
            );
        }

        // Validate lineup has 11 starters
        if (!lineup.starters || lineup.starters.length !== 11) {
            return NextResponse.json(
                { error: 'Lineup must have exactly 11 starters' },
                { status: 400 }
            );
        }

        // Get existing lineups or create new object
        const existingLineups = match[0].lineups ? JSON.parse(match[0].lineups) : {};

        // Update the specific team's lineup
        existingLineups[team] = {
            ...lineup,
            status: 'published',
            publishedBy: user.id,
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
            message: 'Official lineup published successfully',
            lineups: existingLineups
        });
    } catch (error) {
        console.error('Error publishing lineup:', error);
        return NextResponse.json(
            { error: 'Failed to publish lineup' },
            { status: 500 }
        );
    }
}
