"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getPushService } from "@/lib/notifications/push-service";

interface UseNotificationPromptReturn {
    showPrompt: boolean;
    closePrompt: () => void;
    isSubscribed: boolean;
    isChecking: boolean;
}

/**
 * Hook to manage notification prompt visibility
 * Shows prompt to authenticated users who haven't subscribed to push notifications
 * Respects user dismissal (won't show for 7 days after dismissal)
 */
export function useNotificationPrompt(): UseNotificationPromptReturn {
    const { user, isAuthenticated } = useAuth();
    const [showPrompt, setShowPrompt] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    const checkSubscriptionStatus = useCallback(async () => {
        if (!isAuthenticated || !user?.id) {
            setIsChecking(false);
            return;
        }

        try {
            const pushService = getPushService();
            await pushService.init();
            
            const permission = pushService.getPermission();
            
            // If permission is already granted, check if actually subscribed
            if (permission === 'granted') {
                const subscribed = await pushService.isSubscribed();
                setIsSubscribed(subscribed);
                
                // Check server-side subscription status
                try {
                    const response = await fetch(`/api/notifications/subscribe?userId=${user.id}`);
                    if (response.ok) {
                        const data = await response.json();
                        // If not subscribed on server, show prompt
                        if (!data.subscribed && !subscribed) {
                            checkShouldShowPrompt();
                        }
                    }
                } catch (error) {
                    console.error('Error checking server subscription:', error);
                }
            } else if (permission === 'default') {
                // Permission not asked yet, check if should show
                checkShouldShowPrompt();
            }
            // If permission === 'denied', don't show prompt
        } catch (error) {
            console.error('Error checking notification status:', error);
        } finally {
            setIsChecking(false);
        }
    }, [isAuthenticated, user?.id]);

    const checkShouldShowPrompt = () => {
        // Check if user dismissed the prompt recently
        const dismissedUntil = localStorage.getItem('notification-prompt-dismissed');
        if (dismissedUntil) {
            const dismissTime = parseInt(dismissedUntil, 10);
            if (Date.now() < dismissTime) {
                // Still within dismissal period, don't show
                return;
            }
            // Dismissal period expired, clear it
            localStorage.removeItem('notification-prompt-dismissed');
        }

        // Show prompt after a short delay (let page load first)
        setTimeout(() => {
            setShowPrompt(true);
        }, 3000);
    };

    const closePrompt = useCallback(() => {
        setShowPrompt(false);
    }, []);

    useEffect(() => {
        // Only check after user has been authenticated for a while
        // Don't show immediately on page load
        const timer = setTimeout(() => {
            checkSubscriptionStatus();
        }, 5000);

        return () => clearTimeout(timer);
    }, [checkSubscriptionStatus]);

    return {
        showPrompt,
        closePrompt,
        isSubscribed,
        isChecking,
    };
}
