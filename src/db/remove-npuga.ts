import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { eq, like, inArray, sql } from 'drizzle-orm';

dotenv.config();

// Create Turso client using environment variables
const client = createClient({
    url: process.env.TURSO_CONNECTION_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client, { schema });

const { 
    competitions, 
    competitionSportSettings, 
    competitionTeamEntries,
    matches,
    matchEvents,
    matchLoggerAssignments,
    squadPlayers,
    standings,
    bracketNodes,
    polls,
    pollVotes,
    pollComments,
    pollCommentLikes,
    teams,
    playerTeamAffiliations,
    players,
    registeredPlayers,
    teamRegistrations,
    footballPlayerStats,
    basketballPlayerStats,
    individualSportStats,
    playerStats,
    teamForm,
    headToHead,
    transfers
} = schema;

/**
 * Remove NPUGA competition and all related data
 */

async function removeNpugaCompetition() {
    console.log('🗑️  Removing NPUGA competition and related data...\n');

    try {
        // Find NPUGA competitions
        const npugaComps = await db
            .select({ id: competitions.id, name: competitions.name })
            .from(competitions)
            .where(
                like(competitions.name, '%NPUGA%')
            );

        if (npugaComps.length === 0) {
            console.log('❌ No NPUGA competitions found');
            return;
        }

        console.log(`Found ${npugaComps.length} NPUGA competition(s):`);
        for (const comp of npugaComps) {
            console.log(`  - ${comp.name} (${comp.id})`);
        }
        console.log();

        const compIds = npugaComps.map(c => c.id);

        // Get all matches for these competitions
        const matchIds = await db
            .select({ id: matches.id })
            .from(matches)
            .where(inArray(matches.competitionId, compIds));

        const matchIdList = matchIds.map(m => m.id);

        // Get all team entries for these competitions
        const teamEntries = await db
            .select({ teamId: competitionTeamEntries.teamId })
            .from(competitionTeamEntries)
            .where(inArray(competitionTeamEntries.competitionId, compIds));

        const teamIds = [...new Set(teamEntries.map(t => t.teamId))];

        console.log(`Found ${matchIdList.length} matches to delete`);
        console.log(`Found ${teamIds.length} teams to delete`);
        console.log();

        // Delete in order (respecting foreign key constraints)
        
        // 1. Delete poll-related data
        if (matchIdList.length > 0) {
            const pollIds = await db
                .select({ id: polls.id })
                .from(polls)
                .where(inArray(polls.matchId, matchIdList));
            
            const pollIdList = pollIds.map(p => p.id);
            
            if (pollIdList.length > 0) {
                await db.delete(pollCommentLikes).where(inArray(pollCommentLikes.commentId, 
                    await db.select({ id: pollComments.id }).from(pollComments).where(inArray(pollComments.pollId, pollIdList)).then(r => r.map(x => x.id))
                ));
                await db.delete(pollComments).where(inArray(pollComments.pollId, pollIdList));
                await db.delete(pollVotes).where(inArray(pollVotes.pollId, pollIdList));
                await db.delete(polls).where(inArray(polls.id, pollIdList));
                console.log('✅ Deleted poll data');
            }
        }

        // 2. Delete match events and logger assignments
        if (matchIdList.length > 0) {
            await db.delete(matchEvents).where(inArray(matchEvents.matchId, matchIdList));
            await db.delete(matchLoggerAssignments).where(inArray(matchLoggerAssignments.matchId, matchIdList));
            console.log('✅ Deleted match events and logger assignments');
        }

        // 3. Delete matches
        if (matchIdList.length > 0) {
            await db.delete(matches).where(inArray(matches.id, matchIdList));
            console.log('✅ Deleted matches');
        }

        // 4. Delete bracket nodes
        try {
            await db.delete(bracketNodes).where(inArray(bracketNodes.competitionId, compIds));
            console.log('✅ Deleted bracket nodes');
        } catch (e) {
            console.log('⚠️  Bracket nodes table not found or empty');
        }

        // 5. Delete standings
        try {
            await db.delete(standings).where(inArray(standings.competitionId, compIds));
            console.log('✅ Deleted standings');
        } catch (e) {
            console.log('⚠️  Standings table not found or empty');
        }

        // 6. Delete squad players for teams in this competition (may not exist)
        try {
            await db.delete(squadPlayers).where(inArray(squadPlayers.competitionId, compIds));
            console.log('✅ Deleted squad players');
        } catch (e) {
            console.log('⚠️  Squad players table not found or empty');
        }

        // 7. Delete competition team entries
        await db.delete(competitionTeamEntries).where(inArray(competitionTeamEntries.competitionId, compIds));
        console.log('✅ Deleted competition team entries');

        // 8. Delete competition sport settings
        await db.delete(competitionSportSettings).where(inArray(competitionSportSettings.competitionId, compIds));
        console.log('✅ Deleted competition sport settings');

        // 9. Delete teams that were only for NPUGA (optional - keep if teams are reused)
        // For now, we'll delete teams that have 'Bells University of Technology' format
        const bellsTeams = await db
            .select({ id: teams.id, name: teams.name })
            .from(teams)
            .where(
                sql`LOWER(${teams.name}) LIKE '%bells university of technology%'`
            );
        
        const bellsTeamIds = bellsTeams.map(t => t.id);
        
        if (bellsTeamIds.length > 0) {
            console.log(`Found ${bellsTeamIds.length} Bells University teams to delete`);
            
            // Disable foreign key constraints temporarily
            await db.run(sql`PRAGMA foreign_keys = OFF`);
            
            try {
                // Delete teams directly - CASCADE will handle related records
                await db.delete(teams).where(inArray(teams.id, bellsTeamIds));
                console.log(`✅ Deleted ${bellsTeams.length} Bells University teams`);
            } finally {
                // Re-enable foreign key constraints
                await db.run(sql`PRAGMA foreign_keys = ON`);
            }
        }

        // 10. Finally delete competitions
        await db.delete(competitions).where(inArray(competitions.id, compIds));
        console.log('✅ Deleted competitions');

        console.log('\n🎉 NPUGA competition and all related data removed successfully!');

    } catch (error) {
        console.error('❌ Error removing NPUGA competition:', error);
        throw error;
    }
}

removeNpugaCompetition().then(() => process.exit(0));
