import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { enrichPlayersWithAffiliations } from '@/lib/player-data';
import { getPrimaryTeam } from '@/lib/player-affiliation-utils';

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
            .select()
            .from(players)
            .all();
        const enrichedPlayers = await enrichPlayersWithAffiliations(allPlayers);

        const playerMap: Record<string, { team: string, logo: string }> = {};
        enrichedPlayers.forEach((player) => {
            const team = getPrimaryTeam(player);
            playerMap[player.name.toUpperCase()] = {
                team: team?.name || 'Unknown',
                logo: ('logo' in (team || {})) ? (team as any).logo || '/assests/Logos/BRIX-SPORT-LOGO.png' : '/assests/Logos/BRIX-SPORT-LOGO.png'
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
