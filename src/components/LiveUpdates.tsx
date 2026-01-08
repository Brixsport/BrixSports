'use client';

import { useState, useEffect } from 'react';
import { Activity, Trophy, AlertCircle } from 'lucide-react';

interface LiveUpdatesProps {
    matchId: string;
}

interface MatchEvent {
    id: string;
    type: string;
    minute: number;
    detail: string;
    teamId?: string;
    playerId?: string;
}

export function LiveUpdates({ matchId }: LiveUpdatesProps) {
    const [events, setEvents] = useState<MatchEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchEvents() {
            try {
                const response = await fetch(`/api/matches/${matchId}/events`);
                if (response.ok) {
                    const data = await response.json();
                    setEvents(data.events || []);
                }
            } catch (error) {
                console.error('Error fetching events:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchEvents();

        // Refresh every 10 seconds
        const interval = setInterval(fetchEvents, 10000);
        return () => clearInterval(interval);
    }, [matchId]);

    if (loading) {
        return (
            <div className="bg-white/5 rounded-xl p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-primary" />
                    Live Updates
                </h3>
                <div className="text-center py-4">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/5 rounded-xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
                <Activity size={16} className="text-primary animate-pulse" />
                Live Updates
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {events.length > 0 ? (
                    events.slice().reverse().map((event) => (
                        <div
                            key={event.id}
                            className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:border-primary/30 transition-all"
                        >
                            <div className="w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center text-xs font-bold tabular-nums flex-shrink-0">
                                {event.minute}'
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`p-1 rounded ${event.type === 'Goal' || event.type === 'Penalty' ? 'bg-primary/20 text-primary' :
                                            event.type === 'Yellow Card' ? 'bg-yellow-500/20 text-yellow-500' :
                                                event.type === 'Red Card' ? 'bg-red-500/20 text-red-500' :
                                                    'bg-white/10 text-white/60'
                                        }`}>
                                        {event.type === 'Goal' || event.type === 'Penalty' ? <Trophy size={12} /> : <AlertCircle size={12} />}
                                    </div>
                                    <span className="text-sm font-bold uppercase tracking-tight">
                                        {event.type}
                                    </span>
                                </div>
                                <p className="text-xs text-white/60">
                                    {event.detail}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-white/40 text-center py-8 text-sm">
                        No events yet. Updates will appear here as the match progresses.
                    </p>
                )}
            </div>
        </div>
    );
}
