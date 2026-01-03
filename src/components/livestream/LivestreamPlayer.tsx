'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Users, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LivestreamPlayerProps {
    streamUrl: string;
    streamType: 'youtube' | 'twitch' | 'facebook' | 'hls' | 'dash' | 'custom';
    matchTitle: string;
    isLive?: boolean;
    viewerCount?: number;
    onViewerCountUpdate?: (count: number) => void;
    seekTime?: number | null;
}

export function LivestreamPlayer({
    streamUrl,
    streamType,
    matchTitle,
    isLive = true,
    viewerCount = 0,
    onViewerCountUpdate,
    seekTime
}: LivestreamPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [volume, setVolume] = useState(100);
    const [currentEmbedUrl, setCurrentEmbedUrl] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const extractYouTubeId = (url: string): string => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? match[2] : '';
    };

    const extractTwitchChannel = (url: string): string => {
        const match = url.match(/twitch\.tv\/([^/?]+)/);
        return match ? match[1] : '';
    };

    // Extract video ID for different platforms
    const getEmbedUrl = (url: string, type: string) => {
        switch (type) {
            case 'youtube': {
                const videoId = extractYouTubeId(url);
                // Add enablejsapi=1 to allow postMessage control
                return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=1&rel=0&modestbranding=1&enablejsapi=1`;
            }
            case 'twitch': {
                const channel = extractTwitchChannel(url);
                return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=true`;
            }
            case 'facebook': {
                return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=true`;
            }
            default:
                return url;
        }
    };

    // Initial URL setup
    useEffect(() => {
        setCurrentEmbedUrl(getEmbedUrl(streamUrl, streamType));
    }, [streamUrl, streamType]);

    // Handle seek
    useEffect(() => {
        if (seekTime !== null && seekTime !== undefined) {
            if (streamType === 'youtube' && iframeRef.current) {
                // Smart seek using postMessage for YouTube
                iframeRef.current.contentWindow?.postMessage(JSON.stringify({
                    event: 'command',
                    func: 'seekTo',
                    args: [Math.floor(seekTime), true]
                }), '*');
            } else {
                // Fallback for other players or initial load
                const baseUrl = getEmbedUrl(streamUrl, streamType);
                if (streamType === 'youtube') {
                    const separator = baseUrl.includes('?') ? '&' : '?';
                    setCurrentEmbedUrl(`${baseUrl}${separator}start=${Math.floor(seekTime)}&autoplay=1`);
                }
            }
        }
    }, [seekTime, streamUrl, streamType]);



    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3000);
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, []);

    // Simulate viewer count updates (in production, this would come from WebSocket)
    useEffect(() => {
        if (isLive && onViewerCountUpdate) {
            const interval = setInterval(() => {
                const variance = Math.floor(Math.random() * 20) - 10;
                const newCount = Math.max(0, viewerCount + variance);
                onViewerCountUpdate(newCount);
            }, 30000); // Update every 30 seconds

            return () => clearInterval(interval);
        }
    }, [isLive, viewerCount, onViewerCountUpdate]);

    return (
        <div
            ref={containerRef}
            className="relative w-full bg-black rounded-xl overflow-hidden shadow-2xl group"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setShowControls(false)}
        >
            {/* Video Container */}
            <div className="relative aspect-video w-full">
                {/* Embedded Player */}
                <iframe
                    ref={iframeRef}
                    src={currentEmbedUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={matchTitle}
                />

                {/* Live Indicator & Viewer Count */}
                <div
                    className={cn(
                        "absolute top-4 left-4 flex items-center gap-3 transition-opacity duration-300",
                        showControls ? "opacity-100" : "opacity-0"
                    )}
                >
                    {isLive && (
                        <div className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full font-semibold shadow-lg backdrop-blur-sm">
                            <Radio className="w-4 h-4 animate-pulse" />
                            <span className="text-sm font-bold">LIVE</span>
                        </div>
                    )}

                    {viewerCount > 0 && (
                        <div className="flex items-center gap-2 bg-black/70 text-white px-4 py-2 rounded-full backdrop-blur-sm">
                            <Users className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {viewerCount.toLocaleString()} watching
                            </span>
                        </div>
                    )}
                </div>

                {/* Match Title Overlay */}
                <div
                    className={cn(
                        "absolute top-4 right-4 bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur-sm transition-opacity duration-300",
                        showControls ? "opacity-100" : "opacity-0"
                    )}
                >
                    <h3 className="text-sm font-semibold">{matchTitle}</h3>
                </div>

                {/* Custom Controls Overlay (Optional - for HLS/DASH) */}
                {(streamType === 'hls' || streamType === 'dash' || streamType === 'custom') && (
                    <div
                        className={cn(
                            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 transition-opacity duration-300",
                            showControls ? "opacity-100" : "opacity-0"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            {/* Play/Pause */}
                            <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                className="text-white hover:text-red-500 transition-colors"
                                aria-label={isPlaying ? 'Pause' : 'Play'}
                            >
                                {isPlaying ? (
                                    <Pause className="w-6 h-6" />
                                ) : (
                                    <Play className="w-6 h-6" />
                                )}
                            </button>

                            {/* Volume */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsMuted(!isMuted)}
                                    className="text-white hover:text-red-500 transition-colors"
                                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                                >
                                    {isMuted ? (
                                        <VolumeX className="w-5 h-5" />
                                    ) : (
                                        <Volume2 className="w-5 h-5" />
                                    )}
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={isMuted ? 0 : volume}
                                    onChange={(e) => {
                                        setVolume(parseInt(e.target.value));
                                        setIsMuted(false);
                                    }}
                                    className="w-24 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${volume}%, rgba(255,255,255,0.3) ${volume}%, rgba(255,255,255,0.3) 100%)`
                                    }}
                                />
                            </div>

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* Settings */}
                            <button
                                className="text-white hover:text-red-500 transition-colors"
                                aria-label="Settings"
                            >
                                <Settings className="w-5 h-5" />
                            </button>

                            {/* Fullscreen */}
                            <button
                                onClick={toggleFullscreen}
                                className="text-white hover:text-red-500 transition-colors"
                                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                            >
                                {isFullscreen ? (
                                    <Minimize className="w-5 h-5" />
                                ) : (
                                    <Maximize className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Loading State */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none opacity-0 group-hover:opacity-0 transition-opacity">
                <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        </div>
    );
}
