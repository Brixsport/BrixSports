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
    halfDuration: number;
    playersPerSide: number;
    periodCount: number;
    substitutionModel: 'capped' | 'unlimited';
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
        halfDuration: 10,
        playersPerSide: 5,
        periodCount: 4,
        substitutionModel: 'unlimited',
        overtimeDurationMinutes: 5,
        foulDisqualifyAt: 5,
        teamFoulBonusAt: 5,
        technicalFoulValue: 2,
        shotClockEnabled: false,
        shotClockSeconds: 24,
    },
};

const DEFAULT_FALLBACK = SPORT_DEFAULTS['football'];

// Mirrors FootballLogger.tsx's own client-side `is5Aside` heuristic (sport/competition
// keyword matching) so a friendly match — which typically has no competitionId and
// therefore no competitionSportSettings row to read playersPerSide from — still resolves
// its real format instead of silently falling back to football's 11-a-side sport default.
// Generalized beyond just "5-a-side": parses any "N-a-side"/"N a side" pattern out of the
// sport/competition text, so a custom format (7-a-side, 9-a-side, ...) on a friendly with
// no competitionId also resolves correctly, not just the one literal case.
// BACKLOG-178/183: this is the one server-side source both the lineup-publish route and
// the admin lineup-builder UI read from, replacing two independent, drifting copies.
function detectPlayersPerSideFromText(sportRaw: string, competitionRaw: string | null): number | null {
    const text = `${sportRaw || ''} ${competitionRaw || ''}`.toLowerCase();
    const numericMatch = text.match(/(\d{1,2})[\s-]?a[\s-]?side/);
    if (numericMatch) {
        const n = parseInt(numericMatch[1], 10);
        if (n > 0 && n <= 11) return n;
    }
    if (text.includes('futsal') || text.includes('npuga')) return 5;
    return null;
}

export async function getMatchConfig(matchId: string) {
    const match = await db
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1)
        .then(r => r[0] ?? null);

    if (!match) return null;

    const sport = (match.sport ?? 'Football').toLowerCase();

    const compSettingsRows = match.competitionId
        ? await db
            .select()
            .from(competitionSportSettings)
            .where(eq(competitionSportSettings.competitionId, match.competitionId))
            .limit(20)
        : [];
    const sportKeyword = sport.includes('basketball') ? 'basketball' : sport.includes('football') ? 'football' : sport;
    const compSettings = compSettingsRows.find(r => r.sport?.toLowerCase().includes(sportKeyword)) ?? null;
    const sportDefaults = SPORT_DEFAULTS[sport] ?? DEFAULT_FALLBACK;

    const textDetectedPlayersPerSide = sport.includes('football') && !compSettings?.playersPerSide
        ? detectPlayersPerSideFromText(match.sport, match.competition)
        : null;

    const halfDuration = compSettings?.halfDuration ?? sportDefaults.halfDuration;
    const periodCount = sportDefaults.periodCount;
    const config = {
        halfDuration,
        periodDurationMinutes: halfDuration,
        periodCount,
        matchDuration: halfDuration * periodCount,
        playersPerSide: compSettings?.playersPerSide ?? textDetectedPlayersPerSide ?? sportDefaults.playersPerSide,
        maxSubstitutions: compSettings?.maxSubstitutions ?? sportDefaults.maxSubstitutions,
        substitutionModel: sportDefaults.substitutionModel,
        allowSubbedOutReentry: compSettings?.allowSubbedOutReentry ?? sportDefaults.allowSubbedOutReentry,
        extraTimeEnabled: match.extraTimeEnabledOverride ?? compSettings?.extraTimeEnabled ?? sportDefaults.extraTimeEnabled,
        penaltiesEnabled: match.penaltiesEnabledOverride ?? compSettings?.penaltiesEnabled ?? sportDefaults.penaltiesEnabled,
        allowDraws: match.allowDrawsOverride ?? compSettings?.allowDraws ?? sportDefaults.allowDraws,
        pointsForWin: compSettings?.pointsForWin ?? sportDefaults.pointsForWin,
        pointsForDraw: compSettings?.pointsForDraw ?? sportDefaults.pointsForDraw,
        overtimeDurationMinutes: sportDefaults.overtimeDurationMinutes,
        foulDisqualifyAt: sportDefaults.foulDisqualifyAt,
        teamFoulBonusAt: sportDefaults.teamFoulBonusAt,
        technicalFoulValue: sportDefaults.technicalFoulValue,
        shotClockEnabled: sportDefaults.shotClockEnabled,
        shotClockSeconds: sportDefaults.shotClockSeconds,
    };

    return { config, matchId: match.id, sport: match.sport, match };
}

// BACKLOG-281: knockout-round matches must produce a decisive result (a
// winner via extra time/penalties, never a level FINISHED score) regardless
// of the stored allowDraws setting above -- Richard's explicit call
// (BACKLOG-267 question 2) was to hardcode this check rather than extend
// competitionSportSettings with a phase concept. Uses the same clean enum
// round strings bracketService.ts (BACKLOG-280) writes onto matches it
// creates -- already in standingsService.ts's KNOCKOUT_ROUNDS exclusion list
// (BACKLOG-275) too. Deliberately excludes the historical free-text round
// variants ('Quarter Finals', 'Semifinals', etc.) -- those belong to
// already-completed competitions; this only ever runs against a match that
// hasn't finished yet.
export const DECISIVE_RESULT_ROUNDS = ['QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'];

export function requiresDecisiveResult(round: string | null | undefined): boolean {
    return !!round && DECISIVE_RESULT_ROUNDS.includes(round);
}
