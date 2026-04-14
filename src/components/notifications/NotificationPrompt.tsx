"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCircle2, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getPushService } from "@/lib/notifications/push-service";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationPromptProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationPrompt({ isOpen, onClose }: NotificationPromptProps) {
    const { user, isAuthenticated } = useAuth();
    const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const pushService = getPushService();

    useEffect(() => {
        if (isOpen) {
            checkPushStatus();
        }
    }, [isOpen]);

    const checkPushStatus = async () => {
        try {
            await pushService.init();
            const permission = pushService.getPermission();
            setPushPermission(permission);
            if (permission === 'granted') {
                const subscribed = await pushService.isSubscribed();
                setIsSubscribed(subscribed);
            }
        } catch (error) {
            console.error('Error checking push status:', error);
        }
    };

    const handleEnableNotifications = async () => {
        if (!user?.id) {
            toast.error('Please sign in to enable notifications');
            return;
        }

        setIsSubscribing(true);
        try {
            const permission = await pushService.requestPermission();
            setPushPermission(permission);

            if (permission === 'granted') {
                const subscription = await pushService.subscribe(user.id);
                if (subscription) {
                    setIsSubscribed(true);
                    toast.success('Notifications enabled! You\'ll get alerts for goals, match starts, and more.');
                    // Show a test notification
                    await pushService.showNotification('Welcome to BrixSports! 🎉', {
                        body: 'You\'ll receive live updates for your favorite teams.',
                        icon: '/icons/icon-192x192.png',
                    });
                    setTimeout(() => {
                        onClose();
                    }, 2000);
                } else {
                    toast.error('Failed to subscribe. Please try again.');
                }
            } else if (permission === 'denied') {
                toast.error('Notifications are blocked. You can enable them later in your browser settings.');
                setTimeout(() => {
                    onClose();
                }, 1500);
            }
        } catch (error) {
            console.error('Error enabling notifications:', error);
            toast.error('Something went wrong. You can enable notifications later in Settings.');
        } finally {
            setIsSubscribing(false);
        }
    };

    const handleDismiss = () => {
        // Mark as dismissed for 7 days
        const dismissedUntil = Date.now() + (7 * 24 * 60 * 60 * 1000);
        localStorage.setItem('notification-prompt-dismissed', dismissedUntil.toString());
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={handleDismiss}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-gradient-to-br from-[#0A0A0A] to-black border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Background glow */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

                        {/* Close button */}
                        <button
                            onClick={handleDismiss}
                            className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all"
                        >
                            <X size={20} />
                        </button>

                        {/* Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="w-24 h-24 relative">
                                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                                <div className="relative w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                                    {isSubscribed ? (
                                        <CheckCircle2 size={48} className="text-primary" />
                                    ) : pushPermission === 'denied' ? (
                                        <Bell size={48} className="text-white/40" />
                                    ) : (
                                        <BellRing size={48} className="text-primary animate-pulse" />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="text-center relative z-10">
                            <h3 className="text-2xl font-display uppercase italic text-white mb-2">
                                {isSubscribed ? 'You\'re All Set!' : 'Never Miss a Goal'}
                            </h3>
                            <p className="text-white/60 leading-relaxed mb-6">
                                {isSubscribed
                                    ? 'You\'ll now receive instant notifications for goals, match starts, and final scores.'
                                    : 'Get instant alerts when your favorite teams score, matches start, or big moments happen.'}
                            </p>

                            {/* Benefits */}
                            {!isSubscribed && pushPermission !== 'denied' && (
                                <div className="space-y-2 mb-6 text-left">
                                    <div className="flex items-center gap-3 text-sm text-white/60 bg-white/5 p-3 rounded-xl">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                            <span className="text-primary text-xs">⚽</span>
                                        </div>
                                        <span>Goal alerts in real-time</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-white/60 bg-white/5 p-3 rounded-xl">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                            <span className="text-primary text-xs">🏆</span>
                                        </div>
                                        <span>Match start & final scores</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-white/60 bg-white/5 p-3 rounded-xl">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                            <span className="text-primary text-xs">🔔</span>
                                        </div>
                                        <span>Works when app is closed</span>
                                    </div>
                                </div>
                            )}

                            {/* Buttons */}
                            {isSubscribed ? (
                                <Button
                                    size="lg"
                                    onClick={onClose}
                                    className="w-full font-black uppercase tracking-widest"
                                >
                                    Awesome! <CheckCircle2 className="ml-2 w-4 h-4" />
                                </Button>
                            ) : pushPermission === 'denied' ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-white/40">
                                        Notifications are blocked in your browser settings.
                                    </p>
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        onClick={handleDismiss}
                                        className="w-full font-black uppercase tracking-widest"
                                    >
                                        Got it
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <Button
                                        size="lg"
                                        disabled={isSubscribing || !isAuthenticated}
                                        onClick={handleEnableNotifications}
                                        className="w-full font-black uppercase tracking-widest bg-primary hover:bg-primary/90"
                                    >
                                        {isSubscribing ? (
                                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enabling...</>
                                        ) : (
                                            <><Bell className="mr-2 w-4 h-4" /> Enable Notifications</>
                                        )}
                                    </Button>
                                    <button
                                        onClick={handleDismiss}
                                        className="text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors py-2"
                                    >
                                        Maybe Later
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
