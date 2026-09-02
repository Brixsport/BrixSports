import { NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { enrichPlayersWithAffiliations } from '@/lib/player-data';
import { getPrimaryTeam } from '@/lib/player-affiliation-utils';
import { getPlayerRatingSummaries } from '@/lib/playerRatingSummary';

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

        // BACKLOG-321: MVP names come from a match's stats.mvp string, with no
        // playerId link at all -- resolving a real rating requires a name lookup,
        // and a wrong match would attribute a rating to the wrong real person.
        // Scoped to basketball players' primary team only (reduces cross-sport
        // name collisions), and only kept when a name maps to EXACTLY one player
        // -- any name shared by 2+ basketball players is left unresolved rather
        // than guessed. Never fabricate a rating for a name that can't be
        // uniquely and safely tied to a real playerId.
        const playerMap: Record<string, { team: string, logo: string }> = {};
        const nameToPlayerIds: Record<string, string[]> = {};
        enrichedPlayers.forEach((player) => {
            const team = getPrimaryTeam(player);
            if (team?.sport && !team.sport.toLowerCase().includes('basketball')) return;

            const name = player.name.toUpperCase();
            playerMap[name] = {
                team: team?.name || 'Unknown',
                logo: ('logo' in (team || {})) ? (team as any).logo || '/assests/Logos/BRIX-SPORT-LOGO.png' : '/assests/Logos/BRIX-SPORT-LOGO.png'
            };
            (nameToPlayerIds[name] ??= []).push(player.id);
        });

        const unambiguousPlayerIds = Object.values(nameToPlayerIds)
            .filter(ids => ids.length === 1)
            .map(ids => ids[0]);
        const ratingSummaries = await getPlayerRatingSummaries(unambiguousPlayerIds);
        const ratingByName: Record<string, number | null> = {};
        for (const [name, ids] of Object.entries(nameToPlayerIds)) {
            ratingByName[name] = ids.length === 1
                ? (ratingSummaries.get(ids[0])?.averageRating ?? null)
                : null; // ambiguous (2+ real players share this name) -- never guess
        }

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
                    // BACKLOG-250/255/321: was a fabricated formula (8.0 +
                    // count*0.2), then an explicit null until a real ratings
                    // pipeline existed for basketball. Now the real career
                    // average from playerRatings (via playerRatingSummary.ts),
                    // for any name that resolves to exactly one real basketball
                    // player -- still null (never fabricated) for an unmatched
                    // or ambiguous name, or a real player with no rating history.
                    rating: ratingByName[name] ?? null,
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
