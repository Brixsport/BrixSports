import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, matches, standings } from '@/db/schema';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const sport = searchParams.get('sport');

        // Get all teams, matches, and standings
        const allTeams = await db.select().from(teams);
        const allMatches = await db.select().from(matches);
        const allStandings = await db.select().from(standings);

        // Filter by sport if specified
        let filteredTeams = allTeams;
        let filteredMatches = allMatches;
        let filteredStandings = allStandings;

        if (sport) {
            filteredTeams = allTeams.filter(t => t.sport === sport);
            filteredMatches = allMatches.filter(m => m.sport === sport);
            filteredStandings = allStandings.filter(s => s.sport === sport);
        }

        // If teamId is specified, return stats for that team only
        if (teamId) {
            const team = filteredTeams.find(t => t.id === teamId);
            if (!team) {
                return NextResponse.json({ error: 'Team not found' }, { status: 404 });
            }

            const teamStats = calculateTeamStats(team, filteredMatches, filteredStandings);
            return NextResponse.json(teamStats);
        }

        // Otherwise, return stats for all teams
        const allTeamStats = filteredTeams.map(team =>
            calculateTeamStats(team, filteredMatches, filteredStandings)
        );

        return NextResponse.json(allTeamStats);
    } catch (error) {
        console.error('Error fetching team stats:', error);
        return NextResponse.json({ error: 'Failed to fetch team stats' }, { status: 500 });
    }
}

function calculateTeamStats(team: any, allMatches: any[], allStandings: any[]) {
    const teamMatches = allMatches.filter(m =>
        m.homeTeamId === team.id || m.awayTeamId === team.id
    );

    const standing = allStandings.find(s => s.teamId === team.id);

    // Basic stats from standings
    const played = standing?.played ?? 0;
    const won = standing?.won ?? 0;
    const drawn = standing?.drawn ?? 0;
    const lost = standing?.lost ?? 0;
    const goalsFor = standing?.goalsFor ?? 0;
    const goalsAgainst = standing?.goalsAgainst ?? 0;
    const goalDifference = standing?.goalDifference ?? 0;
    const points = standing?.points ?? 0;

    // Calculate advanced stats
    const winPercentage = played > 0 ? ((won / played) * 100).toFixed(1) : '0.0';
    const avgGoalsFor = played > 0 ? (goalsFor / played).toFixed(2) : '0.00';
    const avgGoalsAgainst = played > 0 ? (goalsAgainst / played).toFixed(2) : '0.00';

    // Home/Away splits
    const homeMatches = teamMatches.filter(m => m.homeTeamId === team.id);
    const awayMatches = teamMatches.filter(m => m.awayTeamId === team.id);

    const homeWins = homeMatches.filter(m => (m.homeScore ?? 0) > (m.awayScore ?? 0)).length;
    const homeDraws = homeMatches.filter(m => (m.homeScore ?? 0) === (m.awayScore ?? 0)).length;
    const homeLosses = homeMatches.length - homeWins - homeDraws;

    const awayWins = awayMatches.filter(m => (m.awayScore ?? 0) > (m.homeScore ?? 0)).length;
    const awayDraws = awayMatches.filter(m => (m.homeScore ?? 0) === (m.awayScore ?? 0)).length;
    const awayLosses = awayMatches.length - awayWins - awayDraws;

    // Clean sheets (matches where team didn't concede)
    const cleanSheets = teamMatches.filter(m => {
        if (m.homeTeamId === team.id) return (m.awayScore ?? 0) === 0;
        return (m.homeScore ?? 0) === 0;
    }).length;

    // Failed to score
    const failedToScore = teamMatches.filter(m => {
        if (m.homeTeamId === team.id) return (m.homeScore ?? 0) === 0;
        return (m.awayScore ?? 0) === 0;
    }).length;

    // Biggest win/loss
    let biggestWin = 0;
    let biggestLoss = 0;

    teamMatches.forEach(m => {
        const isHome = m.homeTeamId === team.id;
        const teamScore = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
        const oppScore = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
        const diff = teamScore - oppScore;

        if (diff > biggestWin) biggestWin = diff;
        if (diff < 0 && Math.abs(diff) > biggestLoss) biggestLoss = Math.abs(diff);
    });

    // Current form (last 5 matches)
    const recentMatches = teamMatches
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 5);

    const form = recentMatches.map(m => {
        const isHome = m.homeTeamId === team.id;
        const teamScore = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
        const oppScore = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);

        if (teamScore > oppScore) return 'W';
        if (teamScore < oppScore) return 'L';
        return 'D';
    }).reverse();

    // Win/Loss streaks
    let currentStreak = { type: '', count: 0 };
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;

    const sortedMatches = teamMatches.sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    sortedMatches.forEach((m, index) => {
        const isHome = m.homeTeamId === team.id;
        const teamScore = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
        const oppScore = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);

        if (teamScore > oppScore) {
            tempWinStreak++;
            tempLossStreak = 0;
            if (tempWinStreak > longestWinStreak) longestWinStreak = tempWinStreak;
            if (index === sortedMatches.length - 1) {
                currentStreak = { type: 'W', count: tempWinStreak };
            }
        } else if (teamScore < oppScore) {
            tempLossStreak++;
            tempWinStreak = 0;
            if (tempLossStreak > longestLossStreak) longestLossStreak = tempLossStreak;
            if (index === sortedMatches.length - 1) {
                currentStreak = { type: 'L', count: tempLossStreak };
            }
        } else {
            tempWinStreak = 0;
            tempLossStreak = 0;
            if (index === sortedMatches.length - 1) {
                currentStreak = { type: 'D', count: 1 };
            }
        }
    });

    return {
        team: {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            logo: team.logo,
            sport: team.sport,
        },
        basic: {
            played,
            won,
            drawn,
            lost,
            goalsFor,
            goalsAgainst,
            goalDifference,
            points,
        },
        advanced: {
            winPercentage: parseFloat(winPercentage),
            avgGoalsFor: parseFloat(avgGoalsFor),
            avgGoalsAgainst: parseFloat(avgGoalsAgainst),
            cleanSheets,
            failedToScore,
            biggestWin,
            biggestLoss,
            form: form.join(''),
            currentStreak,
            longestWinStreak,
            longestLossStreak,
        },
        splits: {
            home: {
                played: homeMatches.length,
                won: homeWins,
                drawn: homeDraws,
                lost: homeLosses,
                record: `${homeWins}-${homeDraws}-${homeLosses}`,
            },
            away: {
                played: awayMatches.length,
                won: awayWins,
                drawn: awayDraws,
                lost: awayLosses,
                record: `${awayWins}-${awayDraws}-${awayLosses}`,
            },
        },
    };
}
