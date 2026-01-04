'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Trophy } from 'lucide-react';

interface Match {
    id: string;
    sport: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam?: { name: string; shortName: string; logo: string };
    awayTeam?: { name: string; shortName: string; logo: string };
    startTime: string;
    venue: string;
    competition: string;
    status: string;
}

interface MatchSelectorProps {
    onSelectMatch: (match: Match) => void;
    selectedMatchId?: string;
}

export function MatchSelector({ onSelectMatch, selectedMatchId }: MatchSelectorProps) {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'Football' | 'Basketball'>('all');

    useEffect(() => {
        fetchMatches();
    }, []);

    const fetchMatches = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/matches?status=UPCOMING');
            const data = await response.json();

            // Handle different API response formats
            if (Array.isArray(data)) {
                setMatches(data);
            } else if (data.matches && Array.isArray(data.matches)) {
                setMatches(data.matches);
            } else if (data.success && Array.isArray(data.data)) {
                setMatches(data.data);
            } else {
                console.error('Unexpected API response format:', data);
                setMatches([]);
            }
        } catch (error) {
            console.error('Error fetching matches:', error);
            setMatches([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredMatches = filter === 'all'
        ? matches
        : matches.filter(m => m.sport === filter);

    if (loading) {
        return (
            <div className="py-12 text-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-white/60">Loading matches...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filter Tabs */}
            <div className="flex gap-2">
                {(['all', 'Football', 'Basketball'] as const).map((sport) => (
                    <button
                        key={sport}
                        onClick={() => setFilter(sport)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === sport
                            ? 'bg-primary text-black'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        {sport}
                    </button>
                ))}
            </div>

            {/* Matches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMatches.length === 0 ? (
                    <div className="col-span-2 text-center py-12">
                        <p className="text-white/40">No upcoming matches found</p>
                    </div>
                ) : (
                    filteredMatches.map((match) => (
                        <MatchCard
                            key={match.id}
                            match={match}
                            isSelected={match.id === selectedMatchId}
                            onClick={() => onSelectMatch(match)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function MatchCard({ match, isSelected, onClick }: {
    match: Match;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`w-full text-left bg-white/5 border rounded-2xl p-4 transition-all ${isSelected
                ? 'border-primary bg-primary/10'
                : 'border-white/10 hover:border-white/20'
                }`}
        >
            {/* Competition & Sport */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Trophy size={12} className="text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {match.competition}
                    </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    {match.sport}
                </span>
            </div>

            {/* Teams */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                    {match.homeTeam?.logo && (
                        match.homeTeam.logo.startsWith('/') || match.homeTeam.logo.startsWith('http') ? (
                            <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-8 h-8 object-contain" />
                        ) : (
                            <span className="text-2xl">{match.homeTeam.logo}</span>
                        )
                    ) || <span className="text-2xl">⚽</span>}
                    <span className="text-sm font-black uppercase tracking-tight">
                        {match.homeTeam?.shortName || 'TBD'}
                    </span>
                </div>
                <span className="text-white/40 text-xs font-bold mx-2">VS</span>
                <div className="flex items-center gap-3 flex-1 justify-end">
                    <span className="text-sm font-black uppercase tracking-tight">
                        {match.awayTeam?.shortName || 'TBD'}
                    </span>
                    {match.awayTeam?.logo && (
                        match.awayTeam.logo.startsWith('/') || match.awayTeam.logo.startsWith('http') ? (
                            <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-8 h-8 object-contain" />
                        ) : (
                            <span className="text-2xl">{match.awayTeam.logo}</span>
                        )
                    ) || <span className="text-2xl">⚽</span>}
                </div>
            </div>

            {/* Match Details */}
            <div className="flex items-center gap-4 text-[10px] text-white/60">
                <div className="flex items-center gap-1">
                    <Calendar size={10} />
                    <span>{new Date(match.startTime).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                    <MapPin size={10} />
                    <span>{match.venue}</span>
                </div>
            </div>
        </motion.button>
    );
}
