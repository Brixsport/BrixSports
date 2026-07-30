import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { getMatchConfig } from '@/lib/matchConfig';

// POST /api/matches/[id]/lineup/publish - Publish lineup (lock it)
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin' && authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const userId = authUser.id;
        const userName = authUser.name || authUser.email;
        const userRole = authUser.role;

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

        // Check if lineup is already published (lock mechanism)
        if (existingLineups[team]?.status === 'published' && !existingLineups[team]?.unlocked) {
            return NextResponse.json({
                error: 'Lineup already published and locked',
                code: 'LINEUP_LOCKED',
                publishedBy: existingLineups[team].publishedBy,
                publishedByName: existingLineups[team].publishedByName,
                publishedAt: existingLineups[team].publishedAt,
                message: 'This lineup has already been published. Contact an admin to unlock it for editing.'
            }, { status: 409 }); // 409 Conflict
        }

        if (!existingLineups[team]) {
            return NextResponse.json({ error: 'No lineup found for this team' }, { status: 404 });
        }

        // Validate lineup before publishing
        const lineup = existingLineups[team];

        // Check if lineup has required number of starters — sourced from the same
        // match/competition config chain the rest of the app reads (BACKLOG-178/183),
        // not a hardcoded sport binary. Covers competition-configured formats, 5-a-side
        // and other "N-a-side" friendlies, and falls back to the real sport default.
        const matchConfig = await getMatchConfig(matchId);
        const requiredStarters = matchConfig?.config.playersPerSide ?? (match[0].sport === 'Basketball' ? 5 : 11);
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

        // Update lineup status to published with user info
        existingLineups[team] = {
            ...lineup,
            status: 'published',
            publishedAt: new Date().toISOString(),
            publishedBy: userId,
            publishedByName: userName,
            publishedByRole: userRole,
            unlocked: false, // Lock the lineup
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
            const teamId = team === 'home' ? match[0].homeTeamId : match[0].awayTeamId;
            const otherTeamId = team === 'home' ? match[0].awayTeamId : match[0].homeTeamId;

            await fetch(`${request.url.split('/api')[0]}/api/notifications/match-event`, {
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
        } catch (error) {
            console.error('Failed to send lineup notification:', error);
            // Don't fail the request if notification fails
        }

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
