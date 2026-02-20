import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { matches, competitions } from '@/db/schema';
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

        // Determine required starters from competition's playersPerSide
        let requiredStarters = 11; // default
        if (match[0].competition) {
            const comp = await db.select().from(competitions)
                .where(eq(competitions.name, match[0].competition))
                .limit(1);
            if (comp.length > 0 && comp[0].playersPerSide) {
                requiredStarters = comp[0].playersPerSide;
            }
        }

        // Validate lineup has the correct number of starters
        if (!lineup.starters || lineup.starters.length !== requiredStarters) {
            return NextResponse.json(
                { error: `Lineup must have exactly ${requiredStarters} starters` },
                { status: 400 }
            );
        }

        // Get existing lineups or create new object
        let existingLineups: any = {};
        if (match[0].lineups) {
            try {
                const parsed = JSON.parse(match[0].lineups as string);
                if (parsed && typeof parsed === 'object') {
                    existingLineups = parsed;
                }
            } catch (e) {
                console.error('Error parsing match lineups JSON:', e);
                // Fallback to empty object
            }
        }

        // Update the specific team's lineup
        existingLineups[team] = {
            ...lineup,
            status: 'published',
            publishedBy: user.id,
            publishedByRole: user.role,
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

        // Send push notification for lineup availability
        try {
            const baseUrl = request.nextUrl.origin;
            await fetch(`${baseUrl}/api/notifications/match-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId,
                    homeTeamId: match[0].homeTeamId,
                    awayTeamId: match[0].awayTeamId,
                    eventType: 'LINEUP_AVAILABLE',
                    teamName: team === 'home' ? 'Home team' : 'Away team',
                }),
            });
            console.log('✅ Lineup available notification sent');
        } catch (notifError) {
            console.error('Failed to send lineup notification:', notifError);
            // Don't fail the request if notification fails
        }

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
