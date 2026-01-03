'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, X, Check } from 'lucide-react';
import { getPushService } from '@/lib/notifications/push-service';

interface NotificationPermissionProps {
    userId: string;
    onPermissionChange?: (granted: boolean) => void;
}

export default function NotificationPermission({ userId, onPermissionChange }: NotificationPermissionProps) {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const router = useRouter();

    const pushService = getPushService();

    useEffect(() => {
        checkPermissionStatus();
    }, []);

    const checkPermissionStatus = async () => {
        await pushService.init();
        const currentPermission = pushService.getPermission();
        setPermission(currentPermission);

        if (currentPermission === 'granted') {
            const subscribed = await pushService.isSubscribed();
            setIsSubscribed(subscribed);
        }

        // Show banner if permission not granted and not dismissed
        const dismissed = localStorage.getItem('notification-banner-dismissed');
        if (currentPermission === 'default' && !dismissed) {
            setShowBanner(true);
        }
    };

    const handleEnableNotifications = async () => {
        setLoading(true);

        try {
            // Request permission
            const newPermission = await pushService.requestPermission();
            setPermission(newPermission);

            if (newPermission === 'granted') {
                // Subscribe to push notifications
                const subscription = await pushService.subscribe(userId);

                if (subscription) {
                    setIsSubscribed(true);
                    setShowBanner(false);
                    onPermissionChange?.(true);

                    // Show success notification
                    await pushService.showNotification('Notifications Enabled! 🎉', {
                        body: 'You\'ll now receive live updates for goals, match starts, and more!',
                        icon: '/icons/icon-192x192.png',
                    });

                    // Navigate to notifications page
                    setTimeout(() => {
                        router.push('/notifications');
                    }, 1000);
                }
            } else {
                onPermissionChange?.(false);
            }
        } catch (error) {
            console.error('Error enabling notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDisableNotifications = async () => {
        setLoading(true);

        try {
            const success = await pushService.unsubscribe(userId);

            if (success) {
                setIsSubscribed(false);
                onPermissionChange?.(false);
            }
        } catch (error) {
            console.error('Error disabling notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDismissBanner = () => {
        setShowBanner(false);
        localStorage.setItem('notification-banner-dismissed', 'true');
    };

    // Banner for requesting permission
    if (showBanner && permission === 'default') {
        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0, y: -100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -100 }}
                    className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary via-purple-600 to-pink-600 text-white shadow-lg"
                >
                    <div className="max-w-7xl mx-auto px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Bell className="w-6 h-6" />
                                <div>
                                    <div className="font-bold">Get Live Match Updates!</div>
                                    <div className="text-sm text-white/90">
                                        Enable notifications for goals, match starts, and more
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleEnableNotifications}
                                    disabled={loading}
                                    className="px-6 py-2 bg-white text-primary rounded-lg font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Enabling...' : 'Enable'}
                                </button>
                                <button
                                    onClick={handleDismissBanner}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        );
    }

    // Compact status indicator
    return (
        <div className="inline-flex items-center gap-2">
            {permission === 'granted' && isSubscribed ? (
                <button
                    onClick={handleDisableNotifications}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-500 rounded-lg border border-blue-500/50 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                >
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Notifications On</span>
                </button>
            ) : permission === 'denied' ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-500 rounded-lg border border-red-500/50">
                    <BellOff className="w-4 h-4" />
                    <span className="text-sm font-medium">Notifications Blocked</span>
                </div>
            ) : (
                <button
                    onClick={handleEnableNotifications}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white/80 rounded-lg border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                    <Bell className="w-4 h-4" />
                    <span className="text-sm font-medium">
                        {loading ? 'Enabling...' : 'Enable Notifications'}
                    </span>
                </button>
            )}
        </div>
    );
}

