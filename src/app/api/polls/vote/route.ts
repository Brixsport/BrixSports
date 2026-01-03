import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { polls, pollVotes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// POST /api/polls/vote - Submit a vote
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pollId, optionId, userId } = body;

        if (!pollId || !optionId) {
            return NextResponse.json(
                { error: 'pollId and optionId are required' },
                { status: 400 }
            );
        }

        // Get poll
        const poll = await db.select().from(polls).where(eq(polls.id, pollId)).get();

        if (!poll) {
            return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
        }

        // Check if poll is still active
        if (poll.status !== 'active') {
            return NextResponse.json({ error: 'Poll is closed' }, { status: 400 });
        }

        // Check if poll has ended
        if (poll.endsAt && new Date(poll.endsAt) < new Date()) {
            // Auto-close the poll
            await db
                .update(polls)
                .set({ status: 'closed', updatedAt: new Date() })
                .where(eq(polls.id, pollId));

            return NextResponse.json({ error: 'Poll has ended' }, { status: 400 });
        }

        // Verify option exists
        const options = JSON.parse(poll.options);
        const optionExists = options.some((opt: any) => opt.id === optionId);

        if (!optionExists) {
            return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
        }

        // Check if user has already voted
        let existingVote;
        if (userId) {
            existingVote = await db
                .select()
                .from(pollVotes)
                .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)))
                .get();
        } else {
            // For anonymous users, check by IP
            const ipAddress = request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                'unknown';

            existingVote = await db
                .select()
                .from(pollVotes)
                .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.ipAddress, ipAddress)))
                .get();
        }

        if (existingVote) {
            // Update existing vote
            await db
                .update(pollVotes)
                .set({ optionId, createdAt: new Date() })
                .where(eq(pollVotes.id, existingVote.id));

            return NextResponse.json({
                success: true,
                message: 'Vote updated',
                voteId: existingVote.id
            });
        }

        // Create new vote
        const voteId = nanoid();
        const ipAddress = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        await db.insert(pollVotes).values({
            id: voteId,
            pollId,
            userId: userId || null,
            optionId,
            ipAddress,
            userAgent,
            createdAt: new Date(),
        });

        // Update total votes count
        const totalVotes = await db.select().from(pollVotes).where(eq(pollVotes.pollId, pollId));
        await db
            .update(polls)
            .set({ totalVotes: totalVotes.length, updatedAt: new Date() })
            .where(eq(polls.id, pollId));

        return NextResponse.json({
            success: true,
            message: 'Vote recorded',
            voteId
        }, { status: 201 });
    } catch (error) {
        console.error('Error submitting vote:', error);
        return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
    }
}

// GET /api/polls/vote?pollId=xxx&userId=xxx - Check if user has voted
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const pollId = searchParams.get('pollId');
        const userId = searchParams.get('userId');

        if (!pollId) {
            return NextResponse.json({ error: 'pollId is required' }, { status: 400 });
        }

        let vote;
        if (userId) {
            vote = await db
                .select()
                .from(pollVotes)
                .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)))
                .get();
        } else {
            // Check by IP for anonymous users
            const ipAddress = request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                'unknown';

            vote = await db
                .select()
                .from(pollVotes)
                .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.ipAddress, ipAddress)))
                .get();
        }

        return NextResponse.json({
            hasVoted: !!vote,
            vote: vote || null
        });
    } catch (error) {
        console.error('Error checking vote:', error);
        return NextResponse.json({ error: 'Failed to check vote' }, { status: 500 });
    }
}
