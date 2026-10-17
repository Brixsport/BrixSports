import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { linkPlayerProfiles, LinkProfileError } from '@/db/utils/player-profile';

// BACKLOG-120: admin action to link two existing player rows as the same
// multi-sport athlete, independent of the email-match write path. Thin
// handler -- logic lives in linkPlayerProfiles() (same extraction pattern as
// transferPlayerToTeam() in rosterService.ts).
export async function POST(request: NextRequest) {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { playerId1?: string; playerId2?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });
    }

    if (!body.playerId1 || !body.playerId2) {
        return NextResponse.json({ error: 'playerId1 and playerId2 are required' }, { status: 422 });
    }

    try {
        const result = await linkPlayerProfiles(body.playerId1, body.playerId2);
        return NextResponse.json({ success: true, profileId: result.profileId });
    } catch (error) {
        if (error instanceof LinkProfileError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('Error linking player profiles:', error);
        return NextResponse.json({ error: 'Failed to link player profiles' }, { status: 500 });
    }
}
