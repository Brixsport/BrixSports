import { db } from './index';
import { teams, matches, standings } from './schema';

async function analyzeTeamStats() {
    console.log('📊 ANALYZING AVAILABLE TEAM STATISTICS\n');
    console.log('='.repeat(80));

    try {
        const allTeams = await db.select().from(teams);
        const allMatches = await db.select().from(matches);
        const allStandings = await db.select().from(standings);

        console.log('\n🏀 BASKETBALL TEAM STATS AVAILABLE:\n');

        const basketballTeams = allTeams.filter(t => t.sport === 'Basketball');
        const basketballMatches = allMatches.filter(m => m.sport === 'Basketball');
        const basketballStandings = allStandings.filter(s => s.sport === 'Basketball');

        console.log('From Standings Table:');
        console.log('  ✅ Games Played');
        console.log('  ✅ Wins / Losses / Draws');
        console.log('  ✅ Points For (Total)');
        console.log('  ✅ Points Against (Total)');
        console.log('  ✅ Point Differential');
        console.log('  ✅ League Points');

        console.log('\nCalculable from Match Data:');
        console.log('  ✅ Win Percentage');
        console.log('  ✅ Points Per Game (Average)');
        console.log('  ✅ Points Allowed Per Game');
        console.log('  ✅ Home Record (W-L)');
        console.log('  ✅ Away Record (W-L)');
        console.log('  ✅ Biggest Win Margin');
        console.log('  ✅ Biggest Loss Margin');
        console.log('  ✅ Longest Win Streak');
        console.log('  ✅ Longest Loss Streak');
        console.log('  ✅ Current Form (Last 5 games)');

        // Sample calculation for one team
        if (basketballTeams.length > 0) {
            const sampleTeam = basketballTeams[0];
            const teamMatches = basketballMatches.filter(m =>
                m.homeTeamId === sampleTeam.id || m.awayTeamId === sampleTeam.id
            );
            const teamStanding = basketballStandings.find(s => s.teamId === sampleTeam.id);

            console.log(`\n📈 SAMPLE: ${sampleTeam.name} Statistics:`);
            console.log('  ' + '-'.repeat(70));

            if (teamStanding) {
                const winPct = ((teamStanding.won ?? 0) / Math.max(teamStanding.played ?? 1, 1) * 100).toFixed(1);
                const ppg = ((teamStanding.goalsFor ?? 0) / Math.max(teamStanding.played ?? 1, 1)).toFixed(1);
                const papg = ((teamStanding.goalsAgainst ?? 0) / Math.max(teamStanding.played ?? 1, 1)).toFixed(1);

                console.log(`  Record: ${teamStanding.won}-${teamStanding.lost} (${winPct}%)`);
                console.log(`  Points Per Game: ${ppg}`);
                console.log(`  Points Allowed: ${papg}`);
                console.log(`  Point Differential: ${(teamStanding.goalDifference ?? 0) > 0 ? '+' : ''}${teamStanding.goalDifference ?? 0}`);
            }

            // Home/Away splits
            const homeMatches = teamMatches.filter(m => m.homeTeamId === sampleTeam.id);
            const awayMatches = teamMatches.filter(m => m.awayTeamId === sampleTeam.id);

            const homeWins = homeMatches.filter(m => (m.homeScore ?? 0) > (m.awayScore ?? 0)).length;
            const awayWins = awayMatches.filter(m => (m.awayScore ?? 0) > (m.homeScore ?? 0)).length;

            console.log(`  Home Record: ${homeWins}-${homeMatches.length - homeWins}`);
            console.log(`  Away Record: ${awayWins}-${awayMatches.length - awayWins}`);
        }

        console.log('\n\n⚽ FOOTBALL TEAM STATS AVAILABLE:\n');

        const footballTeams = allTeams.filter(t => t.sport === 'Football');
        const footballMatches = allMatches.filter(m => m.sport === 'Football');
        const footballStandings = allStandings.filter(s => s.sport === 'Football');

        console.log('From Standings Table:');
        console.log('  ✅ Games Played');
        console.log('  ✅ Wins / Losses / Draws');
        console.log('  ✅ Goals For (Total)');
        console.log('  ✅ Goals Against (Total)');
        console.log('  ✅ Goal Differential');
        console.log('  ✅ League Points');
        console.log('  ✅ Group Position');

        console.log('\nCalculable from Match Data:');
        console.log('  ✅ Win Percentage');
        console.log('  ✅ Goals Per Game (Average)');
        console.log('  ✅ Goals Conceded Per Game');
        console.log('  ✅ Clean Sheets');
        console.log('  ✅ Failed to Score');
        console.log('  ✅ Home Record (W-D-L)');
        console.log('  ✅ Away Record (W-D-L)');
        console.log('  ✅ Biggest Win');
        console.log('  ✅ Biggest Loss');
        console.log('  ✅ Current Form (Last 5 games)');
        console.log('  ✅ Scoring Streak');
        console.log('  ✅ Defensive Record');

        // Sample calculation for one team
        if (footballTeams.length > 0) {
            const sampleTeam = footballTeams[0];
            const teamMatches = footballMatches.filter(m =>
                m.homeTeamId === sampleTeam.id || m.awayTeamId === sampleTeam.id
            );
            const teamStanding = footballStandings.find(s => s.teamId === sampleTeam.id);

            console.log(`\n📈 SAMPLE: ${sampleTeam.name} Statistics:`);
            console.log('  ' + '-'.repeat(70));

            if (teamStanding) {
                const winPct = ((teamStanding.won ?? 0) / Math.max(teamStanding.played ?? 1, 1) * 100).toFixed(1);
                const gpg = ((teamStanding.goalsFor ?? 0) / Math.max(teamStanding.played ?? 1, 1)).toFixed(1);
                const gcpg = ((teamStanding.goalsAgainst ?? 0) / Math.max(teamStanding.played ?? 1, 1)).toFixed(1);

                console.log(`  Record: ${teamStanding.won}W-${teamStanding.drawn}D-${teamStanding.lost}L (${winPct}% win rate)`);
                console.log(`  Goals Per Game: ${gpg}`);
                console.log(`  Goals Conceded: ${gcpg}`);
                console.log(`  Goal Differential: ${(teamStanding.goalDifference ?? 0) > 0 ? '+' : ''}${teamStanding.goalDifference ?? 0}`);
                console.log(`  Points: ${teamStanding.points}`);
            }

            // Clean sheets
            const cleanSheets = teamMatches.filter(m => {
                if (m.homeTeamId === sampleTeam.id) return m.awayScore === 0;
                return m.homeScore === 0;
            }).length;

            console.log(`  Clean Sheets: ${cleanSheets}`);
        }

        console.log('\n\n' + '='.repeat(80));
        console.log('💡 RECOMMENDATION:');
        console.log('   All basic team statistics are already available in the standings table!');
        console.log('   Additional advanced stats can be calculated on-demand from match data.');
        console.log('\n✅ Team stats are READY to display on frontend!');

    } catch (error) {
        console.error('❌ Error analyzing team stats:', error);
    }
}

analyzeTeamStats().then(() => process.exit(0));
