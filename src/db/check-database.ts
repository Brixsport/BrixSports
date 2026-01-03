import { db } from './index';
import { teams, players, matches } from './schema';

async function checkDatabase() {
    console.log('🔍 Checking database contents...\n');

    try {
        // Check teams
        const allTeams = await db.select().from(teams);
        console.log(`📊 TEAMS (${allTeams.length} total):`);
        allTeams.forEach(team => {
            console.log(`  - ${team.name} (${team.shortName}) - Sport: ${team.sport || 'N/A'}`);
        });

        // Check players
        const allPlayers = await db.select().from(players);
        console.log(`\n👥 PLAYERS (${allPlayers.length} total):`);
        const playersByTeam = allPlayers.reduce((acc, player) => {
            if (!acc[player.teamId]) acc[player.teamId] = [];
            acc[player.teamId].push(player);
            return acc;
        }, {} as Record<string, any[]>);

        Object.entries(playersByTeam).forEach(([teamId, teamPlayers]) => {
            const team = allTeams.find(t => t.id === teamId);
            console.log(`  ${team?.name || teamId}: ${teamPlayers.length} players`);
        });

        // Check matches
        const allMatches = await db.select().from(matches);
        console.log(`\n⚽ MATCHES (${allMatches.length} total):`);
        const matchesBySport = allMatches.reduce((acc, match) => {
            if (!acc[match.sport]) acc[match.sport] = [];
            acc[match.sport].push(match);
            return acc;
        }, {} as Record<string, any[]>);

        Object.entries(matchesBySport).forEach(([sport, sportMatches]) => {
            console.log(`  ${sport}: ${sportMatches.length} matches`);
        });

        console.log('\n✅ Database check complete!');
    } catch (error) {
        console.error('❌ Error checking database:', error);
    }
}

checkDatabase().then(() => process.exit(0));
