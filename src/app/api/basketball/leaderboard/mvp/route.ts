import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams, players } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
    try {
        // 1. Fetch all basketball matches
        const basketballMatches = await db
            .select()
            .from(matches)
            .where(eq(matches.sport, 'Basketball'))
            .all();

        // 2. Count MVPs
        const mvpCounts: Record<string, number> = {};
        basketballMatches.forEach(m => {
            if (!m.stats) return;
            try {
                const stats = typeof m.stats === 'string' ? JSON.parse(m.stats) : m.stats;
                if (stats.mvp) {
                    const name = stats.mvp.toUpperCase();
                    mvpCounts[name] = (mvpCounts[name] || 0) + 1;
                }
            } catch (e) { }
        });

        // 3. Fetch all basketball players with their teams for mapping
        const allPlayers = await db
            .select({
                playerName: players.name,
                teamName: teams.name,
                teamLogo: teams.logo,
            })
            .from(players)
            .leftJoin(teams, eq(players.teamId, teams.id))
            .all();

        const playerMap: Record<string, { team: string, logo: string }> = {};
        allPlayers.forEach(p => {
            playerMap[p.playerName.toUpperCase()] = {
                team: p.teamName || 'Unknown',
                logo: p.teamLogo || '/assests/Logos/BRIX-SPORT-LOGO.png'
            };
        });

        // 4. Build leaderboard
        const leaderboard = Object.entries(mvpCounts)
            .map(([name, count]) => {
                const info = playerMap[name] || {
                    team: 'BUSA Athlete',
                    logo: '/assests/Logos/BRIX-SPORT-LOGO.png'
                };
                return {
                    player: name,
                    mvpCount: count,
                    team: info.team,
                    teamLogo: info.logo,
                    rating: 8.0 + (count * 0.2), // Derived rating
                };
            })
            .sort((a, b) => b.mvpCount - a.mvpCount);

        return NextResponse.json({
            success: true,
            leaderboard: leaderboard.slice(0, 10)
        });
    } catch (error) {
        console.error('Error fetching MVP leaderboard:', error);
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
    }
}
