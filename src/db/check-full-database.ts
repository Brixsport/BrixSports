import { db } from './index';
import { teams, players, matches, standings } from './schema';

async function checkDatabaseStatus() {
    console.log('🔍 COMPREHENSIVE DATABASE CHECK\n');
    console.log('='.repeat(80));

    try {
        // ==================== TEAMS ====================
        const allTeams = await db.select().from(teams);
        const footballTeams = allTeams.filter(t => t.sport === 'Football');
        const basketballTeams = allTeams.filter(t => t.sport === 'Basketball');

        console.log('\n📊 TEAMS SUMMARY');
        console.log('-'.repeat(80));
        console.log(`Total Teams: ${allTeams.length}`);
        console.log(`  - Football: ${footballTeams.length}`);
        console.log(`  - Basketball: ${basketballTeams.length}`);

        console.log('\n🏀 BASKETBALL TEAMS:');
        basketballTeams.forEach(team => {
            console.log(`  ${team.shortName.padEnd(5)} - ${team.name.padEnd(20)} (ID: ${team.id})`);
        });

        console.log('\n⚽ FOOTBALL TEAMS:');
        footballTeams.forEach(team => {
            console.log(`  ${team.shortName.padEnd(5)} - ${team.name.padEnd(20)} (ID: ${team.id})`);
        });

        // ==================== PLAYERS ====================
        const allPlayers = await db.select().from(players);

        console.log('\n\n👥 PLAYERS SUMMARY');
        console.log('-'.repeat(80));
        console.log(`Total Players: ${allPlayers.length}`);

        // Group players by team
        const playersByTeam: Record<string, any[]> = {};
        allPlayers.forEach(player => {
            if (!playersByTeam[player.teamId]) {
                playersByTeam[player.teamId] = [];
            }
            playersByTeam[player.teamId].push(player);
        });

        console.log('\nPlayers per Team:');
        Object.entries(playersByTeam).forEach(([teamId, teamPlayers]) => {
            const team = allTeams.find(t => t.id === teamId);
            if (team) {
                console.log(`  ${team.shortName.padEnd(5)} - ${team.name.padEnd(25)}: ${teamPlayers.length} players`);
            }
        });

        // Show detailed player list for each team
        console.log('\n\n📋 DETAILED PLAYER ROSTERS');
        console.log('-'.repeat(80));

        for (const team of allTeams) {
            const teamPlayers = playersByTeam[team.id] || [];
            if (teamPlayers.length > 0) {
                console.log(`\n${team.name} (${team.shortName}) - ${team.sport}`);
                console.log('  ' + '-'.repeat(70));
                teamPlayers.forEach(player => {
                    console.log(`  #${player.number.toString().padStart(2)} ${player.name.padEnd(25)} ${player.position.padEnd(5)} Rating: ${player.rating}`);
                });
            }
        }

        // ==================== MATCHES ====================
        const allMatches = await db.select().from(matches);
        const footballMatches = allMatches.filter(m => m.sport === 'Football');
        const basketballMatches = allMatches.filter(m => m.sport === 'Basketball');
        const liveMatches = allMatches.filter(m => m.status === 'LIVE');
        const upcomingMatches = allMatches.filter(m => m.status === 'UPCOMING');
        const finishedMatches = allMatches.filter(m => m.status === 'FINISHED');

        console.log('\n\n⚽ MATCHES SUMMARY');
        console.log('-'.repeat(80));
        console.log(`Total Matches: ${allMatches.length}`);
        console.log(`  - Football: ${footballMatches.length}`);
        console.log(`  - Basketball: ${basketballMatches.length}`);
        console.log(`\nBy Status:`);
        console.log(`  - Live: ${liveMatches.length}`);
        console.log(`  - Upcoming: ${upcomingMatches.length}`);
        console.log(`  - Finished: ${finishedMatches.length}`);

        // ==================== STANDINGS ====================
        const allStandings = await db.select().from(standings);
        const footballStandings = allStandings.filter(s => s.sport === 'Football');
        const basketballStandings = allStandings.filter(s => s.sport === 'Basketball');

        console.log('\n\n🏆 STANDINGS SUMMARY');
        console.log('-'.repeat(80));
        console.log(`Total Standing Records: ${allStandings.length}`);
        console.log(`  - Football: ${footballStandings.length}`);
        console.log(`  - Basketball: ${basketballStandings.length}`);

        // Display Basketball Standings
        if (basketballStandings.length > 0) {
            console.log('\n🏀 BASKETBALL STANDINGS:');
            console.log('  ' + '-'.repeat(70));
            console.log('  Pos Team                 P   W   D   L   PF   PA   Diff  Pts');
            console.log('  ' + '-'.repeat(70));

            const sortedBasketball = basketballStandings.sort((a, b) => {
                if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
                if ((b.goalDifference ?? 0) !== (a.goalDifference ?? 0)) return (b.goalDifference ?? 0) - (a.goalDifference ?? 0);
                return (b.goalsFor ?? 0) - (a.goalsFor ?? 0);
            });

            sortedBasketball.forEach((standing, index) => {
                const team = allTeams.find(t => t.id === standing.teamId);
                if (team) {
                    console.log(
                        `  ${(index + 1).toString().padStart(2)}. ` +
                        `${team.name.padEnd(20)} ` +
                        `${(standing.played ?? 0).toString().padStart(2)}  ` +
                        `${(standing.won ?? 0).toString().padStart(2)}  ` +
                        `${(standing.drawn ?? 0).toString().padStart(2)}  ` +
                        `${(standing.lost ?? 0).toString().padStart(2)}  ` +
                        `${(standing.goalsFor ?? 0).toString().padStart(3)}  ` +
                        `${(standing.goalsAgainst ?? 0).toString().padStart(3)}  ` +
                        `${(standing.goalDifference ?? 0).toString().padStart(4)}  ` +
                        `${(standing.points ?? 0).toString().padStart(3)}`
                    );
                }
            });
        }

        // Display Football Standings by Group
        if (footballStandings.length > 0) {
            console.log('\n\n⚽ FOOTBALL STANDINGS:');

            // Group standings by competition
            const standingsByComp: Record<string, any[]> = {};
            footballStandings.forEach(standing => {
                if (!standingsByComp[standing.competition]) {
                    standingsByComp[standing.competition] = [];
                }
                standingsByComp[standing.competition].push(standing);
            });

            Object.entries(standingsByComp).forEach(([competition, compStandings]) => {
                console.log(`\n  ${competition}`);
                console.log('  ' + '-'.repeat(70));
                console.log('  Pos Team                 P   W   D   L   GF   GA   GD   Pts');
                console.log('  ' + '-'.repeat(70));

                const sorted = compStandings.sort((a, b) => {
                    if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
                    if ((b.goalDifference ?? 0) !== (a.goalDifference ?? 0)) return (b.goalDifference ?? 0) - (a.goalDifference ?? 0);
                    return (b.goalsFor ?? 0) - (a.goalsFor ?? 0);
                });

                sorted.forEach((standing, index) => {
                    const team = allTeams.find(t => t.id === standing.teamId);
                    if (team) {
                        console.log(
                            `  ${(index + 1).toString().padStart(2)}. ` +
                            `${team.name.padEnd(20)} ` +
                            `${(standing.played ?? 0).toString().padStart(2)}  ` +
                            `${(standing.won ?? 0).toString().padStart(2)}  ` +
                            `${(standing.drawn ?? 0).toString().padStart(2)}  ` +
                            `${(standing.lost ?? 0).toString().padStart(2)}  ` +
                            `${(standing.goalsFor ?? 0).toString().padStart(3)}  ` +
                            `${(standing.goalsAgainst ?? 0).toString().padStart(3)}  ` +
                            `${(standing.goalDifference ?? 0).toString().padStart(4)}  ` +
                            `${(standing.points ?? 0).toString().padStart(3)}`
                        );
                    }
                });
            });
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ DATABASE CHECK COMPLETE!\n');

    } catch (error) {
        console.error('❌ Error checking database:', error);
    }
}

checkDatabaseStatus().then(() => process.exit(0));
