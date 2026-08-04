import { NextRequest, NextResponse } from 'next/server';
import { getMatchConfig } from '@/lib/matchConfig';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const result = await getMatchConfig(id);

        if (!result) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        return NextResponse.json({ config: result.config, matchId: result.matchId, sport: result.sport });
    } catch (err) {
        console.error('[match-config] Error:', err);
        return NextResponse.json({ error: 'Failed to load match config' }, { status: 500 });
    }
}
