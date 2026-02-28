import { teams, matches, competitions, standings, teamRegistrations } from './src/db/schema';
import { db } from './src/db';
import { eq, or } from 'drizzle-orm';

async function debugCompetitionTeams(compId: string) {
    console.log(`\n--- Debugging Competition: ${compId} ---`);

    const [competition] = await db
        .select()
        .from(competitions)
        .where(eq(competitions.id, compId));

    if (!competition) {
        console.log("Competition not found by ID.");
    } else {
        console.log(`Found Competition: ${competition.name} (${competition.id})`);
    }

    const competitionName = competition ? competition.name : compId;
    const actualId = competition ? competition.id : null;

    const s = await db.select().from(standings).where(actualId ? or(eq(standings.competitionId, actualId), eq(standings.competition, competitionName)) : eq(standings.competition, competitionName));
    console.log(`Standings count: ${s.length}`);
    s.forEach(x => console.log(`  - Team: ${x.teamId}, Group: ${x.groupName}`));

    const m = await db.select().from(matches).where(actualId ? or(eq(matches.competitionId, actualId), eq(matches.competition, competitionName)) : eq(matches.competition, competitionName));
    console.log(`Matches count: ${m.length}`);

    const r = await db.select().from(teamRegistrations).where(eq(teamRegistrations.competitionId, actualId || ''));
    console.log(`Registrations count: ${r.length}`);

    // Simulate API logic
    const teamGroupMap = new Map<string, string | null>();
    s.forEach(x => teamGroupMap.set(x.teamId, x.groupName));
    m.forEach(x => {
        if (!teamGroupMap.has(x.homeTeamId)) teamGroupMap.set(x.homeTeamId, x.groupName);
        if (!teamGroupMap.has(x.awayTeamId)) teamGroupMap.set(x.awayTeamId, x.groupName);
    });
    r.forEach(reg => {
        if (reg.createdTeamId && !teamGroupMap.has(reg.createdTeamId)) {
            teamGroupMap.set(reg.createdTeamId, null);
        }
    });

    console.log(`Final Team IDs to fetch: ${Array.from(teamGroupMap.keys()).join(', ')}`);
}

// Get first competition to test
async function run() {
    const allComps = await db.select().from(competitions);
    if (allComps.length > 0) {
        for (const comp of allComps) {
            await debugCompetitionTeams(comp.id);
        }
    } else {
        console.log("No competitions found.");
    }
    process.exit(0);
}

run();
