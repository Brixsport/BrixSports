import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffComms, users } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const matchId = searchParams.get('matchId');

        if (!matchId) {
            return NextResponse.json({ error: 'Match ID is required' }, { status: 400 });
        }

        const comms = await db
            .select({
                id: staffComms.id,
                matchId: staffComms.matchId,
                content: staffComms.content,
                type: staffComms.type,
                priority: staffComms.priority,
                isRead: staffComms.isRead,
                createdAt: staffComms.createdAt,
                user: {
                    id: users.id,
                    name: users.name,
                    role: users.role,
                    avatar: users.avatar
                }
            })
            .from(staffComms)
            .leftJoin(users, eq(staffComms.userId, users.id))
            .where(eq(staffComms.matchId, matchId))
            .orderBy(desc(staffComms.createdAt));

        return NextResponse.json(comms);
    } catch (error) {
        console.error('Error fetching staff comms:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { matchId, userId, content, type, priority } = body;

        if (!matchId || !userId || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newComm = {
            id: uuidv4(),
            matchId,
            userId,
            content,
            type: type || 'note',
            priority: priority || 'normal',
            isRead: false,
            createdAt: new Date()
        };

        await db.insert(staffComms).values(newComm);

        return NextResponse.json({ success: true, message: 'Message sent' });
    } catch (error) {
        console.error('Error creating staff comm:', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}
