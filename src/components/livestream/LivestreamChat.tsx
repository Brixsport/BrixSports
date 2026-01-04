'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Smile, MoreVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    message: string;
    timestamp: Date;
    isSystemMessage?: boolean;
}

interface LivestreamChatProps {
    matchId: string;
    enabled?: boolean;
    className?: string;
}

export function LivestreamChat({ matchId, enabled = true, className }: LivestreamChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const { isConnected, emit, on, off } = useWebSocket({
        autoConnect: enabled,
    });

    useEffect(() => {
        if (isConnected && enabled && matchId) {
            emit('chat:join', { matchId });
            console.log('Joined chat for match:', matchId);
        }

        return () => {
            if (isConnected && matchId) {
                emit('chat:leave', { matchId });
            }
        };
    }, [isConnected, enabled, matchId, emit]);

    // Listen for incoming messages
    useEffect(() => {
        const handleNewMessage = (data: ChatMessage) => {
            if (data.id) {
                // Check if message already exists to avoid duplicates
                setMessages(prev => {
                    if (prev.some(m => m.id === data.id)) return prev;
                    return [...prev, {
                        ...data,
                        timestamp: new Date(data.timestamp) // Ensure date object
                    }];
                });
            }
        };

        on('chat:message', handleNewMessage);

        return () => {
            off('chat:message', handleNewMessage);
        };
    }, [on, off]);

    // Initial Welcome Message
    useEffect(() => {
        if (enabled && messages.length === 0) {
            setMessages([
                {
                    id: 'system-welcome',
                    userId: 'system',
                    userName: 'System',
                    message: 'Welcome to the live chat! Be respectful and enjoy the match! 🎉',
                    timestamp: new Date(),
                    isSystemMessage: true
                }
            ]);
        }
    }, [enabled]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();

        if (!inputMessage.trim() || !user) return;

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            userId: user.id || 'anonymous',
            userName: user.name || 'Anonymous',
            userAvatar: user.avatar,
            message: inputMessage.trim(),
            timestamp: new Date()
        };

        // Emit to server
        if (isConnected) {
            emit('chat:message', {
                matchId,
                ...newMessage
            });
            setInputMessage('');
        } else {
            console.error('Cannot send message: Socket not connected');
        }
    };

    const formatTime = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    if (!enabled) {
        return (
            <div className={cn("flex items-center justify-center h-full bg-gray-900/50 rounded-xl", className)}>
                <p className="text-gray-400 text-sm">Chat is disabled for this stream</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col h-full bg-gray-900 rounded-xl overflow-hidden", className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        isConnected ? "bg-green-500 animate-pulse" : "bg-gray-500"
                    )} />
                    <h3 className="text-white font-semibold text-sm">Live Chat</h3>
                    <span className="text-gray-400 text-xs">
                        {messages.filter(m => !m.isSystemMessage).length} messages
                    </span>
                </div>
                <button className="text-gray-400 hover:text-white transition-colors">
                    <MoreVertical className="w-4 h-4" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex gap-3 animate-in slide-in-from-bottom-2 duration-300",
                            msg.isSystemMessage && "justify-center"
                        )}
                    >
                        {!msg.isSystemMessage && (
                            <div className="flex-shrink-0">
                                {msg.userAvatar ? (
                                    <img
                                        src={msg.userAvatar}
                                        alt={msg.userName}
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                                        {msg.userName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className={cn(
                            "flex-1 min-w-0",
                            msg.isSystemMessage && "text-center"
                        )}>
                            {msg.isSystemMessage ? (
                                <p className="text-xs text-gray-400 bg-gray-800/50 rounded-lg px-3 py-2 inline-block">
                                    {msg.message}
                                </p>
                            ) : (
                                <>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="text-sm font-semibold text-white truncate">
                                            {msg.userName}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {formatTime(msg.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-300 break-words">
                                        {msg.message}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 bg-gray-800 border-t border-gray-700">
                {user ? (
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Type a message..."
                                className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                maxLength={200}
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                <Smile className="w-5 h-5" />
                            </button>
                        </div>
                        <button
                            type="submit"
                            disabled={!inputMessage.trim()}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg p-2.5 transition-colors"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                ) : (
                    <div className="text-center py-2">
                        <p className="text-sm text-gray-400">
                            <a href="/auth/login" className="text-red-500 hover:text-red-400 font-semibold">
                                Sign in
                            </a>
                            {' '}to join the chat
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
