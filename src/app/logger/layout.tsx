import { Metadata } from 'next';
import { PWAProvider } from '@/components/pwa/PWAProvider';

export const metadata: Metadata = {
    title: 'Brix Logger | Live Match Logging',
    description: 'Live match event logger for Brixsport',
    manifest: '/manifest-logger.json',
    // Amber identity -- distinguishes the logger tab from viewer (navy) and
    // admin (purple) when several BrixSports tabs are open simultaneously.
    icons: {
        icon: [
            { url: '/icons/role-colorways/logger-32.png', sizes: '32x32', type: 'image/png' },
        ],
        apple: '/icons/role-colorways/logger-192.png',
    },
};

export default function LoggerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <PWAProvider
            swPath="/sw-admin.js"
            scope="/logger"
            appType="admin"
            showInstallPrompt={true}
        >
            {children}
        </PWAProvider>
    );
}
