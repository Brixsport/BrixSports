'use client';

import React from 'react';
import { Player, Team, LineupEntry, MatchEvent } from '@/types';
import { processLineup } from '@/lib/lineup-processing';
import { PitchMarkings } from './PitchMarkings';
import { PitchPlayer } from './PitchPlayer';
import { cn } from '@/lib/utils'; // Assuming this exists for tailwind merging

interface MatchLineupProps {
    homeTeam: Team;
    awayTeam: Team;
    homeLineup: LineupEntry[];
    awayLineup: LineupEntry[];
    homePlayers: Record<string, Player>; // Map by ID
    awayPlayers: Record<string, Player>; // Map by ID
    homeFormation?: string;
    awayFormation?: string;
    events?: MatchEvent[];
    onPlayerClick?: (player: Player) => void;
}

export function MatchLineup({
    homeTeam,
    awayTeam,
    homeLineup,
    awayLineup,
    homePlayers,
    awayPlayers,
    homeFormation = '4-4-2',
    awayFormation = '4-4-2',
    events = [],
    onPlayerClick
}: MatchLineupProps) {

    // Helper to get player stats from events
    const getPlayerMatchStats = (playerId: string) => {
        const playerEvents = events.filter(e => e.playerId === playerId);
        const goals = playerEvents.filter(e => e.type === 'Goal').length;
        const subOut = playerEvents.find(e => e.type === 'Substitution' && e.detail === 'Out');
        // Note: Substitution event usually has `playerId` as the player coming IN or OUT depending on structure.
        // Assuming typical structure: Substitution event might verify who left.
        // If event structure is simple (type='Substitution', playerId=playerOutId?), let's assume standard logic:
        // Or events might be linked. 
        // Let's look at `MatchEvent` definition: type, minute, playerId. `detail` might say "in for X" or similar.
        // If unsure, we check if there's a sub event for this player.

        // Simpler check: Did this player have a 'Substitution' event where they left?
        // Assuming current infra implies `playerId` in the event is the primary actor.
        // For sub, it's ambiguous without checking 'detail' or 'assistId'.
        // Let's assume detail contains "Player Out" or similar if pertinent.
        // Alternatively, check if the event matches the logic for 'subbed out'.

        const subEvent = events.find(e => e.type === 'Substitution' && e.playerId === playerId);
        // If e.playerId is the one LEAVING or ENTERING. Usually entering.
        // But for lineup (starters), we care if they LEFT.
        // If this player is a starter, and involved in a sub event, they likely left.

        return {
            goals,
            subTime: subEvent ? `${subEvent.minute}'` : undefined
        };
    };

    // 1. Prepare Data for Processing
    // We need to merge LineupEntry (rating, events?) with Player (name, number)
    const preparePlayers = (lineup: LineupEntry[], playersMap: Record<string, Player>) => {
        return lineup
            .filter(entry => entry.isStarter !== false) // Only starters on pitch
            .map(entry => {
                const basePlayer = playersMap[entry.playerId];
                if (!basePlayer) return null;

                const stats = getPlayerMatchStats(entry.playerId);

                return {
                    ...basePlayer,
                    position: entry.position || basePlayer.position,
                    _rating: entry.rating,
                    _isCaptain: entry.isCaptain,
                    _isMotM: entry.isMotM,
                    _goals: stats.goals,
                    _subTime: stats.subTime
                };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);
    };

    const homeStarterPlayers = preparePlayers(homeLineup, homePlayers);
    const awayStarterPlayers = preparePlayers(awayLineup, awayPlayers);

    // 2. Process Positions
    const homeLayout = processLineup(homeStarterPlayers, homeFormation, true);
    const awayLayout = processLineup(awayStarterPlayers, awayFormation, false);

    return (
        <div className="w-full flex flex-col gap-4">

            {/* Header Info */}
            <div className="flex justify-between items-center px-4 py-2 bg-zinc-900/50 rounded-lg backdrop-blur-sm border border-white/5">
                <div className="flex flex-col">
                    <span className="text-xs text-zinc-400">Home Formation</span>
                    <span className="font-bold text-white">{homeFormation}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-xs text-zinc-400">Away Formation</span>
                    <span className="font-bold text-white">{awayFormation}</span>
                </div>
            </div>

            {/* Scrollable Pitch Container */}
            <div className="relative w-full overflow-x-hidden overflow-y-auto bg-[#0f1419] rounded-xl border border-white/10 shadow-2xl" style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>

                {/* The Tall Pitch Content */}
                <div className="relative w-full" style={{ height: '1200px' }}>

                    {/* Background */}
                    <div className="absolute inset-0 bg-gradient-to-b from-[#1a4d2e] to-[#0f2e1b]">
                        {/* Grass pattern */}
                        <div className="absolute inset-0 opacity-20"
                            style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 49px, rgba(0,0,0,0.1) 49px, rgba(0,0,0,0.1) 50px)' }}>
                        </div>
                    </div>

                    {/* Markings */}
                    <PitchMarkings className="absolute inset-0 w-full h-full pointer-events-none z-0" />

                    {/* Formation Label (Top-Left) */}
                    <div className="absolute top-4 left-4 z-0 text-white/20 text-4xl font-black uppercase tracking-wider select-none pointer-events-none">
                        {awayFormation}
                    </div>
                    <div className="absolute bottom-4 right-4 z-0 text-white/20 text-4xl font-black uppercase tracking-wider select-none pointer-events-none">
                        {homeFormation}
                    </div>


                    {/* PLAYERS LAYER */}
                    <div className="absolute inset-0 z-10">
                        {/* Away Team (Top) */}
                        {awayLayout.map((item) => (
                            <PitchPlayer
                                key={item.player.id}
                                player={item.player}
                                x={item.x}
                                y={item.y}
                                color={awayTeam.color}
                                rating={(item.player as any)._rating}
                                isCaptain={(item.player as any)._isCaptain}
                                isMotM={(item.player as any)._isMotM}
                                goals={(item.player as any)._goals}
                                substitutionTime={(item.player as any)._subTime}
                                onClick={() => onPlayerClick?.(item.player)}
                            // Add goals/subs if available in player stats or lineup events
                            />
                        ))}

                        {/* Home Team (Bottom) */}
                        {homeLayout.map((item) => (
                            <PitchPlayer
                                key={item.player.id}
                                player={item.player}
                                x={item.x}
                                y={item.y}
                                color={homeTeam.color}
                                rating={(item.player as any)._rating}
                                isCaptain={(item.player as any)._isCaptain}
                                isMotM={(item.player as any)._isMotM}
                                goals={(item.player as any)._goals}
                                substitutionTime={(item.player as any)._subTime}
                                onClick={() => onPlayerClick?.(item.player)}
                            />
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
}
