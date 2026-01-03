'use client';

import { motion } from 'framer-motion';
import { Clock, MapPin, Bell, BellOff, Calendar } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useState } from 'react';
import MatchStatusBadge from './MatchStatusBadge';

interface FixtureCardProps {
    fixture: {
        id: string;
        sport: string;
        homeTeam: {
            id: string;
            name: string;
            shortName: string;
            logo: string;
            color: string;
        };
        awayTeam: {
            id: string;
            name: string;
            shortName: string;
            logo: string;
            color: string;
        };
        homeScore?: number;
        awayScore?: number;
        status: string;
        startTime: Date;
        venue: string;
        competition?: {
            id: string;
            name: string;
            logo?: string;
        };
    };
}

export default function FixtureCard({ fixture }: FixtureCardProps) {
    const [isReminded, setIsReminded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const isUpcoming = fixture.status === 'UPCOMING';
    const isLive = fixture.status === 'LIVE' || fixture.status === 'HALF_TIME';
    const isFinished = fixture.status === 'FINISHED';

    const handleSetReminder = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Get user ID from localStorage or auth context
        const userId = localStorage.getItem('userId') || 'guest-user';

        setIsLoading(true);

        try {
            if (!isReminded) {
                // Create reminder
                const response = await fetch('/api/reminders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        matchId: fixture.id,
                        minutesBefore: 15, // 15 minutes before match
                    }),
                });

                if (response.ok) {
                    setIsReminded(true);
                    // Show success toast (if you have a toast system)
                    console.log('✅ Reminder set! You\'ll be notified 15 minutes before the match.');
                } else {
                    const error = await response.json();
                    console.error('Failed to set reminder:', error.error);
                }
            } else {
                // Delete reminder
                const response = await fetch(`/api/reminders?userId=${userId}&matchId=${fixture.id}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    setIsReminded(false);
                    console.log('Reminder removed');
                }
            }
        } catch (error) {
            console.error('Error managing reminder:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddToCalendar = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Create calendar event
        const event = {
            title: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
            description: `${fixture.competition?.name || 'Match'} at ${fixture.venue}`,
            location: fixture.venue,
            startTime: new Date(fixture.startTime),
            endTime: new Date(new Date(fixture.startTime).getTime() + 2 * 60 * 60 * 1000), // 2 hours
        };

        // Generate Google Calendar URL
        const startTimeStr = event.startTime.toISOString().replace(/-|:|\.\d\d\d/g, '');
        const endTimeStr = event.endTime.toISOString().replace(/-|:|\.\d\d\d/g, '');
        const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startTimeStr}/${endTimeStr}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}`;

        window.open(calendarUrl, '_blank');
    };

    return (
        <Link href={`/matches/${fixture.id}`}>
            <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative overflow-hidden rounded-2xl border transition-all cursor-pointer ${isLive
                    ? 'bg-gradient-to-br from-red-500/10 via-purple-500/10 to-pink-500/10 border-red-500/30 shadow-lg shadow-red-500/20'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
            >
                {/* Live Indicator */}
                {isLive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-purple-500 to-pink-500 animate-pulse" />
                )}

                <div className="p-4">
                    {/* Competition & Status */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            {fixture.competition?.logo && (
                                <img
                                    src={fixture.competition.logo}
                                    alt={fixture.competition.name}
                                    className="w-5 h-5 rounded object-cover"
                                />
                            )}
                            <span className="text-xs font-medium text-white/60">
                                {fixture.competition?.name || 'Match'}
                            </span>
                        </div>
                        <MatchStatusBadge status={fixture.status} />
                    </div>

                    {/* Teams */}
                    <div className="space-y-3 mb-4">
                        {/* Home Team */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: fixture.homeTeam.color + '20' }}
                                >
                                    {fixture.homeTeam.logo ? (
                                        <img
                                            src={fixture.homeTeam.logo}
                                            alt={fixture.homeTeam.name}
                                            className="w-8 h-8 object-contain"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold">
                                            {fixture.homeTeam.shortName.substring(0, 2)}
                                        </span>
                                    )}
                                </div>
                                <span className="font-semibold truncate">{fixture.homeTeam.name}</span>
                            </div>
                            {!isUpcoming && (
                                <span className="text-2xl font-bold ml-2">{fixture.homeScore}</span>
                            )}
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: fixture.awayTeam.color + '20' }}
                                >
                                    {fixture.awayTeam.logo ? (
                                        <img
                                            src={fixture.awayTeam.logo}
                                            alt={fixture.awayTeam.name}
                                            className="w-8 h-8 object-contain"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold">
                                            {fixture.awayTeam.shortName.substring(0, 2)}
                                        </span>
                                    )}
                                </div>
                                <span className="font-semibold truncate">{fixture.awayTeam.name}</span>
                            </div>
                            {!isUpcoming && (
                                <span className="text-2xl font-bold ml-2">{fixture.awayScore}</span>
                            )}
                        </div>
                    </div>

                    {/* Match Info */}
                    <div className="space-y-2 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-2 text-sm text-white/60">
                            <Clock className="w-4 h-4" />
                            <span>{format(new Date(fixture.startTime), 'HH:mm')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/60">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate">{fixture.venue}</span>
                        </div>
                    </div>

                    {/* Actions (for upcoming matches) */}
                    {isUpcoming && (
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={handleSetReminder}
                                disabled={isLoading}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isReminded
                                        ? 'bg-blue-500/20 text-blue-500 border border-blue-500/50'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        <span>Loading...</span>
                                    </>
                                ) : isReminded ? (
                                    <>
                                        <Bell className="w-4 h-4 fill-current" />
                                        <span>Reminded</span>
                                    </>
                                ) : (
                                    <>
                                        <BellOff className="w-4 h-4" />
                                        <span>Remind Me</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleAddToCalendar}
                                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                                title="Add to Calendar"
                            >
                                <Calendar className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Live Badge */}
                    {isLive && (
                        <div className="mt-4 text-center">
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-500 rounded-full text-sm font-semibold">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                Watch Live
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>
        </Link>
    );
}

