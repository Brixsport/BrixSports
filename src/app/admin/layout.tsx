import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import { env } from '@/lib/env';
import { PWAProvider } from '@/components/pwa/PWAProvider';
import { AdminDashboardLayout } from '@/components/admin/AdminDashboardLayout';

export const metadata: Metadata = {
    title: 'Brix Admin | Statistics & Management',
    description: 'Admin dashboard for Brixsport',
    manifest: '/manifest-admin.json',
    icons: {
        icon: [
            { url: '/assests/Logos/BRIX-SPORT-LOGO.png', type: 'image/png' },
            { url: '/favicon.ico', sizes: 'any' },
        ],
        apple: '/assests/Logos/BRIX-SPORT-LOGO.png',
    },
};

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get('authToken')?.value;

    if (!token) {
        redirect('/login?callbackUrl=/admin');
    }

    try {
        if (!env.jwtSecret) {
            console.error('[AdminLayout] JWT_SECRET is not configured');
            redirect('/login?callbackUrl=/admin');
        }
        const secret = new TextEncoder().encode(env.jwtSecret);

        const { payload } = await jwtVerify(token, secret);

        if (payload.role !== 'admin' && payload.role !== 'logger_manager') {
            redirect('/');
        }
    } catch (error) {
        console.error('Admin layout auth error:', error);
        redirect('/login?callbackUrl=/admin');
    }

    return (
        <PWAProvider
            swPath="/sw-admin.js"
            scope="/admin"
            appType="admin"
            showInstallPrompt={true}
        >
            <AdminDashboardLayout>
                {children}
            </AdminDashboardLayout>
        </PWAProvider>
    );
}
