'use client';

import { usePWA, useChunkLoadErrorRecovery } from '@/hooks/usePWA';
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
    appType?: 'user' | 'admin';
}

export function PWAProvider({
    children,
    swPath,
    scope = '/',
    showInstallPrompt = true,
    showOfflineIndicator = true,
    showUpdatePrompt = true,
    appType = 'user',
}: PWAProviderProps & { scope?: string }) {
    usePWA(swPath, scope, appType);
    useChunkLoadErrorRecovery();


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
                    <InstallPrompt appType={appType} />
                    <IOSInstallPrompt appType={appType} />
                    <IOSInstallBanner appType={appType} />
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
