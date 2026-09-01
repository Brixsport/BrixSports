import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import { env } from '@/lib/env';
import { PWAProvider } from '@/components/pwa/PWAProvider';
import { AdminDashboardLayout } from '@/components/admin/AdminDashboardLayout';

export const metadata: Metadata = {
    title: 'Brix Admin | Statistics & Management',
    description: 'Admin dashboard for Brixsport',
    manifest: '/manifest-admin.json',
    // Purple identity, distinct from viewer's brand purple (#8b5cf6) and from
    // the live-match-status red used elsewhere in the app -- see BACKLOG.md
    // favicon directive for the collision reasoning behind this pick.
    icons: {
        icon: [
            { url: '/icons/role-colorways/admin-32.png', sizes: '32x32', type: 'image/png' },
        ],
        apple: '/icons/role-colorways/admin-192.png',
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

        // BACKLOG-317: this layout runs an independent auth check on top of
        // middleware.ts (defense-in-depth) -- it had no carve-out for a real
        // logger reaching /admin/match-ratings/[id] via the "Adjust Ratings"
        // link on their own dashboard (src/app/logger/page.tsx), even though
        // that page and all 3 API routes it calls explicitly allow
        // role === 'logger'. middleware.ts threads the current pathname
        // through via the x-pathname header since a layout has no other way
        // to know it.
        const pathname = (await headers()).get('x-pathname') ?? '';
        const isScopedRatingsLogger =
            payload.role === 'logger' &&
            (pathname === '/admin/match-ratings' || pathname.startsWith('/admin/match-ratings/'));

        if (payload.role !== 'admin' && payload.role !== 'logger_manager' && !isScopedRatingsLogger) {
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
