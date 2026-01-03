'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Filter, ChevronLeft, ChevronRight, MapPin, Trophy, List, CalendarDays } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';
import FixtureCard from '@/components/FixtureCard';
import MatchCalendar from '@/components/MatchCalendar';

interface Fixture {
    id: string;
    sport: string;
    homeTeam: any;
    awayTeam: any;
    homeScore: number;
    awayScore: number;
    status: string;
    startTime: Date;
    venue: string;
    competition: any;
}

export default function FixturesPage() {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [fixturesByDate, setFixturesByDate] = useState<Record<string, Fixture[]>>({});
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [view, setView] = useState<'today' | 'week' | 'month' | 'all'>('week');
    const [selectedSport, setSelectedSport] = useState<string | null>(null);
    const [selectedCompetition, setSelectedCompetition] = useState<string | null>(null);
    const [displayMode, setDisplayMode] = useState<'list' | 'calendar'>('list');

    useEffect(() => {
        fetchFixtures();
    }, [view, selectedSport, selectedCompetition, selectedDate]);

    const fetchFixtures = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();

            params.append('view', view);
            if (selectedSport) params.append('sport', selectedSport);
            if (selectedCompetition) params.append('competitionId', selectedCompetition);

            if (view === 'today') {
                params.append('date', format(selectedDate, 'yyyy-MM-dd'));
            }

            const response = await fetch(`/api/fixtures?${params}`);
            const data = await response.json();

            setFixtures(data.fixtures || []);
            setFixturesByDate(data.fixturesByDate || {});
        } catch (error) {
            console.error('Error fetching fixtures:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (date: Date) => {
        setSelectedDate(date);
        setView('today');
    };

    const handlePreviousDay = () => {
        setSelectedDate(prev => addDays(prev, -1));
    };

    const handleNextDay = () => {
        setSelectedDate(prev => addDays(prev, 1));
    };

    const handleToday = () => {
        setSelectedDate(new Date());
        setView('today');
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white pb-20">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                                Fixtures & Schedule
                            </h1>
                            <p className="text-white/60 mt-1">
                                {view === 'today' && `Matches on ${format(selectedDate, 'MMMM d, yyyy')}`}
                                {view === 'week' && 'This Week\'s Matches'}
                                {view === 'month' && 'This Month\'s Matches'}
                                {view === 'all' && 'All Upcoming Matches'}
                            </p>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-3">
                            {/* View Mode Toggle */}
                            <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                                <button
                                    onClick={() => setDisplayMode('list')}
                                    className={`px-3 py-1.5 rounded-md transition-colors ${displayMode === 'list'
                                        ? 'bg-primary text-white'
                                        : 'text-white/60 hover:text-white'
                                        }`}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setDisplayMode('calendar')}
                                    className={`px-3 py-1.5 rounded-md transition-colors ${displayMode === 'calendar'
                                        ? 'bg-primary text-white'
                                        : 'text-white/60 hover:text-white'
                                        }`}
                                >
                                    <CalendarDays className="w-4 h-4" />
                                </button>
                            </div>

                            <button
                                onClick={handleToday}
                                className="px-4 py-2 bg-primary/20 text-primary rounded-lg border border-primary/50 hover:bg-primary/30 transition-colors"
                            >
                                Today
                            </button>
                        </div>
                    </div>

                    {/* View Selector */}
                    <div className="flex gap-3 mb-4">
                        <button
                            onClick={() => setView('today')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'today'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            📅 Today
                        </button>
                        <button
                            onClick={() => setView('week')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'week'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            📆 This Week
                        </button>
                        <button
                            onClick={() => setView('month')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'month'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            🗓️ This Month
                        </button>
                        <button
                            onClick={() => setView('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'all'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            📋 All
                        </button>
                    </div>

                    {/* Date Navigation (for Today view) */}
                    {view === 'today' && (
                        <div className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/10">
                            <button
                                onClick={handlePreviousDay}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <div className="text-center">
                                <div className="text-2xl font-bold">
                                    {format(selectedDate, 'EEEE, MMMM d')}
                                </div>
                                <div className="text-sm text-white/60">
                                    {format(selectedDate, 'yyyy')}
                                </div>
                            </div>

                            <button
                                onClick={handleNextDay}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex gap-3 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                        {/* Sport Filter */}
                        {['Football', 'Basketball', 'Track'].map(sport => (
                            <button
                                key={sport}
                                onClick={() => setSelectedSport(selectedSport === sport ? null : sport)}
                                className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${selectedSport === sport
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                                    }`}
                            >
                                {sport === 'Football' ? '⚽' : sport === 'Basketball' ? '🏀' : '🏃'} {sport}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : displayMode === 'calendar' ? (
                    /* Calendar View */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Calendar */}
                        <div className="lg:col-span-2">
                            <MatchCalendar
                                fixtures={fixtures}
                                onDateSelect={handleDateChange}
                                selectedDate={selectedDate}
                            />
                        </div>

                        {/* Selected Date Fixtures */}
                        <div>
                            <h3 className="text-xl font-bold mb-4">
                                {format(selectedDate, 'MMMM d, yyyy')}
                            </h3>
                            {fixturesByDate[format(selectedDate, 'yyyy-MM-dd')]?.length > 0 ? (
                                <div className="space-y-4">
                                    {fixturesByDate[format(selectedDate, 'yyyy-MM-dd')].map((fixture) => (
                                        <FixtureCard key={fixture.id} fixture={fixture} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 bg-white/5 rounded-xl border border-white/10">
                                    <Calendar className="w-12 h-12 text-white/20 mx-auto mb-2" />
                                    <p className="text-white/60">No matches on this date</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : Object.keys(fixturesByDate).length === 0 ? (
                    /* Empty State */
                    <div className="text-center py-20">
                        <Calendar className="w-16 h-16 text-white/20 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white/60 mb-2">No fixtures found</h3>
                        <p className="text-white/40">
                            {selectedSport || selectedCompetition
                                ? 'Try adjusting your filters'
                                : 'No matches scheduled for this period'}
                        </p>
                    </div>
                ) : (
                    /* List View */
                    <div className="space-y-8">
                        {Object.entries(fixturesByDate).map(([date, dateFixtures]) => (
                            <div key={date}>
                                {/* Date Header */}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                    <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10">
                                        <span className="font-semibold">
                                            {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                                        </span>
                                    </div>
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                </div>

                                {/* Fixtures for this date */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <AnimatePresence mode="popLayout">
                                        {dateFixtures.map((fixture, index) => (
                                            <motion.div
                                                key={fixture.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -20 }}
                                                transition={{ delay: index * 0.05 }}
                                            >
                                                <FixtureCard fixture={fixture} />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
