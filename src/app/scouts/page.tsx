'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, 
    Filter, 
    Trophy, 
    Star, 
    MapPin, 
    TrendingUp,
    User,
    ChevronDown,
    BarChart3,
    Eye,
    X
} from 'lucide-react';
import Image from 'next/image';
import { PageSEO, StructuredData } from '@/components/seo';
import { generateWebPageSchema } from '@/lib/utils/aeo';

// Types
interface Player {
    id: string;
    name: string;
    position: string;
    university: string;
    team: string;
    rating: number;
    matches: number;
    goals: number;
    assists: number;
    age: number;
    height: string;
    weight: string;
    image?: string;
    sport: 'Football' | 'Basketball';
    stats: {
        pace?: number;
        shooting?: number;
        passing?: number;
        dribbling?: number;
        defense?: number;
        physical?: number;
    };
    highlights: string[];
}

// Sample player data - replace with actual data fetching
const samplePlayers: Player[] = [
    {
        id: '1',
        name: 'Emmanuel Okafor',
        position: 'Forward',
        university: 'University of Lagos',
        team: 'UNILAG FC',
        rating: 8.5,
        matches: 24,
        goals: 18,
        assists: 7,
        age: 21,
        height: '1.83m',
        weight: '78kg',
        sport: 'Football',
        stats: {
            pace: 85,
            shooting: 82,
            passing: 75,
            dribbling: 88,
            defense: 45,
            physical: 80,
        },
        highlights: ['Top scorer NUGA 2024', 'Player of the Month March'],
    },
    {
        id: '2',
        name: 'Chinedu Obi',
        position: 'Midfielder',
        university: 'Bells University',
        team: 'Kings FC',
        rating: 8.2,
        matches: 26,
        goals: 8,
        assists: 15,
        age: 20,
        height: '1.78m',
        weight: '72kg',
        sport: 'Football',
        stats: {
            pace: 78,
            shooting: 75,
            passing: 90,
            dribbling: 85,
            defense: 70,
            physical: 75,
        },
        highlights: ['BUSA League MVP 2024', 'Most Assists'],
    },
    {
        id: '3',
        name: 'Samuel Adeyemi',
        position: 'Defender',
        university: 'Covenant University',
        team: 'CU Eagles',
        rating: 8.0,
        matches: 22,
        goals: 2,
        assists: 3,
        age: 22,
        height: '1.90m',
        weight: '85kg',
        sport: 'Football',
        stats: {
            pace: 72,
            shooting: 50,
            passing: 78,
            dribbling: 65,
            defense: 88,
            physical: 85,
        },
        highlights: ['Best Defender NPUGA 2024'],
    },
    {
        id: '4',
        name: 'David Okonkwo',
        position: 'Guard',
        university: 'University of Ibadan',
        team: 'UI Warriors',
        rating: 8.7,
        matches: 20,
        goals: 0,
        assists: 0,
        age: 21,
        height: '1.85m',
        weight: '80kg',
        sport: 'Basketball',
        stats: {
            pace: 88,
            shooting: 90,
            passing: 85,
            dribbling: 92,
            defense: 75,
            physical: 78,
        },
        highlights: ['Top Scorer BUCS Basketball', 'MVP Finals'],
    },
];

const positions = ['All', 'Forward', 'Midfielder', 'Defender', 'Goalkeeper', 'Guard', 'Center', 'Forward-Center'];
const sports = ['All', 'Football', 'Basketball'];
const universities = ['All', 'University of Lagos', 'Bells University', 'Covenant University', 'University of Ibadan', 
    'University of Nigeria', 'Ahmadu Bello University', 'Obafemi Awolowo University'];
const ratingRanges = ['All', '8.0+', '7.5+', '7.0+'];

export default function ScoutsPage() {
    const [players, setPlayers] = useState<Player[]>(samplePlayers);
    const [filteredPlayers, setFilteredPlayers] = useState<Player[]>(samplePlayers);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    
    // Filters
    const [positionFilter, setPositionFilter] = useState('All');
    const [sportFilter, setSportFilter] = useState('All');
    const [universityFilter, setUniversityFilter] = useState('All');
    const [ratingFilter, setRatingFilter] = useState('All');
    const [showFilters, setShowFilters] = useState(false);

    // Apply filters
    useEffect(() => {
        let filtered = players;

        if (searchQuery) {
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.university.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.team.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (positionFilter !== 'All') {
            filtered = filtered.filter(p => p.position === positionFilter);
        }

        if (sportFilter !== 'All') {
            filtered = filtered.filter(p => p.sport === sportFilter);
        }

        if (universityFilter !== 'All') {
            filtered = filtered.filter(p => p.university === universityFilter);
        }

        if (ratingFilter !== 'All') {
            const minRating = parseFloat(ratingFilter.replace('+', ''));
            filtered = filtered.filter(p => p.rating >= minRating);
        }

        setFilteredPlayers(filtered);
    }, [searchQuery, positionFilter, sportFilter, universityFilter, ratingFilter, players]);

    const clearFilters = () => {
        setPositionFilter('All');
        setSportFilter('All');
        setUniversityFilter('All');
        setRatingFilter('All');
        setSearchQuery('');
    };

    const hasActiveFilters = positionFilter !== 'All' || sportFilter !== 'All' || 
        universityFilter !== 'All' || ratingFilter !== 'All' || searchQuery !== '';

    return (
        <>
            <PageSEO
                title="Talent Scout Hub - Discover Nigeria's Best University Athletes"
                description="BRIXSPORTS' premium scout platform. Discover talented student athletes from Nigerian universities with comprehensive stats, ratings, and video highlights."
                keywords={['scouts', 'talent scouting', 'university players', 'Nigerian athletes', 'player discovery', 'BRIXSPORTS']}
                ogImage="/assets/Logos/BRIX-SPORT-LOGO.png"
            />
            
            <StructuredData 
                data={generateWebPageSchema({
                    title: 'Talent Scout Hub - BRIXSPORTS',
                    description: 'Discover talented student athletes from Nigerian universities',
                })}
                id="scouts-page-schema"
            />

            <div className="min-h-screen bg-[#050505] text-white pb-24">
                {/* Header */}
                <div className="bg-gradient-to-b from-primary/20 to-transparent pt-12 pb-8 px-4 md:px-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl md:text-5xl font-display italic uppercase tracking-tight">
                                    Talent Scout Hub
                                </h1>
                                <p className="text-white/60 mt-2 text-lg">
                                    Discover Nigeria&apos;s next generation of sporting talent
                                </p>
                            </div>
                            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                                <Trophy className="w-5 h-5 text-primary" />
                                <span className="text-sm font-medium">{filteredPlayers.length} Players Available</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scout Pitch Banner */}
                <div className="px-4 md:px-8 mb-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/20 rounded-2xl p-6">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                                        <Eye className="w-6 h-6 text-primary" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-white mb-1">
                                        Premium Scout Access
                                    </h3>
                                    <p className="text-white/70 text-sm">
                                        Access detailed player analytics, performance ratings, video highlights, and 
                                        direct contact information. Our platform is trusted by professional scouts 
                                        and clubs across Nigeria.
                                    </p>
                                </div>
                                <a 
                                    href="mailto:scouts@brixsports.com" 
                                    className="flex-shrink-0 bg-primary text-black font-bold py-2 px-6 rounded-xl hover:bg-primary/90 transition-colors text-center"
                                >
                                    Upgrade to Pro
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="px-4 md:px-8 mb-6">
                    <div className="max-w-7xl mx-auto">
                        {/* Search Bar */}
                        <div className="flex gap-3 mb-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="text"
                                    placeholder="Search players, universities, or teams..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-primary/50"
                                />
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                                    showFilters || hasActiveFilters 
                                        ? 'bg-primary/20 border-primary text-primary' 
                                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                                }`}
                            >
                                <Filter className="w-5 h-5" />
                                <span className="hidden md:inline font-medium">Filters</span>
                                {hasActiveFilters && (
                                    <span className="bg-primary text-black text-xs font-bold px-2 py-0.5 rounded-full">
                                        Active
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Filter Options */}
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {/* Position Filter */}
                                            <div>
                                                <label className="text-xs text-white/40 uppercase font-bold tracking-wider mb-2 block">
                                                    Position
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={positionFilter}
                                                        onChange={(e) => setPositionFilter(e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white appearance-none focus:outline-none focus:border-primary/50"
                                                    >
                                                        {positions.map(pos => (
                                                            <option key={pos} value={pos}>{pos}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                                                </div>
                                            </div>

                                            {/* Sport Filter */}
                                            <div>
                                                <label className="text-xs text-white/40 uppercase font-bold tracking-wider mb-2 block">
                                                    Sport
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={sportFilter}
                                                        onChange={(e) => setSportFilter(e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white appearance-none focus:outline-none focus:border-primary/50"
                                                    >
                                                        {sports.map(sport => (
                                                            <option key={sport} value={sport}>{sport}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                                                </div>
                                            </div>

                                            {/* University Filter */}
                                            <div>
                                                <label className="text-xs text-white/40 uppercase font-bold tracking-wider mb-2 block">
                                                    University
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={universityFilter}
                                                        onChange={(e) => setUniversityFilter(e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white appearance-none focus:outline-none focus:border-primary/50"
                                                    >
                                                        {universities.map(uni => (
                                                            <option key={uni} value={uni}>{uni}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                                                </div>
                                            </div>

                                            {/* Rating Filter */}
                                            <div>
                                                <label className="text-xs text-white/40 uppercase font-bold tracking-wider mb-2 block">
                                                    Rating
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={ratingFilter}
                                                        onChange={(e) => setRatingFilter(e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white appearance-none focus:outline-none focus:border-primary/50"
                                                    >
                                                        {ratingRanges.map(range => (
                                                            <option key={range} value={range}>{range}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>

                                        {hasActiveFilters && (
                                            <button
                                                onClick={clearFilters}
                                                className="mt-4 text-sm text-white/60 hover:text-white flex items-center gap-2 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                                Clear all filters
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Players Grid */}
                <div className="px-4 md:px-8">
                    <div className="max-w-7xl mx-auto">
                        {filteredPlayers.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search className="w-8 h-8 text-white/20" />
                                </div>
                                <h3 className="text-lg font-bold text-white/60 mb-2">No players found</h3>
                                <p className="text-white/40">Try adjusting your filters or search query</p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredPlayers.map((player) => (
                                    <motion.div
                                        key={player.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        whileHover={{ y: -4 }}
                                        onClick={() => setSelectedPlayer(player)}
                                        className="bg-white/5 border border-white/10 rounded-2xl p-5 cursor-pointer hover:border-primary/30 transition-all group"
                                    >
                                        {/* Player Header */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center overflow-hidden">
                                                    {player.image ? (
                                                        <Image 
                                                            src={player.image} 
                                                            alt={player.name}
                                                            width={56}
                                                            height={56}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <User className="w-7 h-7 text-white/40" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-white group-hover:text-primary transition-colors">
                                                        {player.name}
                                                    </h3>
                                                    <p className="text-xs text-white/50">{player.position}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 bg-primary/20 px-2 py-1 rounded-lg">
                                                <Star className="w-3 h-3 text-primary fill-primary" />
                                                <span className="text-sm font-bold text-primary">{player.rating}</span>
                                            </div>
                                        </div>

                                        {/* University & Team */}
                                        <div className="flex items-center gap-2 mb-4 text-xs text-white/50">
                                            <MapPin className="w-3 h-3" />
                                            <span className="truncate">{player.university}</span>
                                        </div>

                                        {/* Stats */}
                                        <div className="grid grid-cols-3 gap-2 mb-4">
                                            <div className="bg-white/5 rounded-lg p-2 text-center">
                                                <p className="text-lg font-bold text-white">{player.matches}</p>
                                                <p className="text-[10px] text-white/40 uppercase">Matches</p>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-2 text-center">
                                                <p className="text-lg font-bold text-primary">{player.goals}</p>
                                                <p className="text-[10px] text-white/40 uppercase">
                                                    {player.sport === 'Basketball' ? 'Points' : 'Goals'}
                                                </p>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-2 text-center">
                                                <p className="text-lg font-bold text-white">{player.assists}</p>
                                                <p className="text-[10px] text-white/40 uppercase">Assists</p>
                                            </div>
                                        </div>

                                        {/* Highlights */}
                                        {player.highlights.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {player.highlights.slice(0, 2).map((highlight, idx) => (
                                                    <span 
                                                        key={idx}
                                                        className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full"
                                                    >
                                                        {highlight}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* View Button */}
                                        <button className="w-full mt-4 py-2 bg-white/5 hover:bg-primary/20 text-white/60 hover:text-primary 
                                            rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                            <BarChart3 className="w-4 h-4" />
                                            View Full Profile
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Player Detail Modal */}
                <AnimatePresence>
                    {selectedPlayer && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedPlayer(null)}
                            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-[#0a0a0a] border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                            >
                                {/* Modal Header */}
                                <div className="p-6 border-b border-white/10">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center overflow-hidden">
                                                {selectedPlayer.image ? (
                                                    <Image 
                                                        src={selectedPlayer.image}
                                                        alt={selectedPlayer.name}
                                                        width={80}
                                                        height={80}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <User className="w-10 h-10 text-white/40" />
                                                )}
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-white">{selectedPlayer.name}</h2>
                                                <p className="text-white/60">{selectedPlayer.position} • {selectedPlayer.team}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <MapPin className="w-4 h-4 text-white/40" />
                                                    <span className="text-sm text-white/60">{selectedPlayer.university}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedPlayer(null)}
                                            className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                                        >
                                            <X className="w-6 h-6 text-white/40" />
                                        </button>
                                    </div>
                                </div>

                                {/* Modal Content */}
                                <div className="p-6 space-y-6">
                                    {/* Overall Rating */}
                                    <div className="flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="w-24 h-24 rounded-full bg-primary/20 border-4 border-primary flex items-center justify-center mb-2">
                                                <span className="text-4xl font-bold text-primary">{selectedPlayer.rating}</span>
                                            </div>
                                            <p className="text-sm text-white/60">Overall Rating</p>
                                        </div>
                                    </div>

                                    {/* Physical Stats */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-white/5 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-bold text-white">{selectedPlayer.age}</p>
                                            <p className="text-xs text-white/40 uppercase">Age</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-bold text-white">{selectedPlayer.height}</p>
                                            <p className="text-xs text-white/40 uppercase">Height</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-bold text-white">{selectedPlayer.weight}</p>
                                            <p className="text-xs text-white/40 uppercase">Weight</p>
                                        </div>
                                    </div>

                                    {/* Performance Stats */}
                                    {selectedPlayer.stats && (
                                        <div>
                                            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">
                                                Performance Stats
                                            </h3>
                                            <div className="space-y-3">
                                                {Object.entries(selectedPlayer.stats).map(([stat, value]) => (
                                                    <div key={stat} className="flex items-center gap-4">
                                                        <span className="text-sm text-white/60 w-24 capitalize">{stat}</span>
                                                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${value}%` }}
                                                                className="h-full bg-primary rounded-full"
                                                            />
                                                        </div>
                                                        <span className="text-sm font-bold text-white w-8">{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Highlights */}
                                    {selectedPlayer.highlights.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">
                                                Achievements
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedPlayer.highlights.map((highlight, idx) => (
                                                    <span 
                                                        key={idx}
                                                        className="bg-primary/20 text-primary px-4 py-2 rounded-xl text-sm font-medium"
                                                    >
                                                        {highlight}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Contact CTA */}
                                    <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 text-center">
                                        <p className="text-white/80 mb-4">
                                            Interested in recruiting {selectedPlayer.name}?
                                        </p>
                                        <a 
                                            href="mailto:scouts@brixsports.com"
                                            className="inline-flex items-center gap-2 bg-primary text-black font-bold py-3 px-6 rounded-xl hover:bg-primary/90 transition-colors"
                                        >
                                            <Eye className="w-5 h-5" />
                                            Request Full Scout Report
                                        </a>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
