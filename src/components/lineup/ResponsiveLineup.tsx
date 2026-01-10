'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Player } from '@/types';
import { useScreenSize } from '@/hooks/useScreenSize';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { MobilePlayerSheet } from './MobilePlayerSheet';
import { ResponsivePlayerCard } from './ResponsivePlayerCard';

interface TeamData {
    name: string;
    logo: string;
    color: string;
    formation?: string;
}

interface ResponsiveLineupProps {
    homeTeam: TeamData;
    awayTeam: TeamData;
    homePlayers: Record<string, Player>;
    awayPlayers: Record<string, Player>;
    homeLineup: any[];
    awayLineup: any[];
    homeSubs?: any[];
    awaySubs?: any[];
    events?: any[];
    onPlayerClick?: (player: Player) => void;
}

// Formation position mappings (simplified for mobile)
const FORMATION_POSITIONS: Record<string, { top: number; left: number }[]> = {
    '4-3-3': [
        { top: 90, left: 50 }, // GK
        { top: 75, left: 15 }, { top: 75, left: 35 }, { top: 75, left: 65 }, { top: 75, left: 85 }, // DEF
        { top: 55, left: 30 }, { top: 55, left: 50 }, { top: 55, left: 70 }, // MID
        { top: 30, left: 20 }, { top: 30, left: 50 }, { top: 30, left: 80 }, // FWD
    ],
    '4-4-2': [
        { top: 90, left: 50 }, // GK
        { top: 75, left: 15 }, { top: 75, left: 35 }, { top: 75, left: 65 }, { top: 75, left: 85 }, // DEF
        { top: 55, left: 20 }, { top: 55, left: 40 }, { top: 55, left: 60 }, { top: 55, left: 80 }, // MID
        { top: 30, left: 35 }, { top: 30, left: 65 }, // FWD
    ],
    '4-2-3-1': [
        { top: 90, left: 50 }, // GK
        { top: 75, left: 15 }, { top: 75, left: 35 }, { top: 75, left: 65 }, { top: 75, left: 85 }, // DEF
        { top: 60, left: 35 }, { top: 60, left: 65 }, // CDM
        { top: 45, left: 20 }, { top: 45, left: 50 }, { top: 45, left: 80 }, // CAM
        { top: 25, left: 50 }, // ST
    ],
};

function getFormationPositions(formation: string = '4-3-3'): { top: number; left: number }[] {
    return FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-3-3'];
}

// Mobile Pitch Half Component
function MobilePitchHalf({
    team,
    players,
    lineup,
    events = [],
    isTop,
    onPlayerClick,
    screenSize
}: {
    team: TeamData;
    players: Record<string, Player>;
    lineup: any[];
    events?: any[];
    isTop: boolean;
    onPlayerClick: (player: Player) => void;
    screenSize: any;
}) {
    useViewportHeight();
    const positions = getFormationPositions(team.formation);

    return (
        <div className="relative w-full h-full bg-[#2d5016] rounded-xl overflow-hidden">
            {/* Pitch Markings */}
            <div className="absolute inset-0">
                {/* Center line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/20" />
                {/* Penalty box */}
                <div className="absolute bottom-0 left-1/4 right-1/4 h-1/4 border-2 border-white/20 border-b-0" />
                {/* Goal box */}
                <div className="absolute bottom-0 left-1/3 right-1/3 h-1/6 border-2 border-white/20 border-b-0" />
            </div>

            {/* Team Header */}
            <div className="absolute top-3 left-0 right-0 flex items-center justify-center gap-2 z-10">
                <img src={team.logo} alt={team.name} className="w-6 h-6 object-contain" />
                <span className="text-white font-bold text-sm">{team.name}</span>
                {team.formation && (
                    <span className="text-white/60 text-xs">({team.formation})</span>
                )}
            </div>

            {/* Players */}
            {lineup.slice(0, 11).map((lineupPlayer, index) => {
                const player = players[lineupPlayer.playerId];
                if (!player) return null;

                const position = positions[index] || { top: 50, left: 50 };

                // Get sub info
                const subOutEvent = events.find(e =>
                    e.type === 'Substitution' &&
                    e.playerId === player.id
                );

                return (
                    <ResponsivePlayerCard
                        key={player.id}
                        player={player}
                        position={position}
                        rating={lineupPlayer.rating}
                        isCaptain={lineupPlayer.isCaptain}
                        isMotM={lineupPlayer.isMotM}
                        subInfo={subOutEvent ? { type: 'out', minute: subOutEvent.minute } : undefined}
                        teamColor={team.color}
                        screenSize={screenSize}
                        onClick={onPlayerClick}
                    />
                );
            })}
        </div>
    );
}

// Bench Section Component
function BenchSection({
    team,
    players,
    subs,
    events = [],
    onPlayerClick,
    className = ""
}: {
    team: TeamData;
    players: Record<string, Player>;
    subs: any[];
    events?: any[];
    onPlayerClick: (player: Player) => void;
    className?: string;
}) {
    if (!subs || subs.length === 0) return null;

    return (
        <div className={`space-y-2 ${className}`}>
            <h4 className="text-white/60 text-xs font-bold uppercase tracking-wider px-2">Substitutes</h4>
            <div className="grid grid-cols-1 gap-2">
                {subs.map((sub) => {
                    const player = players[sub.playerId];
                    if (!player) return null;

                    // Check if substituted IN
                    const subEvent = events.find(e =>
                        e.type === 'Substitution' &&
                        e.assistPlayerId === player.id
                    );

                    return (
                        <div
                            key={player.id}
                            onClick={() => onPlayerClick(player)}
                            className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors cursor-pointer relative overflow-hidden"
                        >
                            {/* Sub In Indicator */}
                            {subEvent && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />
                            )}

                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border border-white/20 relative"
                                style={{ backgroundColor: team.color }}
                            >
                                {player.number}
                                {subEvent && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center border border-black/50">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-2 h-2 text-black font-bold" strokeWidth="4">
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium truncate block ${subEvent ? 'text-green-400' : 'text-white'}`}>
                                        {player.jerseyName || player.name}
                                    </span>
                                    {subEvent && (
                                        <span className="text-[10px] bg-green-500/20 text-green-400 px-1 rounded font-bold">
                                            {subEvent.minute}'
                                        </span>
                                    )}
                                </div>
                                <span className="text-white/40 text-xs truncate block">
                                    {player.position}
                                </span>
                            </div>
                            {sub.rating && (
                                <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sub.rating >= 7 ? 'bg-green-500/20 text-green-400' :
                                    sub.rating >= 6 ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-white/10 text-white/60'
                                    }`}>
                                    {sub.rating.toFixed(1)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Mobile View - Stacked Vertical
function MobileLineupView({
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    homeSubs = [],
    awaySubs = [],
    events = [],
    onPlayerClick,
    screenSize
}: ResponsiveLineupProps & { onPlayerClick: (player: Player) => void; screenSize: any }) {
    return (
        <div className="space-y-6">
            {/* Away Team - Compact Pitch */}
            <div className="relative bg-[#2d5016] rounded-xl overflow-hidden" style={{ height: 'calc(var(--vh, 1vh) * 45)' }}>
                <MobilePitchHalf
                    team={awayTeam}
                    players={awayPlayers}
                    lineup={awayLineup}
                    events={events}
                    isTop={true}
                    onPlayerClick={onPlayerClick}
                    screenSize={screenSize}
                />
            </div>
            <BenchSection
                team={awayTeam}
                players={awayPlayers}
                subs={awaySubs}
                events={events} // Pass events
                onPlayerClick={onPlayerClick}
            />

            {/* Score/Match Info Strip */}
            <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
                <div className="flex items-center justify-between">
                    <span className="font-bold text-lg text-white">{homeTeam.formation || '4-3-3'}</span>
                    <span className="text-white/40">VS</span>
                    <span className="font-bold text-lg text-white">{awayTeam.formation || '4-3-3'}</span>
                </div>
            </div>

            {/* Home Team - Compact Pitch */}
            <div className="relative bg-[#2d5016] rounded-xl overflow-hidden" style={{ height: 'calc(var(--vh, 1vh) * 45)' }}>
                <MobilePitchHalf
                    team={homeTeam}
                    players={homePlayers}
                    lineup={homeLineup}
                    events={events}
                    isTop={false}
                    onPlayerClick={onPlayerClick}
                    screenSize={screenSize}
                />
            </div>
            <BenchSection
                team={homeTeam}
                players={homePlayers}
                subs={homeSubs}
                events={events} // Pass events
                onPlayerClick={onPlayerClick}
            />
        </div>
    );
}

// Tablet View - Side by Side
function TabletLineupView({
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    homeSubs = [],
    awaySubs = [],
    events = [],
    onPlayerClick,
    screenSize
}: ResponsiveLineupProps & { onPlayerClick: (player: Player) => void; screenSize: any }) {
    return (
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
                <div className="relative bg-[#2d5016] rounded-xl overflow-hidden" style={{ height: '70vh' }}>
                    <MobilePitchHalf
                        team={homeTeam}
                        players={homePlayers}
                        lineup={homeLineup}
                        events={events}
                        isTop={false}
                        onPlayerClick={onPlayerClick}
                        screenSize={screenSize}
                    />
                </div>
                <BenchSection
                    team={homeTeam}
                    players={homePlayers}
                    subs={homeSubs}
                    events={events}
                    onPlayerClick={onPlayerClick}
                />
            </div>

            <div className="space-y-4">
                <div className="relative bg-[#2d5016] rounded-xl overflow-hidden" style={{ height: '70vh' }}>
                    <MobilePitchHalf
                        team={awayTeam}
                        players={awayPlayers}
                        lineup={awayLineup}
                        events={events}
                        isTop={true}
                        onPlayerClick={onPlayerClick}
                        screenSize={screenSize}
                    />
                </div>
                <BenchSection
                    team={awayTeam}
                    players={awayPlayers}
                    subs={awaySubs}
                    events={events}
                    onPlayerClick={onPlayerClick}
                />
            </div>
        </div>
    );
}

// Desktop View - Full Pitch (uses existing FullPitchLineups)
function DesktopLineupView({
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    homeSubs = [],
    awaySubs = [],
    events = [],
    onPlayerClick,
    screenSize
}: ResponsiveLineupProps & { onPlayerClick: (player: Player) => void; screenSize: any }) {
    const positions = getFormationPositions(homeTeam.formation);
    const awayPositions = getFormationPositions(awayTeam.formation);

    return (
        <div className="space-y-4">
            <div className="relative bg-[#2d5016] rounded-xl overflow-hidden" style={{ height: '85vh', minHeight: '700px' }}>
                {/* Full pitch markings */}
                <div className="absolute inset-0">
                    {/* Center line */}
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30 transform -translate-y-1/2" />
                    {/* Center circle */}
                    <div className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-white/30 rounded-full transform -translate-x-1/2 -translate-y-1/2" />

                    {/* Home penalty box */}
                    <div className="absolute bottom-0 left-1/4 right-1/4 h-1/6 border-2 border-white/30 border-b-0" />
                    {/* Away penalty box */}
                    <div className="absolute top-0 left-1/4 right-1/4 h-1/6 border-2 border-white/30 border-t-0" />
                </div>

                {/* Home Team Players */}
                {homeLineup.slice(0, 11).map((lineupPlayer, index) => {
                    const player = homePlayers[lineupPlayer.playerId];
                    if (!player) return null;

                    const position = positions[index] || { top: 50, left: 50 };
                    // Flip for bottom half
                    const adjustedPosition = {
                        top: 50 + (position.top - 50) * 0.45,
                        left: position.left
                    };

                    // Get sub info (Home)
                    const subOutEvent = events.find(e =>
                        e.type === 'Substitution' &&
                        e.playerId === player.id
                    );

                    return (
                        <ResponsivePlayerCard
                            key={player.id}
                            player={player}
                            position={adjustedPosition}
                            rating={lineupPlayer.rating}
                            isCaptain={lineupPlayer.isCaptain}
                            isMotM={lineupPlayer.isMotM}
                            subInfo={subOutEvent ? { type: 'out', minute: subOutEvent.minute } : undefined}
                            teamColor={homeTeam.color}
                            screenSize={screenSize}
                            onClick={onPlayerClick}
                        />
                    );
                })}

                {/* Away Team Players */}
                {awayLineup.slice(0, 11).map((lineupPlayer, index) => {
                    const player = awayPlayers[lineupPlayer.playerId];
                    if (!player) return null;

                    const position = awayPositions[index] || { top: 50, left: 50 };
                    // Flip for top half
                    const adjustedPosition = {
                        top: 50 - (position.top - 50) * 0.45,
                        left: 100 - position.left
                    };

                    // Get sub info (Away)
                    const subOutEvent = events.find(e =>
                        e.type === 'Substitution' &&
                        e.playerId === player.id
                    );

                    return (
                        <ResponsivePlayerCard
                            key={player.id}
                            player={player}
                            position={adjustedPosition}
                            rating={lineupPlayer.rating}
                            isCaptain={lineupPlayer.isCaptain}
                            isMotM={lineupPlayer.isMotM}
                            subInfo={subOutEvent ? { type: 'out', minute: subOutEvent.minute } : undefined}
                            teamColor={awayTeam.color}
                            screenSize={screenSize}
                            onClick={onPlayerClick}
                        />
                    );
                })}
            </div>

            <div className="grid grid-cols-2 gap-8">
                <BenchSection
                    team={homeTeam}
                    players={homePlayers}
                    subs={homeSubs}
                    events={events}
                    onPlayerClick={onPlayerClick}
                    className="bg-white/5 rounded-xl p-4 border border-white/10"
                />
                <BenchSection
                    team={awayTeam}
                    players={awayPlayers}
                    subs={awaySubs}
                    events={events}
                    onPlayerClick={onPlayerClick}
                    className="bg-white/5 rounded-xl p-4 border border-white/10"
                />
            </div>
        </div>
    );
}

// List View Component
function ListView({
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    homeSubs = [],
    awaySubs = [],
    events = [],
    onPlayerClick
}: ResponsiveLineupProps & { onPlayerClick: (player: Player) => void }) {
    const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home');
    const currentTeam = activeTeam === 'home' ? homeTeam : awayTeam;
    const currentPlayers = activeTeam === 'home' ? homePlayers : awayPlayers;
    const currentLineup = activeTeam === 'home' ? homeLineup : awayLineup;

    return (
        <div className="space-y-4">
            {/* Team Toggle */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
                <button
                    onClick={() => setActiveTeam('home')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${activeTeam === 'home' ? 'bg-white/10 text-white' : 'text-white/60'
                        }`}
                >
                    {homeTeam.name}
                </button>
                <button
                    onClick={() => setActiveTeam('away')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${activeTeam === 'away' ? 'bg-white/10 text-white' : 'text-white/60'
                        }`}
                >
                    {awayTeam.name}
                </button>
            </div>

            {/* Player List */}

            <div className="bg-white/5 rounded-xl border border-white/10 p-2">
                <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2 px-2">Starting XI</div>
                <div className="space-y-2">
                    {currentLineup.map((lineupPlayer) => {
                        const player = currentPlayers[lineupPlayer.playerId];
                        if (!player) return null;

                        const subOutEvent = events.find(e => e.type === 'Substitution' && e.playerId === player.id);

                        return (
                            <div
                                key={player.id}
                                onClick={() => onPlayerClick(player)}
                                className="flex items-center gap-4 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer relative overflow-hidden"
                            >
                                {/* Sub Out Indicator */}
                                {subOutEvent && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                                )}

                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold border-2 border-white/30 relative"
                                    style={{ backgroundColor: currentTeam.color }}
                                >
                                    {player.number}
                                    {subOutEvent && (
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border border-white shadow-sm z-10">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-2.5 h-2.5 text-white font-bold" strokeWidth="4">
                                                <path d="M12 5v14M19 12l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-white text-sm">{player.name}</h4>
                                        {subOutEvent && (
                                            <span className="text-[10px] bg-red-500/20 text-red-400 px-1 rounded font-bold">
                                                {subOutEvent.minute}'
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-white/60">{player.position}</p>
                                </div>
                                {lineupPlayer.rating && (
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-white">{lineupPlayer.rating.toFixed(1)}</div>
                                        <div className="text-[10px] text-white/60">Rating</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <BenchSection
                team={currentTeam}
                players={currentPlayers}
                subs={activeTeam === 'home' ? homeSubs : awaySubs}
                events={events} // Pass events
                onPlayerClick={onPlayerClick}
                className="bg-white/5 rounded-xl border border-white/10 p-2"
            />
        </div >
    );
}

// Main Component
export function ResponsiveLineup({
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    homeSubs = [],
    awaySubs = [],
    events = [],
    onPlayerClick
}: ResponsiveLineupProps) {
    const { isMobile, isTablet, isDesktop } = useScreenSize();
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch');

    // Auto-switch to list view on very small screens
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 375) {
            setViewMode('list');
        }
    }, []);

    const screenSize = { isMobile, isTablet, isDesktop };

    const handlePlayerClick = (player: Player) => {
        setSelectedPlayer(player);
        if (!isMobile && onPlayerClick) {
            onPlayerClick(player);
        }
    };

    return (
        <div className="w-full">
            {/* View Toggle - Sticky on Mobile */}
            <div className="sticky top-0 z-20 bg-[#0a0a0a] border-b border-white/10 p-4 mb-4">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <h3 className="font-bold text-lg text-white">Lineups</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('pitch')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'pitch'
                                ? 'bg-primary text-black'
                                : 'bg-white/5 text-white/60'
                                }`}
                        >
                            Pitch
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'list'
                                ? 'bg-primary text-black'
                                : 'bg-white/5 text-white/60'
                                }`}
                        >
                            List
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {viewMode === 'list' ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="pb-8"
                    >
                        <ListView
                            homeTeam={homeTeam}
                            awayTeam={awayTeam}
                            homePlayers={homePlayers}
                            awayPlayers={awayPlayers}
                            homeLineup={homeLineup}
                            awayLineup={awayLineup}
                            homeSubs={homeSubs}
                            awaySubs={awaySubs}
                            events={events}
                            onPlayerClick={handlePlayerClick}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="pitch"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="pb-8"
                    >
                        {/* Responsive Pitch Views */}
                        {isMobile ? (
                            <MobileLineupView
                                homeTeam={homeTeam}
                                awayTeam={awayTeam}
                                homePlayers={homePlayers}
                                awayPlayers={awayPlayers}
                                homeLineup={homeLineup}
                                awayLineup={awayLineup}
                                homeSubs={homeSubs}
                                awaySubs={awaySubs}
                                events={events}
                                onPlayerClick={handlePlayerClick}
                                screenSize={screenSize}
                            />
                        ) : isTablet ? (
                            <TabletLineupView
                                homeTeam={homeTeam}
                                awayTeam={awayTeam}
                                homePlayers={homePlayers}
                                awayPlayers={awayPlayers}
                                homeLineup={homeLineup}
                                awayLineup={awayLineup}
                                homeSubs={homeSubs}
                                awaySubs={awaySubs}
                                events={events}
                                onPlayerClick={handlePlayerClick}
                                screenSize={screenSize}
                            />
                        ) : (
                            <DesktopLineupView
                                homeTeam={homeTeam}
                                awayTeam={awayTeam}
                                homePlayers={homePlayers}
                                awayPlayers={awayPlayers}
                                homeLineup={homeLineup}
                                awayLineup={awayLineup}
                                homeSubs={homeSubs}
                                awaySubs={awaySubs}
                                events={events}
                                onPlayerClick={handlePlayerClick}
                                screenSize={screenSize}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile Player Details Sheet */}
            {isMobile && selectedPlayer && (
                <MobilePlayerSheet
                    player={selectedPlayer}
                    isOpen={!!selectedPlayer}
                    onClose={() => setSelectedPlayer(null)}
                    rating={
                        homeLineup.find(p => p.playerId === selectedPlayer.id)?.rating ||
                        awayLineup.find(p => p.playerId === selectedPlayer.id)?.rating ||
                        homeSubs.find(p => p.playerId === selectedPlayer.id)?.rating ||
                        awaySubs.find(p => p.playerId === selectedPlayer.id)?.rating
                    }
                    teamColor={
                        homePlayers[selectedPlayer.id] ? homeTeam.color : awayTeam.color
                    }
                />
            )}
        </div>
    );
}
