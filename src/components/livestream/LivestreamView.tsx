'use client';

import { useState } from 'react';
import { LivestreamPlayer } from './LivestreamPlayer';
import { LivestreamChat } from './LivestreamChat';
import { ArrowLeft, Share2, MessageSquare, X, TrendingUp, Users, Clock, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Match {
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
    homeScore: number;
    awayScore: number;
    status: string;
    startTime: string;
    venue: string;
    competition: string;
    stats?: any;
    events?: any[];
}

interface Livestream {
    livestreamUrl: string;
    livestreamType: 'youtube' | 'twitch' | 'facebook' | 'hls' | 'dash' | 'custom';
    livestreamEnabled: boolean;
    livestreamViewers: number;
    livestreamChatEnabled: boolean;
    isActive: boolean;
}

interface LivestreamViewProps {
    match: Match;
    livestream: Livestream;
    onExit?: () => void;
}

export function LivestreamView({ match, livestream, onExit }: LivestreamViewProps) {
    const router = useRouter();
    const [viewerCount, setViewerCount] = useState(livestream.livestreamViewers || 0);
    const [showChat, setShowChat] = useState(true);
    const [activeTab, setActiveTab] = useState<'stats' | 'events'>('stats');
    const [seekTime, setSeekTime] = useState<number | null>(null);

    const matchTitle = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    const isLive = match.status === 'LIVE';

    const handleBack = () => {
        if (onExit) {
            onExit();
        } else {
            router.back();
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: matchTitle,
                    text: `Watch ${matchTitle} live on Brix Sport!`,
                    url: window.location.href,
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    };

    const formatTime = (dateString: string) => {
        return new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            month: 'short',
            day: 'numeric',
        }).format(new Date(dateString));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-gray-800">
                <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBack}
                            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            {onExit && <span className="text-sm font-semibold">View Stats</span>}
                        </button>
                        <div>
                            <h1 className="text-lg font-bold">{matchTitle}</h1>
                            <p className="text-sm text-gray-400">
                                {match.competition} • {formatTime(match.startTime)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleShare}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <Share2 className="w-4 h-4" />
                            <span className="hidden sm:inline text-sm">Share</span>
                        </button>

                        <button
                            onClick={() => setShowChat(!showChat)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors lg:hidden",
                                showChat ? "bg-red-600 hover:bg-red-700" : "bg-gray-800 hover:bg-gray-700"
                            )}
                        >
                            {showChat ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                            <span className="hidden sm:inline text-sm">Chat</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1920px] mx-auto p-4 lg:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
                    {/* Left Column - Video Player & Match Details */}
                    <div className="space-y-6">
                        {/* Video Player */}
                        <LivestreamPlayer
                            streamUrl={livestream.livestreamUrl}
                            streamType={livestream.livestreamType}
                            matchTitle={matchTitle}
                            isLive={isLive}
                            viewerCount={viewerCount}
                            onViewerCountUpdate={setViewerCount}
                            seekTime={seekTime}
                        />

                        {/* Match Score Card */}
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700">
                            <div className="grid grid-cols-3 gap-4 items-center">
                                {/* Home Team */}
                                <div className="flex flex-col items-center text-center">
                                    <img
                                        src={match.homeTeam.logo}
                                        alt={match.homeTeam.name}
                                        className="w-16 h-16 object-contain mb-3"
                                    />
                                    <h3 className="font-bold text-lg">{match.homeTeam.shortName}</h3>
                                    <p className="text-sm text-gray-400 hidden sm:block">{match.homeTeam.name}</p>
                                </div>

                                {/* Score */}
                                <div className="flex flex-col items-center">
                                    {isLive && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                            <span className="text-xs font-semibold text-red-500">LIVE</span>
                                        </div>
                                    )}
                                    <div className="text-5xl font-bold">
                                        {match.homeScore} - {match.awayScore}
                                    </div>
                                    <p className="text-sm text-gray-400 mt-2">{match.venue}</p>
                                </div>

                                {/* Away Team */}
                                <div className="flex flex-col items-center text-center">
                                    <img
                                        src={match.awayTeam.logo}
                                        alt={match.awayTeam.name}
                                        className="w-16 h-16 object-contain mb-3"
                                    />
                                    <h3 className="font-bold text-lg">{match.awayTeam.shortName}</h3>
                                    <p className="text-sm text-gray-400 hidden sm:block">{match.awayTeam.name}</p>
                                </div>
                            </div>
                        </div>

                        {/* Stats & Events Tabs */}
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                            {/* Tab Headers */}
                            <div className="flex border-b border-gray-700">
                                <button
                                    onClick={() => setActiveTab('stats')}
                                    className={cn(
                                        "flex-1 px-6 py-4 font-semibold transition-colors",
                                        activeTab === 'stats'
                                            ? "bg-red-600 text-white"
                                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                                    )}
                                >
                                    <TrendingUp className="w-4 h-4 inline mr-2" />
                                    Statistics
                                </button>
                                <button
                                    onClick={() => setActiveTab('events')}
                                    className={cn(
                                        "flex-1 px-6 py-4 font-semibold transition-colors",
                                        activeTab === 'events'
                                            ? "bg-red-600 text-white"
                                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                                    )}
                                >
                                    <Clock className="w-4 h-4 inline mr-2" />
                                    Events
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="p-6">
                                {activeTab === 'stats' ? (
                                    <div className="space-y-4">
                                        {match.stats ? (
                                            Object.entries(match.stats).map(([key, value]: [string, any]) => (
                                                <div key={key} className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span>{value.home || 0}</span>
                                                        <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                        <span>{value.away || 0}</span>
                                                    </div>
                                                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-500 to-red-500"
                                                            style={{
                                                                width: `${((value.home || 0) / ((value.home || 0) + (value.away || 0) || 1)) * 100}%`
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center text-gray-400">No statistics available yet</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {match.events && match.events.length > 0 ? (
                                            match.events.map((event: any, index: number) => (
                                                <button
                                                    key={index}
                                                    onClick={() => {
                                                        // Calculate seconds for seek
                                                        // Strategy: 
                                                        // 1. Get Event timestamp (Minute * 60 + Second)
                                                        // 2. Add offset if we have match/stream start times to account for pre-match stream

                                                        const eventSeconds = (event.minute * 60) + (event.second || 0);

                                                        // Calculate offset: Match Start - Stream Start
                                                        // Default to 0 if times are missing
                                                        let offset = 0;
                                                        if (match.startTime && livestream?.isActive) {
                                                            // If live, we don't really offset, we just jump to now? 
                                                            // Actually seek is mostly for Replay/VOD.

                                                            // For VOD (not active stream), if we have both timestamps on the match record:
                                                            // const matchStart = new Date(match.startTime).getTime();
                                                            // const streamStart = new Date(match.livestreamStartTime).getTime();
                                                            // offset = Math.max(0, (matchStart - streamStart) / 1000);
                                                        }

                                                        // Hardcoded "Warmup" assumption if no data (e.g. 10 mins)
                                                        // const WARMUP_PAD = 600; 

                                                        setSeekTime(eventSeconds);
                                                    }}
                                                    className="w-full flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700 transition-colors group text-left"
                                                >
                                                    <div className="flex flex-col items-center w-12 text-gray-400 group-hover:text-red-500 transition-colors">
                                                        <span className="text-sm font-semibold">{event.minute}'</span>
                                                        <Play size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                    <span className="text-2xl">{getEventIcon(event.type)}</span>
                                                    <div className="flex-1">
                                                        <p className="font-semibold group-hover:text-white transition-colors">{event.playerName}</p>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm text-gray-400">{event.type}</p>
                                                            {event.type === 'Goal' && <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded font-bold uppercase">Highlight</span>}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <p className="text-center text-gray-400">No events yet</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Chat */}
                    <div className={cn(
                        "lg:block",
                        showChat ? "block" : "hidden"
                    )}>
                        <div className="sticky top-24 h-[calc(100vh-7rem)]">
                            <LivestreamChat
                                matchId={match.id}
                                enabled={livestream.livestreamChatEnabled}
                                className="h-full"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper function to get event icons
function getEventIcon(eventType: string): string {
    const icons: Record<string, string> = {
        goal: '⚽',
        'yellow-card': '🟨',
        'red-card': '🟥',
        substitution: '🔄',
        '2-pointer': '🏀',
        '3-pointer': '🎯',
        'free-throw': '🎪',
        assist: '🤝',
        steal: '🛡️',
        block: '🚫',
    };
    return icons[eventType] || '📌';
}
