'use client';

import { useEffect } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { InstallPrompt } from './InstallPrompt';
import { OfflineIndicator, OfflineBadge } from './OfflineIndicator';
import { UpdatePrompt } from './UpdatePrompt';
import { IOSInstallPrompt, IOSInstallBanner } from './IOSInstallPrompt';

interface PWAProviderProps {
    children?: React.ReactNode;
    swPath: string;
    showInstallPrompt?: boolean;
    showOfflineIndicator?: boolean;
    showUpdatePrompt?: boolean;
}

export function PWAProvider({
    children,
    swPath,
    showInstallPrompt = true,
    showOfflineIndicator = true,
    showUpdatePrompt = true,
}: PWAProviderProps) {
    const { registration, isRegistered, error } = usePWA(swPath);

    useEffect(() => {
        // Prevent sw-user.js from registering when we are in admin/logger routes
        // This avoids conflicts with sw-admin.js
        if (typeof window !== 'undefined') {
            const isControlPath = window.location.pathname.startsWith('/admin') ||
                window.location.pathname.startsWith('/logger');

            if (isControlPath && swPath.includes('user')) {
                console.log('[PWAProvider] Skipping user SW registration on admin/logger path');
                return;
            }
        }

        if (error) {
            console.error('PWA registration error:', error);
        }

        if (isRegistered) {
            console.log('PWA registered successfully:', swPath);
        }
    }, [isRegistered, error, swPath]);

    // If we are on admin/logger but this provider is for the user SW,
    // just render children without showing prompts to avoid overlap
    const shouldSuppress = typeof window !== 'undefined' &&
        (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/logger')) &&
        swPath.includes('user');

    if (shouldSuppress) {
        return <>{children}</>;
    }

    return (
        <>
            {children}
            {showInstallPrompt && (
                <>
                    <InstallPrompt />
                    <IOSInstallPrompt />
                    <IOSInstallBanner />
                </>
            )}
            {showOfflineIndicator && (
                <>
                    <OfflineIndicator />
                    <OfflineBadge />
                </>
            )}
            {showUpdatePrompt && <UpdatePrompt />}
        </>
    );
}
