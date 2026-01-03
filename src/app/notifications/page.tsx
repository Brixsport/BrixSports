'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, ArrowLeft, Check, X, Clock } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'match' | 'goal' | 'news' | 'general';
    read: boolean;
    createdAt: Date;
    link?: string;
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            // Use a default userId for now (in real app, get from auth)
            const response = await fetch('/api/notifications?userId=default&limit=50');
            const data = await response.json();

            if (data.notifications) {
                setNotifications(data.notifications);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = (id: string) => {
        setNotifications(prev => {
            const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
            localStorage.setItem('brixsport_notifications', JSON.stringify(updated));
            return updated;
        });
    };

    const markAllAsRead = () => {
        setNotifications(prev => {
            const updated = prev.map(n => ({ ...n, read: true }));
            localStorage.setItem('brixsport_notifications', JSON.stringify(updated));
            return updated;
        });
    };

    const deleteNotification = (id: string) => {
        setNotifications(prev => {
            const updated = prev.filter(n => n.id !== id);
            localStorage.setItem('brixsport_notifications', JSON.stringify(updated));
            return updated;
        });
    };

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications;

    const unreadCount = notifications.filter(n => !n.read).length;

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'match': return '⚽';
            case 'goal': return '🎯';
            case 'news': return '📰';
            default: return '🔔';
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Link
                            href="/"
                            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={20} />
                            <span className="text-sm font-bold">Back</span>
                        </Link>

                        <div className="flex items-center gap-2">
                            <Bell className="w-6 h-6 text-primary" />
                            <h1 className="text-2xl font-black uppercase tracking-tight">Notifications</h1>
                            {unreadCount > 0 && (
                                <span className="px-2 py-1 bg-primary text-black rounded-full text-xs font-bold">
                                    {unreadCount}
                                </span>
                            )}
                        </div>

                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-sm text-primary hover:text-primary/80 transition-colors font-bold"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${filter === 'all'
                            ? 'bg-primary text-black'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        All ({notifications.length})
                    </button>
                    <button
                        onClick={() => setFilter('unread')}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${filter === 'unread'
                            ? 'bg-primary text-black'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        Unread ({unreadCount})
                    </button>
                </div>

                {/* Notifications List */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-white/60">Loading notifications...</p>
                        </div>
                    ) : filteredNotifications.length > 0 ? (
                        filteredNotifications.map((notification) => (
                            <motion.div
                                key={notification.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-4 rounded-2xl border transition-all ${notification.read
                                    ? 'bg-white/5 border-white/10'
                                    : 'bg-primary/10 border-primary/30'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="text-3xl">{getNotificationIcon(notification.type)}</div>

                                    <div className="flex-1">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h3 className="font-bold text-white">{notification.title}</h3>
                                            {!notification.read && (
                                                <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2"></span>
                                            )}
                                        </div>

                                        <p className="text-sm text-white/60 mb-2">{notification.message}</p>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs text-white/40">
                                                <Clock size={12} />
                                                <span>{format(new Date(notification.createdAt), 'MMM d, h:mm a')}</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {!notification.read && (
                                                    <button
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                                        title="Mark as read"
                                                    >
                                                        <Check size={16} className="text-primary" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteNotification(notification.id)}
                                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <X size={16} className="text-white/60" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="text-center py-20">
                            <BellOff className="w-16 h-16 text-white/20 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white/60 mb-2">
                                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </h3>
                            <p className="text-sm text-white/40">
                                {filter === 'unread'
                                    ? 'All caught up! Check back later for updates.'
                                    : 'Enable notifications to get live updates for matches and news.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
