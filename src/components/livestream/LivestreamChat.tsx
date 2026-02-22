'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Smile, MoreVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
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
    const [isSending, setIsSending] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { user, openAuthModal } = useAuth();

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

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('[Chat] handleSendMessage triggered. Input:', inputMessage);

        if (!inputMessage.trim() || isSending) {
            console.log('[Chat] Send ignored:', { empty: !inputMessage.trim(), isSending });
            return;
        }

        if (!user) {
            console.log('[Chat] No user, opening auth modal');
            openAuthModal();
            return;
        }

        setIsSending(true);

        try {
            console.log('[Chat] Creating message for user:', user.id);
            const newMessage: ChatMessage = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                userId: user.id || 'anonymous',
                userName: user.name || 'Anonymous',
                userAvatar: user.avatar,
                message: inputMessage.trim(),
                timestamp: new Date()
            };

            // Add message optimistically to UI
            console.log('[Chat] Adding message optimistically:', newMessage.id);
            setMessages(prev => [...prev, newMessage]);
            setInputMessage('');

            if (isConnected) {
                console.log('[Chat] Emitting chat:message via WS');
                // Emit to server if connected
                emit('chat:message', {
                    matchId,
                    ...newMessage
                });
            } else {
                console.warn('[Chat] Socket not connected, trying HTTP fallback');
                // HTTP Fallback
                const response = await fetch('/api/chat/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ matchId, message: newMessage }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }
            }
        } catch (error) {
            console.error('[Chat] Failed to send message:', error);
            // Show error message
            setMessages(prev => [...prev, {
                id: `error_${Date.now()}`,
                userId: 'system',
                userName: 'System',
                message: '⚠️ Failed to send message. Please try again.',
                timestamp: new Date(),
                isSystemMessage: true,
            }]);
        } finally {
            setIsSending(false);
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
            <div className={cn("flex items-center justify-center h-full bg-black/40 backdrop-blur-sm rounded-xl border border-white/10", className)}>
                <p className="text-white/40 text-sm">Chat is disabled for this stream</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col h-full bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10", className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        isConnected ? "bg-primary animate-pulse" : "bg-white/20"
                    )} />
                    <h3 className="text-white font-semibold text-sm">Live Chat</h3>
                    <span className="text-white/40 text-xs">
                        {messages.filter(m => !m.isSystemMessage).length} messages
                    </span>
                </div>
                <button className="text-white/40 hover:text-white transition-colors">
                    <MoreVertical className="w-4 h-4" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
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
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-xs font-bold">
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
                                <p className="text-xs text-white/40 bg-white/5 rounded-lg px-3 py-2 inline-block border border-white/5">
                                    {msg.message}
                                </p>
                            ) : (
                                <>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="text-sm font-semibold text-white truncate">
                                            {msg.userName}
                                        </span>
                                        <span className="text-xs text-white/30">
                                            {formatTime(msg.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-white/70 break-words">
                                        {msg.message}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Connection Warning */}
            {!isConnected && (
                <div className="px-4 py-2 bg-yellow-500/10 border-y border-yellow-500/20">
                    <p className="text-xs text-yellow-500/80 text-center">
                        ⚠️ Chat disconnected. Reconnecting...
                    </p>
                </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 bg-white/5 border-t border-white/10">
                {user ? (
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Type a message..."
                                className="w-full bg-white/5 text-white placeholder-white/30 rounded-lg px-4 py-2.5 pr-10 text-sm border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                maxLength={200}
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                            >
                                <Smile className="w-5 h-5" />
                            </button>
                        </div>
                        <button
                            type="submit"
                            disabled={!inputMessage.trim() || isSending}
                            className="bg-primary hover:bg-primary/90 disabled:bg-white/10 disabled:cursor-not-allowed text-black disabled:text-white/30 rounded-lg p-2.5 transition-colors font-bold"
                            title={isSending ? 'Sending...' : 'Send message'}
                        >
                            {isSending ? (
                                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </button>
                    </form>
                ) : (
                    <div className="text-center py-2">
                        <p className="text-sm text-white/40">
                            <button
                                onClick={() => openAuthModal()}
                                className="text-primary hover:text-primary/80 font-semibold cursor-pointer transition-colors"
                            >
                                Sign in
                            </button>
                            {' '}to join the chat
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
