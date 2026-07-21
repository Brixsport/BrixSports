import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, competitionSportSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Sport-level hardcoded defaults — fallback of last resort
const SPORT_DEFAULTS: Record<string, {
    maxSubstitutions: number | null;
    allowSubbedOutReentry: boolean;
    extraTimeEnabled: boolean;
    penaltiesEnabled: boolean;
    allowDraws: boolean;
    pointsForWin: number;
    pointsForDraw: number;
    // minutes per period. Named for football's 2-half model, reused as one quarter's
    // length for basketball -- deliberately not renamed to periodDuration (schema.ts's
    // competition_sport_settings.halfDuration is a live prod column; renaming costs a
    // SQL-direct migration for a naming-clarity-only change under BACKLOG-040's
    // db:push block). See the TD entry in BACKLOG.md for the "revisit if Track's model
    // needs a different shape" trigger.
    halfDuration: number;
    playersPerSide: number;
    periodCount: number; // 2 halves (football) | 4 quarters (basketball)
    substitutionModel: 'capped' | 'unlimited'; // documents whether maxSubstitutions is an enforced cap or a non-decision
    // Basketball-only — not read by the football code path
    overtimeDurationMinutes?: number;
    foulDisqualifyAt?: number;
    teamFoulBonusAt?: number;
    technicalFoulValue?: number;
    shotClockEnabled?: boolean;
    shotClockSeconds?: number;
}> = {
    football: {
        maxSubstitutions: 5,
        allowSubbedOutReentry: false,
        extraTimeEnabled: false,
        penaltiesEnabled: false,
        allowDraws: true,
        pointsForWin: 3,
        pointsForDraw: 1,
        halfDuration: 45,
        playersPerSide: 11,
        periodCount: 2,
        substitutionModel: 'capped',
    },
    basketball: {
        maxSubstitutions: null,
        allowSubbedOutReentry: true,
        extraTimeEnabled: true,
        penaltiesEnabled: false,
        allowDraws: false,
        pointsForWin: 2,
        pointsForDraw: 0,
        halfDuration: 10, // quarter length in minutes, not half length -- see the field comment above
        playersPerSide: 5,
        periodCount: 4,
        substitutionModel: 'unlimited',
        // BUSA/grassroots convention assumed FIBA-style — not confirmed against an official
        // BUSA basketball rulebook. Nothing in this codebase enforces these yet (no
        // disqualification check, no team-foul-bonus logic, no shot clock) — they exist
        // here so the values are documented in one place whenever that gets built, rather
        // than guessed again from scratch. Flag to Richard if BUSA's actual convention differs.
        overtimeDurationMinutes: 5,
        foulDisqualifyAt: 5,
        teamFoulBonusAt: 5,
        technicalFoulValue: 2,
        shotClockEnabled: false,
        shotClockSeconds: 24,
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
        const halfDuration = compSettings?.halfDuration ?? sportDefaults.halfDuration;
        const periodCount = sportDefaults.periodCount;
        const config = {
            halfDuration,
            periodDurationMinutes: halfDuration, // same value, clearer name for non-football consumers
            periodCount,
            matchDuration: halfDuration * periodCount,
            playersPerSide: compSettings?.playersPerSide ?? sportDefaults.playersPerSide,
            maxSubstitutions: compSettings?.maxSubstitutions ?? sportDefaults.maxSubstitutions,
            substitutionModel: sportDefaults.substitutionModel,
            allowSubbedOutReentry: compSettings?.allowSubbedOutReentry ?? sportDefaults.allowSubbedOutReentry,
            extraTimeEnabled: match.extraTimeEnabledOverride ?? compSettings?.extraTimeEnabled ?? sportDefaults.extraTimeEnabled,
            penaltiesEnabled: match.penaltiesEnabledOverride ?? compSettings?.penaltiesEnabled ?? sportDefaults.penaltiesEnabled,
            allowDraws: match.allowDrawsOverride ?? compSettings?.allowDraws ?? sportDefaults.allowDraws,
            pointsForWin: compSettings?.pointsForWin ?? sportDefaults.pointsForWin,
            pointsForDraw: compSettings?.pointsForDraw ?? sportDefaults.pointsForDraw,
            // Basketball-only fields — undefined for football, harmless since nothing reads them there
            overtimeDurationMinutes: sportDefaults.overtimeDurationMinutes,
            foulDisqualifyAt: sportDefaults.foulDisqualifyAt,
            teamFoulBonusAt: sportDefaults.teamFoulBonusAt,
            technicalFoulValue: sportDefaults.technicalFoulValue,
            shotClockEnabled: sportDefaults.shotClockEnabled,
            shotClockSeconds: sportDefaults.shotClockSeconds,
        };

        return NextResponse.json({ config, matchId: match.id, sport });
    } catch (err) {
        console.error('[match-config] Error:', err);
        return NextResponse.json({ error: 'Failed to load match config' }, { status: 500 });
    }
}
