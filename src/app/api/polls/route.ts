import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { polls, pollVotes, matches, teams } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// GET /api/polls?matchId=xxx - Get polls for a match
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const matchId = searchParams.get('matchId');
        const pollId = searchParams.get('pollId');

        if (pollId) {
            // Get specific poll with vote counts
            const poll = await db.select().from(polls).where(eq(polls.id, pollId)).get();

            if (!poll) {
                return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
            }

            // Get vote counts for each option
            const votes = await db.select().from(pollVotes).where(eq(pollVotes.pollId, pollId));

            const options = JSON.parse(poll.options);
            const voteCounts = options.map((option: any) => ({
                ...option,
                votes: votes.filter(v => v.optionId === option.id).length,
            }));

            return NextResponse.json({
                ...poll,
                options: voteCounts,
            });
        }

        if (matchId) {
            // Get all polls for a match
            const matchPolls = await db
                .select()
                .from(polls)
                .where(eq(polls.matchId, matchId))
                .orderBy(desc(polls.createdAt));

            // Get vote counts for each poll
            const pollsWithVotes = await Promise.all(
                matchPolls.map(async (poll) => {
                    const votes = await db.select().from(pollVotes).where(eq(pollVotes.pollId, poll.id));

                    const options = JSON.parse(poll.options);
                    const voteCounts = options.map((option: any) => ({
                        ...option,
                        votes: votes.filter(v => v.optionId === option.id).length,
                    }));

                    return {
                        ...poll,
                        options: voteCounts,
                    };
                })
            );

            return NextResponse.json(pollsWithVotes);
        }

        return NextResponse.json({ error: 'matchId or pollId required' }, { status: 400 });
    } catch (error) {
        console.error('Error fetching polls:', error);
        return NextResponse.json({ error: 'Failed to fetch polls' }, { status: 500 });
    }
}

// POST /api/polls - Create a new poll
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { matchId, question, pollType, options, endsAt, createdBy } = body;

        if (!matchId || !question || !options || !Array.isArray(options)) {
            return NextResponse.json(
                { error: 'matchId, question, and options are required' },
                { status: 400 }
            );
        }

        // Verify match exists
        const match = await db.select().from(matches).where(eq(matches.id, matchId)).get();
        if (!match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // For match_winner polls, auto-generate options from teams
        let pollOptions = options;
        if (pollType === 'match_winner' && options.length === 0) {
            const homeTeam = await db.select().from(teams).where(eq(teams.id, match.homeTeamId)).get();
            const awayTeam = await db.select().from(teams).where(eq(teams.id, match.awayTeamId)).get();

            pollOptions = [
                { id: nanoid(), label: homeTeam?.name || 'Home Team', teamId: match.homeTeamId },
                { id: nanoid(), label: awayTeam?.name || 'Away Team', teamId: match.awayTeamId },
                { id: nanoid(), label: 'Draw', teamId: null },
            ];
        } else {
            // Ensure each option has an ID
            pollOptions = options.map((opt: any) => ({
                ...opt,
                id: opt.id || nanoid(),
            }));
        }

        const pollId = nanoid();
        const newPoll = {
            id: pollId,
            matchId,
            question,
            pollType: pollType || 'match_winner',
            options: JSON.stringify(pollOptions),
            status: 'active',
            totalVotes: 0,
            endsAt: endsAt ? new Date(endsAt) : null,
            createdBy: createdBy || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.insert(polls).values(newPoll);

        return NextResponse.json({
            ...newPoll,
            options: pollOptions,
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating poll:', error);
        return NextResponse.json({ error: 'Failed to create poll' }, { status: 500 });
    }
}

// PATCH /api/polls - Update poll status
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { pollId, status } = body;

        if (!pollId || !status) {
            return NextResponse.json(
                { error: 'pollId and status are required' },
                { status: 400 }
            );
        }

        await db
            .update(polls)
            .set({ status, updatedAt: new Date() })
            .where(eq(polls.id, pollId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating poll:', error);
        return NextResponse.json({ error: 'Failed to update poll' }, { status: 500 });
    }
}
