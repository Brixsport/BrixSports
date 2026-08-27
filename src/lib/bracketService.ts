import { db } from '@/db';
import { bracketNodes, matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// BACKLOG-280: knockout bracket service. Structure is fixed at top-8
// (QF x4 -> SF x2 -> 3rd Place + Final, 8 bracketNodes total) -- matches
// this competition's real format; a different bracket size is future work,
// not built here. Only QF nodes get a real `matches` row at creation time
// (`matches.homeTeamId`/`awayTeamId` are `.notNull()`, and SF/3rd/Final's
// teams aren't known yet); SF/3rd/Final rows are created by
// advanceBracketForMatch once both of a node's teams are determined.
//
// `round` values here use the clean enum strings ('QUARTER_FINAL' etc.) --
// deliberately included in standingsService.ts's KNOCKOUT_ROUNDS exclusion
// list (BACKLOG-275) precisely for this future case, so these matches are
// correctly excluded from league/group standings from the moment they exist.

export interface QuarterFinalSlot {
    homeTeamId: string;
    awayTeamId: string;
    startTime: string;
    venue: string;
}

export interface CreateKnockoutInput {
    competitionId: string;
    competition: string;
    sport: string;
    // Seeded 1v8/2v7/3v6/4v5 order (or admin-overridden equivalent) --
    // qf[0]=1v8, qf[1]=4v5 feed SF1; qf[2]=2v7, qf[3]=3v6 feed SF2. Standard
    // bracket seeding (1 and 2 kept on opposite sides until the Final).
    qf: [QuarterFinalSlot, QuarterFinalSlot, QuarterFinalSlot, QuarterFinalSlot];
}

export async function createKnockoutStructure(input: CreateKnockoutInput) {
    const { competitionId, competition, sport, qf } = input;

    const existing = await db.select({ id: bracketNodes.id }).from(bracketNodes).where(eq(bracketNodes.competitionId, competitionId)).limit(1);
    if (existing.length > 0) {
        throw new Error('A knockout bracket already exists for this competition');
    }

    const now = new Date();
    const ids = {
        qf: [`bn_${nanoid()}`, `bn_${nanoid()}`, `bn_${nanoid()}`, `bn_${nanoid()}`] as [string, string, string, string],
        sf: [`bn_${nanoid()}`, `bn_${nanoid()}`] as [string, string],
        third: `bn_${nanoid()}`,
        final: `bn_${nanoid()}`,
    };
    // QF0(1v8) & QF1(4v5) -> SF0; QF2(2v7) & QF3(3v6) -> SF1
    const qfNextMatch = [ids.sf[0], ids.sf[0], ids.sf[1], ids.sf[1]];

    const qfMatchIds: string[] = [];
    for (let i = 0; i < 4; i++) {
        const matchId = `match_${nanoid()}`;
        await db.insert(matches).values({
            id: matchId,
            sport,
            homeTeamId: qf[i].homeTeamId,
            awayTeamId: qf[i].awayTeamId,
            homeScore: 0,
            awayScore: 0,
            status: 'UPCOMING',
            startTime: qf[i].startTime,
            venue: qf[i].venue,
            competition,
            competitionId,
            matchType: 'competition',
            round: 'QUARTER_FINAL',
        });
        qfMatchIds.push(matchId);
    }

    const titles = ['Quarter-Final 1', 'Quarter-Final 2', 'Quarter-Final 3', 'Quarter-Final 4'];
    const nodeRows = [
        ...qf.map((slot, i) => ({
            id: ids.qf[i], competitionId, competition, sport,
            title: titles[i],
            matchId: qfMatchIds[i],
            nextMatchId: qfNextMatch[i],
            loserNextMatchId: null,
            homeTeamId: slot.homeTeamId, awayTeamId: slot.awayTeamId,
            homeScore: null, awayScore: null,
            status: 'PENDING', round: 'QUARTER_FINAL', position: i,
            createdAt: now,
        })),
        { id: ids.sf[0], competitionId, competition, sport, title: 'Semi-Final 1', matchId: null, nextMatchId: ids.final, loserNextMatchId: ids.third, homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, status: 'PENDING', round: 'SEMI_FINAL', position: 0, createdAt: now },
        { id: ids.sf[1], competitionId, competition, sport, title: 'Semi-Final 2', matchId: null, nextMatchId: ids.final, loserNextMatchId: ids.third, homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, status: 'PENDING', round: 'SEMI_FINAL', position: 1, createdAt: now },
        { id: ids.third, competitionId, competition, sport, title: '3rd Place Playoff', matchId: null, nextMatchId: null, loserNextMatchId: null, homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, status: 'PENDING', round: 'THIRD_PLACE', position: 0, createdAt: now },
        { id: ids.final, competitionId, competition, sport, title: 'Final', matchId: null, nextMatchId: null, loserNextMatchId: null, homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, status: 'PENDING', round: 'FINAL', position: 0, createdAt: now },
    ];

    await db.insert(bracketNodes).values(nodeRows);

    return { nodeIds: ids, qfMatchIds };
}

async function advanceTeamInto(nodeId: string, teamId: string) {
    const target = await db.select().from(bracketNodes).where(eq(bracketNodes.id, nodeId)).limit(1).then(r => r[0] ?? null);
    if (!target) return;

    // Idempotent-safe: a retry of the same finished match shouldn't double-place.
    if (target.homeTeamId === teamId || target.awayTeamId === teamId) return;

    const slot: 'homeTeamId' | 'awayTeamId' | null = !target.homeTeamId ? 'homeTeamId' : (!target.awayTeamId ? 'awayTeamId' : null);
    if (!slot) {
        console.error(`advanceTeamInto: bracket node ${nodeId} already has both teams filled, cannot place ${teamId}`);
        return;
    }

    await db.update(bracketNodes).set({ [slot]: teamId }).where(eq(bracketNodes.id, nodeId));

    const updated = await db.select().from(bracketNodes).where(eq(bracketNodes.id, nodeId)).limit(1).then(r => r[0]!);
    if (updated.homeTeamId && updated.awayTeamId && !updated.matchId) {
        // Both teams now known -- create the real match row. Placeholder
        // schedule: the real kickoff/venue for a knockout-round match genuinely
        // can't be known until both semifinalists/finalists are determined by
        // actual results, so this uses "now" + a TBD venue and expects the
        // admin to correct it via the normal match-edit flow afterward.
        const newMatchId = `match_${nanoid()}`;
        await db.insert(matches).values({
            id: newMatchId,
            sport: updated.sport,
            homeTeamId: updated.homeTeamId,
            awayTeamId: updated.awayTeamId,
            homeScore: 0,
            awayScore: 0,
            status: 'UPCOMING',
            startTime: new Date().toISOString(),
            venue: 'TBD',
            competition: updated.competition,
            competitionId: updated.competitionId,
            matchType: 'competition',
            round: updated.round,
        });
        await db.update(bracketNodes).set({ matchId: newMatchId }).where(eq(bracketNodes.id, nodeId));
    }
}

// Called from the match-FINISHED transition (matches/[id]/route.ts). No-ops
// silently if matchId isn't a bracket match (most matches aren't) -- must
// never throw into the caller's standings-recalc path.
export async function advanceBracketForMatch(matchId: string) {
    const node = await db.select().from(bracketNodes).where(eq(bracketNodes.matchId, matchId)).limit(1).then(r => r[0] ?? null);
    if (!node) return;

    const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1).then(r => r[0] ?? null);
    if (!match) return;

    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;
    let winnerTeamId: string;
    let loserTeamId: string;

    if (homeScore > awayScore) {
        winnerTeamId = match.homeTeamId; loserTeamId = match.awayTeamId;
    } else if (awayScore > homeScore) {
        winnerTeamId = match.awayTeamId; loserTeamId = match.homeTeamId;
    } else {
        const shootoutHome = match.shootoutHomeScore ?? 0;
        const shootoutAway = match.shootoutAwayScore ?? 0;
        if (shootoutHome > shootoutAway) {
            winnerTeamId = match.homeTeamId; loserTeamId = match.awayTeamId;
        } else if (shootoutAway > shootoutHome) {
            winnerTeamId = match.awayTeamId; loserTeamId = match.homeTeamId;
        } else {
            console.error(`advanceBracketForMatch: match ${matchId} is level with no shootout winner -- cannot advance bracket`);
            return;
        }
    }

    await db.update(bracketNodes).set({ homeScore: match.homeScore, awayScore: match.awayScore, status: 'FINISHED' }).where(eq(bracketNodes.id, node.id));

    if (node.nextMatchId) await advanceTeamInto(node.nextMatchId, winnerTeamId);
    if (node.loserNextMatchId) await advanceTeamInto(node.loserNextMatchId, loserTeamId);
}
