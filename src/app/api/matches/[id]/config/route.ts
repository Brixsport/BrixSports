import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, competitionSportSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Sport-level hardcoded defaults — fallback of last resort
const SPORT_DEFAULTS: Record<string, {
    maxSubstitutions: number | null;
    allowSubbedOutReentry: boolean;
    extraTimeEnabled: boolean;
    extraTimeDuration: number;
    penaltiesEnabled: boolean;
    allowDraws: boolean;
    pointsForWin: number;
    pointsForDraw: number;
    matchDuration: number;
    halfDuration: number;
    playersPerSide: number;
}> = {
    football: {
        maxSubstitutions: 5,
        allowSubbedOutReentry: false,
        extraTimeEnabled: false,
        extraTimeDuration: 15,
        penaltiesEnabled: false,
        allowDraws: true,
        pointsForWin: 3,
        pointsForDraw: 1,
        matchDuration: 90,
        halfDuration: 45,
        playersPerSide: 11,
    },
    basketball: {
        maxSubstitutions: null,
        allowSubbedOutReentry: true,
        extraTimeEnabled: true,
        extraTimeDuration: 5,
        penaltiesEnabled: false,
        allowDraws: false,
        pointsForWin: 2,
        pointsForDraw: 0,
        matchDuration: 40,
        halfDuration: 10,
        playersPerSide: 5,
    },
};

const DEFAULT_FALLBACK = SPORT_DEFAULTS['football'];

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, params.id))
            .limit(1)
            .then(r => r[0] ?? null);

        if (!match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Fetch competition sport settings separately (no relation on matchesRelations)
        const compSettings = match.competitionId
            ? await db
                .select()
                .from(competitionSportSettings)
                .where(eq(competitionSportSettings.competitionId, match.competitionId))
                .limit(1)
                .then(r => r[0] ?? null)
            : null;

        const sport = (match.sport ?? 'Football').toLowerCase();
        const sportDefaults = SPORT_DEFAULTS[sport] ?? DEFAULT_FALLBACK;

        // Three-layer merge: match override → competition setting → sport default
        const config = {
            matchDuration: compSettings?.matchDuration ?? sportDefaults.matchDuration,
            halfDuration: compSettings?.halfDuration ?? sportDefaults.halfDuration,
            playersPerSide: compSettings?.playersPerSide ?? sportDefaults.playersPerSide,
            maxSubstitutions: compSettings?.maxSubstitutions ?? sportDefaults.maxSubstitutions,
            allowSubbedOutReentry: compSettings?.allowSubbedOutReentry ?? sportDefaults.allowSubbedOutReentry,
            extraTimeEnabled: match.extraTimeEnabledOverride ?? compSettings?.extraTimeEnabled ?? sportDefaults.extraTimeEnabled,
            extraTimeDuration: compSettings?.extraTimeDuration ?? sportDefaults.extraTimeDuration,
            penaltiesEnabled: match.penaltiesEnabledOverride ?? compSettings?.penaltiesEnabled ?? sportDefaults.penaltiesEnabled,
            allowDraws: match.allowDrawsOverride ?? compSettings?.allowDraws ?? sportDefaults.allowDraws,
            pointsForWin: compSettings?.pointsForWin ?? sportDefaults.pointsForWin,
            pointsForDraw: compSettings?.pointsForDraw ?? sportDefaults.pointsForDraw,
        };

        return NextResponse.json({ config, matchId: match.id, sport });
    } catch (err) {
        console.error('[match-config] Error:', err);
        return NextResponse.json({ error: 'Failed to load match config' }, { status: 500 });
    }
}
