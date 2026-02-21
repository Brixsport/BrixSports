'use client';

import { useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useNotifications } from './Notifications';
import { useFavorites } from '@/hooks/useFavorites';

export function GlobalNotificationListener() {
    const { socket, isConnected } = useWebSocket({ autoConnect: true });
    const { addNotification } = useNotifications();
    const { isFavoriteTeam, isFavoritePlayer } = useFavorites();

    useEffect(() => {
        if (isConnected && socket) {
            const handleGlobalNotification = (data: any) => {
                // Determine if this notification involves a followed team OR favorite player
                const isTeamFollowed =
                    (data.teamId && isFavoriteTeam(data.teamId)) ||
                    (data.homeTeamId && isFavoriteTeam(data.homeTeamId)) ||
                    (data.awayTeamId && isFavoriteTeam(data.awayTeamId));

                const isPlayerFollowed =
                    (data.playerId && isFavoritePlayer(String(data.playerId)));

                const isRelevant = isTeamFollowed || isPlayerFollowed;

                // Rules for displaying:
                // 1. Always show Goals (global hype)
                // 2. Show Cards if it's a favorite player or team
                // 3. Show Period changes/match start/end if team is followed

                if (data.type === 'GOAL' ||
                    (isRelevant && ['YELLOW_CARD', 'RED_CARD', 'MATCH_START', 'MATCH_END', 'PERIOD_CHANGE', 'LINEUP_PUBLISHED'].includes(data.type))) {

                    addNotification({
                        title: data.type.replace('_', ' '),
                        message: data.message,
                        type: isPlayerFollowed ? 'player' : 'match'
                    });

                    if ('vibrate' in navigator) {
                        navigator.vibrate(200);
                    }
                }
            };

            socket.on('notification:global', handleGlobalNotification);
            return () => {
                socket.off('notification:global', handleGlobalNotification);
            };
        }
    }, [isConnected, socket, addNotification, isFavoriteTeam]);

    return null; // This component doesn't render anything
}
