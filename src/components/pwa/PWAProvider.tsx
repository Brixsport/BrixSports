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
        if (error) {
            console.error('PWA registration error:', error);
        }

        if (isRegistered) {
            console.log('PWA registered successfully');
        }
    }, [isRegistered, error]);

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
