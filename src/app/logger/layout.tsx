import { Metadata } from 'next';
import { PWAProvider } from '@/components/pwa/PWAProvider';

export const metadata: Metadata = {
    title: 'Brix Logger | Live Match Logging',
    description: 'Live match event logger for Brixsport',
    manifest: '/manifest-admin.json',
    icons: {
        icon: [
            { url: '/assests/Logos/BRIX-SPORT-LOGO.png', type: 'image/png' },
            { url: '/favicon.ico', sizes: 'any' },
        ],
        apple: '/assests/Logos/BRIX-SPORT-LOGO.png',
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
