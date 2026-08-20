import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { transferPlayerToTeam, TransferError } from '@/lib/rosterService';

// BACKLOG-126 step 5: minimal admin roster transfer — pick player, pick new team,
// confirm. Core logic lives in rosterService.ts (transferPlayerToTeam), same
// extraction pattern as standingsService.ts / ratingsService.ts.
export async function POST(
    request: NextRequest,
    { params }: { params: { playerId: string } },
) {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { playerId } = params;

    let body: { newTeamId?: string; jerseyNumber?: number; position?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });
    }

    if (!body.newTeamId) {
        return NextResponse.json({ error: 'newTeamId is required' }, { status: 422 });
    }

    try {
        const result = await transferPlayerToTeam(playerId, body.newTeamId, {
            jerseyNumber: body.jerseyNumber,
            position: body.position,
        });
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof TransferError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('Error transferring player:', error);
        return NextResponse.json({ error: 'Failed to transfer player' }, { status: 500 });
    }
}
