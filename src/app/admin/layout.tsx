import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import { PWAProvider } from '@/components/pwa/PWAProvider';

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
        // Verify JWT signature using jose
        // This runs on the server, so we can securely check the signature
        const secret = new TextEncoder().encode(
            process.env.JWT_SECRET || 'your-secret-key-change-in-production'
        );

        const { payload } = await jwtVerify(token, secret);

        if (payload.role !== 'admin') {
            redirect('/');
        }
    } catch (error) {
        console.error('Admin layout auth error:', error);
        redirect('/login?callbackUrl=/admin');
    }

    return (
        <PWAProvider swPath="/sw-admin.js" showInstallPrompt={false}>
            {children}
        </PWAProvider>
    );
}
