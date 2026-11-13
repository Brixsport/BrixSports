import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { competitionSportSettings, competitions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { nanoid } from 'nanoid';

// Defaults when a field is omitted: a basketball competition must not inherit
// football defaults (11-a-side / 45 minutes); the basketball logger reads
// half_duration as the quarter length.
function sportDefaults(sport: string) {
    if (sport.toLowerCase() === 'basketball') {
        return { playersPerSide: 5, halfDuration: 10 as number | null, allowDraws: false, pointsForWin: 2, pointsForDraw: 0, extraTimeEnabled: true, allowSubbedOutReentry: true };
    }
    return { playersPerSide: 11, halfDuration: null as number | null, allowDraws: true, pointsForWin: 3, pointsForDraw: 1, extraTimeEnabled: false, allowSubbedOutReentry: false };
}

// GET — fetch match settings for a competition
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const settings = await db
            .select()
            .from(competitionSportSettings)
            .where(eq(competitionSportSettings.competitionId, params.id))
            .limit(10);

        return NextResponse.json({ settings });
    } catch (err) {
        console.error('[match-settings GET] Error:', err);
        return NextResponse.json({ error: 'Failed to fetch match settings' }, { status: 500 });
    }
}

// POST — create or replace match settings for a competition (upsert by competitionId + sport)
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authUser = await getAuthUser(req);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify competition exists
        const comp = await db
            .select({ id: competitions.id, sport: competitions.sport })
            .from(competitions)
            .where(eq(competitions.id, params.id))
            .limit(1)
            .then(r => r[0] ?? null);

        if (!comp) {
            return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
        }

        const body = await req.json();
        const {
            sport,
            format,
            playersPerSide,
            halfDuration,
            customRules,
            isTimed,
            maxSubstitutions,
            allowSubbedOutReentry,
            extraTimeEnabled,
            penaltiesEnabled,
            allowDraws,
            pointsForWin,
            pointsForDraw,
        } = body;

        const sportValue = sport ?? comp.sport ?? 'Football';
        const defaults = sportDefaults(sportValue);

        // Check for existing row for this competition + sport
        const existing = await db
            .select({ id: competitionSportSettings.id })
            .from(competitionSportSettings)
            .where(
                and(
                    eq(competitionSportSettings.competitionId, params.id),
                    eq(competitionSportSettings.sport, sportValue)
                )
            )
            .limit(1)
            .then(r => r[0] ?? null);

        if (existing) {
            // Update existing row
            await db
                .update(competitionSportSettings)
                .set({
                    format: format ?? null,
                    playersPerSide: playersPerSide ?? defaults.playersPerSide,
                    halfDuration: halfDuration ?? defaults.halfDuration,
                    customRules: customRules ? JSON.stringify(customRules) : null,
                    isTimed: isTimed ?? true,
                    maxSubstitutions: maxSubstitutions ?? null,
                    allowSubbedOutReentry: allowSubbedOutReentry ?? defaults.allowSubbedOutReentry,
                    extraTimeEnabled: extraTimeEnabled ?? defaults.extraTimeEnabled,
                    penaltiesEnabled: penaltiesEnabled ?? false,
                    allowDraws: allowDraws ?? defaults.allowDraws,
                    pointsForWin: pointsForWin ?? defaults.pointsForWin,
                    pointsForDraw: pointsForDraw ?? defaults.pointsForDraw,
                })
                .where(eq(competitionSportSettings.id, existing.id));

            const updated = await db
                .select()
                .from(competitionSportSettings)
                .where(eq(competitionSportSettings.id, existing.id))
                .limit(1)
                .then(r => r[0]);

            return NextResponse.json({ settings: updated });
        }

        // Insert new row
        const id = nanoid();
        await db.insert(competitionSportSettings).values({
            id,
            competitionId: params.id,
            sport: sportValue,
            format: format ?? null,
            playersPerSide: playersPerSide ?? defaults.playersPerSide,
            halfDuration: halfDuration ?? defaults.halfDuration,
            customRules: customRules ? JSON.stringify(customRules) : null,
            isTimed: isTimed ?? true,
            maxSubstitutions: maxSubstitutions ?? null,
            allowSubbedOutReentry: allowSubbedOutReentry ?? defaults.allowSubbedOutReentry,
            extraTimeEnabled: extraTimeEnabled ?? defaults.extraTimeEnabled,
            penaltiesEnabled: penaltiesEnabled ?? false,
            allowDraws: allowDraws ?? defaults.allowDraws,
            pointsForWin: pointsForWin ?? defaults.pointsForWin,
            pointsForDraw: pointsForDraw ?? defaults.pointsForDraw,
        });

        const inserted = await db
            .select()
            .from(competitionSportSettings)
            .where(eq(competitionSportSettings.id, id))
            .limit(1)
            .then(r => r[0]);

        return NextResponse.json({ settings: inserted }, { status: 201 });
    } catch (err) {
        console.error('[match-settings POST] Error:', err);
        return NextResponse.json({ error: 'Failed to save match settings' }, { status: 500 });
    }
}
